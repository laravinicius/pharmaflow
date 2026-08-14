import { createRequire } from 'module';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import mysql from 'mysql2/promise';
import { formatDbError, isUnsupportedAuthPluginError } from './dbError';

// sql.js é WebAssembly — sem compilação nativa, sem erros de ABI
const require = createRequire(import.meta.url);
const initSqlJs = require('sql.js') as (cfg?: any) => Promise<any>;

// ─── Tipos ─────────────────────────────────────────────────────────────────────

export type SyncState = 'idle' | 'syncing' | 'offline' | 'error' | 'connecting';

export interface SyncStatus {
  state: SyncState;
  lastSync: string | null;
  pending: number;
  error?: string;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

const hash = (s: string) => crypto.createHash('sha256').update(s).digest('hex');
const nowISO = () => new Date().toISOString();

// ─── CacheManager ──────────────────────────────────────────────────────────────

export class CacheManager {
  private db: any = null;
  private dbPath: string;
  private backupDir: string;
  private pool: mysql.Pool | null = null;
  private timer: NodeJS.Timeout | null = null;
  private statusCb?: (s: SyncStatus) => void;

  constructor(dataPath: string) {
    this.dbPath = path.join(dataPath, 'cache.db');
    this.backupDir = path.join(dataPath, 'backups');
  }

  // ── Init ─────────────────────────────────────────────────────────────────────

  async init() {
    const SQL = await initSqlJs();

    if (fs.existsSync(this.dbPath)) {
      const buf = fs.readFileSync(this.dbPath);
      this.db = new SQL.Database(buf);
    } else {
      this.db = new SQL.Database();
    }

    this.exec(`PRAGMA foreign_keys = ON`);
    this.initSchema();
    this.save();
  }

  // ── Persistência ─────────────────────────────────────────────────────────────

  private save() {
    const data: Uint8Array = this.db.export();
    fs.writeFileSync(this.dbPath, Buffer.from(data));
  }

  // ── Helpers SQL ───────────────────────────────────────────────────────────────

  // Executa sem retorno (DDL, INSERT, UPDATE, DELETE)
  private exec(sql: string, params: any[] = []) {
    this.db.run(sql, params);
  }

  // Retorna último insert id
  private lastId(): number {
    const r = this.db.exec('SELECT last_insert_rowid()');
    return r[0]?.values[0][0] as number ?? 0;
  }

  // Retorna array de objetos
  private query<T = any>(sql: string, params: any[] = []): T[] {
    const stmt = this.db.prepare(sql);
    stmt.bind(params);
    const rows: T[] = [];
    while (stmt.step()) {
      rows.push(stmt.getAsObject() as T);
    }
    stmt.free();
    return rows;
  }

  // Retorna primeiro resultado ou null
  private queryOne<T = any>(sql: string, params: any[] = []): T | null {
    const rows = this.query<T>(sql, params);
    return rows[0] ?? null;
  }

  // ── Schema ───────────────────────────────────────────────────────────────────

  private initSchema() {
    const tables = `
      CREATE TABLE IF NOT EXISTS sync_meta (
        key   TEXT PRIMARY KEY,
        value TEXT
      );

      CREATE TABLE IF NOT EXISTS users (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        server_id   INTEGER UNIQUE,
        name        TEXT NOT NULL,
        username    TEXT NOT NULL UNIQUE,
        password    TEXT NOT NULL,
        role        TEXT NOT NULL DEFAULT 'employee',
        sync_status TEXT NOT NULL DEFAULT 'synced',
        updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS customers (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        server_id   INTEGER UNIQUE,
        name        TEXT NOT NULL,
        phone       TEXT NOT NULL UNIQUE,
        sync_status TEXT NOT NULL DEFAULT 'pending',
        updated_at  TEXT NOT NULL DEFAULT (datetime('now')),
        created_at  TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS materials (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        server_id   INTEGER UNIQUE,
        name        TEXT NOT NULL UNIQUE,
        sync_status TEXT NOT NULL DEFAULT 'pending',
        updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS formulas (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        server_id       INTEGER UNIQUE,
        customer_id     INTEGER NOT NULL,
        customer_name   TEXT NOT NULL,
        customer_phone  TEXT,
        pharmacist_name TEXT,
        budget_number   TEXT NOT NULL DEFAULT '',
        attendant_name  TEXT NOT NULL DEFAULT '',
        delivery_date   TEXT,
        payment_status  TEXT NOT NULL DEFAULT '',
        payment_method  TEXT,
        delivery_status TEXT NOT NULL DEFAULT '',
        cancel_reason   TEXT,
        status          TEXT NOT NULL DEFAULT 'pending',
        sync_status     TEXT NOT NULL DEFAULT 'pending',
        updated_at      TEXT NOT NULL DEFAULT (datetime('now')),
        created_at      TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS formula_items (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        formula_id    INTEGER NOT NULL,
        material_id   INTEGER,
        material_name TEXT NOT NULL,
        quantity      REAL NOT NULL,
        unit          TEXT NOT NULL DEFAULT 'mg'
      );

      CREATE TABLE IF NOT EXISTS formula_budget_items (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        formula_id INTEGER NOT NULL,
        quantity   REAL NOT NULL,
        unit       TEXT NOT NULL DEFAULT 'caps',
        value      REAL NOT NULL DEFAULT 0
      );
    `;

    // sql.js não aceita múltiplos statements em run(), usa exec()
    this.db.exec(tables);

    // ── Migração de colunas novas (cache já existente) ───────────────────────
    const migrations = [
      `ALTER TABLE formulas ADD COLUMN customer_phone  TEXT NOT NULL DEFAULT ''`,
      `ALTER TABLE formulas ADD COLUMN pharmacist_name TEXT NOT NULL DEFAULT ''`,
      `ALTER TABLE customers ADD COLUMN created_at TEXT NOT NULL DEFAULT (datetime('now'))`,
      `ALTER TABLE formula_items ADD COLUMN unit TEXT NOT NULL DEFAULT 'mg'`,
      `ALTER TABLE formulas ADD COLUMN budget_number TEXT NOT NULL DEFAULT ''`,
      `ALTER TABLE formulas ADD COLUMN attendant_name TEXT NOT NULL DEFAULT ''`,
      `ALTER TABLE formulas ADD COLUMN delivery_date TEXT`,
      `ALTER TABLE formulas ADD COLUMN payment_status TEXT NOT NULL DEFAULT ''`,
      `ALTER TABLE formulas ADD COLUMN payment_method TEXT`,
      `ALTER TABLE formulas ADD COLUMN delivery_status TEXT NOT NULL DEFAULT ''`,
      `ALTER TABLE formulas ADD COLUMN cancel_reason TEXT`,
    ];
    for (const sql of migrations) {
      try { this.db.exec(sql); } catch (_) { /* coluna já existe — ignorar */ }
    }

    // ── Migração: customers sem cpf, phone único ─────────────────────────────
    const custCols = this.db.exec(`PRAGMA table_info(customers)`)[0]?.values ?? [];
    const hasCpf = custCols.some((row: any[]) => row[1] === 'cpf');
    if (hasCpf) {
      // SQLite não permite DROP COLUMN de coluna com UNIQUE — recria a tabela
      this.exec(`UPDATE customers SET phone = '' WHERE phone IS NULL OR phone = ''`);
      this.db.exec(`
        CREATE TABLE customers_new (
          id          INTEGER PRIMARY KEY AUTOINCREMENT,
          server_id   INTEGER UNIQUE,
          name        TEXT NOT NULL,
          phone       TEXT NOT NULL UNIQUE,
          sync_status TEXT NOT NULL DEFAULT 'pending',
          updated_at  TEXT NOT NULL DEFAULT (datetime('now')),
          created_at  TEXT NOT NULL DEFAULT (datetime('now'))
        );
        INSERT OR IGNORE INTO customers_new (id, server_id, name, phone, sync_status, updated_at, created_at)
          SELECT id, server_id, name, phone, sync_status, updated_at, created_at FROM customers;
        DROP TABLE customers;
        ALTER TABLE customers_new RENAME TO customers;
      `);
      this.save();
    }
  }

