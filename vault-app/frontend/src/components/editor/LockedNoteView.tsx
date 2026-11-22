import React, { useState } from 'react';
import { Eye, EyeOff, KeyRound, Lock, ShieldAlert } from 'lucide-react';
import { useVault } from '../../state/VaultContext';
import { decryptNoteContent, hashPassword } from '../../utils/crypto';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';

export const LockedNoteView: React.FC = () => {
  const { activeNote, unlockNoteInSession } = useVault();
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  if (!activeNote) return null;

  const handleUnlock = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!password) {
      setError('Please enter the password.');
      return;
    }

    setIsVerifying(true);
    setError(null);

    const salt = activeNote.metadata.custom_properties?.lock_salt;
    const expectedHash = activeNote.metadata.custom_properties?.lock_hash;

    try {
      if (!salt) {
        throw new Error('Missing encryption salt.');
      }

      // Fast check with salt hash if present
      if (expectedHash) {
        const computedHash = await hashPassword(password, salt);
        if (computedHash !== expectedHash) {
          throw new Error('Incorrect password.');
        }
      }

      // Decrypt the note content
      const decrypted = await decryptNoteContent(activeNote.content, password, salt);
      unlockNoteInSession(activeNote.metadata.id, password, decrypted);
    } catch (err: any) {
      setError(err.message || 'Incorrect password.');
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 bg-vault-50/50 dark:bg-vault-950/80 select-none">
      <div className="w-full max-w-md p-8 bg-white dark:bg-vault-900 border border-vault-200 dark:border-vault-800 rounded-2xl shadow-2xl text-center space-y-6">
        {/* Padlock Icon */}
        <div className="w-16 h-16 mx-auto rounded-2xl bg-indigo-500/10 dark:bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
          <Lock size={32} />
        </div>

        {/* Note Title & Info */}
        <div className="space-y-1.5">
          <Badge variant="primary" size="sm">
            {activeNote.metadata.note_type}
          </Badge>
          <h2 className="text-xl font-bold text-vault-900 dark:text-vault-100 truncate">
            {activeNote.metadata.title}
          </h2>
          <p className="text-xs text-vault-500 dark:text-vault-400">
            This note is encrypted and password-protected.
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="p-2.5 bg-red-500/10 border border-red-500/30 rounded-lg text-red-500 text-xs flex items-center justify-center gap-2 text-left">
            <ShieldAlert size={15} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Password Form */}
        <form onSubmit={handleUnlock} className="space-y-4">
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Enter password to unlock..."
              className="w-full px-3.5 py-2.5 text-xs bg-vault-50 dark:bg-vault-950 border border-vault-200 dark:border-vault-700 rounded-xl text-vault-900 dark:text-vault-100 pr-10 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              autoFocus
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-vault-400 hover:text-vault-600 dark:hover:text-vault-200"
            >
              {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>

          <Button
            type="submit"
            variant="primary"
            className="w-full py-2.5 rounded-xl font-medium flex items-center justify-center gap-2"
            disabled={isVerifying}
          >
            <KeyRound size={14} />
            {isVerifying ? 'Decrypting...' : 'Unlock Note'}
          </Button>
        </form>

        <p className="text-[10px] text-vault-400 dark:text-vault-500">
          Encrypted with zero-knowledge AES-256-GCM.
        </p>
      </div>
    </div>
  );
};
