// Camada de serviço — todas as chamadas passam pelo Electron IPC

interface AdminCreds {
  username: string;
  password: string;
}

declare global {
  interface Window {
    electronAPI: {
      login: (u: string, p: string, force?: boolean) => Promise<{ success: boolean; user?: any; sessionToken?: string; conflict?: boolean; setupMode?: boolean; error?: string }>;
      logout: (token: string) => Promise<{ success: boolean }>;
      sessionHeartbeat: (token: string) => Promise<{ valid: boolean }>;
      listUsers: () => Promise<any[]>;
      addUser: (u: any) => Promise<any>;
      updateUser: (id: number, u: any) => Promise<any>;
      deleteUser: (id: number, adminCreds?: AdminCreds, sessionToken?: string) => Promise<any>;
      listCustomers: () => Promise<any[]>;
      addCustomer: (c: any) => Promise<any>;
      updateCustomer: (id: number, c: any) => Promise<any>;
      deleteCustomer: (id: number, adminCreds?: AdminCreds, sessionToken?: string) => Promise<any>;
      listInsumos: () => Promise<any[]>;
      addInsumo: (name: string) => Promise<any>;
      updateInsumo: (id: number, name: string) => Promise<any>;
      deleteInsumo: (id: number, adminCreds?: AdminCreds, sessionToken?: string) => Promise<any>;
      listFormulas: () => Promise<any[]>;
      addFormula: (f: any) => Promise<any>;
      updateFormula: (id: number, f: any) => Promise<any>;
      updateFormulaStatus: (id: number, s: string) => Promise<any>;
      updateFormulaDeliveryStatus: (id: number, s: string) => Promise<any>;
      deleteFormula: (id: number, adminCreds?: AdminCreds, sessionToken?: string) => Promise<any>;
      listSavedFormulas: () => Promise<any[]>;
      addSavedFormula: (f: any) => Promise<any>;
      updateSavedFormula: (id: number, f: any) => Promise<any>;
      deleteSavedFormula: (id: number, adminCreds?: AdminCreds, sessionToken?: string) => Promise<any>;
      onDataChanged: (cb: () => void) => () => void;
      getConfig: () => Promise<any>;
      saveConfig: (cfg: any) => Promise<any>;
      testConnection: () => Promise<any>;
      onConfirmExit: (cb: (context: { source: 'window-close' | 'logout' }) => void) => () => void;
      confirmAppExit: () => Promise<void>;
    };
  }
}

const api = () => window.electronAPI;

export const db = {
  auth:      {
    login: (u: string, p: string, force?: boolean) => api().login(u, p, force),
    logout: (token: string) => api().logout(token),
    heartbeat: (token: string) => api().sessionHeartbeat(token),
  },
  users:     {
    list:   ()                           => api().listUsers(),
    add:    (u: any)                     => api().addUser(u),
    update: (id: number, u: any)         => api().updateUser(id, u),
    remove: (id: number, adminCreds?: AdminCreds, sessionToken?: string) => api().deleteUser(id, adminCreds, sessionToken),
  },
  customers: {
    list: () => api().listCustomers(),
    add: (c: any) => api().addCustomer(c),
    update: (id: number, c: any) => api().updateCustomer(id, c),
    remove: (id: number, adminCreds?: AdminCreds, sessionToken?: string) => api().deleteCustomer(id, adminCreds, sessionToken)
  },
  insumos: {
    list: () => api().listInsumos(),
    add: (n: string) => api().addInsumo(n),
    update: (id: number, n: string) => api().updateInsumo(id, n),
    remove: (id: number, adminCreds?: AdminCreds, sessionToken?: string) => api().deleteInsumo(id, adminCreds, sessionToken)
  },
  formulas:  {
    list: () => api().listFormulas(),
    add: (f: any) => api().addFormula(f),
    update: (id: number, f: any) => api().updateFormula(id, f),
    updateStatus: (id: number, s: string) => api().updateFormulaStatus(id, s),
    updateDeliveryStatus: (id: number, s: string) => api().updateFormulaDeliveryStatus(id, s),
    remove: (id: number, adminCreds?: AdminCreds, sessionToken?: string) => api().deleteFormula(id, adminCreds, sessionToken)
  },
  savedFormulas: {
    list: () => api().listSavedFormulas(),
    add: (f: any) => api().addSavedFormula(f),
    update: (id: number, f: any) => api().updateSavedFormula(id, f),
    remove: (id: number, adminCreds?: AdminCreds, sessionToken?: string) => api().deleteSavedFormula(id, adminCreds, sessionToken)
  },
  data:      { onChanged: (cb: () => void) => api().onDataChanged(cb) },
  config:    { get: () => api().getConfig(), save: (c: any) => api().saveConfig(c), test: () => api().testConnection() },
  app:       { onConfirmExit: (cb: (context: { source: 'window-close' | 'logout' }) => void) => api().onConfirmExit(cb), confirmExit: () => api().confirmAppExit() },
};
