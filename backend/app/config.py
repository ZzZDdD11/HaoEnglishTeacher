from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/shadowing"
    database_url_sync: str = "postgresql://postgres:postgres@localhost:5432/shadowing"
    redis_url: str = "redis://localhost:6379/0"
    azure_speech_key: str = ""
    azure_speech_region: str = "eastasia"
    upload_dir: str = "./data/uploads"

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()
