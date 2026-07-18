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
