import pytest
from backend.utils.redact import redact_config, redact_log_line

def test_redact_config():
    config = {
        "pexels_api_keys": ["12345", "67890"],
        "gemini_api_keys": ["secret_gemini_key"],
        "cpu_threads": 4,
        "nested": {
            "api_key": "some_api_key",
            "other_setting": "safe_value"
        },
        "safe_list": ["foo", "bar"]
    }
    
    redacted = redact_config(config)
    
    # Verify sensitive fields are redacted
    assert redacted["pexels_api_keys"] == ["***REDACTED***", "***REDACTED***"]
    assert redacted["gemini_api_keys"] == ["***REDACTED***"]
    assert redacted["cpu_threads"] == 4
    assert redacted["nested"]["api_key"] == "***REDACTED***"
    assert redacted["nested"]["other_setting"] == "safe_value"
    assert redacted["safe_list"] == ["foo", "bar"]

def test_redact_config_nested():
    config = {
        "api_key": "secret",
        "safe": "not-secret"
    }
    redacted = redact_config(config)
    assert redacted["api_key"] == "***REDACTED***"
    assert redacted["safe"] == "not-secret"

def test_redact_log_line():
    # Test OpenAI API key format
    line = "OpenAI key sk-abcdefghijklmnopqrstuvwxyz1234567890"
    assert "sk-***REDACTED***" in redact_log_line(line)
    
    # Test Authorization header
    line = "Authorization: Bearer some-long-token-value-here"
    assert "Bearer ***REDACTED***" in redact_log_line(line)
    
    # Test key value pair in logs
    line = "api_key='supersecretvalue12345'"
    assert "api_key='***REDACTED***'" in redact_log_line(line)
    
    # Test normal lines
    line = "Processing sentence 1/5"
    assert redact_log_line(line) == "Processing sentence 1/5"
