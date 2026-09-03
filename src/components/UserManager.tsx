import React, { useState, useEffect, useRef } from 'react';
import { Trash2 } from 'lucide-react';
import { motion } from 'motion/react';
import { db } from '../services/lanDatabase';
import { User } from '../types';
import { useData } from '../hooks/useData';
import { useFormDraft } from '../context/FormDraftContext';
import { LoadingState, ErrorState } from './Feedback';
import { AdminAuthModal } from './AdminAuthModal';
import { useAuth } from '../context/AuthContext';

export function AdminPanel({ user }: { user: User }) {
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-6">
      <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden">
        {user.role === 'admin'
          ? <UserManager user={user} />
          : <p className="p-6 text-sm text-zinc-500">Somente administradores podem gerenciar funcionários.</p>}
      </div>
    </motion.div>
  );
}

export function UserManager({ user }: { user: User }) {
  const { data: users, loading, error, reload } = useData(() => db.users.list());
  const { sessionToken } = useAuth();
  const emptyForm = { name: '', username: '', password: '', role: 'employee' as 'admin' | 'employee' };
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);
  const { getDraft, saveDraft, removeDraft } = useFormDraft();
  const DRAFT_KEY = 'userManager';

  const draftRef = useRef(form);
  const skipFirstCleanupRef = useRef(true);
  useEffect(() => { draftRef.current = form; });

  useEffect(() => {
    const draft = getDraft<{ form: typeof emptyForm }>(DRAFT_KEY);
    if (!draft?.form) return;
    setForm(draft.form);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    return () => {
      if (skipFirstCleanupRef.current) { skipFirstCleanupRef.current = false; return; }
      saveDraft(DRAFT_KEY, { form: draftRef.current });
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const reset = () => {
    setForm(emptyForm);
    setEditingId(null);
    setFormError('');
  };

  const startEdit = (u: any) => {
    setForm({ name: u.name, username: u.username, password: '', role: u.role });
    setEditingId(u.id);
    setFormError('');
    // Scroll suave ao formulário
    document.getElementById('user-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!editingId && !form.password.trim()) {
      setFormError('Informe uma senha para o novo funcionário.');
      return;
    }

    setSaving(true);
    try {
      if (editingId) {
        // Edição: senha em branco = não altera
        const res: any = await db.users.update(editingId, {
          name: form.name.trim(),
          username: form.username.trim(),
          password: form.password.trim() || undefined,
          role: form.role,
        });
        if (res && res.success === false) {
          setFormError(res.error ?? 'Erro ao salvar. Tente novamente.');
          return;
        }
      } else {
        const res: any = await db.users.add({
          name: form.name.trim(),
          username: form.username.trim(),
          password: form.password.trim(),
          role: form.role,
        });
        if (res && res.success === false) {
          setFormError(res.error ?? 'Erro ao salvar. Tente novamente.');
          return;
        }
      }
      removeDraft(DRAFT_KEY);
      reset();
      reload();
    } catch (err: any) {
      setFormError(err?.message ?? 'Erro ao salvar. Tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (u: any) => {
    if (u.role === 'admin') { alert('Administradores não podem ser excluídos.'); return; }
    if (u.username === user.username) { alert('Você não pode excluir seu próprio usuário.'); return; }
    // Cancela edição se for o mesmo usuário sendo deletado
    if (editingId === u.id) reset();
    setPendingDeleteId(u.id);
    setDeleteModalOpen(true);
  };

  const handleDeleteConfirm = async (adminCreds?: { username: string; password: string }, token?: string) => {
    if (pendingDeleteId === null) return;
    try {
      const res: any = await db.users.remove(pendingDeleteId, adminCreds, token ?? sessionToken ?? undefined);
      if (res?.success === false) { setFormError(res.error ?? 'Erro ao excluir.'); return; }
      reload();
      setPendingDeleteId(null);
    } catch (err: any) {
      setFormError(err?.message ?? 'Erro ao excluir.');
    }
  };

  const isEditing = editingId !== null;

  return (
    <div className="p-6 space-y-6">
      {/* Formulário */}
      <div id="user-form" className={`rounded-xl border p-5 space-y-4 transition-colors ${isEditing ? 'bg-blue-50 border-blue-200' : 'bg-zinc-50 border-zinc-100'}`}>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-zinc-700 uppercase tracking-wide">
            {isEditing ? '✏️ Editando funcionário' : 'Novo funcionário'}
          </h3>
          {isEditing && (
            <button type="button" onClick={reset}
              className="text-xs text-zinc-500 hover:text-zinc-800 px-2 py-1 rounded-lg hover:bg-zinc-100 transition-colors">
              ✕ Cancelar edição
            </button>
          )}
        </div>

        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
          <div>
            <label className="block text-xs font-semibold text-zinc-500 uppercase mb-1">Nome completo</label>
            <input
              required
              type="text"
              className="w-full px-3 py-2 rounded-lg border border-zinc-300 focus:ring-2 focus:ring-red-500 outline-none bg-white"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-500 uppercase mb-1">Usuário de acesso</label>
            <input
              required
              type="text"
              className="w-full px-3 py-2 rounded-lg border border-zinc-300 focus:ring-2 focus:ring-red-500 outline-none bg-white"
              value={form.username}
              onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-500 uppercase mb-1">
              Senha {isEditing && <span className="text-zinc-400 font-normal normal-case">(em branco = não altera)</span>}
            </label>
            <input
              required={!isEditing}
              type="password"
              className="w-full px-3 py-2 rounded-lg border border-zinc-300 focus:ring-2 focus:ring-red-500 outline-none bg-white"
              value={form.password}
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-500 uppercase mb-1">Cargo</label>
            <select
              className="w-full px-3 py-2 rounded-lg border border-zinc-300 focus:ring-2 focus:ring-red-500 outline-none bg-white"
              value={form.role}
              onChange={e => setForm(f => ({ ...f, role: e.target.value as any }))}>
              <option value="employee">Funcionário</option>
              <option value="admin">Administrador</option>
            </select>
          </div>

          <div className="space-y-1">
            {formError && (
              <p className="text-xs text-red-600 font-medium bg-red-50 px-2 py-1 rounded">{formError}</p>
            )}
            <button
              type="submit"
              disabled={saving}
              style={{ background: isEditing ? 'linear-gradient(135deg, #243465, #1A2850)' : 'linear-gradient(135deg, #C5243E, #9B1A2E)' }}
              className="w-full text-white py-2 px-3 rounded-lg font-semibold hover:opacity-90 disabled:opacity-50 transition-all text-sm">
              {saving ? 'Salvando...' : isEditing ? '✓ Salvar alterações' : '+ Adicionar'}
            </button>
          </div>
        </form>
      </div>

      {/* Lista */}
      {loading && <LoadingState />}
      {error && <ErrorState message={error} onRetry={reload} />}
      {!loading && !error && (
        <div className="overflow-x-auto rounded-xl border border-zinc-100">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-zinc-100 bg-zinc-50 text-zinc-400 text-xs uppercase font-semibold">
                <th className="px-4 py-3">Nome</th>
                <th className="px-4 py-3">Usuário</th>
                <th className="px-4 py-3">Cargo</th>
                <th className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-50 bg-white">
              {(users as any[])?.map(u => (
                <tr key={u.id}
                  className={`transition-colors ${editingId === u.id ? 'bg-blue-50' : 'hover:bg-zinc-50'}`}>
                  <td className="px-4 py-3 font-medium text-zinc-900">{u.name}</td>
                  <td className="px-4 py-3 text-zinc-500 font-mono text-sm">{u.username}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${u.role === 'admin' ? 'bg-red-50 text-red-700' : 'bg-blue-50 text-blue-700'}`}>
                      {u.role === 'admin' ? 'Administrador' : 'Funcionário'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right space-x-2">
                    <button
                      onClick={() => editingId === u.id ? reset() : startEdit(u)}
                      className={`text-xs font-semibold px-3 py-1 rounded-lg transition-colors ${editingId === u.id ? 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200' : 'text-blue-600 hover:bg-blue-50'}`}>
                      {editingId === u.id ? 'Cancelar' : 'Editar'}
                    </button>
                    {u.role !== 'admin' && u.username !== user.username && (
                      <button
                        onClick={() => handleDelete(u)}
                        className="text-zinc-300 hover:text-red-600 transition-colors p-1 rounded">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {(users as any[])?.length === 0 && (
            <p className="text-center py-10 text-zinc-400">Nenhum funcionário cadastrado.</p>
          )}
        </div>
      )}
      <AdminAuthModal
        isOpen={deleteModalOpen}
        onClose={() => { setDeleteModalOpen(false); setPendingDeleteId(null); }}
        onConfirm={handleDeleteConfirm}
        title="Excluir funcionário"
        message="Esta ação não pode ser desfeita. O funcionário não conseguirá mais fazer login."
      />
    </div>
  );
}