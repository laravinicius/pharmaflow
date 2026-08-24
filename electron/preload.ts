import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  // Auth
  login: (username: string, password: string, force: boolean = false) =>
    ipcRenderer.invoke('auth:login', username, password, force),
  logout: (token: string) => ipcRenderer.invoke('auth:logout', token),
  sessionHeartbeat: (token: string) => ipcRenderer.invoke('session:heartbeat', token),

  // Usuários
  listUsers:   ()    => ipcRenderer.invoke('users:list'),
  addUser:     (u: any) => ipcRenderer.invoke('users:add', u),
  updateUser:  (id: number, u: any) => ipcRenderer.invoke('users:update', id, u),
  deleteUser:  (id: number, adminCreds?: { username: string; password: string }, sessionToken?: string) => ipcRenderer.invoke('users:delete', id, adminCreds, sessionToken),

  // Clientes
  listCustomers:   ()              => ipcRenderer.invoke('customers:list'),
  addCustomer:     (c: any)        => ipcRenderer.invoke('customers:add', c),
  updateCustomer:  (id: number, c: any) => ipcRenderer.invoke('customers:update', id, c),
  deleteCustomer:  (id: number, adminCreds?: { username: string; password: string }, sessionToken?: string) => ipcRenderer.invoke('customers:delete', id, adminCreds, sessionToken),

  // Insumos
  listInsumos:   ()           => ipcRenderer.invoke('insumos:list'),
  addInsumo:     (name: string) => ipcRenderer.invoke('insumos:add', name),
  updateInsumo:  (id: number, name: string) => ipcRenderer.invoke('insumos:update', id, name),
  deleteInsumo:  (id: number, adminCreds?: { username: string; password: string }, sessionToken?: string) => ipcRenderer.invoke('insumos:delete', id, adminCreds, sessionToken),

  // Fórmulas
  listFormulas:         ()                        => ipcRenderer.invoke('formulas:list'),
  addFormula:           (f: any)                  => ipcRenderer.invoke('formulas:add', f),
  updateFormula:        (id: number, f: any)      => ipcRenderer.invoke('formulas:update', id, f),
  updateFormulaStatus:  (id: number, s: string)   => ipcRenderer.invoke('formulas:update-status', id, s),
  updateFormulaDeliveryStatus: (id: number, s: string) => ipcRenderer.invoke('formulas:update-delivery-status', id, s),
  deleteFormula:        (id: number, adminCreds?: { username: string; password: string }, sessionToken?: string) => ipcRenderer.invoke('formulas:delete', id, adminCreds, sessionToken),

  // Fórmulas Salvas
  listSavedFormulas:   ()                => ipcRenderer.invoke('savedFormulas:list'),
  addSavedFormula:     (f: any)          => ipcRenderer.invoke('savedFormulas:add', f),
  updateSavedFormula:  (id: number, f: any) => ipcRenderer.invoke('savedFormulas:update', id, f),
  deleteSavedFormula:  (id: number, adminCreds?: { username: string; password: string }, sessionToken?: string) => ipcRenderer.invoke('savedFormulas:delete', id, adminCreds, sessionToken),

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