  // ── Pool MariaDB ──────────────────────────────────────────────────────────────

  setPool(pool: mysql.Pool | null) {
    this.pool = pool;
  }

  private async qServer<T = any>(sql: string, params?: any[]): Promise<T> {
    if (!this.pool) throw new Error('Sem conexão com o servidor');
    const [rows] = await this.pool.query(sql, params);
    return rows as T;
  }

  // ── Meta / Status ─────────────────────────────────────────────────────────────

  onStatus(cb: (s: SyncStatus) => void) { this.statusCb = cb; }

  private getMeta(key: string): string | null {
    const r = this.queryOne<{ value: string }>('SELECT value FROM sync_meta WHERE key = ?', [key]);
    return r?.value ?? null;
  }

  private setMeta(key: string, value: string) {
    this.exec('INSERT OR REPLACE INTO sync_meta (key, value) VALUES (?, ?)', [key, value]);
    this.save();
  }

  // sync_state é TRANSITÓRIO — não persiste entre sessões
  private currentState: SyncState = 'connecting' as any;

  getStatus(): SyncStatus {
    return {
      state: this.currentState,
      lastSync: this.getMeta('last_sync_at'),
      pending: this.countPending(),
    };
  }

  private countPending(): number {
    let count = 0;
    for (const t of ['users', 'customers', 'materials', 'formulas']) {
      const r = this.queryOne<{ c: number }>(`SELECT COUNT(*) AS c FROM ${t} WHERE sync_status = 'pending'`);
      count += r?.c ?? 0;
    }
    return count;
  }

  private emit(state: SyncState, extra?: Partial<SyncStatus>) {
    this.currentState = state;
    // Não persiste sync_state no disco — é sempre recalculado ao iniciar
    this.statusCb?.({ ...this.getStatus(), state, ...extra });
  }

  // ── Auth ──────────────────────────────────────────────────────────────────────

  async login(username: string, password: string): Promise<{
    success: boolean; user?: any; offline?: boolean; error?: string;
  }> {
    const hashed = hash(password);

    if (this.pool) {
      try {
        const rows = await this.qServer<any[]>(
          'SELECT id, name, username, role FROM users WHERE username = ? AND password = ?',
          [username, hashed]
        );

        if (rows.length > 0) {
          // Usuário encontrado no servidor
          if (rows[0].role !== 'admin' && rows[0].role !== 'employee') {
            return { success: false, error: 'Acesso negado. Este sistema é exclusivo para funcionários.' };
          }
          this.cacheUser(rows[0], hashed);
          this.wasOffline = false;
          this.syncNow().catch(() => {});
          return { success: true, offline: false, user: rows[0] };
        }

        // Não achou no servidor — pode ser um funcionário criado localmente
        // e ainda não sincronizado. Verifica cache local.
        const localUser = this.queryOne<any>(
          `SELECT id, server_id, name, username, role FROM users
           WHERE username = ? AND password = ? AND sync_status != 'deleted'`,
          [username, hashed]
        );
        if (localUser) {
          if (localUser.role !== 'admin' && localUser.role !== 'employee') {
            return { success: false, error: 'Acesso negado. Este sistema é exclusivo para funcionários.' };
          }
          // Força sync para tentar enviar o usuário ao servidor
          this.syncNow().catch(() => {});
          return {
            success: true, offline: false,
            user: { id: localUser.server_id ?? localUser.id, name: localUser.name, username: localUser.username, role: localUser.role },
          };
        }

        return { success: false, error: 'Usuário ou senha inválidos.' };
      } catch (error) {
        if (isUnsupportedAuthPluginError(error)) {
          return { success: false, error: formatDbError(error) };
        }
        /* servidor inacessível — cai no fallback */
      }
    }

    // Servidor inacessível — usa cache local
    const cached = this.queryOne<any>(
      `SELECT server_id, name, username, role FROM users
       WHERE username = ? AND password = ? AND sync_status != 'deleted'`,
      [username, hashed]
    );

    if (cached) {
      if (cached.role !== 'admin' && cached.role !== 'employee') {
        return { success: false, error: 'Acesso negado.' };
      }
      this.wasOffline = true;
      this.emit('offline');
      return {
        success: true, offline: true,
        user: { id: cached.server_id, name: cached.name, username: cached.username, role: cached.role },
      };
    }

    return { success: false, error: 'Servidor indisponível. Nenhum login em cache para este usuário.' };
  }

