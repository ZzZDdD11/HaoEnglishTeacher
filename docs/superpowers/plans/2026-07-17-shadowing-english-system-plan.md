# 影子跟读英语学习系统 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a web app where users paste YouTube/B站 links, practice sentence-by-sentence shadowing, and get word-level pronunciation scores and suggestions.

**Architecture:** Next.js frontend (App Router + Tailwind) talks to Next.js API Routes (BFF layer), which proxy to a Python FastAPI backend for video processing, Whisper transcription, and Azure Speech pronunciation assessment. Celery + Redis handle async video processing. PostgreSQL stores materials, sessions, and attempts. MVP uses guest mode with localStorage — no auth.

**Tech Stack:** Next.js 14, TypeScript, Tailwind CSS, Python FastAPI, Celery, Redis, PostgreSQL, Whisper, Azure Speech API, yt-dlp, ffmpeg, Docker Compose.

## Global Constraints

- No user authentication in MVP — guest mode with localStorage
- Sentence-by-sentence mode only (no synchronous shadowing)
- Word-level scoring via Azure Speech API (no phoneme-level alignment)
- URL paste only for video source (no file upload, no built-in library)
- Docker Compose for local dev — single command to start all services
- All backend communication: Next.js BFF → Python FastAPI (never browser → Python directly)

---

## File Structure

```
HaoEnglishTeacher/
├── docker-compose.yml
├── .env.example
├── README.md
├── frontend/
│   ├── package.json
│   ├── next.config.js
│   ├── tsconfig.json
│   ├── tailwind.config.ts
│   ├── postcss.config.js
│   └── src/
│       ├── app/
│       │   ├── layout.tsx
│       │   ├── page.tsx                    # 素材准备页
│       │   ├── practice/[id]/
│       │   │   └── page.tsx                # 跟读练习页
│       │   ├── report/[id]/
│       │   │   └── page.tsx                # 反馈报告页
│       │   └── api/
│       │       ├── materials/
│       │       │   ├── route.ts
│       │       │   └── [id]/
│       │       │       └── route.ts
│       │       ├── sessions/
│       │       │   ├── route.ts
│       │       │   └── [id]/
│       │       │       ├── route.ts
│       │       │       ├── attempts/
│       │       │       │   └── route.ts
│       │       │       └── report/
│       │       │           └── route.ts
│       │       └── ws/
│       │           └── session/
│       │               └── [id]/
│       │                   └── route.ts     # WebSocket endpoint
│       ├── components/
│       │   ├── MaterialForm.tsx
│       │   ├── MaterialList.tsx
│       │   ├── VideoPlayer.tsx
│       │   ├── RecorderPanel.tsx
│       │   ├── WaveformCompare.tsx
│       │   ├── ScoreDisplay.tsx
│       │   ├── SentenceReview.tsx
│       │   ├── SuggestionCard.tsx
│       │   └── ProgressBar.tsx
│       ├── hooks/
│       │   ├── useRecorder.ts
│       │   ├── useWaveform.ts
│       │   └── useWebSocket.ts
│       ├── lib/
│       │   ├── api-client.ts
│       │   └── storage.ts
│       └── types/
│           └── index.ts
└── backend/
    ├── pyproject.toml
    ├── alembic.ini
    ├── alembic/
    │   ├── env.py
    │   └── versions/
    ├── app/
    │   ├── main.py
    │   ├── config.py
    │   ├── models/
    │   │   ├── __init__.py
    │   │   ├── material.py
    │   │   ├── session.py
    │   │   └── attempt.py
    │   ├── schemas/
    │   │   ├── __init__.py
    │   │   ├── material.py
    │   │   ├── session.py
    │   │   ├── attempt.py
    │   │   └── evaluation.py
    │   ├── api/
    │   │   ├── __init__.py
    │   │   ├── process.py
    │   │   ├── evaluate.py
    │   │   └── health.py
    │   ├── services/
    │   │   ├── __init__.py
    │   │   ├── video.py
    │   │   ├── transcription.py
    │   │   ├── evaluation.py
    │   │   └── suggestion.py
    │   ├── tasks/
    │   │   ├── __init__.py
    │   │   ├── celery_app.py
    │   │   └── process_video.py
    │   └── db/
    │       ├── __init__.py
    │       ├── database.py
    │       └── base.py
    └── tests/
        ├── __init__.py
        ├── conftest.py
        ├── test_video.py
        ├── test_transcription.py
        └── test_evaluation.py
```

---

## Phase 1: Project Skeleton & Docker Compose

### Task 1.1: Initialize project root with Docker Compose

**Files:**
- Create: `docker-compose.yml`
- Create: `.env.example`
- Create: `README.md`

**Interfaces:**
- Produces: Docker Compose services — `postgres` (port 5432), `redis` (port 6379), `backend` (port 8000), `frontend` (port 3000), `celery-worker`

- [ ] **Step 1: Create .env.example**

```
DATABASE_URL=postgresql+asyncpg://postgres:postgres@postgres:5432/shadowing
DATABASE_URL_SYNC=postgresql://postgres:postgres@postgres:5432/shadowing
REDIS_URL=redis://redis:6379/0
AZURE_SPEECH_KEY=
AZURE_SPEECH_REGION=eastasia
UPLOAD_DIR=/app/data/uploads
PYTHON_SERVICE_URL=http://backend:8000
```

- [ ] **Step 2: Create docker-compose.yml**

```yaml
version: "3.8"

services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: shadowing
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

  backend:
    build: ./backend
    command: uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
    ports:
      - "8000:8000"
    env_file:
      - .env
    volumes:
      - ./backend:/app
      - uploads:/app/data/uploads
    depends_on:
      - postgres
      - redis

  celery-worker:
    build: ./backend
    command: celery -A app.tasks.celery_app worker --loglevel=info
    env_file:
      - .env
    volumes:
      - ./backend:/app
      - uploads:/app/data/uploads
    depends_on:
      - postgres
      - redis

  frontend:
    build: ./frontend
    command: npm run dev
    ports:
      - "3000:3000"
    environment:
      - PYTHON_SERVICE_URL=http://backend:8000
    volumes:
      - ./frontend:/app
      - /app/node_modules
    depends_on:
      - backend

volumes:
  pgdata:
  uploads:
```

- [ ] **Step 3: Create README.md**

```markdown
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
```

- [ ] **Step 4: Run docker compose to verify services start**

```bash
cd /Users/hao/Code/HaoEnglishTeacher
docker compose up -d postgres redis
docker compose ps
```

Expected: postgres and redis containers running

- [ ] **Step 5: Commit**

```bash
git add docker-compose.yml .env.example README.md
git commit -m "feat: add docker compose skeleton with postgres and redis"
```

---

### Task 1.2: Initialize Python FastAPI backend

**Files:**
- Create: `backend/pyproject.toml`
- Create: `backend/Dockerfile`
- Create: `backend/app/__init__.py`
- Create: `backend/app/main.py`
- Create: `backend/app/config.py`
- Create: `backend/app/db/__init__.py`
- Create: `backend/app/db/base.py`
- Create: `backend/app/db/database.py`
- Create: `backend/app/api/__init__.py`
- Create: `backend/app/api/health.py`
- Create: `backend/tests/__init__.py`
- Create: `backend/tests/conftest.py`

**Interfaces:**
- Produces: FastAPI app on port 8000, `GET /health` returning `{"status": "ok"}`, SQLAlchemy async engine via `get_db()`, declarative `Base`

- [ ] **Step 1: Create backend/pyproject.toml**

```toml
[project]
name = "shadowing-backend"
version = "0.1.0"
requires-python = ">=3.11"
dependencies = [
    "fastapi[standard]>=0.110",
    "uvicorn[standard]",
    "sqlalchemy[asyncio]>=2.0",
    "asyncpg",
    "alembic",
    "celery[redis]",
    "redis",
    "yt-dlp",
    "openai-whisper",
    "azure-cognitiveservices-speech",
    "pydantic-settings",
    "httpx",
    "python-multipart",
]

[project.optional-dependencies]
dev = [
    "pytest",
    "pytest-asyncio",
    "httpx",
]

[build-system]
requires = ["setuptools"]
build-backend = "setuptools.build_meta"
```

- [ ] **Step 2: Create backend/Dockerfile**

```dockerfile
FROM python:3.11-slim

RUN apt-get update && apt-get install -y ffmpeg && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY pyproject.toml .
RUN pip install --no-cache-dir .

COPY . .

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

- [ ] **Step 3: Create backend/app/config.py**

```python
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/shadowing"
    database_url_sync: str = "postgresql://postgres:postgres@localhost:5432/shadowing"
    redis_url: str = "redis://localhost:6379/0"
    azure_speech_key: str = ""
    azure_speech_region: str = "eastasia"
    upload_dir: str = "./data/uploads"

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()
```

- [ ] **Step 4: Create backend/app/db/base.py**

```python
from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    pass
```

- [ ] **Step 5: Create backend/app/db/database.py**

```python
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker

from app.config import settings

engine = create_async_engine(settings.database_url, echo=False)
async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def get_db() -> AsyncSession:
    async with async_session() as session:
        try:
            yield session
        finally:
            await session.close()
```

- [ ] **Step 6: Create backend/app/api/health.py**

```python
from fastapi import APIRouter

router = APIRouter()


@router.get("/health")
async def health():
    return {"status": "ok"}
```

- [ ] **Step 7: Create backend/app/main.py**

```python
from fastapi import FastAPI

from app.api.health import router as health_router

app = FastAPI(title="Shadowing English Teacher API", version="0.1.0")

app.include_router(health_router)


@app.get("/")
async def root():
    return {"service": "shadowing-backend", "version": "0.1.0"}
```

- [ ] **Step 8: Create backend/tests/conftest.py**

```python
import pytest
from httpx import AsyncClient, ASGITransport

from app.main import app


@pytest.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
```

- [ ] **Step 9: Run health check test manually**

```bash
cd backend
pip install -e ".[dev]"
pytest -v
# Expected: 0 tests collected (no test files with tests yet)
```

- [ ] **Step 10: Verify app starts**

```bash
cd backend
uvicorn app.main:app --port 8000 &
sleep 2
curl http://localhost:8000/health
# Expected: {"status":"ok"}
kill %1
```

- [ ] **Step 11: Commit**

```bash
git add backend/
git commit -m "feat: initialize FastAPI backend with health endpoint"
```

---

### Task 1.3: Initialize Next.js frontend

**Files:**
- Create: `frontend/package.json`
- Create: `frontend/next.config.js`
- Create: `frontend/tsconfig.json`
- Create: `frontend/tailwind.config.ts`
- Create: `frontend/postcss.config.js`
- Create: `frontend/Dockerfile`
- Create: `frontend/src/app/layout.tsx`
- Create: `frontend/src/app/page.tsx`
- Create: `frontend/src/types/index.ts`
- Create: `frontend/.gitignore`

**Interfaces:**
- Produces: Next.js app on port 3000, root page with placeholder UI, shared TypeScript types

- [ ] **Step 1: Create frontend/package.json**

```json
{
  "name": "shadowing-frontend",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start"
  },
  "dependencies": {
    "next": "^14.2.0",
    "react": "^18.3.0",
    "react-dom": "^18.3.0"
  },
  "devDependencies": {
    "@types/node": "^20",
    "@types/react": "^18",
    "@types/react-dom": "^18",
    "autoprefixer": "^10",
    "postcss": "^8",
    "tailwindcss": "^3.4",
    "typescript": "^5"
  }
}
```

- [ ] **Step 2: Create frontend/next.config.js**

```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/python/:path*',
        destination: `${process.env.PYTHON_SERVICE_URL || 'http://localhost:8000'}/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
```

- [ ] **Step 3: Create frontend/tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{"name": "next"}],
    "paths": {"@/*": ["./src/*"]}
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 4: Create frontend/tailwind.config.ts**

