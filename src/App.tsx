import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Users, Cross, ClipboardList, UserPlus, PlusCircle, LogOut,
  Trash2, CheckCircle2, Clock, FileText, ChevronRight, Search,
  Menu, Settings, RefreshCw, Wifi, WifiOff, AlertCircle, CloudOff,
  CloudUpload, CheckCircle, Calendar, X, History, AlertTriangle,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db } from './services/lanDatabase';

// ─── Types ─────────────────────────────────────────────────────────────────────

interface User { id: number; name: string; username: string; role: 'admin' | 'employee' }
interface Customer { id: number; name: string; phone: string; created_at?: string }
interface Material { id: number; name: string }
interface FormulaItem { material_id: number; material_name: string; quantity: number; unit?: string }
interface BudgetItem { quantity: number; unit: string; value: number; is_selected?: boolean }
interface Formula {
  id: number; customer_id: number; customer_name: string; customer_phone: string;
  pharmacist_name: string; status: 'pending' | 'completed' | 'confirmed' | 'cancelled' | 'delivered'; sync_status: string;
  created_at: string; items: FormulaItem[]; budget_number?: string; budget_items?: BudgetItem[];
  attendant_name?: string; delivery_date?: string | null;
  payment_status?: string; payment_method?: string | null;
  delivery_status?: string; cancel_reason?: string | null;
}
interface SyncStatus {
  state: 'idle' | 'syncing' | 'offline' | 'error' | 'connecting';
  lastSync: string | null;
  pending: number;
  error?: string;
}

// ─── Phone Utilities ─────────────────────────────────────────────────────────

// Formata em tempo de digitação: DDD entre parênteses após 2 dígitos,
// aceita fixo (00) 0000-0000 (10 dígitos) ou celular (00) 00000-0000 (11 dígitos)
function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length === 0) return '';
  if (digits.length <= 2) return `(${digits}`;
  const ddd = digits.slice(0, 2);
  const rest = digits.slice(2);
  if (digits.length === 10) return `(${ddd}) ${rest.slice(0, 4)}-${rest.slice(4)}`;
  if (rest.length <= 5) return `(${ddd}) ${rest}`;
  return `(${ddd}) ${rest.slice(0, 5)}-${rest.slice(5)}`;
}

function isValidPhone(value: string): boolean {
  const len = value.replace(/\D/g, '').length;
  return len === 10 || len === 11;
}

// Máscara de moeda (R$): dígitos digitados viram centavos — ex.: "123456" → "1.234,56"
function formatCurrency(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 15);
  if (!digits) return '';
  const cents = digits.padStart(3, '0');
  const reais = (cents.slice(0, -2).replace(/^0+/, '') || '0').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${reais},${cents.slice(-2)}`;
}

// Converte texto com máscara de moeda para número (ex.: "1.234,56" → 1234.56)
function parseCurrency(value: string): number {
  const digits = value.replace(/\D/g, '');
  return digits ? Number(digits) / 100 : 0;
}

// Máscara de data ao digitar (ex.: "15082026" → "15/08/2026")
function formatDateBR(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 8);
  if (!digits) return '';
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

// Converte "DD/MM/AAAA" (ou "ddmmaaaa") para ISO "AAAA-MM-DD";
// valida data real (dias do mês e ano bissexto). Retorna null se inválida.
function parseDateBR(value: string): string | null {
  const digits = value.replace(/\D/g, '');
  if (digits.length !== 8) return null;
  const dd = Number(digits.slice(0, 2));
  const mm = Number(digits.slice(2, 4));
  const yyyy = Number(digits.slice(4));
  if (mm < 1 || mm > 12 || dd < 1) return null;
  const daysInMonth = new Date(yyyy, mm, 0).getDate();
  if (dd > daysInMonth) return null;
  return `${String(yyyy).padStart(4, '0')}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
}

// Converte ISO "AAAA-MM-DD" para exibição "DD/MM/AAAA"
function formatDateToBR(iso: string): string {
  const [y, m, d] = iso.split('-');
  return d && m && y ? `${d}/${m}/${y}` : iso;
}

// Remove acentos para comparação na busca (ex.: "jose" encontra "José")
function stripDiacritics(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

// Destaca o trecho do texto que corresponde à busca (ignora maiúsculas e acentos)
function HighlightMatch({ text, query }: { text: string; query: string }) {
  const q = stripDiacritics(query.trim().toLowerCase());
  if (!q || !text) return <>{text}</>;
  const comp: { ch: string; idx: number }[] = [];
  for (let i = 0; i < text.length; i++) {
    const base = stripDiacritics(text[i].toLowerCase());
    for (const b of base) comp.push({ ch: b, idx: i });
  }
  const start = comp.map(c => c.ch).join('').indexOf(q);
  if (start === -1) return <>{text}</>;
  const end = start + q.length;
  const textStart = comp[start].idx;
  const textEnd = comp[end - 1].idx + 1;
  return (
    <>
      {text.slice(0, textStart)}
      <mark className="bg-red-100 text-red-700 font-semibold rounded-sm px-0.5">{text.slice(textStart, textEnd)}</mark>
      {text.slice(textEnd)}
    </>
  );
}

// ─── Hook: dados com reload ───────────────────────────────────────────────────

function useData<T>(fetcher: () => Promise<T>, deps: any[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try { setData(await fetcher()); }
    catch (e: any) { setError(e.message ?? 'Erro desconhecido'); }
    finally { setLoading(false); }
  }, deps);

  useEffect(() => { load(); }, [load]);
  return { data, loading, error, reload: load };
}

