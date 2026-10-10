import React, { useEffect, useState } from 'react';
import confetti from 'canvas-confetti';
import {
  Archive,
  CheckCircle2,
  Download,
  FileCode,
  FileText,
  FolderTree,
  Globe,
  Loader2,
  Package,
  Share2,
} from 'lucide-react';
import { api } from '../../api/client';
import { useVault } from '../../state/VaultContext';
import type {
  ExportFormat,
  ExportPreview,
  ExportResult,
  ExportScope,
  ExternalLinkPolicy,
} from '../../types';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Dialog } from '../ui/Dialog';

interface ExportModalProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export const ExportModal: React.FC<ExportModalProps> = ({ isOpen, onClose }) => {
  const {
    exportModalOpen,
    setExportModalOpen,
    selectedNodeId,
    activeNote,
  } = useVault();

  const isModalOpen = isOpen !== undefined ? isOpen : exportModalOpen;
  const handleClose = onClose || (() => setExportModalOpen(false));

  const [scope, setScope] = useState<ExportScope>('single');
  const [format, setFormat] = useState<ExportFormat>('pdf');
  const [includeAttachments, setIncludeAttachments] = useState(true);
  const [linkPolicy] = useState<ExternalLinkPolicy>('preserve');
  const [customTitle, setCustomTitle] = useState('');
  const [author, setAuthor] = useState('');