```ts
import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {},
  },
  plugins: [],
};

export default config;
```

- [ ] **Step 5: Create frontend/postcss.config.js**

```js
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

- [ ] **Step 6: Create frontend/Dockerfile**

```dockerfile
FROM node:20-alpine

WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install
COPY . .

CMD ["npm", "run", "dev"]
```

- [ ] **Step 7: Create frontend/src/types/index.ts**

```ts
// ===== Material =====
export interface TranscriptSentence {
  sentence_index: number;
  text: string;
  start_ms: number;
  end_ms: number;
  words: TranscriptWord[];
}

export interface TranscriptWord {
  word: string;
  start_ms: number;
  end_ms: number;
}

export interface Material {
  id: string;
  source_type: "youtube" | "bilibili";
  source_url: string;
  title: string;
  duration_seconds: number;
  transcript: TranscriptSentence[] | null;
  status: "processing" | "ready" | "error";
  created_at: string;
}

// ===== Practice Session =====
export interface PracticeSession {
  id: string;
  material_id: string;
  mode: "sentence_by_sentence";
  status: "in_progress" | "completed";
  overall_score: number | null;
  pronunciation_score: number | null;
  rhythm_score: number | null;
  intonation_score: number | null;
  completed_at: string | null;
  created_at: string;
}

// ===== Sentence Attempt =====
export interface WordScore {
  word: string;
  score: number;
  issue: string | null;
}

export interface SentenceAttempt {
  id: string;
  session_id: string;
  sentence_index: number;
  score: number;
  word_scores: WordScore[];
  waveform_data: number[] | null;
  suggestions: string[];
  created_at: string;
}

// ===== Report =====
export interface PracticeReport {
  session: PracticeSession;
  attempts: SentenceAttempt[];
  material_title: string;
}

// ===== API Payloads =====
export interface CreateMaterialPayload {
  source_url: string;
}

export interface CreateSessionPayload {
  material_id: string;
  mode: "sentence_by_sentence";
}

export interface SubmitAttemptPayload {
  audio: Blob;
  sentence_index: number;
}

export interface SubmitAttemptResponse {
  attempt: SentenceAttempt;
}

// ===== Guest Storage =====
export interface GuestRecord {
  material_ids: string[];
  session_ids: string[];
}
```

- [ ] **Step 8: Create frontend/src/app/layout.tsx**

```tsx
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "影子跟读 — 英语发音练习",
  description: "基于影子跟读方法的英语发音学习系统",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body className="min-h-screen bg-gray-50 text-gray-900 antialiased">
        {children}
      </body>
    </html>
  );
}
```

- [ ] **Step 9: Create frontend/src/app/globals.css**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

- [ ] **Step 10: Create frontend/src/app/page.tsx (placeholder)**

```tsx
export default function HomePage() {
  return (
    <main className="max-w-4xl mx-auto py-12 px-4">
      <h1 className="text-3xl font-bold mb-4">🎤 影子跟读</h1>
      <p className="text-gray-600 mb-8">
        粘贴视频链接，逐句跟读模仿，AI 自动纠正发音
      </p>
      <div className="border-2 border-dashed border-gray-300 rounded-xl p-12 text-center text-gray-400">
        素材准备页 — 即将实现
      </div>
    </main>
  );
}
```

- [ ] **Step 11: Create frontend/.gitignore**

```
node_modules/
.next/
```

- [ ] **Step 12: Build frontend Docker image to verify**

```bash
cd /Users/hao/Code/HaoEnglishTeacher
docker compose build frontend
docker compose up -d frontend
sleep 5
curl http://localhost:3000 | head -20
# Expected: HTML with "影子跟读" title
docker compose stop frontend
```

- [ ] **Step 13: Commit**

```bash
git add frontend/
git commit -m "feat: initialize Next.js frontend with Tailwind and Dockerfile"
```

---

### Task 1.4: Set up Alembic and create initial migration

**Files:**
- Create: `backend/alembic.ini`
- Create: `backend/alembic/env.py`
- Create: `backend/alembic/script.py.mako`
- Create: `backend/alembic/versions/001_initial.py`

**Interfaces:**
- Consumes: `app.db.base.Base` (declarative base), `app.config.settings.database_url_sync`
- Produces: `alembic upgrade head` creates tables for Material, PracticeSession, SentenceAttempt

- [ ] **Step 1: Create backend/alembic.ini**

```ini
[alembic]
script_location = alembic
sqlalchemy.url = postgresql://postgres:postgres@localhost:5432/shadowing

[loggers]
keys = root,sqlalchemy,alembic

[handlers]
keys = console

[formatters]
keys = generic

[logger_root]
level = WARN
handlers = console

[logger_sqlalchemy]
level = WARN
handlers =
qualname = sqlalchemy.engine

[logger_alembic]
level = INFO
handlers =
qualname = alembic

[handler_console]
class = StreamHandler
args = (sys.stderr,)
level = NOTSET
formatter = generic

[formatter_generic]
format = %(levelname)-5.5s [%(name)s] %(message)s
datefmt = %H:%M:%S
```

- [ ] **Step 2: Create backend/alembic/env.py**

```python
from logging.config import fileConfig

from alembic import context
from sqlalchemy import engine_from_config, pool

from app.config import settings
from app.db.base import Base
from app.models import material, session, attempt  # noqa: register models

config = context.config
config.set_main_option("sqlalchemy.url", settings.database_url_sync)

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def run_migrations_offline():
    url = config.get_main_option("sqlalchemy.url")
    context.configure(url=url, target_metadata=target_metadata, literal_binds=True)
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online():
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
```

- [ ] **Step 3: Create backend/alembic/script.py.mako**

Keep default from `alembic init`.

- [ ] **Step 4: Create empty models first, then generate migration**

Create `backend/app/models/__init__.py`:

```python
from app.models.material import Material
from app.models.session import PracticeSession
from app.models.attempt import SentenceAttempt

__all__ = ["Material", "PracticeSession", "SentenceAttempt"]
```

Create `backend/app/models/material.py`:

```python
import uuid
from datetime import datetime

from sqlalchemy import String, Integer, Float, Text, DateTime
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class Material(Base):
    __tablename__ = "materials"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4()))
    source_type: Mapped[str] = mapped_column(String(20), nullable=False)
    source_url: Mapped[str] = mapped_column(String(2048), nullable=False)
    title: Mapped[str] = mapped_column(String(500), default="")
    duration_seconds: Mapped[float] = mapped_column(Float, default=0.0)
    transcript_json: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="processing")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
```

Create `backend/app/models/session.py`:

```python
import uuid
from datetime import datetime

from sqlalchemy import String, Float, DateTime
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class PracticeSession(Base):
    __tablename__ = "practice_sessions"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4()))
    material_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    mode: Mapped[str] = mapped_column(String(30), default="sentence_by_sentence")
    status: Mapped[str] = mapped_column(String(20), default="in_progress")
    overall_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    pronunciation_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    rhythm_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    intonation_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
```

Create `backend/app/models/attempt.py`:

```python
import uuid
from datetime import datetime

from sqlalchemy import String, Integer, Float, DateTime
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class SentenceAttempt(Base):
    __tablename__ = "sentence_attempts"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4()))
    session_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    sentence_index: Mapped[int] = mapped_column(Integer, nullable=False)
    audio_recording_url: Mapped[str] = mapped_column(String(2048), default="")
    reference_audio_url: Mapped[str] = mapped_column(String(2048), default="")
    score: Mapped[float] = mapped_column(Float, default=0.0)
    word_scores_json: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    waveform_data_json: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    suggestions_json: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
```

- [ ] **Step 5: Run alembic autogenerate**

```bash
cd backend
pip install -e .
docker compose up -d postgres
sleep 3
alembic revision --autogenerate -m "initial"
alembic upgrade head
```

Expected: creates tables in postgres

- [ ] **Step 6: Verify tables exist**

```bash
docker compose exec postgres psql -U postgres -d shadowing -c "\dt"
```

Expected: `materials`, `practice_sessions`, `sentence_attempts`

- [ ] **Step 7: Commit**

```bash
git add backend/alembic* backend/app/models/
git commit -m "feat: add SQLAlchemy models and alembic migration"
```

---

## Phase 2: Video Processing Pipeline

### Task 2.1: Video download and audio extraction service

**Files:**
- Create: `backend/app/services/__init__.py`
- Create: `backend/app/services/video.py`
- Create: `backend/tests/test_video.py`

**Interfaces:**
- Consumes: `settings.upload_dir`
- Produces: `download_video(url: str) -> str` returning path to downloaded audio WAV, `VideoInfo` dataclass with title, duration

- [ ] **Step 1: Write the failing test in backend/tests/test_video.py**

```python
import os

import pytest

from app.services.video import download_video, VideoInfo


@pytest.mark.asyncio
async def test_download_video_youtube():
    """Integration test — requires network and yt-dlp."""
    url = "https://www.youtube.com/watch?v=jNQXAC9IVRw"  # "Me at the zoo" — short, always available
    audio_path = await download_video(url)

    assert os.path.exists(audio_path)
    assert audio_path.endswith(".wav")

    # Cleanup
    os.remove(audio_path)


@pytest.mark.asyncio
async def test_download_video_invalid_url():
    url = "https://example.com/not-a-video"
    with pytest.raises(ValueError, match="Cannot extract video"):
        await download_video(url)
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd backend
pytest tests/test_video.py -v
```

Expected: ImportError (module doesn't exist)

- [ ] **Step 3: Create backend/app/services/__init__.py**

```python
```

- [ ] **Step 4: Create backend/app/services/video.py**

```python
import os
import subprocess
import tempfile
from dataclasses import dataclass

import yt_dlp

from app.config import settings


@dataclass
class VideoInfo:
    title: str
    duration_seconds: float


async def download_video(url: str) -> str:
    """Download video audio and convert to WAV 16kHz mono.

    Returns path to the output WAV file.
    """
    os.makedirs(settings.upload_dir, exist_ok=True)

    output_template = os.path.join(settings.upload_dir, "%(id)s.%(ext)s")

    ydl_opts = {
        "format": "bestaudio/best",
        "outtmpl": output_template,
        "postprocessors": [
            {
                "key": "FFmpegExtractAudio",
                "preferredcodec": "wav",
            }
        ],
        "quiet": True,
        "no_warnings": True,
    }

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=True)
            video_id = info["id"]
            title = info.get("title", "")
            duration = info.get("duration", 0.0)
    except Exception as e:
        raise ValueError(f"Cannot extract video: {e}")

    wav_path = os.path.join(settings.upload_dir, f"{video_id}.wav")

    # Convert to 16kHz mono if needed
    wav_path = _convert_to_mono_16k(wav_path)

    return wav_path


def _convert_to_mono_16k(input_path: str) -> str:
    """Convert audio to 16kHz mono WAV using ffmpeg."""
    output_path = input_path.replace(".wav", "_16k.wav")

    cmd = [
        "ffmpeg", "-y",
        "-i", input_path,
        "-ac", "1",
        "-ar", "16000",
        "-sample_fmt", "s16",
        output_path,
    ]
    subprocess.run(cmd, capture_output=True, check=True)

    # Replace original with converted
    os.replace(output_path, input_path)
    return input_path
