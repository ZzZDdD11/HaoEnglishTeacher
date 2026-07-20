from datetime import datetime

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app
from app.db.database import get_db


class FakeMaterial:
    def __init__(self, audio_filename):
        self.id = "mat-1"
        self.source_type = "youtube"
        self.source_url = "https://youtube.com/watch?v=x"
        self.title = "t"
        self.duration_seconds = 1.0
        self.transcript_json = None
        self.audio_filename = audio_filename
        self.status = "ready"
        self.created_at = datetime.utcnow()


class FakeResult:
    def __init__(self, material):
        self._material = material

    def scalar_one_or_none(self):
        return self._material


class FakeSession:
    def __init__(self, material):
        self._material = material

    async def execute(self, stmt):
        return FakeResult(self._material)

    async def close(self):
        pass


@pytest.mark.asyncio
async def test_audio_serve_success(tmp_path, monkeypatch):
    wav = tmp_path / "VID.wav"
    wav.write_bytes(b"fake-audio")

    material = FakeMaterial(audio_filename="VID.wav")
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
