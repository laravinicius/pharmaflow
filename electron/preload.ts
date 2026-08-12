import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  // Auth
  login: (username: string, password: string) =>
    ipcRenderer.invoke('auth:login', username, password),
  bootstrapLocal: (username: string, password: string, name?: string) =>
    ipcRenderer.invoke('auth:bootstrap-local', username, password, name),

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

  // Matérias-Primas
  listMaterials:   ()           => ipcRenderer.invoke('materials:list'),
  addMaterial:     (name: string) => ipcRenderer.invoke('materials:add', name),
  deleteMaterial:  (id: number) => ipcRenderer.invoke('materials:delete', id),

  // Fórmulas
  listFormulas:         ()                        => ipcRenderer.invoke('formulas:list'),
  addFormula:           (f: any)                  => ipcRenderer.invoke('formulas:add', f),
  updateFormulaStatus:  (id: number, s: string)   => ipcRenderer.invoke('formulas:update-status', id, s),
  deleteFormula:        (id: number)              => ipcRenderer.invoke('formulas:delete', id),

  // Sync
  syncNow:    () => ipcRenderer.invoke('sync:now'),
  syncStatus: () => ipcRenderer.invoke('sync:status'),
  onSyncStatusUpdate: (cb: (status: any) => void) => {
    ipcRenderer.on('sync:status-update', (_, status) => cb(status));
  },

  // Configurações
  getConfig:       () => ipcRenderer.invoke('config:get'),
  saveConfig:      (cfg: any) => ipcRenderer.invoke('config:save', cfg),
  testConnection:  () => ipcRenderer.invoke('config:test'),
});
