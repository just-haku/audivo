"""Compatibility import surface for TTS helpers.

The implementation lives in ``backend.providers.tts`` so provider-specific
adapters stay isolated from routes.
"""

from backend.providers.tts import (  # noqa: F401
    FISH_EXPRESSION_TAGS,
    FISH_VOICES,
    GENERIC_TTS_VOICES,
    OMNIVOICE_EXPRESSION_TAGS,
    OMNIVOICE_VOICES,
    VIENEU_EXPRESSION_TAGS,
    VIENEU_V2_VOICES,
    VIENEU_V3_VOICES,
    VIENEU_VOICES,
    build_vieneu_subprocess_tasks,
    clean_for_studio,
    extract_rate_from_string,
    get_cached_output_path,
    get_optimal_workers,
    get_voice_provider,
    init_tts_client,
    is_fish_voice,
    is_generic_tts_voice,
    is_omnivoice_voice,
    is_vieneu_voice,
    list_all_available_voices,
    parse_script,
    prepare_segment_text,
    remove_punctuations,
    run_local_tts_subprocess,
    split_text_into_sentences,
    supports_ssml,
    synthesize_fish_speech,
    synthesize_generic_tts,
    synthesize_omnivoice_api,
    synthesize_segment,
)

