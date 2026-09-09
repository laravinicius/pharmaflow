import React, { useState } from 'react';
import { RefreshCw, Search, X, ScrollText, ChevronLeft, ChevronRight } from 'lucide-react';
import { db } from '../services/lanDatabase';
import { useData } from '../hooks/useData';
import { LoadingState, ErrorState } from './Feedback';

const ACTION_OPTIONS = [
  { value: 'login', label: 'Login' },
  { value: 'logout', label: 'Logout' },
  { value: 'add', label: 'Adicionar' },
  { value: 'update', label: 'Atualizar' },
  { value: 'delete', label: 'Excluir' },
  { value: 'update_status', label: 'Alterar status' },
  { value: 'update_delivery_status', label: 'Alterar andamento' },
];

const ENTITY_OPTIONS = [
  { value: 'users', label: 'Usuários' },
  { value: 'customers', label: 'Clientes' },
  { value: 'insumos', label: 'Insumos' },
  { value: 'formulas', label: 'Fórmulas' },
  { value: 'saved_formulas', label: 'Fórmulas salvadas' },
  { value: 'system', label: 'Sistema' },
];

const PAGE_SIZE = 50;

const actionLabel = (a: string) => ACTION_OPTIONS.find(o => o.value === a)?.label ?? a;
const entityLabel = (e: string) => ENTITY_OPTIONS.find(o => o.value === e)?.label ?? e;

function actionBadge(action: string) {
  const color = {
    login: 'bg-emerald-50 text-emerald-700',
    logout: 'bg-zinc-100 text-zinc-600',
    add: 'bg-red-50 text-red-700',
    update: 'bg-blue-50 text-blue-700',
    delete: 'bg-red-50 text-red-700',
    update_status: 'bg-blue-50 text-blue-700',
    update_delivery_status: 'bg-blue-50 text-blue-700',
  }[action] ?? 'bg-zinc-100 text-zinc-600';
  return color;
}

const formatLogDate = (ts: string) => {
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return ts;
  const date = d.toLocaleDateString('pt-BR');
  const time = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  return `${date} ${time}`;
};

