import pytest
from backend.utils.url_safety import validate_download_url

def test_valid_public_urls():
    # Example valid urls should pass through validation untouched
    assert validate_download_url("https://example.com/video.mp4") == "https://example.com/video.mp4"
    assert validate_download_url("http://www.google.com") == "http://www.google.com"

def test_unsupported_schemes():
    with pytest.raises(ValueError, match="Unsupported URL scheme"):
        validate_download_url("ftp://example.com/video.mp4")
    with pytest.raises(ValueError, match="Unsupported URL scheme"):
        validate_download_url("file:///etc/passwd")

def test_embedded_credentials():
    with pytest.raises(ValueError, match="URLs containing embedded credentials"):
        validate_download_url("https://user:pass@example.com/video.mp4")

def test_loopback_and_private_hostnames():
    with pytest.raises(ValueError, match="restricted"):
        validate_download_url("http://localhost/video.mp4")
    with pytest.raises(ValueError, match="restricted"):
        validate_download_url("https://127.0.0.1/video.mp4")
    with pytest.raises(ValueError, match="restricted"):
        validate_download_url("http://[::1]/video.mp4")
    with pytest.raises(ValueError, match="restricted"):
        validate_download_url("http://metadata.google.internal")

def test_private_ips():
    with pytest.raises(ValueError, match="restricted"):
        validate_download_url("http://192.168.1.1/video.mp4")
    with pytest.raises(ValueError, match="restricted"):
        validate_download_url("http://10.0.0.15/video.mp4")
    with pytest.raises(ValueError, match="restricted"):
        validate_download_url("http://172.16.0.1/video.mp4")