  private cacheUser(user: any, hashedPwd: string) {
    this.exec(`
      INSERT INTO users (server_id, name, username, password, role, sync_status)
      VALUES (?, ?, ?, ?, ?, 'synced')
      ON CONFLICT(username) DO UPDATE SET
        server_id = excluded.server_id, name = excluded.name,
        password = excluded.password, role = excluded.role, sync_status = 'synced'
    `, [user.id, user.name, user.username, hashedPwd, user.role]);
    this.save();
  }

  // ── Usuários ──────────────────────────────────────────────────────────────────

  listUsers() {
    return this.query(`SELECT id, server_id, name, username, role FROM users WHERE sync_status != 'deleted' ORDER BY name`);
  }

  addUser(user: { name: string; username: string; password: string; role: string }) {
    this.exec(`INSERT INTO users (name, username, password, role, sync_status, updated_at)
      VALUES (?, ?, ?, ?, 'pending', datetime('now'))`,
      [user.name, user.username, hash(user.password), user.role]);
    const id = this.lastId();
    this.save();
    // Sincroniza imediatamente para o novo funcionário poder logar em outros PCs
    this.syncNow().catch(() => {});
    return { success: true, id };
  }

  updateUser(id: number, user: { name: string; username: string; password?: string; role: string }) {
    if (user.password && user.password.trim() !== '') {
      this.exec(
        `UPDATE users SET name=?, username=?, password=?, role=?, sync_status='pending', updated_at=datetime('now') WHERE id=?`,
        [user.name, user.username, hash(user.password), user.role, id]
      );
    } else {
      this.exec(
        `UPDATE users SET name=?, username=?, role=?, sync_status='pending', updated_at=datetime('now') WHERE id=?`,
        [user.name, user.username, user.role, id]
      );
    }
    this.save();
    this.syncNow().catch(() => {});
    return { success: true };
  }

  deleteUser(id: number) {
    const u = this.queryOne<any>('SELECT server_id FROM users WHERE id = ?', [id]);
    if (u?.server_id) {
      this.exec(`UPDATE users SET sync_status = 'deleted', updated_at = datetime('now') WHERE id = ?`, [id]);
    } else {
      this.exec('DELETE FROM users WHERE id = ?', [id]);
    }
    this.save();
    return { success: true };
  }

  // ── Clientes ──────────────────────────────────────────────────────────────────

  listCustomers() {
    return this.query(`SELECT id, server_id, name, phone, created_at FROM customers WHERE sync_status != 'deleted' ORDER BY name`);
  }

  addCustomer(c: { name: string; phone: string }) {
    this.exec(`INSERT INTO customers (name, phone, sync_status, updated_at, created_at)
      VALUES (?, ?, 'pending', datetime('now'), datetime('now'))`, [c.name, c.phone]);
    const id = this.lastId();
    this.save();
    return { success: true, id };
  }

  updateCustomer(id: number, c: { name: string; phone: string }) {
    this.exec(`UPDATE customers SET name=?, phone=?, sync_status='pending', updated_at=datetime('now') WHERE id=?`,
      [c.name, c.phone, id]);
    this.save();
    return { success: true };
  }

  deleteCustomer(id: number) {
    const c = this.queryOne<any>('SELECT server_id FROM customers WHERE id = ?', [id]);
    if (c?.server_id) {
      this.exec(`UPDATE customers SET sync_status='deleted', updated_at=datetime('now') WHERE id=?`, [id]);
    } else {
      this.exec('DELETE FROM customers WHERE id=?', [id]);
    }
    this.save();
    return { success: true };
  }

  // ── Matérias-Primas ───────────────────────────────────────────────────────────

  listMaterials() {
    return this.query(`SELECT id, server_id, name FROM materials WHERE sync_status != 'deleted' ORDER BY name`);
  }

  addMaterial(name: string) {
    this.exec(`INSERT INTO materials (name, sync_status, updated_at) VALUES (?, 'pending', datetime('now'))`, [name]);
    const id = this.lastId();
    this.save();
    return { success: true, id };
  }

  deleteMaterial(id: number) {
    const m = this.queryOne<any>('SELECT server_id FROM materials WHERE id=?', [id]);
    if (m?.server_id) {
      this.exec(`UPDATE materials SET sync_status='deleted', updated_at=datetime('now') WHERE id=?`, [id]);
    } else {
      this.exec('DELETE FROM materials WHERE id=?', [id]);
    }
    this.save();
    return { success: true };
  }

  // ── Fórmulas ──────────────────────────────────────────────────────────────────

  listFormulas() {
    const formulas = this.query<any>(`
      SELECT id, server_id, customer_id, customer_name, customer_phone, pharmacist_name,
             budget_number, attendant_name, delivery_date, payment_status, payment_method, delivery_status, cancel_reason, status, sync_status, created_at
      FROM formulas WHERE sync_status != 'deleted'
      ORDER BY created_at DESC
    `);
    for (const f of formulas) {
      f.items = this.query(
        `SELECT material_id, material_name, quantity, unit FROM formula_items WHERE formula_id=?`, [f.id]
      );
      f.budget_items = this.query(
        `SELECT quantity, unit, value FROM formula_budget_items WHERE formula_id=?`, [f.id]
      );
    }
    return formulas;
  }

