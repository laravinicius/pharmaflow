import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import type { Formula, PaymentStatus } from '../types';
import { db } from '../services/lanDatabase';
import { currencyCaretPosition, formatCurrency, parseCurrency } from '../utils/format';
import { GRADIENTS } from '../../config/branding';

export function HistoryPaymentModal({ formula, sessionToken, onClose, onSaved }: {
  formula: Formula;
  sessionToken: string | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [status, setStatus] = useState<PaymentStatus | ''>(
    ['pago', 'parcial', 'pagar_na_retirada'].includes(formula.payment_status ?? '')
      ? formula.payment_status as PaymentStatus : ''
  );
  const [amount, setAmount] = useState(formula.partial_payment_amount != null
    ? formatCurrency(Number(formula.partial_payment_amount).toFixed(2).replace('.', ',')) : '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const dialogRef = useRef<HTMLDivElement>(null);
  const savingRef = useRef(false);
  const selectedBudgets = (formula.budget_items ?? []).filter(item => item.is_selected);
  const budgetValue = selectedBudgets.length === 1 ? Number(selectedBudgets[0].value) : null;
  const parsedAmount = parseCurrency(amount);
  const validationError = status !== 'parcial' ? ''
    : budgetValue === null ? 'Selecione uma única opção de orçamento para validar o limite.'
    : parsedAmount <= 0 ? 'Informe uma quantia maior que zero.'
    : parsedAmount > budgetValue ? 'A quantia paga não pode ser maior que o valor do orçamento selecionado.' : '';

  useEffect(() => {
    const trigger = document.activeElement as HTMLElement | null;
    dialogRef.current?.querySelector<HTMLSelectElement>('select')?.focus();
    return () => { if (trigger?.isConnected) trigger.focus(); };
  }, []);

  const close = () => { if (!savingRef.current) onClose(); };
  const save = async () => {
    if (savingRef.current || !status || validationError) return;
    if (!sessionToken) { setError('Sessão inválida ou expirada. Entre novamente.'); return; }
    savingRef.current = true;
    setSaving(true);
    setError('');
    try {
      await db.formulas.updatePayment(formula.id, {
        payment_status: status,
        partial_payment_amount: status === 'parcial' ? parsedAmount : null,
      }, sessionToken);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Não foi possível salvar. Verifique a conexão com o servidor.');
      return;
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
    onSaved();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={close}>
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="history-payment-title" aria-busy={saving}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}
        onKeyDown={e => {
          e.stopPropagation();
          if (e.key === 'Escape') { e.preventDefault(); close(); }
          if (e.key === 'Tab') {
            const controls = dialogRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), select:not(:disabled), input:not(:disabled)');
            const first = controls?.[0];
            const last = controls?.[controls.length - 1];
            if (!first) { e.preventDefault(); return; }
            if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
            else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
          }
        }}>
        <div className="flex items-center justify-between gap-3 mb-5">
          <div>
            <h3 id="history-payment-title" className="font-bold text-zinc-900 text-lg">Editar pagamento</h3>
            <p className="text-sm text-zinc-500">{formula.customer_name}</p>
          </div>
          <button type="button" onClick={close} disabled={saving} aria-label="Fechar edição de pagamento"
            className="p-2 text-zinc-500 hover:text-zinc-900 disabled:opacity-50"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={e => { e.preventDefault(); void save(); }} className="space-y-4">
          <div>
            <label htmlFor="history-payment-status" className="block text-sm font-semibold text-zinc-700 mb-1">Pagamento</label>
            <select id="history-payment-status" value={status} disabled={saving}
              onChange={e => { setStatus(e.target.value as PaymentStatus); setError(''); }}
              className="w-full px-3 py-2 rounded-lg border border-zinc-300 bg-white text-sm focus-visible:outline-2 focus-visible:outline-[#243465] disabled:opacity-60">
              <option value="" disabled>Selecione...</option>
              <option value="pago">Pago</option>
              <option value="parcial">Parcial</option>
              <option value="pagar_na_retirada">Pagar na retirada</option>
            </select>
          </div>
          {status === 'parcial' && (
            <div>
              <label htmlFor="history-payment-amount" className="block text-sm font-semibold text-zinc-700 mb-1">Quantia paga (R$)</label>
              <input id="history-payment-amount" type="text" inputMode="decimal" value={amount} disabled={saving}
                aria-invalid={!!validationError} aria-describedby={validationError ? 'history-payment-validation' : undefined}
                onChange={e => {
                  const input = e.currentTarget;
                  const caret = currencyCaretPosition(input.value, input.selectionStart ?? input.value.length);
                  setAmount(formatCurrency(input.value));
                  setError('');
                  requestAnimationFrame(() => input.setSelectionRange(caret, caret));
                }} placeholder="0,00"
                className="w-full px-3 py-2 rounded-lg border border-zinc-300 text-sm focus-visible:outline-2 focus-visible:outline-[#243465] disabled:opacity-60" />
              {validationError && <p id="history-payment-validation" className="mt-1 text-sm text-[#C5243E]">{validationError}</p>}
            </div>
          )}
          {error && <p role="alert" className="text-sm text-[#C5243E]">{error}</p>}
          <div className="flex gap-3 pt-2">
            <button type="button" disabled={saving} onClick={close}
              className="flex-1 py-2.5 rounded-xl border border-zinc-300 font-semibold text-sm text-zinc-700 hover:bg-zinc-50 disabled:opacity-50">Cancelar</button>
            <button type="submit" disabled={saving || !status || !!validationError}
              className="flex-1 py-2.5 rounded-xl text-white font-semibold text-sm hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: GRADIENTS.primary }}>{saving ? 'Salvando...' : 'Salvar'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
