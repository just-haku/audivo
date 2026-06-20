FROM python:3.12-slim-bookworm

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV TOKENIZERS_PARALLELISM=false
ENV HF_HUB_DISABLE_IMPLICIT_TOKEN_WARNING=1
ENV VIENEU_CPU_THREADS=0
ENV VIENEU_ONNX_DIR=
ENV VIENEU_CODEC_DIR=
ENV OMP_NUM_THREADS=1
ENV MKL_NUM_THREADS=1
ENV OPENBLAS_NUM_THREADS=1
ENV ONNXRUNTIME_NUM_THREADS=1
ENV ORT_ENABLE_ALL=1

RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    git \
    build-essential \
    procps \
    fontconfig \
    fonts-dejavu-core \
    fonts-noto-core \
    fonts-noto-cjk \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements/ ./requirements/
RUN pip install --no-cache-dir -r requirements/core.txt -r requirements/tts-remote.txt

ARG INSTALL_LOCAL_ASR=false
RUN if [ "$INSTALL_LOCAL_ASR" = "true" ] ; then pip install --no-cache-dir -r requirements/local-asr.txt ; fi

ARG INSTALL_LLM_LOCAL=true
RUN if [ "$INSTALL_LLM_LOCAL" = "true" ] ; then pip install --no-cache-dir -r requirements/llm-local.txt ; fi

COPY VieNeu-TTS ./VieNeu-TTS
RUN pip install --no-cache-dir -e ./VieNeu-TTS

COPY backend ./backend
COPY frontend ./frontend
COPY bgfx ./bgfx

RUN mkdir -p \
    downloads/videos \
    downloads/music \
    downloads/generated \
    downloads/subtitles \
    downloads/fonts \
    downloads/models/asr \
    downloads/models/vieneu \
    backend/cache

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD python3 -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/api/health')"

CMD ["python3", "-m", "uvicorn", "backend.app:app", "--host", "0.0.0.0", "--port", "8000"]
