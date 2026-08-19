import React, { useState } from 'react';
import { CheckCircle } from 'lucide-react';
import { db } from '../services/lanDatabase';
import { useData } from '../hooks/useData';
import { LoadingState, ErrorState } from './Feedback';

export function AdminUserManager() {
  const { data: users, loading, error, reload } = useData(() => db.users.list());
  const [form, setForm] = useState({ name: '', username: '', password: '' });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [success, setSuccess] = useState<string | null>(null);

  const admins = ((users as any[]) ?? []).filter(u => u.role === 'admin');

  const reset = () => {
    setForm({ name: '', username: '', password: '' });
    setEditingId(null);
    setFormError('');
  };

  const startEdit = (u: any) => {
    setForm({ name: u.name, username: u.username, password: '' });
    setEditingId(u.id);
    setFormError('');
    document.getElementById('admin-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (!editingId && !form.password.trim()) {
      setFormError('Informe uma senha para o administrador.');
      return;
    }
    setSaving(true); setSuccess(null);
    try {
      if (editingId) {
        await db.users.update(editingId, {
          name: form.name.trim(),
          username: form.username.trim(),
          password: form.password.trim() || undefined,
          role: 'admin',
        });
      } else {
        await db.users.add({
          name: form.name.trim(),
          username: form.username.trim(),
          password: form.password.trim(),
          role: 'admin',
        });
      }
      const wasEditing = editingId !== null;
      reset(); reload();
      setSuccess(wasEditing ? 'Alterações salvas com sucesso!' : 'Administrador criado! Use estas credenciais para acessar o sistema.');
    } catch (err: any) {
      setFormError(err?.message ?? 'Erro ao salvar. Tente novamente.');
    } finally { setSaving(false); }
  };

  const isEditing = editingId !== null;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-zinc-200 overflow-hidden">
      <div className="p-8 border-b border-zinc-100">
        <h2 className="text-2xl font-bold text-zinc-900">Usuário administrador</h2>
        <p className="text-zinc-500">
          Crie o administrador com acesso ao sistema completo (fórmulas, clientes, funcionários).
        </p>
        <p className="text-xs text-zinc-400 mt-2">
          Diferente do login de configuração <code className="font-mono">admin</code> / <code className="font-mono">admin123</code>,
          que só acessa esta tela de servidor.
        </p>
      </div>

      {/* Formulário */}
      <div id="admin-form" className={`p-6 border-b border-zinc-100 transition-colors ${isEditing ? 'bg-blue-50' : ''}`}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-zinc-700 uppercase tracking-wide">
            {isEditing ? '✏️ Editando administrador' : 'Novo administrador'}
          </h3>
          {isEditing && (
            <button type="button" onClick={reset}
              className="text-xs text-zinc-500 hover:text-zinc-800 px-2 py-1 rounded-lg hover:bg-zinc-100 transition-colors">
              ✕ Cancelar edição
            </button>
          )}
        </div>

        {success && (
          <div className="mb-4 flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle className="w-4 h-4 shrink-0" /> {success}
          </div>
        )}

        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
          <div>
            <label className="block text-xs font-semibold text-zinc-500 uppercase mb-1">Nome completo</label>
            <input required type="text" placeholder="Ex: João Silva"
              className="w-full px-3 py-2 rounded-lg border border-zinc-300 focus:ring-2 focus:ring-red-500 outline-none bg-white"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-zinc-500 uppercase mb-1">Usuário de acesso</label>
            <input required type="text" placeholder="Ex: joao (evite usar admin)"
              className="w-full px-3 py-2 rounded-lg border border-zinc-300 focus:ring-2 focus:ring-red-500 outline-none bg-white"
              value={form.username}
              onChange={e => setForm(f => ({ ...f, username: e.target.value }))} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-zinc-500 uppercase mb-1">
              Senha {isEditing && <span className="text-zinc-400 font-normal normal-case">(em branco = não altera)</span>}
            </label>
            <input required={!isEditing} type="password" placeholder={isEditing ? 'Deixe em branco para manter' : '••••••••'}
              className="w-full px-3 py-2 rounded-lg border border-zinc-300 focus:ring-2 focus:ring-red-500 outline-none bg-white"
              value={form.password}
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
          </div>
          <div className="space-y-1">
            {formError && (
              <p className="text-xs text-red-600 font-medium bg-red-50 px-2 py-1 rounded">{formError}</p>
            )}
            <button type="submit" disabled={saving}
              style={{ background: isEditing ? 'linear-gradient(135deg, #1F3164, #2a4080)' : 'linear-gradient(135deg, #C41E3C, #A01830)' }}
              className="w-full text-white py-2 px-3 rounded-lg font-semibold hover:opacity-90 disabled:opacity-50 transition-all text-sm">
              {saving ? 'Salvando...' : isEditing ? '✓ Salvar alterações' : '+ Criar administrador'}
            </button>
          </div>
        </form>
      </div>

      {/* Lista */}
      <div className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-zinc-700 uppercase tracking-wide">Administradores do sistema</h3>
          <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-red-50 text-red-700">{admins.length}</span>
        </div>
        {loading && <LoadingState />}
        {error && <ErrorState message={error} onRetry={reload} />}
        {!loading && !error && (
          <div className="overflow-x-auto rounded-xl border border-zinc-100">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-zinc-100 bg-zinc-50 text-zinc-400 text-xs uppercase font-semibold">
                  <th className="px-4 py-3">Nome</th>
                  <th className="px-4 py-3">Usuário</th>
                  <th className="px-4 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50 bg-white">
                {admins.map(u => (
                  <tr key={u.id} className={`transition-colors ${editingId === u.id ? 'bg-blue-50' : 'hover:bg-zinc-50'}`}>
                    <td className="px-4 py-3 font-medium text-zinc-900">{u.name}</td>
                    <td className="px-4 py-3 text-zinc-500 font-mono text-sm">{u.username}</td>
                    <td className="px-4 py-3 text-right space-x-2">
                      <button
                        onClick={() => editingId === u.id ? reset() : startEdit(u)}
                        className={`text-xs font-semibold px-3 py-1 rounded-lg transition-colors ${editingId === u.id ? 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200' : 'text-blue-600 hover:bg-blue-50'}`}>
                        {editingId === u.id ? 'Cancelar' : 'Editar'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {admins.length === 0 && (
              <p className="text-center py-10 text-zinc-400">Nenhum administrador cadastrado ainda.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}