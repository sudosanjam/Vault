import type {
  ExportPreview,
  ExportRequest,
  ExportResult,
  GraphData,
  Note,
  NoteSummary,
  TreeNode,
  ImportResult,
} from '../types';

const API_BASE = '/api/v1';

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, options);
  if (!res.ok) {
    let errorDetail = `Request failed: ${res.statusText}`;
    try {
      const err = await res.json();
      if (err.detail) errorDetail = err.detail;
    } catch (_) {}
    throw new Error(errorDetail);
  }
  if (res.status === 204) {
    return null as unknown as T;
  }
  return res.json();
}

export const api = {
  // Notes & Tree
  getNotesSummary: () => fetchJson<NoteSummary[]>(`${API_BASE}/notes`),
  getHierarchyTree: () => fetchJson<TreeNode[]>(`${API_BASE}/notes/tree`),
  getNote: (id: string) => fetchJson<Note>(`${API_BASE}/notes/${encodeURIComponent(id)}`),
  createNote: (data: {
    title: string;
    content?: string;
    parent_id?: string | null;
    tags?: string[];
    aliases?: string[];
    note_type?: string;
  }) =>
    fetchJson<Note>(`${API_BASE}/notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),
  updateNote: (
    id: string,
    data: {
      title?: string;
      content?: string;
      parent_id?: string | null;
      update_parent?: boolean;
      tags?: string[];
      aliases?: string[];
      note_type?: string;
      relations?: any[];
      custom_properties?: Record<string, any>;
      expected_hash?: string;
    }
  ) =>
    fetchJson<Note>(`${API_BASE}/notes/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),
  deleteNote: (id: string) =>
    fetchJson<void>(`${API_BASE}/notes/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  moveNote: (id: string, new_parent_id: string | null) =>
    fetchJson<Note>(`${API_BASE}/notes/${encodeURIComponent(id)}/move`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ new_parent_id }),
    }),
  getBacklinks: (id: string) => fetchJson<any[]>(`${API_BASE}/notes/${encodeURIComponent(id)}/backlinks`),
  getOutgoingLinks: (id: string) => fetchJson<any[]>(`${API_BASE}/notes/${encodeURIComponent(id)}/outgoing`),

  // Graph
  getGraph: (params?: {
    root_id?: string;
    depth?: number;
    tag?: string;
    note_type?: string;
    include_broken?: boolean;
  }) => {
    const q = new URLSearchParams();
    if (params?.root_id) q.set('root_id', params.root_id);
    if (params?.depth) q.set('depth', params.depth.toString());
    if (params?.tag) q.set('tag', params.tag);
    if (params?.note_type) q.set('note_type', params.note_type);
    if (params?.include_broken) q.set('include_broken', 'true');
    return fetchJson<GraphData>(`${API_BASE}/graph?${q.toString()}`);
  },
  saveGraphLayout: (positions: Record<string, { x: number; y: number }>) =>
    fetchJson<{ status: string }>(`${API_BASE}/graph/layout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ positions }),
    }),
  createRelationship: (
    source_id: string,
    target_id: string,
    relation_type: string = 'references',
    label?: string
  ) =>
    fetchJson<{ status: string }>(`${API_BASE}/graph/relationships`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source_id, target_id, relation_type, label }),
    }),
  deleteRelationship: (source_id: string, target_id: string, relation_type: string) =>
    fetchJson<{ status: string }>(`${API_BASE}/graph/relationships`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source_id, target_id, relation_type }),
    }),

  // Search & Autocomplete
  search: (query: string, tag?: string, note_type?: string) => {
    const q = new URLSearchParams({ q: query });
    if (tag) q.set('tag', tag);
    if (note_type) q.set('note_type', note_type);
    return fetchJson<{ results: any[]; total: number; query: string }>(`${API_BASE}/search?${q.toString()}`);
  },
  autocompleteLinks: (query: string) =>
    fetchJson<any[]>(`${API_BASE}/search/autocomplete?q=${encodeURIComponent(query)}`),

  // Attachments
  uploadAttachment: async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`${API_BASE}/attachments/upload`, {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) throw new Error('Attachment upload failed');
    return res.json();
  },
  getAttachmentFileUrl: (relPath: string) => `${API_BASE}/attachments/file/${encodeURIComponent(relPath)}`,
  getOrphanedAttachments: () => fetchJson<any[]>(`${API_BASE}/attachments/orphans`),
  cleanupOrphanedAttachments: () =>
    fetchJson<{ deleted_count: number; deleted_files: string[] }>(`${API_BASE}/attachments/cleanup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orphaned_paths: [] }),
    }),

  // Backups & Restores
  listBackups: () => fetchJson<any[]>(`${API_BASE}/backups`),
  createBackup: (data?: { description?: string; include_attachments?: boolean }) =>
    fetchJson<any>(`${API_BASE}/backups`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ custom_name: data?.description }),
    }),
  getBackupManifest: async (filename: string) => {
    const backups = await fetchJson<any[]>(`${API_BASE}/backups`);
    const found = backups.find((b: any) => b.filename === filename);
    return found?.manifest || null;
  },
  restoreBackup: (
    filename: string,
    options?: { clear_existing?: boolean; target_directory?: string }
  ) =>
    fetchJson<any>(`${API_BASE}/backups/restore`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        backup_filename: filename,
        in_place: !options?.target_directory,
        target_directory: options?.target_directory,
        create_pre_restore_backup: true,
      }),
    }),
  deleteBackup: (filename: string) =>
    fetchJson<void>(`${API_BASE}/backups/${encodeURIComponent(filename)}`, { method: 'DELETE' }),

  // Exports
  previewExport: (req: ExportRequest) =>
    fetchJson<ExportPreview>(`${API_BASE}/exports/preview`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req),
    }),
  generateExport: (req: ExportRequest) =>
    fetchJson<ExportResult>(`${API_BASE}/exports/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req),
    }),

  // Imports
  importFile: async (file: File, target_parent_id?: string, collision_policy: string = 'rename') => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('collision_policy', collision_policy);
    if (target_parent_id) formData.append('target_parent_id', target_parent_id);
    const isZip = file.name.endsWith('.zip');
    const endpoint = isZip ? `${API_BASE}/imports/zip` : `${API_BASE}/imports/file`;
    const res = await fetch(endpoint, { method: 'POST', body: formData });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Import failed' }));
      throw new Error(err.detail || 'Import failed');
    }
    const data = await res.json();
    return {
      notes_imported: data.imported_count || data.notes_imported || 1,
      notes_updated: data.notes_updated || 0,
      notes_skipped: data.skipped_count || data.notes_skipped || 0,
      attachments_imported: data.attachments_count || data.attachments_imported || 0,
      errors: data.errors || [],
    } as ImportResult;
  },
  importDirectory: async (_options: {
    source_path: string;
    target_parent_id?: string;
    collision_policy?: string;
  }) => {
    return {
      notes_imported: 0,
      notes_updated: 0,
      notes_skipped: 0,
      attachments_imported: 0,
      errors: ['Directory import is supported via ZIP upload or direct host copy to nodes/'],
    } as ImportResult;
  },

  // System
  getDiagnostics: () => fetchJson<any>(`${API_BASE}/system/diagnostics`),
  rebuildIndex: () => fetchJson<any>(`${API_BASE}/system/reindex`, { method: 'POST' }),
  getConfig: () => fetchJson<{ vault_path: string; config: any }>(`${API_BASE}/system/config`),
  updateConfig: (config: any) =>
    fetchJson<{ status: string; config: any }>(`${API_BASE}/system/config`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ config }),
    }),
  setVaultPath: (vault_path: string) =>
    fetchJson<any>(`${API_BASE}/system/switch-vault`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vault_path }),
    }),
  switchVault: (vault_path: string) =>
    fetchJson<any>(`${API_BASE}/system/switch-vault`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vault_path }),
    }),
};
