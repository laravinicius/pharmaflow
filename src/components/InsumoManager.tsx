import React, { useState } from 'react';
import { CheckCircle, Trash2, Search, X } from 'lucide-react';
import { motion } from 'motion/react';
import { db } from '../services/lanDatabase';
import { Insumo } from '../types';
import { stripDiacritics } from '../utils/format';
import { useData } from '../hooks/useData';
import { LoadingState, ErrorState } from './Feedback';
import { HighlightMatch } from './HighlightMatch';
import { AdminAuthModal } from './AdminAuthModal';
import { useAuth } from '../context/AuthContext';

export function InsumoManager({ compact = false, onCreated }: { compact?: boolean; onCreated?: (m: Insumo) => void } = {}) {
  const { data: insumos, loading, error, reload } = useData(() => db.insumos.list());
  const { sessionToken } = useAuth();
  const [name, setName] = useState('');
  const [editingRow, setEditingRow] = useState<number | null>(null);
  const [rowDraft, setRowDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [success, setSuccess] = useState<string | null>(null);
  const [tab, setTab] = useState<'list' | 'create'>('list');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<{ key: 'name' | 'created_at'; dir: 'asc' | 'desc' }>({ key: 'name', dir: 'asc' });
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);

  const reset = () => { setName(''); setFormError(''); setSuccess(null); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    const dup = (insumos as Insumo[])?.find(m => m.name.toLowerCase() === trimmed.toLowerCase());
    if (dup) { setFormError(`Insumo já cadastrado: ${dup.name}`); return; }
    setSaving(true); setFormError(''); setSuccess(null);
    try {
      const res: any = await db.insumos.add(trimmed);
      if (res?.success === false) { setFormError(res.error ?? 'Erro ao salvar.'); return; }
      if (onCreated) onCreated({ id: res.id, name: trimmed });
      reset(); reload();
      setSuccess('Insumo cadastrado com sucesso!');
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
    const res: any = await db.insumos.remove(pendingDeleteId, adminCreds, token ?? sessionToken ?? undefined);
    if (!res?.success) { setFormError(res?.error ?? 'Erro ao excluir.'); return; }
    reload();
    setPendingDeleteId(null);
  };

  const handleRowSave = async () => {
    if (editingRow === null) return;
    const trimmed = rowDraft.trim();
    if (!trimmed) { setFormError('Informe o nome do insumo.'); return; }
    const dup = (insumos as Insumo[])?.find(m => m.id !== editingRow && m.name.toLowerCase() === trimmed.toLowerCase());
    if (dup) { setFormError(`Insumo já cadastrado: ${dup.name}`); return; }
    setSaving(true); setFormError('');
    try {
      const res: any = await db.insumos.update(editingRow, trimmed);
      if (res?.success === false) { setFormError(res.error ?? 'Erro ao salvar.'); return; }
      setEditingRow(null); setRowDraft('');
      reload();
    } catch (err: any) {
      setFormError(err.message ?? 'Erro ao salvar.');
    } finally { setSaving(false); }
  };

  const formBlock = (
    <form onSubmit={handleSubmit} className="flex flex-wrap gap-3 items-end bg-zinc-50 p-4 rounded-xl border border-zinc-100">
      {success && (
        <p className="flex items-center gap-1.5 text-xs font-semibold text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2 w-full">
          <CheckCircle className="w-3.5 h-3.5 shrink-0" /> {success}
        </p>
      )}
      <div className="flex-1 min-w-[200px]">
        <label className="block text-xs font-semibold text-zinc-500 uppercase mb-1">Nome do Insumo</label>
        <input required className="w-full px-3 py-2 rounded-lg border border-zinc-300 focus:ring-2 focus:ring-red-500 outline-none" value={name} onChange={e => { setFormError(''); setName(e.target.value); }} placeholder="Ex: Amoxicilina" />
        {formError && <p className="text-xs text-red-600 mt-1">{formError}</p>}
      </div>
      <button type="submit" disabled={saving} style={{ background: 'linear-gradient(135deg, #C5243E, #9B1A2E)' }} className="text-white py-2 px-4 rounded-lg font-medium hover:opacity-90 disabled:opacity-60 transition-all whitespace-nowrap">
        {saving ? '...' : 'Adicionar'}
      </button>
    </form>
  );

  if (compact) return formBlock;

  const available = (insumos as Insumo[]) ?? [];
  const q = stripDiacritics(search.trim().toLowerCase());
  const list = available
    .filter(m => {
      if (!q) return true;
      return stripDiacritics((m.name ?? '').toLowerCase()).includes(q);
    })
    .sort((a, b) => {
      if (q) {
        // Ordena por relevância quando há busca: início do nome primeiro;
        // empates por nome (A–Z).
        const score = (m: Insumo) => {
          const name = stripDiacritics((m.name ?? '').toLowerCase());
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
        <h2 className="text-3xl font-bold text-zinc-900">Insumos</h2>
        <p className="text-zinc-500">Gerencie os insumos da farmácia.</p>
      </div>
      <div className="flex items-center gap-4 border-b border-zinc-200">
        <button onClick={() => { setTab('list'); }} className={`pb-4 px-2 text-sm font-medium transition-colors relative ${tab === 'list' ? 'text-red-700' : 'text-zinc-500 hover:text-zinc-900'}`}>
          Lista de Insumos
          {tab === 'list' && <motion.div layoutId="activeInsumo" className="absolute bottom-0 left-0 right-0 h-0.5 bg-red-700" />}
        </button>
        <button onClick={() => setTab('create')} className={`pb-4 px-2 text-sm font-medium transition-colors relative ${tab === 'create' ? 'text-red-700' : 'text-zinc-500 hover:text-zinc-900'}`}>
          Cadastro de insumo
          {tab === 'create' && <motion.div layoutId="activeInsumo" className="absolute bottom-0 left-0 right-0 h-0.5 bg-red-700" />}
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
                    {list.length} de {available.length} {available.length === 1 ? 'insumo' : 'insumos'}
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead><tr className="border-b border-zinc-100 text-zinc-400 text-xs uppercase font-semibold">
                      <th className="px-4 py-3">Nome</th><th className="px-4 py-3">Cadastro</th><th className="px-4 py-3 text-right">Ações</th>
                    </tr></thead>
                    <tbody className="divide-y divide-zinc-50">
                      {list.map(m => (
                        <tr key={m.id} className="hover:bg-zinc-50 transition-colors">
                          <td className="px-4 py-3 font-medium text-zinc-900">
                            {editingRow === m.id ? (
                              <div>
                                <input className="w-full px-2 py-1 rounded-lg border border-zinc-300 focus:ring-2 focus:ring-red-500 outline-none text-sm"
                                  value={rowDraft} onChange={e => setRowDraft(e.target.value)}
                                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleRowSave(); } else if (e.key === 'Escape') { setEditingRow(null); setRowDraft(''); setFormError(''); } }} />
                                {formError && <p className="text-xs text-red-600 font-medium mt-1">{formError}</p>}
                              </div>
                            ) : (
                              <HighlightMatch text={m.name} query={search} />
                            )}
                          </td>
                          <td className="px-4 py-3 text-zinc-500 text-sm">{m.created_at ? new Date(m.created_at).toLocaleString('pt-BR') : '—'}</td>
                          <td className="px-4 py-3 text-right space-x-3">
                            {editingRow === m.id ? (
                              <>
                                <button onClick={handleRowSave} disabled={saving} className="text-zinc-400 hover:text-green-700 text-sm font-medium transition-colors disabled:opacity-50">
                                  {saving ? '...' : 'Salvar'}
                                </button>
                                <button onClick={() => { setEditingRow(null); setRowDraft(''); setFormError(''); }} className="text-zinc-400 hover:text-red-600 text-sm transition-colors">Cancelar</button>
                              </>
                            ) : (
                              <>
                                <button onClick={() => { setRowDraft(m.name); setEditingRow(m.id); setFormError(''); }} className="text-zinc-400 hover:text-blue-700 text-sm transition-colors">Editar</button>
                                <button onClick={() => handleDelete(m.id)} className="text-zinc-400 hover:text-red-600 transition-colors"><Trash2 className="w-4 h-4" /></button>
                              </>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {available.length === 0 && <p className="text-center py-8 text-zinc-400">Nenhum insumo cadastrado.</p>}
                  {available.length > 0 && list.length === 0 && <p className="text-center py-8 text-zinc-400">Nenhum resultado encontrado.</p>}
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
        title="Excluir insumo"
        message="Esta ação não pode ser desfeita. O insumo será removido permanentemente."
      />
    </motion.div>
  );
}