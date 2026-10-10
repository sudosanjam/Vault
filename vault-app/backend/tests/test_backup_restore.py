"""Integration tests for verified ZIP backup creation, checksums, and staged restoration."""

from pathlib import Path
import pytest
from app.models.backup import RestoreRequest
from app.models.note import NoteCreateRequest


def test_backup_and_restore_cycle(test_container):
    svc = test_container.note_service
    backup_svc = test_container.backup_service
    att_mgr = test_container.att_mgr

    # 1. Create test notes and attachment
    n1 = svc.create_note(NoteCreateRequest(title="Backup Note 1", content="Content 1 with [[Backup Note 2]]"))
    n2 = svc.create_note(NoteCreateRequest(title="Backup Note 2", content="Content 2"))
    att = att_mgr.save_attachment("test_doc.txt", b"Sample attachment text for backup")

    # 2. Create backup
    summary = backup_svc.create_backup("test_run")
    assert summary.is_valid is True
    assert summary.note_count >= 2
    assert summary.attachment_count >= 1
    assert summary.manifest is not None
    assert summary.filename.endswith(".zip")

    # 3. List backups
    backups = backup_svc.list_backups()
    assert len(backups) == 1
    assert backups[0].filename == summary.filename

    # 4. Modify / delete notes to test restore
    svc.delete_note(n1.metadata.id)
    assert svc.get_note_by_id(n1.metadata.id) is None

    # 5. Restore in-place
    res = backup_svc.restore_backup(
        RestoreRequest(
            backup_filename=summary.filename,
            in_place=True,
            create_pre_restore_backup=False,
        )
    )
    assert res["status"] == "success"

    # 6. Verify restored data
    restored_n1 = svc.get_note_by_id(n1.metadata.id)
    assert restored_n1 is not None
    assert restored_n1.metadata.title == "Backup Note 1"

    # Check restored attachment
    att_file = test_container.vault.root_path / att["relative_path"]
    assert att_file.exists()
    assert att_file.read_bytes() == b"Sample attachment text for backup"
