# P0 阻断性 Bug 修复设计

- 日期：2026-07-20
- 范围：让产品的核心评分链路真正可用（端到端跑通）
- 状态：待实现

## 1. 背景与现状

影子跟读系统的核心链路是：练习页播放视频片段 → 用户录音跟读 → 提交评分 → 看分数与纠音建议 → 进入报告页回顾。当前这条链路存在多个阻断性 bug，导致**发音评分功能根本不可用**，报告也失去意义。

经全局梳理，P0 共 4 个问题（含 1 个核实中发现的连带 bug）。

## 2. 问题清单

### #1 评分链路断裂：`reference_text` 未传递
- 现象：用户录音提交必然返回 422。
- 根因：后端 `app/api/evaluate.py:16` 的 `reference_text: str = Form(...)` 是必填，但 BFF `frontend/src/app/api/sessions/[id]/attempts/route.ts:21-24` 转发到 `/evaluate/pronunciation` 时只传了 `audio`、`sentence_index`、`session_id`，从未传 `reference_text`。

### 连带 bug：BFF 返回结构与前端类型不符
- 现象：即使修好 #1，分数也不会显示。
- 根因：BFF `attempts/route.ts:53` 直接返回后端扁平的 `AttemptResponse`，但前端类型 `SubmitAttemptResponse = { attempt: SentenceAttempt }`（`types/index.ts:86`），`practice/[id]/page.tsx:67` 用 `result.attempt` 取值 → 恒为 `undefined`。

### #2 报告页不显示句子内容
- 现象：报告只显示"第 3 句 85 分"，用户无法回忆练了什么。
- 根因：`AttemptResponse`（`schemas/attempt.py`）不含句子文本；`report/[id]/page.tsx:95` 用 `"第 N 句"` 占位；后端 `get_session_report`（`api/sessions.py:83`）已查 material 但只取 title，未塞句子文本。

### #3 重播按钮无效
- 现象：点"重播"无反应。
- 根因：`practice/[id]/page.tsx:222` 调 `goToSentence(currentIndex)`，`currentIndex` 不变 → React 不重渲染 → iframe 不重载。

### #4 两步评估非原子
- 现象：评估成功但保存失败时评分丢失，且残留 `user_{uuid}.wav` 垃圾文件。
- 根因：BFF 先调 `/evaluate/pronunciation` 再调 `/attempts`，两步无事务保护。

## 3. Azure 门槛与评分后端决策

`evaluation.py` 硬依赖 Azure Speech Services 的 Pronunciation Assessment，无 `AZURE_SPEECH_KEY` 直接报错。Azure 注册需要信用卡验证（即使免费层 F0，每月 5 小时音频），构成门槛。

**决策**：评分后端做成可切换提供者，默认走**零门槛**的 Whisper + 文本相似度方案，有 Azure key 时自动走 Azure。这样无需注册任何平台即可跑通。

| 提供者 | 触发条件 | 能力 | 门槛 |
|---|---|---|---|
| Whisper + 文本相似度（默认） | 无 `AZURE_SPEECH_KEY` | 评"准确性"（说对没、说全没） | 零（Whisper 已是项目依赖） |
| Azure Pronunciation Assessment | 有 `AZURE_SPEECH_KEY` | 评"发音质量+语调" | 需注册 Azure + 信用卡 |

两者互补：初期用 Whisper 跑通并给出有意义的准确性反馈，将来想要专业发音/语调评估再填 key 切换。

## 4. 设计方案

### 4.1 评分提供者抽象

统一评分协议（输入/输出一致，便于切换）：

```
async def evaluate(user_audio_path: str, reference_text: str) -> EvaluationResult
```

- `app/services/whisper_similarity.py`（新增）：Whisper 转录 + 文本相似度评分实现。
- `app/services/evaluation.py`（重构）：`evaluate_pronunciation` 改为调度入口，根据 `settings.azure_speech_key` 分发。原 Azure 逻辑移至内部 `_evaluate_azure`。
- 去掉 `reference_audio_path` 参数（原 Azure 代码里它退化为 `user_audio_path`，无实际用途）。

### 4.2 Whisper + 文本相似度评分算法

输入：`user_audio_path`、`reference_text`。