```

- [ ] **Step 5: Run test to verify it passes (requires network)**

```bash
pytest tests/test_video.py::test_download_video_youtube -v
```

Expected: PASS (downloads audio successfully)

- [ ] **Step 6: Run invalid URL test**

```bash
pytest tests/test_video.py::test_download_video_invalid_url -v
```

Expected: PASS (raises ValueError)

- [ ] **Step 7: Commit**

```bash
git add backend/app/services/ backend/tests/
git commit -m "feat: add video download and audio extraction service"
```

---

### Task 2.2: Whisper transcription service

**Files:**
- Create: `backend/app/services/transcription.py`
- Create: `backend/tests/test_transcription.py`

**Interfaces:**
- Consumes: audio WAV file path
- Produces: `transcribe_audio(audio_path: str) -> list[TranscriptSegment]` where TranscriptSegment has `sentence_index`, `text`, `start_ms`, `end_ms`, `words: list[WordTimestamp]`

- [ ] **Step 1: Write failing test in backend/tests/test_transcription.py**

```python
import pytest

from app.services.transcription import transcribe_audio, TranscriptSegment


@pytest.mark.asyncio
async def test_transcribe_audio(tmp_path):
    # Create a minimal valid WAV file (silence) for whisper to process
    import subprocess
    test_wav = tmp_path / "test.wav"
    subprocess.run([
        "ffmpeg", "-y", "-f", "lavfi",
        "-i", "anullsrc=r=16000:cl=mono",
        "-t", "1",
        "-ac", "1", "-ar", "16000",
        str(test_wav)
    ], capture_output=True, check=True)

    result = await transcribe_audio(str(test_wav))
    assert isinstance(result, list)


@pytest.mark.asyncio
async def test_transcribe_audio_not_found():
    with pytest.raises(FileNotFoundError):
        await transcribe_audio("/nonexistent/path.wav")
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pytest tests/test_transcription.py -v
```

Expected: ImportError

- [ ] **Step 3: Create backend/app/services/transcription.py**

```python
import os
from dataclasses import dataclass

import whisper


@dataclass
class WordTimestamp:
    word: str
    start_ms: int
    end_ms: int


@dataclass
class TranscriptSegment:
    sentence_index: int
    text: str
    start_ms: int
    end_ms: int
    words: list[WordTimestamp]


# Load model once at module level
_model: whisper.Whisper | None = None


def _get_model() -> whisper.Whisper:
    global _model
    if _model is None:
        _model = whisper.load_model("small")
    return _model


async def transcribe_audio(audio_path: str) -> list[TranscriptSegment]:
    """Transcribe audio file to text with word-level timestamps.

    Uses Whisper small model. Returns sentence-level segments.
    """
    if not os.path.exists(audio_path):
        raise FileNotFoundError(f"Audio file not found: {audio_path}")

    model = _get_model()
    result = model.transcribe(audio_path, word_timestamps=True)

    # Whisper returns segments; we use those as sentences
    segments = []
    for i, seg in enumerate(result["segments"]):
        words = []
        if "words" in seg:
            for w in seg["words"]:
                words.append(WordTimestamp(
                    word=w["word"].strip(),
                    start_ms=int(w["start"] * 1000),
                    end_ms=int(w["end"] * 1000),
                ))

        segments.append(TranscriptSegment(
            sentence_index=i,
            text=seg["text"].strip(),
            start_ms=int(seg["start"] * 1000),
            end_ms=int(seg["end"] * 1000),
            words=words,
        ))

    return segments
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pytest tests/test_transcription.py -v
```

Expected: PASS (whisper transcribes silence = empty or minimal result)

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/transcription.py backend/tests/test_transcription.py
git commit -m "feat: add Whisper transcription service"
```

---

### Task 2.3: Celery async video processing task + API endpoint

**Files:**
- Create: `backend/app/tasks/__init__.py`
- Create: `backend/app/tasks/celery_app.py`
- Create: `backend/app/tasks/process_video.py`
- Create: `backend/app/schemas/__init__.py`
- Create: `backend/app/schemas/material.py`
- Create: `backend/app/api/process.py`

**Interfaces:**
- Consumes: `download_video()`, `transcribe_audio()`, Material model
- Produces: `POST /process/video` (accepts `{source_url}`, returns `{task_id}`), `GET /process/status/{task_id}` (returns `{status, progress, material_id}`), Celery task `process_video_task`

- [ ] **Step 1: Create backend/app/tasks/celery_app.py**

```python
from celery import Celery

from app.config import settings

celery_app = Celery(
    "shadowing",
    broker=settings.redis_url,
    backend=settings.redis_url,
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
)
```

- [ ] **Step 2: Create backend/app/schemas/material.py**

```python
from pydantic import BaseModel


class MaterialCreateRequest(BaseModel):
    source_url: str


class MaterialResponse(BaseModel):
    id: str
    source_type: str
    source_url: str
    title: str
    duration_seconds: float
    status: str
    created_at: str

    model_config = {"from_attributes": True}


class MaterialDetailResponse(MaterialResponse):
    transcript: list[dict] | None = None


class ProcessStatusResponse(BaseModel):
    task_id: str
    status: str  # "queued" | "processing" | "ready" | "error"
    material_id: str | None = None
    error: str | None = None
```

- [ ] **Step 3: Create backend/app/tasks/process_video.py**

```python
from app.tasks.celery_app import celery_app
from app.services.video import download_video
from app.services.transcription import transcribe_audio
from app.models.material import Material
from app.db.database import async_session
from dataclasses import asdict
import uuid


@celery_app.task(bind=True)
def process_video_task(self, source_url: str):
    """Download video, extract audio, transcribe, save to DB."""
    material_id = str(uuid.uuid4())

    self.update_state(state="processing", meta={"material_id": material_id})

    try:
        # Step 1: Download + extract audio
        audio_path = download_video(source_url)

        # Step 2: Transcribe
        segments = transcribe_audio(audio_path)

        # Step 3: Save to DB
        import asyncio
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)

        async def save():
            async with async_session() as db:
                material = Material(
                    id=material_id,
                    source_type="youtube" if "youtube.com" in source_url or "youtu.be" in source_url else "bilibili",
                    source_url=source_url,
                    title="",  # Will be filled from video info
                    duration_seconds=sum(s.end_ms - s.start_ms for s in segments) / 1000.0,
                    transcript_json={
                        "segments": [
                            {
                                "sentence_index": s.sentence_index,
                                "text": s.text,
                                "start_ms": s.start_ms,
                                "end_ms": s.end_ms,
                                "words": [
                                    {"word": w.word, "start_ms": w.start_ms, "end_ms": w.end_ms}
                                    for w in s.words
                                ]
                            }
                            for s in segments
                        ]
                    },
                    status="ready",
                )
                db.add(material)
                await db.commit()

                return material_id

        loop.run_until_complete(save())

        return {"material_id": material_id, "status": "ready"}

    except Exception as e:
        self.update_state(state="error", meta={"error": str(e)})
        return {"material_id": material_id, "status": "error", "error": str(e)}
```

- [ ] **Step 4: Create backend/app/api/process.py**

```python
from fastapi import APIRouter
from celery.result import AsyncResult

from app.schemas.material import MaterialCreateRequest, ProcessStatusResponse
from app.tasks.process_video import process_video_task
from app.tasks.celery_app import celery_app

router = APIRouter(prefix="/process", tags=["process"])


@router.post("/video")
async def create_video_process(request: MaterialCreateRequest):
    task = process_video_task.delay(request.source_url)
    return {"task_id": task.id, "status": "queued"}


@router.get("/status/{task_id}")
async def get_process_status(task_id: str):
    result = AsyncResult(task_id, app=celery_app)

    response = ProcessStatusResponse(
        task_id=task_id,
        status="queued",
    )

    if result.state == "PENDING":
        response.status = "queued"
    elif result.state == "PROGRESS":
        response.status = "processing"
    elif result.state == "SUCCESS":
        data = result.result
        response.status = data.get("status", "ready")
        response.material_id = data.get("material_id")
    elif result.state == "FAILURE":
        response.status = "error"
        response.error = str(result.info)

    return response
```

- [ ] **Step 5: Register routes in main.py — modify backend/app/main.py**

```python
from fastapi import FastAPI

from app.api.health import router as health_router
from app.api.process import router as process_router

app = FastAPI(title="Shadowing English Teacher API", version="0.1.0")

app.include_router(health_router)
app.include_router(process_router)


@app.get("/")
async def root():
    return {"service": "shadowing-backend", "version": "0.1.0"}
```

- [ ] **Step 6: Verify process endpoint with manual test**

```bash
cd backend
docker compose up -d postgres redis backend celery-worker
sleep 5

# Submit a YouTube URL
curl -X POST http://localhost:8000/process/video \
  -H "Content-Type: application/json" \
  -d '{"source_url": "https://www.youtube.com/watch?v=jNQXAC9IVRw"}'
# Expected: {"task_id": "...", "status": "queued"}

# Check status (use task_id from above)
curl http://localhost:8000/process/status/<task_id>
# Expected: eventually {"task_id": "...", "status": "ready", "material_id": "..."}
```

- [ ] **Step 7: Commit**

```bash
git add backend/app/tasks/ backend/app/schemas/ backend/app/api/process.py backend/app/main.py
git commit -m "feat: add async video processing with Celery + API endpoint"
```

---

## Phase 3: Pronunciation Evaluation

### Task 3.1: Azure Speech pronunciation assessment service

**Files:**
- Create: `backend/app/services/evaluation.py`
- Create: `backend/app/schemas/evaluation.py`
- Create: `backend/tests/test_evaluation.py`

**Interfaces:**
- Consumes: `settings.azure_speech_key`, `settings.azure_speech_region`
- Produces: `evaluate_pronunciation(reference_audio_path: str, user_audio_path: str, reference_text: str) -> EvaluationResult` with word-level scores

- [ ] **Step 1: Create backend/app/schemas/evaluation.py**

```python
from pydantic import BaseModel


class WordScoreItem(BaseModel):
    word: str
    score: float  # 0-100
    issue: str | None = None


class EvaluationResult(BaseModel):
    overall_score: float
    pronunciation_score: float
    rhythm_score: float
    intonation_score: float
    word_scores: list[WordScoreItem]
    suggestions: list[str]
```

- [ ] **Step 2: Write failing test in backend/tests/test_evaluation.py**

```python
import os
import subprocess

import pytest

from app.services.evaluation import evaluate_pronunciation
from app.config import settings


@pytest.mark.asyncio
async def test_evaluate_pronunciation_no_key():
    if settings.azure_speech_key:
        pytest.skip("Azure key configured — use real test")

    with pytest.raises(ValueError, match="Azure Speech key not configured"):
        await evaluate_pronunciation("/fake/ref.wav", "/fake/user.wav", "hello")
```

- [ ] **Step 3: Run test to verify it fails**

```bash
cd backend
pytest tests/test_evaluation.py -v
```

Expected: ImportError (module not found)

- [ ] **Step 4: Create backend/app/services/evaluation.py**

