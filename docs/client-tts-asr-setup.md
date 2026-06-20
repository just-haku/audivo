# Client GPU TTS and ASR Setup

VideoCreator no longer loads Fish Speech or OmniVoice locally. Run heavy TTS/ASR
services on a GPU machine and paste their API URLs into Settings.

## Fish Speech

- Run Fish Speech on the client GPU machine.
- Expose its `/v1/tts` endpoint, for example `http://CLIENT_IP:8080/v1/tts`.
- In VideoCreator Settings, set `Fish Speech API URL` and optional API key.
- Use `Fish-Speech (Default)` or `Fish-Speech (Cloned)` from the voice list.

## OmniVoice

- Run OmniVoice on the client GPU machine behind an OpenAI-compatible adapter.
- Expose `/v1/audio/speech`, for example `http://CLIENT_IP:8001/v1/audio/speech`.
- In VideoCreator Settings, set `OmniVoice API URL`.
- Use `OmniVoice (Designed)` or `OmniVoice (Cloned)` from the voice list.

## Generic API TTS

- Any OpenAI-compatible `/v1/audio/speech` service can be used.
- Configure URL, API key, model, and voice in Settings.
- Select `Generic API TTS` as the voice.

## ASR Subtitles

VideoCreator supports three subtitle timestamp modes:

- `Remote OpenAI-compatible`: send the final voiceover to `/v1/audio/transcriptions`.
- `Remote custom JSON`: send the voiceover to a custom endpoint returning segments.
- `Local/managed faster-whisper`: use a local model path or explicitly download a managed model from Settings.

No ASR model is downloaded automatically during generation.

## XiaoHongShu Downloads

The optional Docker profile can run an XHS-Downloader sidecar:

```bash
docker compose --profile xhs up -d
```

Set the sidecar URL in Settings if your image exposes a different endpoint.
Cookies/proxy may be required by XiaoHongShu and must be supplied by the user.

