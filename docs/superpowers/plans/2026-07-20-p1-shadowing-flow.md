# P1 全自动双轨跟读流程 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现全自动跟读——自动播放(双轨)、播完自动录音、VAD 自动停止、自动提交评分、显示分数 3s 后自动下一句；保留视频画面，YouTube/B站通用。

**Architecture:** 双轨播放器（静音 iframe 画面 + 原生 audio 声音主控）+ 状态机（playing→recording→evaluating→showing_score→next）。后端新增 audio serve 路由 + Material 加 audio_filename 字段。

**Tech Stack:** FastAPI + SQLAlchemy + alembic + pytest（后端）；Next.js 14 + TypeScript + Web Audio API（前端，无测试框架，用 `npm run build` + 手动验证）

**Spec:** `docs/superpowers/specs/2026-07-20-p1-shadowing-flow-design.md`

**运行测试命令（后端）：** `cd backend && uv run pytest <path> -v`

---

## File Structure

### 后端
| 文件 | 职责 | 操作 |
|---|---|---|
| `app/models/material.py` | Material 加 `audio_filename` | 修改 |
| `alembic/versions/002_add_audio_filename.py` | 加列迁移 | 新增 |
| `app/tasks/process_video.py` | 保存 audio_filename | 修改 |
| `app/api/materials.py` | `GET /materials/{id}/audio` serve | 修改 |
| `tests/test_audio_serve.py` | audio serve 测试 | 新增 |
| `tests/test_process_video_audio.py` | audio_filename 保存测试 | 新增 |

### 前端
| 文件 | 职责 | 操作 |
|---|---|---|
| `src/app/api/materials/[id]/audio/route.ts` | BFF audio 代理 | 新增 |
| `src/components/VideoPlayer.tsx` | 双轨播放器 | 重构 |
| `src/hooks/useRecorder.ts` | 增 VAD 自动停止 | 修改 |
| `src/app/practice/[id]/page.tsx` | 状态机 + 兜底控制 | 重构 |

---

## Task 1: Material model 加 audio_filename + alembic 迁移

**Files:**
- Modify: `backend/app/models/material.py`
- Create: `backend/alembic/versions/002_add_audio_filename.py`
- Test: `backend/tests/test_material_audio_field.py`

- [ ] **Step 1: Write the failing test**

Create `backend/tests/test_material_audio_field.py`:

```python
from app.models.material import Material


def test_material_has_audio_filename_field():
    m = Material(
        id="test-id",
        source_type="youtube",
        source_url="https://youtube.com/watch?v=x",
    )
    assert hasattr(m, "audio_filename")
    assert m.audio_filename == ""
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && uv run pytest tests/test_material_audio_field.py -v`
Expected: FAIL — `AttributeError: audio_filename` (column not mapped)

- [ ] **Step 3: Add field to model**

In `backend/app/models/material.py`, add `audio_filename` column after `transcript_json`:

```python
    transcript_json: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    audio_filename: Mapped[str] = mapped_column(String(255), default="", server_default="")
    status: Mapped[str] = mapped_column(String(20), default="processing")
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && uv run pytest tests/test_material_audio_field.py -v`
Expected: PASS

- [ ] **Step 5: Create alembic migration**

Create `backend/alembic/versions/002_add_audio_filename.py`:

```python
"""add audio_filename to materials

Revision ID: 002
Revises: 001
Create Date: 2026-07-20 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "002"
down_revision: Union[str, None] = "001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "materials",
        sa.Column("audio_filename", sa.String(length=255), nullable=False, server_default=""),
    )


def downgrade() -> None:
    op.drop_column("materials", "audio_filename")
```

- [ ] **Step 6: Commit**

```bash
cd backend && git add app/models/material.py alembic/versions/002_add_audio_filename.py tests/test_material_audio_field.py
git commit -m "feat: add audio_filename field to Material + migration"
```

---

## Task 2: process_video_task 保存 audio_filename

**Files:**
- Modify: `backend/app/tasks/process_video.py`
- Test: `backend/tests/test_process_video_audio.py`

- [ ] **Step 1: Write the failing test**

Create `backend/tests/test_process_video_audio.py`:

