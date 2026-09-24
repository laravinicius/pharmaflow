import { useMemo, useState } from 'react';
import { RefreshCw, Search, X, ChevronRight } from 'lucide-react';
import { motion } from 'motion/react';
import { db } from '../services/lanDatabase';
import { Formula } from '../types';
import { formatDateToBR, formatQuantity } from '../utils/format';
import { useData } from '../hooks/useData';
import { useAuth } from '../context/AuthContext';
import { LoadingState, ErrorState } from './Feedback';
import { ConfirmModal } from './ConfirmModal';
import { GRADIENTS } from '../../config/branding';

const WHATSAPP_MESSAGE = `Olá!
Passando para avisar que seu manipulado já chegou aqui na Pix - Jardim Paulista! \u{1F9EA} \u{1F4A0}
Nosso horário de atendimento é das 08:00 às 20:00 De segunda a sábado.`;

function getWhatsAppUrl(phone: string | undefined): string | null {
  const digits = (phone ?? '').replace(/\D/g, '');
  if (![10, 11, 12, 13].includes(digits.length)) return null;

  const phoneWithCountryCode = digits.length <= 11 ? `55${digits}` : digits;
  if (phoneWithCountryCode.length < 12 || phoneWithCountryCode.length > 13) return null;
  return `whatsapp://send?phone=${phoneWithCountryCode}&text=${encodeURIComponent(WHATSAPP_MESSAGE)}`;
}

function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="w-4 h-4 fill-current">
      <path d="M20.52 3.48A11.82 11.82 0 0 0 12.08 0C5.54 0 .22 5.32.22 11.86c0 2.09.55 4.13 1.59 5.93L.12 24l6.35-1.66a11.83 11.83 0 0 0 5.61 1.43h.01c6.54 0 11.86-5.32 11.86-11.86 0-3.17-1.24-6.15-3.43-8.43Zm-8.44 18.25h-.01a9.83 9.83 0 0 1-5.01-1.37l-.36-.21-3.77.99 1.01-3.67-.23-.38a9.83 9.83 0 0 1-1.51-5.23C2.2 6.42 6.62 2 12.08 2a9.82 9.82 0 0 1 6.99 2.9 9.86 9.86 0 0 1 2.91 7.01c0 5.46-4.44 9.82-9.9 9.82Zm5.4-7.37c-.3-.15-1.77-.87-2.04-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.65.07-.3-.15-1.26-.46-2.4-1.47-.89-.79-1.49-1.76-1.66-2.06-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.07-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.49s1.07 2.89 1.22 3.09c.15.2 2.1 3.2 5.09 4.49.71.31 1.26.49 1.69.63.71.23 1.36.2 1.87.12.57-.08 1.77-.72 2.02-1.42.25-.7.25-1.3.17-1.42-.07-.12-.27-.2-.57-.35Z" />
    </svg>
  );
}

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

