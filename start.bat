@echo off
setlocal enabledelayedexpansion

:: Check command line arguments
if "%~1"=="" goto interactive
if "%~1"=="setup" goto setup
if "%~1"=="wipe" goto wipe
if "%~1"=="download-models" goto download_models
if "%~1"=="start" goto start_docker
if "%~1"=="stop" goto stop_docker
if "%~1"=="logs" goto logs_docker
if "%~1"=="status" goto status_docker
if "%~1"=="restart" goto restart_docker

echo Usage: %0 [setup^|wipe^|download-models^|start^|stop^|restart^|logs^|status]
echo Without arguments, starts the interactive menu.
exit /b 1

:setup
echo ⚙️ Running first-time project setup for Windows...

:: 1. Check/Install Git
where git >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo ⚠️ Git is not installed. Attempting to install Git via winget...
    winget install --id Git.Git -e --source winget
    if %ERRORLEVEL% neq 0 (
        echo ❌ Error: Failed to install Git automatically. Please install Git manually from https://git-scm.com/ and restart this command.
        exit /b 1
    )
    :: Refresh path variables
    set "PATH=%PATH%;%ProgramFiles%\Git\cmd"
) else (
    echo  Git is installed.
)

:: 2. Check/Install Python
where python >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo ⚠️ Python is not installed. Attempting to install Python 3.12 via winget...
    winget install --id Python.Python.3.12 -e --source winget
    if %ERRORLEVEL% neq 0 (
        echo ❌ Error: Failed to install Python automatically. Please install Python 3.12 manually from https://www.python.org/ and restart this command.
        exit /b 1
    )
    echo ⚠️ Installed Python. You might need to restart your Command Prompt or PowerShell window to make the 'python' command available.
) else (
    echo  Python is installed.
)

:: 3. Clone VieNeu-TTS
if not exist VieNeu-TTS (
    echo 📥 Cloning VieNeu-TTS from GitHub...
    git clone https://github.com/pnnbao97/VieNeu-TTS.git VieNeu-TTS
    if !ERRORLEVEL! neq 0 (
        echo ❌ Error: Failed to clone VieNeu-TTS. Please check your internet connection.
        exit /b 1
    )
) else (
    echo  VieNeu-TTS directory already exists. Pulling latest updates...
    cd VieNeu-TTS
    git pull
    cd ..
)

:: 4. Create virtual environment
if not exist venv (
    echo ⚙️ Creating Python virtual environment...
    python -m venv venv
    if !ERRORLEVEL! neq 0 (
        echo ❌ Error: Failed to create virtual environment. Ensure Python is in your PATH.
        exit /b 1
    )
)

:: 5. Activate virtual environment and install packages
call venv\Scripts\activate.bat
echo ⚙️ Installing project requirements...
pip install -r requirements.txt
if !ERRORLEVEL! neq 0 (
    echo ❌ Error: Failed to install requirements.
    exit /b 1
)

echo ⚙️ Installing VieNeu-TTS in editable mode...
pip install -e ./VieNeu-TTS
if !ERRORLEVEL! neq 0 (
    echo ❌ Error: Failed to install VieNeu-TTS package.
    exit /b 1
)

:: 6. Setup local folders and empty configurations
if not exist config.json echo {} > config.json
if not exist creds.json echo {} > creds.json

echo.
echo ==================================================
echo 🎉 Setup completed successfully!
echo.
echo You can now:
echo  1. Run 'start.bat download-models' to fetch offline weights.
echo  2. Run 'start.bat' (without arguments) to start the local or Docker server.
echo ==================================================
exit /b 0

:wipe
echo 🧹 Wiping all uploaded and generated data...
if exist venv\Scripts\python.exe (
    venv\Scripts\python.exe wipe_data.py
) else (
    python wipe_data.py
)
exit /b 0

