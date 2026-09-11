// Camada de serviço — usa IPC no Electron e HTTP no navegador.

interface AdminCreds { username: string; password: string; }

declare global {
  interface Window {
    electronAPI?: {
      login: (u: string, p: string, force?: boolean) => Promise<any>;
      logout: (token: string) => Promise<any>;
      sessionHeartbeat: (token: string) => Promise<any>;
      listUsers: () => Promise<any[]>; addUser: (u: any, t?: string) => Promise<any>; updateUser: (id: number, u: any, t?: string) => Promise<any>; deleteUser: (id: number, c?: AdminCreds, t?: string) => Promise<any>;
      listCustomers: () => Promise<any[]>; addCustomer: (c: any, t?: string) => Promise<any>; updateCustomer: (id: number, c: any, t?: string) => Promise<any>; deleteCustomer: (id: number, c?: AdminCreds, t?: string) => Promise<any>;
      listInsumos: () => Promise<any[]>; addInsumo: (n: string, t?: string) => Promise<any>; updateInsumo: (id: number, n: string, t?: string) => Promise<any>; deleteInsumo: (id: number, c?: AdminCreds, t?: string) => Promise<any>;
      listFormulas: () => Promise<any[]>; addFormula: (f: any, t?: string) => Promise<any>; updateFormula: (id: number, f: any, t?: string) => Promise<any>; updateFormulaStatus: (id: number, s: string, t?: string) => Promise<any>; updateFormulaDeliveryStatus: (id: number, s: string, t?: string) => Promise<any>; deleteFormula: (id: number, c?: AdminCreds, t?: string) => Promise<any>;
      listSavedFormulas: () => Promise<any[]>; addSavedFormula: (f: any, t?: string) => Promise<any>; updateSavedFormula: (id: number, f: any, t?: string) => Promise<any>; deleteSavedFormula: (id: number, c?: AdminCreds, t?: string) => Promise<any>;
      listLogs: (filters?: any) => Promise<{ rows: any[]; total: number }>;
      onDataChanged: (cb: () => void) => () => void; getConfig: () => Promise<any>; saveConfig: (cfg: any) => Promise<any>; testConnection: () => Promise<any>;
      onConfirmExit: (cb: (context: { source: 'window-close' | 'logout' }) => void) => () => void; confirmAppExit: () => Promise<void>;
    };
  }
}

const isElectron = () => Boolean(window.electronAPI);
const electron = () => window.electronAPI!;