```python
import os
from unittest.mock import patch

from app.tasks.process_video import process_video_task


def test_process_video_saves_audio_filename(monkeypatch, tmp_path):
    """download_video returns a path; the wav filename should be stored on material."""
    fake_wav = tmp_path / "VID123.wav"
    fake_wav.write_bytes(b"fake")

    captured = {}

    async def fake_save_factory():
        async def fake_save(self):
            from app.models.material import Material
            from app.db.database import async_session
            async with async_session() as db:
                material = Material(
                    id=self.material_id,
                    source_type="youtube",
                    source_url="https://youtube.com/watch?v=VID123",
                    title="",
                    duration_seconds=1.0,
                    transcript_json={"segments": []},
                    audio_filename=os.path.basename(str(fake_wav)),
                    status="ready",
                )
                db.add(material)
                await db.commit()
                captured["audio_filename"] = material.audio_filename
            return self.material_id
        return fake_save

    with patch("app.tasks.process_video.download_video", return_value=str(fake_wav)), \
         patch("app.tasks.process_video.transcribe_audio", return_value=[]):
        # We only verify the audio_filename extraction logic, not the full DB write.
        # Test the extraction helper directly:
        from app.tasks.process_video import _audio_filename_from_path
        assert _audio_filename_from_path(str(fake_wav)) == "VID123.wav"
```

> Note: The full celery task writes to DB (async). We test the pure helper `_audio_filename_from_path` to avoid DB coupling.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && uv run pytest tests/test_process_video_audio.py -v`
Expected: FAIL — `ImportError: cannot import name '_audio_filename_from_path'`

- [ ] **Step 3: Add helper and use it in task**

In `backend/app/tasks/process_video.py`, add the helper and set `audio_filename` on the Material. Replace the `material = Material(...)` block (lines 31-53) and add the helper near the top:

Add after imports:
```python
import os


def _audio_filename_from_path(audio_path: str) -> str:
    """Extract the wav filename from the full path returned by download_video."""
    return os.path.basename(audio_path)
```

In the `save()` function, add `audio_filename` to the Material constructor (after `transcript_json=...`):

```python
                material = Material(
                    id=material_id,
                    source_type="youtube" if "youtube.com" in source_url or "youtu.be" in source_url else "bilibili",
                    source_url=source_url,
                    title="",
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
                    audio_filename=_audio_filename_from_path(audio_path),
                    status="ready",
                )
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && uv run pytest tests/test_process_video_audio.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
cd backend && git add app/tasks/process_video.py tests/test_process_video_audio.py
git commit -m "feat: save audio_filename in process_video_task"
```

---

## Task 3: GET /materials/{id}/audio serve 路由

**Files:**
- Modify: `backend/app/api/materials.py`
- Test: `backend/tests/test_audio_serve.py`

- [ ] **Step 1: Write the failing test**

Create `backend/tests/test_audio_serve.py`:

```python
import io
import os
from datetime import datetime
from unittest.mock import AsyncMock

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app
from app.db.database import get_db
from app.models.material import Material


class FakeMaterial:
    def __init__(self, audio_filename, exists=True, tmp_path=None):
        self.id = "mat-1"
        self.source_type = "youtube"
        self.source_url = "https://youtube.com/watch?v=x"
        self.title = "t"
        self.duration_seconds = 1.0
        self.transcript_json = None
        self.audio_filename = audio_filename
        self.status = "ready"
        self.created_at = datetime.utcnow()
        self._exists = exists
        self._tmp_path = tmp_path


class FakeResult:
    def __init__(self, material):
        self._material = material

    def scalar_one_or_none(self):
        return self._material


class FakeSession:
    async def execute(self, stmt):
        return FakeResult(self._material)

    async def close(self):
        pass

    def __init__(self, material):
        self._material = material


@pytest.mark.asyncio
async def test_audio_serve_success(tmp_path, monkeypatch):
    wav = tmp_path / "VID.wav"
    wav.write_bytes(b"fake-audio")

    material = FakeMaterial(audio_filename="VID.wav", tmp_path=tmp_path)
    fake_session = FakeSession(material)

    async def override_get_db():
        yield fake_session

    app.dependency_overrides[get_db] = override_get_db
    monkeypatch.setattr("app.api.materials.settings.upload_dir", str(tmp_path))

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        resp = await ac.get("/materials/mat-1/audio")

    app.dependency_overrides.clear()

    assert resp.status_code == 200
    assert resp.headers["content-type"] in ("audio/wav", "application/octet-stream")


