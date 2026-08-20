import React, { useEffect, useState } from 'react';
import { Settings, Wifi, WifiOff } from 'lucide-react';
import { motion } from 'motion/react';
import { AdminUserManager } from './AdminUserManager';

export function SettingsManager() {
  const [config, setConfig] = useState({ host: '', port: 3306, user: '', password: '', database: 'pharmaflow' });
  const [status, setStatus] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
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
        </>
      )}
    </motion.div>
  );
}