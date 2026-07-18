# HaoEnglishTeacher — 影子跟读英语学习系统

基于影子跟读（Shadowing）方法的英语发音学习系统。

## 快速开始

```bash
cp .env.example .env
# 编辑 .env 填入 AZURE_SPEECH_KEY
docker compose up
```

打开 http://localhost:3000

## 技术栈

- 前端: Next.js 14 + TypeScript + Tailwind CSS
- 后端: Python FastAPI + Celery + Redis
- 数据库: PostgreSQL
- 语音: Whisper + Azure Speech API

## 项目结构

```
├── docker-compose.yml      # 本地开发环境
├── frontend/               # Next.js 前端 (App Router)
│   ├── src/app/            # 页面 & API Routes (BFF)
│   ├── src/components/     # React 组件
│   ├── src/hooks/          # 自定义 Hooks
│   ├── src/lib/            # API 客户端 & 存储工具
│   └── src/types/          # TypeScript 类型定义
└── backend/                # Python FastAPI 后端
    ├── app/api/            # API 路由
    ├── app/models/         # SQLAlchemy 数据模型
    ├── app/schemas/        # Pydantic 请求/响应模型
    ├── app/services/       # 业务逻辑层
    ├── app/tasks/          # Celery 异步任务
    └── tests/              # 测试
```

## 开发

### 后端测试

```bash
cd backend
pytest tests/ -v
```

### 前端构建

```bash
cd frontend
npm run build
```

## 已知问题

- Whisper 首次加载会下载模型文件（~500MB），需要稳定的网络连接
- Azure Speech API 需要有效的订阅密钥才能使用发音评估功能
- MVP 使用轮询检测视频处理状态（v2 将升级为 WebSocket）
- B站视频嵌入可能因跨域限制无法正常播放

## 故障排除

1. **PostgreSQL 连接失败**: 确保 `docker compose up -d postgres` 已启动
2. **Celery Worker 未启动**: 检查 Redis 是否运行正常
3. **Whisper 下载失败**: 可能需要设置代理环境变量
4. **Azure API 调用失败**: 确认 `.env` 中 `AZURE_SPEECH_KEY` 和 `AZURE_SPEECH_REGION` 配置正确