```python
import os

import azure.cognitiveservices.speech as speechsdk

from app.config import settings
from app.schemas.evaluation import EvaluationResult, WordScoreItem
from app.services.suggestion import generate_suggestions


async def evaluate_pronunciation(
    reference_audio_path: str,
    user_audio_path: str,
    reference_text: str,
) -> EvaluationResult:
    """Compare user pronunciation to reference using Azure Speech API.

    Requires AZURE_SPEECH_KEY and AZURE_SPEECH_REGION env vars.
    """
    if not settings.azure_speech_key:
        raise ValueError("Azure Speech key not configured")

    speech_config = speechsdk.SpeechConfig(
        subscription=settings.azure_speech_key,
        region=settings.azure_speech_region,
    )

    # Build pronunciation assessment config
    pronunciation_config = speechsdk.PronunciationAssessmentConfig(
        reference_text=reference_text,
        grading_system=speechsdk.PronunciationAssessmentGradingSystem.HundredMark,
        granularity=speechsdk.PronunciationAssessmentGranularity.Word,
    )
    pronunciation_config.enable_prosody_assessment()

    # Recognize user audio
    audio_config = speechsdk.AudioConfig(filename=user_audio_path)
    recognizer = speechsdk.SpeechRecognizer(
        speech_config=speech_config,
        audio_config=audio_config,
    )
    pronunciation_config.apply_to(recognizer)

    result = recognizer.recognize_once()

    if result.reason == speechsdk.ResultReason.RecognizedSpeech:
        return _parse_pronunciation_result(result)
    elif result.reason == speechsdk.ResultReason.NoMatch:
        raise ValueError("No speech could be recognized in the audio")
    else:
        raise ValueError(f"Speech recognition failed: {result.reason}")


def _parse_pronunciation_result(result) -> EvaluationResult:
    """Extract scores from Azure pronunciation assessment result."""
    json_result = result.properties.get(
        speechsdk.PropertyId.SpeechServiceResponse_JsonResult
    )

    import json
    data = json.loads(json_result)

    # Overall scores
    pron_info = data.get("NBest", [{}])[0]
    pron_score = pron_info.get("PronunciationAssessment", {}).get("PronScore", 0.0)

    # Word-level scores
    words = pron_info.get("Words", [])
    word_scores = []
    for w in words:
        wscore = w.get("PronunciationAssessment", {}).get("AccuracyScore", 0.0)
        word_text = w.get("Word", "")
        issue = None
        if wscore < 70:
            error_type = w.get("PronunciationAssessment", {}).get("ErrorType", "")
            if error_type:
                issue = _describe_issue(word_text, error_type)
        word_scores.append(WordScoreItem(word=word_text, score=wscore, issue=issue))

    # Prosody scores
    prosody = data.get("NBest", [{}])[0].get("PronunciationAssessment", {}).get("ProsodyScore", 0.0)

    # Generate suggestions from word scores
    suggestions = generate_suggestions(word_scores)

    return EvaluationResult(
        overall_score=pron_score,
        pronunciation_score=pron_score,
        rhythm_score=prosody,  # Azure doesn't split rhythm/intonation in basic mode
        intonation_score=prosody,
        word_scores=word_scores,
        suggestions=suggestions,
    )


def _describe_issue(word: str, error_type: str) -> str:
    """Map Azure error types to Chinese descriptions."""
    descriptions = {
        "Mispronunciation": f"「{word}」发音不准",
        "Omission": f"「{word}」遗漏了部分音节",
        "Insertion": f"「{word}」多加了一些音",
        "UnexpectedBreak": f"「{word}」中断不当",
        "MissingBreak": f"「{word}」缺少停顿",
        "Monotone": f"「{word}」语调太平",
    }
    return descriptions.get(error_type, f"「{word}」发音需改进")
```

- [ ] **Step 5: Run test to verify it passes**

```bash
pytest tests/test_evaluation.py -v
```

Expected: PASS (skipped if key configured, otherwise passes ValueError test)

- [ ] **Step 6: Commit**

```bash
git add backend/app/services/evaluation.py backend/app/schemas/evaluation.py backend/tests/test_evaluation.py
git commit -m "feat: add Azure Speech pronunciation evaluation service"
```

---

### Task 3.2: Suggestion template engine

**Files:**
- Create: `backend/app/services/suggestion.py`

**Interfaces:**
- Consumes: `list[WordScoreItem]`
- Produces: `generate_suggestions(word_scores: list[WordScoreItem]) -> list[str]` returning Chinese-language practice tips

- [ ] **Step 1: Create backend/app/services/suggestion.py**

```python
from app.schemas.evaluation import WordScoreItem

# Common English pronunciation issues for Chinese speakers
ISSUE_TEMPLATES = {
    "th": "注意咬舌音 /θ/ 或 /ð/：舌尖轻触上齿，气流从舌齿间通过",
    "r": "注意卷舌音 /r/：舌尖卷起靠近上颚但不要碰到",
    "l": "注意 /l/ 音：舌尖抵住上齿龈，声带振动",
    "v": "注意 /v/ 音：上齿轻咬下唇，声带振动（不要发成 /w/）",
    "w": "注意 /w/ 音：双唇收圆但不咬唇（不要发成 /v/）",
    "n": "注意区分 /n/ 和 /l/：/n/ 是鼻音，气流从鼻腔通过",
    "long_vowel": "注意长元音要拉长：/iː/ /uː/ /ɑː/ 等要读够时长",
    "short_vowel": "注意短元音要短促有力：/ɪ/ /ʊ/ /ʌ/ 不要拖长",
    "final_consonant": "注意词尾辅音不要漏掉，每个音节都要完整发出",
    "stress": "注意单词重音位置，重读音节要更用力、更长、更清楚",
    "link": "注意连读，前一个词的尾辅音和后一个词的首元音要连在一起",
}


def generate_suggestions(word_scores: list[WordScoreItem]) -> list[str]:
    """Generate Chinese-language pronunciation tips based on low-scoring words."""
    low_words = [w for w in word_scores if w.score < 70]
    suggestions = []
    seen_templates = set()

    for w in low_words:
        word_lower = w.word.lower()
        template_key = _match_template(word_lower)
        if template_key and template_key not in seen_templates:
            seen_templates.add(template_key)
            suggestions.append(ISSUE_TEMPLATES[template_key])

    if not suggestions and low_words:
        suggestions.append("尝试放慢速度，将每个音节读清楚")

    # Add general advice for overall low score
    if len(low_words) >= 3:
        suggestions.insert(0, f"有 {len(low_words)} 个单词分数偏低，建议重点重练这些词：{'、'.join(w.word for w in low_words[:5])}")

    return suggestions


def _match_template(word: str) -> str | None:
    """Match a word to a pronunciation issue template."""
    if "th" in word:
        return "th"
    if word.startswith("r"):
        return "r"
    if "l" in word and not word.startswith("l") and word.endswith("l"):
        return "l"
    if "v" in word:
        return "v"
    if word.startswith("w"):
        return "w"

    # Count vowels for length hints
    import re
    vowels = re.findall(r"[aeiou]+", word)
    for v in vowels:
        if len(v) >= 2:
            return "long_vowel"

    if word.endswith(("t", "d", "k", "g", "p", "b", "s", "z")):
        return "final_consonant"

    return None
```

- [ ] **Step 2: Commit**

```bash
git add backend/app/services/suggestion.py
git commit -m "feat: add pronunciation suggestion template engine"
```

---

### Task 3.3: Evaluation API endpoint

**Files:**
- Create: `backend/app/api/evaluate.py`
- Modify: `backend/app/main.py` (register router)

**Interfaces:**
- Consumes: `evaluate_pronunciation()`
- Produces: `POST /evaluate/pronunciation` (accepts `{reference_audio_path, user_audio_path, reference_text}`, returns `EvaluationResult`)

- [ ] **Step 1: Create backend/app/api/evaluate.py**

```python
import os
import tempfile
import uuid

from fastapi import APIRouter, UploadFile, File, Form

from app.config import settings
from app.services.evaluation import evaluate_pronunciation
from app.schemas.evaluation import EvaluationResult

router = APIRouter(prefix="/evaluate", tags=["evaluate"])


@router.post("/pronunciation")
async def evaluate_pronunciation_endpoint(
    audio: UploadFile = File(...),
    reference_text: str = Form(...),
    reference_audio_url: str = Form(""),
) -> EvaluationResult:
    """Evaluate user pronunciation against reference text."""
    os.makedirs(settings.upload_dir, exist_ok=True)

    # Save user audio
    user_audio_id = str(uuid.uuid4())
    user_audio_path = os.path.join(settings.upload_dir, f"user_{user_audio_id}.wav")

    content = await audio.read()
    with open(user_audio_path, "wb") as f:
        f.write(content)

    # If reference audio is provided, use it; otherwise use user audio path for both
    # (Azure assessment only needs user audio + reference text)
    ref_audio_path = reference_audio_url or user_audio_path

    result = await evaluate_pronunciation(
        reference_audio_path=ref_audio_path,
        user_audio_path=user_audio_path,
        reference_text=reference_text,
    )

    return result
```

- [ ] **Step 2: Register evaluate router in backend/app/main.py**

```python
from fastapi import FastAPI

from app.api.health import router as health_router
from app.api.process import router as process_router
from app.api.evaluate import router as evaluate_router

app = FastAPI(title="Shadowing English Teacher API", version="0.1.0")

app.include_router(health_router)
app.include_router(process_router)
app.include_router(evaluate_router)


@app.get("/")
async def root():
    return {"service": "shadowing-backend", "version": "0.1.0"}
```

- [ ] **Step 3: Commit**

```bash
git add backend/app/api/evaluate.py backend/app/main.py
git commit -m "feat: add pronunciation evaluation API endpoint"
```

---

## Phase 4: Next.js BFF Layer

### Task 4.1: API client and storage utilities

**Files:**
- Create: `frontend/src/lib/api-client.ts`
- Create: `frontend/src/lib/storage.ts`

**Interfaces:**
- Produces: `apiClient` object with typed methods, `guestStorage` with get/set for guest records

- [ ] **Step 1: Create frontend/src/lib/api-client.ts**

