import React, { useState } from 'react';
import { KeyRound, Lock, ShieldAlert, Unlock } from 'lucide-react';
import { useVault } from '../../state/VaultContext';
import { Button } from '../ui/Button';
import { Dialog } from '../ui/Dialog';

interface NoteLockModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const NoteLockModal: React.FC<NoteLockModalProps> = ({ isOpen, onClose }) => {
  const {
    activeNote,
    isNoteLocked,
    isNoteUnlockedInSession,
    lockNoteWithPassword,
    removeNotePassword,
    relockNoteInSession,
  } = useVault();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen || !activeNote) return null;

  const locked = isNoteLocked(activeNote);
  const isUnlocked = isNoteUnlockedInSession(activeNote.metadata.id);

  const handleSetLock = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!password) {
      setError('Password cannot be empty.');
      return;
    }
    if (password.length < 4) {
      setError('Password must be at least 4 characters long.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setIsSubmitting(true);
    try {
      await lockNoteWithPassword(activeNote.metadata.id, password);
      setPassword('');
      setConfirmPassword('');
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to lock note');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemoveLock = async () => {
    if (!window.confirm('Are you sure you want to remove password protection from this note? Anyone with access to this vault will be able to read it.')) {
      return;
    }

    setIsSubmitting(true);
    try {
      await removeNotePassword(activeNote.metadata.id);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to remove password');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRelockNow = async () => {
    await relockNoteInSession(activeNote.metadata.id);
    onClose();
  };

  return (
    <Dialog isOpen={isOpen} onClose={onClose} title="Note Security & Password Lock" maxWidth="md">
      <div className="space-y-4 text-xs">
        {locked ? (
          <div className="space-y-4">
            <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg text-amber-600 dark:text-amber-400 flex items-start gap-2.5">
              <Lock size={16} className="shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-sm">This note is currently password protected.</p>
                <p className="mt-1 text-[11px] opacity-90">
                  {isUnlocked
                    ? 'The note is unlocked for your current session. You can re-lock it immediately or remove password protection.'
                    : 'The note is locked and requires the password to view.'}
                </p>
              </div>
            </div>

            {isUnlocked && (
              <div className="space-y-3 pt-2">
                <div className="flex gap-2">
                  <Button
                    variant="primary"
                    className="flex-1 flex items-center justify-center gap-1.5"
                    onClick={handleRelockNow}
                  >
                    <Lock size={14} /> Re-lock Note Now
                  </Button>
                  <Button
                    variant="danger"
                    className="flex-1 flex items-center justify-center gap-1.5"
                    onClick={handleRemoveLock}
                    disabled={isSubmitting}
                  >
                    <Unlock size={14} /> Remove Password
                  </Button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <form onSubmit={handleSetLock} className="space-y-3">
            <div className="p-3 bg-indigo-500/10 border border-indigo-500/30 rounded-lg text-indigo-600 dark:text-indigo-400 flex items-start gap-2.5">
              <KeyRound size={16} className="shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-sm">Lock "{activeNote.metadata.title}"</p>
                <p className="mt-1 text-[11px] opacity-90">
                  Encrypt this note with zero-knowledge AES-256-GCM. The note content on disk will be unreadable without the password.
                </p>
              </div>
            </div>

            {error && (
              <div className="p-2.5 bg-red-500/10 border border-red-500/30 rounded text-red-500 text-xs flex items-center gap-2">
                <ShieldAlert size={14} />
                <span>{error}</span>
              </div>
            )}

            <div>
              <label className="block text-vault-700 dark:text-vault-300 font-medium mb-1">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Enter a secure password..."
                className="w-full px-3 py-1.5 text-xs bg-white dark:bg-vault-900 border border-vault-200 dark:border-vault-700 rounded-lg text-vault-900 dark:text-vault-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                autoFocus
              />
            </div>

            <div>
              <label className="block text-vault-700 dark:text-vault-300 font-medium mb-1">
                Confirm Password
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="Confirm password..."
                className="w-full px-3 py-1.5 text-xs bg-white dark:bg-vault-900 border border-vault-200 dark:border-vault-700 rounded-lg text-vault-900 dark:text-vault-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-vault-200 dark:border-vault-800">
              <Button type="button" variant="ghost" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" disabled={isSubmitting}>
                <Lock size={13} className="mr-1" />
                {isSubmitting ? 'Encrypting...' : 'Lock Note'}
              </Button>
            </div>
          </form>
        )}
      </div>
    </Dialog>
  );
};
