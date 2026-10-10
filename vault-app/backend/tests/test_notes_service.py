"""Integration tests for NoteService: CRUD, hierarchy, cycle detection, concurrency."""

import pytest
from app.models.note import NoteCreateRequest, NoteMoveRequest, NoteUpdateRequest


def test_note_crud_and_indexing(test_container):
    svc = test_container.note_service
    
    # 1. Create root note
    note1 = svc.create_note(
        NoteCreateRequest(
            title="Root Concept",
            content="# Root Concept\nThis is the root note with [[Child Concept]].",
            tags=["core", "architecture"],
            note_type="concept",
        )
    )
    assert note1.metadata.title == "Root Concept"
    assert note1.metadata.id.startswith("node_")
    
    # Verify file created on disk
    file_path = test_container.vault.root_path / note1.file_path
    assert file_path.exists()

    # 2. Create child note
    note2 = svc.create_note(
        NoteCreateRequest(
            title="Child Concept",
            content="# Child Concept\nLinked back to [[Root Concept]].",
            parent_id=note1.metadata.id,
            tags=["child"],
            note_type="concept",
        )
    )
    assert note2.metadata.parent_id == note1.metadata.id

    # 3. Fetch summaries
    summaries = svc.get_all_notes_summary()
    assert len(summaries) == 2

    # 4. Fetch tree
    tree = svc.get_hierarchy_tree()
    assert len(tree) == 1
    assert tree[0].id == note1.metadata.id
    assert len(tree[0].children) == 1
    assert tree[0].children[0].id == note2.metadata.id


def test_cycle_prevention(test_container):
    svc = test_container.note_service
    
    # Create Node A -> Node B -> Node C
    node_a = svc.create_note(NoteCreateRequest(title="Node A"))
    node_b = svc.create_note(NoteCreateRequest(title="Node B", parent_id=node_a.metadata.id))
    node_c = svc.create_note(NoteCreateRequest(title="Node C", parent_id=node_b.metadata.id))

    # Attempt to make Node A a child of Node C (creating cycle A -> B -> C -> A)
    with pytest.raises(ValueError, match="descendant"):
        svc.move_note(node_a.metadata.id, NoteMoveRequest(new_parent_id=node_c.metadata.id))


def test_concurrency_conflict_protection(test_container):
    svc = test_container.note_service
    note = svc.create_note(NoteCreateRequest(title="Concurrency Test", content="Original content"))

    initial_hash = note.metadata.content_hash
    
    # Successful update with matching hash
    updated = svc.update_note(
        note.metadata.id,
        NoteUpdateRequest(content="Modified content", expected_hash=initial_hash),
    )
    assert updated.metadata.content_hash != initial_hash

    # Stale update with old hash must raise Conflict ValueError
    with pytest.raises(ValueError, match="Conflict detected"):
        svc.update_note(
            note.metadata.id,
            NoteUpdateRequest(content="Stale overwrite attempt", expected_hash=initial_hash),
        )


def test_delete_note_safe_child_reparenting(test_container):
    svc = test_container.note_service
    
    parent = svc.create_note(NoteCreateRequest(title="Parent"))
    middle = svc.create_note(NoteCreateRequest(title="Middle", parent_id=parent.metadata.id))
    child = svc.create_note(NoteCreateRequest(title="Child", parent_id=middle.metadata.id))

    # Delete 'middle' note
    svc.delete_note(middle.metadata.id)

    # Verify 'child' is now reparented to 'parent'
    reloaded_child = svc.get_note_by_id(child.metadata.id)
    assert reloaded_child.metadata.parent_id == parent.metadata.id