@pytest.mark.asyncio
async def test_audio_serve_file_missing(tmp_path, monkeypatch):
    material = FakeMaterial(audio_filename="missing.wav")
    fake_session = FakeSession(material)

    async def override_get_db():
        yield fake_session

    app.dependency_overrides[get_db] = override_get_db
    monkeypatch.setattr("app.api.materials.settings.upload_dir", str(tmp_path))

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        resp = await ac.get("/materials/mat-1/audio")

    app.dependency_overrides.clear()

    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_audio_serve_material_not_found(tmp_path, monkeypatch):
    fake_session = FakeSession(material=None)

    async def override_get_db():
        yield fake_session

    app.dependency_overrides[get_db] = override_get_db
    monkeypatch.setattr("app.api.materials.settings.upload_dir", str(tmp_path))

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        resp = await ac.get("/materials/nope/audio")

    app.dependency_overrides.clear()

    assert resp.status_code == 404
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && uv run pytest tests/test_audio_serve.py -v`
Expected: FAIL — 404 (route not defined returns 404) or route missing

- [ ] **Step 3: Add audio serve route**

In `backend/app/api/materials.py`, add imports and the route. Add to imports at top:

```python
import os
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.db.database import get_db
from app.models.material import Material
from app.schemas.material import MaterialResponse, MaterialDetailResponse
```

Add the route after `get_material`:

```python
@router.get("/{material_id}/audio")
async def get_material_audio(
    material_id: str,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Material).where(Material.id == material_id))
    material = result.scalar_one_or_none()
    if material is None:
        raise HTTPException(status_code=404, detail="Material not found")

    if not material.audio_filename:
        raise HTTPException(status_code=404, detail="Audio not available")

    audio_path = os.path.join(settings.upload_dir, material.audio_filename)
    if not os.path.exists(audio_path):
        raise HTTPException(status_code=404, detail="Audio file not found")

    return FileResponse(audio_path, media_type="audio/wav")
```

> Note: This route must be declared BEFORE `/{material_id}` is ambiguous — but `/{material_id}/audio` is more specific so FastAPI matches it correctly. Ensure it's defined in the file; order with `get_material` doesn't conflict since paths differ (`/{material_id}/audio` vs `/{material_id}`).

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && uv run pytest tests/test_audio_serve.py -v`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
cd backend && git add app/api/materials.py tests/test_audio_serve.py
git commit -m "feat: add GET /materials/{id}/audio serve route"
```

---

## Task 4: BFF audio 代理路由

**Files:**
- Create: `frontend/src/app/api/materials/[id]/audio/route.ts`

- [ ] **Step 1: Create the BFF route**

Create `frontend/src/app/api/materials/[id]/audio/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";

const PYTHON_SERVICE = process.env.PYTHON_SERVICE_URL || "http://backend:8000";

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const res = await fetch(`${PYTHON_SERVICE}/materials/${params.id}/audio`);

  if (!res.ok) {
    return NextResponse.json(
      { error: "audio not available" },
      { status: res.status }
    );
  }

  const contentType = res.headers.get("content-type") || "audio/wav";
  const arrayBuffer = await res.arrayBuffer();
  return new NextResponse(arrayBuffer, {
    status: 200,
    headers: { "content-type": contentType },
  });
}
```

- [ ] **Step 2: Commit**

```bash
cd frontend && git add "src/app/api/materials/[id]/audio/route.ts"
git commit -m "feat: add BFF audio proxy route"
```

---

## Task 5: VideoPlayer 重构为双轨播放器

**Files:**
- Modify: `frontend/src/components/VideoPlayer.tsx`

- [ ] **Step 1: Rewrite VideoPlayer as dual-track**

Replace entire contents of `frontend/src/components/VideoPlayer.tsx`:

```tsx
"use client";

import { useEffect, useRef } from "react";

interface Props {
  sourceUrl: string;
  audioSrc?: string;
  startMs?: number;
  endMs?: number;
  onAudioEnded?: () => void;
}