```ts
import type {
  Material,
  MaterialDetailResponse,
  CreateMaterialPayload,
  CreateSessionPayload,
  PracticeSession,
  SubmitAttemptResponse,
  PracticeReport,
} from "@/types";

const BFF_BASE = "/api";

class ApiClient {
  // ===== Materials =====
  async createMaterial(payload: CreateMaterialPayload): Promise<{ task_id: string; status: string }> {
    const res = await fetch(`${BFF_BASE}/materials`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`Failed to create material: ${res.statusText}`);
    return res.json();
  }

  async listMaterials(): Promise<Material[]> {
    const res = await fetch(`${BFF_BASE}/materials`);
    if (!res.ok) throw new Error(`Failed to list materials: ${res.statusText}`);
    return res.json();
  }

  async getMaterial(id: string): Promise<MaterialDetailResponse> {
    const res = await fetch(`${BFF_BASE}/materials/${id}`);
    if (!res.ok) throw new Error(`Failed to get material: ${res.statusText}`);
    return res.json();
  }

  // ===== Sessions =====
  async createSession(payload: CreateSessionPayload): Promise<PracticeSession> {
    const res = await fetch(`${BFF_BASE}/sessions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`Failed to create session: ${res.statusText}`);
    return res.json();
  }

  async getSession(id: string): Promise<PracticeSession> {
    const res = await fetch(`${BFF_BASE}/sessions/${id}`);
    if (!res.ok) throw new Error(`Failed to get session: ${res.statusText}`);
    return res.json();
  }

  async submitAttempt(
    sessionId: string,
    audio: Blob,
    sentenceIndex: number
  ): Promise<SubmitAttemptResponse> {
    const formData = new FormData();
    formData.append("audio", audio, "recording.wav");
    formData.append("sentence_index", String(sentenceIndex));

    const res = await fetch(`${BFF_BASE}/sessions/${sessionId}/attempts`, {
      method: "POST",
      body: formData,
    });
    if (!res.ok) throw new Error(`Failed to submit attempt: ${res.statusText}`);
    return res.json();
  }

  async completeSession(id: string): Promise<PracticeSession> {
    const res = await fetch(`${BFF_BASE}/sessions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "completed" }),
    });
    if (!res.ok) throw new Error(`Failed to complete session: ${res.statusText}`);
    return res.json();
  }

  async getReport(sessionId: string): Promise<PracticeReport> {
    const res = await fetch(`${BFF_BASE}/sessions/${sessionId}/report`);
    if (!res.ok) throw new Error(`Failed to get report: ${res.statusText}`);
    return res.json();
  }
}

export const apiClient = new ApiClient();
```

- [ ] **Step 2: Create frontend/src/lib/storage.ts**

```ts
import type { GuestRecord } from "@/types";

const STORAGE_KEY = "shadowing_guest";

export const guestStorage = {
  getAll(): GuestRecord {
    if (typeof window === "undefined") return { material_ids: [], session_ids: [] };
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { material_ids: [], session_ids: [] };
    try {
      return JSON.parse(raw);
    } catch {
      return { material_ids: [], session_ids: [] };
    }
  },

  addMaterial(id: string) {
    const data = this.getAll();
    if (!data.material_ids.includes(id)) {
      data.material_ids.push(id);
    }
    this._save(data);
  },

  addSession(id: string) {
    const data = this.getAll();
    if (!data.session_ids.includes(id)) {
      data.session_ids.push(id);
    }
    this._save(data);
  },

  _save(data: GuestRecord) {
    if (typeof window === "undefined") return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  },
};
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/lib/
git commit -m "feat: add API client and guest storage utilities"
```

---

### Task 4.2: Materials API routes (BFF)

**Files:**
- Create: `frontend/src/app/api/materials/route.ts`
- Create: `frontend/src/app/api/materials/[id]/route.ts`

**Interfaces:**
- Consumes: Python `POST /process/video`, `GET /process/status/{task_id}`, database queries
- Produces: `POST /api/materials`, `GET /api/materials`, `GET /api/materials/[id]`

- [ ] **Step 1: Create frontend/src/app/api/materials/route.ts**

```ts
import { NextRequest, NextResponse } from "next/server";

const PYTHON_SERVICE = process.env.PYTHON_SERVICE_URL || "http://backend:8000";

// POST /api/materials — submit video URL for processing
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { source_url } = body;

  if (!source_url) {
    return NextResponse.json({ error: "source_url is required" }, { status: 400 });
  }

  // Forward to Python backend
  const res = await fetch(`${PYTHON_SERVICE}/process/video`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ source_url }),
  });

  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}

// GET /api/materials — list recent materials
export async function GET() {
  const res = await fetch(`${PYTHON_SERVICE}/materials`);
  if (!res.ok) {
    return NextResponse.json([], { status: 200 }); // Return empty if endpoint doesn't exist yet
  }
  const data = await res.json();
  return NextResponse.json(data);
}
```

- [ ] **Step 2: Create frontend/src/app/api/materials/[id]/route.ts**

```ts
import { NextRequest, NextResponse } from "next/server";

const PYTHON_SERVICE = process.env.PYTHON_SERVICE_URL || "http://backend:8000";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const res = await fetch(`${PYTHON_SERVICE}/materials/${params.id}`);
  if (!res.ok) {
    return NextResponse.json({ error: "Material not found" }, { status: 404 });
  }
  const data = await res.json();
  return NextResponse.json(data);
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/app/api/materials/
git commit -m "feat: add materials BFF API routes"
```

---

### Task 4.3: Sessions API routes (BFF)

**Files:**
- Create: `frontend/src/app/api/sessions/route.ts`
- Create: `frontend/src/app/api/sessions/[id]/route.ts`
- Create: `frontend/src/app/api/sessions/[id]/attempts/route.ts`
- Create: `frontend/src/app/api/sessions/[id]/report/route.ts`

**Interfaces:**
- Consumes: Python evaluation API, database queries
- Produces: Full sessions CRUD + attempts submit + report retrieval

- [ ] **Step 1: Create frontend/src/app/api/sessions/route.ts (POST only)**

```ts
import { NextRequest, NextResponse } from "next/server";

const PYTHON_SERVICE = process.env.PYTHON_SERVICE_URL || "http://backend:8000";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { material_id, mode } = body;

  if (!material_id) {
    return NextResponse.json({ error: "material_id is required" }, { status: 400 });
  }

  const res = await fetch(`${PYTHON_SERVICE}/sessions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ material_id, mode: mode || "sentence_by_sentence" }),
  });

  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
```

- [ ] **Step 2: Create frontend/src/app/api/sessions/[id]/route.ts (GET + PATCH)**

```ts
import { NextRequest, NextResponse } from "next/server";

const PYTHON_SERVICE = process.env.PYTHON_SERVICE_URL || "http://backend:8000";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const res = await fetch(`${PYTHON_SERVICE}/sessions/${params.id}`);
  if (!res.ok) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }
  const data = await res.json();
  return NextResponse.json(data);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const body = await request.json();
  const res = await fetch(`${PYTHON_SERVICE}/sessions/${params.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
```

- [ ] **Step 3: Create frontend/src/app/api/sessions/[id]/attempts/route.ts (POST)**

```ts
import { NextRequest, NextResponse } from "next/server";

const PYTHON_SERVICE = process.env.PYTHON_SERVICE_URL || "http://backend:8000";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const formData = await request.formData();
  const audio = formData.get("audio") as Blob;
  const sentenceIndex = formData.get("sentence_index") as string;

  if (!audio || !sentenceIndex) {
    return NextResponse.json(
      { error: "audio and sentence_index are required" },
      { status: 400 }
    );
  }

  // Forward to Python evaluation service
  const pythonFormData = new FormData();
  pythonFormData.append("audio", audio, "recording.wav");
  pythonFormData.append("sentence_index", sentenceIndex);
  pythonFormData.append("session_id", params.id);

  // First, evaluate pronunciation
  const evaluateRes = await fetch(`${PYTHON_SERVICE}/evaluate/pronunciation`, {
    method: "POST",
    body: pythonFormData,
  });

  if (!evaluateRes.ok) {
    const err = await evaluateRes.text();
    return NextResponse.json({ error: err }, { status: evaluateRes.status });
  }

  const evalData = await evaluateRes.json();

  // Then save attempt
  const saveRes = await fetch(`${PYTHON_SERVICE}/attempts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      session_id: params.id,
      sentence_index: parseInt(sentenceIndex),
      score: evalData.overall_score,
      word_scores: evalData.word_scores,
      suggestions: evalData.suggestions,
    }),
  });

  const attemptData = await saveRes.json();
  return NextResponse.json(attemptData);
}
```

- [ ] **Step 4: Create frontend/src/app/api/sessions/[id]/report/route.ts (GET)**

```ts
import { NextRequest, NextResponse } from "next/server";

const PYTHON_SERVICE = process.env.PYTHON_SERVICE_URL || "http://backend:8000";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const res = await fetch(`${PYTHON_SERVICE}/sessions/${params.id}/report`);
  if (!res.ok) {
    return NextResponse.json({ error: "Report not found" }, { status: 404 });
  }
  const data = await res.json();
  return NextResponse.json(data);
}
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app/api/sessions/
git commit -m "feat: add sessions BFF API routes"
```

---

### Task 4.4: WebSocket endpoint for processing status

**Files:**
- Create: `frontend/src/app/api/ws/session/[id]/route.ts`

**Interfaces:**
- Produces: WebSocket endpoint that proxies to Python backend processing status updates

- [ ] **Step 1: Create frontend/src/app/api/ws/session/[id]/route.ts**

```ts
// For MVP, we use polling instead of WebSocket to keep things simple.
// This route serves as a placeholder for v2 WebSocket upgrade.