  addFormula(formula: {
    customer_id: number;
    pharmacist_name: string;
    items: Array<{ material_id: number; quantity: number; unit?: string }>;
    budget_number?: string;
    budget_items?: Array<{ quantity: number; unit: string; value: number }>;
    attendant_name?: string;
    delivery_date?: string | null;
    payment_status?: string;
    payment_method?: string | null;
    delivery_status?: string;
    cancel_reason?: string | null;
    status?: string;
  }) {
    const customer = this.queryOne<any>('SELECT name, phone FROM customers WHERE id=?', [formula.customer_id]);
    if (!customer) throw new Error('Cliente não encontrado');

    this.exec(`INSERT INTO formulas (customer_id, customer_name, customer_phone, pharmacist_name, budget_number, attendant_name, delivery_date, payment_status, payment_method, delivery_status, cancel_reason, status, sync_status, updated_at, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', datetime('now'), datetime('now'))`,
      [formula.customer_id, customer.name, customer.phone ?? '', formula.pharmacist_name,
       formula.budget_number ?? '', formula.attendant_name ?? '', formula.delivery_date ?? null,
       formula.payment_status ?? '', formula.payment_method ?? null, formula.delivery_status ?? '',
       formula.cancel_reason ?? null, formula.status ?? 'saved']);
    const formulaId = this.lastId();

    for (const item of formula.items) {
      const mat = this.queryOne<any>('SELECT name FROM materials WHERE id=?', [item.material_id]);
      this.exec(`INSERT INTO formula_items (formula_id, material_id, material_name, quantity, unit) VALUES (?,?,?,?,?)`,
        [formulaId, item.material_id, mat?.name ?? 'N/A', item.quantity, item.unit ?? 'mg']);
    }

    for (const bi of formula.budget_items ?? []) {
      this.exec(`INSERT INTO formula_budget_items (formula_id, quantity, unit, value) VALUES (?,?,?,?)`,
        [formulaId, bi.quantity, bi.unit ?? 'caps', bi.value ?? 0]);
    }

    this.save();
    return { success: true, id: formulaId };
  }

  updateFormula(id: number, formula: {
    customer_id: number;
    pharmacist_name: string;
    items: Array<{ material_id: number; quantity: number; unit?: string }>;
    budget_number?: string;
    budget_items?: Array<{ quantity: number; unit: string; value: number }>;
    attendant_name?: string;
    delivery_date?: string | null;
    payment_status?: string;
    payment_method?: string | null;
    delivery_status?: string;
    cancel_reason?: string | null;
    status?: string;
  }) {
    const customer = this.queryOne<any>('SELECT name, phone FROM customers WHERE id=?', [formula.customer_id]);
    if (!customer) throw new Error('Cliente não encontrado');

    this.exec(`UPDATE formulas SET customer_id=?, customer_name=?, customer_phone=?, pharmacist_name=?, budget_number=?, attendant_name=?, delivery_date=?, payment_status=?, payment_method=?, delivery_status=?, cancel_reason=?, status=?, sync_status='pending', updated_at=datetime('now') WHERE id=?`,
      [formula.customer_id, customer.name, customer.phone ?? '', formula.pharmacist_name,
       formula.budget_number ?? '', formula.attendant_name ?? '', formula.delivery_date ?? null,
       formula.payment_status ?? '', formula.payment_method ?? null, formula.delivery_status ?? '',
       formula.cancel_reason ?? null, formula.status ?? 'saved', id]);

    this.exec(`DELETE FROM formula_items WHERE formula_id=?`, [id]);
    for (const item of formula.items) {
      const mat = this.queryOne<any>('SELECT name FROM materials WHERE id=?', [item.material_id]);
      this.exec(`INSERT INTO formula_items (formula_id, material_id, material_name, quantity, unit) VALUES (?,?,?,?,?)`,
        [id, item.material_id, mat?.name ?? 'N/A', item.quantity, item.unit ?? 'mg']);
    }

    this.exec(`DELETE FROM formula_budget_items WHERE formula_id=?`, [id]);
    for (const bi of formula.budget_items ?? []) {
      this.exec(`INSERT INTO formula_budget_items (formula_id, quantity, unit, value) VALUES (?,?,?,?)`,
        [id, bi.quantity, bi.unit ?? 'caps', bi.value ?? 0]);
    }

    this.save();
    return { success: true };
  }

  updateFormulaStatus(id: number, status: string) {
    this.exec(`UPDATE formulas SET status=?, sync_status='pending', updated_at=datetime('now') WHERE id=?`, [status, id]);
    this.save();
    return { success: true };
  }

  deleteFormula(id: number) {
    const f = this.queryOne<any>('SELECT server_id FROM formulas WHERE id=?', [id]);
    if (f?.server_id) {
      this.exec(`UPDATE formulas SET sync_status='deleted', updated_at=datetime('now') WHERE id=?`, [id]);
    } else {
      this.exec('DELETE FROM formulas WHERE id=?', [id]);
    }
    this.save();
    return { success: true };
  }

  // ── Loop de sincronização ─────────────────────────────────────────────────────

  private wasOffline = false;          // rastreia se estava offline antes
  private healthTimer: NodeJS.Timeout | null = null;

  startSyncLoop(intervalMs = 10 * 60 * 1000) {
    if (this.timer) clearInterval(this.timer);
    if (this.healthTimer) clearInterval(this.healthTimer);

    // Sync completo a cada 10 minutos
    this.timer = setInterval(() => this.syncNow().catch(() => {}), intervalMs);

    // Health check leve a cada 30 segundos
    this.healthTimer = setInterval(() => this.healthCheck().catch(() => {}), 30_000);

    // Verifica imediatamente no arranque
    setTimeout(() => this.healthCheck().catch(() => {}), 2_000);
  }

