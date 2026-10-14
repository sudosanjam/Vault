"""Export service for PDF, HTML, Markdown, JSON, and ZIP packages across Single, Subtree, and Vault scopes."""

import base64
from datetime import datetime, timezone
import json
import mimetypes
from pathlib import Path
import re
import shutil
import tempfile
from typing import Any, Dict, List, Optional, Set, Tuple
import zipfile

import markdown
from jinja2 import Template

try:
    from playwright.sync_api import sync_playwright
except (ImportError, Exception):
    sync_playwright = None

from app.core.frontmatter import parse_note_content
from app.core.links import extract_attachment_paths, extract_internal_links
from app.core.vault import VaultManager, sanitize_filename
from app.db.database import Database
from app.models.export import (
    ExportFormat,
    ExportPreview,
    ExportRequest,
    ExportResult,
    ExportScope,
    ExternalLinkPolicy,
)
from app.models.note import Note


PDF_HTML_TEMPLATE = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>{{ title }}</title>
<style>
  @page {
    size: A4;
    margin: 20mm 15mm 20mm 15mm;
    @bottom-right {
      content: counter(page);
    }
  }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    line-height: 1.6;
    color: #1a202c;
    background: #fff;
    margin: 0;
    padding: 0;
  }
  .cover {
    text-align: center;
    padding: 60px 20px 40px;
    border-bottom: 2px solid #e2e8f0;
    margin-bottom: 40px;
  }
  .cover h1 {
    font-size: 32px;
    margin: 0 0 10px;
    color: #0f172a;
  }
  .cover .subtitle {
    font-size: 16px;
    color: #64748b;
    margin: 0 0 20px;
  }
  .cover .meta {
    font-size: 12px;
    color: #94a3b8;
  }
  .toc {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 20px;
    margin-bottom: 40px;
    page-break-after: always;
  }
  .toc h2 {
    margin-top: 0;
    font-size: 18px;
    color: #334155;
    border-bottom: 1px solid #cbd5e1;
    padding-bottom: 8px;
  }
  .toc ul {
    list-style-type: none;
    padding-left: 0;
    margin: 0;
  }
  .toc li {
    padding: 4px 0;
    font-size: 14px;
  }
  .toc a {
    color: #2563eb;
    text-decoration: none;
  }
  .note-section {
    margin-bottom: 50px;
    page-break-inside: auto;
  }
  .note-header {
    border-bottom: 2px solid #3b82f6;
    padding-bottom: 8px;
    margin-bottom: 20px;
    page-break-after: avoid;
  }
  .note-header h2 {
    font-size: 24px;
    color: #1e293b;
    margin: 0 0 6px;
  }
  .note-tags {
    margin-bottom: 12px;
  }
  .badge {
    display: inline-block;
    background: #e2e8f0;
    color: #475569;
    border-radius: 4px;
    padding: 2px 8px;
    font-size: 11px;
    font-weight: 600;
    margin-right: 4px;
  }
  h1, h2, h3, h4, h5, h6 {
    color: #0f172a;
    page-break-after: avoid;
  }
  p {
    margin: 0 0 16px;
  }
  pre, code {
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-size: 13px;
    background: #f1f5f9;
    border-radius: 4px;
  }
  code {
    padding: 2px 5px;
    color: #0f172a;
  }
  pre {
    padding: 14px;
    overflow-x: auto;
    border: 1px solid #e2e8f0;
    page-break-inside: avoid;
  }
  blockquote {
    border-left: 4px solid #3b82f6;
    margin: 0 0 16px;
    padding: 8px 16px;
    background: #eff6ff;
    color: #1e3a8a;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    margin: 0 0 20px;
    page-break-inside: avoid;
  }
  th, td {
    border: 1px solid #cbd5e1;
    padding: 8px 12px;
    text-align: left;
    font-size: 13px;
  }
  th {
    background: #f8fafc;
    font-weight: 600;
  }
  img {
    max-width: 100%;
    height: auto;
    border-radius: 6px;
    margin: 12px 0;
    page-break-inside: avoid;
  }
  .external-ref {
    color: #64748b;
    font-style: italic;
    background: #f1f5f9;
    padding: 2px 6px;
    border-radius: 4px;
  }
</style>
</head>
<body>

<div class="cover">
  <h1>{{ title }}</h1>
  {% if author %}<div class="subtitle">Prepared by {{ author }}</div>{% endif %}
  <div class="meta">Exported from Vault • {{ export_date }} • {{ notes|length }} Notes</div>
</div>

