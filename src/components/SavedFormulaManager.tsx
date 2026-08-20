import React, { useState } from 'react';
import { CheckCircle, Trash2, Search, X, PlusCircle, ClipboardList } from 'lucide-react';
import { motion } from 'motion/react';
import { db } from '../services/lanDatabase';
import { SavedFormula, SavedFormulaItem, Insumo } from '../types';
import { stripDiacritics } from '../utils/format';
import { useData } from '../hooks/useData';
import { LoadingState, ErrorState } from './Feedback';
import { HighlightMatch } from './HighlightMatch';

const UNITS = ['g', 'mcg', 'mg', 'ml', 'ui'];

export function SavedFormulaManager() {
  const { data: formulas, loading, error, reload } = useData(() => db.savedFormulas.list());
  const { data: insumos } = useData(() => db.insumos.list());
  const [name, setName] = useState('');
  const [items, setItems] = useState<SavedFormulaItem[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [insumoQuery, setInsumoQuery] = useState('');
  const [selectedInsumoId, setSelectedInsumoId] = useState<number | ''>('');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState('mg');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [success, setSuccess] = useState<string | null>(null);
  const [tab, setTab] = useState<'list' | 'create'>('list');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<{ key: 'name' | 'created_at'; dir: 'asc' | 'desc' }>({ key: 'name', dir: 'asc' });

  const reset = () => { setName(''); setItems([]); setEditingId(null); setInsumoQuery(''); setSelectedInsumoId(''); setQuantity(''); setUnit('mg'); setFormError(''); setSuccess(null); };

  const allFormulas = (formulas as SavedFormula[]) ?? [];
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

  const addItem = () => {
    if (!selectedInsumoId || !quantity) return;
    if (items.find(i => i.insumo_id === Number(selectedInsumoId))) {
      setFormError('Este insumo já foi adicionado à fórmula.');
      return;
    }
    setItems([...items, { insumo_id: Number(selectedInsumoId), insumo_name: selectedInsumo?.name ?? '', quantity: Number(quantity), unit }]);
    setSelectedInsumoId('');
    setInsumoQuery('');
    setQuantity('');
    setUnit('mg');
    setFormError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) { setFormError('Informe o nome da fórmula.'); return; }
    if (items.length === 0) { setFormError('Adicione ao menos um insumo.'); return; }
    const dup = allFormulas.find(f => f.id !== editingId && f.name.toLowerCase() === trimmed.toLowerCase());
    if (dup) { setFormError(`Fórmula já cadastrada: ${dup.name}`); return; }
    setSaving(true); setFormError(''); setSuccess(null);
    const payload = { name: trimmed, items: items.map(i => ({ insumo_id: i.insumo_id, quantity: i.quantity, unit: i.unit ?? 'mg' })) };
    try {
      if (editingId) {
        const res: any = await db.savedFormulas.update(editingId, payload);
        if (res?.success === false) { setFormError(res.error ?? 'Erro ao salvar.'); return; }
        reset(); setTab('list');
      } else {
        const res: any = await db.savedFormulas.add(payload);
        if (res?.success === false) { setFormError(res.error ?? 'Erro ao salvar.'); return; }
        reset();
        setSuccess('Fórmula salva cadastrada com sucesso!');
      }
      reload();
    } catch (err: any) {
      setFormError(err.message ?? 'Erro ao salvar.');
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Excluir esta fórmula salva?')) return;
    try {
      const res: any = await db.savedFormulas.remove(id);
      if (res?.success === false) { setFormError(res.error ?? 'Erro ao excluir.'); return; }
      reload();
    } catch (err: any) {
      setFormError(err.message ?? 'Erro ao excluir.');
    }
  };

  const startEdit = (f: SavedFormula) => {
    setEditingId(f.id);
    setName(f.name);
    setItems(f.items.map(i => ({ ...i })));
    setTab('create');
    setFormError('');
    setSuccess(null);
  };

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
          value={name} onChange={e => { setFormError(''); setName(e.target.value); }} placeholder="Ex: Cápsulas de Vitamina C + Zinco" />
      </div>

      <div className="border border-zinc-200 rounded-xl p-4 space-y-3">
        <h3 className="text-xs font-semibold text-zinc-500 uppercase">Composição</h3>

        {selectedInsumo ? (
          <div className="flex items-center justify-between p-3 rounded-xl border border-zinc-200 bg-zinc-50">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
                <ClipboardList className="w-4 h-4 text-red-700" />
              </div>
              <p className="font-semibold text-zinc-900 text-sm truncate">{selectedInsumo.name}</p>
            </div>
            <button type="button" onClick={() => { setSelectedInsumoId(''); setInsumoQuery(''); }}
              className="p-2 text-zinc-300 hover:text-red-500 transition-colors ml-3" title="Trocar insumo">
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="relative">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-zinc-400" />
            <input className="w-full pl-9 pr-9 py-2 rounded-lg border border-zinc-300 focus:ring-2 focus:ring-red-500 outline-none text-sm"
              placeholder="Buscar insumo por nome..." value={insumoQuery} onChange={e => setInsumoQuery(e.target.value)} />
            {insumoQuery && (
              <button type="button" onClick={() => setInsumoQuery('')} title="Limpar busca"
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-zinc-400 hover:text-red-600 transition-colors">
                <X className="w-4 h-4" />
              </button>
            )}
            {filteredInsumos.length > 0 && (
              <div className="absolute left-0 right-0 mt-1 bg-white border border-zinc-200 rounded-xl shadow-lg overflow-hidden z-10 max-h-64 overflow-y-auto">
                {filteredInsumos.map(m => (
                  <button key={m.id} type="button" onClick={() => { setSelectedInsumoId(m.id); setInsumoQuery(''); }}
                    className="w-full text-left px-3 py-2 hover:bg-red-50 transition-colors flex items-center gap-2">
                    <ClipboardList className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                    <span className="text-sm text-zinc-800 truncate flex-1">{m.name}</span>
                  </button>
                ))}
              </div>
            )}
            {mq && filteredInsumos.length === 0 && (
              <p className="text-xs text-zinc-400 mt-1 px-1">Nenhum insumo encontrado.</p>
            )}
          </div>
        )}

        {selectedInsumo && (
          <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
            <div className="sm:w-32">
              <label className="block text-xs font-semibold text-zinc-500 uppercase mb-1">Quantidade</label>
              <input inputMode="numeric" maxLength={4} required
                className="w-full px-3 py-2 rounded-lg border border-zinc-300 focus:ring-2 focus:ring-red-500 outline-none text-sm text-right"
                placeholder="0–9999" value={quantity}
                onChange={e => setQuantity(e.target.value.replace(/\D/g, '').slice(0, 4))} />
            </div>
            <div className="sm:w-36">
              <label className="block text-xs font-semibold text-zinc-500 uppercase mb-1">Unidade</label>
              <select className="w-full px-3 py-2 rounded-lg border border-zinc-300 focus:ring-2 focus:ring-red-500 outline-none bg-white text-sm"
                value={unit} onChange={e => setUnit(e.target.value)}>
                {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            <button type="button" disabled={!quantity} onClick={addItem}
              className="w-full sm:w-auto text-white px-4 py-2 rounded-lg font-medium text-sm hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: 'linear-gradient(135deg, #1F3164, #2a4080)' }}>
              + Adicionar
            </button>
          </div>
        )}

        {items.length === 0 ? (
          <p className="text-sm text-zinc-400">Nenhum insumo adicionado ainda.</p>
        ) : (
          <div className="space-y-2">
            {items.map((item, idx) => (
              <div key={idx} className="flex items-center justify-between p-3 rounded-xl border border-zinc-100"
                style={{ background: idx % 2 === 0 ? '#f8faff' : '#fff' }}>
                <div className="min-w-0">
                  <p className="font-semibold text-zinc-900 text-sm truncate">{item.insumo_name}</p>
                  <p className="text-xs text-zinc-400">{item.quantity}{item.unit ?? 'mg'}</p>
                </div>
                <button type="button" onClick={() => { setItems(items.filter((_, i) => i !== idx)); setFormError(''); }}
                  className="text-zinc-300 hover:text-red-500 transition-colors ml-4 p-1" title="Remover insumo">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {formError && <p className="text-xs text-red-600 font-medium">{formError}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={saving} style={{ background: 'linear-gradient(135deg, #C41E3C, #A01830)' }}
          className="flex-1 text-white py-2 px-4 rounded-lg font-medium hover:opacity-90 disabled:opacity-50 transition-all text-sm">
          {saving ? '...' : editingId ? 'Atualizar' : 'Adicionar'}
        </button>
        {editingId && (
          <button type="button" onClick={reset} className="px-3 py-2 rounded-lg border border-zinc-300 text-zinc-600 hover:bg-zinc-100 text-sm">✕</button>
        )}
      </div>
    </form>
  );

  const q = stripDiacritics(search.trim().toLowerCase());
  const list = allFormulas
    .filter(f => {
      if (!q) return true;
      return stripDiacritics((f.name ?? '').toLowerCase()).includes(q);
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

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-zinc-900">Fórmulas Salvas</h2>
        <p className="text-zinc-500">Gerencie as fórmulas prontas da farmácia.</p>
      </div>
      <div className="flex items-center gap-4 border-b border-zinc-200">
        <button onClick={() => { setTab('list'); }} className={`pb-4 px-2 text-sm font-medium transition-colors relative ${tab === 'list' ? 'text-red-700' : 'text-zinc-500 hover:text-zinc-900'}`}>
          Lista de Fórmulas Salvas
          {tab === 'list' && <motion.div layoutId="activeSaved" className="absolute bottom-0 left-0 right-0 h-0.5 bg-red-700" />}
        </button>
        <button onClick={() => setTab('create')} className={`pb-4 px-2 text-sm font-medium transition-colors relative ${tab === 'create' ? 'text-red-700' : 'text-zinc-500 hover:text-zinc-900'}`}>
          Cadastro de fórmula salva
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
                      placeholder="Buscar por nome..." value={search} onChange={e => setSearch(e.target.value)} />
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
                      <th className="px-4 py-3">Nome</th><th className="px-4 py-3">Composição</th><th className="px-4 py-3">Cadastro</th><th className="px-4 py-3 text-right">Ações</th>
                    </tr></thead>
                    <tbody className="divide-y divide-zinc-50">
                      {list.map(f => (
                        <tr key={f.id} className="hover:bg-zinc-50 transition-colors">
                          <td className="px-4 py-3 font-medium text-zinc-900">
                            <HighlightMatch text={f.name} query={search} />
                          </td>
                          <td className="px-4 py-3 text-zinc-600 text-sm max-w-xs">
                            {f.items.map(i => `${i.insumo_name} ${i.quantity}${i.unit ?? 'mg'}`).join(', ')}
                          </td>
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
    </motion.div>
  );
}