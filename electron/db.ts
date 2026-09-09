import crypto from 'crypto';
import mysql from 'mysql2/promise';
import { formatDbError, isUnsupportedAuthPluginError } from './dbError';

interface AdminVerifyResult {
  success: boolean;
  user?: { id: number; name: string; username: string; role: string };
  error?: string;
}

interface SessionUserResult {
  user?: { id: number; name: string; username: string; role: string };
  error?: string;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

const hash = (s: string) => crypto.createHash('sha256').update(s).digest('hex');

interface SqlMetrics {
  queryCount: number;
  totalDurationMs: number;
  recordsReturned: number;
  lastQuery: string | null;
  lastDurationMs: number;
  lastError: string | null;
}

const sqlMetrics: SqlMetrics = {
  queryCount: 0,
  totalDurationMs: 0,
  recordsReturned: 0,
  lastQuery: null,
  lastDurationMs: 0,
  lastError: null,
};

export function getSqlMetrics(): SqlMetrics {
  return { ...sqlMetrics };
}

export function resetSqlMetrics(): void {
  sqlMetrics.queryCount = 0;
  sqlMetrics.totalDurationMs = 0;
  sqlMetrics.recordsReturned = 0;
  sqlMetrics.lastQuery = null;
  sqlMetrics.lastDurationMs = 0;
  sqlMetrics.lastError = null;
}

const logQuery = async <T>(sql: string, params: any[], fn: () => Promise<T>): Promise<T> => {
  const start = performance.now();
  sqlMetrics.queryCount++;
  sqlMetrics.lastQuery = sql;
  try {
    const result = await fn();
    const duration = performance.now() - start;
    sqlMetrics.totalDurationMs += duration;
    sqlMetrics.lastDurationMs = duration;
    sqlMetrics.lastError = null;
    if (Array.isArray(result)) {
      sqlMetrics.recordsReturned += result.length;
    }
    return result;
  } catch (e: any) {
    sqlMetrics.lastError = e.message ?? 'Erro desconhecido';
    throw e;
  }
};

// Erros de conectividade (servidor fora do ar) ≠ erros de dados
const isConnectionError = (e: any): boolean => {
  const msg = e instanceof Error ? e.message : String(e ?? '');
  return /ECONNREFUSED|ETIMEDOUT|ENOTFOUND|ECONNRESET|PROTOCOL_CONNECTION_LOST|EHOSTUNREACH|EAI_AGAIN/.test(msg);
};

// Converte erros do driver em mensagens amigáveis em PT-BR
const friendlyError = (e: any): string => {
  if (isConnectionError(e)) {
    return 'Servidor indisponível. Verifique a conexão com o banco de dados e tente novamente.';
  }
  if (isUnsupportedAuthPluginError(e)) return formatDbError(e);
  if (e instanceof Error && e.message) return e.message;
  return 'Erro ao acessar o banco de dados.';
};

// O app é online-first: todo dado é lido/gravado direto no MariaDB,
// sem cache local nem sincronização offline.

export class Db {
  private pool: mysql.Pool | null = null;

  setPool(pool: mysql.Pool | null) {
    this.pool = pool;
  }

  private async q<T = any>(sql: string, params?: any[]): Promise<T> {
    if (!this.pool) throw new Error('Sem conexão com o servidor');
    return logQuery(sql, params ?? [], async () => {
      const [rows] = await this.pool!.query(sql, params);
      return rows as T;
    });
  }

  // ── Sessões (login único) ──────────────────────────────────────────────────────

  // Sessão considerada morta se o último heartbeat passar deste limite
  static readonly SESSION_TTL_SECONDS = 120;

  async revokeSession(token: string): Promise<void> {
    if (!this.pool) return;
    const rows = await this.q<any[]>(
      'SELECT u.id, u.name FROM sessions s JOIN users u ON s.user_id = u.id WHERE s.token = ?',
      [token]
    );
    await this.q('DELETE FROM sessions WHERE token = ?', [token]);
    if (rows.length > 0) {
      await this.logAction({ id: rows[0].id, name: rows[0].name }, 'logout', 'system', rows[0].id, 'Sessão encerrada (logout).');
    }
  }

