-- SQLite schema for Vault derived index
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
PRAGMA foreign_keys = ON;
PRAGMA busy_timeout = 5000;

CREATE TABLE IF NOT EXISTS schema_migrations (
    version INTEGER PRIMARY KEY,
    applied_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS nodes (
    id TEXT PRIMARY KEY,
    file_path TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    parent_id TEXT,
    note_type TEXT DEFAULT 'concept',
    tags TEXT DEFAULT '[]',
    aliases TEXT DEFAULT '[]',
    custom_properties TEXT DEFAULT '{}',
    created_at TEXT NOT NULL,
    modified_at TEXT NOT NULL,
    content_hash TEXT NOT NULL,
    file_mtime REAL NOT NULL,
    descendant_count INTEGER DEFAULT 0,
    FOREIGN KEY(parent_id) REFERENCES nodes(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_nodes_parent ON nodes(parent_id);
CREATE INDEX IF NOT EXISTS idx_nodes_title ON nodes(title COLLATE NOCASE);
CREATE INDEX IF NOT EXISTS idx_nodes_type ON nodes(note_type);
CREATE INDEX IF NOT EXISTS idx_nodes_modified ON nodes(modified_at DESC);

CREATE TABLE IF NOT EXISTS edges (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_id TEXT NOT NULL,
    target_id TEXT NOT NULL,
    target_title TEXT,
    relation_type TEXT NOT NULL, -- parent_child, inline_link, references, depends_on, relates_to, implements, extends
    label TEXT,
    is_broken INTEGER DEFAULT 0,
    FOREIGN KEY(source_id) REFERENCES nodes(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_edges_source ON edges(source_id);
CREATE INDEX IF NOT EXISTS idx_edges_target ON edges(target_id);
CREATE INDEX IF NOT EXISTS idx_edges_rel_type ON edges(relation_type);

CREATE TABLE IF NOT EXISTS attachments (
    id TEXT PRIMARY KEY,
    file_path TEXT NOT NULL UNIQUE,
    original_name TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    mime_type TEXT NOT NULL,
    sha256 TEXT NOT NULL,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS attachment_refs (
    node_id TEXT NOT NULL,
    attachment_id TEXT NOT NULL,
    PRIMARY KEY (node_id, attachment_id),
    FOREIGN KEY(node_id) REFERENCES nodes(id) ON DELETE CASCADE,
    FOREIGN KEY(attachment_id) REFERENCES attachments(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_att_refs_node ON attachment_refs(node_id);
CREATE INDEX IF NOT EXISTS idx_att_refs_att ON attachment_refs(attachment_id);

-- FTS5 full-text search table
CREATE VIRTUAL TABLE IF NOT EXISTS fts_nodes USING fts5(
    id UNINDEXED,
    title,
    aliases,
    tags,
    content,
    tokenize = 'porter unicode61'
);
