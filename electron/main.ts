import { app, BrowserWindow, ipcMain, nativeImage } from 'electron';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import mysql from 'mysql2/promise';
import { Db } from './db';
import { formatDbError } from './dbError';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─── Master key (modo setup) ─────────────────────────────────────────────────
const MASTER_USERNAME = 'admin';
const MASTER_PASSWORD = 'admin123';
const hasMasterSetupCredentials = true;

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

// ─── Pool + Db ────────────────────────────────────────────────────────────────

let pool: mysql.Pool | null = null;
const db = new Db();

const initPool = () => {
  if (pool) pool.end().catch(() => {});
  pool = mysql.createPool({
    host: dbConfig.host, port: dbConfig.port, user: dbConfig.user,
    password: dbConfig.password, database: dbConfig.database,
    waitForConnections: true, connectionLimit: 10, connectTimeout: 5000,
    dateStrings: true,
  });
  db.setPool(pool);
};

initPool();

// ─── IPC: Auth ────────────────────────────────────────────────────────────────

ipcMain.handle('auth:login', async (_, username: string, password: string, force = false) => {
  if (hasMasterSetupCredentials && username === MASTER_USERNAME && password === MASTER_PASSWORD) {
    return {
      success: true, setupMode: true,
      user: { id: 0, name: 'Configuração', username: MASTER_USERNAME, role: 'admin' },
    };
  }
  return await db.login(username, password, force);
});

ipcMain.handle('auth:logout', async (_, token: string) => {
  await db.revokeSession(token);
  return { success: true };
});

ipcMain.handle('session:heartbeat', async (_, token: string) => {
  return await db.heartbeat(token);
});

// Limpa sessões órfãs (app fechado sem logout / queda de energia)
setInterval(() => { db.cleanupStaleSessions().catch(() => {}); }, 60_000);

// ─── Usuários ────────────────────────────────────────────────────────────────

ipcMain.handle('users:list',   ()          => db.listUsers());
ipcMain.handle('users:add',    async (_, u)      => { const r = await db.addUser(u); if (r?.success) notifyDataChanged(); return r; });
ipcMain.handle('users:update', async (_, id, u)  => { const r = await db.updateUser(id, u); if (r?.success) notifyDataChanged(); return r; });
ipcMain.handle('users:delete', async (_, id, adminCreds, sessionToken) => { const r = await db.deleteUser(id, adminCreds, sessionToken); if (r?.success) notifyDataChanged(); return r; });

// ─── Clientes ────────────────────────────────────────────────────────────────

ipcMain.handle('customers:list',   ()           => db.listCustomers());
ipcMain.handle('customers:add',    async (_, c)        => { const r = await db.addCustomer(c); if (r?.success) notifyDataChanged(); return r; });
ipcMain.handle('customers:update', async (_, id, c)    => { const r = await db.updateCustomer(id, c); if (r?.success) notifyDataChanged(); return r; });
ipcMain.handle('customers:delete', async (_, id, adminCreds, sessionToken) => { const r = await db.deleteCustomer(id, adminCreds, sessionToken); if (r?.success) notifyDataChanged(); return r; });

// ─── Insumos ─────────────────────────────────────────────────────────────────

ipcMain.handle('insumos:list',   ()        => db.listInsumos());
ipcMain.handle('insumos:add',    async (_, name) => { const r = await db.addInsumo(name); if (r?.success) notifyDataChanged(); return r; });
ipcMain.handle('insumos:update', async (_, id, name) => { const r = await db.updateInsumo(id, name); if (r?.success) notifyDataChanged(); return r; });
ipcMain.handle('insumos:delete', async (_, id, adminCreds, sessionToken) => { const r = await db.deleteInsumo(id, adminCreds, sessionToken); if (r?.success) notifyDataChanged(); return r; });

// ─── Fórmulas ────────────────────────────────────────────────────────────────

ipcMain.handle('formulas:list',          ()              => db.listFormulas());
ipcMain.handle('formulas:add',           async (_, f)          => { const r = await db.addFormula(f); notifyDataChanged(); return r; });
ipcMain.handle('formulas:update',        async (_, id, f)      => { const r = await db.updateFormula(id, f); notifyDataChanged(); return r; });
ipcMain.handle('formulas:update-status', async (_, id, status) => { const r = await db.updateFormulaStatus(id, status); notifyDataChanged(); return r; });
ipcMain.handle('formulas:update-delivery-status', async (_, id, deliveryStatus) => { const r = await db.updateFormulaDeliveryStatus(id, deliveryStatus); notifyDataChanged(); return r; });
ipcMain.handle('formulas:delete',        async (_, id, adminCreds, sessionToken) => { const r = await db.deleteFormula(id, adminCreds, sessionToken); notifyDataChanged(); return r; });

// ─── Fórmulas Salvas ─────────────────────────────────────────────────────────

ipcMain.handle('savedFormulas:list',   ()           => db.listSavedFormulas());
ipcMain.handle('savedFormulas:add',    async (_, f)       => { const r = await db.addSavedFormula(f); if (r?.success) notifyDataChanged(); return r; });
ipcMain.handle('savedFormulas:update', async (_, id, f)   => { const r = await db.updateSavedFormula(id, f); if (r?.success) notifyDataChanged(); return r; });
ipcMain.handle('savedFormulas:delete', async (_, id, adminCreds, sessionToken) => { const r = await db.deleteSavedFormula(id, adminCreds, sessionToken); if (r?.success) notifyDataChanged(); return r; });

// ─── Configurações ───────────────────────────────────────────────────────────

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

// Avisa todas as janelas abertas que os dados mudaram (atualização ao vivo)
const notifyDataChanged = () => {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send('data:changed');
  }
};

let pendingExitConfirm = false;

const createWindow = () => {
  const iconPath = process.env.VITE_DEV_SERVER_URL
    ? path.join(__dirname, '../public/icon.ico')
    : path.join(__dirname, '../dist/icon.ico');

  const appIcon = fs.existsSync(iconPath) ? nativeImage.createFromPath(iconPath) : undefined;

  const win = new BrowserWindow({
    width: 1280, height: 800, minWidth: 900, minHeight: 600,
    title: 'PIX Farma - Manipulação',
    icon: appIcon,
    autoHideMenuBar: true,
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#243465',
      symbolColor: '#FFFFFF',
      height: 30,
    },
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  win.on('close', (event) => {
    if (!pendingExitConfirm && BrowserWindow.getAllWindows().length === 1) {
      event.preventDefault();
      win.webContents.send('app:confirm-exit', { source: 'window-close' });
    } else if (pendingExitConfirm) {
      pendingExitConfirm = false;
    }
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'));
  }
};

ipcMain.handle('app:exit-confirmed', () => {
  pendingExitConfirm = true;
  for (const win of BrowserWindow.getAllWindows()) {
    win.destroy();
  }
});

app.on('before-quit', (event) => {
  if (!pendingExitConfirm && BrowserWindow.getAllWindows().length > 0) {
    event.preventDefault();
    const win = BrowserWindow.getAllWindows()[0];
    win.webContents.send('app:confirm-exit', { source: 'window-close' });
  }
});

app.on('ready', () => {
  if (process.platform === 'win32') {
    app.setAppUserModelId('com.pharmaflow.app');
  }
  createWindow();
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