  // Renova last_seen e informa se a sessão ainda existe (foi derrubada por outro login)
  async heartbeat(token: string): Promise<{ valid: boolean }> {
    try {
      const r: any = await this.q(
        'UPDATE sessions SET last_seen = NOW() WHERE token = ?', [token]);
      return { valid: (r?.affectedRows ?? 0) > 0 };
    } catch (e) {
      return { valid: false };
    }
  }

  async cleanupStaleSessions(): Promise<void> {
    await this.q('DELETE FROM sessions WHERE last_seen < NOW() - INTERVAL ? SECOND',
      [Db.SESSION_TTL_SECONDS]);
  }

  // ── Logs de auditoria ────────────────────────────────────────────────────────

  // Resolve o usuário dono da sessão a partir do token (null + 'Configuração' p/ setup)
  private async resolveActor(token?: string): Promise<{ id: number | null; name: string }> {
    if (!token || !this.pool) return { id: null, name: 'Configuração' };
    try {
      const rows = await this.q<any[]>(
        'SELECT u.id, u.name FROM sessions s JOIN users u ON s.user_id = u.id WHERE s.token = ?',
        [token]
      );
      if (rows.length === 0) return { id: null, name: 'Configuração' };
      return { id: rows[0].id, name: rows[0].name };
    } catch {
      return { id: null, name: 'Configuração' };
    }
  }

  // Grava um log de auditoria — best-effort, nunca quebra a operação
  async logAction(
    actor: { id: number | null; name: string } | string | undefined,
    action: string,
    entity: string,
    entityId?: number | null,
    details?: string
  ): Promise<void> {
    try {
      let userId: number | null = null;
      let userName = '';
      if (typeof actor === 'string') {
        userName = actor;
      } else if (actor) {
        userId = actor.id ?? null;
        userName = actor.name;
      }
      await this.q(
        'INSERT INTO action_logs (user_id, user_name, action, entity, entity_id, details) VALUES (?,?,?,?,?,?)',
        [userId, userName, action, entity, entityId ?? null, details ?? '']
      );
    } catch { /* log de auditoria falho não pode quebrar a ação */ }
  }

  async listLogs(filters: {
    userId?: number; action?: string; entity?: string;
    from?: string; to?: string; search?: string;
    page?: number; pageSize?: number;
  } = {}): Promise<{ rows: any[]; total: number }> {
    const where: string[] = [];
    const params: any[] = [];
    if (filters.userId) { where.push('user_id = ?'); params.push(filters.userId); }
    if (filters.action) { where.push('action = ?'); params.push(filters.action); }
    if (filters.entity) { where.push('entity = ?'); params.push(filters.entity); }
    if (filters.from) { where.push('DATE(created_at) >= ?'); params.push(filters.from); }
    if (filters.to) { where.push('DATE(created_at) <= ?'); params.push(filters.to); }
    if (filters.search && filters.search.trim() !== '') {
      where.push("CONCAT(COALESCE(user_name,''), ' ', COALESCE(details,'')) LIKE ?");
      params.push(`%${filters.search.trim()}%`);
    }
    const whereSql = where.length > 0 ? 'WHERE ' + where.join(' AND ') : '';
    const page = Math.max(1, filters.page ?? 1);
    const pageSize = Math.min(200, Math.max(1, filters.pageSize ?? 50));
    const offset = (page - 1) * pageSize;
    const countRows: any = await this.q('SELECT COUNT(*) AS c FROM action_logs ' + whereSql, params);
    const total = Number(countRows[0]?.c ?? 0);
    const rows = await this.q(
      'SELECT * FROM action_logs ' + whereSql + ' ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?',
      [...params, pageSize, offset]
    );
    return { rows, total };
  }

  // ── Admin Verification ──────────────────────────────────────────────────────────

