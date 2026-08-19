import { useState } from 'react';
import { RefreshCw, Search, X, ChevronRight } from 'lucide-react';
import { motion } from 'motion/react';
import { db } from '../services/lanDatabase';
import { Formula } from '../types';
import { formatDateToBR } from '../utils/format';
import { useData } from '../hooks/useData';
import { LoadingState, ErrorState } from './Feedback';

// Verifica quais requisitos faltam para a fórmula poder ser confirmada
export function getMissingReasons(f: Formula): string[] {
  const reasons: string[] = [];
  if (!f.items || f.items.length === 0) reasons.push('Matérias-primas');
  if (!f.budget_number) reasons.push('Número do orçamento');
  if (!f.budget_items || f.budget_items.length === 0) reasons.push('Itens do orçamento');
  if (!f.attendant_name) reasons.push('Atendente PM');
  if (!f.delivery_date || !/^\d{4}-\d{2}-\d{2}$/.test(f.delivery_date)) reasons.push('Data de entrega válida');
  if (!f.payment_status) reasons.push('Status de pagamento');
  const budgetItems = f.budget_items ?? [];
  if (budgetItems.length > 1 && budgetItems.filter(bi => bi.is_selected).length !== 1) reasons.push('Selecionar um único orçamento');
  return reasons;
}

