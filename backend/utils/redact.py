import re
import copy

# Sensitive keys to match (case-insensitive)
REDACT_KEYS = {
    "api_key", "api_keys", "cookie", "proxy", "token", "secret", "password", 
    "creds", "credentials", "private_key", "key"
}

# Regex to redact potential API keys/secrets in log lines
# e.g., Bearer tokens, OpenAI api key style (sk-...), hex/base64 strings > 16 chars
SECRET_PATTERNS = [
    # Authorization: Bearer <token>
    (re.compile(r'(authorization\s*:\s*bearer\s+)[a-zA-Z0-9\-\._~\+\/]+=*', re.IGNORECASE), r'\1***REDACTED***'),
    # OpenAI API Key format: sk-proj-... or sk-...
    (re.compile(r'\bsk-[a-zA-Z0-9]{20,}\b', re.IGNORECASE), 'sk-***REDACTED***'),
    # Generic hex key or base64-like keys (24-64 chars long) after an equals/colon
    (re.compile(r'(\b\w*(?:key|secret|token|password|cookie)\b\s*[:=]\s*["\']?)[a-zA-Z0-9_\-\.\+\/]{16,}(["\']?)', re.IGNORECASE), r'\1***REDACTED***\2'),
]

def redact_config(config: dict) -> dict:
    """Deep-copies config and redacts values for sensitive keys."""
    if not isinstance(config, dict):
        return config
    
    redacted = copy.deepcopy(config)
    
    def _redact_dict(d: dict):
        for k, v in d.items():
            is_sensitive = isinstance(k, str) and any(rk in k.lower() for rk in REDACT_KEYS)
            if isinstance(v, dict):
                _redact_dict(v)
            elif isinstance(v, list):
                _redact_list(v, is_sensitive)
            elif is_sensitive:
                if isinstance(v, str) and v:
                    d[k] = "***REDACTED***"
    
    def _redact_list(lst: list, parent_sensitive: bool = False):
        for i, item in enumerate(lst):
            if isinstance(item, dict):
                _redact_dict(item)
            elif isinstance(item, list):
                _redact_list(item, parent_sensitive)
            elif parent_sensitive and isinstance(item, str) and item:
                lst[i] = "***REDACTED***"
                
    _redact_dict(redacted)
    return redacted

def redact_log_line(line: str) -> str:
    """Applies regex replacements to obscure potential secrets in log lines."""
    if not isinstance(line, str):
        return line
    for pattern, repl in SECRET_PATTERNS:
        line = pattern.sub(repl, line)
    return line