  async verifyAdmin(username: string, password: string): Promise<AdminVerifyResult> {
    try {
      const rows = await this.q<any[]>(
        'SELECT id, name, username, role FROM users WHERE username = ? AND password = ? AND role = ?',
        [username, hash(password), 'admin']
      );
      if (rows.length === 0) {
        return { success: false, error: 'Credenciais de administrador inválidas' };
      }
      return { success: true, user: rows[0] };
    } catch (e) {
      return { success: false, error: friendlyError(e) };
    }
  }

  async getSessionUser(token: string): Promise<SessionUserResult> {
    if (!this.pool) return { error: 'Sem conexão com o servidor' };
    try {
      const rows = await this.q<any[]>(
        `SELECT u.id, u.name, u.username, u.role
         FROM sessions s
         JOIN users u ON s.user_id = u.id
         WHERE s.token = ? AND s.last_seen >= NOW() - INTERVAL ? SECOND`,
        [token, Db.SESSION_TTL_SECONDS]
      );
      if (rows.length === 0) {
        return { error: 'Sessão inválida ou expirada' };
      }
      return { user: rows[0] };
    } catch (e) {
      return { error: friendlyError(e) };
    }
  }

  // ── Auth ──────────────────────────────────────────────────────────────────────

  async login(username: string, password: string, force = false): Promise<{
    success: boolean; user?: any; sessionToken?: string; conflict?: boolean; error?: string;
  }> {
    if (!this.pool) return { success: false, error: 'Sem conexão com o servidor' };
    let conn;
    try {
      const rows = await this.q<any[]>(
        'SELECT id, name, username, role FROM users WHERE username = ? AND password = ?',
        [username, hash(password)]
      );
      if (rows.length === 0) return { success: false, error: 'Usuário ou senha inválidos.' };
      if (rows[0].role !== 'admin' && rows[0].role !== 'employee') {
        return { success: false, error: 'Acesso negado. Este sistema é exclusivo para funcionários.' };
      }
      const user = rows[0];

      conn = await this.pool.getConnection();
      await conn.beginTransaction();
      await conn.query(
        'DELETE FROM sessions WHERE user_id = ? AND last_seen < NOW() - INTERVAL ? SECOND',
        [user.id, Db.SESSION_TTL_SECONDS]
      );
      const [active]: any = await conn.query(
        'SELECT id FROM sessions WHERE user_id = ? FOR UPDATE', [user.id]);
      if (active.length > 0 && !force) {
        await conn.rollback();
        conn.release();
        conn = null;
        return { success: false, conflict: true };
      }
      if (active.length > 0) {
        await conn.query('DELETE FROM sessions WHERE user_id = ?', [user.id]);
      }
      const token = crypto.randomBytes(32).toString('hex');
      await conn.query('INSERT INTO sessions (user_id, token) VALUES (?,?)', [user.id, token]);
      await conn.commit();
      conn.release();
      conn = null;
      await this.logAction({ id: user.id, name: user.name }, 'login', 'system', user.id, `Login de ${user.name} (${user.username}).`);
      return { success: true, user, sessionToken: token };
    } catch (e) {
      if (conn) { await conn.rollback(); conn.release(); }
      return { success: false, error: friendlyError(e) };
    }
  }

  // ── Usuários ──────────────────────────────────────────────────────────────────

  listUsers() {
    return this.q('SELECT id, name, username, role FROM users ORDER BY name');
  }

  async addUser(user: { name: string; username: string; password: string; role: string }, sessionToken?: string) {
    try {
      const dup = await this.q<any[]>('SELECT id FROM users WHERE username = ?', [user.username]);
      if (dup.length > 0) return { success: false, error: 'Usuário já existe.' };
      const r: any = await this.q('INSERT INTO users (name, username, password, role) VALUES (?,?,?,?)',
        [user.name, user.username, hash(user.password), user.role]);
      const actor = await this.resolveActor(sessionToken);
      await this.logAction(actor, 'add', 'users', r.insertId, `Usuário criado: ${user.name} (${user.username}).`);
      return { success: true, id: r.insertId };
    } catch (e) {
      return { success: false, error: friendlyError(e) };
    }
  }

