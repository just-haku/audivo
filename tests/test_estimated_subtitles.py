import pytest
from backend.editor import split_estimated_sentence, build_estimated_subtitle_cues

def test_split_estimated_sentence():
    sentence = "Trần Đại Việt, một kỹ sư độc lập với đôi mắt luôn cháy lên vì những phát minh điên rồ"
    chunks = split_estimated_sentence(sentence, max_chars=40)
    
    assert len(chunks) > 1
    for chunk in chunks:
        assert len(chunk) <= 40
        assert chunk.strip() == chunk
        
    # Verify that splitting occurred at comma or conjunctions appropriately
    assert "Trần Đại Việt," in chunks[0]
    assert any("cháy" in c for c in chunks)
    assert any("điên rồ" in c for c in chunks)

def test_build_estimated_subtitle_cues():
    segments = [
        {
            "text": "Trần Đại Việt, một kỹ sư độc lập với đôi mắt luôn cháy lên vì những phát minh điên rồ",
            "duration": 5.0
        }
    ]
    style = {"max_chars": 40}
    cues = build_estimated_subtitle_cues(segments, style)
    
    assert len(cues) > 1
    total_duration = sum(cue["end"] - cue["start"] for cue in cues)
    assert pytest.approx(total_duration) == 5.0
    
    # Check that timings are increasing and valid
    assert cues[0]["start"] == 0.0
    for i in range(1, len(cues)):
        assert cues[i]["start"] == cues[i-1]["end"]
