export type NoteType = 'standard' | 'concept' | 'project' | 'daily' | 'journal' | 'reference' | string;

export interface NoteRelation {
  target_id: string;
  type: string; // references, depends_on, relates_to, implements, extends
  label?: string;
}

export interface NoteMetadata {
  id: string;
  title: string;
  created_at: string;
  modified_at: string;
  parent_id?: string | null;
  tags: string[];
  aliases: string[];
  note_type: NoteType;
  relations: NoteRelation[];
  custom_properties: Record<string, any>;
  content_hash?: string;
}

export interface Note {
  metadata: NoteMetadata;
  content: string;
  file_path?: string;
}

export interface NoteSummary {
  id: string;
  title: string;
  parent_id?: string | null;
  note_type: string;
  tags: string[];
  aliases: string[];
  created_at: string;
  modified_at: string;
  descendant_count: number;
  incoming_link_count: number;
  outgoing_link_count: number;
  attachment_count: number;
  file_path: string;
}

export interface TreeNode {
  id: string;
  title: string;
  parent_id?: string | null;
  note_type: string;
  tags: string[];
  descendant_count: number;
  children: TreeNode[];
}

export interface BacklinkItem {
  source_id: string;
  source_title: string;
  relation_type: string;
  label?: string;
  excerpt?: string;
}

export interface OutgoingLinkItem {
  target_id?: string | null;
  target_title: string;
  relation_type: string;
  label?: string;
  is_broken: boolean;
}

export interface GraphNode {
  id: string;
  label: string;
  title: string;
  note_type: string;
  tags: string[];
  parent_id?: string | null;
  is_orphan: boolean;
  in_degree: number;
  out_degree: number;
  x?: number;
  y?: number;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  relation_type: string;
  label?: string;
  is_broken: boolean;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
  total_nodes: number;
  total_edges: number;
}

export interface BackupSummary {
  filename: string;
  created_at: string;
  size_bytes: number;
  file_count: number;
  has_manifest: boolean;
  description?: string;
}

export interface BackupManifestFile {
  sha256: string;
  size_bytes: number;
  modified_at: string;
}

export interface BackupManifest {
  manifest_version: string;
  created_at: string;
  total_files: number;
  manifest_hash: string;
  description?: string;
  files: Record<string, BackupManifestFile>;
}

export interface CreateBackupResult {
  filename: string;
  size_bytes: number;
  total_files: number;
  created_at: string;
}

export interface RestoreBackupResult {
  status: string;
  restored_files_count: number;
  notes_restored: number;
  attachments_restored: number;
}

export type ExportScope = 'single' | 'subtree' | 'vault' | 'selection';
export type ExportFormat = 'pdf' | 'html' | 'markdown' | 'json' | 'zip';
export type ExternalLinkPolicy = 'preserve' | 'include' | 'mark';

export interface ExportRequest {
  scope: ExportScope;
  root_id?: string;
  selected_ids?: string[];
  include_descendants?: boolean;
  format: ExportFormat;
  include_attachments?: boolean;
  external_link_policy?: ExternalLinkPolicy;
  title?: string;
  author?: string;
  description?: string;
}

export interface ExportPreview {
  scope: ExportScope;
  format: ExportFormat;
  note_count: number;
  attachment_count: number;
  estimated_size_bytes: number;
  note_titles: string[];
  output_filename: string;
}

export interface ExportResult {
  filename: string;
  download_url: string;
  file_size_bytes: number;
  note_count: number;
  attachment_count: number;
  format: string;
  content_type: string;
}

export interface ImportResult {
  notes_imported: number;
  notes_updated: number;
  notes_skipped: number;
  attachments_imported: number;
  errors: string[];
}

export interface DiagnosticBrokenLink {
  source_id: string;
  source_title: string;
  target_title: string;
}

export interface DiagnosticMissingAttachment {
  note_id: string;
  note_title: string;
  filename: string;
}

export interface VaultDiagnostics {
  total_notes: number;
  total_attachments: number;
  total_size_bytes: number;
  database_size_bytes: number;
  broken_links: DiagnosticBrokenLink[];
  missing_attachments: DiagnosticMissingAttachment[];
  orphaned_attachments: string[];
}

export interface DiagnosticItem {
  status: 'ok' | 'info' | 'warn' | 'error';
  category: string;
  title: string;
  message: string;
  details?: string;
}

export interface SystemDiagnostics {
  app_name: string;
  app_version: string;
  vault_path: string;
  is_vault_accessible: boolean;
  is_vault_writable: boolean;
  note_count: number;
  attachment_count: number;
  total_attachment_bytes: number;
  broken_links_count: number;
  missing_attachments_count: number;
  orphaned_attachments_count: number;
  database_size_bytes: number;
  disk_free_bytes: number;
  pdf_renderer_available: boolean;
  pdf_renderer_name: string;
  last_backup_date?: string | null;
  backup_count: number;
  issues: DiagnosticItem[];
}

export interface VaultInfo {
  name: string;
  vault_path: string;
  note_count: number;
  attachment_count: number;
}

export type SaveStatus = 'saved' | 'saving' | 'unsaved' | 'error' | 'conflict';
export type ActiveView = 'editor' | 'preview' | 'graph' | 'table';
