# uv 官方镜像（基于 python:3.11-bookworm-slim），自带 uv 与 CPython 3.11
FROM ghcr.io/astral-sh/uv:python3.11-bookworm-slim

# 系统依赖：ffmpeg（whisper / 音频转码需要）
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# uv 运行配置
ENV UV_LINK_MODE=copy \
    UV_COMPILE_BYTECODE=1 \
    UV_PROJECT_ENVIRONMENT=/app/.venv \
    UV_PYTHON_DOWNLOADS=never

WORKDIR /app

# 先复制依赖清单以利用 Docker 层缓存
COPY pyproject.toml uv.lock ./

# 仅安装第三方依赖（跳过项目自身与 dev 组），最大化缓存命中
RUN uv sync --frozen --no-dev --no-install-project

# 复制项目源码
COPY . .

# 安装项目自身（editable 模式）
RUN uv sync --frozen --no-dev

# 通过 uv run 启动，自动使用 .venv
CMD ["uv", "run", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