  const [preview, setPreview] = useState<ExportPreview | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportResult, setExportResult] = useState<ExportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isModalOpen) {
      setExportResult(null);
      setError(null);
      setCustomTitle(activeNote ? activeNote.metadata.title : 'Vault Export');
      loadPreview();
    }
  }, [isModalOpen, scope, format, includeAttachments, selectedNodeId]);

  const loadPreview = async () => {
    try {
      const prev = await api.previewExport({
        scope,
        root_id: selectedNodeId || undefined,
        format,
        include_attachments: includeAttachments,
        external_link_policy: linkPolicy,
        title: customTitle || undefined,
      });
      setPreview(prev);
    } catch (e: any) {
      console.error(e);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    setError(null);
    try {
      const res = await api.generateExport({
        scope,
        root_id: selectedNodeId || undefined,
        format,
        include_attachments: includeAttachments,
        external_link_policy: linkPolicy,
        title: customTitle || undefined,
        author: author || undefined,
      });
      setExportResult(res);
      confetti({ particleCount: 60, spread: 60, origin: { y: 0.7 } });
    } catch (e: any) {
      setError(e.message || 'Export failed');
    } finally {
      setExporting(false);
    }
  };

  return (
    <Dialog
      isOpen={isModalOpen}
      onClose={handleClose}
      title="Export & Sharing"
      description="Export single notes, hierarchical branches, or complete knowledge graphs"
      maxWidth="xl"
    >
      <div className="space-y-5 text-xs text-vault-800 dark:text-vault-200">
        {exportResult ? (
          /* Success Screen */
          <div className="text-center py-6 space-y-4">
            <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-950 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 size={28} />
            </div>
            <div>
              <h4 className="text-base font-bold text-vault-900 dark:text-vault-50">
                Export Ready!
              </h4>
              <p className="text-xs text-vault-500 mt-1">
                Generated {exportResult.note_count} notes ({Math.round(exportResult.file_size_bytes / 1024)} KB)
              </p>
            </div>

            <div className="p-3 bg-vault-100 dark:bg-vault-800 rounded-xl font-mono text-[11px] text-vault-700 dark:text-vault-300">
              {exportResult.filename}
            </div>

            <div className="flex justify-center gap-3 pt-2">
              <a
                href={exportResult.download_url}
                download
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-brand-600 hover:bg-brand-700 text-white font-medium rounded-xl shadow-md transition-all active:scale-95"
              >
                <Download size={16} />
                Download {exportResult.format.toUpperCase()}
              </a>
              <Button variant="secondary" onClick={() => setExportResult(null)}>
                Export Another
              </Button>
            </div>
          </div>
        ) : (
          /* Configuration Screen */
          <>
            {/* Scope Selection */}
            <div>
              <label className="font-semibold block mb-2 text-vault-900 dark:text-vault-100">
                1. Select Export Scope
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setScope('single')}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    scope === 'single'
                      ? 'border-brand-500 bg-brand-50/60 dark:bg-brand-950/60 ring-1 ring-brand-500 font-semibold'
                      : 'border-vault-200 dark:border-vault-800 hover:bg-vault-50 dark:hover:bg-vault-800/50'
                  }`}
                >
                  <FileText size={16} className="text-brand-500 mb-1" />
                  <div className="text-vault-900 dark:text-vault-100">Current Note</div>
                  <div className="text-[10px] text-vault-400 font-normal">
                    {activeNote ? activeNote.metadata.title : 'Selected note'}
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setScope('subtree')}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    scope === 'subtree'
                      ? 'border-brand-500 bg-brand-50/60 dark:bg-brand-950/60 ring-1 ring-brand-500 font-semibold'
                      : 'border-vault-200 dark:border-vault-800 hover:bg-vault-50 dark:hover:bg-vault-800/50'
                  }`}
                >
                  <FolderTree size={16} className="text-indigo-500 mb-1" />
                  <div className="text-vault-900 dark:text-vault-100">Note + Descendants</div>
                  <div className="text-[10px] text-vault-400 font-normal">
                    Entire hierarchy branch
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setScope('vault')}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    scope === 'vault'
                      ? 'border-brand-500 bg-brand-50/60 dark:bg-brand-950/60 ring-1 ring-brand-500 font-semibold'
                      : 'border-vault-200 dark:border-vault-800 hover:bg-vault-50 dark:hover:bg-vault-800/50'
                  }`}
                >
                  <Package size={16} className="text-emerald-500 mb-1" />
                  <div className="text-vault-900 dark:text-vault-100">Entire Vault</div>
                  <div className="text-[10px] text-vault-400 font-normal">All notes & assets</div>
                </button>
              </div>
            </div>

            {/* Format Selection */}
            <div>
              <label className="font-semibold block mb-2 text-vault-900 dark:text-vault-100">
                2. Choose Format
              </label>
              <div className="grid grid-cols-5 gap-2">
                {[
                  { id: 'pdf', label: 'PDF', icon: FileText, desc: 'Printable' },
                  { id: 'html', label: 'HTML', icon: Globe, desc: 'Web Page' },
                  { id: 'markdown', label: 'Markdown', icon: FileCode, desc: 'Portable MD' },
                  { id: 'json', label: 'JSON', icon: Share2, desc: 'Data Graph' },
                  { id: 'zip', label: 'ZIP Package', icon: Archive, desc: 'Bundle' },
                ].map(fmt => {
                  const Icon = fmt.icon;
                  const isSelected = format === fmt.id;
                  return (
                    <button
                      key={fmt.id}
                      type="button"
                      onClick={() => setFormat(fmt.id as ExportFormat)}
                      className={`p-2.5 rounded-xl border text-center transition-all ${
                        isSelected
                          ? 'border-brand-500 bg-brand-50/60 dark:bg-brand-950/60 ring-1 ring-brand-500 font-semibold'
                          : 'border-vault-200 dark:border-vault-800 hover:bg-vault-50 dark:hover:bg-vault-800/50'
                      }`}
                    >
                      <Icon size={16} className="mx-auto mb-1 text-brand-500" />
                      <div className="text-vault-900 dark:text-vault-100">{fmt.label}</div>
                      <div className="text-[9px] text-vault-400 font-normal">{fmt.desc}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Options */}
            <div className="grid grid-cols-2 gap-3 pt-2">
              <div>
                <label className="font-semibold block mb-1">Document Title</label>
                <input
                  type="text"
                  value={customTitle}
                  onChange={e => setCustomTitle(e.target.value)}
                  className="w-full px-3 py-1.5 bg-vault-50 dark:bg-vault-800 border border-vault-200 dark:border-vault-700 rounded-lg focus:outline-none"
                />
              </div>
              <div>
                <label className="font-semibold block mb-1">Author / Subtitle</label>
                <input
                  type="text"
                  placeholder="Optional author name..."
                  value={author}
                  onChange={e => setAuthor(e.target.value)}
                  className="w-full px-3 py-1.5 bg-vault-50 dark:bg-vault-800 border border-vault-200 dark:border-vault-700 rounded-lg focus:outline-none"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="exportIncludeAttachments"
                checked={includeAttachments}
                onChange={e => setIncludeAttachments(e.target.checked)}
                className="rounded border-vault-300 dark:border-vault-700 text-brand-600 focus:ring-0"
              />
              <label htmlFor="exportIncludeAttachments" className="text-xs text-vault-600 dark:text-vault-400 cursor-pointer">
                Include attachments and images in export
              </label>
            </div>

            {/* Scope Summary Preview */}
            {preview && (
              <div className="p-3 bg-vault-100 dark:bg-vault-800/70 border border-vault-200 dark:border-vault-700 rounded-xl flex items-center justify-between">
                <div>
                  <span className="font-semibold text-vault-900 dark:text-vault-100">
                    {preview.note_count} Notes
                  </span>
                  <span className="text-vault-400 mx-2">•</span>
                  <span className="text-vault-500">{preview.attachment_count} Attachments</span>
                </div>
                <Badge variant="primary" size="sm">
                  {preview.output_filename}
                </Badge>
              </div>
            )}

            {error && (
              <div className="p-3 bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 rounded-xl text-red-600 dark:text-red-300 text-xs">
                {error}
              </div>
            )}

            {/* Action buttons */}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={handleClose}>
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleExport}
                disabled={exporting}
                icon={exporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
              >
                {exporting ? 'Generating Export...' : 'Generate Export'}
              </Button>
            </div>
          </>
        )}
      </div>
    </Dialog>
  );
};
