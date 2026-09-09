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
      addUser: (u: any, sessionToken?: string) => Promise<any>;
      updateUser: (id: number, u: any, sessionToken?: string) => Promise<any>;
      deleteUser: (id: number, adminCreds?: AdminCreds, sessionToken?: string) => Promise<any>;
      listCustomers: () => Promise<any[]>;
      addCustomer: (c: any, sessionToken?: string) => Promise<any>;
      updateCustomer: (id: number, c: any, sessionToken?: string) => Promise<any>;
      deleteCustomer: (id: number, adminCreds?: AdminCreds, sessionToken?: string) => Promise<any>;
      listInsumos: () => Promise<any[]>;
      addInsumo: (name: string, sessionToken?: string) => Promise<any>;
      updateInsumo: (id: number, name: string, sessionToken?: string) => Promise<any>;
      deleteInsumo: (id: number, adminCreds?: AdminCreds, sessionToken?: string) => Promise<any>;
      listFormulas: () => Promise<any[]>;
      addFormula: (f: any, sessionToken?: string) => Promise<any>;
      updateFormula: (id: number, f: any, sessionToken?: string) => Promise<any>;
      updateFormulaStatus: (id: number, s: string, sessionToken?: string) => Promise<any>;
      updateFormulaDeliveryStatus: (id: number, s: string, sessionToken?: string) => Promise<any>;
      deleteFormula: (id: number, adminCreds?: AdminCreds, sessionToken?: string) => Promise<any>;
      listSavedFormulas: () => Promise<any[]>;
      addSavedFormula: (f: any, sessionToken?: string) => Promise<any>;
      updateSavedFormula: (id: number, f: any, sessionToken?: string) => Promise<any>;
      deleteSavedFormula: (id: number, adminCreds?: AdminCreds, sessionToken?: string) => Promise<any>;
      listLogs: (filters?: any) => Promise<{ rows: any[]; total: number }>;
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
    add:    (u: any, sessionToken?: string) => api().addUser(u, sessionToken),
    update: (id: number, u: any, sessionToken?: string) => api().updateUser(id, u, sessionToken),
    remove: (id: number, adminCreds?: AdminCreds, sessionToken?: string) => api().deleteUser(id, adminCreds, sessionToken),
  },
  customers: {
    list: () => api().listCustomers(),
    add: (c: any, sessionToken?: string) => api().addCustomer(c, sessionToken),
    update: (id: number, c: any, sessionToken?: string) => api().updateCustomer(id, c, sessionToken),
    remove: (id: number, adminCreds?: AdminCreds, sessionToken?: string) => api().deleteCustomer(id, adminCreds, sessionToken)
  },
  insumos: {
    list: () => api().listInsumos(),
    add: (n: string, sessionToken?: string) => api().addInsumo(n, sessionToken),
    update: (id: number, n: string, sessionToken?: string) => api().updateInsumo(id, n, sessionToken),
    remove: (id: number, adminCreds?: AdminCreds, sessionToken?: string) => api().deleteInsumo(id, adminCreds, sessionToken)
  },
  formulas:  {
    list: () => api().listFormulas(),
    add: (f: any, sessionToken?: string) => api().addFormula(f, sessionToken),
    update: (id: number, f: any, sessionToken?: string) => api().updateFormula(id, f, sessionToken),
    updateStatus: (id: number, s: string, sessionToken?: string) => api().updateFormulaStatus(id, s, sessionToken),
    updateDeliveryStatus: (id: number, s: string, sessionToken?: string) => api().updateFormulaDeliveryStatus(id, s, sessionToken),
    remove: (id: number, adminCreds?: AdminCreds, sessionToken?: string) => api().deleteFormula(id, adminCreds, sessionToken)
  },
  savedFormulas: {
    list: () => api().listSavedFormulas(),
    add: (f: any, sessionToken?: string) => api().addSavedFormula(f, sessionToken),
    update: (id: number, f: any, sessionToken?: string) => api().updateSavedFormula(id, f, sessionToken),
    remove: (id: number, adminCreds?: AdminCreds, sessionToken?: string) => api().deleteSavedFormula(id, adminCreds, sessionToken)
  },
  logs:      { list: (filters?: any) => api().listLogs(filters) },
  data:      { onChanged: (cb: () => void) => api().onDataChanged(cb) },
  config:    { get: () => api().getConfig(), save: (c: any) => api().saveConfig(c), test: () => api().testConnection() },
  app:       { onConfirmExit: (cb: (context: { source: 'window-close' | 'logout' }) => void) => api().onConfirmExit(cb), confirmExit: () => api().confirmAppExit() },
};