:download_models
echo 📥 Downloading local model files (VieNeu v3 ONNX, VieNeu v3 Codec, VieNeu v2 GGUF, VieNeu v2 Codec, ASR Whisper)...
where docker >nul 2>nul
if %ERRORLEVEL% equ 0 (
    echo 🐳 Using Docker for download to ensure clean environment...
    docker run --rm ^
        -v "%cd%/downloads:/app/downloads" ^
        python:3.12-slim-bookworm ^
        bash -c "pip install --no-cache-dir huggingface_hub && ^
            echo 'Downloading VieNeu v3 Turbo ONNX models...' && ^
            HF_HUB_DISABLE_SYMLINKS_WARNING=1 huggingface-cli download pnnbao-ump/VieNeu-TTS-v3-Turbo --local-dir /app/downloads/models/vieneu/onnx && ^
            echo 'Downloading VieNeu v3 MOSS Codec models...' && ^
            HF_HUB_DISABLE_SYMLINKS_WARNING=1 huggingface-cli download OpenMOSS-Team/MOSS-Audio-Tokenizer-Nano-ONNX --local-dir /app/downloads/models/vieneu/codec && ^
            echo 'Downloading VieNeu v2 GGUF model...' && ^
            HF_HUB_DISABLE_SYMLINKS_WARNING=1 huggingface-cli download pnnbao-ump/VieNeu-TTS-v2-Turbo-GGUF vieneu-tts-v2-turbo.gguf voices.json --local-dir /app/downloads/models/vieneu/v2 && ^
            echo 'Downloading VieNeu v2 Codec models...' && ^
            HF_HUB_DISABLE_SYMLINKS_WARNING=1 huggingface-cli download pnnbao-ump/VieNeu-Codec vieneu_decoder.onnx vieneu_encoder.onnx --local-dir /app/downloads/models/vieneu/v2/codec && ^
            echo 'Downloading ASR Whisper model...' && ^
            HF_HUB_DISABLE_SYMLINKS_WARNING=1 huggingface-cli download Systran/faster-whisper-small --local-dir /app/downloads/models/asr/Systran__faster-whisper-small"
) else (
    echo ⚙️ Docker not found. Downloading via local Python virtual environment...
    if not exist venv (
        echo ⚙️ Creating virtual environment...
        python -m venv venv
    )
    call venv\Scripts\activate.bat
    pip install -q huggingface_hub
    echo Downloading VieNeu v3 Turbo ONNX models...
    set HF_HUB_DISABLE_SYMLINKS_WARNING=1
    huggingface-cli download pnnbao-ump/VieNeu-TTS-v3-Turbo --local-dir downloads/models/vieneu/onnx
    echo Downloading VieNeu v3 MOSS Codec models...
    huggingface-cli download OpenMOSS-Team/MOSS-Audio-Tokenizer-Nano-ONNX --local-dir downloads/models/vieneu/codec
    echo Downloading VieNeu v2 GGUF model...
    huggingface-cli download pnnbao-ump/VieNeu-TTS-v2-Turbo-GGUF vieneu-tts-v2-turbo.gguf voices.json --local-dir downloads/models/vieneu/v2
    echo Downloading VieNeu v2 Codec models...
    huggingface-cli download pnnbao-ump/VieNeu-Codec vieneu_decoder.onnx vieneu_encoder.onnx --local-dir downloads/models/vieneu/v2/codec
    echo Downloading ASR Whisper model...
    huggingface-cli download Systran/faster-whisper-small --local-dir downloads/models/asr/Systran__faster-whisper-small
)
echo ✅ All models downloaded successfully!
exit /b 0

:start_docker
echo 🐳 Starting TurboVideo via Docker Compose...
if not exist config.json echo {} > config.json
if not exist creds.json echo {} > creds.json
docker compose up -d --build
exit /b 0

:stop_docker
echo 🐳 Stopping TurboVideo...
docker compose down
exit /b 0

:logs_docker
echo 🐳 Showing logs (Ctrl+C to exit)...
docker compose logs -f
exit /b 0

:status_docker
echo 🐳 Container Status:
docker compose ps
exit /b 0

:restart_docker
echo 🐳 Restarting TurboVideo...
docker compose restart
exit /b 0

:interactive
echo ==================================================
echo    TurboVideo (MoneyPrinterTurbo Clone)
echo ==================================================
echo Please select how you want to run the application:
echo   [1] Run locally (Requires Python, FFmpeg, and optionally espeak-ng)
echo   [2] Run via Docker (Fully self-contained, mounts cache ^& materials)
echo ==================================================
set /p choice="Enter choice [1 or 2, default is 1]: "
if "%choice%"=="" set choice=1

if "%choice%"=="2" (
    echo 🐳 Starting application via Docker Compose...
    where docker >nul 2>nul
    if %ERRORLEVEL% neq 0 (
        echo ❌ Error: Docker is not installed or not in PATH.
        exit /b 1
    )
    if not exist config.json echo {} > config.json
    if not exist creds.json (
        echo {} > creds.json
        echo ⚠️ Note: Created empty creds.json. Replace it with your Google service account credentials for Google Cloud TTS.
    )
    docker compose up -d --build
    echo ⚡ TurboVideo is now running at http://localhost:8000
    echo ⚡ Use 'start.bat logs' to view logs, or 'start.bat stop' to stop the application.
) else (
    echo ⚙️ Starting application locally...
    if not exist venv (
        echo ⚙️ Creating virtual environment...
        python -m venv venv
    )
    call venv\Scripts\activate.bat
    echo ⚙️ Verifying dependencies from requirements.txt...
    pip install -q -r requirements.txt
    echo ⚡ Starting FastAPI application on http://localhost:8000
    echo ⚡ Open your web browser and navigate to http://localhost:8000
    echo ==================================================
    echo Press Ctrl+C to shut down the server.
    echo.
    python -m uvicorn backend.app:app --host 0.0.0.0 --port 8000 --reload
)
exit /b 0