步骤：
1. 复用 `transcription.py` 已加载的 Whisper small 模型转录用户音频，得到识别文本与词序列。
2. 文本归一化：转小写、去标点、去多余空白。
3. 词级对齐：对识别词序列与参考词序列做 Levenshtein 编辑距离对齐。
4. 逐词评分：
   - 匹配的词 → 高分（90）
   - 替换/遗漏（删除）的参考词 → 低分（40），`issue` 标注"说错/说漏"
   - 多余（插入）的识别词 → 不计入参考词评分，`issue` 标注"多读"
5. `overall_score` = 匹配词数 / 参考词总数 × 100（向下取整，最低 0）。
6. `pronunciation_score` = `overall_score`；`rhythm_score` / `intonation_score` = `overall_score`（Whisper 方案不区分韵律，保持与现有报告字段兼容）。
7. `suggestions`：基于错误词生成，如"「word」可能说漏了"。

输出：`EvaluationResult`（结构与 Azure 一致，前端无感）。

### 4.3 原子评估保存接口（修 #1 + #4 + 连带）

新增后端接口 `POST /attempts/evaluate`（`api/attempts.py`）：

- 入参（multipart form）：`audio`（文件）、`reference_text`（字符串）、`session_id`、`sentence_index`（整数）。
- 流程：
  1. 保存用户音频到 `{upload_dir}/user_{uuid}.wav`。
  2. 调 `evaluate_pronunciation(user_audio_path, reference_text)` 得 `EvaluationResult`。
  3. 构造 `SentenceAttempt`（`score`、`word_scores_json`、`suggestions_json`、`audio_recording_url=user_audio_path`）。
  4. 单事务 `db.add` + `commit` + `refresh`。
  5. 返回 `AttemptResponse`。
- 错误处理：评分失败时不写库（事务天然回滚），返回 500 + 错误信息；不残留 attempt 记录。用户音频文件仍会落盘（可接受，后续 P3 可加清理）。
- 保留原 `POST /attempts`（JSON）供内部/测试，不在前端链路使用。

### 4.4 BFF 改造

`frontend/src/app/api/sessions/[id]/attempts/route.ts`：
- 从 formData 读取 `audio`、`sentence_index`、`reference_text`。
- 单次转发到后端 `POST /attempts/evaluate`（multipart）。
- 检查 `res.ok`，失败时返回错误状态与信息。
- 成功时返回 `{ attempt: <AttemptResponse> }`，与前端 `SubmitAttemptResponse` 类型对齐。

### 4.5 报告句子文本（修 #2）

- `schemas/attempt.py`：`AttemptResponse` 增加可选字段 `sentence_text: str | None = None`。
- `api/sessions.py` `get_session_report`：已查询 material，从 `material.transcript_json["segments"]` 中按 `sentence_index` 取 `text`，填入每个 attempt 响应的 `sentence_text`。找不到时为 `None`。
- `frontend/src/types/index.ts`：`SentenceAttempt` 增加可选 `sentence_text?: string`。
- `frontend/src/app/report/[id]/page.tsx:95`：`sentenceText` 改用 `attempt.sentence_text ?? \`第 ${attempt.sentence_index + 1} 句\``（兜底）。

### 4.6 重播按钮（修 #3）

- `practice/[id]/page.tsx`：新增 `replayKey` state。
- 在渲染 `<VideoPlayer>` 处加上 `key={`${currentIndex}-${replayKey}`}` prop，强制 React 在 `currentIndex` 或 `replayKey` 变化时重挂载组件、重载 iframe 并 autoplay。
- "重播"按钮 onClick：`setReplayKey(k => k + 1)`。
- 切换句子（上一/下一句）时 `replayKey` 无需重置，`currentIndex` 变化已触发重挂载。

## 5. 改动清单

### 后端
| 文件 | 改动 |
|---|---|
| `app/services/whisper_similarity.py` | 新增：Whisper 转录 + 文本相似度评分 |
| `app/services/evaluation.py` | 重构为调度入口，按 key 分发 Azure / Whisper |
| `app/schemas/attempt.py` | `AttemptResponse` 加 `sentence_text: str \| None = None`（原子接口用 multipart form 参数，无需新增 JSON 请求 schema） |
| `app/api/attempts.py` | 新增 `POST /attempts/evaluate` 原子接口（form 入参） |
| `app/api/sessions.py` | `get_session_report` 填充 `sentence_text` |
| `app/api/evaluate.py` | 不改动，保留原 `/evaluate/pronunciation` 通用接口（前端链路改走 `/attempts/evaluate` 后不再调用它，保留无害） |

