"""Pytest configuration and shared test fixtures with isolated temporary vaults."""

from pathlib import Path
import shutil
import tempfile
import pytest
from fastapi.testclient import TestClient

from app.api.deps import ServiceContainer
from app.core.vault import VaultManager
from app.main import app


@pytest.fixture
def temp_vault_dir():
    """Create an isolated temporary vault directory for tests."""
    temp_dir = tempfile.mkdtemp(prefix="vault_test_")
    vault_path = Path(temp_dir)
    yield vault_path
    shutil.rmtree(temp_dir, ignore_errors=True)


@pytest.fixture
def test_container(temp_vault_dir):
    """Create a fresh ServiceContainer pointing to the temporary vault."""
    container = ServiceContainer(temp_vault_dir)
    return container


@pytest.fixture
def client(temp_vault_dir):
    """FastAPI TestClient with isolated test vault."""
    ServiceContainer.reconfigure_vault_path(temp_vault_dir)
    with TestClient(app) as tc:
        yield tc
