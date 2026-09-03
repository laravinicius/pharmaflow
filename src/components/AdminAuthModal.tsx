import React, { useState } from 'react';
import { X, Loader2, AlertCircle } from 'lucide-react';

interface AdminAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (adminCreds?: { username: string; password: string }, sessionToken?: string) => Promise<void>;
  title?: string;
  message?: string;
}

export function AdminAuthModal({ isOpen, onClose, onConfirm, title = 'Confirmação de exclusão', message = 'Esta ação requer credenciais de administrador.' }: AdminAuthModalProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError('Informe usuário e senha.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await onConfirm({ username: username.trim(), password: password.trim() });
      onClose();
    } catch (err: any) {
      setError(err?.message ?? 'Credenciais de administrador inválidas');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
              <AlertCircle className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <h3 className="font-bold text-zinc-900 text-lg">{title}</h3>
              <p className="text-xs text-zinc-500">{message}</p>
            </div>
          </div>
          <button onClick={onClose} disabled={loading} className="p-1 text-zinc-400 hover:text-zinc-600 transition-colors disabled:opacity-50">
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-xs text-zinc-500 mb-4">Informe usuário e senha de um administrador para confirmar a exclusão.</p>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-zinc-500 uppercase mb-1">Usuário</label>
            <input
              type="text"
              autoFocus
              value={username}
              onChange={e => { setError(''); setUsername(e.target.value); }}
              className="w-full px-3 py-2 rounded-lg border border-zinc-300 focus:ring-2 focus:ring-red-500 outline-none text-sm"
              disabled={loading}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-zinc-500 uppercase mb-1">Senha</label>
            <input
              type="password"
              value={password}
              onChange={e => { setError(''); setPassword(e.target.value); }}
              onKeyDown={e => e.key === 'Enter' && !loading && handleSubmit(e as any)}
              className="w-full px-3 py-2 rounded-lg border border-zinc-300 focus:ring-2 focus:ring-red-500 outline-none text-sm"
              disabled={loading}
            />
          </div>

          {error && (
            <p className="flex items-center gap-1.5 text-xs text-red-600 font-medium bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {error}
            </p>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 py-2.5 rounded-xl border border-zinc-300 font-semibold text-sm text-zinc-700 hover:bg-zinc-50 transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2.5 rounded-xl text-white font-semibold text-sm hover:opacity-90 transition-all disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg, #C5243E, #9B1A2E)' }}
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Confirmar exclusão'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
