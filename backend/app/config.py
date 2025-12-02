from pydantic_settings import BaseSettings
from functools import lru_cache
from pathlib import Path


class Settings(BaseSettings):
    # Deepgram - STT
    deepgram_api_key: str = ""

    # Cartesia - TTS
    cartesia_api_key: str = ""
    cartesia_voice_id: str = "a0e99841-438c-4a64-b679-ae501e7d6091"

    # LLM (OpenAI or Groq)
    openai_api_key: str = ""
    openai_model: str = "gpt-5-mini"
    groq_api_key: str = ""
    groq_model: str = "llama-3.3-70b-versatile"
    llm_provider: str = "openai"  # "openai" or "groq"

    # Server settings
    storage_path: str = "./storage"
    host: str = "0.0.0.0"
    port: int = 8000
    frontend_url: str = "http://localhost:3000"  # Frontend URL for session links

    # Audio settings
    audio_in_sample_rate: int = 16000
    audio_out_sample_rate: int = 24000

    model_config = {
        "env_file": ".env",
        "env_file_encoding": "utf-8",
        "extra": "ignore"
    }

    def ensure_storage_dirs(self):
        """Create storage directories if they don't exist."""
        base = Path(self.storage_path)
        (base / "assets").mkdir(parents=True, exist_ok=True)
        (base / "sessions").mkdir(parents=True, exist_ok=True)


@lru_cache()
def get_settings() -> Settings:
    return Settings()