export default function VideoPlayer({
  sourceUrl,
  audioSrc,
  startMs,
  endMs,
  onAudioEnded,
}: Props) {
  const audioRef = useRef<HTMLAudioElement>(null);

  const isYouTube =
    sourceUrl.includes("youtube.com") || sourceUrl.includes("youtu.be");
  const isBilibili = sourceUrl.includes("bilibili.com");

  // Drive the <audio> element: seek to start, play, pause at end
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !audioSrc) return;

    const startSec = startMs ? startMs / 1000 : 0;
    const endSec = endMs ? endMs / 1000 : undefined;

    const onLoadedMetadata = () => {
      audio.currentTime = startSec;
      audio.play().catch(() => {
        /* autoplay may be blocked; user gesture will retry via replay */
      });
    };

    const onTimeUpdate = () => {
      if (endSec !== undefined && audio.currentTime >= endSec) {
        audio.pause();
        onAudioEnded?.();
      }
    };

    const onEnded = () => {
      onAudioEnded?.();
    };

    audio.addEventListener("loadedmetadata", onLoadedMetadata);
    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("ended", onEnded);

    return () => {
      audio.removeEventListener("loadedmetadata", onLoadedMetadata);
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("ended", onEnded);
    };
  }, [audioSrc, startMs, endMs, onAudioEnded]);

  // Build iframe embed URL (muted video track)
  let iframeSrc = "";
  if (isYouTube) {
    const videoId = extractYouTubeId(sourceUrl);
    const startSec = startMs ? Math.floor(startMs / 1000) : 0;
    const endSec = endMs ? Math.floor(endMs / 1000) : undefined;
    iframeSrc = `https://www.youtube.com/embed/${videoId}?start=${startSec}&autoplay=1&mute=1&controls=0&rel=0${
      endSec ? `&end=${endSec}` : ""
    }`;
  } else if (isBilibili) {
    const bvid = extractBilibiliId(sourceUrl);
    // B站 embed has no mute param; video audio may overlap. See design 3.4.
    iframeSrc = `https://player.bilibili.com/player.html?bvid=${bvid}&autoplay=1`;
  }

  return (
    <div className="space-y-2">
      {iframeSrc && (
        <div className="aspect-video rounded-xl overflow-hidden bg-black">
          <iframe
            src={iframeSrc}
            className="w-full h-full"
            allow="autoplay; encrypted-media"
            allowFullScreen
          />
        </div>
      )}
      {audioSrc && (
        <audio ref={audioRef} src={audioSrc} className="hidden" preload="auto" />
      )}
    </div>
  );
}