export function FormulaList({ screenKey, title, subtitle, statuses, variant = 'pending', employeeName, statusFilterOptions, showAndamento = true, showVerification = false, monthlySummary = false, deliveryStatusFilter, onSelect, onConfirm, onDeliveryBlocked, onRepeat }: { screenKey: string; title: string; subtitle: string; statuses: string[]; variant?: 'pending' | 'confirmed'; employeeName?: string; statusFilterOptions?: { value: string; label: string }[]; showAndamento?: boolean; showVerification?: boolean; monthlySummary?: boolean; deliveryStatusFilter?: string; onSelect?: (f: Formula) => void; onConfirm?: (f: Formula, missing: string[]) => void; onDeliveryBlocked?: (f: Formula, missing: string[]) => void; onRepeat?: (f: Formula) => void }) {
  const { data: formulas, loading, error, reload } = useData(() => db.formulas.list());
  const { sessionToken, user } = useAuth();
  const canVerify = showVerification && user?.role === 'manager';
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [focusedIdx, setFocusedIdx] = useState(-1);
  const [confirmingId, setConfirmingId] = useState<number | null>(null);
  const [pendingWhatsAppStatus, setPendingWhatsAppStatus] = useState<Formula | null>(null);
  const [pendingDeliveryConfirmation, setPendingDeliveryConfirmation] = useState<{ formula: Formula; deliveryStatus: 'aguardando_retirada' | 'entregue' } | null>(null);
  const [updatingDeliveryId, setUpdatingDeliveryId] = useState<number | null>(null);
  const [verifyingId, setVerifyingId] = useState<number | null>(null);
  const now = new Date();
  const [summaryMonth, setSummaryMonth] = useState(now.getMonth());
  const [summaryYear, setSummaryYear] = useState(now.getFullYear());

  const handleConfirm = async (f: Formula) => {
    const reasons = getMissingReasons(f);
    if (reasons.length === 0) {
      setConfirmingId(f.id);
      try {
        await db.formulas.updateStatus(f.id, 'confirmed', sessionToken ?? undefined);
        await reload();
        onConfirm?.(f, []);
      } catch (err: any) {
        alert('Erro ao confirmar: ' + (err?.message ?? 'verifique a conexão com o servidor.'));
      } finally {
        setConfirmingId(null);
      }
      return;
    }
    onConfirm?.(f, reasons);
  };

  const applyDeliveryStatus = async (formula: Formula, deliveryStatus: string) => {
    setUpdatingDeliveryId(formula.id);
    try {
      await db.formulas.updateDeliveryStatus(formula.id, deliveryStatus, sessionToken ?? undefined);
      await reload();
    } catch (err: any) {
      alert('Erro ao atualizar o andamento: ' + (err?.message ?? 'verifique a conexão com o servidor.'));
    } finally {
      setUpdatingDeliveryId(null);
    }
  };

  const verifyFormula = async (formula: Formula) => {
    if (!sessionToken || formula.manager_verified || verifyingId === formula.id) return;
    setVerifyingId(formula.id);
    try {
      await db.formulas.verify(formula.id, sessionToken);
      await reload();
    } catch (err: any) {
      alert('Erro ao verificar fórmula: ' + (err?.message ?? 'verifique a conexão com o servidor.'));
    } finally {
      setVerifyingId(null);
    }
  };

  const handleDeliveryAction = async (formula: Formula) => {
    if (deliveryStatusFilter === 'em_producao') {
      setPendingDeliveryConfirmation({ formula, deliveryStatus: 'aguardando_retirada' });
      return;
    }
    if (deliveryStatusFilter !== 'aguardando_retirada') return;
    if (formula.payment_status !== 'pago') {
      onDeliveryBlocked?.(formula, ['Status de pagamento: Pago']);
      return;
    }
    setPendingDeliveryConfirmation({ formula, deliveryStatus: 'entregue' });
  };

  const handleDeliveryConfirmation = () => {
    const pending = pendingDeliveryConfirmation;
    setPendingDeliveryConfirmation(null);
    if (!pending) return;

    if (pending.deliveryStatus === 'aguardando_retirada') {
      setPendingWhatsAppStatus(pending.formula);
      return;
    }
    void applyDeliveryStatus(pending.formula, pending.deliveryStatus);
  };

  const handleWhatsAppStatusChoice = async (notifyCustomer: boolean) => {
    const formula = pendingWhatsAppStatus;
    setPendingWhatsAppStatus(null);
    if (!formula) return;

    if (notifyCustomer) {
      const whatsappUrl = getWhatsAppUrl(formula.customer_phone);
      if (whatsappUrl) {
        window.electronAPI.openWhatsApp(whatsappUrl).catch(() => {
          alert('Não foi possível abrir o WhatsApp Desktop.');
        });
      } else {
        alert('Cliente sem telefone válido para contato.');
      }
    }
    await applyDeliveryStatus(formula, 'aguardando_retirada');
  };

  const all = (formulas as Formula[]) ?? [];
  const searchLower = search.trim().toLocaleLowerCase('pt-BR');

  const matchesHistorySearch = (formula: Formula) => {
    if (!searchLower) return true;

    const selectedBudgets = (formula.budget_items ?? []).filter(item => item.is_selected);
    const normalizedSearch = searchLower.replace(/\D/g, '');
    const paymentLabels: Record<string, string> = {
      pago: 'Pago',
      parcial: 'Parcial',
      pagar_na_retirada: 'Pagar na retirada',
    };
    const statusLabels: Record<string, string> = {
      cancelled: 'Cancelada',
      delivered: 'Entregue',
    };
    const searchableValues = [
      formula.id,
      formula.customer_name,
      formula.customer_phone,
      (formula.customer_phone ?? '').replace(/\D/g, ''),
      formula.budget_number,
      formula.attendant_name,
      employeeName,
      new Date(formula.created_at).toLocaleDateString('pt-BR'),
      formula.delivery_date ? formatDateToBR(formula.delivery_date) : '',
      formula.delivery_date ?? '',
      paymentLabels[formula.payment_status ?? ''] ?? formula.payment_status,
      statusLabels[formula.status] ?? formula.status,
      formula.manager_verified ? 'Verificado' : 'Verificar Não verificado',
      ...(formula.items ?? []).flatMap(item => [item.insumo_name, item.quantity, item.unit]),
      ...selectedBudgets.flatMap(item => [
        formatQuantity(item.quantity),
        item.quantity,
        item.unit,
        item.value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        item.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
      ]),
    ];

    return searchableValues.some(value => String(value ?? '').toLocaleLowerCase('pt-BR').includes(searchLower))
      || (normalizedSearch.length > 0 && (formula.customer_phone ?? '').replace(/\D/g, '').includes(normalizedSearch));
  };

  const summaryYears = useMemo(() => {
    const years = new Set<number>([new Date().getFullYear()]);
    for (const formula of all) {
      const year = Number(formula.delivery_date?.slice(0, 4));
      if (Number.isInteger(year) && year > 1900) years.add(year);
    }
    return [...years].sort((a, b) => b - a);
  }, [all]);

  const monthlyTotal = useMemo(() => all
    .filter(formula => formula.payment_status === 'pago' && formula.delivery_status === 'entregue')
    .filter(formula => {
      const date = formula.delivery_date ?? '';
      return Number(date.slice(0, 4)) === summaryYear && Number(date.slice(5, 7)) === summaryMonth + 1;
    })
    .reduce((total, formula) => total + (formula.budget_items ?? [])
      .filter(item => item.is_selected)
      .reduce((formulaTotal, item) => formulaTotal + Number(item.value || 0), 0), 0), [all, summaryMonth, summaryYear]);

  const filtered = useMemo(() => {
    return all
      .filter(f => statuses.includes(f.status))
      .filter(f => !deliveryStatusFilter || f.delivery_status === deliveryStatusFilter)
      .filter(f => !statusFilter || f.status === statusFilter)
      .filter(f => screenKey === 'history'
        ? matchesHistorySearch(f)
        : (
        f.customer_name.toLowerCase().includes(searchLower) ||
        (f.attendant_name || '').toLowerCase().includes(searchLower) ||
        String(f.id).includes(searchLower)
      ));
  }, [all, statuses, statusFilter, searchLower, deliveryStatusFilter, screenKey, employeeName]);

  const paymentTint: Record<string, string> = {
    pago: 'bg-emerald-50 border-emerald-200',
    parcial: 'bg-amber-50 border-amber-200',
    pagar_na_retirada: 'bg-red-50 border-red-200',
  };
  const paymentTintFocused: Record<string, string> = {
    pago: 'bg-emerald-100 border-emerald-300',
    parcial: 'bg-amber-100 border-amber-300',
    pagar_na_retirada: 'bg-red-100 border-red-300',
  };
  const paymentLabels: Record<string, string> = {
    pago: 'Pago',
    parcial: 'Parcial',
    pagar_na_retirada: 'Pagar na retirada',
  };
  const paymentText: Record<string, string> = {
    pago: 'text-emerald-700',
    parcial: 'text-amber-700',
    pagar_na_retirada: 'text-red-700',
  };
  const showRepeat = !!onRepeat;
  const deliveryActionLabel = deliveryStatusFilter === 'em_producao'
    ? 'Aguardando retirada'
    : deliveryStatusFilter === 'aguardando_retirada'
      ? 'Entregue'
      : null;
  const gridCols = variant === 'confirmed'
      ? canVerify
        ? 'md:grid-cols-[2fr_1fr_1fr_1fr_1.2fr_1.2fr_1.2fr_1fr_1.2fr_1.25fr_1.6fr_2.5fr]'
        : 'md:grid-cols-[2fr_1fr_1fr_1fr_1.2fr_1.2fr_1.2fr_1fr_1.2fr_1.6fr_2.5fr]'
    : showAndamento
      ? 'md:grid-cols-[2fr_1fr_1fr_1fr_1.2fr_1fr_1fr_1.2fr_0.6fr]'
      : showRepeat
        ? 'md:grid-cols-[2fr_1fr_1fr_1fr_1.2fr_1fr_1fr_1.2fr_1.6fr]'
        : 'md:grid-cols-[2fr_1fr_1fr_1fr_1.2fr_1fr_1fr_1.2fr_0.6fr]';
  const pendingGridCols = 'md:grid-cols-[2fr_1fr_1fr_1fr_1.2fr_1fr_1fr_1.2fr_0.6fr]';
  const columnGap = 'gap-4';

  return (
    <>
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
              value={search} onChange={e => setSearch(e.target.value)} />
            {search && (
              <button onClick={() => setSearch('')} title="Limpar busca"
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-zinc-400 hover:text-red-600 transition-colors">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {monthlySummary && (
        <div className="flex flex-col md:flex-row md:items-center gap-3 px-4 py-3 text-zinc-700">
          <span className="font-semibold">Valor total de fórmulas no mês</span>
          <select value={summaryMonth} onChange={e => setSummaryMonth(Number(e.target.value))} className="rounded-lg border border-emerald-200 bg-white px-3 py-1.5 text-sm outline-none">
            {['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'].map((month, index) => <option key={month} value={index}>{month}</option>)}
          </select>
          <span className="font-semibold">/</span>
          <select value={summaryYear} onChange={e => setSummaryYear(Number(e.target.value))} className="rounded-lg border border-emerald-200 bg-white px-3 py-1.5 text-sm outline-none">
            {summaryYears.map(year => <option key={year} value={year}>{year}</option>)}
          </select>
          <span className="font-bold md:ml-1">{monthlyTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
        </div>
      )}

      {loading && <LoadingState />}
      {error && <ErrorState message={error} onRetry={reload} />}
      {!loading && !error && (
        <div className="space-y-3">
          {filtered.length > 0 && variant === 'confirmed' && (
            <div className={`hidden md:grid ${gridCols} ${columnGap} px-4 text-[11px] font-semibold uppercase tracking-wide text-zinc-400 [&>span]:min-w-0`}>
              <span className="text-left">Cliente</span><span className="text-right">Orçamento</span><span className="text-right">Quantidade</span><span className="text-right">Valor</span><span className="text-left">Atendente</span><span className="text-left">Funcionário</span>
              <span className="text-left">Data criação</span><span className="text-left">Data entrega</span><span className="text-left">Pagamento</span>{canVerify && <span className="text-left">Verificação</span>}<span className="text-right">Whatsapp</span><span />
            </div>
          )}
          {filtered.length > 0 && variant === 'pending' && (
            <div className={`hidden md:grid ${pendingGridCols} ${columnGap} px-4 text-[11px] font-semibold uppercase tracking-wide text-zinc-400 [&>span]:min-w-0`}>
              <span className="text-left">Cliente</span><span className="text-right">Orçamento</span><span className="text-right">Quantidade</span><span className="text-right">Valor</span><span className="text-left">Atendente</span><span className="text-left">Funcionário</span><span className="text-left">Insumos</span><span className="text-right">Confirmar</span><span />
            </div>
          )}
{filtered.map((f, idx) => {
              const tint = paymentTint[f.payment_status ?? ''] ?? 'bg-white border-zinc-200';
              const tintFocused = paymentTintFocused[f.payment_status ?? ''] ?? 'bg-zinc-50 border-zinc-200';
              const isFocused = focusedIdx === idx;
              const cardTint = isFocused ? tintFocused : tint;
              return variant === 'confirmed' ? (
                <div key={f.id} className="flex items-stretch gap-3">
                <div onClick={() => onSelect?.(f)}
                  tabIndex={0}
                  role="button"
                  onKeyDown={e => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onSelect?.(f);
                    } else if (e.key === 'ArrowDown' && idx < filtered.length - 1) {
                      e.preventDefault();
                      setFocusedIdx(idx + 1);
                    } else if (e.key === 'ArrowUp' && idx > 0) {
                      e.preventDefault();
                      setFocusedIdx(idx - 1);
                    }
                  }}
                  onFocus={() => setFocusedIdx(idx)}
                  onBlur={() => setFocusedIdx(-1)}
                  className={`w-full text-left rounded-2xl border shadow-sm px-4 py-4 hover:shadow-md transition-all group cursor-pointer ${cardTint} focus:outline-none`}>
                  <div className={`grid grid-cols-1 ${gridCols} ${columnGap} items-center text-sm`}>
                    <div className="min-w-0 text-left">
                      <p className="font-bold text-zinc-900 truncate">{f.customer_name}</p>
                      {f.customer_phone && <p className="text-xs text-zinc-400 truncate">{f.responsible_name ? `${f.responsible_name} - ${f.customer_phone}` : f.customer_phone}</p>}
                    </div>
                    <p className="text-zinc-700 truncate text-right">{f.budget_number || '—'}</p>
                    <div className="text-zinc-700 space-y-1 font-medium text-right">
                      {(f.budget_items ?? []).filter(bi => bi.is_selected).map((bi, idx) => <p key={idx} className="whitespace-nowrap">{formatQuantity(bi.quantity)} {bi.unit}</p>)}
                      {(f.budget_items ?? []).filter(bi => bi.is_selected).length === 0 && <p className="text-zinc-400">—</p>}
                    </div>
                    <div className="text-zinc-700 space-y-1 tabular-nums text-right">
                      {(f.budget_items ?? []).filter(bi => bi.is_selected).map((bi, idx) => <p key={idx}>R$ {bi.value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>)}
                      {(f.budget_items ?? []).filter(bi => bi.is_selected).length === 0 && <p className="text-zinc-400">—</p>}
                    </div>
                    <p className="text-zinc-700 truncate text-left">{f.attendant_name || '—'}</p>
                    <p className="text-zinc-700 truncate text-left">{employeeName || '—'}</p>
                    <p className="text-zinc-500 text-left">{new Date(f.created_at).toLocaleDateString('pt-BR')}</p>
                    <p className="text-zinc-500 whitespace-nowrap text-left">{f.delivery_date ? formatDateToBR(f.delivery_date) : '—'}</p>
                    <div className="flex justify-start" onClick={e => e.stopPropagation()}>
                      <button
                        type="button"
                        disabled
                        aria-label={`Status de pagamento: ${paymentLabels[f.payment_status ?? ''] ?? 'Não informado'}`}
                        className={`rounded-lg border px-2.5 py-1.5 text-xs font-bold whitespace-nowrap cursor-default ${paymentTint[f.payment_status ?? ''] ?? 'bg-zinc-50 border-zinc-200'} ${paymentText[f.payment_status ?? ''] ?? 'text-zinc-500'}`}
                      >
                        {paymentLabels[f.payment_status ?? ''] ?? 'Não informado'}
                      </button>
                    </div>
                    {canVerify && (
                      <div className="flex justify-start" onClick={e => e.stopPropagation()}>
                        <button
                          type="button"
                          disabled={!!f.manager_verified || verifyingId === f.id}
                          aria-label={f.manager_verified ? 'Fórmula verificada' : `Verificar fórmula de ${f.customer_name}`}
                          onClick={() => void verifyFormula(f)}
                          className={`rounded-lg border px-2.5 py-1.5 text-xs font-bold whitespace-nowrap transition-colors disabled:cursor-default ${f.manager_verified ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-red-200 bg-red-50 text-red-700 hover:bg-red-100 disabled:opacity-60'}`}
                        >
                          {verifyingId === f.id ? 'Salvando...' : f.manager_verified ? 'Verificado' : 'Verificar'}
                        </button>
                      </div>
                    )}
                    <div className="flex justify-end">
                      {(() => {
                        const whatsappUrl = getWhatsAppUrl(f.customer_phone);
                        return (
                          <button
                            type="button"
                            disabled={!whatsappUrl}
                            title={whatsappUrl ? 'Enviar mensagem pelo WhatsApp' : 'Cliente sem telefone válido'}
                            aria-label={whatsappUrl ? `Enviar mensagem para ${f.customer_name} pelo WhatsApp` : 'Cliente sem telefone válido'}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (whatsappUrl) window.electronAPI.openWhatsApp(whatsappUrl).catch(() => {
                                alert('Não foi possível abrir o WhatsApp Desktop.');
                              });
                            }}
                            className="w-8 h-8 rounded-lg border border-emerald-200 bg-emerald-50 flex items-center justify-center text-emerald-600 hover:bg-emerald-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            <WhatsAppIcon />
                          </button>
                        );
                      })()}
                    </div>
                    <div className="flex justify-end items-center gap-2">
                      {deliveryActionLabel && (
                        <button
                          type="button"
                          disabled={updatingDeliveryId === f.id || pendingDeliveryConfirmation?.formula.id === f.id || pendingWhatsAppStatus?.id === f.id}
                          onClick={(e) => { e.stopPropagation(); void handleDeliveryAction(f); }}
                          className="px-3 py-1.5 rounded-lg bg-emerald-500 text-white text-xs font-bold hover:bg-emerald-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                        >
                          {updatingDeliveryId === f.id ? 'Atualizando...' : deliveryActionLabel}
                        </button>
                      )}
                      {showRepeat && (
                        <button type="button" onClick={(e) => { e.stopPropagation(); onRepeat?.(f); }}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-white text-xs font-bold hover:opacity-90 transition-all whitespace-nowrap"
                          style={{ background: GRADIENTS.secondary }}>
                          <RefreshCw className="w-3.5 h-3.5" /> Repetir
                        </button>
                      )}
                      <div className="w-8 h-8 rounded-lg border border-zinc-200 bg-white/70 flex items-center justify-center text-zinc-400 group-hover:border-red-300 group-hover:text-red-600 transition-colors">
                        <ChevronRight className="w-4 h-4" />
                      </div>
                    </div>
                  </div>
                </div>
                </div>
            ) : (
              <div key={f.id} onClick={() => onSelect?.(f)}
                tabIndex={0}
                role="button"
                onKeyDown={e => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelect?.(f);
                  } else if (e.key === 'ArrowDown' && idx < filtered.length - 1) {
                    e.preventDefault();
                    setFocusedIdx(idx + 1);
                  } else if (e.key === 'ArrowUp' && idx > 0) {
                    e.preventDefault();
                    setFocusedIdx(idx - 1);
                  }
                }}
                onFocus={() => setFocusedIdx(idx)}
                onBlur={() => setFocusedIdx(-1)}
                className={`w-full text-left bg-white rounded-2xl border border-zinc-200 shadow-sm px-4 py-4 hover:border-red-300 hover:shadow-md transition-all group cursor-pointer ${isFocused ? 'ring-2 ring-red-500 bg-red-50' : ''} focus:outline-none`}>
                <div className={`grid grid-cols-1 ${pendingGridCols} ${columnGap} items-center text-sm`}>
                  <div className="min-w-0 text-left">
                    <p className="font-bold text-zinc-900 truncate">{f.customer_name}</p>
                    {f.customer_phone && <p className="text-xs text-zinc-400 truncate">{f.responsible_name ? `${f.responsible_name} - ${f.customer_phone}` : f.customer_phone}</p>}
                  </div>
                  <p className="text-zinc-700 truncate text-right">{f.budget_number || '—'}</p>
                  <div className="text-zinc-700 space-y-1 font-medium text-right">
                    {(f.budget_items ?? []).filter(bi => bi.is_selected).map((bi, idx) => <p key={idx} className="whitespace-nowrap">{formatQuantity(bi.quantity)} {bi.unit}</p>)}
                    {(f.budget_items ?? []).filter(bi => bi.is_selected).length === 0 && <p className="text-zinc-400">—</p>}
                  </div>
                  <div className="text-zinc-700 space-y-1 tabular-nums text-right">
                    {(f.budget_items ?? []).filter(bi => bi.is_selected).map((bi, idx) => <p key={idx}>R$ {bi.value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>)}
                    {(f.budget_items ?? []).filter(bi => bi.is_selected).length === 0 && <p className="text-zinc-400">—</p>}
                  </div>
                  <p className="text-zinc-700 truncate text-left">{f.attendant_name || '—'}</p>
                  <p className="text-zinc-700 truncate text-left">{employeeName || '—'}</p>
                  <div className="min-w-0 text-zinc-600 text-left">
                    {f.items.slice(0, 3).map((item, idx) => <p key={idx} className="truncate">{item.insumo_name}</p>)}
                    {f.items.length > 3 && (
                      <p className="text-xs text-zinc-400 font-medium pt-0.5">
                        +{f.items.length - 3} insumo{f.items.length - 3 === 1 ? '' : 's'}
                      </p>
                    )}
                  </div>
                  <div className="flex justify-end">
                    <button type="button" disabled={confirmingId === f.id}
                      onClick={(e) => { e.stopPropagation(); handleConfirm(f); }}
                      className="px-3 py-1.5 rounded-lg text-white text-xs font-bold hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                      style={{ background: GRADIENTS.primary }}>
                      {confirmingId === f.id ? 'Confirmando...' : 'Confirmar'}
                    </button>
                  </div>
                  <div className="flex justify-end">
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
    <ConfirmModal
      isOpen={!!pendingDeliveryConfirmation}
      title={pendingDeliveryConfirmation?.deliveryStatus === 'entregue' ? 'Confirmar entrega' : 'Aguardando retirada'}
      message={pendingDeliveryConfirmation?.deliveryStatus === 'entregue'
        ? `Confirma que a fórmula de ${pendingDeliveryConfirmation.formula.customer_name} foi entregue?`
        : `Confirma que a fórmula de ${pendingDeliveryConfirmation?.formula.customer_name} está aguardando retirada?`}
      confirmLabel="Sim"
      cancelLabel="Não"
      onConfirm={handleDeliveryConfirmation}
      onClose={() => setPendingDeliveryConfirmation(null)}
    />
    <ConfirmModal
      isOpen={!!pendingWhatsAppStatus}
      title="Avisar cliente"
      message="Deseja avisar o cliente por whatsapp?"
      confirmLabel="Sim"
      cancelLabel="Não"
      onConfirm={() => { void handleWhatsAppStatusChoice(true); }}
      onClose={() => { void handleWhatsAppStatusChoice(false); }}
    />
    </>
  );
}