### 前端
| 文件 | 改动 |
|---|---|
| `src/types/index.ts` | `SentenceAttempt` 加 `sentence_text?`；`submitAttempt` 签名加 `referenceText` |
| `src/lib/api-client.ts` | `submitAttempt` 传 `reference_text` |
| `src/app/api/sessions/[id]/attempts/route.ts` | 单次转发到 `/attempts/evaluate`，返回 `{attempt}` |
| `src/app/practice/[id]/page.tsx` | `submitAttempt` 传 `currentSentence.text`；重播用 `replayKey` |
| `src/app/report/[id]/page.tsx` | `sentenceText` 用 `attempt.sentence_text` |

## 6. 数据流（修复后）

```
练习页录音完成
  → apiClient.submitAttempt(sessionId, blob, sentenceIndex, currentSentence.text)
  → BFF POST /api/sessions/{id}/attempts  (formData: audio, sentence_index, reference_text)
  → 后端 POST /attempts/evaluate
      1. 保存 user_{uuid}.wav
      2. evaluate_pronunciation(user_audio_path, reference_text)
         ├─ 无 AZURE_SPEECH_KEY → Whisper 相似度评分
         └─ 有 key              → Azure 发音评估
      3. 事务写 SentenceAttempt
      4. 返回 AttemptResponse
  → BFF 包成 { attempt: AttemptResponse }
  → 练习页 setAttempts[currentIndex] = result.attempt  (分数正常显示)

完成练习 → 报告页
  → getReport(sessionId) → get_session_report
      从 material.transcript_json 按 sentence_index 填 sentence_text
  → 报告页逐句显示 attempt.sentence_text + 分数
```

## 7. 错误处理

- 评分失败（如 Whisper 转录异常、Azure 调用失败）：后端原子接口不写库，返回 500；BFF 透传错误；前端 `handleRecordingComplete` catch 后提示"评分失败，请重试"。
- `reference_text` 为空：后端返回 400（参考文本必填，否则评分无意义）。
- `sentence_index` 越界：报告拼接时 `sentence_text` 为 `None`，前端兜底显示"第 N 句"。
- BFF 不再静默吞错（修 #19 的相关部分）：检查 `res.ok`，失败时返回真实错误状态。

## 8. 测试策略

### 后端
- `whisper_similarity` 单元测试：mock Whisper 转录结果，验证归一化、Levenshtein 对齐、逐词评分、overall_score 计算、suggestions 生成。覆盖完全正确、部分错误、全错、空音频等场景。
- `attempts/evaluate` 接口测试：mock 评分提供者，验证原子性（评分失败时不写 attempt）、`reference_text` 缺失返回 400、成功返回 `AttemptResponse`。
- `get_session_report` 测试：验证 `sentence_text` 按 `sentence_index` 正确拼接、越界兜底。

### 前端
- 练习页：重播按钮触发 `replayKey` 递增 → VideoPlayer 重挂载；`submitAttempt` 携带 `reference_text`。
- 报告页：`attempt.sentence_text` 存在时显示真实句子，缺失时兜底"第 N 句"。

## 9. 非目标（YAGNI）

本设计**不做**以下内容（归属其他优先级）：
- VAD 自动录音 / 自动播放流程（P1）
- 视频 iframe 替换为原生 audio（P1）
- 波形对比接入（P1/P2）
- 鉴权（P3）
- `source_url` SSRF 校验（P3）
- 音频上传大小限制（P3）
- session 重复创建治理（P2）
- 用户音频文件定期清理（P3）

## 10. 验收标准

1. 不配置 `AZURE_SPEECH_KEY` 时，练习页录音提交能返回真实分数（基于 Whisper 相似度），分数与逐词评分、纠音建议正常显示。
2. 报告页逐句回顾显示真实句子文本，而非"第 N 句"。
3. 练习页"重播"按钮点击后视频重新播放。
4. 评分失败时不残留 attempt 记录（事务回滚验证）。
5. 配置 `AZURE_SPEECH_KEY` 后，评分自动切换为 Azure 发音评估（如可用）。
