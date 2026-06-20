#!/bin/bash

# Exit on error
set -e

# Get workspace directory
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$DIR"

# Handle command line arguments
if [ -n "$1" ]; then
    case "$1" in
        setup)
            echo "⚙️ Running first-time project setup..."
            # Check/Install Git
            if ! command -v git &> /dev/null; then
                echo "❌ Error: git is not installed. Please install git (e.g. 'sudo apt install git') and run this again."
                exit 1
            fi
            # Clone VieNeu-TTS if missing
            if [ ! -d "VieNeu-TTS" ]; then
                echo "📥 Cloning VieNeu-TTS from GitHub..."
                git clone https://github.com/pnnbao97/VieNeu-TTS.git VieNeu-TTS
            else
                echo "⚙️ VieNeu-TTS already exists. Pulling latest updates..."
                cd VieNeu-TTS && git pull && cd ..
            fi
            # Create virtual environment
            if [ ! -d "venv" ]; then
                echo "⚙️ Creating Python virtual environment..."
                python3 -m venv venv
            fi
            source venv/bin/activate
            # Install requirements
            echo "⚙️ Installing project requirements..."
            pip install -r requirements.txt
            echo "⚙️ Installing VieNeu-TTS in editable mode..."
            pip install -e ./VieNeu-TTS
            
            if [ ! -f "config.json" ]; then echo "{}" > config.json; fi
            if [ ! -f "creds.json" ]; then echo "{}" > creds.json; fi
            echo "=================================================="
            echo "🎉 Setup completed successfully!"
            echo "You can now run './start.sh download-models' followed by './start.sh' to run the app."
            echo "=================================================="
            exit 0
            ;;
        wipe)
            echo "🧹 Wiping all uploaded and generated data..."
            python3 wipe_data.py
            exit 0
            ;;
        download-models)
            echo "📥 Downloading local model files (VieNeu v3 ONNX, VieNeu v3 Codec, VieNeu v2 GGUF, VieNeu v2 Codec, ASR Whisper)..."
            if command -v docker &> /dev/null; then
                echo "🐳 Using Docker for download to ensure clean environment..."
                docker run --rm \
                    -v "$(pwd)/downloads:/app/downloads" \
                    python:3.12-slim-bookworm \
                    bash -c "pip install --no-cache-dir huggingface_hub && \
                        echo 'Downloading VieNeu v3 Turbo ONNX models...' && \
                        HF_HUB_DISABLE_SYMLINKS_WARNING=1 huggingface-cli download pnnbao-ump/VieNeu-TTS-v3-Turbo --local-dir /app/downloads/models/vieneu/onnx && \
                        echo 'Downloading VieNeu v3 MOSS Codec models...' && \
                        HF_HUB_DISABLE_SYMLINKS_WARNING=1 huggingface-cli download OpenMOSS-Team/MOSS-Audio-Tokenizer-Nano-ONNX --local-dir /app/downloads/models/vieneu/codec && \
                        echo 'Downloading VieNeu v2 GGUF model...' && \
                        HF_HUB_DISABLE_SYMLINKS_WARNING=1 huggingface-cli download pnnbao-ump/VieNeu-TTS-v2-Turbo-GGUF vieneu-tts-v2-turbo.gguf voices.json --local-dir /app/downloads/models/vieneu/v2 && \
                        echo 'Downloading VieNeu v2 Codec models...' && \
                        HF_HUB_DISABLE_SYMLINKS_WARNING=1 huggingface-cli download pnnbao-ump/VieNeu-Codec vieneu_decoder.onnx vieneu_encoder.onnx --local-dir /app/downloads/models/vieneu/v2/codec && \
                        echo 'Downloading ASR Whisper model...' && \
                        HF_HUB_DISABLE_SYMLINKS_WARNING=1 huggingface-cli download Systran/faster-whisper-small --local-dir /app/downloads/models/asr/Systran__faster-whisper-small"
            else
                echo "⚙️ Docker not found. Downloading via local Python virtual environment..."
                if [ ! -d "venv" ]; then
                    python3 -m venv venv
                fi
                source venv/bin/activate
                pip install -q huggingface_hub
                echo 'Downloading VieNeu v3 Turbo ONNX models...'
                HF_HUB_DISABLE_SYMLINKS_WARNING=1 huggingface-cli download pnnbao-ump/VieNeu-TTS-v3-Turbo --local-dir downloads/models/vieneu/onnx
                echo 'Downloading VieNeu v3 MOSS Codec models...'
                HF_HUB_DISABLE_SYMLINKS_WARNING=1 huggingface-cli download OpenMOSS-Team/MOSS-Audio-Tokenizer-Nano-ONNX --local-dir downloads/models/vieneu/codec
                echo 'Downloading VieNeu v2 GGUF model...'
                HF_HUB_DISABLE_SYMLINKS_WARNING=1 huggingface-cli download pnnbao-ump/VieNeu-TTS-v2-Turbo-GGUF vieneu-tts-v2-turbo.gguf voices.json --local-dir downloads/models/vieneu/v2
                echo 'Downloading VieNeu v2 Codec models...'
                HF_HUB_DISABLE_SYMLINKS_WARNING=1 huggingface-cli download pnnbao-ump/VieNeu-Codec vieneu_decoder.onnx vieneu_encoder.onnx --local-dir downloads/models/vieneu/v2/codec
                echo 'Downloading ASR Whisper model...'
                HF_HUB_DISABLE_SYMLINKS_WARNING=1 huggingface-cli download Systran/faster-whisper-small --local-dir downloads/models/asr/Systran__faster-whisper-small
            fi
            echo "✅ All models downloaded successfully!"
            exit 0
            ;;
        start)
            echo "🐳 Starting TurboVideo via Docker Compose..."
            if [ ! -f "config.json" ]; then echo "{}" > config.json; fi
            if [ ! -f "creds.json" ]; then echo "{}" > creds.json; fi
            docker compose up -d --build
            exit 0
            ;;
        stop)
            echo "🐳 Stopping TurboVideo..."
            docker compose down
            exit 0
            ;;
        logs)
            echo "🐳 Showing logs (Ctrl+C to exit)..."
            docker compose logs -f
            exit 0
            ;;
        status)
            echo "🐳 Container Status:"
            docker compose ps
            exit 0
            ;;
        restart)
            echo "🐳 Restarting TurboVideo..."
            docker compose restart
            exit 0
            ;;
        *)
            echo "Usage: $0 [setup|wipe|download-models|start|stop|restart|logs|status]"
            echo "Without arguments, starts the interactive menu."
            exit 1
            ;;
    esac
