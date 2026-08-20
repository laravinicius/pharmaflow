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
  deleteUser:  (id: number) => ipcRenderer.invoke('users:delete', id),

  // Clientes
  listCustomers:   ()              => ipcRenderer.invoke('customers:list'),
  addCustomer:     (c: any)        => ipcRenderer.invoke('customers:add', c),
  updateCustomer:  (id: number, c: any) => ipcRenderer.invoke('customers:update', id, c),
  deleteCustomer:  (id: number)    => ipcRenderer.invoke('customers:delete', id),

  // Insumos
  listInsumos:   ()           => ipcRenderer.invoke('insumos:list'),
  addInsumo:     (name: string) => ipcRenderer.invoke('insumos:add', name),
  updateInsumo:  (id: number, name: string) => ipcRenderer.invoke('insumos:update', id, name),
  deleteInsumo:  (id: number) => ipcRenderer.invoke('insumos:delete', id),

  // Fórmulas
  listFormulas:         ()                        => ipcRenderer.invoke('formulas:list'),
  addFormula:           (f: any)                  => ipcRenderer.invoke('formulas:add', f),
  updateFormula:        (id: number, f: any)      => ipcRenderer.invoke('formulas:update', id, f),
  updateFormulaStatus:  (id: number, s: string)   => ipcRenderer.invoke('formulas:update-status', id, s),
  updateFormulaDeliveryStatus: (id: number, s: string) => ipcRenderer.invoke('formulas:update-delivery-status', id, s),
  deleteFormula:        (id: number)              => ipcRenderer.invoke('formulas:delete', id),

  // Fórmulas Salvas
  listSavedFormulas:   ()                => ipcRenderer.invoke('savedFormulas:list'),
  addSavedFormula:     (f: any)          => ipcRenderer.invoke('savedFormulas:add', f),
  updateSavedFormula:  (id: number, f: any) => ipcRenderer.invoke('savedFormulas:update', id, f),
  deleteSavedFormula:  (id: number)      => ipcRenderer.invoke('savedFormulas:delete', id),

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
});