  async updateUser(id: number, user: { name: string; username: string; password?: string; role: string }, sessionToken?: string) {
    try {
      if (user.password && user.password.trim() !== '') {
        await this.q('UPDATE users SET name=?, username=?, password=?, role=? WHERE id=?',
          [user.name, user.username, hash(user.password), user.role, id]);
      } else {
        await this.q('UPDATE users SET name=?, username=?, role=? WHERE id=?',
          [user.name, user.username, user.role, id]);
      }
      const actor = await this.resolveActor(sessionToken);
      await this.logAction(actor, 'update', 'users', id, `Usuário atualizado: ${user.name} (${user.username}).`);
      return { success: true };
    } catch (e) {
      return { success: false, error: friendlyError(e) };
    }
  }

  async deleteUser(id: number, adminCreds?: { username: string; password: string }, sessionToken?: string) {
    try {
      const adminCheck = await this.checkAdminAccess(adminCreds, sessionToken);
      if (!adminCheck.success) return { success: false, error: adminCheck.error };

      const target = await this.q<any[]>('SELECT name FROM users WHERE id = ?', [id]);
      await this.q('DELETE FROM users WHERE id = ?', [id]);
      const actor = adminCheck.user
        ? { id: adminCheck.user.id, name: adminCheck.user.name }
        : (adminCreds?.username ?? 'Configuração');
      await this.logAction(actor, 'delete', 'users', id, `Usuário excluído: ${target[0]?.name ?? id}.`);
      return { success: true };
    } catch (e) {
      return { success: false, error: friendlyError(e) };
    }
  }

  private async checkAdminAccess(adminCreds?: { username: string; password: string }, sessionToken?: string) {
    if (adminCreds?.username && adminCreds?.password) {
      return this.verifyAdmin(adminCreds.username, adminCreds.password);
    }
    if (sessionToken) {
      const sessionResult = await this.getSessionUser(sessionToken);
      if (sessionResult.user?.role === 'admin') {
        return { success: true, user: sessionResult.user };
      }
      return { success: false, error: 'Credenciais de administrador inválidas' };
    }
    return { success: false, error: 'Credenciais de administrador inválidas' };
  }

  // ── Clientes ──────────────────────────────────────────────────────────────────

  listCustomers() {
    return this.q('SELECT id, name, phone, created_at FROM customers ORDER BY name');
  }

  async addCustomer(c: { name: string; phone: string }, sessionToken?: string) {
    try {
      const r: any = await this.q('INSERT INTO customers (name, phone) VALUES (?,?)', [c.name, c.phone]);
      const actor = await this.resolveActor(sessionToken);
      await this.logAction(actor, 'add', 'customers', r.insertId, `Cliente adicionado: ${c.name} (tel: ${c.phone}).`);
      return { success: true, id: r.insertId };
    } catch (e) {
      return { success: false, error: 'Celular já cadastrado no servidor.' };
    }
  }

  async updateCustomer(id: number, c: { name: string; phone: string }, sessionToken?: string) {
    try {
      await this.q('UPDATE customers SET name=?, phone=? WHERE id=?', [c.name, c.phone, id]);
      const actor = await this.resolveActor(sessionToken);
      await this.logAction(actor, 'update', 'customers', id, `Cliente atualizado: ${c.name} (tel: ${c.phone}).`);
      return { success: true };
    } catch (e) {
      return { success: false, error: 'Celular já cadastrado no servidor.' };
    }
  }

  async deleteCustomer(id: number, adminCreds?: { username: string; password: string }, sessionToken?: string) {
    try {
      const adminCheck = await this.checkAdminAccess(adminCreds, sessionToken);
      if (!adminCheck.success) return { success: false, error: adminCheck.error };

      const target = await this.q<any[]>('SELECT name, phone FROM customers WHERE id = ?', [id]);
      await this.q('DELETE FROM customers WHERE id = ?', [id]);
      const actor = adminCheck.user
        ? { id: adminCheck.user.id, name: adminCheck.user.name }
        : (adminCreds?.username ?? 'Configuração');
      await this.logAction(actor, 'delete', 'customers', id, `Cliente excluído: ${target[0]?.name ?? id} (tel: ${target[0]?.phone ?? ''}).`);
      return { success: true };
    } catch (e) {
      return { success: false, error: friendlyError(e) };
    }
  }