{% if notes|length > 1 %}
<div class="toc">
  <h2>Table of Contents</h2>
  <ul>
    {% for n in notes %}
    <li><a href="#note-{{ n.id }}">{{ loop.index }}. {{ n.title }}</a></li>
    {% endfor %}
  </ul>
</div>
{% endif %}

{% for n in notes %}
<div class="note-section" id="note-{{ n.id }}">
  <div class="note-header">
    <h2>{{ n.title }}</h2>
    {% if n.tags %}
    <div class="note-tags">
      {% for t in n.tags %}<span class="badge">#{{ t }}</span>{% endfor %}
    </div>
    {% endif %}
  </div>
  <div class="note-body">
    {{ n.rendered_html | safe }}
  </div>
</div>
{% endfor %}

</body>
</html>
"""


class ExportService:
    def __init__(self, vault_mgr: VaultManager, db: Database):
        self.vault = vault_mgr
        self.db = db

    def get_scoped_notes(self, req: ExportRequest) -> List[Dict[str, Any]]:
        """Collect all notes that fall within the requested export scope."""
        target_ids: Set[str] = set()

        with self.db.get_connection() as conn:
            if req.scope == ExportScope.SINGLE:
                if req.root_id:
                    target_ids.add(req.root_id)
            elif req.scope == ExportScope.SUBTREE and req.root_id:
                target_ids.add(req.root_id)
                if req.include_descendants:
                    # BFS to find all descendants
                    frontier = {req.root_id}
                    while frontier:
                        placeholders = ",".join("?" * len(frontier))
                        rows = conn.execute(
                            f"SELECT id FROM nodes WHERE parent_id IN ({placeholders})",
                            list(frontier),
                        ).fetchall()
                        next_f = {r["id"] for r in rows if r["id"] not in target_ids}
                        target_ids.update(next_f)
                        frontier = next_f
            elif req.scope == ExportScope.SELECTION:
                target_ids.update(req.selected_ids)
            elif req.scope == ExportScope.VAULT:
                rows = conn.execute("SELECT id FROM nodes").fetchall()
                target_ids.update(r["id"] for r in rows)

            # Fetch note details
            notes_data = []
            if target_ids:
                placeholders = ",".join("?" * len(target_ids))
                cursor = conn.execute(
                    f"SELECT id, file_path, title, tags, parent_id FROM nodes WHERE id IN ({placeholders}) ORDER BY title ASC",
                    list(target_ids),
                )
                for r in cursor.fetchall():
                    abs_path = self.vault.root_path / r["file_path"]
                    if abs_path.exists():
                        content = self.vault.read_file(abs_path)
                        meta, body = parse_note_content(content, r["id"], r["title"])
                        notes_data.append(
                            {
                                "id": r["id"],
                                "title": r["title"],
                                "file_path": r["file_path"],
                                "tags": meta.tags,
                                "parent_id": meta.parent_id,
                                "metadata": meta,
                                "body": body,
                            }
                        )

        return notes_data

    def preview_export(self, req: ExportRequest) -> ExportPreview:
        """Preview number of notes, attachments, and output filename before running export."""
        notes = self.get_scoped_notes(req)
        all_att_refs: Set[str] = set()
        
        for n in notes:
            att_paths = extract_attachment_paths(n["body"])
            all_att_refs.update(att_paths)

        scope_title = req.title or (notes[0]["title"] if notes else "Vault_Export")
        clean_name = sanitize_filename(scope_title)
        out_name = f"{clean_name}.{req.format.value}"

        return ExportPreview(
            scope=req.scope,
            format=req.format,
            note_count=len(notes),
            attachment_count=len(all_att_refs),
            estimated_size_bytes=len(notes) * 2048 + len(all_att_refs) * 50000,
            note_titles=[n["title"] for n in notes],
            output_filename=out_name,
        )

    def execute_export(self, req: ExportRequest) -> ExportResult:
        """Execute the export to chosen format."""
        notes = self.get_scoped_notes(req)
        if not notes:
            raise ValueError("No notes found matching the export scope.")

        now_str = datetime.now(timezone.utc).strftime("%Y-%m-%d_%H%M%S")
        doc_title = req.title or (notes[0]["title"] if len(notes) == 1 else "Vault Export")
        safe_title = sanitize_filename(doc_title)
        
        self.vault.exports_dir.mkdir(parents=True, exist_ok=True)

        if req.format == ExportFormat.PDF:
            return self._export_pdf(notes, doc_title, req, safe_title, now_str)
        elif req.format == ExportFormat.HTML:
            return self._export_html(notes, doc_title, req, safe_title, now_str)
        elif req.format == ExportFormat.MARKDOWN:
            return self._export_markdown_zip(notes, doc_title, req, safe_title, now_str)
        elif req.format == ExportFormat.JSON:
            return self._export_json(notes, doc_title, req, safe_title, now_str)
        elif req.format == ExportFormat.ZIP:
            return self._export_markdown_zip(notes, doc_title, req, safe_title, now_str)
        else:
            raise ValueError(f"Unsupported format {req.format}")

    def _render_note_html_with_embedded_images(
        self, body: str, scoped_ids: Set[str], policy: ExternalLinkPolicy
    ) -> str:
        """Process Markdown body: replace [[links]] according to policy, convert relative images to base64 data URIs."""
        
        # 1. Resolve internal links
        def _link_replacer(m: re.Match) -> str:
            target = m.group(1).strip()
            display = m.group(3).strip() if m.group(3) else target
            
            # Check if target is inside export scope
            with self.db.get_connection() as conn:
                t_row = conn.execute("SELECT id, title FROM nodes WHERE id = ? OR LOWER(title) = LOWER(?)", (target, target)).fetchone()
                if t_row and t_row["id"] in scoped_ids:
                    return f'<a href="#note-{t_row["id"]}">{display}</a>'
                else:
                    if policy == ExternalLinkPolicy.MARK:
                        return f'<span class="external-ref">[{display} (external)]</span>'
                    return f'<span class="external-ref">{display}</span>'

        processed_body = re.sub(r"\[\[([^\]\|#]+)(?:#([^\]\|]+))?(?:\|([^\]]+))?\]\]", _link_replacer, body)

        # 2. Embed images as base64 data URIs for standalone PDF/HTML rendering
        def _img_replacer(m: re.Match) -> str:
            alt = m.group(1) or ""
            rel_path = m.group(2)
            abs_path = self.vault.root_path / rel_path
            if abs_path.exists() and abs_path.is_file():
                try:
                    mime, _ = mimetypes.guess_type(str(abs_path))
                    mime = mime or "image/png"
                    img_b64 = base64.b64encode(abs_path.read_bytes()).decode("utf-8")
                    return f"![{alt}](data:{mime};base64,{img_b64})"
                except Exception:
                    return m.group(0)
            return m.group(0)

        processed_body = re.sub(r"!\[(.*?)\]\((attachments/[^)]+)\)", _img_replacer, processed_body)

        # 3. Convert Markdown to HTML
        html = markdown.markdown(
            processed_body,
            extensions=["tables", "fenced_code", "nl2br", "sane_lists", "toc"],
        )
        return html

    def _export_pdf(
        self, notes: List[Dict[str, Any]], doc_title: str, req: ExportRequest, safe_title: str, now_str: str
    ) -> ExportResult:
        """Generate PDF using Playwright Chromium local renderer."""
        if sync_playwright is None:
            raise RuntimeError(
                "PDF export requires Playwright Chromium, which is not available in this environment (e.g. Android/Termux). "
                "Please export your notes as HTML, Markdown ZIP, or JSON bundle instead."
            )
        scoped_ids = {n["id"] for n in notes}
        
        # Prepare notes with rendered HTML
        for n in notes:
            n["rendered_html"] = self._render_note_html_with_embedded_images(
                n["body"], scoped_ids, req.external_link_policy
            )

        template = Template(PDF_HTML_TEMPLATE)
        full_html = template.render(
            title=doc_title,
            author=req.author,
            export_date=datetime.now(timezone.utc).strftime("%B %d, %Y"),
            notes=notes,
        )

        out_filename = f"{safe_title}_{now_str}.pdf"
        out_path = self.vault.exports_dir / out_filename

        # Render PDF via Playwright
        with tempfile.NamedTemporaryFile("w", suffix=".html", delete=False, encoding="utf-8") as tf:
            tf.write(full_html)
            temp_html_path = tf.name

        try:
            with sync_playwright() as p:
                browser = p.chromium.launch(headless=True)
                page = browser.new_page()
                page.goto(Path(temp_html_path).as_uri())
                page.pdf(
                    path=str(out_path),
                    format="A4",
                    margin={"top": "20mm", "bottom": "20mm", "left": "15mm", "right": "15mm"},
                    print_background=True,
                )
                browser.close()
        finally:
            Path(temp_html_path).unlink(missing_ok=True)

        return ExportResult(
            filename=out_filename,
            download_url=f"/api/v1/exports/download/{out_filename}",
            file_size_bytes=out_path.stat().st_size,
            note_count=len(notes),
            attachment_count=0,
            format="pdf",
            content_type="application/pdf",
        )

    def _export_html(
        self, notes: List[Dict[str, Any]], doc_title: str, req: ExportRequest, safe_title: str, now_str: str
    ) -> ExportResult:
        """Generate standalone single-file HTML export."""
        scoped_ids = {n["id"] for n in notes}
        for n in notes:
            n["rendered_html"] = self._render_note_html_with_embedded_images(
                n["body"], scoped_ids, req.external_link_policy
            )

        template = Template(PDF_HTML_TEMPLATE)
        full_html = template.render(
            title=doc_title,
            author=req.author,
            export_date=datetime.now(timezone.utc).strftime("%B %d, %Y"),
            notes=notes,
        )

        out_filename = f"{safe_title}_{now_str}.html"
        out_path = self.vault.exports_dir / out_filename
        out_path.write_text(full_html, encoding="utf-8")

        return ExportResult(
            filename=out_filename,
            download_url=f"/api/v1/exports/download/{out_filename}",
            file_size_bytes=out_path.stat().st_size,
            note_count=len(notes),
            attachment_count=0,
            format="html",
            content_type="text/html",
        )

    def _export_json(
        self, notes: List[Dict[str, Any]], doc_title: str, req: ExportRequest, safe_title: str, now_str: str
    ) -> ExportResult:
        """Generate full JSON data export."""
        scoped_ids = {n["id"] for n in notes}
        
        # Fetch edges between scoped notes
        edges_data = []
        with self.db.get_connection() as conn:
            if scoped_ids:
                placeholders = ",".join("?" * len(scoped_ids))
                cursor = conn.execute(
                    f"SELECT source_id, target_id, relation_type, label FROM edges WHERE source_id IN ({placeholders})",
                    list(scoped_ids),
                )
                for r in cursor.fetchall():
                    edges_data.append({
                        "source_id": r["source_id"],
                        "target_id": r["target_id"],
                        "relation_type": r["relation_type"],
                        "label": r["label"],
                    })

        export_dict = {
            "vault_export_version": "1.0.0",
            "title": doc_title,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "scope": req.scope.value,
            "notes": [
                {
                    "id": n["id"],
                    "title": n["title"],
                    "parent_id": n["parent_id"],
                    "tags": n["tags"],
                    "metadata": n["metadata"].model_dump(),
                    "content": n["body"],
                }
                for n in notes
            ],
            "relationships": edges_data,
        }

        out_filename = f"{safe_title}_{now_str}.json"
        out_path = self.vault.exports_dir / out_filename
        out_path.write_text(json.dumps(export_dict, indent=2), encoding="utf-8")

        return ExportResult(
            filename=out_filename,
            download_url=f"/api/v1/exports/download/{out_filename}",
            file_size_bytes=out_path.stat().st_size,
            note_count=len(notes),
            attachment_count=0,
            format="json",
            content_type="application/json",
        )

    def _export_markdown_zip(
        self, notes: List[Dict[str, Any]], doc_title: str, req: ExportRequest, safe_title: str, now_str: str
    ) -> ExportResult:
        """Package notes and referenced attachments into portable ZIP archive."""
        out_filename = f"{safe_title}_{now_str}.zip"
        out_path = self.vault.exports_dir / out_filename

        att_files_to_pack: Set[str] = set()

        with zipfile.ZipFile(out_path, "w", zipfile.ZIP_DEFLATED) as zf:
            # Add notes
            for n in notes:
                abs_p = self.vault.root_path / n["file_path"]
                if abs_p.exists():
                    zf.write(abs_p, f"notes/{abs_p.name}")
                    # Collect referenced attachments
                    refs = extract_attachment_paths(n["body"])
                    att_files_to_pack.update(refs)

            # Add attachments if requested
            if req.include_attachments:
                for att_rel in att_files_to_pack:
                    att_abs = self.vault.root_path / att_rel
                    if att_abs.exists() and att_abs.is_file():
                        zf.write(att_abs, att_rel)

            # Write manifest
            manifest = {
                "title": doc_title,
                "exported_at": datetime.now(timezone.utc).isoformat(),
                "note_count": len(notes),
                "attachment_count": len(att_files_to_pack),
            }
            zf.writestr("export-manifest.json", json.dumps(manifest, indent=2))

        return ExportResult(
            filename=out_filename,
            download_url=f"/api/v1/exports/download/{out_filename}",
            file_size_bytes=out_path.stat().st_size,
            note_count=len(notes),
            attachment_count=len(att_files_to_pack),
            format="zip",
            content_type="application/zip",
        )
