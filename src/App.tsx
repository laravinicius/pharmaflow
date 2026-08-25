import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Users, Cross, ClipboardList, User as UserIcon, PlusCircle, LogOut,
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
import { AuthProvider, useAuth } from './context/AuthContext';
import { AdminAuthModal } from './components/AdminAuthModal';

interface HeartbeatMetrics {
  callCount: number;
  successCount: number;
  failureCount: number;
  totalDurationMs: number;
  lastDurationMs: number;
  lastValid: boolean | null;
  lastError: string | null;
}

const heartbeatMetrics: HeartbeatMetrics = {
  callCount: 0,
  successCount: 0,
  failureCount: 0,
  totalDurationMs: 0,
  lastDurationMs: 0,
  lastValid: null,
  lastError: null,
};

export function getHeartbeatMetrics(): HeartbeatMetrics {
  return { ...heartbeatMetrics };
}

export function resetHeartbeatMetrics(): void {
  heartbeatMetrics.callCount = 0;
  heartbeatMetrics.successCount = 0;
  heartbeatMetrics.failureCount = 0;
  heartbeatMetrics.totalDurationMs = 0;
  heartbeatMetrics.lastDurationMs = 0;
  heartbeatMetrics.lastValid = null;
  heartbeatMetrics.lastError = null;
}

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
            style={{ background: 'linear-gradient(135deg, #C5243E, #9B1A2E)' }}>
            Sim, sair
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── App Principal ─────────────────────────────────────────────────────────────

