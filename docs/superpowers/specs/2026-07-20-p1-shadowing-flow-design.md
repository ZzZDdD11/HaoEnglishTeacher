# P1 全自动双轨跟读流程设计

- 日期：2026-07-20
- 范围：把"听→读→评→下一句"从手动多步变为全自动顺滑流程
- 状态：待实现
- 依赖：P0 已完成（评分链路、原子接口、报告句子文本）

## 1. 背景与目标

当前练习页用 YouTube/B站 iframe 嵌入播放视频片段，用户必须**手动暂停视频 + 手动点录音 + 手动停止**，极其繁琐。根因：iframe 受跨域限制无法程序化监听"播放结束"来自动触发录音。

P1 目标：实现**全自动跟读**——进入句子自动播放、播完自动录音、说完自动停止、自动提交评分、显示分数后自动下一句。同时**保留视频画面**（看口型/场景），且 **YouTube 与 B站通用**。

## 2. 关键决策

| 决策点 | 选择 | 理由 |
|---|---|---|
| 交互模式 | 全自动 | 用户选择，最顺滑 |
| 视频画面 | 保留 | 用户要看口型/场景 |
| 播放器方案 | 双轨（静音 iframe 画面 + 原生 audio 声音主控） | YouTube/B站通用；B站无 JS API，纯 iframe 无法全自动；双轨绕过跨域限制 |
| 素材来源 | YouTube + B站 都要 | 用户选择 |
| VAD 停止 | Web Audio API 静音检测 1.5s + 30s 最长兜底 | 零依赖前端方案 |
| 分数节奏 | 显示 3s 自动下一句 + 立即下一句按钮 | 平衡全自动与可读性 |
| 自动流开关 | 默认开启，可 ⏸ 暂停切手动 | 兜底 |

## 3. 架构：双轨播放器 + 状态机

### 3.1 双轨播放器

替代当前单一 iframe 的 `VideoPlayer`：

- **iframe（静音画面轨）**：YouTube `embed?start=X&end=Y&autoplay=1&mute=1`；B站 `player.html?bvid=B&autoplay=1`（B站 embed 无 mute 参数，需另处理：见 3.4）。只负责显示画面，不出声。
- **原生 `<audio>`（声音主控轨）**：`src=/api/materials/{id}/audio`，按 `start_ms~end_ms` 播放参考音频，出声。`ended`/到达 end_ms 触发"播放完成"回调。

进入句子时两轨同时启动；以 **audio 为时间权威**（声音是跟读依据），iframe 画面辅助。iframe 加载慢于 audio，画面可能延迟 1-2s 出现，但静音画面不影响跟读。

### 3.2 状态机（practice 页）

```
idle ──进入句子──> playing(双轨)
                       │ audio ended
                       ▼
                  recording(VAD)
                       │ 静音1.5s / 最长30s
                       ▼
                  evaluating(自动提交)
                       │ 评分返回
                       ▼
                  showing_score(3s)
                       │ 3s 到 / 立即下一句
                       ▼
                  next ──非末句──> playing(下一句)
                       │ 末句
                       ▼
                  completed ──> 报告页
```

任意状态可被兜底控制打断：⏸暂停（冻结状态机）、🔁重录（回 recording）、⏭立即下一句（跳到 next）、⏮上一句。

### 3.3 VAD 语音活动检测

`useRecorder` 增强：录音时用 Web Audio API `AnalyserNode` 实时监测音量（RMS）。音量低于阈值持续 **1.5s** 判定"说完"，自动 stop。同时设 **30s 最长录音**兜底，防止 VAD 失灵无限录。

### 3.4 B站静音处理

B站 embed URL 无 `mute` 参数。方案：B站 iframe 仍嵌入，但其音频不可避免。权衡选项：
- 接受 B站 iframe 出声 + audio 出声重叠（体验差）——否决
- B站 iframe 用 `volume=0`（若支持）或后端不依赖 iframe 声音——B站 player 不支持 volume 参数
- **采用**：B站场景下 iframe 仍嵌入显示画面，接受其原声音量；audio 轨作为"可重听的参考"。或更简单：B站时 iframe 静音不可控，则 B站降级为"iframe 出声为主、无 audio 轨"的半自动。

> 实现时优先验证 B站 embed 是否可通过 `player.html?...&mute=1` 静音；若不可，B站降级为半自动（iframe 出声 + 手动录音），YouTube 走全自动双轨。这是已知 trade-off，不阻塞 P1 主体。

