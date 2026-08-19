import React, { useState } from 'react';
import { CheckCircle, Trash2, Search, X } from 'lucide-react';
import { motion } from 'motion/react';
import { db } from '../services/lanDatabase';
import { Customer } from '../types';
import { formatPhone, isValidPhone, stripDiacritics } from '../utils/format';
import { useData } from '../hooks/useData';
import { LoadingState, ErrorState } from './Feedback';
import { HighlightMatch } from './HighlightMatch';

export function CustomerManager({ compact = false, onCreated }: { compact?: boolean; onCreated?: (c: Customer) => void } = {}) {
  const { data: customers, loading, error, reload } = useData(() => db.customers.list());
  const [form, setForm] = useState({ firstName: '', lastName: '', phone: '' });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingRow, setEditingRow] = useState<number | null>(null);
  const [rowDraft, setRowDraft] = useState({ name: '', phone: '' });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [success, setSuccess] = useState<string | null>(null);
  const [tab, setTab] = useState<'list' | 'create'>('list');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<{ key: 'name' | 'phone' | 'created_at'; dir: 'asc' | 'desc' }>({ key: 'name', dir: 'asc' });

  const reset = () => { setForm({ firstName: '', lastName: '', phone: '' }); setEditingId(null); setFormError(''); setSuccess(null); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidPhone(form.phone)) { setFormError('Informe o celular completo, com DDD.'); return; }
    const rawPhone = form.phone.replace(/\D/g, '');
    const formatted = formatPhone(form.phone);
    // Verificação de duplicata local
    if (!editingId) {
      const dup = (customers as Customer[])?.find(c => c.phone.replace(/\D/g,'') === rawPhone);
      if (dup) { setFormError(`Celular já cadastrado para: ${dup.name}`); return; }
    }
    setSaving(true); setFormError(''); setSuccess(null);
    try {
      const payload = { name: `${form.firstName} ${form.lastName}`.trim(), phone: formatted };
      if (editingId) {
        await db.customers.update(editingId, payload);
        reset(); reload();
      } else {
        const res: any = await db.customers.add(payload);
        if (res?.error?.includes('UNIQUE') || res?.error?.includes('unique')) {
          setFormError('Celular já cadastrado no servidor.');
        } else {
          if (onCreated) onCreated({ id: res.id, ...payload });
          reset(); reload();
          setSuccess('Cliente cadastrado com sucesso!');
        }
      }
    } catch (err: any) {
      setFormError(err.message ?? 'Erro ao salvar.');
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Excluir este cliente?')) return;
    await db.customers.remove(id); reload();
  };

  const handleRowSave = async () => {
    if (editingRow === null) return;
    if (!isValidPhone(rowDraft.phone)) { setFormError('Informe o celular completo, com DDD.'); return; }
    const formatted = formatPhone(rowDraft.phone);
    setSaving(true); setFormError('');
    try {
      await db.customers.update(editingRow, { name: rowDraft.name, phone: formatted });
      setEditingRow(null); setRowDraft({ name: '', phone: '' });
      reload();
    } catch (err: any) {
      setFormError(err.message ?? 'Erro ao salvar.');
    } finally { setSaving(false); }
  };

  const available = (customers as Customer[]) ?? [];
  const q = stripDiacritics(search.trim().toLowerCase());
  const qDigits = search.replace(/\D/g, '');
  const list = available
    .filter(c => {
      if (!q && !qDigits) return true;
      const name = stripDiacritics((c.name ?? '').toLowerCase());
      const matchesName = q && name.includes(q);
      const matchesPhone = qDigits && (c.phone ?? '').replace(/\D/g, '').includes(qDigits);
      return matchesName || matchesPhone;
    })
    .sort((a, b) => {
      if (q || qDigits) {
        // Ordena por relevância quando há busca: início do nome, início do
        // telefone, depois ocorrências internas; empates por nome (A–Z).
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
      }
      const dir = sort.dir === 'desc' ? -1 : 1;
      const av = String(a[sort.key] ?? '').toLowerCase();
      const bv = String(b[sort.key] ?? '').toLowerCase();
      return av.localeCompare(bv) * dir;
    });

  const formBlock = (
    <form onSubmit={handleSubmit} className={`grid gap-3 items-end bg-zinc-50 p-4 rounded-xl border border-zinc-100 ${compact ? '' : 'grid-cols-1 md:grid-cols-4'}`}>
        {success && (
        <p className={`flex items-center gap-1.5 text-xs font-semibold text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2 ${compact ? '' : 'md:col-span-4'}`}>
          <CheckCircle className="w-3.5 h-3.5 shrink-0" /> {success}
        </p>
      )}
        <div className={compact ? '' : 'md:col-span-1'}>
        <label className="block text-xs font-semibold text-zinc-500 uppercase mb-1">Nome</label>
        <input required className="w-full px-3 py-2 rounded-lg border border-zinc-300 focus:ring-2 focus:ring-red-500 outline-none" value={form.firstName} onChange={e => setForm({ ...form, firstName: e.target.value })} />
      </div>
      <div className={compact ? '' : 'md:col-span-1'}>
        <label className="block text-xs font-semibold text-zinc-500 uppercase mb-1">Sobrenome</label>
        <input required className="w-full px-3 py-2 rounded-lg border border-zinc-300 focus:ring-2 focus:ring-red-500 outline-none" value={form.lastName} onChange={e => setForm({ ...form, lastName: e.target.value })} />
      </div>
      <div>
        <label className="block text-xs font-semibold text-zinc-500 uppercase mb-1">Celular</label>
        <input required inputMode="numeric" className="w-full px-3 py-2 rounded-lg border border-zinc-300 focus:ring-2 focus:ring-red-500 outline-none" value={form.phone} onChange={e => { setFormError(''); setForm({ ...form, phone: formatPhone(e.target.value) }); }} placeholder="(00) 00000-0000" maxLength={15} />
      </div>
      <div className="space-y-1">
        {formError && <p className="text-xs text-red-600 font-medium">{formError}</p>}
        <div className="flex gap-2">
          <button type="submit" disabled={saving} style={{ background: 'linear-gradient(135deg, #C41E3C, #A01830)' }} className="flex-1 text-white py-2 px-3 rounded-lg font-medium hover:opacity-90 disabled:opacity-50 transition-all text-sm">
            {saving ? '...' : editingId ? 'Atualizar' : 'Adicionar'}
          </button>
          {editingId && <button type="button" onClick={reset} className="px-3 py-2 rounded-lg border border-zinc-300 text-zinc-600 hover:bg-zinc-100 text-sm">✕</button>}
        </div>
      </div>
    </form>
  );

  if (compact) return formBlock;

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-zinc-900">Clientes</h2>
        <p className="text-zinc-500">Gerencie os clientes da farmácia.</p>
      </div>
      <div className="flex items-center gap-4 border-b border-zinc-200">
        <button onClick={() => { setTab('list'); }} className={`pb-4 px-2 text-sm font-medium transition-colors relative ${tab === 'list' ? 'text-red-700' : 'text-zinc-500 hover:text-zinc-900'}`}>
          Lista de Clientes
          {tab === 'list' && <motion.div layoutId="activeCust" className="absolute bottom-0 left-0 right-0 h-0.5 bg-red-700" />}
        </button>
        <button onClick={() => setTab('create')} className={`pb-4 px-2 text-sm font-medium transition-colors relative ${tab === 'create' ? 'text-red-700' : 'text-zinc-500 hover:text-zinc-900'}`}>
          Cadastro de cliente
          {tab === 'create' && <motion.div layoutId="activeCust" className="absolute bottom-0 left-0 right-0 h-0.5 bg-red-700" />}
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
                      placeholder="Buscar por nome ou celular..." value={search} onChange={e => setSearch(e.target.value)} />
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
                    <option value="phone:asc">Celular</option>
                  </select>
                  <span className="text-xs font-semibold text-zinc-500 whitespace-nowrap">
                    {list.length} de {available.length} {available.length === 1 ? 'cliente' : 'clientes'}
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead><tr className="border-b border-zinc-100 text-zinc-400 text-xs uppercase font-semibold">
                      <th className="px-4 py-3">Nome</th><th className="px-4 py-3">Celular</th><th className="px-4 py-3">Cadastro</th><th className="px-4 py-3 text-right">Ações</th>
                    </tr></thead>
                    <tbody className="divide-y divide-zinc-50">
                      {list.map(c => (
                        <tr key={c.id} className="hover:bg-zinc-50 transition-colors">
                          <td className="px-4 py-3 font-medium text-zinc-900">
                            {editingRow === c.id ? (
                              <input className="w-full px-2 py-1 rounded-lg border border-zinc-300 focus:ring-2 focus:ring-red-500 outline-none text-sm"
                                value={rowDraft.name} onChange={e => setRowDraft(d => ({ ...d, name: e.target.value }))}
                                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleRowSave(); } }} />
                            ) : (
                              <HighlightMatch text={c.name} query={search} />
                            )}
                          </td>
                          <td className="px-4 py-3 text-zinc-600">
                            {editingRow === c.id ? (
                              <div>
                                <input inputMode="numeric" maxLength={15} placeholder="(00) 00000-0000"
                                  className="w-full px-2 py-1 rounded-lg border border-zinc-300 focus:ring-2 focus:ring-red-500 outline-none text-sm"
                                  value={rowDraft.phone} onChange={e => setRowDraft(d => ({ ...d, phone: formatPhone(e.target.value) }))}
                                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleRowSave(); } }} />
                                {formError && <p className="text-xs text-red-600 font-medium mt-1">{formError}</p>}
                              </div>
                            ) : (
                              <HighlightMatch text={c.phone} query={search} />
                            )}
                          </td>
                          <td className="px-4 py-3 text-zinc-500 text-sm">{c.created_at ? new Date(c.created_at).toLocaleString('pt-BR') : '—'}</td>
                          <td className="px-4 py-3 text-right space-x-3">
                            {editingRow === c.id ? (
                              <>
                                <button onClick={handleRowSave} disabled={saving} className="text-zinc-400 hover:text-green-700 text-sm font-medium transition-colors disabled:opacity-50">
                                  {saving ? '...' : 'Salvar'}
                                </button>
                                <button onClick={() => { setEditingRow(null); setRowDraft({ name: '', phone: '' }); setFormError(''); }} className="text-zinc-400 hover:text-red-600 text-sm transition-colors">Cancelar</button>
                              </>
                            ) : (
                              <>
                                <button onClick={() => { setRowDraft({ name: c.name, phone: c.phone }); setEditingRow(c.id); setFormError(''); }} className="text-zinc-400 hover:text-blue-700 text-sm transition-colors">Editar</button>
                                <button onClick={() => handleDelete(c.id)} className="text-zinc-400 hover:text-red-600 transition-colors"><Trash2 className="w-4 h-4" /></button>
                              </>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {available.length === 0 && <p className="text-center py-8 text-zinc-400">Nenhum cliente cadastrado.</p>}
                  {available.length > 0 && list.length === 0 && <p className="text-center py-8 text-zinc-400">Nenhum resultado encontrado.</p>}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}