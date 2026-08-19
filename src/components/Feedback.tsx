import { RefreshCw, WifiOff } from 'lucide-react';

export function LoadingState({ label = 'Carregando...' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center py-16 text-zinc-400 gap-2">
      <RefreshCw className="w-5 h-5 animate-spin" /><span>{label}</span>
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3">
      <WifiOff className="w-10 h-10 text-red-400" />
      <p className="text-zinc-600 font-medium">Erro ao carregar dados</p>
      <p className="text-zinc-400 text-sm text-center max-w-xs">{message}</p>
      <button onClick={onRetry} className="flex items-center gap-2 text-sm bg-zinc-100 hover:bg-zinc-200 px-4 py-2 rounded-lg transition-colors font-medium">
        <RefreshCw className="w-4 h-4" /> Tentar novamente
      </button>
    </div>
  );
}