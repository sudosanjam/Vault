"""Tests for YAML frontmatter parsing and serialization."""

from app.core.frontmatter import compute_content_hash, parse_note_content, serialize_note_content
from app.models.note import NoteMetadata, NoteRelation


def test_frontmatter_roundtrip():
    meta = NoteMetadata(
        id="note_test_1",
        title="Testing Frontmatter",
        created_at="2026-10-10T12:00:00Z",
        modified_at="2026-10-10T12:00:00Z",
        parent_id="note_parent_0",
        tags=["python", "vault"],
        aliases=["Test FM"],
        note_type="concept",
        relations=[NoteRelation(target_id="note_target_9", type="depends_on", label="Depends on target 9")],
        custom_properties={"status": "done", "priority": "p1"},
    )
    body = "# Testing Frontmatter\n\nThis is the markdown body.\n- Item 1\n- Item 2"
    serialized = serialize_note_content(meta, body)
    
    parsed_meta, parsed_body = parse_note_content(serialized, "fallback_id", "fallback_title")
    
    assert parsed_meta.id == "note_test_1"
    assert parsed_meta.title == "Testing Frontmatter"
    assert parsed_meta.parent_id == "note_parent_0"
    assert parsed_meta.tags == ["python", "vault"]
    assert parsed_meta.aliases == ["Test FM"]
    assert parsed_meta.note_type == "concept"
    assert len(parsed_meta.relations) == 1
    assert parsed_meta.relations[0].target_id == "note_target_9"
    assert parsed_meta.relations[0].type == "depends_on"
    assert parsed_meta.custom_properties.get("status") == "done"
    assert parsed_body.startswith("# Testing Frontmatter")


def test_missing_frontmatter_fallback():
    raw_content = "# Raw Note\n\nJust markdown without frontmatter."
    meta, body = parse_note_content(raw_content, default_id="fallback_id", default_title="Fallback Title")
    
    assert meta.id == "fallback_id"
    assert meta.title == "Fallback Title"
    assert meta.parent_id is None
    assert meta.tags == []
    assert body.startswith("# Raw Note")


def test_content_hash():
    text1 = "Hello Vault"
    text2 = "Hello Vault"
    text3 = "Hello Vault Modified"
    
    assert compute_content_hash(text1) == compute_content_hash(text2)
    assert compute_content_hash(text1) != compute_content_hash(text3)
