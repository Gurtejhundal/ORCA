from pathlib import Path
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

ROOT = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=ROOT / '.env', extra='ignore')
    database_url: str = ''
    demo_mode: bool = False
    frontend_url: str = 'http://127.0.0.1:3000'
    http_timeout: float = Field(8, ge=1, le=30)
    request_timeout: float = Field(35, ge=5, le=120)
    http_retries: int = Field(2, ge=0, le=3)
    cache_max_entries: int = Field(512, ge=10, le=10000)
    weather_ttl: int = Field(600, ge=1, le=3600)
    ocean_ttl: int = Field(1800, ge=1, le=7200)
    satellite_ttl: int = Field(21600, ge=1, le=86400)
    pfz_ttl: int = Field(21600, ge=1, le=86400)
    open_meteo_enabled: bool = True
    incois_erddap_enabled: bool = True
    # Trusted, locally reviewed normalized exports; never a client supplied URL.
    pfz_import_file: str = ''
    zones_import_file: str = ''

    # LLM Provider Configuration
    llm_provider: str = 'mock'
    llm_model: str = 'gemini-1.5-flash'
    llm_api_key: str = ''

    # Bhashini Indian-language Voice Configuration
    bhashini_api_key: str = ''
    bhashini_user_id: str = ''
    bhashini_base_url: str = 'https://dhruva-api.bhashini.gov.in/services/inference/pipeline'
    bhashini_pipeline_id: str = ''


settings = Settings()
