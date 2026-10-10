"""YAML Frontmatter and Markdown parser/serializer with SHA-256 integrity hashing."""

import hashlib
import re
from typing import Any, Dict, Tuple
import yaml
from app.models.note import NoteMetadata, NoteRelation


FRONTMATTER_PATTERN = re.compile(r"^---\s*\r?\n(.*?)\r?\n---(?:\r?\n(.*))?$", re.DOTALL)


def compute_content_hash(text: str) -> str:
    """Compute SHA-256 hash of note text for concurrency protection."""
    norm = text.replace("\r\n", "\n").strip()
    return hashlib.sha256(norm.encode("utf-8")).hexdigest()


def fast_parse_yaml(yaml_text: str) -> Dict[str, Any]:
    """High performance frontmatter parser with PyYAML fallback."""
    if not yaml_text.strip():
        return {}
    
    try:
        data: Dict[str, Any] = {}
        current_list_key = None
        current_dict_list_key = None
        current_dict: Dict[str, Any] = {}

        for line in yaml_text.splitlines():
            line_str = line.rstrip()
            if not line_str or line_str.startswith("#"):
                continue

            stripped = line_str.strip()

            # Check if this line is a list item starting with '- '
            if stripped.startswith("- "):
                val_part = stripped[2:].strip()
                if ":" in val_part:
                    # Dict item in a list, e.g. `- target_id: abc`
                    if current_dict_list_key:
                        if current_dict:
                            data.setdefault(current_dict_list_key, []).append(current_dict)
                        k_sub, v_sub = val_part.split(":", 1)
                        current_dict = {k_sub.strip(): v_sub.strip().strip("'\"")}
                else:
                    # Simple list item, e.g. `- tag1`
                    if current_list_key:
                        data.setdefault(current_list_key, []).append(val_part.strip("'\""))
                continue

            # Check if this line is an indented property of current_dict (e.g. `  type: references`)
            if line_str.startswith(" ") and ":" in stripped and current_dict_list_key and current_dict:
                k_sub, v_sub = stripped.split(":", 1)
                current_dict[k_sub.strip()] = v_sub.strip().strip("'\"")
                continue

            # Flush current_dict if we encounter a new top-level key
            if current_dict_list_key and current_dict:
                data.setdefault(current_dict_list_key, []).append(current_dict)
                current_dict = {}
                current_dict_list_key = None

            # Top-level key: value
            if ":" in stripped and not line_str.startswith(" "):
                parts = stripped.split(":", 1)
                k = parts[0].strip()
                v = parts[1].strip()

                if k in ("tags", "aliases"):
                    current_list_key = k
                    current_dict_list_key = None
                    data[k] = []
                elif k == "relations":
                    current_dict_list_key = k
                    current_list_key = None
                    data[k] = []
                elif not v:
                    current_list_key = None
                    current_dict_list_key = None
                    data[k] = None
                else:
                    current_list_key = None
                    current_dict_list_key = None
                    v_clean = v.strip("'\"")
                    if v_clean.lower() in ("null", "~", ""):
                        data[k] = None
                    elif v_clean.lower() == "true":
                        data[k] = True
                    elif v_clean.lower() == "false":
                        data[k] = False
                    else:
                        data[k] = v_clean
            else:
                raise ValueError("Complex YAML structure")

        if current_dict_list_key and current_dict:
            data.setdefault(current_dict_list_key, []).append(current_dict)

        return data
    except Exception:
        return yaml.safe_load(yaml_text) or {}


def parse_note_content(raw_content: str, default_id: str, default_title: str) -> Tuple[NoteMetadata, str]:
    """
    Parse a Markdown file containing YAML frontmatter.
    Falls back gracefully if frontmatter is missing or partial.
    """
    raw_content = raw_content.strip()
    match = FRONTMATTER_PATTERN.match(raw_content)
    
    if match:
        yaml_text = match.group(1) or ""
        body = match.group(2) or ""
        try:
            data = fast_parse_yaml(yaml_text)
        except Exception:
            data = {}
    else:
        yaml_text = ""
        body = raw_content
        data = {}

    # Extract fields with safe fallbacks
    note_id = str(data.get("id") or default_id)
    title = str(data.get("title") or default_title)
    created_at = str(data.get("created_at") or "")
    modified_at = str(data.get("modified_at") or "")
    parent_id = data.get("parent_id")
    if parent_id is not None:
        parent_id = str(parent_id) if str(parent_id).strip() else None
        
    tags = data.get("tags", [])
    if isinstance(tags, str):
        tags = [t.strip() for t in tags.split(",") if t.strip()]
    elif not isinstance(tags, list):
        tags = []
    tags = [str(t) for t in tags]

    aliases = data.get("aliases", [])
    if isinstance(aliases, str):
        aliases = [a.strip() for a in aliases.split(",") if a.strip()]
    elif not isinstance(aliases, list):
        aliases = []
    aliases = [str(a) for a in aliases]

    note_type = str(data.get("note_type") or "concept")
    
    raw_relations = data.get("relations", [])
    relations = []
    if isinstance(raw_relations, list):
        for r in raw_relations:
            if isinstance(r, dict) and "target_id" in r:
                relations.append(
                    NoteRelation(
                        target_id=str(r["target_id"]),
                        type=str(r.get("type", "references")),
                        label=r.get("label"),
                    )
                )
    
    custom_props = data.get("custom_properties", {})
    if not isinstance(custom_props, dict):
        custom_props = {}

    # Also capture any arbitrary top-level fields not in standard schema
    standard_keys = {"id", "title", "created_at", "modified_at", "parent_id", "tags", "aliases", "note_type", "relations", "custom_properties", "content_hash"}
    for k, v in data.items():
        if k not in standard_keys:
            custom_props[k] = v

    content_hash = compute_content_hash(raw_content)

    from app.models.note import utc_now_iso
    meta = NoteMetadata(
        id=note_id,
        title=title,
        created_at=created_at or utc_now_iso(),
        modified_at=modified_at or utc_now_iso(),
        parent_id=parent_id,
        tags=tags,
        aliases=aliases,
        note_type=note_type,
        relations=relations,
        custom_properties=custom_props,
        content_hash=content_hash,
    )

    return meta, body.strip()


def serialize_note_content(metadata: NoteMetadata, body: str) -> str:
    """
    Serialize NoteMetadata and markdown body into clean standard YAML frontmatter + Markdown.
    """
    data: Dict[str, Any] = {
        "id": metadata.id,
        "title": metadata.title,
        "created_at": metadata.created_at,
        "modified_at": metadata.modified_at,
        "parent_id": metadata.parent_id,
        "note_type": metadata.note_type,
    }
    
    if metadata.tags:
        data["tags"] = metadata.tags
    if metadata.aliases:
        data["aliases"] = metadata.aliases
    if metadata.relations:
        data["relations"] = [r.model_dump(exclude_none=True) for r in metadata.relations]
    if metadata.custom_properties:
        data["custom_properties"] = metadata.custom_properties

    yaml_dump = yaml.dump(data, sort_keys=False, allow_unicode=True, default_flow_style=False).strip()
    return f"---\n{yaml_dump}\n---\n\n{body.strip()}\n"