  stopSyncLoop() {
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
    if (this.healthTimer) { clearInterval(this.healthTimer); this.healthTimer = null; }
  }

  // Ping leve — só testa conectividade
  private async healthCheck(): Promise<void> {
    if (!this.pool) { this.emit('offline'); return; }
    try {
      await this.pool.query('SELECT 1');
      if (this.wasOffline) {
        // Voltou online → sync completo imediato
        this.wasOffline = false;
        await this.syncNow();
      } else {
        const cur = this.getMeta('sync_state');
        if (cur !== 'syncing') this.emit('idle');
      }
    } catch (_) {
      this.wasOffline = true;
      this.emit('offline');
    }
  }

  // ── Migração do servidor ──────────────────────────────────────────────────────
  // Garante que tabelas antigas (sem updated_at) sejam atualizadas automaticamente

  private async migrateServer() {
    // ── Garante tabela server_meta com instance_id único ─────────────────────
    await this.qServer(`
      CREATE TABLE IF NOT EXISTS server_meta (
        key_name VARCHAR(64) PRIMARY KEY,
        value    VARCHAR(255) NOT NULL
      )
    `);
    const existing = await this.qServer<any[]>(
      `SELECT value FROM server_meta WHERE key_name = 'instance_id'`
    );
    if (existing.length === 0) {
      const newId = crypto.randomUUID();
      await this.qServer(
        `INSERT INTO server_meta (key_name, value) VALUES ('instance_id', ?)`, [newId]
      );
    }

    // ── Migração de colunas updated_at nas tabelas de dados ──────────────────
    const tables = ['users', 'customers', 'materials', 'formulas'];
    for (const t of tables) {
      try {
        await this.qServer(`SELECT updated_at FROM ${t} LIMIT 1`);
      } catch (_) {
        try {
          await this.qServer(`ALTER TABLE ${t} ADD COLUMN updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP`);
        } catch (_) {}
        try {
          await this.qServer(`ALTER TABLE ${t} ADD COLUMN created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP`);
        } catch (_) {}
        try { await this.qServer(`UPDATE ${t} SET updated_at = CURRENT_TIMESTAMP`); } catch (_) {}
      }
    }
    // Novas colunas em formulas
    const newCols = [
      ['customer_phone', 'VARCHAR(20) DEFAULT ""'],
      ['pharmacist_name', 'VARCHAR(255) DEFAULT ""'],
      ['budget_number', 'VARCHAR(6) DEFAULT ""'],
      ['attendant_name', 'VARCHAR(255) DEFAULT ""'],
      ['delivery_date', 'DATE NULL'],
      ['payment_status', 'VARCHAR(20) DEFAULT ""'],
      ['payment_method', 'VARCHAR(20) NULL'],
      ['delivery_status', 'VARCHAR(20) DEFAULT ""'],
      ['cancel_reason', 'TEXT NULL'],
    ];
    for (const [col, def] of newCols) {
      try {
        await this.qServer(`SELECT ${col} FROM formulas LIMIT 1`);
      } catch (_) {
        try { await this.qServer(`ALTER TABLE formulas ADD COLUMN ${col} ${def}`); } catch (_) {}
      }
    }
    // Novos valores no ENUM de status (cancelled, delivered)
    await this.qServer(`ALTER TABLE formulas MODIFY COLUMN status ENUM('pending','completed','saved','confirmed','cancelled','delivered') NOT NULL DEFAULT 'saved'`).catch(() => {});
    // Unidade de medida dos itens (g, mcg, ui, mg)
    try {
      await this.qServer('SELECT unit FROM formula_items LIMIT 1');
    } catch (_) {
      try { await this.qServer(`ALTER TABLE formula_items ADD COLUMN unit VARCHAR(5) NOT NULL DEFAULT 'mg'`); } catch (_) {}
    }
    // Tabela de itens de orçamento (quantidade, unidade caps/ml/g, valor)
    await this.qServer(`
      CREATE TABLE IF NOT EXISTS formula_budget_items (
        id         INT AUTO_INCREMENT PRIMARY KEY,
        formula_id INT            NOT NULL,
        quantity   DECIMAL(10,3)  NOT NULL,
        unit       VARCHAR(5)     NOT NULL DEFAULT 'caps',
        value      DECIMAL(10,2)  NOT NULL DEFAULT 0,
        FOREIGN KEY (formula_id) REFERENCES formulas(id) ON DELETE CASCADE
      ) ENGINE=InnoDB
    `).catch(() => {});
  }

  // Retorna o instance_id atual do servidor
  private async getServerInstanceId(): Promise<string | null> {
    try {
      const rows = await this.qServer<any[]>(
        `SELECT value FROM server_meta WHERE key_name = 'instance_id'`
      );
      return rows[0]?.value ?? null;
    } catch (_) { return null; }
  }

  // Salva backup silencioso do cache antes de limpar
  private saveBackup() {
    try {
      if (!fs.existsSync(this.backupDir)) fs.mkdirSync(this.backupDir, { recursive: true });
      const ts = new Date().toISOString().replace(/[:.]/g, '-');
      const dest = path.join(this.backupDir, `cache_backup_${ts}.db`);
      fs.copyFileSync(this.dbPath, dest);
      // Mantém apenas os 5 backups mais recentes
      const files = fs.readdirSync(this.backupDir)
        .filter(f => f.startsWith('cache_backup_'))
        .sort()
        .reverse();
      for (const old of files.slice(5)) {
        fs.unlinkSync(path.join(this.backupDir, old));
      }
    } catch (_) { /* backup é silencioso — nunca bloqueia o sync */ }
  }

  // Limpa todos os dados do cache local (mantém só configurações de sync_meta)
  private clearCacheData() {
    this.db.exec(`
      DELETE FROM formula_items;
      DELETE FROM formulas;
      DELETE FROM materials;
      DELETE FROM customers;
      DELETE FROM users;
    `);
    // Reseta last_sync_at para forçar pull completo
    this.exec(`DELETE FROM sync_meta WHERE key = 'last_sync_at'`);
    this.save();
  }