async function webRequest<T>(path: string, method = 'GET', payload?: unknown): Promise<T> {
  const response = await fetch(`/api${path}`, {
    method,
    headers: payload === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: payload === undefined ? undefined : JSON.stringify(payload),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error ?? 'Erro ao acessar o servidor web.');
  return result as T;
}

const web = {
  auth: { login: (u: string, p: string, force?: boolean) => webRequest<any>('/auth/login', 'POST', { username: u, password: p, force }), logout: (t: string) => webRequest<any>('/auth/logout', 'POST', { token: t }), heartbeat: (t: string) => webRequest<any>('/session/heartbeat', 'POST', { token: t }) },
  users: { list: () => webRequest<any[]>('/users'), add: (u: any, t?: string) => webRequest<any>('/users', 'POST', { user: u, sessionToken: t }), update: (id: number, u: any, t?: string) => webRequest<any>(`/users/${id}`, 'PUT', { user: u, sessionToken: t }), remove: (id: number, c?: AdminCreds, t?: string) => webRequest<any>(`/users/${id}`, 'DELETE', { adminCreds: c, sessionToken: t }) },
  customers: { list: () => webRequest<any[]>('/customers'), add: (c: any, t?: string) => webRequest<any>('/customers', 'POST', { customer: c, sessionToken: t }), update: (id: number, c: any, t?: string) => webRequest<any>(`/customers/${id}`, 'PUT', { customer: c, sessionToken: t }), remove: (id: number, c?: AdminCreds, t?: string) => webRequest<any>(`/customers/${id}`, 'DELETE', { adminCreds: c, sessionToken: t }) },
  insumos: { list: () => webRequest<any[]>('/insumos'), add: (n: string, t?: string) => webRequest<any>('/insumos', 'POST', { name: n, sessionToken: t }), update: (id: number, n: string, t?: string) => webRequest<any>(`/insumos/${id}`, 'PUT', { name: n, sessionToken: t }), remove: (id: number, c?: AdminCreds, t?: string) => webRequest<any>(`/insumos/${id}`, 'DELETE', { adminCreds: c, sessionToken: t }) },
  formulas: { list: () => webRequest<any[]>('/formulas'), add: (f: any, t?: string) => webRequest<any>('/formulas', 'POST', { formula: f, sessionToken: t }), update: (id: number, f: any, t?: string) => webRequest<any>(`/formulas/${id}`, 'PUT', { formula: f, sessionToken: t }), updateStatus: (id: number, s: string, t?: string) => webRequest<any>(`/formulas/${id}/status`, 'PATCH', { status: s, sessionToken: t }), updateDeliveryStatus: (id: number, s: string, t?: string) => webRequest<any>(`/formulas/${id}/delivery-status`, 'PATCH', { deliveryStatus: s, sessionToken: t }), remove: (id: number, c?: AdminCreds, t?: string) => webRequest<any>(`/formulas/${id}`, 'DELETE', { adminCreds: c, sessionToken: t }) },
  savedFormulas: { list: () => webRequest<any[]>('/saved-formulas'), add: (f: any, t?: string) => webRequest<any>('/saved-formulas', 'POST', { formula: f, sessionToken: t }), update: (id: number, f: any, t?: string) => webRequest<any>(`/saved-formulas/${id}`, 'PUT', { formula: f, sessionToken: t }), remove: (id: number, c?: AdminCreds, t?: string) => webRequest<any>(`/saved-formulas/${id}`, 'DELETE', { adminCreds: c, sessionToken: t }) },
  logs: { list: (filters?: any) => webRequest<{ rows: any[]; total: number }>(`/logs${filters ? `?${new URLSearchParams(filters).toString()}` : ''}`) },
};

export const db = {
  auth: { login: (u: string, p: string, f?: boolean) => isElectron() ? electron().login(u, p, f) : web.auth.login(u, p, f), logout: (t: string) => isElectron() ? electron().logout(t) : web.auth.logout(t), heartbeat: (t: string) => isElectron() ? electron().sessionHeartbeat(t) : web.auth.heartbeat(t) },
  users: { list: () => isElectron() ? electron().listUsers() : web.users.list(), add: (u: any, t?: string) => isElectron() ? electron().addUser(u, t) : web.users.add(u, t), update: (id: number, u: any, t?: string) => isElectron() ? electron().updateUser(id, u, t) : web.users.update(id, u, t), remove: (id: number, c?: AdminCreds, t?: string) => isElectron() ? electron().deleteUser(id, c, t) : web.users.remove(id, c, t) },
  customers: { list: () => isElectron() ? electron().listCustomers() : web.customers.list(), add: (c: any, t?: string) => isElectron() ? electron().addCustomer(c, t) : web.customers.add(c, t), update: (id: number, c: any, t?: string) => isElectron() ? electron().updateCustomer(id, c, t) : web.customers.update(id, c, t), remove: (id: number, c?: AdminCreds, t?: string) => isElectron() ? electron().deleteCustomer(id, c, t) : web.customers.remove(id, c, t) },
  insumos: { list: () => isElectron() ? electron().listInsumos() : web.insumos.list(), add: (n: string, t?: string) => isElectron() ? electron().addInsumo(n, t) : web.insumos.add(n, t), update: (id: number, n: string, t?: string) => isElectron() ? electron().updateInsumo(id, n, t) : web.insumos.update(id, n, t), remove: (id: number, c?: AdminCreds, t?: string) => isElectron() ? electron().deleteInsumo(id, c, t) : web.insumos.remove(id, c, t) },
  formulas: { list: () => isElectron() ? electron().listFormulas() : web.formulas.list(), add: (f: any, t?: string) => isElectron() ? electron().addFormula(f, t) : web.formulas.add(f, t), update: (id: number, f: any, t?: string) => isElectron() ? electron().updateFormula(id, f, t) : web.formulas.update(id, f, t), updateStatus: (id: number, s: string, t?: string) => isElectron() ? electron().updateFormulaStatus(id, s, t) : web.formulas.updateStatus(id, s, t), updateDeliveryStatus: (id: number, s: string, t?: string) => isElectron() ? electron().updateFormulaDeliveryStatus(id, s, t) : web.formulas.updateDeliveryStatus(id, s, t), remove: (id: number, c?: AdminCreds, t?: string) => isElectron() ? electron().deleteFormula(id, c, t) : web.formulas.remove(id, c, t) },
  savedFormulas: { list: () => isElectron() ? electron().listSavedFormulas() : web.savedFormulas.list(), add: (f: any, t?: string) => isElectron() ? electron().addSavedFormula(f, t) : web.savedFormulas.add(f, t), update: (id: number, f: any, t?: string) => isElectron() ? electron().updateSavedFormula(id, f, t) : web.savedFormulas.update(id, f, t), remove: (id: number, c?: AdminCreds, t?: string) => isElectron() ? electron().deleteSavedFormula(id, c, t) : web.savedFormulas.remove(id, c, t) },
  logs: { list: (filters?: any) => isElectron() ? electron().listLogs(filters) : web.logs.list(filters) },
  data: { onChanged: (cb: () => void) => isElectron() ? electron().onDataChanged(cb) : () => {} },
  config: { get: () => isElectron() ? electron().getConfig() : Promise.resolve({}), save: (c: any) => isElectron() ? electron().saveConfig(c) : Promise.resolve({ success: true }), test: () => isElectron() ? electron().testConnection() : webRequest('/health') },
  app: { onConfirmExit: (cb: (context: { source: 'window-close' | 'logout' }) => void) => isElectron() ? electron().onConfirmExit(cb) : () => {}, confirmExit: () => isElectron() ? electron().confirmAppExit() : Promise.resolve() },
};
