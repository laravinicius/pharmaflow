import { AlertCircle, CheckCircle, CloudUpload, RefreshCw, WifiOff } from 'lucide-react';
import { SyncStatus } from '../types';

export function SyncIndicator({ status, onSync }: { status: SyncStatus; onSync: () => void }) {
  const fmtDate = (iso: string | null) => {
    if (!iso) return null;
    const d = new Date(iso);
    const diffMin = Math.floor((Date.now() - d.getTime()) / 60000);
    if (diffMin < 1) return 'agora mesmo';
    if (diffMin < 60) return `há ${diffMin}min`;
    return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  };

  const stateConfig = {
    idle: {
      icon: <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />,
      label: status.lastSync ? `Sincronizado ${fmtDate(status.lastSync)}` : 'Conectado',
      cls: 'text-emerald-700 bg-emerald-50',
    },
    syncing: {
      icon: <RefreshCw className="w-3.5 h-3.5 text-blue-500 animate-spin" />,
      label: 'Sincronizando...',
      cls: 'text-blue-700 bg-blue-50',
    },
    offline: {
      icon: <WifiOff className="w-3.5 h-3.5 text-amber-500" />,
      label: 'Offline',
      cls: 'text-amber-700 bg-amber-50',
    },
    error: {
      icon: <AlertCircle className="w-3.5 h-3.5 text-red-500" />,
      label: 'Erro de sync',
      cls: 'text-red-700 bg-red-50',
    },
    connecting: {
      icon: <RefreshCw className="w-3.5 h-3.5 text-zinc-400 animate-spin" />,
      label: 'Verificando...',
      cls: 'text-zinc-500 bg-zinc-100',
    },
  } as const;

  const cfg = stateConfig[status.state] ?? stateConfig.connecting;

  return (
    <div className="flex items-center gap-2">
      {status.pending > 0 && status.state === 'idle' && (
        <span className="text-xs bg-amber-100 text-amber-700 font-bold px-2 py-0.5 rounded-full">
          {status.pending} pendente{status.pending > 1 ? 's' : ''}
        </span>
      )}
      <div className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${cfg.cls}`}>
        {cfg.icon}
        <span>{cfg.label}</span>
      </div>
      {status.state !== 'connecting' && (
        <button onClick={onSync} disabled={status.state === 'syncing'}
          title="Sincronizar agora"
          className="p-1 text-zinc-400 hover:text-zinc-700 disabled:opacity-30 transition-colors rounded-lg hover:bg-zinc-100">
          <CloudUpload className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}