  // ── Insumos ─────────────────────────────────────────────────────────────────

  listInsumos() {
    return this.q('SELECT id, name, created_at FROM insumos ORDER BY name');
  }

  async addInsumo(name: string, sessionToken?: string) {
    try {
      const r: any = await this.q('INSERT INTO insumos (name) VALUES (?)', [name]);
      const actor = await this.resolveActor(sessionToken);
      await this.logAction(actor, 'add', 'insumos', r.insertId, `Insumo adicionado: ${name}.`);
      return { success: true, id: r.insertId };
    } catch (e) {
      return { success: false, error: friendlyError(e) };
    }
  }

  async updateInsumo(id: number, name: string, sessionToken?: string) {
    try {
      await this.q('UPDATE insumos SET name=? WHERE id=?', [name, id]);
      const actor = await this.resolveActor(sessionToken);
      await this.logAction(actor, 'update', 'insumos', id, `Insumo atualizado: ${name}.`);
      return { success: true };
    } catch (e) {
      return { success: false, error: friendlyError(e) };
    }
  }

  async deleteInsumo(id: number, adminCreds?: { username: string; password: string }, sessionToken?: string) {
    try {
      const adminCheck = await this.checkAdminAccess(adminCreds, sessionToken);
      if (!adminCheck.success) return { success: false, error: adminCheck.error };

      const inUse = await this.q<any[]>('SELECT 1 FROM formula_items WHERE insumo_id=? LIMIT 1', [id]);
      const inSaved = await this.q<any[]>('SELECT 1 FROM saved_formula_items WHERE insumo_id=? LIMIT 1', [id]);
      if (inUse.length > 0 || inSaved.length > 0) {
        return { success: false, error: 'Insumo em uso por fórmulas cadastradas. Não é possível excluir.' };
      }
      const target = await this.q<any[]>('SELECT name FROM insumos WHERE id = ?', [id]);
      await this.q('DELETE FROM insumos WHERE id=?', [id]);
      const actor = adminCheck.user
        ? { id: adminCheck.user.id, name: adminCheck.user.name }
        : (adminCreds?.username ?? 'Configuração');
      await this.logAction(actor, 'delete', 'insumos', id, `Insumo excluído: ${target[0]?.name ?? id}.`);
      return { success: true };
    } catch (e) {
      return { success: false, error: friendlyError(e) };
    }
  }

  // ── Fórmulas ──────────────────────────────────────────────────────────────────

  async listFormulas() {
    const formulas = await this.q<any[]>(`
      SELECT f.id, f.customer_id, c.name AS customer_name,
             COALESCE(f.customer_phone,'') AS customer_phone,
             COALESCE(f.attendant_name,'') AS attendant_name,
             COALESCE(f.budget_number,'') AS budget_number,
             f.delivery_date, COALESCE(f.payment_status,'') AS payment_status,
             f.payment_method, COALESCE(f.delivery_status,'') AS delivery_status,
             f.cancel_reason, f.status, f.created_at
      FROM formulas f JOIN customers c ON f.customer_id = c.id
      ORDER BY f.created_at DESC
    `);

    if (formulas.length === 0) return formulas;

    const formulaIds = formulas.map(f => f.id);
    const placeholders = formulaIds.map(() => '?').join(',');

    const items = await this.q<any[]>(
      `SELECT fi.formula_id, fi.insumo_id, m.name AS insumo_name, fi.quantity, fi.unit
       FROM formula_items fi JOIN insumos m ON fi.insumo_id = m.id
       WHERE fi.formula_id IN (${placeholders})`,
      formulaIds
    );

    const budgetItems = await this.q<any[]>(
      `SELECT formula_id, quantity, unit, value, is_selected
       FROM formula_budget_items
       WHERE formula_id IN (${placeholders})`,
      formulaIds
    );

    const itemsByFormula: Record<number, any[]> = {};
    for (const item of items) {
      (itemsByFormula[item.formula_id] ??= []).push(item);
    }

    const budgetByFormula: Record<number, any[]> = {};
    for (const bi of budgetItems) {
      (budgetByFormula[bi.formula_id] ??= []).push(bi);
    }

    for (const f of formulas) {
      f.items = itemsByFormula[f.id] ?? [];
      f.budget_items = budgetByFormula[f.id] ?? [];
    }

    return formulas;
  }

