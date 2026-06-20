import os
import requests
import google.generativeai as genai
from fastapi import HTTPException

def generate_ai_script(
    provider: str,
    model_name: str,
    topic: str,
    language: str,
    default_voice: str,
    tts_type: str,
    config: dict
) -> str:
    """
    Generates video script using selected LLM provider with key rotation fallback.
    """
    gemini_keys = config.get("gemini_api_keys", [])
    groq_keys = config.get("groq_api_keys", [])
    deepseek_keys = config.get("deepseek_api_keys", [])
    xai_keys = config.get("xai_api_keys", [])
    ollama_urls = config.get("ollama_urls", ["http://localhost:11434"])
    
    # Formulate prompts
    if tts_type == "google":
        prompt = (
            f"Write a short, engaging video script about '{topic}' in language '{language}'. "
            f"Formulate it entirely as a set of XML voice blocks conforming exactly to this schema: \n"
            f"<voice name='{default_voice}'><speak><prosody rate='94%'>[sentence 1]</prosody></speak></voice>\n"
            f"Generate 3 to 5 sentences. Output ONLY the raw XML. Do not include markdown formatting (such as ```xml or ```), markdown code blocks, or explanations."
        )
    else:
        # VieNeu-TTS mode
        prompt = (
            f"Write a short, engaging video script about '{topic}' in Vietnamese (vi-VN). "
            f"It must be raw plain text (no XML tags), but you can optionally include emotion cues like "
            f"[cười] (laughing), [thở dài] (sighing), or [hắng giọng] (throat clearing) inline where appropriate. "
            f"Generate 3 to 5 sentences. Output ONLY the raw text script. Do not include markdown formatting or explanations."
        )
        
    provider = provider.lower()
    
    if provider == "gemini":
        if not gemini_keys:
            raise HTTPException(status_code=400, detail="Gemini API Key pool is empty. Please set it in Key Manager.")
        for idx, key in enumerate(gemini_keys):
            try:
                genai.configure(api_key=key)
                model = genai.GenerativeModel(model_name or 'gemini-1.5-flash')
                response = model.generate_content(prompt)
                return response.text.strip()
            except Exception as e:
                print(f"Gemini key {idx+1} failed: {e}")
        raise HTTPException(status_code=500, detail="All Gemini keys in the pool failed.")
        
    elif provider == "groq":
        if not groq_keys:
            raise HTTPException(status_code=400, detail="Groq API Key pool is empty. Please set it in Key Manager.")
        model = model_name or "llama-3.3-70b-versatile"
        for idx, key in enumerate(groq_keys):
            try:
                res = requests.post(
                    "https://api.groq.com/openai/v1/chat/completions",
                    headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
                    json={
                        "model": model,
                        "messages": [{"role": "user", "content": prompt}],
                        "temperature": 0.7
                    },
                    timeout=20
                )
                if res.status_code == 200:
                    return res.json()["choices"][0]["message"]["content"].strip()
                else:
                    print(f"Groq key {idx+1} failed with status {res.status_code}: {res.text}")
            except Exception as e:
                print(f"Groq key {idx+1} call failed: {e}")
        raise HTTPException(status_code=500, detail="All Groq keys in the pool failed.")
        
    elif provider == "deepseek":
        if not deepseek_keys:
            raise HTTPException(status_code=400, detail="DeepSeek API Key pool is empty. Please set it in Key Manager.")
        model = model_name or "deepseek-chat"
        for idx, key in enumerate(deepseek_keys):
            try:
                res = requests.post(
                    "https://api.deepseek.com/chat/completions",
                    headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
                    json={
                        "model": model,
                        "messages": [{"role": "user", "content": prompt}],
                        "temperature": 0.7
                    },
                    timeout=20
                )
                if res.status_code == 200:
                    return res.json()["choices"][0]["message"]["content"].strip()
                else:
                    print(f"DeepSeek key {idx+1} failed with status {res.status_code}: {res.text}")
            except Exception as e:
                print(f"DeepSeek key {idx+1} call failed: {e}")
        raise HTTPException(status_code=500, detail="All DeepSeek keys in the pool failed.")
        
    elif provider == "xai":
        if not xai_keys:
            raise HTTPException(status_code=400, detail="xAI API Key pool is empty. Please set it in Key Manager.")
        model = model_name or "grok-2-1212"
        for idx, key in enumerate(xai_keys):
            try:
                res = requests.post(
                    "https://api.x.ai/v1/chat/completions",
                    headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
                    json={
                        "model": model,
                        "messages": [{"role": "user", "content": prompt}],
                        "temperature": 0.7
                    },
                    timeout=20
                )
                if res.status_code == 200:
                    return res.json()["choices"][0]["message"]["content"].strip()
                else:
                    print(f"xAI key {idx+1} failed with status {res.status_code}: {res.text}")
            except Exception as e:
                print(f"xAI key {idx+1} call failed: {e}")
        raise HTTPException(status_code=500, detail="All xAI keys in the pool failed.")
        
    elif provider == "ollama":
        model = model_name or "llama3"
        for idx, base_url in enumerate(ollama_urls):
            try:
                res = requests.post(
                    f"{base_url.rstrip('/')}/api/chat",
                    json={
                        "model": model,
                        "messages": [{"role": "user", "content": prompt}],
                        "stream": False
                    },
                    timeout=30
                )
                if res.status_code == 200:
                    return res.json()["message"]["content"].strip()
                else:
                    print(f"Ollama url {base_url} failed with status {res.status_code}")
            except Exception as e:
                print(f"Ollama url {base_url} call failed: {e}")
        raise HTTPException(status_code=500, detail="All Ollama urls in the pool failed.")
        
    else:
        raise HTTPException(status_code=400, detail=f"Unsupported LLM provider: {provider}")