export function FormulaList({ screenKey, title, subtitle, statuses, variant = 'pending', statusFilterOptions, showAndamento = true, onSelect, onConfirm, onRepeat }: { screenKey: string; title: string; subtitle: string; statuses: string[]; variant?: 'pending' | 'confirmed'; statusFilterOptions?: { value: string; label: string }[]; showAndamento?: boolean; onSelect?: (f: Formula) => void; onConfirm?: (f: Formula, missing: string[]) => void; onRepeat?: (f: Formula) => void }) {
  const { data: formulas, loading, error, reload } = useData(() => db.formulas.list());
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [confirmingId, setConfirmingId] = useState<number | null>(null);
  const [updatingStatusId, setUpdatingStatusId] = useState<number | null>(null);

  const handleConfirm = async (f: Formula) => {
    const reasons = getMissingReasons(f);
    if (reasons.length === 0) {
      setConfirmingId(f.id);
      try {
        await db.formulas.updateStatus(f.id, 'confirmed');
        reload();
      } finally {
        setConfirmingId(null);
      }
    }
    onConfirm?.(f, reasons);
  };

  const handleDeliveryStatusChange = async (f: Formula, deliveryStatus: string) => {
    setUpdatingStatusId(f.id);
    try {
      await db.formulas.updateDeliveryStatus(f.id, deliveryStatus);
      reload();
    } finally {
      setUpdatingStatusId(null);
    }
  };

  const all = (formulas as Formula[]) ?? [];
  const filtered = all
    .filter(f => statuses.includes(f.status))
    .filter(f => !statusFilter || f.status === statusFilter)
    .filter(f =>
      f.customer_name.toLowerCase().includes(search.toLowerCase()) ||
      (f.pharmacist_name || '').toLowerCase().includes(search.toLowerCase()) ||
      String(f.id).includes(search)
    );

  const paymentTint: Record<string, string> = {
    pago: 'bg-emerald-50 border-emerald-200',
    parcial: 'bg-amber-50 border-amber-200',
    nao_pago: 'bg-red-50 border-red-200',
    pagar_na_retirada: 'bg-cyan-50 border-cyan-200',
  };
  const showRepeat = !!onRepeat;
  const gridCols = showAndamento
    ? 'md:grid-cols-[2fr_1fr_1fr_1.2fr_1fr_1fr_1.2fr_1.2fr_0.6fr]'
    : showRepeat
      ? 'md:grid-cols-[2fr_1fr_1fr_1.2fr_1fr_1fr_1.2fr_1.6fr]'
      : 'md:grid-cols-[2fr_1fr_1fr_1.2fr_1fr_1fr_1.2fr_0.6fr]';

  return (
    <motion.div key={screenKey} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-zinc-900">{title}</h2>
          <p className="text-zinc-500 text-sm">{subtitle}</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={reload} className="p-2 text-zinc-400 hover:text-zinc-700 transition-colors" title="Atualizar"><RefreshCw className="w-5 h-5" /></button>
          {statusFilterOptions && (
            <select className="px-3 py-2 bg-white border border-zinc-200 rounded-xl focus:ring-2 focus:ring-red-500 outline-none text-sm"
              value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option value="">Todos os status</option>
              {statusFilterOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          )}
          <div className="relative">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-zinc-400" />
            <input className="pl-9 pr-9 py-2 bg-white border border-zinc-200 rounded-xl focus:ring-2 focus:ring-red-500 outline-none text-sm min-w-[260px]"
              placeholder="Buscar cliente, farmacêutico ou ID..." value={search} onChange={e => setSearch(e.target.value)} />
            {search && (
              <button onClick={() => setSearch('')} title="Limpar busca"
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-zinc-400 hover:text-red-600 transition-colors">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {loading && <LoadingState />}
      {error && <ErrorState message={error} onRetry={reload} />}
      {!loading && !error && (
        <div className="space-y-3">
          {filtered.length > 0 && variant === 'confirmed' && (
            <div className={`hidden md:grid ${gridCols} gap-2 px-4 text-[11px] font-semibold uppercase tracking-wide text-zinc-400`}>
              <span>Cliente</span><span>Quantidade</span><span>Valor</span><span>Atendente PM</span>
              <span>Data criação</span><span>Data entrega</span><span>Telefone</span>{showAndamento && <span>Andamento</span>}<span />
            </div>
          )}
          {filtered.map(f => {
            const tint = paymentTint[f.payment_status ?? ''] ?? 'bg-white border-zinc-200';
            return variant === 'confirmed' ? (
              <div key={f.id} onClick={() => onSelect?.(f)}
                className={`w-full text-left rounded-2xl border shadow-sm px-4 py-3 hover:shadow-md transition-all group cursor-pointer ${tint}`}>
                <div className={`grid grid-cols-1 ${gridCols} gap-2 items-center text-sm`}>
                  <p className="font-bold text-zinc-900">{f.customer_name}</p>
                  <div className="text-zinc-700 space-y-0.5 font-medium">
                    {(f.budget_items ?? []).map((bi, idx) => <p key={idx} className="whitespace-nowrap">{bi.quantity} {bi.unit}</p>)}
                    {(f.budget_items ?? []).length === 0 && <p className="text-zinc-400">—</p>}
                  </div>
                  <div className="text-zinc-700 space-y-0.5 tabular-nums">
                    {(f.budget_items ?? []).map((bi, idx) => <p key={idx}>R$ {bi.value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>)}
                    {(f.budget_items ?? []).length === 0 && <p className="text-zinc-400">—</p>}
                  </div>
                  <p className="text-zinc-700 truncate">{f.attendant_name || '—'}</p>
                  <p className="text-zinc-500">{new Date(f.created_at).toLocaleDateString('pt-BR')}</p>
                  <p className="text-zinc-500 whitespace-nowrap">{f.delivery_date ? formatDateToBR(f.delivery_date) : '—'}</p>
                  <p className="text-zinc-700 whitespace-nowrap">{f.customer_phone || '—'}</p>
                  {showAndamento && (
                    <div className="flex justify-end">
                      <select
                        value={f.delivery_status ?? ''}
                        disabled={!f.payment_status || updatingStatusId === f.id}
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
                        onChange={(e) => handleDeliveryStatusChange(f, e.target.value)}
                        className="w-full max-w-[170px] px-2 py-1.5 rounded-lg border border-zinc-300 focus:ring-2 focus:ring-red-500 outline-none bg-white text-sm text-zinc-700 disabled:opacity-60 disabled:cursor-not-allowed whitespace-nowrap">
                        <option value="">Selecione...</option>
                        <option value="em_producao">Em produção</option>
                        <option value="aguardando_retirada">Aguardando retirada</option>
                        <option value="aguardando_envio">Aguardando envio</option>
                        <option value="entregue">Entregue</option>
                      </select>
                    </div>
                  )}
                  <div className="flex justify-end items-center gap-2">
                    {showRepeat && (
                      <button type="button" onClick={(e) => { e.stopPropagation(); onRepeat?.(f); }}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-white text-xs font-bold hover:opacity-90 transition-all whitespace-nowrap"
                        style={{ background: 'linear-gradient(135deg, #1F3164, #2a4080)' }}>
                        <RefreshCw className="w-3.5 h-3.5" /> Repetir
                      </button>
                    )}
                    <div className="w-8 h-8 rounded-lg border border-zinc-200 bg-white/70 flex items-center justify-center text-zinc-400 group-hover:border-red-300 group-hover:text-red-600 transition-colors">
                      <ChevronRight className="w-4 h-4" />
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div key={f.id} onClick={() => onSelect?.(f)}
                className="w-full text-left bg-white rounded-2xl border border-zinc-200 shadow-sm px-4 py-3 hover:border-red-300 hover:shadow-md transition-all group cursor-pointer">
                <div className="grid grid-cols-1 md:grid-cols-[1.5fr_1.2fr_1fr_2fr_1.1fr] gap-2 items-center text-sm">
                  <div className="min-w-0">
                    <p className="font-bold text-zinc-900 truncate">{f.customer_name}</p>
                    {f.customer_phone && <p className="text-xs text-zinc-400 truncate">{f.customer_phone}</p>}
                  </div>
                  <p className="text-zinc-700 truncate">{f.pharmacist_name || '—'}</p>
                  <p className="text-zinc-500 whitespace-nowrap">{new Date(f.created_at).toLocaleDateString('pt-BR')}</p>
                  <div className="min-w-0">
                    <p className="text-zinc-600 truncate">
                      {f.items.slice(0, 3).map((item, idx) => (
                        <span key={idx}>{idx > 0 && <span className="text-zinc-300">, </span>}{item.material_name}</span>
                      ))}
                    </p>
                    {f.items.length > 3 && (
                      <p className="text-xs text-zinc-400 font-medium pt-0.5">
                        Mais {f.items.length - 3} matéria-prima{f.items.length - 3 === 1 ? '' : 's'}
                      </p>
                    )}
                  </div>
                  <div className="flex justify-end items-center gap-2">
                    <button type="button" disabled={confirmingId === f.id}
                      onClick={(e) => { e.stopPropagation(); handleConfirm(f); }}
                      className="px-3 py-1.5 rounded-lg text-white text-xs font-bold hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                      style={{ background: 'linear-gradient(135deg, #C41E3C, #A01830)' }}>
                      {confirmingId === f.id ? 'Confirmando...' : 'Confirmar'}
                    </button>
                    <div className="w-8 h-8 rounded-lg border border-zinc-200 bg-white/70 flex items-center justify-center text-zinc-400 group-hover:border-red-300 group-hover:text-red-600 transition-colors">
                      <ChevronRight className="w-4 h-4" />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {filtered.length === 0 && (
            <div className="py-16 text-center text-zinc-400">
              <p className="font-medium">Nenhuma fórmula nesta lista ainda.</p>
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}