# UniAssist AI service (FastAPI RAG + Whisper) — image for Cloudflare Containers.
# Built and pushed by `wrangler deploy` from cloudflare/ (linux/amd64).
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    HF_HOME=/app/.hf-cache

WORKDIR /app

# OpenMP runtime for torch / CTranslate2 (faster-whisper).
RUN apt-get update \
    && apt-get install -y --no-install-recommends libgomp1 \
    && rm -rf /var/lib/apt/lists/*

# requirements.txt pulls CPU-only torch from the PyTorch index.
COPY requirements.txt .
RUN pip install -r requirements.txt

# Bake the models into the image so a cold start never downloads them.
# WHISPER_MODEL must match the runtime WHISPER_MODEL (default "base").
ARG WHISPER_MODEL=base
RUN python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('all-MiniLM-L6-v2')" \
    && python -c "from faster_whisper import WhisperModel; WhisperModel('${WHISPER_MODEL}', device='cpu', compute_type='int8')"

COPY . .

# chroma_db/ starts empty; with R2 configured it is restored from the last
# snapshot on startup and saved back after changes (kb_snapshot.py).
RUN useradd --create-home --uid 1000 app && chown -R app:app /app
USER app

EXPOSE 8000
CMD ["python", "run.py", "server"]
