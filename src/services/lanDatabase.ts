// Camada de serviço — todas as chamadas passam pelo Electron IPC

declare global {
  interface Window {
    electronAPI: {
      login: (u: string, p: string) => Promise<{ success: boolean; user?: any; offline?: boolean; setupMode?: boolean; error?: string }>;
      listUsers: () => Promise<any[]>;
      addUser: (u: any) => Promise<any>;
      updateUser: (id: number, u: any) => Promise<any>;
      deleteUser: (id: number) => Promise<any>;
      listCustomers: () => Promise<any[]>;
      addCustomer: (c: any) => Promise<any>;
      updateCustomer: (id: number, c: any) => Promise<any>;
      deleteCustomer: (id: number) => Promise<any>;
      listMaterials: () => Promise<any[]>;
      addMaterial: (name: string) => Promise<any>;
      deleteMaterial: (id: number) => Promise<any>;
      listFormulas: () => Promise<any[]>;
      addFormula: (f: any) => Promise<any>;
      updateFormulaStatus: (id: number, s: string) => Promise<any>;
      deleteFormula: (id: number) => Promise<any>;
      syncNow: () => Promise<any>;
      syncStatus: () => Promise<any>;
      onSyncStatusUpdate: (cb: (s: any) => void) => void;
      getConfig: () => Promise<any>;
      saveConfig: (cfg: any) => Promise<any>;
      testConnection: () => Promise<any>;
    };
  }
}

const api = () => window.electronAPI;

export const db = {
  auth:      { login: (u: string, p: string) => api().login(u, p) },
  users:     {
    list:   ()                    => api().listUsers(),
    add:    (u: any)              => api().addUser(u),
    update: (id: number, u: any)  => api().updateUser(id, u),
    remove: (id: number)          => api().deleteUser(id),
  },
  customers: { list: () => api().listCustomers(), add: (c: any) => api().addCustomer(c), update: (id: number, c: any) => api().updateCustomer(id, c), remove: (id: number) => api().deleteCustomer(id) },
  materials: { list: () => api().listMaterials(), add: (n: string) => api().addMaterial(n), remove: (id: number) => api().deleteMaterial(id) },
  formulas:  { list: () => api().listFormulas(), add: (f: any) => api().addFormula(f), updateStatus: (id: number, s: string) => api().updateFormulaStatus(id, s), remove: (id: number) => api().deleteFormula(id) },
  sync:      { now: () => api().syncNow(), status: () => api().syncStatus(), onUpdate: (cb: (s: any) => void) => api().onSyncStatusUpdate(cb) },
  config:    { get: () => api().getConfig(), save: (c: any) => api().saveConfig(c), test: () => api().testConnection() },
};
