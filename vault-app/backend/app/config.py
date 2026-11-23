"""Configuration settings for Vault application."""

import json
from pathlib import Path
from typing import Any, Dict, List, Optional
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field


class Settings(BaseSettings):
    APP_NAME: str = "Vault"
    VERSION: str = "1.0.0"
    DEBUG: bool = False
    
    # Server network settings
    # Binding to 0.0.0.0 allows both loopback (127.0.0.1) and LAN (e.g. 192.168.1.x)
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    ALLOW_LAN: bool = True
    CORS_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
    ]
    
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


def get_session_file() -> Path:
    """Return path to persistent session state JSON file."""
    repo_root = Path(__file__).resolve().parent.parent.parent.parent
    return repo_root / "vault_session.json"


def load_session_state() -> Dict[str, Any]:
    """Load persistent session settings (active vault, peer URL, etc.)."""
    sf = get_session_file()
    if sf.exists():
        try:
            return json.loads(sf.read_text(encoding="utf-8"))
        except Exception:
            return {}
    return {}


def save_session_state(updates: Dict[str, Any]) -> None:
    """Persist updates to session state file."""
    try:
        sf = get_session_file()
        current = load_session_state()
        current.update(updates)
        sf.write_text(json.dumps(current, indent=2), encoding="utf-8")
    except Exception as e:
        print(f"[Vault] Could not save session state: {e}")


def get_persisted_vault_path() -> Optional[Path]:
    """Retrieve user-selected active vault directory from persistent storage."""
    state = load_session_state()
    path_str = state.get("active_vault_path")
    if path_str:
        p = Path(path_str).resolve()
        if p.exists() and p.is_dir():
            return p
    return None


def persist_active_vault_path(path: Path) -> None:
    """Store user-selected vault path so it persists across restarts."""
    save_session_state({"active_vault_path": str(path.resolve())})


def get_default_vault_path() -> Path:
    """Determine the default active vault path."""
    # 1. Environment variable override
    if settings.VAULT_PATH:
        p = Path(settings.VAULT_PATH).resolve()
        return p
    
    # 2. Persisted active vault from prior switch
    persisted = get_persisted_vault_path()
    if persisted:
        return persisted
    
    # 3. Look for VaultSample relative to repository
    backend_dir = Path(__file__).resolve().parent.parent
    sample_vault = backend_dir.parent.parent / "VaultSample"
    if sample_vault.exists():
        return sample_vault.resolve()
    
    # 4. Fallback to local VaultData directory
    default_vault = backend_dir.parent.parent / "VaultData"
    return default_vault.resolve()
