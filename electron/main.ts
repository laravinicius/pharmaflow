import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import mysql from 'mysql2/promise';
import { CacheManager } from './cache';
import { formatDbError } from './dbError';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─── Master key (modo setup offline) ─────────────────────────────────────────
const MASTER_USERNAME = process.env.SETUP_MASTER_USERNAME;
const MASTER_PASSWORD = process.env.SETUP_MASTER_PASSWORD;
const hasMasterSetupCredentials = Boolean(MASTER_USERNAME && MASTER_PASSWORD);

// ─── Config ───────────────────────────────────────────────────────────────────

const configPath = path.join(app.getPath('userData'), 'config.json');

interface DbConfig {
  host: string; port: number; user: string; password: string; database: string;
}

let dbConfig: DbConfig = {
  host: 'localhost', port: 3306, user: 'root', password: '', database: 'pharmaflow',
};

if (fs.existsSync(configPath)) {
  try { dbConfig = { ...dbConfig, ...JSON.parse(fs.readFileSync(configPath, 'utf-8')) }; }
  catch (e) { console.error('Erro ao carregar config:', e); }
}

// ─── Pool + CacheManager ──────────────────────────────────────────────────────

let pool: mysql.Pool | null = null;
const cache = new CacheManager(app.getPath('userData'));

const initPool = () => {
  if (pool) pool.end().catch(() => {});
  pool = mysql.createPool({
    host: dbConfig.host, port: dbConfig.port, user: dbConfig.user,
    password: dbConfig.password, database: dbConfig.database,
    waitForConnections: true, connectionLimit: 10, connectTimeout: 5000,
  });
  cache.setPool(pool);
};

initPool();

// ─── IPC: Auth ────────────────────────────────────────────────────────────────

ipcMain.handle('auth:login', async (_, username: string, password: string) => {
  if (hasMasterSetupCredentials && username === MASTER_USERNAME && password === MASTER_PASSWORD) {
    return {
      success: true, setupMode: true,
      user: { id: 0, name: 'Configuração', username: MASTER_USERNAME, role: 'admin' },
    };
  }
  return await cache.login(username, password);
});

ipcMain.handle('auth:bootstrap-local', async (_, username: string, password: string, name?: string) => {
  return await cache.bootstrapLocalUser(username, password, name);
});

// ─── IPC: Usuários ────────────────────────────────────────────────────────────

ipcMain.handle('users:list',   ()          => cache.listUsers());
ipcMain.handle('users:add',    (_, u)      => cache.addUser(u));
ipcMain.handle('users:update', (_, id, u)  => cache.updateUser(id, u));
ipcMain.handle('users:delete', (_, id)     => cache.deleteUser(id));

// ─── IPC: Clientes ────────────────────────────────────────────────────────────

ipcMain.handle('customers:list',   ()           => cache.listCustomers());
ipcMain.handle('customers:add',    (_, c)        => cache.addCustomer(c));
ipcMain.handle('customers:update', (_, id, c)    => cache.updateCustomer(id, c));
ipcMain.handle('customers:delete', (_, id)       => cache.deleteCustomer(id));

// ─── IPC: Matérias-Primas ─────────────────────────────────────────────────────

ipcMain.handle('materials:list',   ()        => cache.listMaterials());
ipcMain.handle('materials:add',    (_, name) => cache.addMaterial(name));
ipcMain.handle('materials:delete', (_, id)   => cache.deleteMaterial(id));

// ─── IPC: Fórmulas ────────────────────────────────────────────────────────────

ipcMain.handle('formulas:list',          ()              => cache.listFormulas());
ipcMain.handle('formulas:add',           (_, f)          => cache.addFormula(f));
ipcMain.handle('formulas:update-status', (_, id, status) => cache.updateFormulaStatus(id, status));
ipcMain.handle('formulas:delete',        (_, id)         => cache.deleteFormula(id));

// ─── IPC: Sync ────────────────────────────────────────────────────────────────

ipcMain.handle('sync:now',    async () => { await cache.syncNow(); return cache.getStatus(); });
ipcMain.handle('sync:status', ()      => cache.getStatus());

// ─── IPC: Configurações ───────────────────────────────────────────────────────

ipcMain.handle('config:get', () => {
  const { password: _p, ...safe } = dbConfig;
  return safe;
});

ipcMain.handle('config:save', (_, newConfig: Partial<DbConfig>) => {
  dbConfig = { ...dbConfig, ...newConfig };
  fs.writeFileSync(configPath, JSON.stringify(dbConfig, null, 2));
  initPool();
  return { success: true };
});

ipcMain.handle('config:test', async () => {
  try {
    await pool!.query('SELECT 1');
    return { success: true };
  } catch (e: any) {
    return { success: false, error: formatDbError(e) };
  }
});

// ─── Janela ───────────────────────────────────────────────────────────────────

let mainWindow: BrowserWindow | null = null;

const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 1280, height: 800, minWidth: 900, minHeight: 600,
    title: 'PIX Farma - Manipulação',
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      nodeIntegration: false,
      contextIsolation: true,
    },
    icon: path.join(__dirname, '../public/favicon.ico'),
  });

  // Envia status de sync para o renderer sempre que mudar
  cache.onStatus((status) => {
    mainWindow?.webContents.send('sync:status-update', status);
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }
};

app.on('ready', async () => {
  await cache.init();
  // Sync a cada 30s — seguro em LAN local com poucos registros (<1s por ciclo)
  cache.startSyncLoop(30 * 1000);
  createWindow();
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