## 4. 后端改动

| 改动 | 文件 | 说明 |
|---|---|---|
| Material 加 `audio_filename` 字段 | `app/models/material.py` | `String(255), default=""`，存 `{video_id}.wav` |
| alembic 迁移 | `alembic/versions/` | 加列 `audio_filename` |
| process_video_task 保存 audio_filename | `app/tasks/process_video.py` | `download_video` 返回 path，提取文件名存入 material |
| 新增 audio serve 路由 | `app/api/materials.py` | `GET /materials/{id}/audio` → `FileResponse(upload_dir/audio_filename)`，404 若文件不存在 |
| Material schema 暴露 audio_url（可选） | `app/schemas/material.py` | 便于前端构造；或前端直接用 `/api/materials/{id}/audio` |

## 5. 前端改动

| 改动 | 文件 | 说明 |
|---|---|---|
| `VideoPlayer` 重构为双轨 | `src/components/VideoPlayer.tsx` | props 加 `audioSrc`、`onAudioEnded`；渲染 iframe(静音) + `<audio>`(主控)；按 start/end 控制 audio 播放 |
| `useRecorder` 增 VAD | `src/hooks/useRecorder.ts` | 加 `startWithVad()`：录音时 AnalyserNode 监测，静音 1.5s 自动 stop；保留手动 stop |
| practice 页状态机 | `src/app/practice/[id]/page.tsx` | 实现 idle/playing/recording/evaluating/showing_score/next 流转；复用 P0 的 submitAttempt |
| 兜底控制栏 | practice 页 | ⏸暂停自动流 / 🔁重录 / ⏭立即下一句 / ⏮上一句 |
| BFF audio 代理 | `src/app/api/materials/[id]/audio/route.ts` | 透传后端 `/materials/{id}/audio`，避免直连后端端口 |

## 6. 数据流（修复后）

```
进入句子(currentIndex 变化)
  → VideoPlayer 双轨启动：iframe(静音画面,start~end) + <audio>(参考音频,start~end)
  → <audio> 播放到 end_ms → onAudioEnded 回调
  → 状态机 playing→recording：useRecorder.startWithVad()
  → VAD 静音1.5s / 30s → 自动 stop
  → 状态机 recording→evaluating：apiClient.submitAttempt(sessionId, blob, idx, sentence.text)
  → 评分返回 → showing_score：显示分数+逐词+建议
  → 3s 后 / 点立即下一句 → next：goToSentence(idx+1)
  → 循环 → 末句 → completed → router.push(/report/{sessionId})
```

## 7. 错误处理

- audio 文件不存在（material 未处理完/audio_filename 缺失）：audio serve 返回 404；前端 VideoPlayer 显示"参考音频不可用"，自动流降级为半自动（iframe 出声 + 手动录音）。
- 录音权限拒绝：`getUserMedia` reject，提示"请允许麦克风权限"，自动流暂停。
- VAD 误判（环境噪声/未说完即停）：用户可点 🔁重录；30s 兜底防无限录。
- 评分失败（P0 已处理）：显示"评分失败"，停留供重录，不自动下一句。

## 8. 测试策略

### 后端
- `GET /materials/{id}/audio`：material 存在+文件存在→200 audio；文件缺失→404；material 不存在→404
- `process_video_task` 保存 audio_filename：mock download_video 返回 path，验证 material.audio_filename 被设置
- Material schema：audio_filename 字段

### 前端（无测试框架，build + 手动验证）
- `npm run build` 类型检查
- 手动：YouTube 素材全自动跑通；B站降级验证；重录/暂停/立即下一句兜底

## 9. 非目标（YAGNI）

- 波形对比接入（#8，P2）
- 键盘快捷键（P2）
- 评分后端改动（P0 已完成）
- B站 Player API（不存在）
- session 重复创建治理（P2）
- 音频文件清理（P3）

## 10. 验收标准

1. YouTube 素材：进入练习页后自动播放→自动录音→VAD 自动停止→自动提交→显示分数 3s→自动下一句，全程无需手动点击。
2. 视频画面可见（iframe 静音显示），参考音频从 `<audio>` 出声。
3. B站素材：至少半自动可用（iframe 出声 + 手动录音），不报错。
4. 兜底控制生效：⏸暂停冻结自动流、🔁重录覆盖当前句、⏭立即下一句、⏮上一句。
5. VAD：说完停顿 1.5s 自动停止；超过 30s 强制停止。
6. 末句自动完成跳转报告页。