// ─── App Principal ─────────────────────────────────────────────────────────────

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [setupMode, setSetupMode] = useState(false);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'admin' | 'recipe' | 'pending' | 'confirmed' | 'formulaDetail' | 'confirmedDetail' | 'history' | 'historyDetail' | 'customers' | 'settings'>('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'info' } | null>(null);
  const [templateFormula, setTemplateFormula] = useState<Formula | null>(null);
  const [viewingFormula, setViewingFormula] = useState<Formula | null>(null);
  const [missingReasons, setMissingReasons] = useState<string[] | null>(null);
  const prevSyncState = useRef<string | null>(null);

  const showToast = (msg: string, type: 'success' | 'info' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Escuta atualizações de sync do processo principal
  useEffect(() => {
    if (!window.electronAPI) return;
    db.sync.status().then(setSyncStatus);
    db.sync.onUpdate((s) => {
      setSyncStatus(s);
      // Toast quando reconecta (offline → idle)
      if (prevSyncState.current === 'offline' && s.state === 'idle') {
        showToast('✓ Conexão restabelecida — dados sincronizados.', 'success');
      }
      prevSyncState.current = s.state;
    });
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginLoading(true); setLoginError('');
    try {
      const res = await db.auth.login(loginForm.username, loginForm.password);
      if (res.success) {
        setUser(res.user);
        setSetupMode(res.setupMode === true);
        setActiveTab('dashboard');
      } else {
        setLoginError(res.error ?? 'Erro ao fazer login.');
      }
    } catch {
      setLoginError('Erro ao conectar ao servidor.');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = () => {
    setUser(null);
    setSetupMode(false);
    setActiveTab('dashboard');
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'linear-gradient(135deg, #fff0f3 0%, #fff 50%, #f0f4ff 100%)' }}>
      <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-zinc-200 overflow-hidden"
        >
          <div className="h-1.5 w-full" style={{ background: 'linear-gradient(90deg, #C41E3C, #1F3164, #C41E3C)' }} />
          <div className="p-8">
          <div className="flex flex-col items-center mb-8">
            <PixFarmaLogo size="lg" />
            <p className="text-zinc-500 text-sm mt-2">Acesse sua conta para continuar</p>
          </div>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">Usuário</label>
              <input type="text" required
                className="w-full px-4 py-2 rounded-lg border border-zinc-300 focus:ring-2 focus:ring-red-500 outline-none transition-all"
                value={loginForm.username}
                onChange={e => setLoginForm({ ...loginForm, username: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">Senha</label>
              <input type="password" required
                className="w-full px-4 py-2 rounded-lg border border-zinc-300 focus:ring-2 focus:ring-red-500 outline-none transition-all"
                value={loginForm.password}
                onChange={e => setLoginForm({ ...loginForm, password: e.target.value })}
              />
            </div>
            {loginError && (
              <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 px-3 py-2 rounded-lg">
                <AlertCircle className="w-4 h-4 shrink-0" />{loginError}
              </div>
            )}
            {loginError.includes('Servidor indisponível') && (
              <div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                <p className="text-sm text-amber-900">
                  O servidor não respondeu. Este computador só entra offline se este usuário já tiver feito login online antes.
                </p>
              </div>
            )}
            <button type="submit" disabled={loginLoading}
              className="w-full hover:opacity-90 disabled:opacity-60 text-white font-semibold py-2.5 rounded-lg transition-all shadow-lg shadow-red-200"
              style={{ background: 'linear-gradient(135deg, #C41E3C, #A01830)' }}
            >
              {loginLoading ? 'Conectando...' : 'Entrar'}
            </button>
          </form>
          </div>
        </motion.div>
      </div>
    );
  }

  if (setupMode) {
    return (
      <div className="min-h-screen flex flex-col bg-zinc-50">
        <header className="h-16 bg-white border-b border-zinc-200 flex items-center justify-between px-8 shrink-0">
          <PixFarmaLogo size="md" />
          <button
            onClick={handleLogout}
            className="inline-flex items-center gap-2 rounded-lg border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sair
          </button>
        </header>
        <main className="flex-1 overflow-auto p-8">
          <SettingsManager />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col">
      {/* Barra de status de conexão — só aparece em estados que requerem atenção */}
      <AnimatePresence>
        {syncStatus && (syncStatus.state === 'offline' || syncStatus.state === 'syncing' || syncStatus.state === 'error') && (
          <motion.div
            key={syncStatus.state}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
          >
            {syncStatus.state === 'offline' && (
              <div className="bg-amber-600 text-white text-xs font-semibold px-6 py-2 flex items-center gap-3">
                <CloudOff className="w-3.5 h-3.5 shrink-0" />
                <span>Servidor indisponível — trabalhando offline com dados locais.</span>
                {syncStatus.pending > 0 && (
                  <span className="bg-amber-700 px-2 py-0.5 rounded-full whitespace-nowrap">
                    {syncStatus.pending} {syncStatus.pending === 1 ? 'alteração pendente' : 'alterações pendentes'}
                  </span>
                )}
                <span className="ml-auto text-amber-200 font-normal whitespace-nowrap">Tentando reconectar a cada 30s</span>
              </div>
            )}
            {syncStatus.state === 'syncing' && (
              <div className="text-white text-xs font-semibold px-6 py-2 flex items-center gap-3" style={{ background: '#1F3164' }}>
                <RefreshCw className="w-3.5 h-3.5 shrink-0 animate-spin" />
                <span>Sincronizando com o servidor...</span>
                {syncStatus.pending > 0 && (
                  <span className="bg-blue-900 px-2 py-0.5 rounded-full">{syncStatus.pending} pendentes</span>
                )}
              </div>
            )}
            {syncStatus.state === 'error' && (
              <div className="bg-red-700 text-white text-xs font-semibold px-6 py-2 flex items-center gap-3">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>Erro de sincronização — {syncStatus.error ?? 'verifique a conexão com o servidor.'}</span>
                <button onClick={() => db.sync.now().then(setSyncStatus)}
                  className="ml-auto bg-red-800 hover:bg-red-900 px-3 py-0.5 rounded-full transition-colors whitespace-nowrap">
                  Tentar novamente
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex flex-1 min-h-0">

      {/* Toast de notificação */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            className="fixed top-4 right-4 z-50 px-4 py-3 rounded-xl shadow-xl text-sm font-semibold text-white flex items-center gap-2 pointer-events-none"
            style={{ background: toast.type === 'success' ? 'linear-gradient(135deg,#16a34a,#15803d)' : '#1F3164' }}
          >
            {toast.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <RefreshCw className="w-4 h-4" />}
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>
        {/* Sidebar */}
        <aside className={`border-r border-zinc-200 transition-all duration-300 ${isSidebarOpen ? 'w-64' : 'w-20'} flex flex-col shrink-0 self-start sticky top-0 h-screen overflow-hidden`}
          style={{ background: '#1F3164' }}>
          <div className="p-5 flex items-center gap-3">
            <PixFarmaLogo size={isSidebarOpen ? 'md' : 'icon'} />
          </div>

          {setupMode && isSidebarOpen && (
            <div className="mx-4 mb-4 px-3 py-2 rounded-lg" style={{ background: 'rgba(196,30,60,0.15)', border: '1px solid rgba(196,30,60,0.3)' }}>
              <p className="text-xs font-semibold text-red-300">Modo Configuração</p>
              <p className="text-xs text-red-400 mt-0.5">Configure o servidor e faça login normalmente.</p>
            </div>
          )}

          <nav className="flex-1 px-4 space-y-1">
            {!setupMode && (
              <>
                <NavItem icon={<ClipboardList />} label="Dashboard" active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} collapsed={!isSidebarOpen} />
                <NavItem icon={<PlusCircle />} label="Nova Fórmula" active={activeTab === 'recipe'} onClick={() => setActiveTab('recipe')} collapsed={!isSidebarOpen} />
                <NavItem icon={<Clock />} label="Pendentes" active={activeTab === 'pending'} onClick={() => setActiveTab('pending')} collapsed={!isSidebarOpen} />
                <NavItem icon={<CheckCircle2 />} label="Confirmadas" active={activeTab === 'confirmed'} onClick={() => setActiveTab('confirmed')} collapsed={!isSidebarOpen} />
                <NavItem icon={<History />} label="Histórico" active={activeTab === 'history'} onClick={() => setActiveTab('history')} collapsed={!isSidebarOpen} />
                <NavItem icon={<Users />} label="Clientes" active={activeTab === 'customers'} onClick={() => setActiveTab('customers')} collapsed={!isSidebarOpen} />
                <NavItem icon={<Settings />} label="Administração" active={activeTab === 'admin'} onClick={() => setActiveTab('admin')} collapsed={!isSidebarOpen} />
              </>
            )}
          </nav>

          <div className="p-4" style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }}>
            <div className={`flex items-center gap-3 p-2 rounded-lg ${isSidebarOpen ? '' : ''}`}
              style={{ background: 'rgba(255,255,255,0.07)' }}>
              <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                style={{ background: 'rgba(255,255,255,0.15)' }}>
                <UserPlus className="w-4 h-4 text-white opacity-70" />
              </div>
              {isSidebarOpen && (
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{user.name}</p>
                  <p className="text-xs opacity-50 text-white capitalize">{user.role === 'admin' ? 'Administrador' : 'Funcionário'}</p>
                </div>
              )}
              <button onClick={handleLogout}
                className="transition-colors text-white opacity-40 hover:opacity-100">
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </aside>

        {/* Main */}
        <main className="flex-1 flex flex-col min-w-0">
          <header className="h-16 bg-white border-b border-zinc-200 flex items-center justify-between px-8 shrink-0">
            <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="text-zinc-500 hover:text-zinc-900">
              <Menu className="w-6 h-6" />
            </button>

            <div className="flex items-center gap-4">
              {/* Indicador de sync */}
              {syncStatus && <SyncIndicator status={syncStatus} onSync={() => db.sync.now().then(setSyncStatus)} />}
              <div className="text-sm text-zinc-500">
                {new Date().toLocaleDateString('pt-BR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </div>
            </div>
          </header>

          <div className="flex-1 overflow-auto p-8">
            <AnimatePresence mode="wait">
              {activeTab === 'dashboard' && <Dashboard user={user} onNavigate={setActiveTab} />}
              {activeTab === 'admin' && <AdminPanel user={user} />}
              {activeTab === 'recipe' && <RecipeForm user={user} template={templateFormula} onComplete={(dest) => { setTemplateFormula(null); setActiveTab(dest); }} />}
              {activeTab === 'formulaDetail' && viewingFormula && <RecipeForm user={user} formula={viewingFormula} onComplete={(dest) => { setViewingFormula(null); setTemplateFormula(null); setActiveTab(dest); }} />}
              {activeTab === 'confirmedDetail' && viewingFormula && <RecipeForm user={user} formula={viewingFormula} confirmed onComplete={(dest) => { setViewingFormula(null); setTemplateFormula(null); setActiveTab('confirmed'); }} />}
              {activeTab === 'pending' && <FormulaList variant="pending" title="Fórmulas Pendentes" subtitle="Fórmulas pendentes aguardando confirmação" statuses={['pending']} onSelect={(f) => { setViewingFormula(f); setActiveTab('formulaDetail'); }} onConfirm={(f, reasons) => { if (reasons.length === 0) { setActiveTab('confirmed'); } else { setViewingFormula(f); setMissingReasons(reasons); setActiveTab('formulaDetail'); } }} />}
              {activeTab === 'confirmed' && <FormulaList variant="confirmed" title="Fórmulas Confirmadas" subtitle="Fórmulas confirmadas para manipulação" statuses={['confirmed', 'completed']} onSelect={(f) => { setViewingFormula(f); setActiveTab('confirmedDetail'); }} />}
              {activeTab === 'history' && <FormulaList variant="confirmed" title="Histórico" subtitle="Fórmulas canceladas e entregues" statuses={['cancelled', 'delivered']} statusFilterOptions={[{ value: 'cancelled', label: 'Canceladas' }, { value: 'delivered', label: 'Entregues' }]} showAndamento={false} onSelect={(f) => { setViewingFormula(f); setActiveTab('historyDetail'); }} />}
              {activeTab === 'historyDetail' && viewingFormula && <RecipeForm user={user} formula={viewingFormula} readOnly onComplete={() => { setViewingFormula(null); setTemplateFormula(null); setActiveTab('history'); }} />}
              {activeTab === 'customers' && <CustomerManager />}
            </AnimatePresence>
          </div>
        </main>
      </div>

      {missingReasons && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setMissingReasons(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 className="font-bold text-zinc-900 text-lg">Informações necessárias</h3>
                <p className="text-xs text-zinc-500">Preencha os campos abaixo para confirmar esta fórmula.</p>
              </div>
            </div>
            <ul className="space-y-2">
              {missingReasons.map(r => (
                <li key={r} className="flex items-center gap-2 text-sm text-zinc-700">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
                  {r}
                </li>
              ))}
            </ul>
            <button type="button" onClick={() => setMissingReasons(null)}
              className="mt-5 w-full py-2.5 rounded-xl text-white font-semibold text-sm hover:opacity-90 transition-all"
              style={{ background: 'linear-gradient(135deg, #C41E3C, #A01830)' }}>
              Entendi
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── SyncIndicator ─────────────────────────────────────────────────────────────

function SyncIndicator({ status, onSync }: { status: SyncStatus; onSync: () => void }) {
  const fmtDate = (iso: string | null) => {
    if (!iso) return null;
    const d = new Date(iso);
    const diffMin = Math.floor((Date.now() - d.getTime()) / 60000);
    if (diffMin < 1) return 'agora mesmo';
    if (diffMin < 60) return `há ${diffMin}min`;
    return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  };

  const stateConfig = {
    idle: {
      icon: <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />,
      label: status.lastSync ? `Sincronizado ${fmtDate(status.lastSync)}` : 'Conectado',
      cls: 'text-emerald-700 bg-emerald-50',
    },
    syncing: {
      icon: <RefreshCw className="w-3.5 h-3.5 text-blue-500 animate-spin" />,
      label: 'Sincronizando...',
      cls: 'text-blue-700 bg-blue-50',
    },
    offline: {
      icon: <WifiOff className="w-3.5 h-3.5 text-amber-500" />,
      label: 'Offline',
      cls: 'text-amber-700 bg-amber-50',
    },
    error: {
      icon: <AlertCircle className="w-3.5 h-3.5 text-red-500" />,
      label: 'Erro de sync',
      cls: 'text-red-700 bg-red-50',
    },
    connecting: {
      icon: <RefreshCw className="w-3.5 h-3.5 text-zinc-400 animate-spin" />,
      label: 'Verificando...',
      cls: 'text-zinc-500 bg-zinc-100',
    },
  } as const;

  const cfg = stateConfig[status.state] ?? stateConfig.connecting;

  return (
    <div className="flex items-center gap-2">
      {status.pending > 0 && status.state === 'idle' && (
        <span className="text-xs bg-amber-100 text-amber-700 font-bold px-2 py-0.5 rounded-full">
          {status.pending} pendente{status.pending > 1 ? 's' : ''}
        </span>
      )}
      <div className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${cfg.cls}`}>
        {cfg.icon}
        <span>{cfg.label}</span>
      </div>
      {status.state !== 'connecting' && (
        <button onClick={onSync} disabled={status.state === 'syncing'}
          title="Sincronizar agora"
          className="p-1 text-zinc-400 hover:text-zinc-700 disabled:opacity-30 transition-colors rounded-lg hover:bg-zinc-100">
          <CloudUpload className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}

// ─── PixFarma Logo ─────────────────────────────────────────────────────────────

// ─── PixFarma Logo ─────────────────────────────────────────────────────────────

const PRIMARY = '#C41E3C';
const SECONDARY = '#1F3164';
const FARMA_COLOR = '#4A90D9'; // azul mais claro — visível tanto no fundo branco quanto no navy

function CrossIcon({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect x="10" y="2" width="4" height="20" rx="2" fill="white"/>
      <rect x="2" y="10" width="20" height="4" rx="2" fill="white"/>
    </svg>
  );
}

// Logo opcional em /logo.png; se não existir, o app usa o ícone padrão
const LOGO_SRC = '/logo.png';

function LogoImage({ sizePx, rounded = 'rounded-xl' }: { sizePx: number; rounded?: string }) {
  const [hasImage, setHasImage] = React.useState(true);
  const gradient = `linear-gradient(135deg, ${PRIMARY} 0%, ${SECONDARY} 100%)`;
  if (!hasImage) {
    return (
      <div className={`flex items-center justify-center shrink-0 shadow-md ${rounded}`}
        style={{ width: sizePx, height: sizePx, background: gradient }}>
        <CrossIcon size={Math.round(sizePx * 0.55)} />
      </div>
    );
  }
  return (
    <img src={LOGO_SRC} alt="PIX Farma"
      className={`shrink-0 shadow-md object-contain bg-white ${rounded}`}
      style={{ width: sizePx, height: sizePx }}
      onError={() => setHasImage(false)} />
  );
}

function PixFarmaLogo({ size = 'md' }: { size?: 'icon' | 'md' | 'lg' }) {
  if (size === 'icon') return <LogoImage sizePx={40} />;

  if (size === 'lg') {
    return (
      <div className="flex flex-col items-center gap-3">
        <LogoImage sizePx={80} rounded="rounded-2xl" />
        <div className="text-center">
          <div className="text-2xl font-black tracking-tight" style={{ fontFamily: 'Georgia, serif' }}>
            <span style={{ color: PRIMARY }}>Pix</span><span style={{ color: FARMA_COLOR }}>Farma</span>
          </div>
          <div className="text-xs text-zinc-400 font-medium tracking-widest uppercase mt-0.5">Sistema de Manipulação</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <LogoImage sizePx={40} />
      <div>
        <div className="font-black text-lg leading-tight tracking-tight" style={{ fontFamily: 'Georgia, serif' }}>
          <span style={{ color: PRIMARY }}>Pix</span><span style={{ color: FARMA_COLOR }}>Farma</span>
        </div>
        <div className="text-[10px] text-zinc-400 font-medium tracking-widest uppercase leading-tight">Manipulação</div>
      </div>
    </div>
  );
}

// ─── NavItem ───────────────────────────────────────────────────────────────────

function NavItem({ icon, label, active, onClick, collapsed }: {
  icon: React.ReactNode; label: string; active: boolean; onClick: () => void; collapsed: boolean
}) {
  return (
    <button onClick={onClick}
      style={active
        ? { background: 'rgba(255,255,255,0.15)', color: 'white' }
        : undefined}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all ${
        active ? 'font-semibold' : 'text-white opacity-60 hover:opacity-100 hover:bg-white/10'
      }`}>
      <span style={active ? { color: '#FBBF24' } : undefined}>{icon}</span>
      {!collapsed && <span>{label}</span>}
    </button>
  );
}

// ─── Feedback ──────────────────────────────────────────────────────────────────

function LoadingState({ label = 'Carregando...' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center py-16 text-zinc-400 gap-2">
      <RefreshCw className="w-5 h-5 animate-spin" /><span>{label}</span>
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3">
      <WifiOff className="w-10 h-10 text-red-400" />
      <p className="text-zinc-600 font-medium">Erro ao carregar dados</p>
      <p className="text-zinc-400 text-sm text-center max-w-xs">{message}</p>
      <button onClick={onRetry} className="flex items-center gap-2 text-sm bg-zinc-100 hover:bg-zinc-200 px-4 py-2 rounded-lg transition-colors font-medium">
        <RefreshCw className="w-4 h-4" /> Tentar novamente
      </button>
    </div>
  );
}

// ─── Dashboard ─────────────────────────────────────────────────────────────────

function Dashboard({ user, onNavigate }: { user: User; onNavigate: (tab: any) => void }) {
  const { data: customers } = useData(() => db.customers.list());
  const { data: materials } = useData(() => db.materials.list());
  const { data: formulas } = useData(() => db.formulas.list());
  const pendingFormulas = (formulas ?? []).filter((f: Formula) => f.status === 'pending').length;
  const confirmedFormulas = (formulas ?? []).filter((f: Formula) => f.status === 'confirmed' || f.status === 'completed').length;

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold text-zinc-900">Bem-vindo, {user.name}</h2>
        <p className="text-zinc-500">Aqui está o que está acontecendo na farmácia hoje.</p>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6">
        <StatCard icon={<ClipboardList className="text-blue-600" />} label="Fórmulas Totais" value={formulas?.length ?? 0} color="bg-blue-50" />
        <StatCard icon={<Clock className="text-red-600" />} label="Pendentes" value={pendingFormulas} color="bg-red-50" />
        <StatCard icon={<CheckCircle2 className="text-emerald-600" />} label="Confirmadas" value={confirmedFormulas} color="bg-emerald-50" />
        <StatCard icon={<Users className="text-purple-600" />} label="Clientes" value={customers?.length ?? 0} color="bg-purple-50" />
        <StatCard icon={<Cross className="text-red-700" />} label="Matérias-Primas" value={materials?.length ?? 0} color="bg-red-50" />
      </div>
      <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm max-w-2xl">
        <h3 className="text-lg font-semibold mb-4">Ações Rápidas</h3>
        <div className="grid grid-cols-3 gap-4">
          <QuickActionButton icon={<PlusCircle />} label="Nova Fórmula" onClick={() => onNavigate('recipe')} color="pf-orange" />
          <QuickActionButton icon={<Clock />} label="Pendentes" onClick={() => onNavigate('pending')} color="bg-zinc-800" />
          <QuickActionButton icon={<CheckCircle2 />} label="Confirmadas" onClick={() => onNavigate('confirmed')} color="bg-zinc-800" />
        </div>
      </div>
    </motion.div>
  );
}

function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number; color: string }) {
  return (
    <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm flex items-center gap-4">
      <div className={`w-12 h-12 ${color} rounded-xl flex items-center justify-center`}>{icon}</div>
      <div><p className="text-sm text-zinc-500 font-medium">{label}</p><p className="text-2xl font-bold text-zinc-900">{value}</p></div>
    </div>
  );
}

function QuickActionButton({ icon, label, onClick, color }: { icon: React.ReactNode; label: string; onClick: () => void; color: string }) {
  const isPfOrange = color === 'pf-orange';
  return (
    <button
      onClick={onClick}
      style={isPfOrange ? { background: 'linear-gradient(135deg, #C41E3C, #A01830)' } : undefined}
      className={`flex flex-col items-center justify-center gap-3 p-6 rounded-xl text-white transition-transform hover:scale-[1.02] active:scale-[0.98] hover:opacity-90 ${isPfOrange ? '' : color}`}>
      {icon}<span className="font-medium">{label}</span>
    </button>
  );
}

// ─── Admin Panel ───────────────────────────────────────────────────────────────

function AdminPanel({ user }: { user: User }) {
  const [tab, setTab] = useState<'materials' | 'users'>('materials');
  const allTabs = [
    { key: 'materials' as const, label: 'Matérias-Primas' },
    { key: 'users' as const, label: 'Funcionários', adminOnly: true },
  ];
  const tabs = allTabs.filter(t => !t.adminOnly || user.role === 'admin');

  // Se a aba ativa foi removida (employee tentando acessar users), volta para materials
  const activeTab = tabs.find(t => t.key === tab) ? tab : 'materials';

  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
      <div className="flex items-center gap-4 border-b border-zinc-200">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} className={`pb-4 px-2 text-sm font-medium transition-colors relative ${activeTab === t.key ? 'text-red-700' : 'text-zinc-500 hover:text-zinc-900'}`}>
            {t.label}
            {activeTab === t.key && <motion.div layoutId="activeSub" className="absolute bottom-0 left-0 right-0 h-0.5 bg-red-700" />}
          </button>
        ))}
      </div>
      <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden">
        {activeTab === 'materials' && <MaterialManager />}
        {activeTab === 'users' && user.role === 'admin' && <UserManager user={user} />}
      </div>
    </motion.div>
  );
}

// ─── CustomerManager ───────────────────────────────────────────────────────────

function CustomerManager({ compact = false, onCreated }: { compact?: boolean; onCreated?: (c: Customer) => void } = {}) {
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

// ─── MaterialManager ───────────────────────────────────────────────────────────

function MaterialManager({ compact = false, onCreated }: { compact?: boolean; onCreated?: (m: Material) => void } = {}) {
  const { data: materials, loading, error, reload } = useData(() => db.materials.list());
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const dup = (materials as Material[])?.find(m => m.name.toLowerCase() === name.toLowerCase().trim());
    if (dup) { setFormError('Matéria-prima já cadastrada.'); return; }
    setSaving(true); setFormError('');
    try {
      const res: any = await db.materials.add(name.trim());
      if (onCreated) onCreated({ id: res.id, name: name.trim() });
      setName(''); reload();
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Excluir esta matéria-prima?')) return;
    await db.materials.remove(id); reload();
  };

  const formBlock = (
    <form onSubmit={handleSubmit} className="flex gap-3 items-end bg-zinc-50 p-4 rounded-xl border border-zinc-100">
      <div className="flex-1">
        <label className="block text-xs font-semibold text-zinc-500 uppercase mb-1">Nome da Matéria-Prima</label>
        <input required className="w-full px-3 py-2 rounded-lg border border-zinc-300 focus:ring-2 focus:ring-red-500 outline-none" value={name} onChange={e => { setFormError(''); setName(e.target.value); }} placeholder="Ex: Amoxicilina" />
        {formError && <p className="text-xs text-red-600 mt-1">{formError}</p>}
      </div>
      <button type="submit" disabled={saving} style={{ background: 'linear-gradient(135deg, #C41E3C, #A01830)' }} className="text-white py-2 px-4 rounded-lg font-medium hover:opacity-90 disabled:opacity-60 transition-all whitespace-nowrap">
        {saving ? '...' : 'Adicionar'}
      </button>
    </form>
  );

  if (compact) return formBlock;

  return (
    <div className="p-6 space-y-6">
      {formBlock}
      {loading && <LoadingState />}
      {error && <ErrorState message={error} onRetry={reload} />}
      {!loading && !error && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {(materials as Material[])?.map(m => (
            <div key={m.id} className="p-4 bg-zinc-50 rounded-xl border border-zinc-100 flex items-center justify-between group">
              <span className="font-medium text-zinc-900">{m.name}</span>
              <button onClick={() => handleDelete(m.id)} className="text-zinc-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-all"><Trash2 className="w-4 h-4" /></button>
            </div>
          ))}
          {(materials as Material[])?.length === 0 && <p className="col-span-full text-center py-8 text-zinc-400">Nenhuma matéria-prima cadastrada.</p>}
        </div>
      )}
    </div>
  );
}

// ─── UserManager ───────────────────────────────────────────────────────────────

function UserManager({ user }: { user: User }) {
  const { data: users, loading, error, reload } = useData(() => db.users.list());
  const emptyForm = { name: '', username: '', password: '', role: 'employee' as 'admin' | 'employee' };
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

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
        await db.users.update(editingId, {
          name: form.name.trim(),
          username: form.username.trim(),
          password: form.password.trim() || undefined,
          role: form.role,
        });
      } else {
        await db.users.add({
          name: form.name.trim(),
          username: form.username.trim(),
          password: form.password.trim(),
          role: form.role,
        });
      }
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
    if (!confirm('Excluir este funcionário? Ele não conseguirá mais fazer login.')) return;
    // Cancela edição se for o mesmo usuário sendo deletado
    if (editingId === u.id) reset();
    try {
      await db.users.remove(u.id);
      reload();
    } catch (err: any) {
      alert('Erro ao excluir: ' + (err?.message ?? 'tente novamente.'));
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
              placeholder="Ex: João Silva"
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
              placeholder="Ex: joao"
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
              placeholder={isEditing ? 'Deixe em branco para manter' : '••••••••'}
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
              style={{ background: isEditing ? 'linear-gradient(135deg, #1F3164, #2a4080)' : 'linear-gradient(135deg, #C41E3C, #A01830)' }}
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
    </div>
  );
}

// ─── RecipeForm ────────────────────────────────────────────────────────────────

function RecipeForm({ user, template, formula, confirmed = false, readOnly = false, onComplete }: { user: User; template?: Formula | null; formula?: Formula | null; confirmed?: boolean; readOnly?: boolean; onComplete: (dest: 'pending' | 'confirmed') => void }) {
  const { data: customers, reload: reloadCustomers } = useData(() => db.customers.list());
  const { data: materials, reload: reloadMaterials } = useData(() => db.materials.list());
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | ''>('');
  const [items, setItems] = useState<FormulaItem[]>([]);
  const [customerQuery, setCustomerQuery] = useState('');
  const [showAddCustomer, setShowAddCustomer] = useState(false);
  const [showTemplateBanner, setShowTemplateBanner] = useState(false);
  const [materialQuery, setMaterialQuery] = useState('');
  const [selectedMaterialId, setSelectedMaterialId] = useState<number | ''>('');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState('mg');
  const [showAddMaterial, setShowAddMaterial] = useState(false);
  const [itemError, setItemError] = useState('');
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
  const [locked, setLocked] = useState(Boolean(formula));
  const [deliveryStatus, setDeliveryStatus] = useState('');
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
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
      setLocked(true);
    }
  }, [formula]);

  useEffect(() => {
    if (template) {
      setSelectedCustomerId(template.customer_id);
      setItems(template.items.map(i => ({ ...i })));
      setBudgetNumber(template.budget_number ?? '');
      setBudgetItems((template.budget_items ?? []).map(bi => ({ ...bi })));
      const budgetItems = template.budget_items ?? [];
      const selIdx = budgetItems.findIndex(bi => bi.is_selected);
      setSelectedBudgetIndex(selIdx >= 0 ? selIdx : null);
      setAttendantName(template.attendant_name ?? '');
      setDeliveryDate(template.delivery_date ? formatDateToBR(template.delivery_date) : '');
      setPaymentStatus(template.payment_status ?? '');
      setPaymentMethod(template.payment_method ?? '');
      setShowTemplateBanner(true);
    }
  }, [template]);

  const clearForm = () => {
    setSelectedCustomerId('');
    setItems([]);
    setCustomerQuery('');
    setShowAddCustomer(false);
    setShowTemplateBanner(false);
    setMaterialQuery('');
    setSelectedMaterialId('');
    setQuantity('');
    setUnit('mg');
    setShowAddMaterial(false);
    setItemError('');
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

  const allMaterials = (materials as Material[]) ?? [];
  const selectedMaterial = allMaterials.find(m => m.id === selectedMaterialId) ?? null;
  const mq = stripDiacritics(materialQuery.trim().toLowerCase());
  const filteredMaterials = mq
    ? allMaterials
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
    if (!selectedMaterialId || !quantity) return;
    if (items.find(i => i.material_id === Number(selectedMaterialId))) {
      setItemError('Esta matéria-prima já foi adicionada à fórmula.');
      return;
    }
    setItems([...items, { material_id: Number(selectedMaterialId), material_name: selectedMaterial?.name ?? '', quantity: Number(quantity), unit }]);
    setSelectedMaterialId('');
    setMaterialQuery('');
    setQuantity('');
    setItemError('');
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
      items: items.map(i => ({ material_id: i.material_id, quantity: i.quantity, unit: i.unit ?? 'mg' })),
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
    } finally { setSaving(false); }
  };

  const handleConfirm = async () => {
    if (!canConfirm) return;
    setSaving(true);
    try {
      if (formula) await db.formulas.update(formula.id, buildPayload('confirmed', true));
      else await db.formulas.add(buildPayload('confirmed', true));
      onComplete('confirmed');
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
    <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="max-w-4xl mx-auto space-y-6">
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
              style={{ background: 'linear-gradient(135deg, #1F3164, #2a4080)' }}>
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
          style={{ background: '#f0f4ff', border: '1px solid #c7d7f0', color: '#1F3164' }}>
          <RefreshCw className="w-4 h-4 shrink-0" />
          Baseado na fórmula #{template.id} de <strong className="ml-1">{template.customer_name}</strong>.
          Verifique e ajuste antes de finalizar.
        </div>
      )}
      {formula && locked && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium"
          style={{ background: '#fff0f3', border: '1px solid #fecaca', color: '#C41E3C' }}>
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
              style={{ color: showAddCustomer ? '#C41E3C' : '#1F3164', background: showAddCustomer ? '#fff0f3' : '#f0f4ff' }}>
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
              onChange={e => setCustomerQuery(e.target.value)}
            />
            {customerQuery && (
              <button onClick={() => setCustomerQuery('')} title="Limpar busca"
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-zinc-400 hover:text-red-600 transition-colors">
                <X className="w-4 h-4" />
              </button>
            )}
            {filteredCustomers.length > 0 && (
              <div className="absolute left-0 right-0 mt-1 bg-white border border-zinc-200 rounded-xl shadow-lg overflow-hidden z-10 max-h-64 overflow-y-auto">
                {filteredCustomers.map(c => (
                  <button key={c.id} type="button" onClick={() => { setSelectedCustomerId(c.id); setCustomerQuery(''); }}
                    className="w-full text-left px-3 py-2 hover:bg-red-50 transition-colors flex items-center gap-2">
                    <Users className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                    <span className="text-sm text-zinc-800 truncate flex-1">{c.name}</span>
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
      {/* Linha 2 — Matéria-Prima */}
      <div className="bg-white p-5 rounded-2xl border border-zinc-200 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-zinc-900 text-sm">2. Matéria-Prima</h3>
          {!locked && (
            <button type="button" onClick={() => setShowAddMaterial(!showAddMaterial)}
              className="text-xs flex items-center gap-1 px-2 py-1 rounded-lg transition-colors font-medium"
              style={{ color: showAddMaterial ? '#C41E3C' : '#1F3164', background: showAddMaterial ? '#fff0f3' : '#f0f4ff' }}>
              <PlusCircle className="w-3 h-3" />{showAddMaterial ? 'Fechar' : '+ Nova matéria-prima'}
            </button>
          )}
        </div>

        {showAddMaterial && (
          <div className="border border-dashed border-zinc-200 rounded-xl overflow-hidden mb-4">
            <MaterialManager compact onCreated={(m: Material) => { reloadMaterials(); setSelectedMaterialId(m.id); setShowAddMaterial(false); setMaterialQuery(''); }} />
          </div>
        )}

        {selectedMaterial ? (
          <div className="flex items-center justify-between p-3 rounded-xl border border-zinc-200 bg-zinc-50 mb-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
                <ClipboardList className="w-4 h-4 text-red-700" />
              </div>
              <p className="font-semibold text-zinc-900 text-sm truncate">{selectedMaterial.name}</p>
            </div>
            {!locked && (
              <button type="button" onClick={() => { setSelectedMaterialId(''); setMaterialQuery(''); }}
                className="p-2 text-zinc-300 hover:text-red-500 transition-colors ml-3" title="Trocar matéria-prima">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        ) : (
          <div className="relative mb-4">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-zinc-400" />
            <input
              className="w-full pl-9 pr-9 py-2 rounded-lg border border-zinc-300 focus:ring-2 focus:ring-red-500 outline-none text-sm disabled:opacity-60 disabled:cursor-not-allowed"
              placeholder="Buscar matéria-prima por nome..."
              value={materialQuery}
              disabled={locked}
              onChange={e => setMaterialQuery(e.target.value)}
            />
            {materialQuery && (
              <button onClick={() => setMaterialQuery('')} title="Limpar busca"
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-zinc-400 hover:text-red-600 transition-colors">
                <X className="w-4 h-4" />
              </button>
            )}
            {filteredMaterials.length > 0 && (
              <div className="absolute left-0 right-0 mt-1 bg-white border border-zinc-200 rounded-xl shadow-lg overflow-hidden z-10 max-h-64 overflow-y-auto">
                {filteredMaterials.map(m => (
                  <button key={m.id} type="button" onClick={() => { setSelectedMaterialId(m.id); setMaterialQuery(''); }}
                    className="w-full text-left px-3 py-2 hover:bg-red-50 transition-colors flex items-center gap-2">
                    <ClipboardList className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                    <span className="text-sm text-zinc-800 truncate flex-1">{m.name}</span>
                  </button>
                ))}
              </div>
            )}
            {mq && filteredMaterials.length === 0 && (
              <p className="text-xs text-zinc-400 mt-1 px-1">Nenhuma matéria-prima encontrada.</p>
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
              placeholder="0–9999"
              value={quantity}
              disabled={locked}
              onChange={e => setQuantity(e.target.value.replace(/\D/g, '').slice(0, 4))}
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
              <button type="button" disabled={!selectedMaterialId || !quantity} onClick={addIngredient}
                className="w-full text-white py-2 rounded-lg font-medium text-sm hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ background: 'linear-gradient(135deg, #1F3164, #2a4080)' }}>
                + Adicionar à fórmula
              </button>
            )}
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-zinc-100">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">Matérias-primas adicionadas</h4>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: '#fff0f3', color: '#C41E3C' }}>
              {items.length} {items.length === 1 ? 'matéria-prima' : 'matérias-primas'}
            </span>
          </div>

          {items.length === 0 ? (
            <p className="text-sm text-zinc-400">Nenhuma matéria-prima adicionada ainda.</p>
          ) : (
            <div className="space-y-2">
              {items.map((item, idx) => (
                <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} key={item.material_id}
                  className="flex items-center justify-between p-3 rounded-xl border border-zinc-100"
                  style={{ background: idx % 2 === 0 ? '#f8faff' : '#fff' }}>
                  <div className="min-w-0">
                    <p className="font-semibold text-zinc-900 text-sm truncate">{item.material_name}</p>
                    <p className="text-xs text-zinc-400">{item.quantity}{item.unit ?? 'mg'}</p>
                  </div>
                  {!locked && (
                    <button type="button" onClick={() => { setItems(items.filter((_, i) => i !== idx)); setItemError(''); }}
                      className="text-zinc-300 hover:text-red-500 transition-colors ml-4 p-1" title="Remover matéria-prima">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </motion.div>
              ))}
            </div>
          )}
        </div>
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
                  placeholder="0–999"
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
                  placeholder="0,00"
                  value={bValue}
                  disabled={locked}
                  onChange={e => { setBudgetError(''); setBValue(formatCurrency(e.target.value)); }}
                />
              </div>
              <div className="space-y-1">
                {!locked && (
                  <button type="button" disabled={!bQty || !bValue} onClick={addBudgetItem}
                    className="w-full sm:w-auto text-white px-4 py-2 rounded-lg font-medium text-sm hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                    style={{ background: 'linear-gradient(135deg, #1F3164, #2a4080)' }}>
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
                      className={`flex items-center gap-3 p-3 rounded-xl border ${!locked ? 'cursor-pointer' : ''} ${isSelected ? 'border-red-300' : 'border-zinc-100'}`}
                      style={{ background: isSelected ? '#fff0f3' : (idx % 2 === 0 ? '#f8faff' : '#fff') }}
                      onClick={() => { if (!locked) setSelectedBudgetIndex(idx); }}>
                      <input type="radio" name="budgetSelection" className="w-4 h-4 accent-[#C41E3C] shrink-0"
                        checked={isSelected}
                        disabled={locked}
                        onChange={() => { if (!locked) setSelectedBudgetIndex(idx); }}
                        onClick={e => e.stopPropagation()} />
                      <p className="text-sm text-zinc-700 flex-1 min-w-0">
                        <strong>{bi.quantity}</strong> {bi.unit} · <span className="font-semibold text-zinc-900">R$ {bi.value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
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
              style={{ background: 'linear-gradient(135deg, #1F3164, #2a4080)' }}>
              {saving ? 'Salvando...' : '💾 Salvar'}
            </button>
            <p className="text-center text-xs text-zinc-400 mt-2">
              {canSave ? 'Pronto para salvar' : 'Preencha os blocos 1 a 4 (cliente, matérias-primas, orçamento e informações)'}
            </p>
          </div>
          <div>
            <button type="button" disabled={!canConfirm || saving} onClick={handleConfirm}
              className="w-full disabled:opacity-50 disabled:cursor-not-allowed text-white py-3.5 rounded-xl font-bold text-base hover:opacity-90 transition-all shadow-lg"
              style={{ background: 'linear-gradient(135deg, #C41E3C, #A01830)' }}>
              {saving ? 'Salvando...' : '✓ Confirmar'}
            </button>
            <p className="text-center text-xs text-zinc-400 mt-2">
              {canConfirm
                ? 'Pronto para confirmar'
                : budgetItems.length > 0 && selectedBudgetIndex === null
                  ? 'Selecione um orçamento (marcador ao lado) e preencha os demais blocos'
                  : 'Preencha cliente, matérias-primas, orçamento, informações e o pagamento (blocos 1 a 5)'}
            </p>
          </div>
        </div>
      )}

      {formula && confirmed && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="md:col-span-2">
            <button type="button" disabled={saving} onClick={handleSaveConfirmed}
              className="w-full text-white py-3.5 rounded-xl font-bold text-base hover:opacity-90 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: 'linear-gradient(135deg, #1F3164, #2a4080)' }}>
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
                style={{ background: 'linear-gradient(135deg, #C41E3C, #A01830)' }}>
                {saving ? 'Cancelando...' : 'Confirmar cancelamento'}
              </button>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}

// ─── FormulaList ─────────────────────────────────────────────────────────────────

// Verifica quais requisitos faltam para a fórmula poder ser confirmada
function getMissingReasons(f: Formula): string[] {
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

function FormulaList({ title, subtitle, statuses, variant = 'pending', statusFilterOptions, showAndamento = true, onSelect, onConfirm }: { title: string; subtitle: string; statuses: string[]; variant?: 'pending' | 'confirmed'; statusFilterOptions?: { value: string; label: string }[]; showAndamento?: boolean; onSelect?: (f: Formula) => void; onConfirm?: (f: Formula, missing: string[]) => void }) {
  const { data: formulas, loading, error, reload } = useData(() => db.formulas.list());
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [confirmingId, setConfirmingId] = useState<number | null>(null);
  const [updatingStatusId, setUpdatingStatusId] = useState<number | null>(null);

  const handleConfirm = async (f: Formula) => {
    const reasons = getMissingReasons(f);
    if (reasons.length === 0) {
      setConfirmingId(f.id);
      try {
        await db.formulas.updateStatus(f.id, 'confirmed');
        reload();
      } finally {
        setConfirmingId(null);
      }
    }
    onConfirm?.(f, reasons);
  };

  const handleDeliveryStatusChange = async (f: Formula, deliveryStatus: string) => {
    setUpdatingStatusId(f.id);
    try {
      await db.formulas.updateDeliveryStatus(f.id, deliveryStatus);
      reload();
    } finally {
      setUpdatingStatusId(null);
    }
  };

  const all = (formulas as Formula[]) ?? [];
  const filtered = all
    .filter(f => statuses.includes(f.status))
    .filter(f => !statusFilter || f.status === statusFilter)
    .filter(f =>
      f.customer_name.toLowerCase().includes(search.toLowerCase()) ||
      (f.pharmacist_name || '').toLowerCase().includes(search.toLowerCase()) ||
      String(f.id).includes(search)
    );

  const paymentTint: Record<string, string> = {
    pago: 'bg-emerald-50 border-emerald-200',
    parcial: 'bg-amber-50 border-amber-200',
    nao_pago: 'bg-red-50 border-red-200',
    pagar_na_retirada: 'bg-cyan-50 border-cyan-200',
  };
  const gridCols = showAndamento
    ? 'md:grid-cols-[2fr_1fr_1fr_1.2fr_1fr_1fr_1.2fr_1.2fr_0.6fr]'
    : 'md:grid-cols-[2fr_1fr_1fr_1.2fr_1fr_1fr_1.2fr_0.6fr]';

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
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
              placeholder="Buscar cliente, farmacêutico ou ID..." value={search} onChange={e => setSearch(e.target.value)} />
            {search && (
              <button onClick={() => setSearch('')} title="Limpar busca"
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-zinc-400 hover:text-red-600 transition-colors">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {loading && <LoadingState />}
      {error && <ErrorState message={error} onRetry={reload} />}
      {!loading && !error && (
        <div className="space-y-3">
          {filtered.length > 0 && variant === 'confirmed' && (
            <div className={`hidden md:grid ${gridCols} gap-2 px-4 text-[11px] font-semibold uppercase tracking-wide text-zinc-400`}>
              <span>Cliente</span><span>Quantidade</span><span>Valor</span><span>Atendente PM</span>
              <span>Data criação</span><span>Data entrega</span><span>Telefone</span>{showAndamento && <span>Andamento</span>}<span />
            </div>
          )}
          {filtered.map(f => {
            const tint = paymentTint[f.payment_status ?? ''] ?? 'bg-white border-zinc-200';
            return variant === 'confirmed' ? (
              <button key={f.id} type="button" onClick={() => onSelect?.(f)}
                className={`w-full text-left rounded-2xl border shadow-sm px-4 py-3 hover:shadow-md transition-all group ${tint}`}>
                <div className={`grid grid-cols-1 ${gridCols} gap-2 items-center text-sm`}>
                  <p className="font-bold text-zinc-900">{f.customer_name}</p>
                  <div className="text-zinc-700 space-y-0.5 font-medium">
                    {(f.budget_items ?? []).map((bi, idx) => <p key={idx} className="whitespace-nowrap">{bi.quantity} {bi.unit}</p>)}
                    {(f.budget_items ?? []).length === 0 && <p className="text-zinc-400">—</p>}
                  </div>
                  <div className="text-zinc-700 space-y-0.5 tabular-nums">
                    {(f.budget_items ?? []).map((bi, idx) => <p key={idx}>R$ {bi.value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>)}
                    {(f.budget_items ?? []).length === 0 && <p className="text-zinc-400">—</p>}
                  </div>
                  <p className="text-zinc-700 truncate">{f.attendant_name || '—'}</p>
                  <p className="text-zinc-500">{new Date(f.created_at).toLocaleDateString('pt-BR')}</p>
                  <p className="text-zinc-500 whitespace-nowrap">{f.delivery_date ? formatDateToBR(f.delivery_date) : '—'}</p>
                  <p className="text-zinc-700 whitespace-nowrap">{f.customer_phone || '—'}</p>
                  {showAndamento && (
                    <div className="flex justify-end">
                      <select
                        value={f.delivery_status ?? ''}
                        disabled={!f.payment_status || updatingStatusId === f.id}
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
                        onChange={(e) => handleDeliveryStatusChange(f, e.target.value)}
                        className="w-full max-w-[170px] px-2 py-1.5 rounded-lg border border-zinc-300 focus:ring-2 focus:ring-red-500 outline-none bg-white text-sm text-zinc-700 disabled:opacity-60 disabled:cursor-not-allowed whitespace-nowrap">
                        <option value="">Selecione...</option>
                        <option value="em_producao">Em produção</option>
                        <option value="aguardando_retirada">Aguardando retirada</option>
                        <option value="aguardando_envio">Aguardando envio</option>
                        <option value="entregue">Entregue</option>
                      </select>
                    </div>
                  )}
                  <div className="flex justify-end">
                    <div className="w-8 h-8 rounded-lg border border-zinc-200 bg-white/70 flex items-center justify-center text-zinc-400 group-hover:border-red-300 group-hover:text-red-600 transition-colors">
                      <ChevronRight className="w-4 h-4" />
                    </div>
                  </div>
                </div>
              </button>
            ) : (
              <div key={f.id} onClick={() => onSelect?.(f)}
                className="w-full text-left bg-white rounded-2xl border border-zinc-200 shadow-sm px-4 py-3 hover:border-red-300 hover:shadow-md transition-all group cursor-pointer">
                <div className="grid grid-cols-1 md:grid-cols-[1.5fr_1.2fr_1fr_2fr_1.1fr] gap-2 items-center text-sm">
                  <div className="min-w-0">
                    <p className="font-bold text-zinc-900 truncate">{f.customer_name}</p>
                    {f.customer_phone && <p className="text-xs text-zinc-400 truncate">{f.customer_phone}</p>}
                  </div>
                  <p className="text-zinc-700 truncate">{f.pharmacist_name || '—'}</p>
                  <p className="text-zinc-500 whitespace-nowrap">{new Date(f.created_at).toLocaleDateString('pt-BR')}</p>
                  <div className="min-w-0">
                    <p className="text-zinc-600 truncate">
                      {f.items.slice(0, 3).map((item, idx) => (
                        <span key={idx}>{idx > 0 && <span className="text-zinc-300">, </span>}{item.material_name}</span>
                      ))}
                    </p>
                    {f.items.length > 3 && (
                      <p className="text-xs text-zinc-400 font-medium pt-0.5">
                        Mais {f.items.length - 3} matéria-prima{f.items.length - 3 === 1 ? '' : 's'}
                      </p>
                    )}
                  </div>
                  <div className="flex justify-end items-center gap-2">
                    <button type="button" disabled={confirmingId === f.id}
                      onClick={(e) => { e.stopPropagation(); handleConfirm(f); }}
                      className="px-3 py-1.5 rounded-lg text-white text-xs font-bold hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                      style={{ background: 'linear-gradient(135deg, #C41E3C, #A01830)' }}>
                      {confirmingId === f.id ? 'Confirmando...' : 'Confirmar'}
                    </button>
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
  );
}

// ─── SettingsManager ───────────────────────────────────────────────────────────

function SettingsManager() {
  const [config, setConfig] = useState({ host: '', port: 3306, user: '', password: '', database: 'pharmaflow' });
  const [status, setStatus] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [tab, setTab] = useState<'db' | 'admin'>('db');

  useEffect(() => {
    if (window.electronAPI) {
      window.electronAPI.getConfig().then((cfg: any) => setConfig(c => ({ ...c, ...cfg })));
    }
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true);
    await window.electronAPI.saveConfig(config);
    setStatus({ type: 'success', msg: 'Configurações salvas! Reconectando ao banco...' });
    setTimeout(() => setStatus(null), 4000); setSaving(false);
  };

  const handleTest = async () => {
    setTesting(true);
    await window.electronAPI.saveConfig(config);
    const result = await window.electronAPI.testConnection();
    setStatus(result.success
      ? { type: 'success', msg: '✅ Conexão bem-sucedida! Banco de dados acessível.' }
      : { type: 'error', msg: '❌ Falha: ' + result.error }
    );
    setTesting(false);
  };

  const handleSyncNow = async () => {
    setSyncing(true);
    await db.sync.now();
    setStatus({ type: 'success', msg: '✅ Sincronização concluída!' });
    setTimeout(() => setStatus(null), 3000);
    setSyncing(false);
  };

  if (!window.electronAPI) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center">
        <Settings className="w-8 h-8 text-zinc-400 mb-4" />
        <h3 className="text-lg font-semibold text-zinc-900">Versão Web</h3>
        <p className="text-zinc-500 max-w-xs">Configurações disponíveis apenas na versão Desktop.</p>
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-2xl mx-auto space-y-6">
      {/* Abas */}
      <div className="flex items-center gap-4 border-b border-zinc-200">
        <button onClick={() => setTab('db')} className={`pb-4 px-2 text-sm font-medium transition-colors relative ${tab === 'db' ? 'text-red-700' : 'text-zinc-500 hover:text-zinc-900'}`}>
          Banco de Dados
          {tab === 'db' && <motion.div layoutId="activeSetup" className="absolute bottom-0 left-0 right-0 h-0.5 bg-red-700" />}
        </button>
        <button onClick={() => setTab('admin')} className={`pb-4 px-2 text-sm font-medium transition-colors relative ${tab === 'admin' ? 'text-red-700' : 'text-zinc-500 hover:text-zinc-900'}`}>
          Administrador
          {tab === 'admin' && <motion.div layoutId="activeSetup" className="absolute bottom-0 left-0 right-0 h-0.5 bg-red-700" />}
        </button>
      </div>

      {tab === 'admin' && <AdminUserManager />}

      {tab === 'db' && (
        <>
      {/* Configuração do banco */}
      <div className="bg-white rounded-2xl shadow-sm border border-zinc-200 overflow-hidden">
        <div className="p-8 border-b border-zinc-100">
          <h2 className="text-2xl font-bold text-zinc-900">Banco de Dados</h2>
          <p className="text-zinc-500">Configure a conexão com o MariaDB da rede local.</p>
        </div>
        <form onSubmit={handleSave} className="p-8 space-y-5">
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-zinc-700 mb-1">IP do Servidor</label>
              <input type="text" className="w-full px-4 py-2 rounded-lg border border-zinc-300 focus:ring-2 focus:ring-red-500 outline-none" value={config.host} onChange={e => setConfig({ ...config, host: e.target.value })} placeholder="192.168.1.50" />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">Porta</label>
              <input type="number" className="w-full px-4 py-2 rounded-lg border border-zinc-300 focus:ring-2 focus:ring-red-500 outline-none" value={config.port} onChange={e => setConfig({ ...config, port: Number(e.target.value) })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">Usuário</label>
              <input type="text" className="w-full px-4 py-2 rounded-lg border border-zinc-300 focus:ring-2 focus:ring-red-500 outline-none" value={config.user} onChange={e => setConfig({ ...config, user: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">Senha</label>
              <input type="password" className="w-full px-4 py-2 rounded-lg border border-zinc-300 focus:ring-2 focus:ring-red-500 outline-none" value={config.password} onChange={e => setConfig({ ...config, password: e.target.value })} placeholder="Digite para alterar" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">Nome do Banco</label>
            <input type="text" className="w-full px-4 py-2 rounded-lg border border-zinc-300 focus:ring-2 focus:ring-red-500 outline-none" value={config.database} onChange={e => setConfig({ ...config, database: e.target.value })} />
          </div>
          {status && (
            <div className={`flex items-center gap-2 px-4 py-3 rounded-lg text-sm font-medium ${status.type === 'success' ? 'bg-red-50 text-red-700' : 'bg-red-50 text-red-700'}`}>
              {status.type === 'success' ? <Wifi className="w-4 h-4 shrink-0" /> : <WifiOff className="w-4 h-4 shrink-0" />}
              {status.msg}
            </div>
          )}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={handleTest} disabled={testing} className="flex-1 border border-zinc-300 text-zinc-700 font-semibold py-2 rounded-lg hover:bg-zinc-50 disabled:opacity-60 transition-colors flex items-center justify-center gap-2">
              <Wifi className="w-4 h-4" /> {testing ? 'Testando...' : 'Testar Conexão'}
            </button>
            <button type="submit" disabled={saving} style={{ background: "linear-gradient(135deg, #C41E3C, #A01830)" }} className="flex-1 text-white hover:opacity-90 font-semibold py-2 rounded-lg disabled:opacity-60 transition-colors">
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </form>
        <div className="p-5 bg-red-50 border-t border-red-100">
          <p className="text-sm text-red-800"><strong>Atenção:</strong> o servidor MariaDB deve aceitar conexões remotas e o firewall deve liberar a porta 3306.</p>
          <p className="text-sm text-red-800 mt-2"><strong>Importante:</strong> usuarios configurados com autenticacao Windows/GSSAPI (`auth_gssapi_client`) nao sao suportados por esta versao do app. Use um usuario MariaDB com senha normal, como `mysql_native_password`.</p>
        </div>
      </div>

      {/* Sincronização manual */}
      <div className="bg-white rounded-2xl shadow-sm border border-zinc-200 p-6">
        <h3 className="text-lg font-bold text-zinc-900 mb-1">Sincronização</h3>
        <p className="text-zinc-500 text-sm mb-4">O app sincroniza automaticamente a cada 10 minutos. Você também pode forçar uma sincronização manual.</p>
        <button onClick={handleSyncNow} disabled={syncing} className="flex items-center gap-2 bg-zinc-800 hover:bg-zinc-900 text-white font-semibold px-5 py-2 rounded-lg disabled:opacity-60 transition-colors">
          {syncing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CloudUpload className="w-4 h-4" />}
          {syncing ? 'Sincronizando...' : 'Sincronizar Agora'}
        </button>
      </div>
        </>
      )}
    </motion.div>
  );
}

// ─── AdminUserManager ───────────────────────────────────────────────────────────

function AdminUserManager() {
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
