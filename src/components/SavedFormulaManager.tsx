import React, { useMemo, useRef, useState, useEffect } from 'react';
import { CheckCircle, Trash2, Search, X, PlusCircle, ClipboardList } from 'lucide-react';
import { motion } from 'motion/react';
import { db } from '../services/lanDatabase';
import { SavedFormula, SavedFormulaItem, Insumo, BudgetItem } from '../types';
import { stripDiacritics, formatQuantity, formatCurrency, parseCurrency, currencyCaretPosition, formatQuantityInput, parseQuantity, formatUnit } from '../utils/format';
import { useData } from '../hooks/useData';
import { useFormDraft } from '../context/FormDraftContext';
import { LoadingState, ErrorState } from './Feedback';
import { HighlightMatch } from './HighlightMatch';
import { AdminAuthModal } from './AdminAuthModal';
import { InsumoManager } from './InsumoManager';
import { COLORS, GRADIENTS } from '../../config/branding';
import { UnitCycle, INGREDIENT_UNITS, BUDGET_UNITS } from './UnitCycle';
import { useAuth } from '../context/AuthContext';

export function SavedFormulaManager() {
  const { data: formulas, loading, error, reload } = useData(() => db.savedFormulas.list());
  const { data: insumos, reload: reloadInsumos } = useData(() => db.insumos.list());
  const { sessionToken } = useAuth();
  const [name, setName] = useState('');
  const [budgetNumber, setBudgetNumber] = useState('');
  const [items, setItems] = useState<SavedFormulaItem[]>([]);
  const [editingIngredientId, setEditingIngredientId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [insumoQuery, setInsumoQuery] = useState('');
  const [selectedInsumoId, setSelectedInsumoId] = useState<number | ''>('');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState('mg');
  const [budgetItems, setBudgetItems] = useState<BudgetItem[]>([]);
  const [bQty, setBQty] = useState('');
  const [bUnit, setBUnit] = useState('doses');
  const [bValue, setBValue] = useState('');
  const budgetValueRef = useRef<HTMLInputElement>(null);
  const [insumoFocusIdx, setInsumoFocusIdx] = useState(-1);
  const pendingInsumoName = useRef('');
  const insumoQueryRef = useRef<HTMLInputElement>(null);
  const quantityRef = useRef<HTMLInputElement>(null);
  const bQtyRef = useRef<HTMLInputElement>(null);
  const insumoListRef = useRef<HTMLDivElement>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [success, setSuccess] = useState<string | null>(null);
  const [tab, setTab] = useState<'list' | 'create'>('list');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<{ key: 'name' | 'created_at'; dir: 'asc' | 'desc' }>({ key: 'name', dir: 'asc' });
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);
  const [showAddInsumo, setShowAddInsumo] = useState(false);
  const { getDraft, saveDraft, removeDraft } = useFormDraft();
  const DRAFT_KEY = 'savedFormula';

  const draftRef = useRef({ name, budgetNumber, items, budgetItems, tab });
  const skipFirstCleanupRef = useRef(true);
  useEffect(() => { draftRef.current = { name, budgetNumber, items, budgetItems, tab }; });

  useEffect(() => {
    const draft = getDraft<{
      name: string; budgetNumber: string; items: SavedFormulaItem[];
      budgetItems: BudgetItem[]; tab: 'list' | 'create';
    }>(DRAFT_KEY);
    if (!draft) return;
    if (draft.name) setName(draft.name);
    if (draft.budgetNumber) setBudgetNumber(draft.budgetNumber);
    if (draft.items?.length) setItems(draft.items);
    if (draft.budgetItems?.length) setBudgetItems(draft.budgetItems);
    if (draft.tab) setTab(draft.tab);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    return () => {
      if (skipFirstCleanupRef.current) { skipFirstCleanupRef.current = false; return; }
      saveDraft(DRAFT_KEY, draftRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const reset = () => { resetIngredientFields(); setName(''); setBudgetNumber(''); setItems([]); setEditingId(null); setBudgetItems([]); setBQty(''); setBUnit('doses'); setBValue(''); setSuccess(null); };

  const allFormulas = (formulas as SavedFormula[]) ?? [];
  const allInsumos = (insumos as Insumo[]) ?? [];
  const selectedInsumo = allInsumos.find(m => m.id === selectedInsumoId) ?? null;
  const editingIngredient = items.find(item => item.insumo_id === editingIngredientId);
  // Preserva quantidades decimais existentes ao alterar apenas a unidade.
  const ingredientQuantity = editingIngredient && quantity === formatQuantity(editingIngredient.quantity)
    ? Number(editingIngredient.quantity) : parseQuantity(quantity);
  const mq = useMemo(() => stripDiacritics(insumoQuery.trim().toLowerCase()), [insumoQuery]);
  const filteredInsumos = useMemo(() => {
    if (!mq) return [];
    return allInsumos
      .filter(m => stripDiacritics((m.name ?? '').toLowerCase()).includes(mq))
      .sort((a, b) => {
        const nameA = stripDiacritics((a.name ?? '').toLowerCase());
        const nameB = stripDiacritics((b.name ?? '').toLowerCase());
        const diff = (nameB.startsWith(mq) ? 1 : 0) - (nameA.startsWith(mq) ? 1 : 0);
        if (diff !== 0) return diff;
        return nameA.localeCompare(nameB);
      });
  }, [allInsumos, mq]);

  const focusListOption = (idx: number) => {
    insumoListRef.current?.querySelector<HTMLButtonElement>(`[data-idx="${idx}"]`)?.focus();
  };
  const moveListFocus = (idx: number, dir: 1 | -1, length: number) => {
    const ni = dir === 1 ? (idx < length - 1 ? idx + 1 : 0) : (idx > 0 ? idx - 1 : length - 1);
    setInsumoFocusIdx(ni);
    focusListOption(ni);
  };

  const resetIngredientFields = () => {
    setEditingIngredientId(null);
    setSelectedInsumoId('');
    setInsumoQuery('');
    setInsumoFocusIdx(-1);
    setQuantity('');
    setUnit('mg');
    setShowAddInsumo(false);
    setFormError('');
  };

  const startIngredientEdit = (item: SavedFormulaItem) => {
    if (saving) return;
    resetIngredientFields();
    setEditingIngredientId(item.insumo_id);
    setQuantity(formatQuantity(item.quantity));
    setUnit(item.unit ?? 'mg');
    requestAnimationFrame(() => {
      quantityRef.current?.focus();
      quantityRef.current?.select();
    });
  };

  const cancelIngredientEdit = () => {
    resetIngredientFields();
    requestAnimationFrame(() => insumoQueryRef.current?.focus());
  };

  const updateIngredient = () => {
    if (saving || !editingIngredient) return;
    const parsedQuantity = ingredientQuantity;
    if (parsedQuantity <= 0) { setFormError('Informe uma quantidade maior que zero.'); return; }
    setItems(current => current.map(item => item.insumo_id === editingIngredientId
      ? { ...item, quantity: parsedQuantity, unit } : item));
    cancelIngredientEdit();
  };

  const removeIngredient = (id: number) => {
    if (saving) return;
    setItems(current => current.filter(item => item.insumo_id !== id));
    if (editingIngredientId === id) cancelIngredientEdit();
    setFormError('');
  };

  const addItem = () => {
    if (saving || editingIngredientId !== null || !selectedInsumoId) return;
    const parsedQuantity = parseQuantity(quantity);
    if (parsedQuantity <= 0) { setFormError('Informe uma quantidade maior que zero.'); return; }
    if (items.find(i => i.insumo_id === Number(selectedInsumoId))) {
      setFormError('Este insumo já foi adicionado à fórmula.');
      return;
    }
    setItems([...items, { insumo_id: Number(selectedInsumoId), insumo_name: selectedInsumo?.name ?? '', quantity: parsedQuantity, unit }]);
    setSelectedInsumoId('');
    setInsumoQuery('');
    setQuantity('');
    setUnit('mg');
    setFormError('');
    requestAnimationFrame(() => insumoQueryRef.current?.focus());
  };

  const addBudgetItem = () => {
    if (!bQty || !bValue) return;
    const next = [...budgetItems, { quantity: parseQuantity(bQty), unit: bUnit, value: parseCurrency(bValue) }];
    setBudgetItems(next);
    setBQty('');
    setBValue('');
    setFormError('');
    requestAnimationFrame(() => bQtyRef.current?.focus());
  };

  const removeBudgetItem = (idx: number) => {
    setBudgetItems(budgetItems.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    if (editingIngredientId !== null) { setFormError('Atualize ou cancele a edição do ingrediente antes de salvar a fórmula.'); return; }
    const trimmed = name.trim();
    if (!trimmed) { setFormError('Informe o nome da fórmula.'); return; }
    if (items.length === 0) { setFormError('Adicione ao menos um insumo.'); return; }
    const dup = allFormulas.find(f => f.id !== editingId && f.name.toLowerCase() === trimmed.toLowerCase());
    if (dup) { setFormError(`Fórmula já cadastrada: ${dup.name}`); return; }
    setSaving(true); setFormError(''); setSuccess(null);
    const payload = {
      name: trimmed,
      budget_number: budgetNumber.trim() || null,
      items: items.map(i => ({ insumo_id: i.insumo_id, quantity: i.quantity, unit: i.unit ?? 'mg' })),
      budget_items: budgetItems,
    };
    try {
      if (editingId) {
        const res: any = await db.savedFormulas.update(editingId, payload, sessionToken ?? undefined);
        if (res?.success === false) { setFormError(res.error ?? 'Erro ao salvar.'); return; }
        removeDraft(DRAFT_KEY);
        reset(); setTab('list');
      } else {
        const res: any = await db.savedFormulas.add(payload, sessionToken ?? undefined);
        if (res?.success === false) { setFormError(res.error ?? 'Erro ao salvar.'); return; }
        removeDraft(DRAFT_KEY);
        reset();
        setSuccess('Fórmula salva cadastrada com sucesso!');
      }
      reload();
    } catch (err: any) {
      setFormError(err.message ?? 'Erro ao salvar.');
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: number) => {
    setPendingDeleteId(id);
    setDeleteModalOpen(true);
  };

  const handleDeleteConfirm = async (adminCreds?: { username: string; password: string }, token?: string) => {
    if (pendingDeleteId === null) return;
    try {
      const res: any = await db.savedFormulas.remove(pendingDeleteId, adminCreds, token ?? sessionToken ?? undefined);
      if (res?.success === false) { setFormError(res.error ?? 'Erro ao excluir.'); return; }
      reload();
      setPendingDeleteId(null);
    } catch (err: any) {
      setFormError(err.message ?? 'Erro ao excluir.');
    }
  };

  const startEdit = (f: SavedFormula) => {
    resetIngredientFields();
    setEditingId(f.id);
    setName(f.name);
    setBudgetNumber(f.budget_number ?? '');
    setItems(f.items.map(i => ({ ...i })));
    setBudgetItems((f.budget_items ?? []).map(b => ({ ...b })));
    setTab('create');
    setFormError('');
    setSuccess(null);
  };

  const addInsumoBlock = (
    <div className="border border-dashed border-zinc-200 rounded-xl overflow-hidden mb-4">
      <InsumoManager compact initialName={pendingInsumoName.current} onCreated={async (m: Insumo) => {
        await reloadInsumos();
        setSelectedInsumoId(m.id);
        setShowAddInsumo(false);
        setInsumoQuery('');
        requestAnimationFrame(() => quantityRef.current?.focus());
      }} />
    </div>
  );

  const formBlock = (
    <form onSubmit={handleSubmit} className="space-y-4">
      {success && (
        <p className="flex items-center gap-1.5 text-xs font-semibold text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
          <CheckCircle className="w-3.5 h-3.5 shrink-0" /> {success}
        </p>
      )}
      <div>
        <label className="block text-xs font-semibold text-zinc-500 uppercase mb-1">Nome da Fórmula</label>
        <input required className="w-full px-3 py-2 rounded-lg border border-zinc-300 focus:ring-2 focus:ring-red-500 outline-none"
          value={name} onChange={e => { setFormError(''); setName(e.target.value.toUpperCase()); }} />
      </div>

      <div>
        <label className="block text-xs font-semibold text-zinc-500 uppercase mb-1">Número do Orçamento (opcional)</label>
        <input inputMode="numeric" maxLength={6} className="w-full px-3 py-2 rounded-lg border border-zinc-300 focus:ring-2 focus:ring-red-500 outline-none text-sm"
          value={budgetNumber} onChange={e => { setFormError(''); setBudgetNumber(e.target.value.replace(/\D/g, '').slice(0, 6)); }} />
      </div>

      <div className="border border-zinc-200 rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-semibold text-zinc-500 uppercase">Itens do Orçamento</h3>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
          <div className="sm:w-28">
            <label className="block text-xs font-semibold text-zinc-500 uppercase mb-1">Quantidade</label>
            <input ref={bQtyRef} inputMode="numeric" maxLength={8}
              className="w-full px-3 py-2 rounded-lg border border-zinc-300 focus:ring-2 focus:ring-red-500 outline-none text-sm text-right"
              value={bQty}
              onChange={e => { setFormError(''); setBQty(formatQuantityInput(e.target.value)); }} />
          </div>
          <div className="sm:w-40">
            <label className="block text-xs font-semibold text-zinc-500 uppercase mb-1">Unidade</label>
            <UnitCycle value={bUnit} onChange={setBUnit} options={BUDGET_UNITS} />
          </div>
          <div className="flex-1">
            <label className="block text-xs font-semibold text-zinc-500 uppercase mb-1">Valor (R$)</label>
            <input ref={budgetValueRef} type="text" inputMode="numeric"
              className="w-full px-3 py-2 rounded-lg border border-zinc-300 focus:ring-2 focus:ring-red-500 outline-none text-sm text-right"
              value={bValue}
              onChange={e => {
                setFormError('');
                const input = e.currentTarget;
                const formatted = formatCurrency(input.value);
                const caret = currencyCaretPosition(input.value, input.selectionStart ?? input.value.length);
                setBValue(formatted);
                requestAnimationFrame(() => input.setSelectionRange(caret, caret));
              }}
              onKeyDown={e => {
                if (e.key === 'Enter' && bQty && bValue) {
                  e.preventDefault();
                  addBudgetItem();
                }
              }} />
          </div>
          <button type="button" disabled={!bQty || !bValue} onClick={addBudgetItem}
            className="w-full sm:w-auto text-white px-4 py-2 rounded-lg font-medium text-sm hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ background: GRADIENTS.secondary }}>
            + Adicionar
          </button>
        </div>

        {budgetItems.length > 0 && (
          <div className="mt-3 space-y-2">
            {budgetItems.map((bi, idx) => (
              <div key={idx} className="flex items-center gap-3 p-3 rounded-xl border border-zinc-100"
                style={{ background: idx % 2 === 0 ? COLORS.rowAlt : '#fff' }}>
                <p className="text-sm text-zinc-700 flex-1 min-w-0">
                  <strong>{formatQuantity(bi.quantity)}</strong> {formatUnit(bi.unit)} · <span className="font-semibold text-zinc-900">R$ {bi.value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </p>
                <button type="button" onClick={() => removeBudgetItem(idx)}
                  className="text-zinc-300 hover:text-red-500 transition-colors ml-4 p-1" title="Remover item do orçamento">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
        {budgetItems.length === 0 && (
          <p className="text-sm text-zinc-400">Nenhum item de orçamento adicionado ainda.</p>
        )}
      </div>

      <div className="border border-zinc-200 rounded-xl p-4 space-y-3">
        <h3 className="text-xs font-semibold text-zinc-500 uppercase">Composição</h3>

        {showAddInsumo && !editingIngredient && addInsumoBlock}

        {editingIngredient || selectedInsumo ? (
          <div className="flex items-center justify-between p-3 rounded-xl border border-zinc-200 bg-zinc-50">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
                <ClipboardList className="w-4 h-4 text-red-700" />
              </div>
              <p className="font-semibold text-zinc-900 text-sm truncate">{editingIngredient ? editingIngredient.insumo_name : selectedInsumo?.name}</p>
            </div>
            {!editingIngredient && (
              <button type="button" onClick={() => { setSelectedInsumoId(''); setInsumoQuery(''); }}
                className="p-2 text-zinc-300 hover:text-red-500 transition-colors ml-3" title="Trocar insumo">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        ) : (
          <div className="relative">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-zinc-400" />
            <input ref={insumoQueryRef} className="w-full pl-9 pr-9 py-2 rounded-lg border border-zinc-300 focus:ring-2 focus:ring-red-500 outline-none text-sm uppercase"
              aria-label="Buscar insumo"
              value={insumoQuery}
              onChange={e => { setInsumoQuery(e.target.value.toUpperCase()); setInsumoFocusIdx(-1); }}
              onKeyDown={e => {
                if (e.key === 'ArrowDown' && filteredInsumos.length) {
                  e.preventDefault();
                  setInsumoFocusIdx(prev => (prev < filteredInsumos.length - 1 ? prev + 1 : 0));
                } else if (e.key === 'ArrowUp' && filteredInsumos.length) {
                  e.preventDefault();
                  setInsumoFocusIdx(prev => (prev > 0 ? prev - 1 : filteredInsumos.length - 1));
                } else if (e.key === 'Enter') {
                  if (filteredInsumos.length) {
                    e.preventDefault();
                    const targetIdx = insumoFocusIdx >= 0 && insumoFocusIdx < filteredInsumos.length ? insumoFocusIdx : 0;
                    setInsumoFocusIdx(targetIdx);
                    focusListOption(targetIdx);
                  } else if (insumoQuery.trim()) {
                    e.preventDefault();
                    pendingInsumoName.current = insumoQuery.trim().toUpperCase();
                    setShowAddInsumo(true); setInsumoQuery(''); setInsumoFocusIdx(-1);
                  }
                } else if (e.key === 'Escape') {
                  setInsumoQuery(''); setInsumoFocusIdx(-1);
                }
              }} />
            {insumoQuery && (
              <button type="button" onClick={() => { setInsumoQuery(''); setInsumoFocusIdx(-1); }} title="Limpar busca"
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-zinc-400 hover:text-red-600 transition-colors">
                <X className="w-4 h-4" />
              </button>
            )}
            {filteredInsumos.length > 0 && (
              <div ref={insumoListRef} className="absolute left-0 right-0 mt-1 bg-white border border-zinc-200 rounded-xl shadow-lg overflow-hidden z-10 max-h-64 overflow-y-auto">
                {filteredInsumos.map((m, idx) => (
                  <button key={m.id} type="button" data-idx={idx}
                    onClick={() => { setSelectedInsumoId(m.id); setInsumoQuery(''); setInsumoFocusIdx(-1); }}
                    onKeyDown={e => {
                      if (e.key === 'ArrowDown') {
                        e.preventDefault();
                        moveListFocus(idx, 1, filteredInsumos.length);
                      } else if (e.key === 'ArrowUp') {
                        e.preventDefault();
                        moveListFocus(idx, -1, filteredInsumos.length);
                      } else if (e.key === 'Enter') {
                        e.preventDefault();
                        setSelectedInsumoId(m.id); setInsumoQuery(''); setInsumoFocusIdx(-1);
                        requestAnimationFrame(() => quantityRef.current?.focus());
                      } else if (e.key === 'Escape') {
                        e.preventDefault();
                        setInsumoQuery(''); setInsumoFocusIdx(-1);
                        insumoQueryRef.current?.focus();
                      }
                    }}
                    className={`w-full text-left px-3 py-2 transition-colors flex items-center gap-2 ${idx === insumoFocusIdx ? 'bg-red-100 text-red-900 font-medium' : 'hover:bg-red-50'}`}>
                    <ClipboardList className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                    <span className="text-sm truncate flex-1">{m.name}</span>
                  </button>
                ))}
              </div>
            )}
            {mq && filteredInsumos.length === 0 && (
              <div className="px-1 mt-1">
                <p className="text-xs text-zinc-400 mb-2">Nenhum insumo encontrado.</p>
                <button
                  type="button"
                  onClick={() => { pendingInsumoName.current = insumoQuery.trim().toUpperCase(); setShowAddInsumo(true); setInsumoQuery(''); setInsumoFocusIdx(-1); }}
                  className="w-full text-left px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors flex items-center gap-2"
                >
                  <PlusCircle className="w-4 h-4 shrink-0" />
                  Criar novo insumo "{insumoQuery.trim()}"
                </button>
              </div>
            )}
          </div>
        )}

        {(editingIngredient || selectedInsumo) && (
          <div className="flex flex-col sm:flex-row sm:flex-wrap gap-3 sm:items-end">
            <div className="sm:w-32">
              <label htmlFor="saved-ingredient-quantity" className="block text-xs font-semibold text-zinc-500 uppercase mb-1">Quantidade</label>
              <input id="saved-ingredient-quantity" ref={quantityRef} inputMode="numeric" maxLength={8} required disabled={saving}
                className="w-full px-3 py-2 rounded-lg border border-zinc-300 focus:ring-2 focus:ring-red-500 outline-none text-sm text-right"
                value={quantity}
                onChange={e => { setQuantity(formatQuantityInput(e.target.value)); setFormError(''); }} />
            </div>
            <div className="sm:w-40">
              <label className="block text-xs font-semibold text-zinc-500 uppercase mb-1">Unidade</label>
              <UnitCycle value={unit} onChange={setUnit} options={INGREDIENT_UNITS} disabled={saving} />
            </div>
            <button type="button" disabled={saving || ingredientQuantity <= 0} onClick={editingIngredient ? updateIngredient : addItem}
              className="w-full sm:w-auto text-white px-4 py-2 rounded-lg font-medium text-sm hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: GRADIENTS.secondary }}>
              {editingIngredient ? 'Atualizar ingrediente' : '+ Adicionar'}
            </button>
            {editingIngredient && <button type="button" disabled={saving} onClick={cancelIngredientEdit} className="px-3 py-2 rounded-lg bg-zinc-100 text-zinc-600 hover:bg-zinc-200 text-sm font-semibold transition-colors">Cancelar</button>}
          </div>
        )}

        {quantity !== '' && ingredientQuantity <= 0 && <p className="text-xs font-medium" style={{ color: COLORS.primary }}>Informe uma quantidade maior que zero.</p>}
        {editingIngredient && <p role="status" className="text-xs" style={{ color: COLORS.secondary }}>Atualize ou cancele a edição do ingrediente antes de salvar a fórmula.</p>}

        {items.length === 0 ? (
          <p className="text-sm text-zinc-400">Nenhum insumo adicionado ainda.</p>
        ) : (
          <div className="space-y-2">
            {items.map((item, idx) => (
              <div key={item.insumo_id} className="flex items-center justify-between p-3 rounded-xl border border-zinc-100"
                style={{ background: editingIngredientId === item.insumo_id ? COLORS.lightBlueBg : idx % 2 === 0 ? COLORS.rowAlt : '#fff', borderColor: editingIngredientId === item.insumo_id ? COLORS.lightBlueBorder : undefined }}>
                <div className="min-w-0">
                  <p className="font-semibold text-zinc-900 text-sm truncate">{item.insumo_name}</p>
                  <p className="text-xs text-zinc-400">{formatQuantity(item.quantity)} {item.unit ?? 'mg'}</p>
                </div>
                <div className="flex items-center gap-2 ml-3 shrink-0">
                  <button type="button" disabled={saving} onClick={() => editingIngredientId === item.insumo_id ? cancelIngredientEdit() : startIngredientEdit(item)}
                    aria-label={`${editingIngredientId === item.insumo_id ? 'Cancelar edição de' : 'Editar'} ${item.insumo_name}`}
                    aria-pressed={editingIngredientId === item.insumo_id}
                    className={`text-xs font-semibold px-3 py-1 rounded-lg transition-colors ${editingIngredientId === item.insumo_id ? 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200' : 'hover:bg-[#EFF2FA]'}`}
                    style={editingIngredientId === item.insumo_id ? undefined : { color: COLORS.secondary }}>
                    {editingIngredientId === item.insumo_id ? 'Cancelar' : 'Editar'}
                  </button>
                  <button type="button" disabled={saving} onClick={() => removeIngredient(item.insumo_id)}
                    className="text-zinc-300 hover:text-[#C5243E] transition-colors p-1" title="Remover insumo" aria-label={`Remover ${item.insumo_name}`}>
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {formError && <p className="text-xs text-red-600 font-medium">{formError}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={saving || editingIngredientId !== null} style={{ background: GRADIENTS.primary }}
          className="flex-1 text-white py-2 px-4 rounded-lg font-medium hover:opacity-90 disabled:opacity-50 transition-all text-sm">
          {saving ? '...' : editingId ? 'Atualizar' : 'Adicionar'}
        </button>
        {editingId && (
          <button type="button" onClick={reset} className="px-3 py-2 rounded-lg border border-zinc-300 text-zinc-600 hover:bg-zinc-100 text-sm">✕</button>
        )}
      </div>
    </form>
  );

  const q = useMemo(() => stripDiacritics(search.trim().toLowerCase()), [search]);
  const list = useMemo(() => {
    return allFormulas
      .filter(f => {
        if (!q) return true;
        return stripDiacritics((f.name ?? '').toLowerCase()).includes(q)
          || stripDiacritics((f.created_by_name ?? '').toLowerCase()).includes(q);
      })
      .sort((a, b) => {
        if (q) {
          const score = (f: SavedFormula) => {
            const name = stripDiacritics((f.name ?? '').toLowerCase());
            if (name.startsWith(q)) return 2;
            if (name.includes(q)) return 1;
            return 0;
          };
          const diff = score(b) - score(a);
          if (diff !== 0) return diff;
          return (a.name ?? '').localeCompare(b.name ?? '');
        }
        const dir = sort.dir === 'desc' ? -1 : 1;
        const av = String(a[sort.key] ?? '').toLowerCase();
        const bv = String(b[sort.key] ?? '').toLowerCase();
        return av.localeCompare(bv) * dir;
      });
  }, [allFormulas, q, sort]);

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-zinc-900">Minhas Fórmulas</h2>
        <p className="text-zinc-500">Gerencie as fórmulas prontas da farmácia.</p>
      </div>
      <div className="flex items-center gap-4 border-b border-zinc-200">
        <button onClick={() => { setTab('list'); }} className={`pb-4 px-2 text-sm font-medium transition-colors relative ${tab === 'list' ? 'text-red-700' : 'text-zinc-500 hover:text-zinc-900'}`}>
          Lista de Fórmulas
          {tab === 'list' && <motion.div layoutId="activeSaved" className="absolute bottom-0 left-0 right-0 h-0.5 bg-red-700" />}
        </button>
        <button onClick={() => setTab('create')} className={`pb-4 px-2 text-sm font-medium transition-colors relative ${tab === 'create' ? 'text-red-700' : 'text-zinc-500 hover:text-zinc-900'}`}>
          Cadastro de fórmula
          {tab === 'create' && <motion.div layoutId="activeSaved" className="absolute bottom-0 left-0 right-0 h-0.5 bg-red-700" />}
        </button>
      </div>
      <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden">
        {tab === 'create' ? (
          <div className="p-6 space-y-6">{formBlock}</div>
        ) : (
          <div className="p-6 space-y-6">
            {loading && <LoadingState />}
            {error && <ErrorState message={error} onRetry={reload} />}
            {!loading && !error && (
              <div className="space-y-4">
                <div className="flex flex-col md:flex-row md:items-center gap-3">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-2.5 w-4 h-4 text-zinc-400" />
                    <input className="pl-9 pr-9 py-2 bg-white border border-zinc-200 rounded-xl focus:ring-2 focus:ring-red-500 outline-none text-sm w-full"
                      value={search} onChange={e => setSearch(e.target.value)} />
                    {search && (
                      <button onClick={() => setSearch('')} title="Limpar busca"
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-zinc-400 hover:text-red-600 transition-colors">
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  <select value={`${sort.key}:${sort.dir}`}
                    onChange={e => { const [key, dir] = e.target.value.split(':'); setSort({ key: key as any, dir: dir as any }); }}
                    className="px-3 py-2 rounded-xl border border-zinc-200 text-sm text-zinc-600 bg-white focus:ring-2 focus:ring-red-500 outline-none">
                    <option value="name:asc">Nome (A–Z)</option>
                    <option value="name:desc">Nome (Z–A)</option>
                    <option value="created_at:desc">Cadastro (mais recente)</option>
                    <option value="created_at:asc">Cadastro (mais antigo)</option>
                  </select>
                  <span className="text-xs font-semibold text-zinc-500 whitespace-nowrap">
                    {list.length} de {allFormulas.length} {allFormulas.length === 1 ? 'fórmula salva' : 'fórmulas salvas'}
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead><tr className="border-b border-zinc-100 text-zinc-400 text-xs uppercase font-semibold">
                      <th className="px-4 py-3">Nome</th><th className="px-4 py-3">Orçamento</th><th className="px-4 py-3">Composição</th><th className="px-4 py-3">Atendente</th><th className="px-4 py-3">Funcionário</th><th className="px-4 py-3">Cadastro</th><th className="px-4 py-3 text-right">Ações</th>
                    </tr></thead>
                    <tbody className="divide-y divide-zinc-50">
                      {list.map(f => (
                        <tr key={f.id} className="hover:bg-zinc-50 transition-colors">
                          <td className="px-4 py-3 font-medium text-zinc-900">
                            <HighlightMatch text={f.name} query={search} />
                          </td>
                          <td className="px-4 py-3 text-zinc-700 text-sm">{f.budget_number || '—'}</td>
                          <td className="px-4 py-3 text-zinc-600 text-sm max-w-xs">
                            {f.items.map(i => `${i.insumo_name} ${formatQuantity(i.quantity)} ${i.unit ?? 'mg'}`).join(', ')}
                          </td>
                          <td className="px-4 py-3 text-zinc-500 text-sm">—</td>
                          <td className="px-4 py-3 text-zinc-700 text-sm">{f.created_by_name || 'Não identificado'}</td>
                          <td className="px-4 py-3 text-zinc-500 text-sm">{f.created_at ? new Date(f.created_at).toLocaleString('pt-BR') : '—'}</td>
                          <td className="px-4 py-3 text-right space-x-3">
                            <button onClick={() => startEdit(f)} className="text-zinc-400 hover:text-blue-700 text-sm transition-colors">Editar</button>
                            <button onClick={() => handleDelete(f.id)} className="text-zinc-400 hover:text-red-600 transition-colors"><Trash2 className="w-4 h-4" /></button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {allFormulas.length === 0 && <p className="text-center py-8 text-zinc-400">Nenhuma fórmula salva cadastrada.</p>}
                  {allFormulas.length > 0 && list.length === 0 && <p className="text-center py-8 text-zinc-400">Nenhum resultado encontrado.</p>}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      <AdminAuthModal
        isOpen={deleteModalOpen}
        onClose={() => { setDeleteModalOpen(false); setPendingDeleteId(null); }}
        onConfirm={handleDeleteConfirm}
        title="Excluir fórmula salva"
        message="Esta ação não pode ser desfeita. A fórmula salva será removida permanentemente."
      />
    </motion.div>
  );
}
