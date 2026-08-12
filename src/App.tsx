import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Users, Cross, ClipboardList, UserPlus, PlusCircle, LogOut,
  Trash2, CheckCircle2, Clock, FileText, ChevronRight, Search,
  Menu, Settings, RefreshCw, Wifi, WifiOff, AlertCircle, CloudOff,
  CloudUpload, CheckCircle,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db } from './services/lanDatabase';

// ─── Types ─────────────────────────────────────────────────────────────────────

interface User { id: number; name: string; username: string; role: 'admin' | 'employee' }
interface Customer { id: number; name: string; cpf: string; phone: string }
interface Material { id: number; name: string }
interface FormulaItem { material_id: number; material_name: string; quantity: number }
interface Formula {
  id: number; customer_id: number; customer_name: string; customer_phone: string;
  pharmacist_name: string; status: 'pending' | 'completed'; sync_status: string;
  created_at: string; items: FormulaItem[];
}
interface SyncStatus {
  state: 'idle' | 'syncing' | 'offline' | 'error' | 'connecting';
  lastSync: string | null;
  pending: number;
  error?: string;
}

// ─── CPF Utilities ────────────────────────────────────────────────────────────

function formatCPF(value: string): string {
  return value.replace(/\D/g, '')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2')
    .slice(0, 14);
}

function validateCPF(cpf: string): boolean {
  const nums = cpf.replace(/\D/g, '');
  if (nums.length !== 11 || /^(\d)\1+$/.test(nums)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(nums[i]) * (10 - i);
  let rest = (sum * 10) % 11;
  if (rest === 10 || rest === 11) rest = 0;
  if (rest !== parseInt(nums[9])) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(nums[i]) * (11 - i);
  rest = (sum * 10) % 11;
  if (rest === 10 || rest === 11) rest = 0;
  return rest === parseInt(nums[10]);
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
  const [activeTab, setActiveTab] = useState<'dashboard' | 'admin' | 'recipe' | 'queue' | 'settings'>('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'info' } | null>(null);
  const [templateFormula, setTemplateFormula] = useState<Formula | null>(null);
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
        setActiveTab(res.setupMode ? 'settings' : 'dashboard');
      } else {
        setLoginError(res.error ?? 'Erro ao fazer login.');
      }
    } catch {
      setLoginError('Erro ao conectar ao servidor.');
    } finally {
      setLoginLoading(false);
    }
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
        <aside className={`border-r border-zinc-200 transition-all duration-300 ${isSidebarOpen ? 'w-64' : 'w-20'} flex flex-col shrink-0`}
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
                <NavItem icon={<PlusCircle />} label="Nova Receita" active={activeTab === 'recipe'} onClick={() => setActiveTab('recipe')} collapsed={!isSidebarOpen} />
                <NavItem icon={<Clock />} label="Fila de Fórmulas" active={activeTab === 'queue'} onClick={() => setActiveTab('queue')} collapsed={!isSidebarOpen} />
                <NavItem icon={<Users />} label="Administração" active={activeTab === 'admin'} onClick={() => setActiveTab('admin')} collapsed={!isSidebarOpen} />
              </>
            )}
            {(setupMode || user.role === 'admin') && (
              <NavItem icon={<Settings />} label="Configuração" active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} collapsed={!isSidebarOpen} />
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
              <button onClick={() => { setUser(null); setSetupMode(false); setActiveTab('dashboard'); }}
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
              {activeTab === 'recipe' && <RecipeForm user={user} template={templateFormula} onComplete={() => { setTemplateFormula(null); setActiveTab('queue'); }} />}
              {activeTab === 'queue' && <FormulaQueue user={user} onRepeat={f => { setTemplateFormula(f); setActiveTab('recipe'); }} />}
              {activeTab === 'settings' && <SettingsManager />}
            </AnimatePresence>
          </div>
        </main>
      </div>
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

// Coloque sua logo em public/logo.png — se não existir usa o ícone padrão
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

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold text-zinc-900">Bem-vindo, {user.name}</h2>
        <p className="text-zinc-500">Aqui está o que está acontecendo na farmácia hoje.</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <StatCard icon={<ClipboardList className="text-blue-600" />} label="Fórmulas Totais" value={formulas?.length ?? 0} color="bg-blue-50" />
        <StatCard icon={<Clock className="text-red-600" />} label="Pendentes" value={pendingFormulas} color="bg-red-50" />
        <StatCard icon={<Users className="text-purple-600" />} label="Clientes" value={customers?.length ?? 0} color="bg-purple-50" />
        <StatCard icon={<Cross className="text-red-700" />} label="Matérias-Primas" value={materials?.length ?? 0} color="bg-red-50" />
      </div>
      <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm max-w-sm">
        <h3 className="text-lg font-semibold mb-4">Ações Rápidas</h3>
        <div className="grid grid-cols-2 gap-4">
          <QuickActionButton icon={<PlusCircle />} label="Nova Receita" onClick={() => onNavigate('recipe')} color="pf-orange" />
          <QuickActionButton icon={<Clock />} label="Ver Fila" onClick={() => onNavigate('queue')} color="bg-zinc-800" />
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
  const [tab, setTab] = useState<'customers' | 'materials' | 'users'>('customers');
  const allTabs = [
    { key: 'customers' as const, label: 'Clientes' },
    { key: 'materials' as const, label: 'Matérias-Primas' },
    { key: 'users' as const, label: 'Funcionários', adminOnly: true },
  ];
  const tabs = allTabs.filter(t => !t.adminOnly || user.role === 'admin');

  // Se a aba ativa foi removida (employee tentando acessar users), volta para customers
  const activeTab = tabs.find(t => t.key === tab) ? tab : 'customers';

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
        {activeTab === 'customers' && <CustomerManager />}
        {activeTab === 'materials' && <MaterialManager />}
        {activeTab === 'users' && user.role === 'admin' && <UserManager />}
      </div>
    </motion.div>
  );
}