  async addFormula(formula: {
    customer_id: number;
    attendant_name: string;
    items: Array<{ insumo_id: number; quantity: number; unit?: string }>;
    budget_number?: string;
    budget_items?: Array<{ quantity: number; unit: string; value: number; is_selected?: number }>;
    delivery_date?: string | null;
    payment_status?: string;
    payment_method?: string | null;
    delivery_status?: string;
    cancel_reason?: string | null;
    status?: string;
  }, sessionToken?: string) {
    if (!this.pool) throw new Error('Sem conexão com o servidor');
    const conn = await this.pool.getConnection();
    try {
      await conn.beginTransaction();
      const customer = await this.q<any[]>('SELECT phone FROM customers WHERE id=?', [formula.customer_id]);
      const customerPhone = customer[0]?.phone ?? '';
const [r]: any = await conn.query(
        `INSERT INTO formulas (customer_id, customer_phone, attendant_name, budget_number, delivery_date, payment_status, payment_method, delivery_status, cancel_reason, status)
         VALUES (?,?,?,?,?,?,?,?,?,?)`,
        [formula.customer_id, customerPhone, formula.attendant_name, formula.budget_number ?? '',
         formula.delivery_date ?? null, formula.payment_status ?? '',
         formula.payment_method ?? null, formula.status === 'confirmed' ? 'em_producao' : (formula.delivery_status ?? ''),
         formula.cancel_reason ?? null,
         formula.status ?? 'pending']
      );
      for (const item of formula.items) {
        await conn.query('INSERT INTO formula_items (formula_id, insumo_id, quantity, unit) VALUES (?,?,?,?)',
          [r.insertId, item.insumo_id, item.quantity, item.unit ?? 'mg']);
      }
      for (const bi of formula.budget_items ?? []) {
        await conn.query('INSERT INTO formula_budget_items (formula_id, quantity, unit, value, is_selected) VALUES (?,?,?,?,?)',
          [r.insertId, bi.quantity, bi.unit ?? 'caps', bi.value ?? 0, bi.is_selected ? 1 : 0]);
      }
      await conn.commit();
      const actor = await this.resolveActor(sessionToken);
      await this.logAction(actor, 'add', 'formulas', r.insertId, `Fórmula criada (id ${r.insertId}).`);
      return { success: true, id: r.insertId };
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }
  }

  async updateFormula(id: number, formula: {
    customer_id: number;
    attendant_name: string;
    items: Array<{ insumo_id: number; quantity: number; unit?: string }>;
    budget_number?: string;
    budget_items?: Array<{ quantity: number; unit: string; value: number; is_selected?: number }>;
    delivery_date?: string | null;
    payment_status?: string;
    payment_method?: string | null;
    delivery_status?: string;
    cancel_reason?: string | null;
    status?: string;
  }, sessionToken?: string) {
    if (!this.pool) throw new Error('Sem conexão com o servidor');
    const conn = await this.pool.getConnection();
    try {
      await conn.beginTransaction();
      const customer = await this.q<any[]>('SELECT phone FROM customers WHERE id=?', [formula.customer_id]);
      const customerPhone = customer[0]?.phone ?? '';
      await conn.query(
        `UPDATE formulas SET customer_id=?, customer_phone=?, attendant_name=?, budget_number=?, delivery_date=?, payment_status=?, payment_method=?, delivery_status=?, cancel_reason=?, status=? WHERE id=?`,
        [formula.customer_id, customerPhone, formula.attendant_name, formula.budget_number ?? '',
         formula.delivery_date ?? null, formula.payment_status ?? '',
         formula.payment_method ?? null, formula.delivery_status ?? '', formula.cancel_reason ?? null,
         formula.status ?? 'pending', id]
      );
      await conn.query('DELETE FROM formula_items WHERE formula_id=?', [id]);
      for (const item of formula.items) {
        await conn.query('INSERT INTO formula_items (formula_id, insumo_id, quantity, unit) VALUES (?,?,?,?)',
          [id, item.insumo_id, item.quantity, item.unit ?? 'mg']);
      }
      await conn.query('DELETE FROM formula_budget_items WHERE formula_id=?', [id]);
      for (const bi of formula.budget_items ?? []) {
        await conn.query('INSERT INTO formula_budget_items (formula_id, quantity, unit, value, is_selected) VALUES (?,?,?,?,?)',
          [id, bi.quantity, bi.unit ?? 'caps', bi.value ?? 0, bi.is_selected ? 1 : 0]);
      }
      await conn.commit();
      const actor = await this.resolveActor(sessionToken);
      await this.logAction(actor, 'update', 'formulas', id, `Fórmula atualizada (id ${id}).`);
      return { success: true };
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }
  }

