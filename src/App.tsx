import React, { useEffect, useState } from 'react';
import {
  Users, Cross, ClipboardList, UserPlus, PlusCircle, LogOut,
  CheckCircle2, Clock, Menu, Settings, RefreshCw, AlertCircle,
  CheckCircle, History, AlertTriangle, Bookmark,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db } from './services/lanDatabase';
import { User, Formula } from './types';
import { PixFarmaLogo } from './components/Logo';
import { NavItem } from './components/NavItem';
import { AdminPanel } from './components/UserManager';
import { CustomerManager } from './components/CustomerManager';
import { InsumoManager } from './components/InsumoManager';
import { SettingsManager } from './components/SettingsManager';
import { Dashboard } from './components/Dashboard';
import { RecipeForm } from './components/RecipeForm';
import { FormulaList } from './components/FormulaList';
import { SavedFormulaManager } from './components/SavedFormulaManager';

// ─── Modal de Confirmação de Saída ─────────────────────────────────────────────

function ExitConfirmModal({ show, context, onConfirm, onCancel }: {
  show: boolean;
  context: 'window-close' | 'logout' | null;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!show || !context) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onCancel}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <h3 className="font-bold text-zinc-900 text-lg">
              {context === 'window-close' ? 'Sair do aplicativo' : 'Sair da conta'}
            </h3>
            <p className="text-xs text-zinc-500">
              {context === 'window-close' ? 'O aplicativo será fechado completamente.' : 'Sua sessão será encerrada.'}
            </p>
          </div>
        </div>
        <p className="text-sm text-zinc-700 mb-4">
          {context === 'window-close' ? 'Deseja realmente sair do aplicativo?' : 'Deseja realmente sair da conta?'}
        </p>
        <div className="flex gap-3">
          <button type="button" onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl border border-zinc-300 font-semibold text-sm text-zinc-700 hover:bg-zinc-50 transition-colors">
            Cancelar
          </button>
          <button type="button" onClick={onConfirm}
            className="flex-1 py-2.5 rounded-xl text-white font-semibold text-sm hover:opacity-90 transition-all"
            style={{ background: 'linear-gradient(135deg, #C41E3C, #A01830)' }}>
            Sim, sair
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── App Principal ─────────────────────────────────────────────────────────────

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [setupMode, setSetupMode] = useState(false);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [loginConflict, setLoginConflict] = useState(false);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'admin' | 'recipe' | 'pending' | 'confirmed' | 'formulaDetail' | 'confirmedDetail' | 'history' | 'historyDetail' | 'customers' | 'insumos' | 'savedFormulas' | 'settings'>('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'info' } | null>(null);
  const [templateFormula, setTemplateFormula] = useState<Formula | null>(null);
  const [viewingFormula, setViewingFormula] = useState<Formula | null>(null);
  const [missingReasons, setMissingReasons] = useState<string[] | null>(null);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [exitContext, setExitContext] = useState<'window-close' | 'logout' | null>(null);

  const showToast = (msg: string, type: 'success' | 'info' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const doLogin = async (force: boolean) => {
    setLoginLoading(true); setLoginError('');
    try {
      const res = await db.auth.login(loginForm.username, loginForm.password, force);
      if (res.success) {
        setUser(res.user);
        setSessionToken(res.sessionToken ?? null);
        setSetupMode(res.setupMode === true);
        setActiveTab('dashboard');
        setLoginConflict(false);
      } else if (res.conflict) {
        setLoginConflict(true);
      } else {
        setLoginError(res.error ?? 'Erro ao fazer login.');
      }
    } catch {
      setLoginError('Erro ao conectar ao servidor.');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    doLogin(false);
  };

  const handleLogout = () => {
    setExitContext('logout');
    setShowExitConfirm(true);
  };

  const handleExitConfirm = async () => {
    if (exitContext === 'window-close') {
      await db.app.confirmExit();
    } else if (exitContext === 'logout') {
      if (sessionToken) await db.auth.logout(sessionToken).catch(() => {});
      setUser(null);
      setSetupMode(false);
      setSessionToken(null);
      setActiveTab('dashboard');
    }
    setShowExitConfirm(false);
    setExitContext(null);
  };

  const handleExitCancel = () => {
    setShowExitConfirm(false);
    setExitContext(null);
  };

  const exitModal = (
    <ExitConfirmModal
      show={showExitConfirm}
      context={exitContext}
      onConfirm={handleExitConfirm}
      onCancel={handleExitCancel}
    />
  );

  // Mantém a sessão viva; se ela for derrubada por outro login, volta ao login
  useEffect(() => {
    if (!user || setupMode || !sessionToken) return;
    const timer = setInterval(async () => {
      try {
        const res = await db.auth.heartbeat(sessionToken);
        if (!res.valid) {
          setUser(null);
          setSetupMode(false);
          setSessionToken(null);
          setLoginError('Sua sessão foi encerrada em outro dispositivo.');
        }
      } catch { /* servidor fora do ar: mantém a sessão local */ }
    }, 2_000);
    return () => clearInterval(timer);
  }, [user, setupMode, sessionToken]);

  useEffect(() => {
    const cleanup = db.app.onConfirmExit((context) => {
      setExitContext(context.source);
      setShowExitConfirm(true);
    });
    return cleanup;
  }, []);

  if (!user) {
    return (
      <>
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

          {loginConflict && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setLoginConflict(false)}>
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
                    <AlertTriangle className="w-5 h-5 text-amber-600" />
                  </div>
                  <div>
                    <h3 className="font-bold text-zinc-900 text-lg">Usuário já logado</h3>
                    <p className="text-xs text-zinc-500">Este usuário já está logado em outro dispositivo.</p>
                  </div>
                </div>
                <p className="text-sm text-zinc-700 mb-4">Deseja entrar mesmo assim? A sessão do outro dispositivo será encerrada.</p>
                <div className="flex gap-3">
                  <button type="button" onClick={() => setLoginConflict(false)}
                    className="flex-1 py-2.5 rounded-xl border border-zinc-300 font-semibold text-sm text-zinc-700 hover:bg-zinc-50 transition-colors">
                    Cancelar
                  </button>
                  <button type="button" onClick={() => doLogin(true)} disabled={loginLoading}
                    className="flex-1 py-2.5 rounded-xl text-white font-semibold text-sm hover:opacity-90 transition-all disabled:opacity-60"
                    style={{ background: 'linear-gradient(135deg, #C41E3C, #A01830)' }}>
                    {loginLoading ? 'Entrando...' : 'Entrar mesmo assim'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
        {exitModal}
      </>
    );
  }

  if (setupMode) {
    return (
      <>
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
        {exitModal}
      </>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col">
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
                <NavItem icon={<Cross />} label="Insumos" active={activeTab === 'insumos'} onClick={() => setActiveTab('insumos')} collapsed={!isSidebarOpen} />
                <NavItem icon={<Bookmark />} label="Fórmulas Salvas" active={activeTab === 'savedFormulas'} onClick={() => setActiveTab('savedFormulas')} collapsed={!isSidebarOpen} />
                {user.role === 'admin' && (
                  <NavItem icon={<Settings />} label="Administração" active={activeTab === 'admin'} onClick={() => setActiveTab('admin')} collapsed={!isSidebarOpen} />
                )}
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
              {activeTab === 'pending' && <FormulaList screenKey="pending" variant="pending" title="Fórmulas Pendentes" subtitle="Fórmulas pendentes aguardando confirmação" statuses={['pending']} onSelect={(f) => { setViewingFormula(f); setActiveTab('formulaDetail'); }} onConfirm={(f, reasons) => { if (reasons.length === 0) { setActiveTab('confirmed'); } else { setViewingFormula(f); setMissingReasons(reasons); setActiveTab('formulaDetail'); } }} />}
              {activeTab === 'confirmed' && <FormulaList screenKey="confirmed" variant="confirmed" title="Fórmulas Confirmadas" subtitle="Fórmulas confirmadas para manipulação" statuses={['confirmed', 'completed']} onSelect={(f) => { setViewingFormula(f); setActiveTab('confirmedDetail'); }} />}
              {activeTab === 'history' && <FormulaList screenKey="history" variant="confirmed" title="Histórico" subtitle="Fórmulas canceladas e entregues" statuses={['cancelled', 'delivered']} statusFilterOptions={[{ value: 'cancelled', label: 'Canceladas' }, { value: 'delivered', label: 'Entregues' }]} showAndamento={false} onSelect={(f) => { setViewingFormula(f); setActiveTab('historyDetail'); }} onRepeat={(f) => { setTemplateFormula(f); setActiveTab('recipe'); }} />}
              {activeTab === 'historyDetail' && viewingFormula && <RecipeForm user={user} formula={viewingFormula} readOnly onComplete={() => { setViewingFormula(null); setTemplateFormula(null); setActiveTab('history'); }} />}
              {activeTab === 'customers' && <CustomerManager />}
              {activeTab === 'insumos' && <InsumoManager />}
              {activeTab === 'savedFormulas' && <SavedFormulaManager />}
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
      {exitModal}
    </div>
  );
}