  async syncNow(): Promise<void> {
    if (!this.pool) { this.wasOffline = true; this.emit('offline'); return; }
    this.emit('syncing');
    try {
      await this.migrateServer();

      // ── Detecção de banco recriado ──────────────────────────────────────────
      const serverInstanceId = await this.getServerInstanceId();
      const cachedInstanceId = this.getMeta('server_instance_id');

      if (serverInstanceId && cachedInstanceId && serverInstanceId !== cachedInstanceId) {
        // Banco foi recriado ou trocado — salva backup silencioso e limpa cache
        this.saveBackup();
        this.clearCacheData();
        // Registra novo ID
        this.setMeta('server_instance_id', serverInstanceId);
      } else if (serverInstanceId && !cachedInstanceId) {
        // Primeira conexão — apenas registra o ID, não limpa nada
        this.setMeta('server_instance_id', serverInstanceId);
      }
      // ───────────────────────────────────────────────────────────────────────

      await this.push();
      await this.pull();
      this.setMeta('last_sync_at', nowISO());
      this.wasOffline = false;
      this.emit('idle');
    } catch (e: any) {
      this.wasOffline = true;
      this.emit('error', { error: formatDbError(e) });
    }
  }

  // ── PUSH ──────────────────────────────────────────────────────────────────────

  private async push() {
    await this.pushTable('users', async (u) => {
      if (!u.server_id) {
        const r = await this.qServer<any>('INSERT IGNORE INTO users (name,username,password,role) VALUES (?,?,?,?)',
          [u.name, u.username, u.password, u.role]);
        if (r.insertId) this.exec(`UPDATE users SET server_id=?, sync_status='synced' WHERE id=?`, [r.insertId, u.id]);
        else {
          // Username já existe no servidor — tenta achar pelo username
          const existing = await this.qServer<any[]>('SELECT id FROM users WHERE username=?', [u.username]);
          if (existing.length > 0) this.exec(`UPDATE users SET server_id=?, sync_status='synced' WHERE id=?`, [existing[0].id, u.id]);
        }
      } else {
        await this.qServer('UPDATE users SET name=?, username=?, password=?, role=? WHERE id=?',
          [u.name, u.username, u.password, u.role, u.server_id]);
        this.exec(`UPDATE users SET sync_status='synced' WHERE id=?`, [u.id]);
      }
    }, async (u) => {
      if (u.server_id) await this.qServer('DELETE FROM users WHERE id=?', [u.server_id]);
      this.exec('DELETE FROM users WHERE id=?', [u.id]);
    });

    await this.pushTable('customers', async (c) => {
      if (!c.server_id) {
        const r = c.created_at
          ? await this.qServer<any>('INSERT IGNORE INTO customers (name,phone,created_at) VALUES (?,?,?)',
              [c.name, c.phone, c.created_at])
          : await this.qServer<any>('INSERT IGNORE INTO customers (name,phone) VALUES (?,?)',
              [c.name, c.phone]);
        if (r.insertId) {
          this.exec(`UPDATE customers SET server_id=?, sync_status='synced' WHERE id=?`, [r.insertId, c.id]);
        } else {
          // Celular já existe no servidor — vincula ao registro existente
          const existing = await this.qServer<any[]>('SELECT id FROM customers WHERE phone=?', [c.phone]);
          if (existing.length > 0) this.exec(`UPDATE customers SET server_id=?, sync_status='synced' WHERE id=?`, [existing[0].id, c.id]);
        }
      } else {
        await this.qServer('UPDATE customers SET name=?,phone=? WHERE id=?', [c.name, c.phone, c.server_id]);
        this.exec(`UPDATE customers SET sync_status='synced' WHERE id=?`, [c.id]);
      }
    }, async (c) => {
      if (c.server_id) await this.qServer('DELETE FROM customers WHERE id=?', [c.server_id]);
      this.exec('DELETE FROM customers WHERE id=?', [c.id]);
    });

    await this.pushTable('materials', async (m) => {
      if (!m.server_id) {
        const r = await this.qServer<any>('INSERT IGNORE INTO materials (name) VALUES (?)', [m.name]);
        if (r.insertId) this.exec(`UPDATE materials SET server_id=?, sync_status='synced' WHERE id=?`, [r.insertId, m.id]);
      } else {
        await this.qServer('UPDATE materials SET name=? WHERE id=?', [m.name, m.server_id]);
        this.exec(`UPDATE materials SET sync_status='synced' WHERE id=?`, [m.id]);
      }
    }, async (m) => {
      if (m.server_id) await this.qServer('DELETE FROM materials WHERE id=?', [m.server_id]);
      this.exec('DELETE FROM materials WHERE id=?', [m.id]);
    });

    await this.pushFormulas();
    this.save();
  }

  private async pushTable(
    table: string,
    onPending: (row: any) => Promise<void>,
    onDeleted: (row: any) => Promise<void>
  ) {
    const pending = this.query(`SELECT * FROM ${table} WHERE sync_status='pending'`);
    for (const row of pending) {
      try { await onPending(row); } catch (_) {}
    }
    const deleted = this.query(`SELECT * FROM ${table} WHERE sync_status='deleted'`);
    for (const row of deleted) {
      try { await onDeleted(row); } catch (_) {}
    }
  }