  async updateFormulaStatus(id: number, status: string, sessionToken?: string) {
    if (status === 'confirmed') {
      await this.q('UPDATE formulas SET status=?, delivery_status=? WHERE id=?', [status, 'em_producao', id]);
    } else {
      await this.q('UPDATE formulas SET status=? WHERE id=?', [status, id]);
    }
    const actor = await this.resolveActor(sessionToken);
    await this.logAction(actor, 'update_status', 'formulas', id, `Status da fórmula ${id} alterado para ${status}.`);
    return { success: true };
  }

  async updateFormulaDeliveryStatus(id: number, deliveryStatus: string, sessionToken?: string) {
    await this.q(
      `UPDATE formulas SET delivery_status=?, status=CASE WHEN ?='entregue' THEN 'delivered' ELSE status END WHERE id=?`,
      [deliveryStatus, deliveryStatus, id]
    );
    const actor = await this.resolveActor(sessionToken);
    await this.logAction(actor, 'update_delivery_status', 'formulas', id, `Andamento da fórmula ${id} alterado para ${deliveryStatus}.`);
    return { success: true };
  }

  async deleteFormula(id: number, adminCreds?: { username: string; password: string }, sessionToken?: string) {
    try {
      const adminCheck = await this.checkAdminAccess(adminCreds, sessionToken);
      if (!adminCheck.success) return { success: false, error: adminCheck.error };

      await this.q('DELETE FROM formulas WHERE id=?', [id]);
      const actor = adminCheck.user
        ? { id: adminCheck.user.id, name: adminCheck.user.name }
        : (adminCreds?.username ?? 'Configuração');
      await this.logAction(actor, 'delete', 'formulas', id, `Fórmula excluída (id ${id}).`);
      return { success: true };
    } catch (e) {
      return { success: false, error: friendlyError(e) };
    }
  }

  // ── Fórmulas Salvas ──────────────────────────────────────────────────────────

  async listSavedFormulas() {
    const formulas = await this.q<any[]>(
      'SELECT id, name, budget_number, created_at FROM saved_formulas ORDER BY name'
    );

    if (formulas.length === 0) return formulas;

    const formulaIds = formulas.map(f => f.id);
    const placeholders = formulaIds.map(() => '?').join(',');

    const items = await this.q<any[]>(
      `SELECT sfi.saved_formula_id, sfi.insumo_id, m.name AS insumo_name, sfi.quantity, sfi.unit
       FROM saved_formula_items sfi JOIN insumos m ON sfi.insumo_id = m.id
       WHERE sfi.saved_formula_id IN (${placeholders})`,
      formulaIds
    );

    const budgetItems = await this.q<any[]>(
      `SELECT id, saved_formula_id, quantity, unit, value
       FROM saved_formula_budget_items
       WHERE saved_formula_id IN (${placeholders})`,
      formulaIds
    );

    const itemsByFormula: Record<number, any[]> = {};
    for (const item of items) {
      (itemsByFormula[item.saved_formula_id] ??= []).push(item);
    }

    const budgetItemsByFormula: Record<number, any[]> = {};
    for (const item of budgetItems) {
      (budgetItemsByFormula[item.saved_formula_id] ??= []).push({
        quantity: Number(item.quantity),
        unit: item.unit,
        value: Number(item.value),
      });
    }

    for (const f of formulas) {
      f.items = itemsByFormula[f.id] ?? [];
      f.budget_items = budgetItemsByFormula[f.id] ?? [];
    }

    return formulas;
  }

