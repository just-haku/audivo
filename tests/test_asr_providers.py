import pytest
from unittest.mock import MagicMock, patch
from backend.providers.asr import normalize_asr_response, transcribe_audio

def test_normalize_asr_response_openai_verbose_json():
    # OpenAI verbose_json style response
    data = {
        "text": "Hello world.",
        "segments": [
            {"start": 0.0, "end": 1.5, "text": "Hello"},
            {"start": 1.5, "end": 3.0, "text": "world."}
        ]
    }
    
    cues = normalize_asr_response(data)
    assert len(cues) == 2
    assert cues[0]["start"] == 0.0
    assert cues[0]["end"] == 1.5
    assert cues[0]["text"] == "Hello"

def test_normalize_asr_response_simple_text():
    # Fallback to single cue if simple JSON string is returned without segments
    data = {
        "text": "Simply text transcription."
    }
    cues = normalize_asr_response(data)
    assert len(cues) == 1
    assert cues[0]["text"] == "Simply text transcription."
    assert cues[0]["start"] == 0.0
    # duration fallback is 0.0 when text-only transcription is returned
    assert cues[0]["end"] == 0.0

@patch("requests.post")
def test_transcribe_remote_openai(mock_post):
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {
        "text": "transcribed text",
        "segments": [{"start": 0.0, "end": 1.0, "text": "transcribed text"}]
    }
    mock_post.return_value = mock_response
    
    config = {
        "asr_provider": "remote_openai",
        "asr_remote_api_url": "https://api.openai.com/v1",
        "asr_remote_api_key": "fake-key",
        "asr_remote_model": "whisper-1"
    }
    
    # We pass a dummy file path (it won't actually be read because requests is mocked)
    with patch("builtins.open", MagicMock()):
        cues = transcribe_audio("dummy.mp3", config)
        assert len(cues) == 1
        assert cues[0]["text"] == "transcribed text"
        assert cues[0]["start"] == 0.0
        assert cues[0]["end"] == 1.0
