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