fi

echo "=================================================="
echo "   TurboVideo (MoneyPrinterTurbo Clone)"
echo "=================================================="
echo "Please select how you want to run the application:"
echo "  [1] Run locally (Requires Python, FFmpeg, and optionally espeak-ng)"
echo "  [2] Run via Docker (Fully self-contained, mounts cache & materials)"
echo "=================================================="
read -p "Enter choice [1 or 2, default is 1]: " choice
choice=${choice:-1}

if [ "$choice" = "2" ]; then
    echo "🐳 Starting application via Docker Compose..."
    if ! command -v docker &> /dev/null; then
        echo "❌ Error: Docker is not installed or not in PATH."
        exit 1
    fi
    
    # Ensure config.json and creds.json exist so Docker mounts them as files, not directories
    if [ ! -f "config.json" ]; then
        echo "{}" > config.json
    fi
    if [ ! -f "creds.json" ]; then
        echo "{}" > creds.json
        echo "⚠️ Note: Created empty creds.json. Replace it with your Google service account credentials for Google Cloud TTS."
    fi
    
    # Run docker-compose in detached mode
    docker compose up -d --build
    echo "⚡ TurboVideo is now running at http://localhost:8000"
    echo "⚡ Use './start.sh logs' to view logs, or './start.sh stop' to stop the application."
else
    echo "⚙️ Starting application locally..."
    # Create virtual environment if it doesn't exist
    if [ ! -d "venv" ]; then
        echo "⚙️ Creating virtual environment..."
        python3 -m venv venv
    fi

    # Activate virtual environment
    source venv/bin/activate

    # Install / update dependencies
    echo "⚙️ Verifying dependencies from requirements.txt..."
    pip install -q -r requirements.txt

    # Start the application
    echo "⚡ Starting FastAPI application on http://localhost:8000"
    echo "⚡ Open your web browser and navigate to http://localhost:8000"
    echo "=================================================="
    echo "Press Ctrl+C to shut down the server."
    echo ""

    python3 -m uvicorn backend.app:app --host 0.0.0.0 --port 8000 --reload
fi