function extractYouTubeId(url: string): string {
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

- [ ] **Step 2: Commit**

```bash
cd frontend && git add src/components/VideoPlayer.tsx
git commit -m "feat: refactor VideoPlayer to dual-track (muted iframe + audio)"
```

---

## Task 6: useRecorder 增 VAD 自动停止

**Files:**
- Modify: `frontend/src/hooks/useRecorder.ts`

- [ ] **Step 1: Add VAD to useRecorder**

Replace entire contents of `frontend/src/hooks/useRecorder.ts`:

```typescript
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

const SILENCE_THRESHOLD = 0.02; // RMS threshold for "silence"
const SILENCE_DURATION_MS = 1500; // 1.5s of silence => stop
const MAX_RECORDING_MS = 30000; // 30s hard cap

export function useRecorder(): UseRecorderReturn {
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [duration, setDuration] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startTimeRef = useRef<number>(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const maxTimerRef = useRef<NodeJS.Timeout | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const vadIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const silenceStartRef = useRef<number>(0);
  const streamRef = useRef<MediaStream | null>(null);

  const cleanupVad = () => {
    if (vadIntervalRef.current) {
      clearInterval(vadIntervalRef.current);
      vadIntervalRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    analyserRef.current = null;
  };

  const stop = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    cleanupVad();
    if (maxTimerRef.current) {
      clearTimeout(maxTimerRef.current);
      maxTimerRef.current = null;
    }
  }, []);

  const start = useCallback(async () => {
    chunksRef.current = [];
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    streamRef.current = stream;
    const mediaRecorder = new MediaRecorder(stream, {
      mimeType: MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : "audio/mp4",
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
      if (timerRef.current) clearInterval(timerRef.current);
      cleanupVad();
      if (maxTimerRef.current) {
        clearTimeout(maxTimerRef.current);
        maxTimerRef.current = null;
      }
      stream.getTracks().forEach((t) => t.stop());
    };

    mediaRecorderRef.current = mediaRecorder;
    setAudioBlob(null);
    setAudioUrl(null);
    setDuration(0);
    startTimeRef.current = Date.now();
    mediaRecorder.start();
    setIsRecording(true);

    // Duration timer
    timerRef.current = setInterval(() => {
      setDuration(Date.now() - startTimeRef.current);
    }, 100);

    // VAD: AnalyserNode monitors volume, auto-stop after sustained silence
    try {
      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);
      analyserRef.current = analyser;

      const data = new Uint8Array(analyser.fftSize);
      silenceStartRef.current = 0;

      vadIntervalRef.current = setInterval(() => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteTimeDomainData(data);
        // Compute RMS
        let sum = 0;
        for (let i = 0; i < data.length; i++) {
          const v = (data[i] - 128) / 128;
          sum += v * v;
        }
        const rms = Math.sqrt(sum / data.length);

        if (rms < SILENCE_THRESHOLD) {
          if (silenceStartRef.current === 0) {
            silenceStartRef.current = Date.now();
          } else if (Date.now() - silenceStartRef.current >= SILENCE_DURATION_MS) {
            // Sustained silence -> stop
            stop();
          }
        } else {
          silenceStartRef.current = 0;
        }
      }, 100);
    } catch {
      // AudioContext unavailable; VAD disabled, manual stop only
    }

    // Hard cap: 30s
    maxTimerRef.current = setTimeout(() => {
      stop();
    }, MAX_RECORDING_MS);
  }, [stop]);

  return { start, stop, audioBlob, isRecording, duration, audioUrl };
}
```

- [ ] **Step 2: Commit**

```bash
cd frontend && git add src/hooks/useRecorder.ts
git commit -m "feat: add VAD auto-stop to useRecorder"
```

---

## Task 7: practice 页状态机 + 兜底控制

**Files:**
- Modify: `frontend/src/app/practice/[id]/page.tsx`

- [ ] **Step 1: Rewrite practice page with state machine**

Replace entire contents of `frontend/src/app/practice/[id]/page.tsx`:

```tsx
"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiClient } from "@/lib/api-client";
import { guestStorage } from "@/lib/storage";
import VideoPlayer from "@/components/VideoPlayer";
import RecorderPanel from "@/components/RecorderPanel";
import ScoreDisplay from "@/components/ScoreDisplay";
import ProgressBar from "@/components/ProgressBar";
import type { Material, TranscriptSentence, SentenceAttempt } from "@/types";

type Phase = "idle" | "playing" | "recording" | "evaluating" | "showing_score";

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
  const [phase, setPhase] = useState<Phase>("idle");
  const [autoFlow, setAutoFlow] = useState(true);
  const [replayKey, setReplayKey] = useState(0);

  const autoFlowRef = useRef(autoFlow);
  autoFlowRef.current = autoFlow;

  const currentSentence: TranscriptSentence | undefined =
    material?.transcript?.[currentIndex];
  const lastAttempt = attempts[currentIndex];

  useEffect(() => {
    loadMaterial();
  }, [materialId]);

  const loadMaterial = async () => {
    try {
      setLoading(true);
      const data = await apiClient.getMaterial(materialId);
      setMaterial(data);
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

  // When sentence changes (and autoFlow on), start playing
  useEffect(() => {
    if (material && currentSentence) {
      setPhase("playing");
    }
  }, [currentIndex, replayKey, material, currentSentence]);

  const handleAudioEnded = useCallback(() => {
    if (!autoFlowRef.current) return;
    setPhase("recording");
  }, []);

  const handleRecordingComplete = useCallback(
    async (blob: Blob) => {
      if (!sessionId || !currentSentence) return;
      setPhase("evaluating");
      try {
        const result = await apiClient.submitAttempt(
          sessionId,
          blob,
          currentSentence.sentence_index,
          currentSentence.text
        );
        setAttempts((prev) => ({ ...prev, [currentIndex]: result.attempt }));
        setPhase("showing_score");
      } catch (err) {
        setError("评分失败，请重试");
        setPhase("showing_score");
      }
    },
    [sessionId, currentSentence, currentIndex]
  );

  // After showing score, auto-advance after 3s if autoFlow on
  useEffect(() => {
    if (phase !== "showing_score" || !autoFlow) return;
    const total = material?.transcript?.length ?? 0;
    const timer = setTimeout(() => {
      if (currentIndex < total - 1) {
        setCurrentIndex((i) => i + 1);
      } else {
        handleComplete();
      }
    }, 3000);
    return () => clearTimeout(timer);
  }, [phase, autoFlow, currentIndex, material]);

  const goToSentence = (index: number) => {
    if (!material?.transcript) return;
    if (index >= 0 && index < material.transcript.length) {
      setCurrentIndex(index);
      setPhase("idle");
    }
  };

  const handleReRecord = () => {
    setPhase("recording");
  };

  const handleComplete = async () => {
    if (!sessionId) return;
    try {
      await apiClient.completeSession(sessionId);
    } catch {
      /* proceed to report even if complete fails */
    }
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
          第 {currentIndex + 1}/{total} 句 · {phaseLabel(phase)}
        </span>
      </div>

      {/* Main content: video + sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Video + sentence */}
        <div className="space-y-4">
          <VideoPlayer
            key={`${currentIndex}-${replayKey}`}
            sourceUrl={material.source_url}
            audioSrc={`/api/materials/${materialId}/audio`}
            startMs={currentSentence?.start_ms}
            endMs={currentSentence?.end_ms}
            onAudioEnded={handleAudioEnded}
          />

          <div className="p-4 bg-white rounded-xl border border-gray-200 min-h-[80px]">
            <p className="text-lg font-medium text-gray-800">
              {currentSentence?.text || "—"}
            </p>
          </div>
        </div>

        {/* Right: Recorder + feedback */}
        <div className="space-y-4">
          {phase === "recording" && currentSentence && (
            <RecorderPanel
              onRecordingComplete={handleRecordingComplete}
              disabled={false}
            />
          )}

          {phase === "evaluating" && (
            <div className="flex items-center gap-2 text-sm text-gray-500 justify-center">
              <div className="animate-spin h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full" />
              正在评估发音...
            </div>
          )}

          {phase === "showing_score" && lastAttempt && (
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

      {/* Bottom bar: auto-flow controls + navigation */}
      <div className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex-1 max-w-md">
          <ProgressBar current={currentIndex + 1} total={total} />
        </div>

        <div className="flex items-center gap-3 flex-wrap justify-center">
          {/* Auto-flow toggle + fallback controls */}
          <button
            onClick={() => setAutoFlow((a) => !a)}
            className={`px-3 py-2 rounded-lg text-sm font-medium ${
              autoFlow
                ? "bg-green-100 text-green-700"
                : "bg-gray-100 text-gray-600"
            }`}
          >
            {autoFlow ? "⏸ 暂停自动" : "▶ 开启自动"}
          </button>

          <button
            onClick={handleReRecord}
            disabled={phase !== "showing_score"}
            className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
          >
            🔁 重录
          </button>

          <button
            onClick={() => setReplayKey((k) => k + 1)}
            className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm"
          >
            ▶ 重播
          </button>

          <button
            onClick={() => goToSentence(currentIndex - 1)}
            disabled={currentIndex === 0}
            className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
          >
            ⏮
          </button>

          {currentIndex < total - 1 ? (
            <button
              onClick={() => goToSentence(currentIndex + 1)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
            >
              下一句 ⏭
            </button>
          ) : (
            <button
              onClick={handleComplete}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium text-sm"
            >
              完成 ✓
            </button>
          )}
        </div>
      </div>
    </main>
  );
}

function phaseLabel(phase: Phase): string {
  switch (phase) {
    case "playing":
      return "播放中";
    case "recording":
      return "录音中";
    case "evaluating":
      return "评估中";
    case "showing_score":
      return "查看分数";
    default:
      return "";
  }
}
```

- [ ] **Step 2: Build to verify types**

Run: `cd frontend && npm run build`
Expected: Build succeeds with no TypeScript errors.

- [ ] **Step 3: Commit**

```bash
cd frontend && git add "src/app/practice/[id]/page.tsx"
git commit -m "feat: auto-flow state machine + fallback controls in practice page"
```

---

## Self-Review

**Spec coverage:**
- 双轨播放器（iframe 静音 + audio 主控）：Task 5 ✓
- 状态机 playing→recording→evaluating→showing_score→next：Task 7 ✓
- VAD 静音 1.5s + 30s 兜底：Task 6 ✓
- 后端 audio serve：Task 3 ✓
- Material audio_filename + 迁移：Task 1 ✓
- process_video 保存 audio_filename：Task 2 ✓
- BFF audio 代理：Task 4 ✓
- 兜底控制（暂停/重录/重播/上一句/下一句）：Task 7 ✓
- 分数 3s 自动下一句：Task 7 ✓
- 末句自动完成：Task 7 ✓

**Placeholder scan:** 无 TBD/TODO，所有 step 含完整代码。

**Type consistency:**
- `VideoPlayer` props: `audioSrc`, `onAudioEnded` 在 Task 5 定义，Task 7 使用一致 ✓
- `useRecorder` 返回 `{start, stop, ...}` 签名不变，Task 6 保留 ✓
- `submitAttempt(sessionId, blob, idx, referenceText)` Task 7 调用与 P0 定义一致 ✓
- `Material.audio_filename` Task 1 定义，Task 2/3 使用一致 ✓

---

## 执行选择

计划已保存到 `docs/superpowers/plans/2026-07-20-p1-shadowing-flow.md`。沿用 P0 的 Subagent-Driven 方式（因环境 subagent 只读，由主 agent 直接 TDD 执行）。提交计划后开始执行。