import { NextRequest, NextResponse } from "next/server";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  return NextResponse.json({
    message: "WebSocket endpoint — use polling GET /api/materials/[id] for MVP",
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/app/api/ws/
git commit -m "feat: add placeholder WebSocket endpoint"
```

---

## Phase 5: Python Backend CRUD Endpoints

### Task 5.1: Materials and Sessions CRUD endpoints

**Files:**
- Create: `backend/app/api/materials.py`
- Create: `backend/app/api/sessions.py`
- Create: `backend/app/api/attempts.py`
- Modify: `backend/app/main.py` (register routers)

**Interfaces:**
- Produces: `GET /materials`, `GET /materials/{id}`, `POST /sessions`, `GET /sessions/{id}`, `PATCH /sessions/{id}`, `POST /attempts`, `GET /sessions/{id}/report`

- [ ] **Step 1: Create backend/app/schemas/session.py**

```python
from pydantic import BaseModel


class SessionCreateRequest(BaseModel):
    material_id: str
    mode: str = "sentence_by_sentence"


class SessionResponse(BaseModel):
    id: str
    material_id: str
    mode: str
    status: str
    overall_score: float | None = None
    pronunciation_score: float | None = None
    rhythm_score: float | None = None
    intonation_score: float | None = None
    completed_at: str | None = None
    created_at: str

    model_config = {"from_attributes": True}


class SessionUpdateRequest(BaseModel):
    status: str | None = None
```

- [ ] **Step 2: Create backend/app/schemas/attempt.py**

```python
from pydantic import BaseModel


class AttemptCreateRequest(BaseModel):
    session_id: str
    sentence_index: int
    score: float
    word_scores: list[dict] = []
    suggestions: list[str] = []


class AttemptResponse(BaseModel):
    id: str
    session_id: str
    sentence_index: int
    score: float
    word_scores: list[dict] | None = None
    suggestions: list[str] | None = None
    created_at: str

    model_config = {"from_attributes": True}
```

- [ ] **Step 3: Create backend/app/api/materials.py**

```python
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_db
from app.models.material import Material
from app.schemas.material import MaterialResponse, MaterialDetailResponse

router = APIRouter(prefix="/materials", tags=["materials"])


@router.get("")
async def list_materials(db: AsyncSession = Depends(get_db)) -> list[MaterialResponse]:
    result = await db.execute(
        select(Material).order_by(Material.created_at.desc()).limit(20)
    )
    materials = result.scalars().all()
    return [MaterialResponse.model_validate(m) for m in materials]


@router.get("/{material_id}")
async def get_material(
    material_id: str,
    db: AsyncSession = Depends(get_db),
) -> MaterialDetailResponse:
    result = await db.execute(select(Material).where(Material.id == material_id))
    material = result.scalar_one_or_none()
    if material is None:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Material not found")

    resp = MaterialDetailResponse.model_validate(material)
    resp.transcript = material.transcript_json.get("segments", []) if material.transcript_json else None
    return resp
```

- [ ] **Step 4: Create backend/app/api/sessions.py**

```python
import uuid
from datetime import datetime

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_db
from app.models.session import PracticeSession
from app.schemas.session import SessionCreateRequest, SessionResponse, SessionUpdateRequest

router = APIRouter(prefix="/sessions", tags=["sessions"])


@router.post("")
async def create_session(
    request: SessionCreateRequest,
    db: AsyncSession = Depends(get_db),
) -> SessionResponse:
    session = PracticeSession(
        id=str(uuid.uuid4()),
        material_id=request.material_id,
        mode=request.mode,
        status="in_progress",
    )
    db.add(session)
    await db.commit()
    await db.refresh(session)
    return SessionResponse.model_validate(session)


@router.get("/{session_id}")
async def get_session(
    session_id: str,
    db: AsyncSession = Depends(get_db),
) -> SessionResponse:
    result = await db.execute(
        select(PracticeSession).where(PracticeSession.id == session_id)
    )
    session = result.scalar_one_or_none()
    if session is None:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Session not found")
    return SessionResponse.model_validate(session)


@router.patch("/{session_id}")
async def update_session(
    session_id: str,
    request: SessionUpdateRequest,
    db: AsyncSession = Depends(get_db),
) -> SessionResponse:
    result = await db.execute(
        select(PracticeSession).where(PracticeSession.id == session_id)
    )
    session = result.scalar_one_or_none()
    if session is None:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Session not found")

    if request.status == "completed":
        session.status = "completed"
        session.completed_at = datetime.utcnow()

        # Calculate overall scores from attempts
        from app.models.attempt import SentenceAttempt
        attempt_result = await db.execute(
            select(SentenceAttempt).where(SentenceAttempt.session_id == session_id)
        )
        attempts = attempt_result.scalars().all()
        if attempts:
            scores = [a.score for a in attempts]
            session.overall_score = sum(scores) / len(scores)
            session.pronunciation_score = session.overall_score
            session.rhythm_score = session.overall_score
            session.intonation_score = session.overall_score

    await db.commit()
    await db.refresh(session)
    return SessionResponse.model_validate(session)
```

- [ ] **Step 5: Create backend/app/api/attempts.py**

```python
import uuid

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_db
from app.models.attempt import SentenceAttempt
from app.models.session import PracticeSession
from app.schemas.attempt import AttemptCreateRequest, AttemptResponse

router = APIRouter(prefix="/attempts", tags=["attempts"])


@router.post("")
async def create_attempt(
    request: AttemptCreateRequest,
    db: AsyncSession = Depends(get_db),
) -> AttemptResponse:
    attempt = SentenceAttempt(
        id=str(uuid.uuid4()),
        session_id=request.session_id,
        sentence_index=request.sentence_index,
        score=request.score,
        word_scores_json={"words": request.word_scores},
        suggestions_json=request.suggestions,
    )
    db.add(attempt)
    await db.commit()
    await db.refresh(attempt)

    resp = AttemptResponse.model_validate(attempt)
    resp.word_scores = request.word_scores
    resp.suggestions = request.suggestions
    return resp
```

- [ ] **Step 6: Add report endpoint to sessions.py**

Add to `backend/app/api/sessions.py`:

```python
@router.get("/{session_id}/report")
async def get_session_report(
    session_id: str,
    db: AsyncSession = Depends(get_db),
):
    # Get session
    result = await db.execute(
        select(PracticeSession).where(PracticeSession.id == session_id)
    )
    session = result.scalar_one_or_none()
    if session is None:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Session not found")

    # Get attempts
    from app.models.attempt import SentenceAttempt
    from app.models.material import Material

    attempt_result = await db.execute(
        select(SentenceAttempt)
        .where(SentenceAttempt.session_id == session_id)
        .order_by(SentenceAttempt.sentence_index)
    )
    attempts = attempt_result.scalars().all()

    # Get material title
    mat_result = await db.execute(
        select(Material).where(Material.id == session.material_id)
    )
    material = mat_result.scalar_one_or_none()

    return {
        "session": SessionResponse.model_validate(session).model_dump(),
        "attempts": [
            AttemptResponse.model_validate(a).model_dump() for a in attempts
        ],
        "material_title": material.title if material else "",
    }
```

- [ ] **Step 7: Register all routers in backend/app/main.py**

```python
from fastapi import FastAPI

from app.api.health import router as health_router
from app.api.process import router as process_router
from app.api.evaluate import router as evaluate_router
from app.api.materials import router as materials_router
from app.api.sessions import router as sessions_router
from app.api.attempts import router as attempts_router

app = FastAPI(title="Shadowing English Teacher API", version="0.1.0")

app.include_router(health_router)
app.include_router(process_router)
app.include_router(evaluate_router)
app.include_router(materials_router)
app.include_router(sessions_router)
app.include_router(attempts_router)


@app.get("/")
async def root():
    return {"service": "shadowing-backend", "version": "0.1.0"}
```

- [ ] **Step 8: Verify CRUD endpoints**

```bash
cd backend
# Start all services
docker compose up -d

# Create a material (via process endpoint)
# List materials
curl http://localhost:8000/materials
# Expected: [] or list of materials

# Create session
curl -X POST http://localhost:8000/sessions \
  -H "Content-Type: application/json" \
  -d '{"material_id": "test-id", "mode": "sentence_by_sentence"}'
# Expected: session JSON

docker compose stop
```

- [ ] **Step 9: Commit**

```bash
git add backend/app/api/materials.py backend/app/api/sessions.py backend/app/api/attempts.py backend/app/schemas/session.py backend/app/schemas/attempt.py backend/app/main.py
git commit -m "feat: add materials, sessions, attempts CRUD endpoints"
```

---

## Phase 6: Frontend UI Components

### Task 6.1: Material preparation page (素材准备页)

**Files:**
- Create: `frontend/src/components/MaterialForm.tsx`
- Create: `frontend/src/components/MaterialList.tsx`
- Modify: `frontend/src/app/page.tsx`

**Interfaces:**
- Consumes: `apiClient.createMaterial()`, `apiClient.listMaterials()`, `guestStorage`
- Produces: URL input form with submit, material card list, loading and error states

- [ ] **Step 1: Create frontend/src/components/MaterialForm.tsx**

```tsx
"use client";

import { useState } from "react";
import { apiClient } from "@/lib/api-client";
import { guestStorage } from "@/lib/storage";

interface Props {
  onMaterialCreated: () => void;
}

export default function MaterialForm({ onMaterialCreated }: Props) {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [taskId, setTaskId] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const result = await apiClient.createMaterial({ source_url: url.trim() });
      setTaskId(result.task_id);

      // Poll for completion (simplified — v2 would use WebSocket)
      let attempts = 0;
      const maxAttempts = 60; // 2 minutes max
      const poll = setInterval(async () => {
        attempts++;
        try {
          // Check via Python service status endpoint
          const statusRes = await fetch(`/api/python/process/status/${result.task_id}`);
          const status = await statusRes.json();

          if (status.status === "ready") {
            clearInterval(poll);
            guestStorage.addMaterial(status.material_id);
            setUrl("");
            setTaskId(null);
            setLoading(false);
            onMaterialCreated();
          } else if (status.status === "error") {
            clearInterval(poll);
            setError(status.error || "处理失败");
            setLoading(false);
          } else if (attempts >= maxAttempts) {
            clearInterval(poll);
            setError("处理超时，请重试");
            setLoading(false);
          }
        } catch {
          // Continue polling
        }
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "提交失败");
      setLoading(false);
    }
  };

  return (
    <div>
      <form onSubmit={handleSubmit} className="flex gap-3">
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="粘贴 YouTube 或 B站视频链接..."
          className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-base"
          disabled={loading}
        />
        <button
          type="submit"
          disabled={loading || !url.trim()}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? "处理中..." : "导入"}
        </button>
      </form>

      {loading && taskId && (
        <div className="mt-3 flex items-center gap-2 text-sm text-gray-500">
          <div className="animate-spin h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full" />
          正在下载视频并生成字幕...
        </div>
      )}

      {error && (
        <div className="mt-3 text-sm text-red-600 bg-red-50 px-4 py-2 rounded-lg">
          {error}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create frontend/src/components/MaterialList.tsx**

```tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiClient } from "@/lib/api-client";
import { guestStorage } from "@/lib/storage";
import type { Material } from "@/types";

interface Props {
  refreshKey: number;
}

export default function MaterialList({ refreshKey }: Props) {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMaterials();
  }, [refreshKey]);

  const loadMaterials = async () => {
    try {
      const data = await apiClient.listMaterials();
      setMaterials(data);
    } catch {
      // No materials yet — that's ok
      setMaterials([]);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8 text-gray-400">
        <div className="animate-spin h-6 w-6 border-2 border-gray-300 border-t-blue-500 rounded-full" />
      </div>
    );
  }

  if (materials.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400">
        还没有练习素材，粘贴一个视频链接开始吧
      </div>
    );
  }

  return (
    <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
      {materials.map((m) => (
        <Link
          key={m.id}
          href={`/practice/${m.id}`}
          className="block p-4 bg-white rounded-xl border border-gray-200 hover:border-blue-300 hover:shadow-md transition-all"
        >
          <h3 className="font-semibold text-gray-900 truncate">
            {m.title || "未命名素材"}
          </h3>
          <div className="mt-2 flex items-center gap-2 text-sm text-gray-500">
            <span
              className={`inline-block w-2 h-2 rounded-full ${
                m.status === "ready"
                  ? "bg-green-500"
                  : m.status === "error"
                  ? "bg-red-500"
                  : "bg-yellow-500"
              }`}
            />
            {m.status === "ready" ? "就绪" : m.status === "error" ? "失败" : "处理中"}
          </div>
          {m.duration_seconds > 0 && (
            <div className="mt-1 text-xs text-gray-400">
              {Math.floor(m.duration_seconds / 60)}分{Math.floor(m.duration_seconds % 60)}秒
            </div>
          )}
        </Link>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Modify frontend/src/app/page.tsx**

```tsx
"use client";

import { useState } from "react";
import MaterialForm from "@/components/MaterialForm";
import MaterialList from "@/components/MaterialList";

export default function HomePage() {
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <main className="max-w-4xl mx-auto py-12 px-4">
      <h1 className="text-3xl font-bold mb-2">🎤 影子跟读</h1>
      <p className="text-gray-600 mb-8">
        粘贴视频链接，逐句跟读模仿，AI 自动纠正发音
      </p>

      <div className="mb-10">
        <MaterialForm
          onMaterialCreated={() => setRefreshKey((k) => k + 1)}
        />
      </div>

      <section>
        <h2 className="text-lg font-semibold mb-4 text-gray-700">最近素材</h2>
        <MaterialList refreshKey={refreshKey} />
      </section>
    </main>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/MaterialForm.tsx frontend/src/components/MaterialList.tsx frontend/src/app/page.tsx
git commit -m "feat: add material preparation page with URL input and list"
```

---

### Task 6.2: Recording hook and waveform visualization

**Files:**
- Create: `frontend/src/hooks/useRecorder.ts`
- Create: `frontend/src/hooks/useWaveform.ts`
- Create: `frontend/src/components/WaveformCompare.tsx`
- Create: `frontend/src/components/RecorderPanel.tsx`

**Interfaces:**
- Consumes: MediaRecorder API, Web Audio API
- Produces: `useRecorder()` hook returning `{start, stop, audioBlob, isRecording, duration}`, `useWaveform(audioData)` returning waveform data array, `WaveformCompare` SVG component

- [ ] **Step 1: Create frontend/src/hooks/useRecorder.ts**

```ts
"use client";

import { useState, useRef, useCallback } from "react";

interface UseRecorderReturn {
  start: () => Promise<void>;
  stop: () => void;
  audioBlob: Blob | null;
  isRecording: boolean;
  duration: number;
  audioUrl: string | null;
}

export function useRecorder(): UseRecorderReturn {
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [duration, setDuration] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startTimeRef = useRef<number>(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const start = useCallback(async () => {
    chunksRef.current = [];
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mediaRecorder = new MediaRecorder(stream, {
      mimeType: MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/mp4",
    });

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        chunksRef.current.push(e.data);
      }
    };

    mediaRecorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: mediaRecorder.mimeType });
      setAudioBlob(blob);
      setAudioUrl(URL.createObjectURL(blob));
      setIsRecording(false);

      // Stop timer
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }

      // Stop all tracks
      stream.getTracks().forEach((t) => t.stop());
    };

    mediaRecorderRef.current = mediaRecorder;
    setAudioBlob(null);
    setAudioUrl(null);
    setDuration(0);
    startTimeRef.current = Date.now();
    mediaRecorder.start();
    setIsRecording(true);

    // Update duration
    timerRef.current = setInterval(() => {
      setDuration(Date.now() - startTimeRef.current);
    }, 100);
  }, []);

  const stop = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
  }, []);

  return { start, stop, audioBlob, isRecording, duration, audioUrl };
}
```

- [ ] **Step 2: Create frontend/src/hooks/useWaveform.ts**

```ts
"use client";

import { useState, useEffect } from "react";

export function useWaveform(audioUrl: string | null): number[] {
  const [waveform, setWaveform] = useState<number[]>([]);

  useEffect(() => {
    if (!audioUrl) {
      setWaveform([]);
      return;
    }

    let cancelled = false;

    const loadWaveform = async () => {
      try {
        const audioContext = new AudioContext();
        const response = await fetch(audioUrl);
        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

        const channelData = audioBuffer.getChannelData(0);
        // Downsample to ~100 points
        const points = 100;
        const blockSize = Math.floor(channelData.length / points);
        const data: number[] = [];

        for (let i = 0; i < points; i++) {
          let sum = 0;
          const start = i * blockSize;
          const end = Math.min(start + blockSize, channelData.length);
          for (let j = start; j < end; j++) {
            sum += Math.abs(channelData[j]);
          }
          data.push(sum / (end - start));
        }

        // Normalize
        const max = Math.max(...data, 0.0001);
        const normalized = data.map((v) => v / max);

        if (!cancelled) {
          setWaveform(normalized);
        }

        audioContext.close();
      } catch {
        if (!cancelled) setWaveform([]);
      }
    };

    loadWaveform();
    return () => { cancelled = true; };
  }, [audioUrl]);

  return waveform;
}
```

- [ ] **Step 3: Create frontend/src/components/WaveformCompare.tsx**

```tsx
"use client";

