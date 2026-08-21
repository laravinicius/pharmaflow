import crypto from 'crypto';
import mysql from 'mysql2/promise';
import { formatDbError, isUnsupportedAuthPluginError } from './dbError';

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
    await this.q('DELETE FROM sessions WHERE token = ?', [token]);
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

  async addUser(user: { name: string; username: string; password: string; role: string }) {
    try {
      const dup = await this.q<any[]>('SELECT id FROM users WHERE username = ?', [user.username]);
      if (dup.length > 0) return { success: false, error: 'Usuário já existe.' };
      const r: any = await this.q('INSERT INTO users (name, username, password, role) VALUES (?,?,?,?)',
        [user.name, user.username, hash(user.password), user.role]);
      return { success: true, id: r.insertId };
    } catch (e) {
      return { success: false, error: friendlyError(e) };
    }
  }

  async updateUser(id: number, user: { name: string; username: string; password?: string; role: string }) {
    try {
      if (user.password && user.password.trim() !== '') {
        await this.q('UPDATE users SET name=?, username=?, password=?, role=? WHERE id=?',
          [user.name, user.username, hash(user.password), user.role, id]);
      } else {
        await this.q('UPDATE users SET name=?, username=?, role=? WHERE id=?',
          [user.name, user.username, user.role, id]);
      }
      return { success: true };
    } catch (e) {
      return { success: false, error: friendlyError(e) };
    }
  }

  async deleteUser(id: number) {
    try {
      await this.q('DELETE FROM users WHERE id = ?', [id]);
      return { success: true };
    } catch (e) {
      return { success: false, error: friendlyError(e) };
    }
  }

  // ── Clientes ──────────────────────────────────────────────────────────────────

  listCustomers() {
    return this.q('SELECT id, name, phone, created_at FROM customers ORDER BY name');
  }

  async addCustomer(c: { name: string; phone: string }) {
    try {
      const r: any = await this.q('INSERT INTO customers (name, phone) VALUES (?,?)', [c.name, c.phone]);
      return { success: true, id: r.insertId };
    } catch (e) {
      return { success: false, error: 'Celular já cadastrado no servidor.' };
    }
  }

  async updateCustomer(id: number, c: { name: string; phone: string }) {
    try {
      await this.q('UPDATE customers SET name=?, phone=? WHERE id=?', [c.name, c.phone, id]);
      return { success: true };
    } catch (e) {
      return { success: false, error: 'Celular já cadastrado no servidor.' };
    }
  }

  async deleteCustomer(id: number) {
    try {
      await this.q('DELETE FROM customers WHERE id = ?', [id]);
      return { success: true };
    } catch (e) {
      return { success: false, error: friendlyError(e) };
    }
  }

  // ── Insumos ─────────────────────────────────────────────────────────────────

  listInsumos() {
    return this.q('SELECT id, name, created_at FROM insumos ORDER BY name');
  }

  async addInsumo(name: string) {
    try {
      const r: any = await this.q('INSERT INTO insumos (name) VALUES (?)', [name]);
      return { success: true, id: r.insertId };
    } catch (e) {
      return { success: false, error: friendlyError(e) };
    }
  }

  async updateInsumo(id: number, name: string) {
    try {
      await this.q('UPDATE insumos SET name=? WHERE id=?', [name, id]);
      return { success: true };
    } catch (e) {
      return { success: false, error: friendlyError(e) };
    }
  }

  async deleteInsumo(id: number) {
    try {
      const inUse = await this.q<any[]>('SELECT 1 FROM formula_items WHERE insumo_id=? LIMIT 1', [id]);
      const inSaved = await this.q<any[]>('SELECT 1 FROM saved_formula_items WHERE insumo_id=? LIMIT 1', [id]);
      if (inUse.length > 0 || inSaved.length > 0) {
        return { success: false, error: 'Insumo em uso por fórmulas cadastradas. Não é possível excluir.' };
      }
      await this.q('DELETE FROM insumos WHERE id=?', [id]);
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
             COALESCE(f.pharmacist_name,'') AS pharmacist_name,
             COALESCE(f.budget_number,'') AS budget_number,
             COALESCE(f.attendant_name,'') AS attendant_name,
             f.delivery_date, COALESCE(f.payment_status,'') AS payment_status,
             f.payment_method, COALESCE(f.delivery_status,'') AS delivery_status,
             f.cancel_reason, f.status, f.created_at
      FROM formulas f JOIN customers c ON f.customer_id = c.id
      ORDER BY f.created_at DESC
    `);
    for (const f of formulas) {
      f.items = await this.q(
        `SELECT fi.insumo_id, m.name AS insumo_name, fi.quantity, fi.unit
         FROM formula_items fi JOIN insumos m ON fi.insumo_id = m.id
         WHERE fi.formula_id=?`, [f.id]
      );
      f.budget_items = await this.q(
        `SELECT quantity, unit, value, is_selected FROM formula_budget_items WHERE formula_id=?`, [f.id]
      );
    }
    return formulas;
  }

  async addFormula(formula: {
    customer_id: number;
    pharmacist_name: string;
    items: Array<{ insumo_id: number; quantity: number; unit?: string }>;
    budget_number?: string;
    budget_items?: Array<{ quantity: number; unit: string; value: number; is_selected?: number }>;
    attendant_name?: string;
    delivery_date?: string | null;
    payment_status?: string;
    payment_method?: string | null;
    delivery_status?: string;
    cancel_reason?: string | null;
    status?: string;
  }) {
    if (!this.pool) throw new Error('Sem conexão com o servidor');
    const conn = await this.pool.getConnection();
    try {
      await conn.beginTransaction();
      const customer = await this.q<any[]>('SELECT phone FROM customers WHERE id=?', [formula.customer_id]);
      const customerPhone = customer[0]?.phone ?? '';
      const [r]: any = await conn.query(
        `INSERT INTO formulas (customer_id, customer_phone, pharmacist_name, budget_number, attendant_name, delivery_date, payment_status, payment_method, delivery_status, cancel_reason, status)
         VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
        [formula.customer_id, customerPhone, formula.pharmacist_name, formula.budget_number ?? '',
         formula.attendant_name ?? '', formula.delivery_date ?? null, formula.payment_status ?? '',
         formula.payment_method ?? null, formula.delivery_status ?? '', formula.cancel_reason ?? null,
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
    pharmacist_name: string;
    items: Array<{ insumo_id: number; quantity: number; unit?: string }>;
    budget_number?: string;
    budget_items?: Array<{ quantity: number; unit: string; value: number; is_selected?: number }>;
    attendant_name?: string;
    delivery_date?: string | null;
    payment_status?: string;
    payment_method?: string | null;
    delivery_status?: string;
    cancel_reason?: string | null;
    status?: string;
  }) {
    if (!this.pool) throw new Error('Sem conexão com o servidor');
    const conn = await this.pool.getConnection();
    try {
      await conn.beginTransaction();
      const customer = await this.q<any[]>('SELECT phone FROM customers WHERE id=?', [formula.customer_id]);
      const customerPhone = customer[0]?.phone ?? '';
      await conn.query(
        `UPDATE formulas SET customer_id=?, customer_phone=?, pharmacist_name=?, budget_number=?, attendant_name=?, delivery_date=?, payment_status=?, payment_method=?, delivery_status=?, cancel_reason=?, status=? WHERE id=?`,
        [formula.customer_id, customerPhone, formula.pharmacist_name, formula.budget_number ?? '',
         formula.attendant_name ?? '', formula.delivery_date ?? null, formula.payment_status ?? '',
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
      return { success: true };
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }
  }

  async updateFormulaStatus(id: number, status: string) {
    await this.q('UPDATE formulas SET status=? WHERE id=?', [status, id]);
    return { success: true };
  }

  async updateFormulaDeliveryStatus(id: number, deliveryStatus: string) {
    await this.q(
      `UPDATE formulas SET delivery_status=?, status=CASE WHEN ?='entregue' THEN 'delivered' ELSE status END WHERE id=?`,
      [deliveryStatus, deliveryStatus, id]
    );
    return { success: true };
  }

  async deleteFormula(id: number) {
    await this.q('DELETE FROM formulas WHERE id=?', [id]);
    return { success: true };
  }

  // ── Fórmulas Salvas ──────────────────────────────────────────────────────────

  async listSavedFormulas() {
    const formulas = await this.q<any[]>(
      'SELECT id, name, created_at FROM saved_formulas ORDER BY name'
    );
    for (const f of formulas) {
      f.items = await this.q(
        `SELECT sfi.insumo_id, m.name AS insumo_name, sfi.quantity, sfi.unit
         FROM saved_formula_items sfi JOIN insumos m ON sfi.insumo_id = m.id
         WHERE sfi.saved_formula_id=?`, [f.id]
      );
    }
    return formulas;
  }

  async addSavedFormula(formula: {
    name: string;
    items: Array<{ insumo_id: number; quantity: number; unit?: string }>;
  }) {
    try {
      const r: any = await this.q('INSERT INTO saved_formulas (name) VALUES (?)', [formula.name]);
      for (const item of formula.items) {
        await this.q('INSERT INTO saved_formula_items (saved_formula_id, insumo_id, quantity, unit) VALUES (?,?,?,?)',
          [r.insertId, item.insumo_id, item.quantity, item.unit ?? 'mg']);
      }
      return { success: true, id: r.insertId };
    } catch (e) {
      return { success: false, error: friendlyError(e) };
    }
  }

  async updateSavedFormula(id: number, formula: {
    name: string;
    items: Array<{ insumo_id: number; quantity: number; unit?: string }>;
  }) {
    try {
      await this.q('UPDATE saved_formulas SET name=? WHERE id=?', [formula.name, id]);
      await this.q('DELETE FROM saved_formula_items WHERE saved_formula_id=?', [id]);
      for (const item of formula.items) {
        await this.q('INSERT INTO saved_formula_items (saved_formula_id, insumo_id, quantity, unit) VALUES (?,?,?,?)',
          [id, item.insumo_id, item.quantity, item.unit ?? 'mg']);
      }
      return { success: true };
    } catch (e) {
      return { success: false, error: friendlyError(e) };
    }
  }

  async deleteSavedFormula(id: number) {
    try {
      await this.q('DELETE FROM saved_formulas WHERE id=?', [id]);
      return { success: true };
    } catch (e) {
      return { success: false, error: friendlyError(e) };
    }
  }
}