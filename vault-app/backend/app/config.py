"""Configuration settings for Vault application."""

from pathlib import Path
from typing import List, Optional
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field


class Settings(BaseSettings):
    APP_NAME: str = "Vault"
    VERSION: str = "1.0.0"
    DEBUG: bool = False
    
    # Server network settings
    HOST: str = "127.0.0.1"
    PORT: int = 8000
    ALLOW_LAN: bool = False
    CORS_ORIGINS: List[str] = ["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:8000", "http://127.0.0.1:8000"]
    
    # Path configuration
    VAULT_PATH: Optional[str] = None
    BACKUP_PATH: Optional[str] = None
    
    # Static build directory
    FRONTEND_DIST_DIR: Optional[str] = None
    
    # Attachment limits
    MAX_UPLOAD_SIZE_BYTES: int = 100 * 1024 * 1024  # 100 MB
    
    # Autosave & backup settings
    DEFAULT_AUTOSAVE_DEBOUNCE_MS: int = 2000
    DEFAULT_BACKUP_RETENTION: int = 10
    
    model_config = SettingsConfigDict(
        env_prefix="VAULT_",
        env_file=".env",
        extra="ignore"
    )


settings = Settings()


def get_default_vault_path() -> Path:
    """Determine the default active vault path."""
    if settings.VAULT_PATH:
        p = Path(settings.VAULT_PATH).resolve()
        return p
    
    # Look for VaultSample or Vault relative to repository
    backend_dir = Path(__file__).resolve().parent.parent
    sample_vault = backend_dir.parent.parent / "VaultSample"
    if sample_vault.exists():
        return sample_vault.resolve()
    
    # Fallback to local VaultData directory
    default_vault = backend_dir.parent.parent / "VaultData"
    return default_vault.resolve()
