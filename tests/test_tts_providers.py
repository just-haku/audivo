import pytest
from unittest.mock import MagicMock, patch
from backend.providers.tts import (
    get_voice_provider, parse_script, synthesize_fish_speech,
    synthesize_openai_speech, synthesize_omnivoice_api, synthesize_generic_tts
)

def test_get_voice_provider():
    # VieNeu voices
    assert get_voice_provider("Ngọc Linh") == "vieneu"
    assert get_voice_provider("Gia Bảo") == "vieneu"
    
    # Fish speech voices
    assert get_voice_provider("Fish-Speech (Default)") == "fish"
    
    # Omni voices
    assert get_voice_provider("OmniVoice (Designed)") == "omnivoice"
    
    # Generic OpenAI-like TTS
    assert get_voice_provider("Generic API TTS") == "generic"
    
    # Default fallback is google
    assert get_voice_provider("en-US-Neural2-F") == "google"

def test_parse_script_plain_text():
    script = "Hello world. This is a sentence. And another."
    segments = parse_script(script, default_voice="en-US-Neural2-F")
    
    assert len(segments) == 3
    assert segments[0]["text"] == "Hello world."
    assert segments[0]["voice_name"] == "en-US-Neural2-F"
    assert segments[1]["text"] == "This is a sentence."

def test_parse_script_xml_blocks():
    script = """
    <voice name="Ngọc Linh"><speak><prosody rate="100%">Chào bạn.</prosody></speak></voice>
    <voice name="en-US-Neural2-F"><speak><prosody rate="100%">Hello back.</prosody></speak></voice>
    """
    segments = parse_script(script, default_voice="en-US-Neural2-F")
    assert len(segments) == 2
    assert segments[0]["text"] == "Chào bạn."
    assert segments[0]["voice_name"] == "Ngọc Linh"
    assert segments[1]["text"] == "Hello back."
    assert segments[1]["voice_name"] == "en-US-Neural2-F"

@patch("requests.post")
def test_synthesize_fish_speech(mock_post):
    # Setup mock response
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.content = b"fake-audio-bytes"
    mock_post.return_value = mock_response
    
    config = {
        "fish_speech_api_url": "http://fish-api",
        "fish_speech_api_key": "fake-key",
        "fish_speech_ref_audio": "",
        "fish_speech_request_format": "msgpack"
    }
    
    # Mock ormsgpack to avoid real pack/unpack if optional
    with patch("ormsgpack.packb", return_value=b"packed"):
        res = synthesize_fish_speech("hello", "Fish-Speech (Default)", 1.0, config)
        assert res == b"fake-audio-bytes"
        mock_post.assert_called_once()

@patch("requests.post")
def test_synthesize_openai_speech(mock_post):
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.content = b"fake-mp3-bytes"
    mock_post.return_value = mock_response
    
    res = synthesize_openai_speech(
        text="hello",
        url="https://api.openai.com/v1/audio/speech",
        api_key="fake-key",
        model="tts-1",
        voice="alloy",
        rate=1.0
    )
    assert res == b"fake-mp3-bytes"

@patch("requests.post")
def test_synthesize_omnivoice_api(mock_post):
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.content = b"fake-omni-bytes"
    mock_post.return_value = mock_response
    
    config = {
        "omnivoice_api_url": "http://omni-api",
        "omnivoice_instruct": "female",
        "omnivoice_ref_audio": ""
    }
    
    res = synthesize_omnivoice_api("hello", "omni:voice", 1.0, config)
    assert res == b"fake-omni-bytes"

@patch("requests.post")
def test_synthesize_generic_tts(mock_post):
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.content = b"fake-generic-bytes"
    mock_post.return_value = mock_response
    
    config = {
        "generic_tts_api_url": "http://generic-api",
        "generic_tts_api_key": "fake-key",
        "generic_tts_model": "tts-1",
        "generic_tts_voice": "alloy"
    }
    
    res = synthesize_generic_tts("hello", "generic:alloy", 1.0, config)
    assert res == b"fake-generic-bytes"


@patch("subprocess.Popen")
@patch("backend.config.load_config")
def test_run_local_tts_subprocess_path_resolution(mock_load_config, mock_popen):
    import os
    import tempfile
    import json
    
    mock_load_config.return_value = {
        "vieneu_onnx_dir": "",
        "vieneu_codec_dir": "",
        "vieneu_mode": "local",
        "vieneu_hf_offline": True,
    }
    
    mock_process = MagicMock()
    mock_process.returncode = 0
    mock_process.stdout = []
    
    task_data_written = {}
    def popen_side_effect(args, *a, **kw):
        nonlocal task_data_written
        task_json_path = args[3]
        with open(task_json_path, "r", encoding="utf-8") as f:
            task_data_written.update(json.load(f))
        return mock_process
    
    mock_popen.side_effect = popen_side_effect
    
    with tempfile.TemporaryDirectory() as tmpdir:
        models_dir = os.path.join(tmpdir, "downloads", "models")
        os.makedirs(os.path.join(models_dir, "vieneu", "onnx", "onnx"), exist_ok=True)
        os.makedirs(os.path.join(models_dir, "vieneu", "codec"), exist_ok=True)
        
        with open(os.path.join(models_dir, "vieneu", "onnx", "onnx", "acoustic.onnx"), "w") as f:
            f.write("fake")
            
        with open(os.path.join(models_dir, "vieneu", "codec", "codec.onnx"), "w") as f:
            f.write("fake")
            
        from backend.providers.tts import run_local_tts_subprocess
        
        # Patch MODELS_DIR inside backend.config
        with patch("backend.config.MODELS_DIR", models_dir):
            run_local_tts_subprocess(
                segments=[{"text": "test", "voice_name": "Ngọc Linh", "output_path": "out.wav"}],
                version="v3",
                cpu_threads=4,
                cache_dir=tmpdir
            )
            
        mock_popen.assert_called_once()
        args = mock_popen.call_args[0][0]
        assert "python3" in args[0]
        assert "tts_subprocess.py" in args[2]
        
        assert task_data_written["vieneu_onnx_dir"] == os.path.join(models_dir, "vieneu", "onnx", "onnx")
        assert task_data_written["vieneu_codec_dir"] == os.path.join(models_dir, "vieneu", "codec")

