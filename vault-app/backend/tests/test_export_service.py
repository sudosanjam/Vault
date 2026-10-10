"""Tests for ExportService: PDF, HTML, Markdown, JSON, and ZIP packages across scopes."""

from pathlib import Path
from app.models.export import ExportFormat, ExportRequest, ExportScope
from app.models.note import NoteCreateRequest


def test_export_html_and_json(test_container):
    svc = test_container.note_service
    exp_svc = test_container.export_service

    n_parent = svc.create_note(NoteCreateRequest(title="Export Root", content="# Root Note\nHas child [[Export Child]]."))
    n_child = svc.create_note(NoteCreateRequest(title="Export Child", content="# Child Note", parent_id=n_parent.metadata.id))

    # 1. Export Subtree to HTML
    html_res = exp_svc.execute_export(
        ExportRequest(
            scope=ExportScope.SUBTREE,
            root_id=n_parent.metadata.id,
            format=ExportFormat.HTML,
        )
    )
    assert html_res.format == "html"
    assert html_res.note_count == 2
    html_file = test_container.vault.exports_dir / html_res.filename
    assert html_file.exists()
    html_content = html_file.read_text(encoding="utf-8")
    assert "Export Root" in html_content
    assert "Export Child" in html_content

    # 2. Export Subtree to JSON
    json_res = exp_svc.execute_export(
        ExportRequest(
            scope=ExportScope.SUBTREE,
            root_id=n_parent.metadata.id,
            format=ExportFormat.JSON,
        )
    )
    assert json_res.format == "json"
    assert json_res.note_count == 2
    json_file = test_container.vault.exports_dir / json_res.filename
    assert json_file.exists()


def test_export_pdf_playwright(test_container):
    svc = test_container.note_service
    exp_svc = test_container.export_service

    note = svc.create_note(
        NoteCreateRequest(
            title="PDF Printable Note",
            content="# PDF Report\n\nTesting local Playwright PDF rendering engine.\n\n- Key feature 1\n- Key feature 2\n\n| Item | Value |\n| :--- | :--- |\n| Alpha | 100 |",
        )
    )

    pdf_res = exp_svc.execute_export(
        ExportRequest(
            scope=ExportScope.SINGLE,
            root_id=note.metadata.id,
            format=ExportFormat.PDF,
        )
    )
    assert pdf_res.format == "pdf"
    assert pdf_res.note_count == 1
    pdf_file = test_container.vault.exports_dir / pdf_res.filename
    assert pdf_file.exists()
    assert pdf_file.stat().st_size > 1000  # Generated PDF has binary data