interface Props {
  referenceWaveform: number[];
  userWaveform: number[];
  height?: number;
}

export default function WaveformCompare({
  referenceWaveform,
  userWaveform,
  height = 120,
}: Props) {
  const renderWaveform = (data: number[], color: string, opacity: number) => {
    if (data.length === 0) return null;
    const width = 100 / data.length;
    return data.map((val, i) => (
      <rect
        key={i}
        x={`${i * width}%`}
        y={`${(1 - val) * 100}%`}
        width={`${width}%`}
        height={`${val * 100}%`}
        fill={color}
        opacity={opacity}
      />
    ));
  };

  return (
    <div className="space-y-3">
      <div>
        <span className="text-xs text-gray-500 mb-1 block">原声波形</span>
        <div className="bg-gray-100 rounded-lg overflow-hidden" style={{ height }}>
          <svg width="100%" height={height} preserveAspectRatio="none">
            {renderWaveform(referenceWaveform, "#22c55e", 0.6)}
          </svg>
        </div>
      </div>
      <div>
        <span className="text-xs text-gray-500 mb-1 block">你的录音</span>
        <div className="bg-gray-100 rounded-lg overflow-hidden" style={{ height }}>
          <svg width="100%" height={height} preserveAspectRatio="none">
            {renderWaveform(userWaveform, "#ef4444", 0.6)}
          </svg>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Create frontend/src/components/RecorderPanel.tsx**

```tsx
"use client";

import { useRecorder } from "@/hooks/useRecorder";
import { useWaveform } from "@/hooks/useWaveform";
import WaveformCompare from "@/components/WaveformCompare";

interface Props {
  onRecordingComplete: (blob: Blob) => void;
  disabled?: boolean;
}

export default function RecorderPanel({ onRecordingComplete, disabled }: Props) {
  const { start, stop, audioBlob, isRecording, duration, audioUrl } = useRecorder();
  const userWaveform = useWaveform(audioUrl);

  const handleToggleRecording = async () => {
    if (isRecording) {
      stop();
    } else {
      await start();
    }
  };

  // Auto-submit when recording stops
  const prevBlobRef = useRef<Blob | null>(null);
  useEffect(() => {
    if (audioBlob && audioBlob !== prevBlobRef.current) {
      prevBlobRef.current = audioBlob;
      onRecordingComplete(audioBlob);
    }
  }, [audioBlob, onRecordingComplete]);

  const formatDuration = (ms: number) => {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    return `${m}:${(s % 60).toString().padStart(2, "0")}`;
  };

  return (
    <div className="space-y-4">
      <button
        onClick={handleToggleRecording}
        disabled={disabled}
        className={`w-full py-4 rounded-xl text-lg font-bold transition-all ${
          isRecording
            ? "bg-red-500 text-white animate-pulse"
            : "bg-blue-600 text-white hover:bg-blue-700"
        } disabled:opacity-50 disabled:cursor-not-allowed`}
      >
        {isRecording ? `🔴 录音中 ${formatDuration(duration)} — 点击停止` : "🎤 点击开始录音"}
      </button>

      {audioUrl && (
        <WaveformCompare
          referenceWaveform={[]} // Will be filled from material data
          userWaveform={userWaveform}
        />
      )}
    </div>
  );
}
```

Wait — the `useRef` and `useEffect` in RecorderPanel are missing imports. Let me fix:

```tsx
import { useEffect, useRef } from "react";
```

Add at top of RecorderPanel.tsx.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/hooks/ frontend/src/components/WaveformCompare.tsx frontend/src/components/RecorderPanel.tsx
git commit -m "feat: add audio recorder hook, waveform hook, and recorder components"
```

---

### Task 6.3: Practice page (跟读练习页)

**Files:**
- Create: `frontend/src/components/VideoPlayer.tsx`
- Create: `frontend/src/components/ScoreDisplay.tsx`
- Create: `frontend/src/components/ProgressBar.tsx`
- Create: `frontend/src/app/practice/[id]/page.tsx`

**Interfaces:**
- Consumes: `apiClient.getMaterial()`, `apiClient.createSession()`, `apiClient.submitAttempt()`, `useRecorder`
- Produces: Full practice page with video player, sentence display, recorder, scoring

- [ ] **Step 1: Create frontend/src/components/VideoPlayer.tsx**

```tsx
"use client";

interface Props {
  sourceUrl: string;
  startMs?: number;
  endMs?: number;
  onEnded?: () => void;
}

export default function VideoPlayer({ sourceUrl, startMs, endMs, onEnded }: Props) {
  // YouTube embed
  const isYouTube = sourceUrl.includes("youtube.com") || sourceUrl.includes("youtu.be");

  if (isYouTube) {
    const videoId = extractYouTubeId(sourceUrl);
    const startSec = startMs ? Math.floor(startMs / 1000) : 0;
    const endSec = endMs ? Math.floor(endMs / 1000) : undefined;

    const embedUrl = `https://www.youtube.com/embed/${videoId}?start=${startSec}&autoplay=1&controls=1&rel=0${endSec ? `&end=${endSec}` : ""}`;

    return (
      <div className="aspect-video rounded-xl overflow-hidden bg-black">
        <iframe
          src={embedUrl}
          className="w-full h-full"
          allow="autoplay; encrypted-media"
          allowFullScreen
        />
      </div>
    );
  }

  // B站 embed
  if (sourceUrl.includes("bilibili.com")) {
    const bvid = extractBilibiliId(sourceUrl);
    return (
      <div className="aspect-video rounded-xl overflow-hidden bg-black">
        <iframe
          src={`https://player.bilibili.com/player.html?bvid=${bvid}&autoplay=1`}
          className="w-full h-full"
          allow="autoplay"
          allowFullScreen
        />
      </div>
    );
  }

  return (
    <div className="aspect-video rounded-xl bg-gray-200 flex items-center justify-center text-gray-400">
      无法播放此视频
    </div>
  );
}

function extractYouTubeId(url: string): string {
  // Handle youtu.be/XXX and youtube.com/watch?v=XXX
  const shortMatch = url.match(/youtu\.be\/([a-zA-Z0-9_-]+)/);
  if (shortMatch) return shortMatch[1];

  const longMatch = url.match(/[?&]v=([a-zA-Z0-9_-]+)/);
  if (longMatch) return longMatch[1];

  return "";
}

function extractBilibiliId(url: string): string {
  const match = url.match(/bilibili\.com\/video\/(BV[a-zA-Z0-9]+)/);
  return match ? match[1] : "";
}
```

- [ ] **Step 2: Create frontend/src/components/ScoreDisplay.tsx**

```tsx
interface Props {
  score: number;
  label?: string;
}

export default function ScoreDisplay({ score, label }: Props) {
  const getColor = (s: number) => {
    if (s >= 80) return "text-green-600";
    if (s >= 60) return "text-yellow-600";
    return "text-red-600";
  };

  return (
    <div className="text-center">
      {label && <div className="text-xs text-gray-500 mb-1">{label}</div>}
      <div className={`text-3xl font-bold ${getColor(score)}`}>
        {Math.round(score)}
      </div>
      <div className="text-xs text-gray-400">分</div>
    </div>
  );
}
```

- [ ] **Step 3: Create frontend/src/components/ProgressBar.tsx**

```tsx
interface Props {
  current: number;
  total: number;
}

export default function ProgressBar({ current, total }: Props) {
  const pct = total > 0 ? (current / total) * 100 : 0;

  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
          className="h-full bg-blue-500 rounded-full transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-sm text-gray-500 tabular-nums">
        {current}/{total}
      </span>
    </div>
  );
}
```

- [ ] **Step 4: Create frontend/src/app/practice/[id]/page.tsx**

```tsx
"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiClient } from "@/lib/api-client";
import { guestStorage } from "@/lib/storage";
import VideoPlayer from "@/components/VideoPlayer";
import RecorderPanel from "@/components/RecorderPanel";
import ScoreDisplay from "@/components/ScoreDisplay";
import ProgressBar from "@/components/ProgressBar";
import WaveformCompare from "@/components/WaveformCompare";
import { useWaveform } from "@/hooks/useWaveform";
import type { Material, TranscriptSentence, SentenceAttempt } from "@/types";

export default function PracticePage() {
  const params = useParams();
  const router = useRouter();
  const materialId = params.id as string;

  const [material, setMaterial] = useState<Material | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [attempts, setAttempts] = useState<Record<number, SentenceAttempt>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [evaluating, setEvaluating] = useState(false);

  const lastAttempt = attempts[currentIndex];
  const userWaveform = useWaveform(lastAttempt ? URL.createObjectURL(
    new Blob([], { type: "audio/webm" }) // placeholder — real waveform data comes from attempt
  ) : null);
  const currentSentence: TranscriptSentence | undefined =
    material?.transcript?.[currentIndex];

  useEffect(() => {
    loadMaterial();
  }, [materialId]);

  const loadMaterial = async () => {
    try {
      setLoading(true);
      const data = await apiClient.getMaterial(materialId);
      setMaterial(data);

      // Create a practice session
      const session = await apiClient.createSession({
        material_id: materialId,
        mode: "sentence_by_sentence",
      });
      setSessionId(session.id);
      guestStorage.addSession(session.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载失败");
    } finally {
      setLoading(false);
    }
  };

  const handleRecordingComplete = async (blob: Blob) => {
    if (!sessionId || !currentSentence) return;

    setEvaluating(true);
    try {
      const result = await apiClient.submitAttempt(
        sessionId,
        blob,
        currentSentence.sentence_index
      );
      setAttempts((prev) => ({
        ...prev,
        [currentIndex]: result.attempt,
      }));
    } catch (err) {
      setError("评分失败，请重试");
    } finally {
      setEvaluating(false);
    }
  };

  const goToSentence = (index: number) => {
    if (!material?.transcript) return;
    if (index >= 0 && index < material.transcript.length) {
      setCurrentIndex(index);
    }
  };

  const handleComplete = async () => {
    if (!sessionId) return;
    await apiClient.completeSession(sessionId);
    router.push(`/report/${sessionId}`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin h-8 w-8 border-2 border-gray-300 border-t-blue-500 rounded-full" />
      </div>
    );
  }

  if (error || !material || !material.transcript) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <p className="text-red-500">{error || "素材加载失败"}</p>
        <button onClick={() => router.push("/")} className="text-blue-600 hover:underline">
          返回首页
        </button>
      </div>
    );
  }

  const total = material.transcript.length;

  return (
    <main className="max-w-6xl mx-auto py-6 px-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={() => router.push("/")}
          className="text-gray-500 hover:text-gray-700"
        >
          ← 返回素材
        </button>
        <h2 className="font-semibold text-gray-800 truncate max-w-md">
          {material.title || "练习中"}
        </h2>
        <span className="text-sm text-gray-500">
          第 {currentIndex + 1}/{total} 句
        </span>
      </div>

      {/* Main content: video + sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Video + sentence */}
        <div className="space-y-4">
          <VideoPlayer
            sourceUrl={material.source_url}
            startMs={currentSentence?.start_ms}
            endMs={currentSentence?.end_ms}
          />

          <div className="p-4 bg-white rounded-xl border border-gray-200 min-h-[80px]">
            <p className="text-lg font-medium text-gray-800">
              {currentSentence?.text || "—"}
            </p>
          </div>
        </div>

        {/* Right: Recorder + feedback */}
        <div className="space-y-4">
          {currentSentence && (
            <RecorderPanel
              onRecordingComplete={handleRecordingComplete}
              disabled={evaluating}
            />
          )}

          {evaluating && (
            <div className="flex items-center gap-2 text-sm text-gray-500 justify-center">
              <div className="animate-spin h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full" />
              正在评估发音...
            </div>
          )}

          {lastAttempt && (
            <div className="p-4 bg-white rounded-xl border border-gray-200 space-y-4">
              <ScoreDisplay score={lastAttempt.score} label="本句得分" />

              {lastAttempt.word_scores && lastAttempt.word_scores.length > 0 && (
                <div>
                  <div className="text-xs text-gray-500 mb-2">逐词评分</div>
                  <div className="flex flex-wrap gap-2">
                    {lastAttempt.word_scores.map((ws, i) => (
                      <span
                        key={i}
                        className={`px-2 py-1 rounded text-sm font-medium ${
                          ws.score >= 80
                            ? "bg-green-100 text-green-700"
                            : ws.score >= 60
                            ? "bg-yellow-100 text-yellow-700"
                            : "bg-red-100 text-red-700"
                        }`}
                      >
                        {ws.word} {Math.round(ws.score)}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {lastAttempt.suggestions && lastAttempt.suggestions.length > 0 && (
                <div>
                  <div className="text-xs text-gray-500 mb-2">纠音建议</div>
                  <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
                    {lastAttempt.suggestions.map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Bottom bar: progress + navigation */}
      <div className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex-1 max-w-md">
          <ProgressBar current={currentIndex + 1} total={total} />
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => goToSentence(currentIndex - 1)}
            disabled={currentIndex === 0}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            ⏮ 上一句
          </button>

          <button
            onClick={() => {
              // Replay current: go to sentence again triggers VideoPlayer reload
              goToSentence(currentIndex);
            }}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            ▶ 重播
          </button>

          {currentIndex < total - 1 ? (
            <button
              onClick={() => goToSentence(currentIndex + 1)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              下一句 ⏭
            </button>
          ) : (
            <button
              onClick={handleComplete}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
            >
              完成练习 ✓
            </button>
          )}
        </div>
      </div>
    </main>
  );
}
```

- [ ] **Step 5: Verify practice page compiles**

```bash
cd frontend
npm run build 2>&1 | head -50
```

Expected: No TypeScript errors (may have warnings about unused imports — fix those)

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/VideoPlayer.tsx frontend/src/components/ScoreDisplay.tsx frontend/src/components/ProgressBar.tsx frontend/src/app/practice/
git commit -m "feat: add practice page with video player, recorder, and scoring"
```

---

### Task 6.4: Report page (反馈报告页)

**Files:**
- Create: `frontend/src/components/SentenceReview.tsx`
- Create: `frontend/src/components/SuggestionCard.tsx`
- Create: `frontend/src/app/report/[id]/page.tsx`

**Interfaces:**
- Consumes: `apiClient.getReport()`
- Produces: Full report page with overall scores, sentence-by-sentence review, suggestions

- [ ] **Step 1: Create frontend/src/components/SentenceReview.tsx**

```tsx
import type { SentenceAttempt } from "@/types";
import ScoreDisplay from "@/components/ScoreDisplay";

interface Props {
  attempt: SentenceAttempt;
  sentenceText: string;
  index: number;
}

export default function SentenceReview({ attempt, sentenceText, index }: Props) {
  const isLowScore = attempt.score < 60;

  return (
    <div className={`p-4 rounded-xl border ${isLowScore ? "border-red-200 bg-red-50" : "border-gray-200 bg-white"}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs text-gray-400 font-mono">#{index + 1}</span>
            <span className="text-sm text-gray-500">
              {isLowScore ? "⚠️ 需要改进" : "✅ 不错"}
            </span>
          </div>
          <p className="text-gray-800 font-medium">{sentenceText}</p>

          {attempt.word_scores && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {attempt.word_scores.map((ws, i) => (
                <span
                  key={i}
                  className={`inline-flex items-center px-2 py-0.5 rounded text-sm ${
                    ws.score >= 80
                      ? "bg-green-100 text-green-700"
                      : ws.score >= 60
                      ? "bg-yellow-100 text-yellow-700"
                      : "bg-red-100 text-red-700"
                  }`}
                >
                  {ws.word}
                  {ws.issue && (
                    <span className="ml-1 text-xs opacity-70">{ws.issue}</span>
                  )}
                </span>
              ))}
            </div>
          )}
        </div>

        <ScoreDisplay score={attempt.score} />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create frontend/src/components/SuggestionCard.tsx**

```tsx
interface Props {
  suggestions: string[];
}

export default function SuggestionCard({ suggestions }: Props) {
  if (suggestions.length === 0) return null;

  return (
    <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
      <h3 className="font-semibold text-blue-900 mb-3">💡 重点练习建议</h3>
      <ul className="space-y-2">
        {suggestions.map((s, i) => (
          <li key={i} className="text-sm text-blue-800 flex items-start gap-2">
            <span className="text-blue-400 mt-0.5">•</span>
            {s}
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 3: Create frontend/src/app/report/[id]/page.tsx**

```tsx
"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiClient } from "@/lib/api-client";
import ScoreDisplay from "@/components/ScoreDisplay";
import SentenceReview from "@/components/SentenceReview";
import SuggestionCard from "@/components/SuggestionCard";
import type { PracticeReport } from "@/types";

export default function ReportPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.id as string;

  const [report, setReport] = useState<PracticeReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadReport();
  }, [sessionId]);

  const loadReport = async () => {
    try {
      const data = await apiClient.getReport(sessionId);
      setReport(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载报告失败");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin h-8 w-8 border-2 border-gray-300 border-t-blue-500 rounded-full" />
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <p className="text-red-500">{error || "报告不存在"}</p>
        <button onClick={() => router.push("/")} className="text-blue-600 hover:underline">
          返回首页
        </button>
      </div>
    );
  }

  const allSuggestions = report.attempts.flatMap((a) => a.suggestions || []);
  const uniqueSuggestions = [...new Set(allSuggestions)];

  return (
    <main className="max-w-3xl mx-auto py-8 px-4">
      {/* Header */}
      <button onClick={() => router.push("/")} className="text-gray-500 hover:text-gray-700 mb-6">
        ← 返回首页
      </button>

      <h1 className="text-2xl font-bold mb-2">📊 练习报告</h1>
      <p className="text-gray-500 mb-8">{report.material_title}</p>

      {/* Overall scores */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="p-4 bg-white rounded-xl border border-gray-200 text-center">
          <ScoreDisplay score={report.session.overall_score || 0} label="总分" />
        </div>
        <div className="p-4 bg-white rounded-xl border border-gray-200 text-center">
          <ScoreDisplay score={report.session.pronunciation_score || 0} label="发音" />
        </div>
        <div className="p-4 bg-white rounded-xl border border-gray-200 text-center">
          <ScoreDisplay score={report.session.rhythm_score || 0} label="节奏" />
        </div>
      </div>

      {/* Suggestions */}
      {uniqueSuggestions.length > 0 && (
        <div className="mb-8">
          <SuggestionCard suggestions={uniqueSuggestions} />
        </div>
      )}

      {/* Sentence-by-sentence review */}
      <section>
        <h2 className="text-lg font-semibold mb-4">逐句回顾</h2>
        <div className="space-y-3">
          {report.attempts.map((attempt) => (
            <SentenceReview
              key={attempt.id}
              attempt={attempt}
              sentenceText={`第 ${attempt.sentence_index + 1} 句`}
              index={attempt.sentence_index}
            />
          ))}
        </div>
      </section>

      {/* Actions */}
      <div className="mt-8 flex gap-4">
        <button
          onClick={() =>
            router.push(`/practice/${report.session.material_id}`)
          }
          className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700"
        >
          重新练习
        </button>
      </div>
    </main>
  );
}
```

- [ ] **Step 4: Verify report page compiles**

```bash
cd frontend
npm run build 2>&1 | head -50
```

Expected: No critical errors

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/SentenceReview.tsx frontend/src/components/SuggestionCard.tsx frontend/src/app/report/
git commit -m "feat: add report page with scores, sentence review, and suggestions"
```

---

## Phase 7: Integration & Polish

### Task 7.1: Improve Material page to show transcript sentences on detail, enable "start practice" button

**Files:**
- Modify: `frontend/src/components/MaterialList.tsx` — ensure clicking navigates to practice
- Modify: `frontend/src/app/page.tsx` — ensure flow works end-to-end

**Note:** This is mostly already wired via Link in MaterialList and the practice page already loads material data. Review and fix any loose ends.

- [ ] **Step 1: Do a full end-to-end walkthrough manually**

```bash
docker compose up -d
# Open http://localhost:3000
# 1. Paste a YouTube URL
# 2. Wait for processing
# 3. Click the material card
# 4. Practice a sentence
# 5. View the report
```

Document any broken flows and fix them.

- [ ] **Step 2: Add error boundaries to practice page**

Add `error.tsx` at `frontend/src/app/practice/[id]/error.tsx`:

```tsx
"use client";

export default function PracticeError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4">
      <p className="text-red-500">练习页面出错：{error.message}</p>
      <button onClick={reset} className="px-4 py-2 bg-blue-600 text-white rounded-lg">
        重试
      </button>
    </div>
  );
}
```

Add `error.tsx` at `frontend/src/app/report/[id]/error.tsx` (same content).

- [ ] **Step 3: Add loading states to practice page**

Create `frontend/src/app/practice/[id]/loading.tsx`:

```tsx
export default function PracticeLoading() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="animate-spin h-8 w-8 border-2 border-gray-300 border-t-blue-500 rounded-full" />
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app/practice/[id]/error.tsx frontend/src/app/practice/[id]/loading.tsx frontend/src/app/report/[id]/error.tsx
git commit -m "feat: add error boundaries and loading states"
```

---

### Task 7.2: End-to-end test with Docker Compose

- [ ] **Step 1: Run full stack**

```bash
cd /Users/hao/Code/HaoEnglishTeacher
docker compose down -v
docker compose up -d
sleep 10
docker compose ps
```

Expected: All 5 services running (postgres, redis, backend, celery-worker, frontend)

- [ ] **Step 2: Verify health endpoints**

```bash
curl http://localhost:8000/health
# Expected: {"status":"ok"}

curl http://localhost:3000
# Expected: HTML with 影子跟读
```

- [ ] **Step 3: Test video processing flow**

```bash
# Submit a simple test video
curl -X POST http://localhost:3000/api/materials \
  -H "Content-Type: application/json" \
  -d '{"source_url": "https://www.youtube.com/watch?v=jNQXAC9IVRw"}'
# Expected: {"task_id": "..."}

# List materials
curl http://localhost:3000/api/materials
# Expected: [] or [material...]
```

- [ ] **Step 4: Document any issues in README**

Add known issues and troubleshooting to `README.md`.

- [ ] **Step 5: Commit**

```bash
git add README.md
git commit -m "docs: add troubleshooting to README"
```

---

## Summary

**Total tasks: 14** across 7 phases.

**Critical path:** Phase 1 (skeleton) → Phase 2 (video processing) → Phase 3 (evaluation) → Phase 4 (BFF) → Phase 5 (CRUD) → Phase 6 (frontend UI) → Phase 7 (integration)

**Independent work possible:**
- Phase 4 (BFF routes) and Phase 5 (Python CRUD) can be done in parallel after Phase 3
- Phase 6 tasks 6.2 (hooks/components) and 6.3 (practice page) are tightly coupled — do sequentially

**Estimated total: ~4-6 weeks** (single developer, per spec)