  private async pushFormulas() {
    const pending = this.query(`SELECT * FROM formulas WHERE sync_status='pending'`);

    for (const f of pending) {
      try {
        const items = this.query('SELECT * FROM formula_items WHERE formula_id=?', [f.id]);
        const budgetItems = this.query('SELECT * FROM formula_budget_items WHERE formula_id=?', [f.id]);

        if (!f.server_id) {
          const cust = this.queryOne<any>('SELECT server_id FROM customers WHERE id=?', [f.customer_id]);
          if (!cust?.server_id) continue;

          const conn = await this.pool!.getConnection();
          try {
            await conn.beginTransaction();
            const [fRes]: any = await conn.query(
              'INSERT INTO formulas (customer_id, status, created_at, customer_phone, pharmacist_name, budget_number, attendant_name, delivery_date, payment_status, payment_method, delivery_status, cancel_reason) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',
              [cust.server_id, f.status, f.created_at, f.customer_phone ?? '', f.pharmacist_name ?? '',
               f.budget_number ?? '', f.attendant_name ?? '', f.delivery_date ?? null,
               f.payment_status ?? '', f.payment_method ?? null, f.delivery_status ?? '', f.cancel_reason ?? null]
            );
            for (const item of items) {
              const mat = this.queryOne<any>('SELECT server_id FROM materials WHERE id=?', [item.material_id]);
              if (!mat?.server_id) continue;
              await conn.query(
                'INSERT INTO formula_items (formula_id, material_id, quantity, unit) VALUES (?,?,?,?)',
                [fRes.insertId, mat.server_id, item.quantity, item.unit ?? 'mg']
              );
            }
            for (const bi of budgetItems) {
              await conn.query(
                'INSERT INTO formula_budget_items (formula_id, quantity, unit, value) VALUES (?,?,?,?)',
                [fRes.insertId, bi.quantity, bi.unit ?? 'caps', bi.value ?? 0]
              );
            }
            await conn.commit();
            this.exec(`UPDATE formulas SET server_id=?, sync_status='synced' WHERE id=?`, [fRes.insertId, f.id]);
          } catch (e) {
            await conn.rollback();
          } finally {
            conn.release();
          }
        } else {
          // Fórmula já existe no servidor — atualiza a fórmula completa e filhos
          const cust = this.queryOne<any>('SELECT server_id FROM customers WHERE id=?', [f.customer_id]);
          const conn = await this.pool!.getConnection();
          try {
            await conn.beginTransaction();
            await conn.query(
              `UPDATE formulas SET customer_id=?, customer_phone=?, pharmacist_name=?, budget_number=?, attendant_name=?, delivery_date=?, payment_status=?, payment_method=?, delivery_status=?, cancel_reason=?, status=?, updated_at=NOW() WHERE id=?`,
              [cust?.server_id ?? null, f.customer_phone ?? '', f.pharmacist_name ?? '',
               f.budget_number ?? '', f.attendant_name ?? '', f.delivery_date ?? null,
               f.payment_status ?? '', f.payment_method ?? null, f.delivery_status ?? '',
               f.cancel_reason ?? null, f.status, f.server_id]
            );
            await conn.query('DELETE FROM formula_items WHERE formula_id=?', [f.server_id]);
            for (const item of items) {
              const mat = this.queryOne<any>('SELECT server_id FROM materials WHERE id=?', [item.material_id]);
              if (!mat?.server_id) continue;
              await conn.query(
                'INSERT INTO formula_items (formula_id, material_id, quantity, unit) VALUES (?,?,?,?)',
                [f.server_id, mat.server_id, item.quantity, item.unit ?? 'mg']
              );
            }
            await conn.query('DELETE FROM formula_budget_items WHERE formula_id=?', [f.server_id]);
            for (const bi of budgetItems) {
              await conn.query(
                'INSERT INTO formula_budget_items (formula_id, quantity, unit, value) VALUES (?,?,?,?)',
                [f.server_id, bi.quantity, bi.unit ?? 'caps', bi.value ?? 0]
              );
            }
            await conn.commit();
            this.exec(`UPDATE formulas SET sync_status='synced' WHERE id=?`, [f.id]);
          } catch (e) {
            await conn.rollback();
          } finally {
            conn.release();
          }
        }
      } catch (_) {}
    }

    const deleted = this.query(`SELECT * FROM formulas WHERE sync_status='deleted'`);
    for (const f of deleted) {
      try {
        if (f.server_id) await this.qServer('DELETE FROM formulas WHERE id=?', [f.server_id]);
        this.exec('DELETE FROM formulas WHERE id=?', [f.id]);
      } catch (_) {}
    }
  }

  // ── PULL ──────────────────────────────────────────────────────────────────────

