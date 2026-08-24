import React, { useState, useEffect, useRef } from 'react';
import {
  Users, Search, X, PlusCircle, RefreshCw, Trash2, AlertCircle, Calendar, ClipboardList, Bookmark,
} from 'lucide-react';
import { motion } from 'motion/react';
import { db } from '../services/lanDatabase';
import { User, Customer, Insumo, Formula, FormulaItem, BudgetItem, SavedFormula } from '../types';
import { formatCurrency, parseCurrency, formatDateBR, parseDateBR, formatDateToBR, stripDiacritics, formatQuantity } from '../utils/format';
import { useData } from '../hooks/useData';
import { CustomerManager } from './CustomerManager';
import { InsumoManager } from './InsumoManager';

export function RecipeForm({ user, template, formula, confirmed = false, readOnly = false, initialLocked = true, onComplete }: { user: User; template?: Formula | null; formula?: Formula | null; confirmed?: boolean; readOnly?: boolean; initialLocked?: boolean; onComplete: (dest: 'pending' | 'confirmed') => void }) {
  const { data: customers, reload: reloadCustomers } = useData(() => db.customers.list());
  const { data: insumos, reload: reloadInsumos } = useData(() => db.insumos.list());
  const { data: savedFormulas } = useData(() => db.savedFormulas.list());
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | ''>('');
  const [items, setItems] = useState<FormulaItem[]>([]);
  const [customerQuery, setCustomerQuery] = useState('');
  const [showAddCustomer, setShowAddCustomer] = useState(false);
  const [showTemplateBanner, setShowTemplateBanner] = useState(false);
  const [insumoQuery, setInsumoQuery] = useState('');
  const [selectedInsumoId, setSelectedInsumoId] = useState<number | ''>('');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState('mg');
  const [showAddInsumo, setShowAddInsumo] = useState(false);
  const [itemError, setItemError] = useState('');
  const [savedFormulaQuery, setSavedFormulaQuery] = useState('');
  const [appliedSavedFormula, setAppliedSavedFormula] = useState<SavedFormula | null>(null);
  const [budgetNumber, setBudgetNumber] = useState('');
  const [bQty, setBQty] = useState('');
  const [bUnit, setBUnit] = useState('caps');
  const [bValue, setBValue] = useState('');
  const [budgetItems, setBudgetItems] = useState<BudgetItem[]>([]);
  const [selectedBudgetIndex, setSelectedBudgetIndex] = useState<number | null>(null);
  const [budgetError, setBudgetError] = useState('');
  const [attendantName, setAttendantName] = useState('');
  const [deliveryDate, setDeliveryDate] = useState('');
  const [paymentStatus, setPaymentStatus] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [saving, setSaving] = useState(false);
  const [locked, setLocked] = useState(formula ? initialLocked : false);
  const [deliveryStatus, setDeliveryStatus] = useState('');
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [customerFocusIdx, setCustomerFocusIdx] = useState(-1);
  const [insumoFocusIdx, setInsumoFocusIdx] = useState(-1);
  const [savedFormulaFocusIdx, setSavedFormulaFocusIdx] = useState(-1);
  const dateInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (formula) {
      setSelectedCustomerId(formula.customer_id);
      setItems(formula.items.map(i => ({ ...i })));
      setBudgetNumber(formula.budget_number ?? '');
      setBudgetItems((formula.budget_items ?? []).map(bi => ({ ...bi })));
      const budgetItems = formula.budget_items ?? [];
      const selIdx = budgetItems.findIndex(bi => bi.is_selected);
      setSelectedBudgetIndex(selIdx >= 0 ? selIdx : null);
      setAttendantName(formula.attendant_name ?? '');
      setDeliveryDate(formula.delivery_date ? formatDateToBR(formula.delivery_date) : '');
      setPaymentStatus(formula.payment_status ?? '');
      setPaymentMethod(formula.payment_method ?? '');
      setDeliveryStatus(formula.delivery_status ?? '');
    }
  }, [formula]);

  useEffect(() => {
    if (template) {
      setSelectedCustomerId(template.customer_id);
      setItems(template.items.map(i => ({ ...i })));
      setShowTemplateBanner(true);
    }
  }, [template]);

  useEffect(() => {
    if (formula) {
      setLocked(initialLocked);
    }
  }, [formula, initialLocked]);

  const clearForm = () => {
    setSelectedCustomerId('');
    setItems([]);
    setCustomerQuery('');
    setShowAddCustomer(false);
    setShowTemplateBanner(false);
    setInsumoQuery('');
    setSelectedInsumoId('');
    setQuantity('');
    setUnit('mg');
    setShowAddInsumo(false);
    setItemError('');
    setSavedFormulaQuery('');
    setAppliedSavedFormula(null);
    setBudgetNumber('');
    setBQty('');
    setBUnit('caps');
    setBValue('');
    setBudgetItems([]);
    setSelectedBudgetIndex(null);
    setBudgetError('');
    setAttendantName('');
    setDeliveryDate('');
    setPaymentStatus('');
    setPaymentMethod('');
  };

  const allInsumos = (insumos as Insumo[]) ?? [];
  const selectedInsumo = allInsumos.find(m => m.id === selectedInsumoId) ?? null;
  const mq = stripDiacritics(insumoQuery.trim().toLowerCase());
  const filteredInsumos = mq
    ? allInsumos
        .filter(m => stripDiacritics((m.name ?? '').toLowerCase()).includes(mq))
        .sort((a, b) => {
          const nameA = stripDiacritics((a.name ?? '').toLowerCase());
          const nameB = stripDiacritics((b.name ?? '').toLowerCase());
          const diff = (nameB.startsWith(mq) ? 1 : 0) - (nameA.startsWith(mq) ? 1 : 0);
          if (diff !== 0) return diff;
          return nameA.localeCompare(nameB);
        })
    : [];

  const addIngredient = () => {
    if (!selectedInsumoId || !quantity) return;
    if (items.find(i => i.insumo_id === Number(selectedInsumoId))) {
      setItemError('Este insumo já foi adicionado à fórmula.');
      return;
    }
    setItems([...items, { insumo_id: Number(selectedInsumoId), insumo_name: selectedInsumo?.name ?? '', quantity: Number(quantity), unit }]);
    setSelectedInsumoId('');
    setInsumoQuery('');
    setQuantity('');
    setItemError('');
  };

  const allSavedFormulas = (savedFormulas as SavedFormula[]) ?? [];
  const sfq = stripDiacritics(savedFormulaQuery.trim().toLowerCase());
  const filteredSavedFormulas = sfq
    ? allSavedFormulas
        .filter(f => {
          const name = stripDiacritics((f.name ?? '').toLowerCase());
          const budgetNumber = stripDiacritics((f.budget_number ?? '').toLowerCase());
          return name.includes(sfq) || budgetNumber.includes(sfq);
        })
        .sort((a, b) => {
          const nameA = stripDiacritics((a.name ?? '').toLowerCase());
          const nameB = stripDiacritics((b.name ?? '').toLowerCase());
          const diff = (nameB.startsWith(sfq) ? 1 : 0) - (nameA.startsWith(sfq) ? 1 : 0);
          if (diff !== 0) return diff;
          return nameA.localeCompare(nameB);
        })
    : [];

  const applySavedFormula = (f: SavedFormula) => {
    setItems(f.items.map(i => ({ insumo_id: i.insumo_id, insumo_name: i.insumo_name ?? '', quantity: i.quantity, unit: i.unit ?? 'mg' })));
    setAppliedSavedFormula(f);
    setSavedFormulaQuery('');
    setItemError('');
    if (f.budget_items && f.budget_items.length > 0) {
      setBudgetItems(f.budget_items.map(b => ({ ...b })));
      setSelectedBudgetIndex(null);
    }
  };

  const addBudgetItem = () => {
    if (!bQty || !bValue) return;
    const next = [...budgetItems, { quantity: Number(bQty), unit: bUnit, value: parseCurrency(bValue) }];
    setBudgetItems(next);
    setBQty('');
    setBValue('');
    setBudgetError('');
  };

  const removeBudgetItem = (idx: number) => {
    const next = budgetItems.filter((_, i) => i !== idx);
    setBudgetItems(next);
    if (selectedBudgetIndex === idx) setSelectedBudgetIndex(null);
    else if (selectedBudgetIndex !== null && selectedBudgetIndex > idx) setSelectedBudgetIndex(selectedBudgetIndex - 1);
  };

  const canSave = !!selectedCustomerId && items.length > 0 &&
    !!budgetNumber && budgetItems.length > 0 &&
    !!attendantName;
  const canConfirm = canSave && !!paymentStatus && selectedBudgetIndex !== null && !!parseDateBR(deliveryDate);

  const buildPayload = (status: string, soloSelected = false) => {
    const payloadBudgetItems = soloSelected && selectedBudgetIndex !== null
      ? budgetItems.filter((_, i) => i === selectedBudgetIndex).map(bi => ({ ...bi, is_selected: true }))
      : budgetItems.map((bi, i) => ({ ...bi, is_selected: selectedBudgetIndex === i }));
    return {
      customer_id: selectedCustomerId as number,
      pharmacist_name: user.name,
      items: items.map(i => ({ insumo_id: i.insumo_id, quantity: i.quantity, unit: i.unit ?? 'mg' })),
      budget_number: budgetNumber || undefined,
      budget_items: payloadBudgetItems.length > 0 ? payloadBudgetItems : undefined,
      attendant_name: attendantName || undefined,
      delivery_date: parseDateBR(deliveryDate),
      payment_status: paymentStatus || undefined,
      payment_method: paymentMethod || null,
      delivery_status: deliveryStatus,
      status,
    };
  };

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      if (formula) await db.formulas.update(formula.id, buildPayload('pending'));
      else await db.formulas.add(buildPayload('pending'));
      onComplete('pending');
    } catch (err: any) {
      alert('Erro ao salvar: ' + (err?.message ?? 'verifique a conexão com o servidor.'));
    } finally { setSaving(false); }
  };

  const handleConfirm = async () => {
    if (!canConfirm) return;
    setSaving(true);
    try {
      if (formula) await db.formulas.update(formula.id, buildPayload('confirmed', true));
      else await db.formulas.add(buildPayload('confirmed', true));
      onComplete('confirmed');
    } catch (err: any) {
      alert('Erro ao confirmar: ' + (err?.message ?? 'verifique a conexão com o servidor.'));
    } finally { setSaving(false); }
  };

  const handleSaveConfirmed = async () => {
    if (!formula) return;
    setSaving(true);
    try {
      await db.formulas.update(formula.id, buildPayload(
        deliveryStatus === 'entregue' ? 'delivered' : 'confirmed'
      ));
      onComplete('confirmed');
    } catch (err: any) {
      alert('Erro ao salvar: ' + (err?.message ?? 'verifique a conexão com o servidor.'));
    } finally { setSaving(false); }
  };

  const handleCancelFormula = async () => {
    if (!formula || !cancelReason.trim()) return;
    setSaving(true);
    try {
      await db.formulas.update(formula.id, {
        ...buildPayload('cancelled'),
        cancel_reason: cancelReason.trim(),
        payment_status: paymentStatus || undefined,
        payment_method: paymentMethod || null,
      });
      onComplete('confirmed');
    } catch (err: any) {
      alert('Erro ao cancelar: ' + (err?.message ?? 'verifique a conexão com o servidor.'));
    } finally { setSaving(false); }
  };

  const allCustomers = (customers as Customer[]) ?? [];
  const selectedCustomer = allCustomers.find(c => c.id === selectedCustomerId) ?? null;
  const q = stripDiacritics(customerQuery.trim().toLowerCase());
  const qDigits = customerQuery.replace(/\D/g, '');
  const filteredCustomers = (q || qDigits)
    ? allCustomers
        .filter(c => {
          const name = stripDiacritics((c.name ?? '').toLowerCase());
          const matchesName = q && name.includes(q);
          const matchesPhone = qDigits && (c.phone ?? '').replace(/\D/g, '').includes(qDigits);
          return matchesName || matchesPhone;
        })
        .sort((a, b) => {
          const score = (c: Customer) => {
            const name = stripDiacritics((c.name ?? '').toLowerCase());
            const phone = (c.phone ?? '').replace(/\D/g, '');
            let s = 0;
            if (q && name.startsWith(q)) s += 4;
            else if (q && name.includes(q)) s += 3;
            if (qDigits && phone.startsWith(qDigits)) s += 2;
            else if (qDigits && phone.includes(qDigits)) s += 1;
            return s;
          };
          const diff = score(b) - score(a);
          if (diff !== 0) return diff;
          return (a.name ?? '').localeCompare(b.name ?? '');
        })
    : [];

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-zinc-900">
            {formula ? `Fórmula #${formula.id}` : template ? 'Repetir Fórmula' : 'Nova Fórmula'}
          </h2>
          <p className="text-zinc-500 text-sm">Farmacêutico: <strong>{user.name}</strong></p>
        </div>
        <div className="flex items-center gap-3">
          {formula && locked && !confirmed && !readOnly && (
            <button type="button" onClick={() => setLocked(false)}
              className="flex items-center gap-1.5 text-sm font-bold px-4 py-2 rounded-xl text-white hover:opacity-90 transition-all shadow-md"
              style={{ background: 'linear-gradient(135deg, #243465, #1A2850)' }}>
              <RefreshCw className="w-3.5 h-3.5" /> Editar
            </button>
          )}
          {formula && confirmed && (
            <button type="button" disabled={saving} onClick={() => setShowCancelModal(true)}
              className="flex items-center gap-1.5 text-sm font-medium px-4 py-2 rounded-xl border border-red-300 text-red-600 hover:bg-red-50 hover:border-red-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
              <X className="w-3.5 h-3.5" /> Cancelar
            </button>
          )}
          {!formula && (
            <>
              {(items.length > 0 || selectedCustomerId || budgetItems.length > 0 || budgetNumber || attendantName || deliveryDate || paymentStatus || paymentMethod) && (
                <button type="button" onClick={clearForm}
                  className="flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-xl border border-zinc-300 text-zinc-500 hover:border-red-300 hover:text-red-600 hover:bg-red-50 transition-all">
                  <Trash2 className="w-3.5 h-3.5" /> Limpar
                </button>
              )}
              <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center"><PlusCircle className="w-6 h-6 text-red-700" /></div>
            </>
          )}
        </div>
      </div>

      {showTemplateBanner && template && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium"
          style={{ background: '#EFF2FA', border: '1px solid #D0DCE8', color: '#243465' }}>
          <RefreshCw className="w-4 h-4 shrink-0" />
          Baseado na fórmula #{template.id} de <strong className="ml-1">{template.customer_name}</strong>.
          Verifique e ajuste antes de finalizar.
        </div>
      )}
      {formula && locked && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium"
          style={{ background: '#FEF0F2', border: '1px solid #FED7DB', color: '#C5243E' }}>
          <AlertCircle className="w-4 h-4 shrink-0" />
          {readOnly ? 'Fórmula no histórico — visualização somente leitura.' : confirmed ? 'Fórmula confirmada — apenas pagamento, forma de pagamento e andamento podem ser alterados.' : 'Fórmula em modo visualização. Clique em "Editar" para alterar os campos.'}
        </div>
      )}
      {/* Linha 1 — Seleção do Cliente */}
      <div className="bg-white p-5 rounded-2xl border border-zinc-200 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-zinc-900 text-sm">1. Cliente</h3>
          {!locked && (
            <button type="button" onClick={() => setShowAddCustomer(!showAddCustomer)}
              className="text-xs flex items-center gap-1 px-2 py-1 rounded-lg transition-colors font-medium"
              style={{ color: showAddCustomer ? '#C5243E' : '#243465', background: showAddCustomer ? '#FEF0F2' : '#EFF2FA' }}>
              <PlusCircle className="w-3 h-3" />{showAddCustomer ? 'Fechar' : '+ Novo cliente'}
            </button>
          )}
        </div>

        {showAddCustomer && (
          <div className="border border-dashed border-zinc-200 rounded-xl overflow-hidden mb-4">
            <CustomerManager compact onCreated={(c: Customer) => { reloadCustomers(); setSelectedCustomerId(c.id); setShowAddCustomer(false); setCustomerQuery(''); }} />
          </div>
        )}

        {selectedCustomer ? (
          <div className="flex items-center justify-between p-3 rounded-xl border border-zinc-200 bg-zinc-50">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-lg bg-red-100 flex items-center justify-center shrink-0">
                <Users className="w-4 h-4 text-red-700" />
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-zinc-900 text-sm truncate">{selectedCustomer.name}</p>
                <p className="text-xs text-zinc-500">📱 {selectedCustomer.phone}</p>
              </div>
            </div>
            {!locked && (
              <button type="button" onClick={() => { setSelectedCustomerId(''); setCustomerQuery(''); }}
                className="p-2 text-zinc-300 hover:text-red-500 transition-colors ml-3" title="Trocar cliente">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        ) : (
          <div className="relative">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-zinc-400" />
            <input
              className="w-full pl-9 pr-9 py-2 rounded-lg border border-zinc-300 focus:ring-2 focus:ring-red-500 outline-none text-sm disabled:opacity-60 disabled:cursor-not-allowed"
              placeholder="Buscar cliente por nome ou telefone..."
              value={customerQuery}
              disabled={locked}
              onChange={e => { setCustomerQuery(e.target.value); setCustomerFocusIdx(-1); }}
              onKeyDown={e => {
                if (!filteredCustomers.length) return;
                if (e.key === 'ArrowDown') {
                  e.preventDefault();
                  setCustomerFocusIdx(prev => (prev < filteredCustomers.length - 1 ? prev + 1 : 0));
                } else if (e.key === 'ArrowUp') {
                  e.preventDefault();
                  setCustomerFocusIdx(prev => (prev > 0 ? prev - 1 : filteredCustomers.length - 1));
                } else if (e.key === 'Enter') {
                  e.preventDefault();
                  const target = customerFocusIdx >= 0 ? filteredCustomers[customerFocusIdx] : filteredCustomers[0];
                  if (target) { setSelectedCustomerId(target.id); setCustomerQuery(''); setCustomerFocusIdx(-1); }
                } else if (e.key === 'Escape') {
                  setCustomerQuery(''); setCustomerFocusIdx(-1);
                }
              }}
            />
            {customerQuery && (
              <button onClick={() => { setCustomerQuery(''); setCustomerFocusIdx(-1); }} title="Limpar busca"
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-zinc-400 hover:text-red-600 transition-colors">
                <X className="w-4 h-4" />
              </button>
            )}
            {filteredCustomers.length > 0 && (
              <div className="absolute left-0 right-0 mt-1 bg-white border border-zinc-200 rounded-xl shadow-lg overflow-hidden z-10 max-h-64 overflow-y-auto">
                {filteredCustomers.map((c, idx) => (
                  <button key={c.id} type="button" onClick={() => { setSelectedCustomerId(c.id); setCustomerQuery(''); setCustomerFocusIdx(-1); }}
                    className={`w-full text-left px-3 py-2 transition-colors flex items-center gap-2 ${idx === customerFocusIdx ? 'bg-red-100 text-red-900 font-medium' : 'hover:bg-red-50'}`}>
                    <Users className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                    <span className="text-sm truncate flex-1">{c.name}</span>
                    <span className="text-xs text-zinc-400 shrink-0">{c.phone}</span>
                  </button>
                ))}
              </div>
            )}
            {q || qDigits ? (
              filteredCustomers.length === 0 && (
                <p className="text-xs text-zinc-400 mt-1 px-1">Nenhum cliente encontrado.</p>
              )
            ) : (
              <p className="text-xs text-zinc-400 mt-1 px-1">Digite para buscar por nome ou telefone.</p>
            )}
          </div>
        )}
      </div>
      {/* Linha 2 — Insumo */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
      <div className={`bg-white p-5 rounded-2xl border border-zinc-200 shadow-sm ${locked ? 'lg:col-span-2' : ''}`}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-zinc-900 text-sm">2.1 Insumo</h3>
          {!locked && (
            <button type="button" onClick={() => setShowAddInsumo(!showAddInsumo)}
              className="text-xs flex items-center gap-1 px-2 py-1 rounded-lg transition-colors font-medium"
              style={{ color: showAddInsumo ? '#C5243E' : '#243465', background: showAddInsumo ? '#FEF0F2' : '#EFF2FA' }}>
              <PlusCircle className="w-3 h-3" />{showAddInsumo ? 'Fechar' : '+ Novo insumo'}
            </button>
          )}
        </div>

        {showAddInsumo && (
          <div className="border border-dashed border-zinc-200 rounded-xl overflow-hidden mb-4">
            <InsumoManager compact onCreated={(m: Insumo) => { reloadInsumos(); setSelectedInsumoId(m.id); setShowAddInsumo(false); setInsumoQuery(''); }} />
          </div>
        )}

        {selectedInsumo ? (
          <div className="flex items-center justify-between p-3 rounded-xl border border-zinc-200 bg-zinc-50 mb-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
                <ClipboardList className="w-4 h-4 text-red-700" />
              </div>
              <p className="font-semibold text-zinc-900 text-sm truncate">{selectedInsumo.name}</p>
            </div>
            {!locked && (
              <button type="button" onClick={() => { setSelectedInsumoId(''); setInsumoQuery(''); }}
                className="p-2 text-zinc-300 hover:text-red-500 transition-colors ml-3" title="Trocar insumo">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        ) : (
          <div className="relative mb-4">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-zinc-400" />
            <input
              className="w-full pl-9 pr-9 py-2 rounded-lg border border-zinc-300 focus:ring-2 focus:ring-red-500 outline-none text-sm disabled:opacity-60 disabled:cursor-not-allowed"
              placeholder="Buscar insumo por nome..."
              value={insumoQuery}
              disabled={locked}
              onChange={e => { setInsumoQuery(e.target.value); setInsumoFocusIdx(-1); }}
              onKeyDown={e => {
                if (!filteredInsumos.length) return;
                if (e.key === 'ArrowDown') {
                  e.preventDefault();
                  setInsumoFocusIdx(prev => (prev < filteredInsumos.length - 1 ? prev + 1 : 0));
                } else if (e.key === 'ArrowUp') {
                  e.preventDefault();
                  setInsumoFocusIdx(prev => (prev > 0 ? prev - 1 : filteredInsumos.length - 1));
                } else if (e.key === 'Enter') {
                  e.preventDefault();
                  const target = insumoFocusIdx >= 0 ? filteredInsumos[insumoFocusIdx] : filteredInsumos[0];
                  if (target) { setSelectedInsumoId(target.id); setInsumoQuery(''); setInsumoFocusIdx(-1); }
                } else if (e.key === 'Escape') {
                  setInsumoQuery(''); setInsumoFocusIdx(-1);
                }
              }}
            />
            {insumoQuery && (
              <button onClick={() => { setInsumoQuery(''); setInsumoFocusIdx(-1); }} title="Limpar busca"
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-zinc-400 hover:text-red-600 transition-colors">
                <X className="w-4 h-4" />
              </button>
            )}
            {filteredInsumos.length > 0 && (
              <div className="absolute left-0 right-0 mt-1 bg-white border border-zinc-200 rounded-xl shadow-lg overflow-hidden z-10 max-h-64 overflow-y-auto">
                {filteredInsumos.map((m, idx) => (
                  <button key={m.id} type="button" onClick={() => { setSelectedInsumoId(m.id); setInsumoQuery(''); setInsumoFocusIdx(-1); }}
                    className={`w-full text-left px-3 py-2 transition-colors flex items-center gap-2 ${idx === insumoFocusIdx ? 'bg-red-100 text-red-900 font-medium' : 'hover:bg-red-50'}`}>
                    <ClipboardList className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                    <span className="text-sm truncate flex-1">{m.name}</span>
                  </button>
                ))}
              </div>
            )}
            {mq && filteredInsumos.length === 0 && (
              <p className="text-xs text-zinc-400 mt-1 px-1">Nenhum insumo encontrado.</p>
            )}
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
          <div className="sm:w-32">
            <label className="block text-xs font-semibold text-zinc-500 uppercase mb-1">Quantidade</label>
            <input
              inputMode="numeric"
              maxLength={4}
              className="w-full px-3 py-2 rounded-lg border border-zinc-300 focus:ring-2 focus:ring-red-500 outline-none text-sm text-right disabled:opacity-60 disabled:cursor-not-allowed"
              placeholder="0"
              value={quantity}
              disabled={locked}
              onChange={e => setQuantity(e.target.value.replace(/\D/g, '').slice(0, 4))}
              onKeyDown={e => {
                if (e.key === 'Enter' && selectedInsumoId && quantity) {
                  e.preventDefault();
                  addIngredient();
                }
              }}
            />
          </div>
          <div className="sm:w-36">
            <label className="block text-xs font-semibold text-zinc-500 uppercase mb-1">Unidade</label>
            <select className="w-full px-3 py-2 rounded-lg border border-zinc-300 focus:ring-2 focus:ring-red-500 outline-none bg-white text-sm disabled:opacity-60 disabled:cursor-not-allowed"
              value={unit} disabled={locked} onChange={e => setUnit(e.target.value)}>
              <option value="g">g</option>
              <option value="mcg">mcg</option>
              <option value="mg">mg</option>
              <option value="ml">ml</option>
              <option value="ui">ui</option>
            </select>
          </div>
          <div className="flex-1 space-y-1">
            {itemError && <p className="text-xs text-red-600 font-medium bg-red-50 px-2 py-1 rounded">{itemError}</p>}
            {!locked && (
              <button type="button" disabled={!selectedInsumoId || !quantity} onClick={addIngredient}
                className="w-full text-white py-2 rounded-lg font-medium text-sm hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ background: 'linear-gradient(135deg, #243465, #1A2850)' }}>
                + Adicionar à fórmula
              </button>
            )}
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-zinc-100">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">Insumos adicionados</h4>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: '#FEF0F2', color: '#C5243E' }}>
              {items.length} {items.length === 1 ? 'insumo' : 'insumos'}
            </span>
          </div>

          {items.length === 0 ? (
            <p className="text-sm text-zinc-400">Nenhum insumo adicionado ainda.</p>
          ) : (
            <div className="space-y-2">
              {items.map((item, idx) => (
                <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} key={item.insumo_id}
                  className="flex items-center justify-between p-3 rounded-xl border border-zinc-100"
                  style={{ background: idx % 2 === 0 ? '#f8faff' : '#fff' }}>
                  <div className="min-w-0">
                    <p className="font-semibold text-zinc-900 text-sm truncate">{item.insumo_name}</p>
                    <p className="text-xs text-zinc-400">{formatQuantity(item.quantity)} {item.unit ?? 'mg'}</p>
                  </div>
                  {!locked && (
                    <button type="button" onClick={() => { setItems(items.filter((_, i) => i !== idx)); setItemError(''); }}
                      className="text-zinc-300 hover:text-red-500 transition-colors ml-4 p-1" title="Remover insumo">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Linha 2.2 — Fórmula Salva */}
      {!locked && (
        <div className="bg-white p-5 rounded-2xl border border-zinc-200 shadow-sm">
          <h3 className="font-semibold text-zinc-900 text-sm mb-1">2.2 Fórmula Salva</h3>
          <p className="text-xs text-zinc-500 mb-4">Selecione uma fórmula salva para preencher automaticamente os insumos (substitui a lista atual).</p>

          {appliedSavedFormula && (
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium mb-4"
              style={{ background: '#EFF2FA', border: '1px solid #D0DCE8', color: '#243465' }}>
              <RefreshCw className="w-4 h-4 shrink-0" />
              <span className="flex-1 min-w-0">
                Fórmula salva <strong>{appliedSavedFormula.name}</strong> aplicada — os insumos da lista foram substituídos.
              </span>
              <button type="button" onClick={() => setAppliedSavedFormula(null)}
                className="text-zinc-400 hover:text-red-600 transition-colors" title="Dispensar aviso">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {allSavedFormulas.length === 0 ? (
            <p className="text-sm text-zinc-400">Nenhuma fórmula salva cadastrada. Cadastre uma na tela "Fórmulas Salvas".</p>
          ) : (
            <div className="relative">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-zinc-400" />
              <input
                className="w-full pl-9 pr-9 py-2 rounded-lg border border-zinc-300 focus:ring-2 focus:ring-red-500 outline-none text-sm"
                placeholder="Buscar fórmula salva por nome ou número do orçamento..."
                value={savedFormulaQuery}
                onChange={e => { setSavedFormulaQuery(e.target.value); setSavedFormulaFocusIdx(-1); }}
                onKeyDown={e => {
                  if (!filteredSavedFormulas.length) return;
                  if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    setSavedFormulaFocusIdx(prev => (prev < filteredSavedFormulas.length - 1 ? prev + 1 : 0));
                  } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    setSavedFormulaFocusIdx(prev => (prev > 0 ? prev - 1 : filteredSavedFormulas.length - 1));
                  } else if (e.key === 'Enter') {
                    e.preventDefault();
                    const target = savedFormulaFocusIdx >= 0 ? filteredSavedFormulas[savedFormulaFocusIdx] : filteredSavedFormulas[0];
                    if (target) { applySavedFormula(target); setSavedFormulaFocusIdx(-1); }
                  } else if (e.key === 'Escape') {
                    setSavedFormulaQuery(''); setSavedFormulaFocusIdx(-1);
                  }
                }}
              />
              {savedFormulaQuery && (
                <button onClick={() => { setSavedFormulaQuery(''); setSavedFormulaFocusIdx(-1); }} title="Limpar busca"
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-zinc-400 hover:text-red-600 transition-colors">
                  <X className="w-4 h-4" />
                </button>
              )}
              {filteredSavedFormulas.length > 0 && (
                <div className="absolute left-0 right-0 mt-1 bg-white border border-zinc-200 rounded-xl shadow-lg overflow-hidden z-10 max-h-64 overflow-y-auto">
                  {filteredSavedFormulas.map((f, idx) => (
                    <button key={f.id} type="button" onClick={() => { applySavedFormula(f); setSavedFormulaFocusIdx(-1); }}
                      className={`w-full text-left px-3 py-2 transition-colors flex items-center gap-2 ${idx === savedFormulaFocusIdx ? 'bg-red-100 text-red-900 font-medium' : 'hover:bg-red-50'}`}>
                      <Bookmark className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                      <div className="flex items-center gap-2 w-full min-w-0">
                        <span className="text-sm truncate flex-1">{f.name}</span>
                        {f.budget_number && (
                          <span className="text-xs text-zinc-500 shrink-0 whitespace-nowrap">
                            {f.budget_number}
                          </span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
              {sfq && filteredSavedFormulas.length === 0 && (
                <p className="text-xs text-zinc-400 mt-1 px-1">Nenhuma fórmula salva encontrada.</p>
              )}
            </div>
          )}
        </div>
      )}
      </div>

      {/* Linha 3 — Orçamento */}
      <div className="bg-white p-5 rounded-2xl border border-zinc-200 shadow-sm">
        <h3 className="font-semibold text-zinc-900 text-sm mb-4">3. Orçamento</h3>
        <div className="grid grid-cols-1 md:grid-cols-[auto_1fr] gap-6 items-end">
          <div className="w-36">
            <label className="block text-xs font-semibold text-zinc-500 uppercase mb-1">Número de orçamento</label>
            <input
              inputMode="numeric"
              maxLength={6}
              className="w-full px-3 py-2 rounded-lg border border-zinc-300 focus:ring-2 focus:ring-red-500 outline-none text-sm text-right disabled:opacity-60 disabled:cursor-not-allowed"
              placeholder="000000"
              value={budgetNumber}
              disabled={locked}
              onChange={e => setBudgetNumber(e.target.value.replace(/\D/g, '').slice(0, 6))}
            />
          </div>

          <div>
            <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
              <div className="sm:w-28">
                <label className="block text-xs font-semibold text-zinc-500 uppercase mb-1">Quantidade</label>
                <input
                  inputMode="numeric"
                  maxLength={3}
                  className="w-full px-3 py-2 rounded-lg border border-zinc-300 focus:ring-2 focus:ring-red-500 outline-none text-sm text-right disabled:opacity-60 disabled:cursor-not-allowed"
                  placeholder="0"
                  value={bQty}
                  disabled={locked}
                  onChange={e => { setBudgetError(''); setBQty(e.target.value.replace(/\D/g, '').slice(0, 3)); }}
                />
              </div>
              <div className="sm:w-24">
                <label className="block text-xs font-semibold text-zinc-500 uppercase mb-1">Unidade</label>
                <select className="w-full px-3 py-2 rounded-lg border border-zinc-300 focus:ring-2 focus:ring-red-500 outline-none bg-white text-sm disabled:opacity-60 disabled:cursor-not-allowed"
                  value={bUnit} disabled={locked} onChange={e => setBUnit(e.target.value)}>
                  <option value="caps">caps</option>
                  <option value="dose">dose</option>
                  <option value="g">g</option>
                  <option value="ml">ml</option>
                </select>
              </div>
              <div className="flex-1">
                <label className="block text-xs font-semibold text-zinc-500 uppercase mb-1">Valor (R$)</label>
                <input
                  inputMode="numeric"
                  className="w-full px-3 py-2 rounded-lg border border-zinc-300 focus:ring-2 focus:ring-red-500 outline-none text-sm text-right disabled:opacity-60 disabled:cursor-not-allowed"
                  placeholder="0"
                  value={bValue}
                  disabled={locked}
                  onChange={e => { setBudgetError(''); setBValue(formatCurrency(e.target.value)); }}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && bQty && bValue) {
                      e.preventDefault();
                      addBudgetItem();
                    }
                  }}
                />
              </div>
              <div className="space-y-1">
                {!locked && (
                  <button type="button" disabled={!bQty || !bValue} onClick={addBudgetItem}
                    className="w-full sm:w-auto text-white px-4 py-2 rounded-lg font-medium text-sm hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                    style={{ background: 'linear-gradient(135deg, #243465, #1A2850)' }}>
                    + Adicionar
                  </button>
                )}
                {budgetError && <p className="text-xs text-red-600 font-medium bg-red-50 px-2 py-1 rounded">{budgetError}</p>}
              </div>
            </div>

            {budgetItems.length > 0 && (
              <div className="mt-3 space-y-2">
                {budgetItems.map((bi, idx) => {
                  const isSelected = selectedBudgetIndex === idx;
                  return (
                    <div key={idx}
                      tabIndex={locked ? -1 : 0}
                      role="radio"
                      aria-checked={isSelected}
                      className={`flex items-center gap-3 p-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-red-500 ${!locked ? 'cursor-pointer' : ''} ${isSelected ? 'border-red-300' : 'border-zinc-100'}`}
                      style={{ background: isSelected ? '#fff0f3' : (idx % 2 === 0 ? '#f8faff' : '#fff') }}
                      onClick={() => { if (!locked) setSelectedBudgetIndex(idx); }}
                      onKeyDown={e => {
                        if (locked) return;
                        if (e.key === ' ' || e.key === 'Enter') {
                          e.preventDefault();
                          setSelectedBudgetIndex(idx);
                        } else if (e.key === 'ArrowDown' && idx < budgetItems.length - 1) {
                          e.preventDefault();
                          setSelectedBudgetIndex(idx + 1);
                        } else if (e.key === 'ArrowUp' && idx > 0) {
                          e.preventDefault();
                          setSelectedBudgetIndex(idx - 1);
                        }
                      }}>
                      <input type="radio" name="budgetSelection" className="w-4 h-4 accent-[#C5243E] shrink-0"
                        checked={isSelected}
                        disabled={locked}
                        onChange={() => { if (!locked) setSelectedBudgetIndex(idx); }}
                        onClick={e => e.stopPropagation()} />
                      <p className="text-sm text-zinc-700 flex-1 min-w-0">
                        <strong>{formatQuantity(bi.quantity)}</strong> {bi.unit} · <span className="font-semibold text-zinc-900">R$ {bi.value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </p>
                      {!locked && (
                        <button type="button" onClick={e => { e.stopPropagation(); removeBudgetItem(idx); }}
                          className="text-zinc-300 hover:text-red-500 transition-colors ml-4 p-1" title="Remover item do orçamento">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bloco 4 — Informações */}
      <div className="bg-white p-5 rounded-2xl border border-zinc-200 shadow-sm">
        <h3 className="font-semibold text-zinc-900 text-sm mb-4">4. Informações</h3>
        <div>
          <label className="block text-xs font-semibold text-zinc-500 uppercase mb-1">Nome do Atendente da PM</label>
          <input
            type="text"
            maxLength={100}
            className="w-full px-3 py-2 rounded-lg border border-zinc-300 focus:ring-2 focus:ring-red-500 outline-none text-sm disabled:opacity-60 disabled:cursor-not-allowed"
            placeholder="Nome do atendente..."
            value={attendantName}
            disabled={locked}
            onChange={e => setAttendantName(e.target.value)}
          />
        </div>
      </div>

      {/* Bloco 5 — Finalizar */}
      <div className="bg-white p-5 rounded-2xl border border-zinc-200 shadow-sm">
        <h3 className="font-semibold text-zinc-900 text-sm mb-4">5. Finalizar</h3>
        <div className={(confirmed || readOnly) ? 'grid grid-cols-1 gap-6 md:grid-cols-3' : 'grid grid-cols-1 md:grid-cols-2 gap-6'}>
          <div>
            <label className="block text-xs font-semibold text-zinc-500 uppercase mb-1">Previsão de entrega</label>
            <div className="relative">
              <input
                type="text"
                inputMode="numeric"
                maxLength={10}
                placeholder="DD/MM/AAAA"
                className="w-full pr-10 px-3 py-2 rounded-lg border border-zinc-300 focus:ring-2 focus:ring-red-500 outline-none text-sm disabled:opacity-60 disabled:cursor-not-allowed"
                value={deliveryDate}
                disabled={locked}
                onChange={e => {
                  const masked = formatDateBR(e.target.value);
                  setDeliveryDate(masked);
                  if (dateInputRef.current) dateInputRef.current.value = parseDateBR(masked) ?? '';
                }}
              />
              {!locked && deliveryDate && (
                <button type="button" onClick={() => { setDeliveryDate(''); if (dateInputRef.current) dateInputRef.current.value = ''; }}
                  className="absolute right-9 top-1/2 -translate-y-1/2 p-1 text-zinc-400 hover:text-red-600 transition-colors" title="Limpar data">
                  <X className="w-4 h-4" />
                </button>
              )}
              <button type="button" onClick={() => dateInputRef.current?.showPicker()} disabled={locked}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-zinc-400 hover:text-red-700 transition-colors rounded-lg hover:bg-red-50 disabled:opacity-40 disabled:cursor-not-allowed" title="Abrir calendário">
                <Calendar className="w-4 h-4" />
              </button>
            </div>
            <input
              ref={dateInputRef}
              type="date"
              className="sr-only"
              tabIndex={-1}
              aria-hidden="true"
              onChange={e => setDeliveryDate(e.target.value ? formatDateToBR(e.target.value) : '')}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-zinc-500 uppercase mb-1">Pagamento</label>
            <select className="w-full px-3 py-2 rounded-lg border border-zinc-300 focus:ring-2 focus:ring-red-500 outline-none bg-white text-sm disabled:opacity-60 disabled:cursor-not-allowed"
              value={paymentStatus} disabled={locked && !confirmed} onChange={e => setPaymentStatus(e.target.value)}>
              <option value="">Selecione...</option>
              <option value="pago">Pago</option>
              <option value="parcial">Parcial</option>
              <option value="nao_pago">Não Pago</option>
              <option value="pagar_na_retirada">Pagar na retirada</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-zinc-500 uppercase mb-1">Forma de pagamento</label>
            <select className="w-full px-3 py-2 rounded-lg border border-zinc-300 focus:ring-2 focus:ring-red-500 outline-none bg-white text-sm disabled:opacity-60 disabled:cursor-not-allowed"
              value={paymentMethod} disabled={locked && !confirmed} onChange={e => setPaymentMethod(e.target.value)}>
              <option value="">Selecione (opcional)...</option>
              <option value="cartao">Cartão</option>
              <option value="dinheiro">Dinheiro</option>
              <option value="pix">Pix</option>
            </select>
          </div>
          {confirmed && (
            <div>
              <label className="block text-xs font-semibold text-zinc-500 uppercase mb-1">Andamento</label>
              <select className="w-full px-3 py-2 rounded-lg border border-zinc-300 focus:ring-2 focus:ring-red-500 outline-none bg-white text-sm disabled:opacity-60 disabled:cursor-not-allowed"
                value={deliveryStatus} disabled={!paymentStatus} onChange={e => setDeliveryStatus(e.target.value)}>
                <option value="">Selecione...</option>
                <option value="em_producao">Em produção</option>
                <option value="aguardando_retirada">Aguardando retirada</option>
                <option value="aguardando_envio">Aguardando envio</option>
                <option value="entregue">Entregue</option>
              </select>
            </div>
          )}
          {readOnly && (
            <div>
              <label className="block text-xs font-semibold text-zinc-500 uppercase mb-1">Andamento</label>
              <select className="w-full px-3 py-2 rounded-lg border border-zinc-300 focus:ring-2 focus:ring-red-500 outline-none bg-white text-sm disabled:opacity-60 disabled:cursor-not-allowed"
                value={deliveryStatus} disabled>
                <option value="">Não definido</option>
                <option value="em_producao">Em produção</option>
                <option value="aguardando_retirada">Aguardando retirada</option>
                <option value="aguardando_envio">Aguardando envio</option>
                <option value="entregue">Entregue</option>
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Bloco 6 — Ações */}
      {!locked && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <button type="button" disabled={!canSave || saving} onClick={handleSave}
              className="w-full disabled:opacity-50 disabled:cursor-not-allowed text-white py-3.5 rounded-xl font-bold text-base hover:opacity-90 transition-all shadow-lg"
              style={{ background: 'linear-gradient(135deg, #243465, #1A2850)' }}>
              {saving ? 'Salvando...' : '💾 Salvar'}
            </button>
            <p className="text-center text-xs text-zinc-400 mt-2">
              {canSave ? 'Pronto para salvar' : 'Preencha os blocos 1 a 4 (cliente, insumos, orçamento e informações)'}
            </p>
          </div>
          <div>
            <button type="button" disabled={!canConfirm || saving} onClick={handleConfirm}
              className="w-full disabled:opacity-50 disabled:cursor-not-allowed text-white py-3.5 rounded-xl font-bold text-base hover:opacity-90 transition-all shadow-lg"
              style={{ background: 'linear-gradient(135deg, #C5243E, #9B1A2E)' }}>
              {saving ? 'Salvando...' : '✓ Confirmar'}
            </button>
            <p className="text-center text-xs text-zinc-400 mt-2">
              {canConfirm
                ? 'Pronto para confirmar'
                : budgetItems.length > 0 && selectedBudgetIndex === null
                  ? 'Selecione um orçamento (marcador ao lado) e preencha os demais blocos'
                  : 'Preencha cliente, insumos, orçamento, informações e o pagamento (blocos 1 a 5)'}
            </p>
          </div>
        </div>
      )}

      {formula && confirmed && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="md:col-span-2">
            <button type="button" disabled={saving} onClick={handleSaveConfirmed}
              className="w-full text-white py-3.5 rounded-xl font-bold text-base hover:opacity-90 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: 'linear-gradient(135deg, #243465, #1A2850)' }}>
              {saving ? 'Salvando...' : '💾 Salvar alterações'}
            </button>
          </div>
        </div>
      )}

      {showCancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => { if (!saving) setShowCancelModal(false); }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center shrink-0">
                <X className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 className="font-bold text-zinc-900 text-lg">Cancelar fórmula</h3>
                <p className="text-xs text-zinc-500">A fórmula sairá da fila de confirmadas.</p>
              </div>
            </div>
            <label className="block text-xs font-semibold text-zinc-500 uppercase mb-1">Justificativa (obrigatória)</label>
            <textarea
              className="w-full px-3 py-2 rounded-lg border border-zinc-300 focus:ring-2 focus:ring-red-500 outline-none text-sm min-h-[90px] resize-none disabled:opacity-60 disabled:cursor-not-allowed"
              placeholder="Informe o motivo do cancelamento..."
              value={cancelReason} disabled={saving}
              onChange={e => setCancelReason(e.target.value)} />
            <div className="flex gap-3 mt-4">
              <button type="button" disabled={saving} onClick={() => setShowCancelModal(false)}
                className="flex-1 py-2.5 rounded-xl border border-zinc-300 text-zinc-600 font-semibold text-sm hover:bg-zinc-50 transition-all disabled:opacity-50">
                Voltar
              </button>
              <button type="button" disabled={!cancelReason.trim() || saving} onClick={handleCancelFormula}
                className="flex-1 py-2.5 rounded-xl text-white font-semibold text-sm hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ background: 'linear-gradient(135deg, #C5243E, #9B1A2E)' }}>
                {saving ? 'Cancelando...' : 'Confirmar cancelamento'}
              </button>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}