export function AuditLogs() {
  const { data: users } = useData(() => db.users.list());
  const [filters, setFilters] = useState<{
    userId?: number | '';
    action?: string;
    entity?: string;
    from?: string;
    to?: string;
    search?: string;
    page: number;
  }>({ userId: '', action: '', entity: '', from: '', to: '', search: '', page: 1 });

  const payload = {
    userId: filters.userId === '' ? undefined : Number(filters.userId),
    action: filters.action || undefined,
    entity: filters.entity || undefined,
    from: filters.from || undefined,
    to: filters.to || undefined,
    search: filters.search || undefined,
    page: filters.page,
    pageSize: PAGE_SIZE,
  };

  const { data, loading, error, reload } = useData(() => db.logs.list(payload), [JSON.stringify(payload)]);

  const set = (patch: Partial<typeof filters>) => setFilters(f => ({ ...f, ...patch, page: 1 }));
  const resetFilters = () => setFilters({ userId: '', action: '', entity: '', from: '', to: '', search: '', page: 1 });

  const rows: any[] = data?.rows ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-zinc-200 overflow-hidden">
      <div className="p-8 border-b border-zinc-100 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-zinc-900 flex items-center gap-2">
            <ScrollText className="w-6 h-6 text-red-700" /> Logs de atividades
          </h2>
          <p className="text-zinc-500">Histórico completo das ações realizadas pelos usuários.</p>
        </div>
        <button onClick={() => reload()} className="inline-flex items-center gap-2 border border-zinc-300 text-zinc-700 font-semibold px-4 py-2 rounded-lg hover:bg-zinc-50 transition-colors text-sm">
          <RefreshCw className="w-4 h-4" /> Atualizar
        </button>
      </div>

      {/* Filtros */}
      <div className="p-6 border-b border-zinc-100 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 bg-zinc-50/50">
        <div className="lg:col-span-2 col-span-2">
          <label className="block text-xs font-semibold text-zinc-500 uppercase mb-1">Busca</label>
          <div className="relative">
            <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={filters.search}
              onChange={e => set({ search: e.target.value })}
              placeholder="Usuário ou detalhe da ação..."
              className="w-full pl-9 pr-8 py-2 rounded-lg border border-zinc-300 focus:ring-2 focus:ring-red-500 outline-none text-sm bg-white"
            />
            {filters.search && (
              <button onClick={() => set({ search: '' })} className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-zinc-500 uppercase mb-1">Usuário</label>
          <select value={filters.userId} onChange={e => set({ userId: e.target.value ? Number(e.target.value) : '' })}
            className="w-full px-3 py-2 rounded-lg border border-zinc-300 focus:ring-2 focus:ring-red-500 outline-none text-sm bg-white">
            <option value="">Todos</option>
            {((users as any[]) ?? []).map(u => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
            <option value={0}>Configuração</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-zinc-500 uppercase mb-1">Ação</label>
          <select value={filters.action} onChange={e => set({ action: e.target.value })}
            className="w-full px-3 py-2 rounded-lg border border-zinc-300 focus:ring-2 focus:ring-red-500 outline-none text-sm bg-white">
            <option value="">Todas</option>
            {ACTION_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-zinc-500 uppercase mb-1">Entidade</label>
          <select value={filters.entity} onChange={e => set({ entity: e.target.value })}
            className="w-full px-3 py-2 rounded-lg border border-zinc-300 focus:ring-2 focus:ring-red-500 outline-none text-sm bg-white">
            <option value="">Todas</option>
            {ENTITY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-zinc-500 uppercase mb-1">De</label>
          <input type="date" value={filters.from} onChange={e => set({ from: e.target.value })}
            className="w-full px-3 py-2 rounded-lg border border-zinc-300 focus:ring-2 focus:ring-red-500 outline-none text-sm bg-white" />
        </div>

        <div>
          <label className="block text-xs font-semibold text-zinc-500 uppercase mb-1">Até</label>
          <input type="date" value={filters.to} onChange={e => set({ to: e.target.value })}
            className="w-full px-3 py-2 rounded-lg border border-zinc-300 focus:ring-2 focus:ring-red-500 outline-none text-sm bg-white" />
        </div>

        <div className="col-span-2 lg:col-span-6 flex items-center justify-between">
          <span className="text-xs text-zinc-400 font-medium">{total.toLocaleString('pt-BR')} registro(s) encontrados</span>
          <button onClick={resetFilters}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-500 hover:text-red-700 transition-colors">
            <X className="w-3.5 h-3.5" /> Limpar filtros
          </button>
        </div>
      </div>

      {/* Tabela */}
      {loading && <LoadingState />}
      {error && <ErrorState message={error} onRetry={reload} />}
      {!loading && !error && (
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-zinc-100 bg-zinc-50 text-zinc-400 text-xs uppercase font-semibold">
                <th className="px-6 py-3">Data e hora</th>
                <th className="px-6 py-3">Usuário</th>
                <th className="px-6 py-3">Ação</th>
                <th className="px-6 py-3">Entidade</th>
                <th className="px-6 py-3">Detalhes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-50 bg-white">
              {rows.map(r => (
                <tr key={r.id} className="hover:bg-zinc-50 transition-colors">
                  <td className="px-6 py-3 text-sm text-zinc-500 whitespace-nowrap">{formatLogDate(r.created_at)}</td>
                  <td className="px-6 py-3 text-sm font-medium text-zinc-900">{r.user_name || '—'}</td>
                  <td className="px-6 py-3">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${actionBadge(r.action)}`}>{actionLabel(r.action)}</span>
                  </td>
                  <td className="px-6 py-3 text-sm text-zinc-600">{entityLabel(r.entity)}</td>
                  <td className="px-6 py-3 text-sm text-zinc-500">{r.details || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 && (
            <p className="text-center py-10 text-zinc-400">Nenhum registro encontrado com os filtros atuais.</p>
          )}
        </div>
      )}

      {/* Paginação */}
      {!loading && !error && total > 0 && (
        <div className="flex items-center justify-between px-6 py-4 border-t border-zinc-100">
          <button
            onClick={() => setFilters(f => ({ ...f, page: f.page - 1 }))}
            disabled={filters.page <= 1}
            className="inline-flex items-center gap-1 text-sm font-semibold text-zinc-600 hover:text-zinc-900 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
            <ChevronLeft className="w-4 h-4" /> Anterior
          </button>
          <span className="text-sm text-zinc-500">Página {filters.page} de {totalPages}</span>
          <button
            onClick={() => setFilters(f => ({ ...f, page: f.page + 1 }))}
            disabled={filters.page >= totalPages}
            className="inline-flex items-center gap-1 text-sm font-semibold text-zinc-600 hover:text-zinc-900 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
            Próxima <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}