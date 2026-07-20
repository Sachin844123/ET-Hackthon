import os
from pydantic_settings import BaseSettings, SettingsConfigDict
from pathlib import Path

class Settings(BaseSettings):
    # API Keys
    ANTHROPIC_API_KEY: str = "sk-ant-placeholder"
    OPENAI_API_KEY: str = "sk-openai-placeholder"
    GROQ_API_KEY: str = "gsk_placeholder"

    # Databases
    NEO4J_URI: str = "bolt://localhost:7687"
    NEO4J_USER: str = "neo4j"
    NEO4J_PASSWORD: str = "autopsy_secure_2024"
    CHROMA_PATH: str = "./chroma_db"

    # MITRE ATT&CK
    MITRE_ATTACK_STIX_PATH: str = "./data/mitre/enterprise-attack.json"

    # Security
    SECRET_KEY: str = "change_me_generate_with_openssl_rand_hex_32"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 480

    # Application Settings
    LOG_LEVEL: str = "INFO"
    DEMO_MODE: bool = True
    BLAST_RADIUS_AUTO_THRESHOLD: float = 0.3
    DATA_DIR: str = "./data/synthetic"

    # Cache Path
    CACHE_DIR: str = "./data/cache"
    AIIMS_CACHE_FILE: str = "./data/cache/aiims_result.json"
    CBSE_CACHE_FILE: str = "./data/cache/cbse_result.json"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

# Instantiate settings
settings = Settings()

# Ensure directories exist
os.makedirs(settings.CACHE_DIR, exist_ok=True)
