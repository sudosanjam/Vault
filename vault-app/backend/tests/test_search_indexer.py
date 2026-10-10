"""Integration tests for FTS5 full-text search, autocomplete, and derived index rebuild."""

from app.models.note import NoteCreateRequest


def test_full_text_search_and_autocomplete(test_container):
    svc = test_container.note_service
    search_svc = test_container.search_service
    indexer = test_container.indexer

    svc.create_note(
        NoteCreateRequest(
            title="Bluetooth Low Energy Security",
            content="Detailed analysis of BLE pairing algorithms, Numeric Comparison, and Elliptic Curves.",
            tags=["wireless", "ble"],
            aliases=["BLE", "BTLE"],
        )
    )
    svc.create_note(
        NoteCreateRequest(
            title="Zero Trust Architecture",
            content="Never trust, always verify every network packet and entity.",
            tags=["architecture"],
        )
    )

    # 1. Search for 'Elliptic'
    res = search_svc.search(query="Elliptic")
    assert res["total"] >= 1
    assert "Bluetooth Low Energy" in res["results"][0]["title"]
    assert "<mark>" in res["results"][0]["snippet"]

    # 2. Autocomplete for 'BLE'
    ac = search_svc.autocomplete_links(query="BLE")
    assert len(ac) >= 1
    assert "Bluetooth Low Energy Security" in [item["title"] for item in ac]

    # 3. Full index rebuild test
    rebuild_stat = indexer.rebuild_full_index()
    assert rebuild_stat["notes_indexed"] == 2

    # Re-verify search works after index wipe & rebuild
    res_after = search_svc.search(query="packet")
    assert res_after["total"] >= 1
    assert "Zero Trust" in res_after["results"][0]["title"]