  async addSavedFormula(formula: {
    name: string;
    budget_number?: string;
    items: Array<{ insumo_id: number; quantity: number; unit?: string }>;
    budget_items: Array<{ quantity: number; unit: string; value: number }>;
  }, sessionToken?: string) {
    try {
      const r: any = await this.q('INSERT INTO saved_formulas (name, budget_number) VALUES (?,?)', [formula.name, formula.budget_number ?? null]);
      for (const item of formula.items) {
        await this.q('INSERT INTO saved_formula_items (saved_formula_id, insumo_id, quantity, unit) VALUES (?,?,?,?)',
          [r.insertId, item.insumo_id, item.quantity, item.unit ?? 'mg']);
      }
      for (const b of formula.budget_items) {
        await this.q('INSERT INTO saved_formula_budget_items (saved_formula_id, quantity, unit, value) VALUES (?,?,?,?)',
          [r.insertId, b.quantity, b.unit, b.value]);
      }
      const actor = await this.resolveActor(sessionToken);
      await this.logAction(actor, 'add', 'saved_formulas', r.insertId, `Fórmula salva adicionada: ${formula.name}.`);
      return { success: true, id: r.insertId };
    } catch (e) {
      return { success: false, error: friendlyError(e) };
    }
  }

  async updateSavedFormula(id: number, formula: {
    name: string;
    budget_number?: string;
    items: Array<{ insumo_id: number; quantity: number; unit?: string }>;
    budget_items: Array<{ quantity: number; unit: string; value: number }>;
  }, sessionToken?: string) {
    try {
      await this.q('UPDATE saved_formulas SET name=?, budget_number=? WHERE id=?', [formula.name, formula.budget_number ?? null, id]);
      await this.q('DELETE FROM saved_formula_items WHERE saved_formula_id=?', [id]);
      for (const item of formula.items) {
        await this.q('INSERT INTO saved_formula_items (saved_formula_id, insumo_id, quantity, unit) VALUES (?,?,?,?)',
          [id, item.insumo_id, item.quantity, item.unit ?? 'mg']);
      }
      await this.q('DELETE FROM saved_formula_budget_items WHERE saved_formula_id=?', [id]);
      for (const b of formula.budget_items) {
        await this.q('INSERT INTO saved_formula_budget_items (saved_formula_id, quantity, unit, value) VALUES (?,?,?,?)',
          [id, b.quantity, b.unit, b.value]);
      }
      const actor = await this.resolveActor(sessionToken);
      await this.logAction(actor, 'update', 'saved_formulas', id, `Fórmula salva atualizada: ${formula.name}.`);
      return { success: true };
    } catch (e) {
      return { success: false, error: friendlyError(e) };
    }
  }

  async deleteSavedFormula(id: number, adminCreds?: { username: string; password: string }, sessionToken?: string) {
    try {
      const adminCheck = await this.checkAdminAccess(adminCreds, sessionToken);
      if (!adminCheck.success) return { success: false, error: adminCheck.error };

      const target = await this.q<any[]>('SELECT name FROM saved_formulas WHERE id = ?', [id]);
      await this.q('DELETE FROM saved_formulas WHERE id=?', [id]);
      const actor = adminCheck.user
        ? { id: adminCheck.user.id, name: adminCheck.user.name }
        : (adminCreds?.username ?? 'Configuração');
      await this.logAction(actor, 'delete', 'saved_formulas', id, `Fórmula salva excluída: ${target[0]?.name ?? id}.`);
      return { success: true };
    } catch (e) {
      return { success: false, error: friendlyError(e) };
    }
  }
}