  private async pull() {
    const lastSync = this.getMeta('last_sync_at');
    const isFirstSync = !lastSync;
    const since = lastSync
      ? new Date(lastSync).toISOString().slice(0, 19).replace('T', ' ')
      : '1970-01-01 00:00:00';

    // Na primeira sync baixa tudo; depois filtra por updated_at
    const dateFilter = isFirstSync ? '' : 'WHERE updated_at > ?';
    const dateParam = isFirstSync ? [] : [since];

    const users = await this.qServer<any[]>(
      `SELECT id,name,username,password,role FROM users ${dateFilter}`, dateParam
    );
    for (const u of users) {
      const exists = this.queryOne('SELECT id FROM users WHERE server_id=?', [u.id]);
      if (exists) {
        this.exec(`UPDATE users SET name=?,username=?,password=?,role=?,sync_status='synced' WHERE server_id=?`,
          [u.name, u.username, u.password, u.role, u.id]);
      } else {
        try { this.exec(`INSERT INTO users (server_id,name,username,password,role,sync_status) VALUES (?,?,?,?,?,'synced')`,
          [u.id, u.name, u.username, u.password, u.role]); } catch (_) {}
      }
    }

    const customers = await this.qServer<any[]>(
      `SELECT id,name,phone,created_at FROM customers ${dateFilter}`, dateParam
    );
    for (const c of customers) {
      const exists = this.queryOne('SELECT id FROM customers WHERE server_id=?', [c.id]);
      if (exists) {
        this.exec(`UPDATE customers SET name=?,phone=?,created_at=?,sync_status='synced' WHERE server_id=?`,
          [c.name, c.phone, c.created_at, c.id]);
      } else {
        try { this.exec(`INSERT INTO customers (server_id,name,phone,created_at,sync_status) VALUES (?,?,?,?,'synced')`,
          [c.id, c.name, c.phone, c.created_at]); } catch (_) {}
      }
    }

    const materials = await this.qServer<any[]>(
      `SELECT id,name FROM materials ${dateFilter}`, dateParam
    );
    for (const m of materials) {
      const exists = this.queryOne('SELECT id FROM materials WHERE server_id=?', [m.id]);
      if (exists) {
        this.exec(`UPDATE materials SET name=?,sync_status='synced' WHERE server_id=?`, [m.name, m.id]);
      } else {
        try { this.exec(`INSERT INTO materials (server_id,name,sync_status) VALUES (?,?,'synced')`, [m.id, m.name]); } catch (_) {}
      }
    }

    const formulaFilter = isFirstSync ? '' : 'WHERE f.updated_at > ?';
    const formulas = await this.qServer<any[]>(`
      SELECT f.id, f.customer_id, f.status, f.created_at,
             COALESCE(f.customer_phone,'') AS customer_phone,
             COALESCE(f.pharmacist_name,'') AS pharmacist_name,
             COALESCE(f.budget_number,'') AS budget_number,
             COALESCE(f.attendant_name,'') AS attendant_name,
             f.delivery_date AS delivery_date,
             COALESCE(f.payment_status,'') AS payment_status,
             f.payment_method AS payment_method,
             COALESCE(f.delivery_status,'') AS delivery_status,
             f.cancel_reason AS cancel_reason,
             c.name AS customer_name
      FROM formulas f JOIN customers c ON f.customer_id = c.id
      ${formulaFilter}`, dateParam);

    for (const f of formulas) {
      const localCust = this.queryOne<any>('SELECT id FROM customers WHERE server_id=?', [f.customer_id]);
      const exists = this.queryOne('SELECT id FROM formulas WHERE server_id=?', [f.id]);

      if (exists) {
        this.exec(`UPDATE formulas SET customer_id=?,customer_name=?,customer_phone=?,pharmacist_name=?,budget_number=?,attendant_name=?,delivery_date=?,payment_status=?,payment_method=?,delivery_status=?,cancel_reason=?,status=?,sync_status='synced' WHERE server_id=?`,
          [localCust?.id ?? 0, f.customer_name, f.customer_phone ?? '', f.pharmacist_name ?? '',
           f.budget_number ?? '', f.attendant_name ?? '', f.delivery_date ?? null,
           f.payment_status ?? '', f.payment_method ?? null, f.delivery_status ?? '',
           f.cancel_reason ?? null, f.status, f.id]);

        const localFId = exists.id;
        const items = await this.qServer<any[]>(`
          SELECT fi.material_id, fi.quantity, fi.unit, m.name AS material_name
          FROM formula_items fi JOIN materials m ON fi.material_id = m.id
          WHERE fi.formula_id=?`, [f.id]);
        this.exec(`DELETE FROM formula_items WHERE formula_id=?`, [localFId]);
        for (const item of items) {
          const localMat = this.queryOne<any>('SELECT id FROM materials WHERE server_id=?', [item.material_id]);
          this.exec(`INSERT INTO formula_items (formula_id,material_id,material_name,quantity,unit) VALUES (?,?,?,?,?)`,
            [localFId, localMat?.id ?? null, item.material_name, item.quantity, item.unit ?? 'mg']);
        }

        const budgetItems = await this.qServer<any[]>(
          `SELECT quantity, unit, value FROM formula_budget_items WHERE formula_id=?`, [f.id]
        );
        this.exec(`DELETE FROM formula_budget_items WHERE formula_id=?`, [localFId]);
        for (const bi of budgetItems) {
          this.exec(`INSERT INTO formula_budget_items (formula_id,quantity,unit,value) VALUES (?,?,?,?)`,
            [localFId, bi.quantity, bi.unit ?? 'caps', bi.value ?? 0]);
        }
      } else {
        try {
          this.exec(`INSERT INTO formulas (server_id,customer_id,customer_name,customer_phone,pharmacist_name,budget_number,attendant_name,delivery_date,payment_status,payment_method,delivery_status,cancel_reason,status,sync_status,created_at,updated_at)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,'synced',?,datetime('now'))`,
            [f.id, localCust?.id ?? 0, f.customer_name, f.customer_phone ?? '', f.pharmacist_name ?? '',
             f.budget_number ?? '', f.attendant_name ?? '', f.delivery_date ?? null,
             f.payment_status ?? '', f.payment_method ?? null, f.delivery_status ?? '',
             f.cancel_reason ?? null, f.status, f.created_at]);

          const localFId = this.queryOne<any>('SELECT id FROM formulas WHERE server_id=?', [f.id])?.id;
          if (localFId) {
            const items = await this.qServer<any[]>(`
              SELECT fi.material_id, fi.quantity, fi.unit, m.name AS material_name
              FROM formula_items fi JOIN materials m ON fi.material_id = m.id
              WHERE fi.formula_id=?`, [f.id]);

            for (const item of items) {
              const localMat = this.queryOne<any>('SELECT id FROM materials WHERE server_id=?', [item.material_id]);
              this.exec(`INSERT INTO formula_items (formula_id,material_id,material_name,quantity,unit) VALUES (?,?,?,?,?)`,
                [localFId, localMat?.id ?? null, item.material_name, item.quantity, item.unit ?? 'mg']);
            }

            const budgetItems = await this.qServer<any[]>(
              `SELECT quantity, unit, value FROM formula_budget_items WHERE formula_id=?`, [f.id]
            );
            for (const bi of budgetItems) {
              this.exec(`INSERT INTO formula_budget_items (formula_id,quantity,unit,value) VALUES (?,?,?,?)`,
                [localFId, bi.quantity, bi.unit ?? 'caps', bi.value ?? 0]);
            }
          }
        } catch (_) {}
      }
    }

    this.save();
  }
}
