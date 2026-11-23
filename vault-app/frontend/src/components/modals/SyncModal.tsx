import React, { useState, useEffect } from 'react';
import { api } from '../../api/client';
import { useVault } from '../../state/VaultContext';
import { Dialog } from '../ui/Dialog';
import { Button } from '../ui/Button';
import {
  Wifi,
  RefreshCw,
  Smartphone,
  Laptop,
  CheckCircle2,
  AlertTriangle,
  ArrowUpDown,
  Download,
  Upload,
  Copy,
  Check,
} from 'lucide-react';

interface DiscoveredPeer {
  ip: string;
  port: number;
  url: string;
  vault_name: string;
  version: string;
}

export const SyncModal: React.FC = () => {
  const { syncModalOpen, setSyncModalOpen, refreshVault } = useVault();

  const [myInfo, setMyInfo] = useState<{
    my_ip: string;
    my_port: number;
    my_url: string;
    vault_name: string;
  } | null>(null);

  const [peerInput, setPeerInput] = useState('');
  const [discoveredPeers, setDiscoveredPeers] = useState<DiscoveredPeer[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [direction, setDirection] = useState<'bidirectional' | 'pull' | 'push'>('bidirectional');
  
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{
    status: string;
    message: string;
    notes_pulled: number;
    notes_pushed: number;
    images_pulled: number;
    images_pushed: number;
    peer_vault_name: string;
  } | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [copiedCmd, setCopiedCmd] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);

  // Load server info and peers whenever modal opens
  useEffect(() => {
    if (syncModalOpen) {
      setError(null);
      setSyncResult(null);

      // Fetch our own LAN sync info
      api.getSyncInfo().then(info => {
        setMyInfo({
          my_ip: info.server_ip,
          my_port: info.port,
          my_url: info.lan_url || `http://${info.server_ip}:${info.port}`,
          vault_name: info.vault_name,
        });
      }).catch(() => {});

      // Fetch remembered peer and discover active peers on LAN
      loadPeers(true);
    }
  }, [syncModalOpen]);

  const loadPeers = async (scan: boolean = true) => {
    setIsScanning(scan);
    try {
      const res = await api.getSyncPeers(scan);
      if (res.remembered_peer && !peerInput) {
        setPeerInput(res.remembered_peer);
      }
      if (res.discovered_peers && res.discovered_peers.length > 0) {
        setDiscoveredPeers(res.discovered_peers);
        if (!peerInput) {
          setPeerInput(res.discovered_peers[0].url);
        }
      }
    } catch (e: any) {
      console.warn('Could not scan for peers:', e);
    } finally {
      setIsScanning(false);
    }
  };

  const handleSyncNow = async () => {
    if (!peerInput.trim()) {
      setError('Please specify a peer IP or URL (e.g. 192.168.1.56 or 192.168.1.X:8000).');
      return;
    }

    try {
      setIsSyncing(true);
      setError(null);
      setSyncResult(null);

      const res = await api.syncWithPeer(peerInput.trim(), direction);
      setSyncResult(res);

      // Refresh all notes, tree, and graph in UI
      await refreshVault();
    } catch (err: any) {
      setError(err.message || 'Failed to sync with peer.');
    } finally {
      setIsSyncing(false);
    }
  };

  const termuxSyncCommand = myInfo?.my_ip
    ? `./sync.sh ${myInfo.my_ip} ${myInfo.my_port} ~/vault-sync --bidirectional`
    : './sync.sh <desktop-ip> 8000 ~/vault-sync --bidirectional';

  const handleCopyCommand = () => {
    navigator.clipboard.writeText(termuxSyncCommand).then(() => {
      setCopiedCmd(true);
      setTimeout(() => setCopiedCmd(false), 2000);
    });
  };

  const handleCopyLanUrl = () => {
    if (myInfo?.my_url) {
      navigator.clipboard.writeText(myInfo.my_url).then(() => {
        setCopiedUrl(true);
        setTimeout(() => setCopiedUrl(false), 2000);
      });
    }
  };

  return (
    <Dialog
      isOpen={syncModalOpen}
      onClose={() => setSyncModalOpen(false)}
      title="Local Wi-Fi Sync"
      maxWidth="lg"
    >
      <div className="space-y-5">
        {/* Alerts */}
        {error && (
          <div className="p-3 text-xs bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <div className="leading-relaxed">{error}</div>
          </div>
        )}

        {syncResult && (
          <div className="p-3.5 text-xs bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-2xl space-y-1">
            <div className="flex items-center gap-2 font-semibold">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              <span>{syncResult.message}</span>
            </div>
            <div className="text-[11px] text-emerald-300/80 pl-6">
              Pulled: {syncResult.notes_pulled} notes, {syncResult.images_pulled} images | Pushed: {syncResult.notes_pushed} notes, {syncResult.images_pushed} images
            </div>
          </div>
        )}

        {/* 1. Device Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* This Device */}
          <div className="p-3.5 rounded-2xl border border-vault-200 dark:border-vault-800 bg-vault-50/60 dark:bg-vault-850/50 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-semibold text-vault-900 dark:text-vault-100">
                <Laptop className="w-4 h-4 text-[var(--accent-primary)]" />
                <span>This Device</span>
              </div>
              <span className="flex items-center gap-1.5 text-[10px] font-medium text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Online
              </span>
            </div>
            <div className="text-[11px] text-vault-400 space-y-0.5 font-mono">
              <div>IP: <span className="text-vault-200 font-semibold">{myInfo?.my_ip || 'Detecting...'}</span></div>
              <div>Port: <span className="text-vault-200">{myInfo?.my_port || 8000}</span></div>
              <div className="truncate text-vault-500 text-[10px]">{myInfo?.vault_name || 'Active Vault'}</div>
            </div>
            {myInfo?.my_url && (
              <button
                type="button"
                onClick={handleCopyLanUrl}
                className="w-full flex items-center justify-center gap-1.5 py-1 px-2 text-[10px] font-mono rounded-lg border border-vault-700/60 hover:border-vault-500 text-vault-300 bg-vault-800/40 hover:bg-vault-800 transition-colors"
              >
                {copiedUrl ? <Check size={11} className="text-teal-400" /> : <Copy size={11} />}
                <span>{copiedUrl ? 'Copied LAN URL!' : myInfo.my_url}</span>
              </button>
            )}
          </div>

          {/* Peer Device */}
          <div className="p-3.5 rounded-2xl border border-vault-200 dark:border-vault-800 bg-vault-50/60 dark:bg-vault-850/50 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-semibold text-vault-900 dark:text-vault-100">
                <Smartphone className="w-4 h-4 text-teal-400" />
                <span>Target Peer (Phone / PC)</span>
              </div>
              <button
                type="button"
                onClick={() => loadPeers(true)}
                disabled={isScanning}
                className="flex items-center gap-1 text-[10px] text-vault-400 hover:text-teal-300 transition-colors"
                title="Scan local Wi-Fi for active Vault devices"
              >
                <RefreshCw size={11} className={isScanning ? 'animate-spin text-teal-400' : ''} />
                <span>{isScanning ? 'Scanning...' : 'Auto-Detect'}</span>
              </button>
            </div>
            <div className="space-y-1">
              <input
                type="text"
                value={peerInput}
                onChange={(e) => setPeerInput(e.target.value)}
                placeholder="e.g. 192.168.1.56 or http://192.168.1.X:8000"
                className="w-full bg-vault-100 dark:bg-vault-900 border border-vault-200 dark:border-vault-700 rounded-xl px-2.5 py-1.5 text-xs font-mono text-vault-900 dark:text-vault-100 placeholder:text-vault-500 focus:outline-none focus:border-[var(--accent-primary)]"
              />
              <p className="text-[10px] text-vault-500">
                Enter your Android phone or PC IP address.
              </p>
            </div>
          </div>
        </div>

        {/* Discovered Peers Banner */}
        {discoveredPeers.length > 0 && (
          <div className="p-2.5 rounded-xl bg-teal-500/10 border border-teal-500/20 text-xs space-y-1.5">
            <div className="text-[11px] font-semibold text-teal-300 flex items-center gap-1.5">
              <Wifi size={13} />
              <span>Vault devices detected on this Wi-Fi network:</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {discoveredPeers.map((p) => (
                <button
                  key={p.url}
                  type="button"
                  onClick={() => setPeerInput(p.url)}
                  className={`text-[11px] px-2.5 py-1 rounded-lg border font-mono transition-colors flex items-center gap-1.5 ${
                    peerInput.includes(p.ip)
                      ? 'bg-teal-500/30 border-teal-400 text-teal-200'
                      : 'bg-vault-800/80 border-vault-700 text-vault-300 hover:border-teal-500/50'
                  }`}
                >
                  <span>{p.ip}:{p.port}</span>
                  <span className="text-[10px] text-teal-400 font-sans">({p.vault_name})</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 2. Direction Selection */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-vault-400 uppercase tracking-wider block">
            Sync Direction
          </label>
          <div className="grid grid-cols-3 gap-2 text-xs">
            <button
              type="button"
              onClick={() => setDirection('bidirectional')}
              className={`p-2.5 rounded-xl border text-center transition-all ${
                direction === 'bidirectional'
                  ? 'border-[var(--accent-primary)] bg-[var(--accent-muted)] text-[var(--accent-primary)] font-semibold'
                  : 'border-vault-200 dark:border-vault-800 hover:border-vault-600 text-vault-400'
              }`}
            >
              <ArrowUpDown size={14} className="mx-auto mb-1" />
              <div>Two-Way Sync</div>
              <div className="text-[10px] opacity-70">Recommended</div>
            </button>
            <button
              type="button"
              onClick={() => setDirection('pull')}
              className={`p-2.5 rounded-xl border text-center transition-all ${
                direction === 'pull'
                  ? 'border-[var(--accent-primary)] bg-[var(--accent-muted)] text-[var(--accent-primary)] font-semibold'
                  : 'border-vault-200 dark:border-vault-800 hover:border-vault-600 text-vault-400'
              }`}
            >
              <Download size={14} className="mx-auto mb-1" />
              <div>Pull from Peer</div>
              <div className="text-[10px] opacity-70">Download only</div>
            </button>
            <button
              type="button"
              onClick={() => setDirection('push')}
              className={`p-2.5 rounded-xl border text-center transition-all ${
                direction === 'push'
                  ? 'border-[var(--accent-primary)] bg-[var(--accent-muted)] text-[var(--accent-primary)] font-semibold'
                  : 'border-vault-200 dark:border-vault-800 hover:border-vault-600 text-vault-400'
              }`}
            >
              <Upload size={14} className="mx-auto mb-1" />
              <div>Push to Peer</div>
              <div className="text-[10px] opacity-70">Upload only</div>
            </button>
          </div>
        </div>

        {/* 3. Primary Sync Button */}
        <div className="pt-2">
          <Button
            variant="primary"
            size="lg"
            className="w-full justify-center text-sm py-2.5 rounded-xl shadow-md font-semibold"
            isLoading={isSyncing}
            onClick={handleSyncNow}
            disabled={isSyncing}
            icon={<RefreshCw size={15} className={isSyncing ? 'animate-spin' : ''} />}
          >
            {isSyncing ? 'Syncing Notes & Images...' : '⚡ Sync Now'}
          </Button>
        </div>

        {/* 4. Termux Quick Command for Terminal Users */}
        <div className="p-3 rounded-2xl bg-vault-50 dark:bg-vault-850/60 border border-vault-200 dark:border-vault-800 space-y-1.5">
          <div className="flex items-center justify-between text-xs text-vault-400">
            <span className="font-semibold text-vault-300">Run from Termux on Android:</span>
            <button
              type="button"
              onClick={handleCopyCommand}
              className="text-teal-400 hover:text-teal-300 flex items-center gap-1 font-medium transition-colors"
            >
              {copiedCmd ? <Check size={12} /> : <Copy size={12} />}
              <span>{copiedCmd ? 'Copied' : 'Copy Command'}</span>
            </button>
          </div>
          <code className="block bg-vault-100 dark:bg-vault-900 px-2.5 py-1.5 rounded-xl text-[11px] font-mono text-teal-300 overflow-x-auto whitespace-pre">
            {termuxSyncCommand}
          </code>
        </div>
      </div>
    </Dialog>
  );
};
