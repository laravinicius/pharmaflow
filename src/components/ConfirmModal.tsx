import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onClose: () => void;
}

export function ConfirmModal({ isOpen, title, message, confirmLabel = 'Confirmar', onConfirm, onClose }: ConfirmModalProps) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <h3 className="font-bold text-zinc-900 text-lg">{title}</h3>
              <p className="text-xs text-zinc-500">{message}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 text-zinc-400 hover:text-zinc-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-zinc-300 font-semibold text-sm text-zinc-700 hover:bg-zinc-50 transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="flex-1 py-2.5 rounded-xl text-white font-semibold text-sm hover:opacity-90 transition-all"
            style={{ background: 'linear-gradient(135deg, #C5243E, #9B1A2E)' }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