// ─── CustomerManager ───────────────────────────────────────────────────────────

function CustomerManager({ compact = false, onCreated }: { compact?: boolean; onCreated?: (c: Customer) => void } = {}) {
  const { data: customers, loading, error, reload } = useData(() => db.customers.list());
  const [form, setForm] = useState({ name: '', cpf: '', phone: '' });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const cpfValid = form.cpf.replace(/\D/g,'').length === 11 ? validateCPF(form.cpf) : null;

  const reset = () => { setForm({ name: '', cpf: '', phone: '' }); setEditingId(null); setFormError(''); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateCPF(form.cpf)) { setFormError('CPF inválido. Verifique os dígitos.'); return; }
    const rawCPF = form.cpf.replace(/\D/g,'');
    const formatted = formatCPF(rawCPF);
    // Verificação de duplicata local
    if (!editingId) {
      const dup = (customers as Customer[])?.find(c => c.cpf.replace(/\D/g,'') === rawCPF);
      if (dup) { setFormError(`CPF já cadastrado para: ${dup.name}`); return; }
    }
    setSaving(true); setFormError('');
    try {
      const payload = { ...form, cpf: formatted };
      if (editingId) {
        await db.customers.update(editingId, payload);
        reset(); reload();
      } else {
        const res: any = await db.customers.add(payload);
        if (res?.error?.includes('UNIQUE') || res?.error?.includes('unique')) {
          setFormError('CPF já cadastrado no servidor.');
        } else {
          if (onCreated) onCreated({ id: res.id, ...payload });
          reset(); reload();
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

  const formBlock = (
    <form onSubmit={handleSubmit} className={`grid gap-3 items-end bg-zinc-50 p-4 rounded-xl border border-zinc-100 ${compact ? '' : 'grid-cols-1 md:grid-cols-4'}`}>
      <div className={compact ? '' : 'md:col-span-1'}>
        <label className="block text-xs font-semibold text-zinc-500 uppercase mb-1">Nome</label>
        <input required className="w-full px-3 py-2 rounded-lg border border-zinc-300 focus:ring-2 focus:ring-red-500 outline-none" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
      </div>
      <div>
        <label className="block text-xs font-semibold text-zinc-500 uppercase mb-1">CPF</label>
        <div className="relative">
          <input required className={`w-full px-3 py-2 rounded-lg border outline-none focus:ring-2 focus:ring-red-500 pr-8 ${cpfValid === false ? 'border-red-400 bg-red-50' : cpfValid === true ? 'border-emerald-400' : 'border-zinc-300'}`}
            value={form.cpf}
            onChange={e => { setFormError(''); setForm({ ...form, cpf: formatCPF(e.target.value) }); }}
            placeholder="000.000.000-00" maxLength={14} />
          {cpfValid === true && <span className="absolute right-2 top-2.5 text-emerald-500 text-xs">✓</span>}
          {cpfValid === false && <span className="absolute right-2 top-2.5 text-red-500 text-xs">✗</span>}
        </div>
      </div>
      <div>
        <label className="block text-xs font-semibold text-zinc-500 uppercase mb-1">Celular</label>
        <input required className="w-full px-3 py-2 rounded-lg border border-zinc-300 focus:ring-2 focus:ring-red-500 outline-none" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="(00) 00000-0000" />
      </div>
      <div className="space-y-1">
        {formError && <p className="text-xs text-red-600 font-medium">{formError}</p>}
        <div className="flex gap-2">
          <button type="submit" disabled={saving || cpfValid === false} style={{ background: 'linear-gradient(135deg, #C41E3C, #A01830)' }} className="flex-1 text-white py-2 px-3 rounded-lg font-medium hover:opacity-90 disabled:opacity-50 transition-all text-sm">
            {saving ? '...' : editingId ? 'Atualizar' : 'Adicionar'}
          </button>
          {editingId && <button type="button" onClick={reset} className="px-3 py-2 rounded-lg border border-zinc-300 text-zinc-600 hover:bg-zinc-100 text-sm">✕</button>}
        </div>
      </div>
    </form>
  );

  if (compact) return formBlock;

  return (
    <div className="p-6 space-y-6">
      {formBlock}
      {loading && <LoadingState />}
      {error && <ErrorState message={error} onRetry={reload} />}
      {!loading && !error && (
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead><tr className="border-b border-zinc-100 text-zinc-400 text-xs uppercase font-semibold">
              <th className="px-4 py-3">Nome</th><th className="px-4 py-3">CPF</th><th className="px-4 py-3">Celular</th><th className="px-4 py-3 text-right">Ações</th>
            </tr></thead>
            <tbody className="divide-y divide-zinc-50">
              {(customers as Customer[])?.map(c => (
                <tr key={c.id} className="hover:bg-zinc-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-zinc-900">{c.name}</td>
                  <td className="px-4 py-3 text-zinc-600 font-mono text-sm">{c.cpf}</td>
                  <td className="px-4 py-3 text-zinc-600">{c.phone}</td>
                  <td className="px-4 py-3 text-right space-x-3">
                    <button onClick={() => { setForm({ name: c.name, cpf: c.cpf, phone: c.phone }); setEditingId(c.id); setFormError(''); }} className="text-zinc-400 hover:text-blue-700 text-sm transition-colors">Editar</button>
                    <button onClick={() => handleDelete(c.id)} className="text-zinc-400 hover:text-red-600 transition-colors"><Trash2 className="w-4 h-4" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {(customers as Customer[])?.length === 0 && <p className="text-center py-8 text-zinc-400">Nenhum cliente cadastrado.</p>}
        </div>
      )}
    </div>
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

function UserManager() {
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

  const handleDelete = async (id: number) => {
    if (!confirm('Excluir este funcionário? Ele não conseguirá mais fazer login.')) return;
    // Cancela edição se for o mesmo usuário sendo deletado
    if (editingId === id) reset();
    try {
      await db.users.remove(id);
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
                    <button
                      onClick={() => handleDelete(u.id)}
                      className="text-zinc-300 hover:text-red-600 transition-colors p-1 rounded">
                      <Trash2 className="w-4 h-4" />
                    </button>
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

function RecipeForm({ user, template, onComplete }: { user: User; template?: Formula | null; onComplete: () => void }) {
  const { data: customers, reload: reloadCustomers } = useData(() => db.customers.list());
  const { data: materials, reload: reloadMaterials } = useData(() => db.materials.list());
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | ''>('');
  const [items, setItems] = useState<FormulaItem[]>([]);
  const [current, setCurrent] = useState<{ material_id: number | ''; quantity: number | '' }>({ material_id: '', quantity: '' });
  const [saving, setSaving] = useState(false);
  const [itemError, setItemError] = useState('');
  const [showAddCustomer, setShowAddCustomer] = useState(false);
  const [showAddMaterial, setShowAddMaterial] = useState(false);
  const [showTemplateBanner, setShowTemplateBanner] = useState(false);

  useEffect(() => {
    if (template) {
      setSelectedCustomerId(template.customer_id);
      setItems(template.items.map(i => ({ ...i })));
      setShowTemplateBanner(true);
    }
  }, [template]);

  const clearForm = () => {
    setSelectedCustomerId('');
    setItems([]);
    setCurrent({ material_id: '', quantity: '' });
    setItemError('');
    setShowAddCustomer(false);
    setShowAddMaterial(false);
    setShowTemplateBanner(false);
  };

  const addItem = () => {
    if (!current.material_id || !current.quantity) return;
    if (items.find(i => i.material_id === Number(current.material_id))) {
      setItemError('Esta matéria-prima já foi adicionada à fórmula.');
      return;
    }
    const mat = (materials as Material[])?.find(m => m.id === Number(current.material_id));
    setItems([...items, { material_id: Number(current.material_id), material_name: mat?.name ?? '', quantity: Number(current.quantity) }]);
    setCurrent({ material_id: '', quantity: '' });
    setItemError('');
  };

  const handleSubmit = async () => {
    if (!selectedCustomerId || items.length === 0) return;
    setSaving(true);
    try {
      await db.formulas.add({
        customer_id: selectedCustomerId as number,
        pharmacist_name: user.name,
        items: items.map(i => ({ material_id: i.material_id, quantity: i.quantity })),
      });
      onComplete();
    } finally { setSaving(false); }
  };

  return (
    <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-zinc-900">
            {template ? 'Repetir Receita' : 'Nova Receita'}
          </h2>
          <p className="text-zinc-500 text-sm">Farmacêutico: <strong>{user.name}</strong></p>
        </div>
        <div className="flex items-center gap-3">
          {(items.length > 0 || selectedCustomerId) && (
            <button type="button" onClick={clearForm}
              className="flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-xl border border-zinc-300 text-zinc-500 hover:border-red-300 hover:text-red-600 hover:bg-red-50 transition-all">
              <Trash2 className="w-3.5 h-3.5" /> Limpar
            </button>
          )}
          <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center"><PlusCircle className="w-6 h-6 text-red-700" /></div>
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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-1 space-y-4">
          {/* Cliente */}
          <div className="bg-white p-5 rounded-2xl border border-zinc-200 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-zinc-900 text-sm">1. Cliente</h3>
              <button type="button" onClick={() => setShowAddCustomer(!showAddCustomer)}
                className="text-xs flex items-center gap-1 px-2 py-1 rounded-lg transition-colors font-medium"
                style={{ color: showAddCustomer ? '#C41E3C' : '#1F3164', background: showAddCustomer ? '#fff0f3' : '#f0f4ff' }}>
                <PlusCircle className="w-3 h-3" />{showAddCustomer ? 'Fechar' : 'Novo cliente'}
              </button>
            </div>
            {showAddCustomer && (
              <div className="border border-dashed border-zinc-200 rounded-xl overflow-hidden">
                <CustomerManager compact onCreated={(c: Customer) => { reloadCustomers(); setSelectedCustomerId(c.id); setShowAddCustomer(false); }} />
              </div>
            )}
            <select className="w-full px-3 py-2 rounded-lg border border-zinc-300 focus:ring-2 focus:ring-red-500 outline-none bg-white text-sm"
              value={selectedCustomerId} onChange={e => setSelectedCustomerId(Number(e.target.value))}>
              <option value="">Selecione um cliente...</option>
              {(customers as Customer[])?.map(c => <option key={c.id} value={c.id}>{c.name} — {c.cpf}</option>)}
            </select>
          </div>

          {/* Matéria-prima */}
          <div className="bg-white p-5 rounded-2xl border border-zinc-200 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-zinc-900 text-sm">2. Ingrediente</h3>
              <button type="button" onClick={() => setShowAddMaterial(!showAddMaterial)}
                className="text-xs flex items-center gap-1 px-2 py-1 rounded-lg transition-colors font-medium"
                style={{ color: showAddMaterial ? '#C41E3C' : '#1F3164', background: showAddMaterial ? '#fff0f3' : '#f0f4ff' }}>
                <PlusCircle className="w-3 h-3" />{showAddMaterial ? 'Fechar' : 'Nova matéria-prima'}
              </button>
            </div>
            {showAddMaterial && (
              <div className="border border-dashed border-zinc-200 rounded-xl overflow-hidden">
                <MaterialManager compact onCreated={(m: Material) => { reloadMaterials(); setCurrent({ ...current, material_id: m.id }); setShowAddMaterial(false); }} />
              </div>
            )}
            <div className="space-y-2">
              <select className="w-full px-3 py-2 rounded-lg border border-zinc-300 focus:ring-2 focus:ring-red-500 outline-none bg-white text-sm"
                value={current.material_id}
                onChange={e => { setCurrent({ ...current, material_id: Number(e.target.value) }); setItemError(''); }}>
                <option value="">Selecione...</option>
                {(materials as Material[])?.map(m => (
                  <option key={m.id} value={m.id} disabled={!!items.find(i => i.material_id === m.id)}>
                    {m.name}{items.find(i => i.material_id === m.id) ? ' ✓ (já adicionado)' : ''}
                  </option>
                ))}
              </select>
              <input type="number" min="0.001" step="0.001" placeholder="Quantidade (mg)"
                className="w-full px-3 py-2 rounded-lg border border-zinc-300 focus:ring-2 focus:ring-red-500 outline-none text-sm"
                value={current.quantity}
                onChange={e => setCurrent({ ...current, quantity: Number(e.target.value) })}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addItem(); } }} />
              {itemError && <p className="text-xs text-red-600 font-medium bg-red-50 px-2 py-1 rounded">{itemError}</p>}
              <button type="button" onClick={addItem}
                className="w-full text-white py-2 rounded-lg font-medium text-sm hover:opacity-90 transition-all"
                style={{ background: 'linear-gradient(135deg, #1F3164, #2a4080)' }}>
                + Adicionar à fórmula
              </button>
            </div>
          </div>
        </div>

        {/* Composição */}
        <div className="md:col-span-2">
          <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm min-h-[420px] flex flex-col">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-semibold text-zinc-900">Composição da Fórmula</h3>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: '#f0f4ff', color: '#1F3164' }}>
                {items.length} {items.length === 1 ? 'ingrediente' : 'ingredientes'}
              </span>
            </div>
            <div className="flex-1 space-y-2 overflow-y-auto">
              {items.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-zinc-300 gap-2 py-12">
                  <FileText className="w-14 h-14 opacity-30" /><p className="text-sm">Nenhum ingrediente adicionado.</p>
                </div>
              ) : items.map((item, idx) => (
                <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} key={item.material_id}
                  className="flex items-center justify-between p-3 rounded-xl border border-zinc-100"
                  style={{ background: idx % 2 === 0 ? '#f8faff' : '#fff' }}>
                  <div>
                    <p className="font-semibold text-zinc-900 text-sm">{item.material_name}</p>
                    <p className="text-xs text-zinc-400">{item.quantity} mg</p>
                  </div>
                  <button type="button" onClick={() => { setItems(items.filter((_, i) => i !== idx)); setItemError(''); }}
                    className="text-zinc-300 hover:text-red-500 transition-colors ml-4 p-1">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </motion.div>
              ))}
            </div>
            <div className="mt-6 pt-5 border-t border-zinc-100 space-y-2">
              <button type="button" disabled={!selectedCustomerId || items.length === 0 || saving} onClick={handleSubmit}
                className="w-full disabled:opacity-50 disabled:cursor-not-allowed text-white py-3 rounded-xl font-bold text-base hover:opacity-90 transition-all shadow-lg"
                style={{ background: 'linear-gradient(135deg, #C41E3C, #1F3164)' }}>
                {saving ? 'Salvando...' : '✓ Finalizar e Enviar para Fila'}
              </button>
              {(!selectedCustomerId || items.length === 0) && (
                <p className="text-center text-xs text-zinc-400">
                  {!selectedCustomerId ? 'Selecione um cliente para continuar' : 'Adicione ao menos um ingrediente'}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ─── FormulaQueue ──────────────────────────────────────────────────────────────

function FormulaQueue({ user, onRepeat }: { user: User; onRepeat: (f: Formula) => void }) {
  const { data: formulas, loading, error, reload } = useData(() => db.formulas.list());
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'pending' | 'completed'>('pending');

  const updateStatus = async (id: number, status: 'pending' | 'completed') => {
    await db.formulas.updateStatus(id, status); reload();
  };

  const handleDelete = async (id: number) => {
    if (user.role !== 'admin') return;
    if (!confirm('Excluir esta fórmula? Esta ação não pode ser desfeita.')) return;
    await db.formulas.remove(id); reload();
  };

  const downloadReport = (f: Formula) => {
    const content = [
      `FÓRMULA #${f.id} — PIX FARMA`,
      `═══════════════════════════════`,
      `Cliente:     ${f.customer_name}`,
      `Celular:     ${f.customer_phone || '—'}`,
      `Farmacêutico: ${f.pharmacist_name || '—'}`,
      `Data:        ${new Date(f.created_at).toLocaleString('pt-BR')}`,
      `Status:      ${f.status === 'completed' ? 'Concluído' : 'Pendente'}`,
      ``,
      `INGREDIENTES`,
      `───────────────────────────────`,
      ...f.items.map(i => `  ${i.material_name.padEnd(25)} ${i.quantity} mg`),
    ].join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([content], { type: 'text/plain;charset=utf-8' }));
    a.download = `formula_${f.id}_${f.customer_name.replace(/\s+/g,'_')}.txt`;
    a.click();
  };

  const all = (formulas as Formula[]) ?? [];
  const filtered = all
    .filter(f => f.status === activeTab)
    .filter(f =>
      f.customer_name.toLowerCase().includes(search.toLowerCase()) ||
      (f.pharmacist_name || '').toLowerCase().includes(search.toLowerCase()) ||
      String(f.id).includes(search)
    );

  const pendingCount = all.filter(f => f.status === 'pending').length;
  const completedCount = all.filter(f => f.status === 'completed').length;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-zinc-900">Fila de Produção</h2>
          <p className="text-zinc-500 text-sm">Gerencie as fórmulas em manipulação</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={reload} className="p-2 text-zinc-400 hover:text-zinc-700 transition-colors" title="Atualizar"><RefreshCw className="w-5 h-5" /></button>
          <div className="relative">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-zinc-400" />
            <input className="pl-9 pr-4 py-2 bg-white border border-zinc-200 rounded-xl focus:ring-2 focus:ring-red-500 outline-none text-sm min-w-[260px]"
              placeholder="Buscar cliente, farmacêutico ou ID..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>
      </div>

      {/* Abas */}
      <div className="flex gap-3">
        <button onClick={() => setActiveTab('pending')}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all"
          style={activeTab === 'pending'
            ? { background: 'linear-gradient(135deg, #C41E3C, #A01830)', color: 'white', boxShadow: '0 4px 12px rgba(196,30,60,0.3)' }
            : { background: 'white', color: '#C41E3C', border: '2px solid #C41E3C' }}>
          <Clock className="w-4 h-4" /> Pendentes
          <span className="ml-1 text-xs font-black px-1.5 py-0.5 rounded-full"
            style={{ background: activeTab === 'pending' ? 'rgba(255,255,255,0.2)' : '#fff0f3' }}>
            {pendingCount}
          </span>
        </button>
        <button onClick={() => setActiveTab('completed')}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all"
          style={activeTab === 'completed'
            ? { background: 'linear-gradient(135deg, #16a34a, #15803d)', color: 'white', boxShadow: '0 4px 12px rgba(22,163,74,0.3)' }
            : { background: 'white', color: '#16a34a', border: '2px solid #16a34a' }}>
          <CheckCircle2 className="w-4 h-4" /> Concluídas
          <span className="ml-1 text-xs font-black px-1.5 py-0.5 rounded-full"
            style={{ background: activeTab === 'completed' ? 'rgba(255,255,255,0.2)' : '#f0fdf4' }}>
            {completedCount}
          </span>
        </button>
      </div>

      {loading && <LoadingState />}
      {error && <ErrorState message={error} onRetry={reload} />}
      {!loading && !error && (
        <div className="space-y-3">
          {filtered.map(f => (
            <motion.div layout key={f.id}
              className="bg-white rounded-2xl border shadow-sm overflow-hidden"
              style={{ borderColor: f.status === 'completed' ? '#bbf7d0' : '#fecaca' }}>
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5">
                {/* Info cliente */}
                <div className="flex items-start gap-4 min-w-0">
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 text-white text-xs font-black"
                    style={{ background: f.status === 'completed' ? 'linear-gradient(135deg,#16a34a,#15803d)' : 'linear-gradient(135deg,#C41E3C,#A01830)' }}>
                    #{f.id}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${f.status === 'completed' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                        {f.status === 'completed' ? '✓ Concluído' : '⏳ Pendente'}
                      </span>
                      {f.sync_status === 'pending' && (
                        <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-blue-50 text-blue-600">↑ sync pendente</span>
                      )}
                    </div>
                    <h4 className="font-bold text-zinc-900">{f.customer_name}</h4>
                    <div className="flex items-center gap-3 text-xs text-zinc-500 mt-0.5 flex-wrap">
                      {f.customer_phone && <span>📱 {f.customer_phone}</span>}
                      {f.pharmacist_name && <span>👨‍⚕️ {f.pharmacist_name}</span>}
                      <span>🕐 {new Date(f.created_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</span>
                    </div>
                  </div>
                </div>

                {/* Ingredientes */}
                <div className="flex-1 min-w-0 max-w-sm">
                  <div className="flex flex-wrap gap-1.5">
                    {f.items.map((item, idx) => (
                      <span key={idx} className="text-xs bg-zinc-50 border border-zinc-100 px-2 py-0.5 rounded-lg text-zinc-600 font-medium">
                        {item.material_name} <span className="text-zinc-400">{item.quantity}mg</span>
                      </span>
                    ))}
                  </div>
                </div>

                {/* Ações */}
                <div className="flex items-center gap-2 shrink-0">
                  {f.status === 'pending' ? (
                    <button onClick={() => updateStatus(f.id, 'completed')}
                      className="text-white px-4 py-2 rounded-xl text-sm font-bold hover:opacity-90 transition-all shadow-md"
                      style={{ background: 'linear-gradient(135deg, #16a34a, #15803d)' }}>
                      ✓ Concluir
                    </button>
                  ) : (
                    <div className="flex items-center gap-2">
                      <button onClick={() => onRepeat(f)}
                        className="text-sm font-semibold px-3 py-2 rounded-xl border-2 transition-colors flex items-center gap-1.5"
                        style={{ color: '#1F3164', borderColor: '#1F3164' }}
                        title="Criar nova receita com os mesmos dados">
                        <RefreshCw className="w-3.5 h-3.5" /> Repetir
                      </button>
                      <button onClick={() => updateStatus(f.id, 'pending')}
                        className="text-sm font-medium px-3 py-2 rounded-xl border transition-colors"
                        style={{ color: '#C41E3C', borderColor: '#C41E3C' }}>
                        Reabrir
                      </button>
                    </div>
                  )}
                  <button onClick={() => downloadReport(f)} className="p-2 text-zinc-400 hover:text-zinc-900 transition-colors rounded-lg hover:bg-zinc-50" title="Baixar relatório">
                    <FileText className="w-4 h-4" />
                  </button>
                  {user.role === 'admin' && (
                    <button onClick={() => handleDelete(f.id)} className="p-2 text-zinc-400 hover:text-red-600 transition-colors rounded-lg hover:bg-red-50" title="Excluir fórmula">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          ))}

          {filtered.length === 0 && (
            <div className="py-16 text-center text-zinc-400">
              {activeTab === 'pending'
                ? <><CheckCircle2 className="w-12 h-12 mx-auto mb-3 text-emerald-300" /><p className="font-medium text-emerald-600">Nenhuma fórmula pendente!</p><p className="text-sm mt-1">Todas as fórmulas foram concluídas.</p></>
                : <><Clock className="w-12 h-12 mx-auto mb-3 opacity-20" /><p>Nenhuma fórmula concluída ainda.</p></>
              }
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
      {/* Configuração do banco */}
      <div className="bg-white rounded-2xl shadow-sm border border-zinc-200 overflow-hidden">
        <div className="p-8 border-b border-zinc-100">
          <h2 className="text-2xl font-bold text-zinc-900">Configuração do Servidor</h2>
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
    </motion.div>
  );
}