function AppInner() {
  const { user, sessionToken, setAuth, clearAuth } = useAuth();
  const [setupMode, setSetupMode] = useState(false);
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
  const [autoUnlockFormula, setAutoUnlockFormula] = useState(false);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [exitContext, setExitContext] = useState<'window-close' | 'logout' | null>(null);
  const [fontScale, setFontScale] = useState(() => Number(localStorage.getItem('pharmaflow.fontScale')) || 1);

  const isTabActive = useCallback((tab: string) => {
    if (activeTab === tab) return true;
    if (tab === 'pending' && activeTab === 'formulaDetail') return true;
    if (tab === 'confirmed' && activeTab === 'confirmedDetail') return true;
    if (tab === 'history' && activeTab === 'historyDetail') return true;
    return false;
  }, [activeTab]);

  const inactivityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleInactivityLogoutRef = useRef<() => Promise<void>>();
  const INACTIVITY_TIMEOUT_MS = 5 * 60 * 1000;

  const handleInactivityLogout = useCallback(async () => {
    if (sessionToken) {
      await db.auth.logout(sessionToken).catch(() => {});
    }
    clearAuth();
    setSetupMode(false);
    setActiveTab('dashboard');
    setLoginError('Sessão encerrada por inatividade (5 min).');
  }, [sessionToken, clearAuth]);

  useEffect(() => {
    handleInactivityLogoutRef.current = handleInactivityLogout;
  }, [handleInactivityLogout]);

  const resetInactivityTimer = useCallback(() => {
    if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
    inactivityTimerRef.current = setTimeout(() => handleInactivityLogoutRef.current?.(), INACTIVITY_TIMEOUT_MS);
  }, []);

  useEffect(() => {
    document.documentElement.style.setProperty('--font-scale', String(fontScale));
    localStorage.setItem('pharmaflow.fontScale', String(fontScale));
  }, [fontScale]);

  useEffect(() => {
    if (!viewingFormula) setAutoUnlockFormula(false);
  }, [viewingFormula]);

  useEffect(() => {
    if (!user || setupMode || !sessionToken) return;

    const activityEvents = ['mousemove', 'keydown', 'click', 'touchstart'] as const;

    const handleActivity = () => resetInactivityTimer();

    activityEvents.forEach(event => window.addEventListener(event, handleActivity, { passive: true }));

    resetInactivityTimer();

    return () => {
      activityEvents.forEach(event => window.removeEventListener(event, handleActivity));
      if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
    };
  }, [user, setupMode, sessionToken, resetInactivityTimer]);

  const showToast = (msg: string, type: 'success' | 'info' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const doLogin = async (force: boolean) => {
    setLoginLoading(true); setLoginError('');
    try {
      const res = await db.auth.login(loginForm.username, loginForm.password, force);
      if (res.success) {
        setAuth(res.user, res.sessionToken ?? null);
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
      clearAuth();
      setSetupMode(false);
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
  const isHeartbeatRunningRef = useRef(false);

  useEffect(() => {
    if (!user || setupMode || !sessionToken) return;
    let timer: ReturnType<typeof setInterval> | null = null;

    const runHeartbeat = async () => {
      if (isHeartbeatRunningRef.current) return;
      isHeartbeatRunningRef.current = true;
      const start = performance.now();
      try {
        heartbeatMetrics.callCount++;
        const res = await db.auth.heartbeat(sessionToken);
        const duration = performance.now() - start;
        heartbeatMetrics.totalDurationMs += duration;
        heartbeatMetrics.lastDurationMs = duration;
        heartbeatMetrics.lastValid = res.valid;
        heartbeatMetrics.lastError = null;
        if (res.valid) {
          heartbeatMetrics.successCount++;
        } else {
          heartbeatMetrics.failureCount++;
        }
        if (!res.valid) {
          clearAuth();
          setSetupMode(false);
          setLoginError('Sua sessão foi encerrada em outro dispositivo.');
        }
      } catch (e: any) {
        const duration = performance.now() - start;
        heartbeatMetrics.totalDurationMs += duration;
        heartbeatMetrics.lastDurationMs = duration;
        heartbeatMetrics.failureCount++;
        heartbeatMetrics.lastError = e.message ?? 'Erro desconhecido';
        /* servidor fora do ar: mantém a sessão local */
      } finally {
        isHeartbeatRunningRef.current = false;
      }
    };

    runHeartbeat();
    timer = setInterval(runHeartbeat, 30_000);
    return () => {
      if (timer) clearInterval(timer);
      isHeartbeatRunningRef.current = false;
    };
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
        <div className="min-h-screen flex flex-col items-center justify-center p-4" style={{ background: 'linear-gradient(135deg, #fff0f3 0%, #fff 50%, #f0f4ff 100%)' }}>
          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-zinc-200 overflow-hidden"
          >
            <div className="h-1.5 w-full" style={{ background: 'linear-gradient(90deg, #C5243E, #243465, #C5243E)' }} />
            <div className="flex justify-center px-8 pt-6">
              <div style={{ maxWidth: 408 }}>
                <PixFarmaLogo size="lg" />
              </div>
            </div>
            <div className="p-8">
            <div className="flex flex-col items-center mb-8">
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
                style={{ background: 'linear-gradient(135deg, #C5243E, #9B1A2E)' }}
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
                    style={{ background: 'linear-gradient(135deg, #C5243E, #9B1A2E)' }}>
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
            style={{ background: toast.type === 'success' ? 'linear-gradient(135deg,#16a34a,#15803d)' : '#243465' }}
          >
            {toast.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <RefreshCw className="w-4 h-4" />}
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>
        {/* Sidebar */}
        <aside className={`border-r border-zinc-200 transition-all duration-300 ${isSidebarOpen ? 'w-64' : 'w-20'} flex flex-col shrink-0 self-start sticky top-0 h-screen overflow-hidden`}
          style={{ background: '#243465' }}>
          <div className="p-5 w-full">
            <PixFarmaLogo size={isSidebarOpen ? 'sidebar' : 'icon'} />
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
                <NavItem icon={<ClipboardList />} label="Dashboard" active={isTabActive('dashboard')} onClick={() => setActiveTab('dashboard')} collapsed={!isSidebarOpen} />
                <NavItem icon={<PlusCircle />} label="Nova Fórmula" active={isTabActive('recipe')} onClick={() => setActiveTab('recipe')} collapsed={!isSidebarOpen} />
                <NavItem icon={<Clock />} label="Pendentes" active={isTabActive('pending')} onClick={() => setActiveTab('pending')} collapsed={!isSidebarOpen} />
                <NavItem icon={<CheckCircle2 />} label="Confirmadas" active={isTabActive('confirmed')} onClick={() => setActiveTab('confirmed')} collapsed={!isSidebarOpen} />
                <NavItem icon={<History />} label="Histórico" active={isTabActive('history')} onClick={() => setActiveTab('history')} collapsed={!isSidebarOpen} />
                <NavItem icon={<Users />} label="Clientes" active={isTabActive('customers')} onClick={() => setActiveTab('customers')} collapsed={!isSidebarOpen} />
                <NavItem icon={<Cross />} label="Insumos" active={isTabActive('insumos')} onClick={() => setActiveTab('insumos')} collapsed={!isSidebarOpen} />
                <NavItem icon={<Bookmark />} label="Fórmulas Salvas" active={isTabActive('savedFormulas')} onClick={() => setActiveTab('savedFormulas')} collapsed={!isSidebarOpen} />
                {user.role === 'admin' && (
                  <NavItem icon={<Settings />} label="Administração" active={isTabActive('admin')} onClick={() => setActiveTab('admin')} collapsed={!isSidebarOpen} />
                )}
              </>
            )}
          </nav>

          <div className="p-4" style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }}>
            <div className={`flex items-center gap-3 p-2 rounded-lg ${isSidebarOpen ? '' : ''}`}
              style={{ background: 'rgba(255,255,255,0.07)' }}>
              <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 cursor-pointer"
                style={{ background: 'rgba(255,255,255,0.15)' }}
                onClick={() => !isSidebarOpen && setIsSidebarOpen(true)}
                title={!isSidebarOpen ? 'Clique para abrir o menu' : ''}>
                <UserIcon className="w-4 h-4 text-white opacity-70" />
              </div>
              {isSidebarOpen && (
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{user.name}</p>
                  <p className="text-xs opacity-50 text-white capitalize">{user.role === 'admin' ? 'Administrador' : 'Funcionário'}</p>
                </div>
              )}
              {isSidebarOpen && (
                <button onClick={handleLogout}
                  className="transition-colors text-white opacity-40 hover:opacity-100">
                  <LogOut className="w-5 h-5" />
                </button>
              )}
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
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setFontScale(Math.max(0.75, fontScale - 0.125))}
                  disabled={fontScale <= 0.75}
                  title="Diminuir fonte"
                  className="w-8 h-8 rounded-lg font-bold text-white disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
                  style={{
                    background: 'linear-gradient(135deg, #243465, #1A2850)',
                  }}
                >
                  a&minus;
                </button>
                <button
                  onClick={() => setFontScale(Math.min(1.5, fontScale + 0.125))}
                  disabled={fontScale >= 1.5}
                  title="Aumentar fonte"
                  className="w-8 h-8 rounded-lg font-bold text-white disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
                  style={{
                    background: 'linear-gradient(135deg, #C5243E, #9B1A2E)',
                  }}
                >
                  A+
                </button>
              </div>
              <div className="text-sm text-zinc-500 text-right">
                {new Date().toLocaleDateString('pt-BR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </div>
            </div>
          </header>

          <div className="flex-1 overflow-auto p-8">
            <AnimatePresence mode="wait">
              {activeTab === 'dashboard' && <Dashboard user={user} onNavigate={setActiveTab} />}
              {activeTab === 'admin' && <AdminPanel user={user} />}
              {activeTab === 'recipe' && <RecipeForm user={user} template={templateFormula} onComplete={(dest) => { setTemplateFormula(null); setActiveTab(dest); }} />}
              {activeTab === 'formulaDetail' && viewingFormula && <RecipeForm user={user} formula={viewingFormula} initialLocked={!autoUnlockFormula} onComplete={(dest) => { setViewingFormula(null); setTemplateFormula(null); setAutoUnlockFormula(false); setActiveTab(dest); }} />}
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
            <div className="mt-5 flex gap-3">
              <button type="button" onClick={() => setMissingReasons(null)}
                className="flex-1 py-2.5 rounded-xl border border-zinc-300 font-semibold text-sm text-zinc-700 hover:bg-zinc-50 transition-colors">
                Entendi
              </button>
              <button type="button" onClick={() => { setMissingReasons(null); setAutoUnlockFormula(true); }}
                className="flex-1 py-2.5 rounded-xl text-white font-semibold text-sm hover:opacity-90 transition-all"
                style={{ background: 'linear-gradient(135deg, #243465, #1A2850)' }}>
                Editar
              </button>
            </div>
          </div>
        </div>
      )}
      {exitModal}
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppInner />
    </AuthProvider>
  );
}


