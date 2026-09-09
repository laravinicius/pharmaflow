import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  // Auth
  login: (username: string, password: string, force: boolean = false) =>
    ipcRenderer.invoke('auth:login', username, password, force),
  logout: (token: string) => ipcRenderer.invoke('auth:logout', token),
  sessionHeartbeat: (token: string) => ipcRenderer.invoke('session:heartbeat', token),

  // Usuários
  listUsers:   ()    => ipcRenderer.invoke('users:list'),
  addUser:     (u: any, sessionToken?: string) => ipcRenderer.invoke('users:add', u, sessionToken),
  updateUser:  (id: number, u: any, sessionToken?: string) => ipcRenderer.invoke('users:update', id, u, sessionToken),
  deleteUser:  (id: number, adminCreds?: { username: string; password: string }, sessionToken?: string) => ipcRenderer.invoke('users:delete', id, adminCreds, sessionToken),

  // Clientes
  listCustomers:   ()              => ipcRenderer.invoke('customers:list'),
  addCustomer:     (c: any, sessionToken?: string)        => ipcRenderer.invoke('customers:add', c, sessionToken),
  updateCustomer:  (id: number, c: any, sessionToken?: string) => ipcRenderer.invoke('customers:update', id, c, sessionToken),
  deleteCustomer:  (id: number, adminCreds?: { username: string; password: string }, sessionToken?: string) => ipcRenderer.invoke('customers:delete', id, adminCreds, sessionToken),

  // Insumos
  listInsumos:   ()           => ipcRenderer.invoke('insumos:list'),
  addInsumo:     (name: string, sessionToken?: string) => ipcRenderer.invoke('insumos:add', name, sessionToken),
  updateInsumo:  (id: number, name: string, sessionToken?: string) => ipcRenderer.invoke('insumos:update', id, name, sessionToken),
  deleteInsumo:  (id: number, adminCreds?: { username: string; password: string }, sessionToken?: string) => ipcRenderer.invoke('insumos:delete', id, adminCreds, sessionToken),

  // Fórmulas
  listFormulas:         ()                        => ipcRenderer.invoke('formulas:list'),
  addFormula:           (f: any, sessionToken?: string)                  => ipcRenderer.invoke('formulas:add', f, sessionToken),
  updateFormula:        (id: number, f: any, sessionToken?: string)      => ipcRenderer.invoke('formulas:update', id, f, sessionToken),
  updateFormulaStatus:  (id: number, s: string, sessionToken?: string)   => ipcRenderer.invoke('formulas:update-status', id, s, sessionToken),
  updateFormulaDeliveryStatus: (id: number, s: string, sessionToken?: string) => ipcRenderer.invoke('formulas:update-delivery-status', id, s, sessionToken),
  deleteFormula:        (id: number, adminCreds?: { username: string; password: string }, sessionToken?: string) => ipcRenderer.invoke('formulas:delete', id, adminCreds, sessionToken),

  // Fórmulas Salvas
  listSavedFormulas:   ()                => ipcRenderer.invoke('savedFormulas:list'),
  addSavedFormula:     (f: any, sessionToken?: string)          => ipcRenderer.invoke('savedFormulas:add', f, sessionToken),
  updateSavedFormula:  (id: number, f: any, sessionToken?: string) => ipcRenderer.invoke('savedFormulas:update', id, f, sessionToken),
  deleteSavedFormula:  (id: number, adminCreds?: { username: string; password: string }, sessionToken?: string) => ipcRenderer.invoke('savedFormulas:delete', id, adminCreds, sessionToken),

  // Logs de auditoria
  listLogs: (filters?: any) => ipcRenderer.invoke('logs:list', filters),

  // Atualização ao vivo — avisa quando os dados mudam no servidor
  onDataChanged: (cb: () => void) => {
    const listener = () => cb();
    ipcRenderer.on('data:changed', listener);
    return () => ipcRenderer.removeListener('data:changed', listener);
  },

  // Configurações
  getConfig:       () => ipcRenderer.invoke('config:get'),
  saveConfig:      (cfg: any) => ipcRenderer.invoke('config:save', cfg),
  testConnection:  () => ipcRenderer.invoke('config:test'),

  // Confirmação de saída
  onConfirmExit: (cb: (context: { source: 'window-close' | 'logout' }) => void) => {
    const listener = (_: any, context: { source: 'window-close' | 'logout' }) => cb(context);
    ipcRenderer.on('app:confirm-exit', listener);
    return () => ipcRenderer.removeListener('app:confirm-exit', listener);
  },
  confirmAppExit: () => ipcRenderer.invoke('app:exit-confirmed'),
});
