from pydantic_settings import BaseSettings
from functools import lru_cache
from pathlib import Path


class Settings(BaseSettings):
    # Deepgram - STT
    deepgram_api_key: str = ""

    # Cartesia - TTS
    cartesia_api_key: str = ""
    cartesia_voice_id: str = "a0e99841-438c-4a64-b679-ae501e7d6091"

    # Groq - LLM
    groq_api_key: str = ""

    # Server settings
    storage_path: str = "./storage"
    host: str = "0.0.0.0"
    port: int = 8000

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
