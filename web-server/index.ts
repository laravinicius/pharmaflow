import cors from 'cors';
import express from 'express';
import mysql from 'mysql2/promise';
import { Db } from '../electron/db';
import { formatDbError } from '../electron/dbError';

const app = express();
const port = Number(process.env.PHARMAFLOW_WEB_PORT ?? 3001);
const db = new Db();

const pool = mysql.createPool({
  host: process.env.PHARMAFLOW_DB_HOST ?? 'localhost',
  port: Number(process.env.PHARMAFLOW_DB_PORT ?? 3306),
  user: process.env.PHARMAFLOW_DB_USER ?? 'root',
  password: process.env.PHARMAFLOW_DB_PASSWORD ?? '',
  database: process.env.PHARMAFLOW_DB_DATABASE ?? 'pharmaflow',
  waitForConnections: true,
  connectionLimit: 10,
  connectTimeout: 5000,
  dateStrings: true,
});

pool.on('connection', (connection) => {
  connection.query("SET time_zone = '-03:00'").catch(() => {});
});
db.setPool(pool);

app.use(cors());
app.use(express.json());

const asyncRoute = (handler: (req: any, res: any) => Promise<unknown> | unknown) =>
  async (req: any, res: any) => {
    try {
      res.json(await handler(req, res));
    } catch (error: any) {
      res.status(500).json({ success: false, error: formatDbError(error) });
    }
  };

const body = (req: any) => req.body ?? {};
const notifyChanged = (result: any) => result;

app.get('/api/health', asyncRoute(async () => {
  await pool.query('SELECT 1');
  return { success: true };
}));

app.post('/api/auth/login', asyncRoute(async (req) => {
  const { username, password, force = false } = body(req);
  if (username === 'admin' && password === 'admin123') {
    await db.logAction('Configuração', 'login', 'system', null, 'Login no modo configuração (admin/admin123).');
    return { success: true, setupMode: true, user: { id: 0, name: 'Configuração', username: 'admin', role: 'admin' } };
  }
  return db.login(username, password, force);
}));

app.post('/api/auth/logout', asyncRoute(async (req) => {
  await db.revokeSession(body(req).token);
  return { success: true };
}));

app.post('/api/session/heartbeat', asyncRoute(async (req) => db.heartbeat(body(req).token)));

setInterval(() => { db.cleanupStaleSessions().catch(() => {}); }, 60_000);

app.get('/api/users', asyncRoute(async () => db.listUsers()));
app.post('/api/users', asyncRoute(async (req) => notifyChanged(await db.addUser(body(req).user, body(req).sessionToken))));
app.put('/api/users/:id', asyncRoute(async (req) => notifyChanged(await db.updateUser(Number(req.params.id), body(req).user, body(req).sessionToken))));
app.delete('/api/users/:id', asyncRoute(async (req) => notifyChanged(await db.deleteUser(Number(req.params.id), body(req).adminCreds, body(req).sessionToken))));

app.get('/api/customers', asyncRoute(async () => db.listCustomers()));
app.post('/api/customers', asyncRoute(async (req) => notifyChanged(await db.addCustomer(body(req).customer, body(req).sessionToken))));
app.put('/api/customers/:id', asyncRoute(async (req) => notifyChanged(await db.updateCustomer(Number(req.params.id), body(req).customer, body(req).sessionToken))));
app.delete('/api/customers/:id', asyncRoute(async (req) => notifyChanged(await db.deleteCustomer(Number(req.params.id), body(req).adminCreds, body(req).sessionToken))));

app.get('/api/insumos', asyncRoute(async () => db.listInsumos()));
app.post('/api/insumos', asyncRoute(async (req) => notifyChanged(await db.addInsumo(body(req).name, body(req).sessionToken))));
app.put('/api/insumos/:id', asyncRoute(async (req) => notifyChanged(await db.updateInsumo(Number(req.params.id), body(req).name, body(req).sessionToken))));
app.delete('/api/insumos/:id', asyncRoute(async (req) => notifyChanged(await db.deleteInsumo(Number(req.params.id), body(req).adminCreds, body(req).sessionToken))));

app.get('/api/formulas', asyncRoute(async () => db.listFormulas()));
app.post('/api/formulas', asyncRoute(async (req) => notifyChanged(await db.addFormula(body(req).formula, body(req).sessionToken))));
app.put('/api/formulas/:id', asyncRoute(async (req) => notifyChanged(await db.updateFormula(Number(req.params.id), body(req).formula, body(req).sessionToken))));
app.patch('/api/formulas/:id/status', asyncRoute(async (req) => notifyChanged(await db.updateFormulaStatus(Number(req.params.id), body(req).status, body(req).sessionToken))));
app.patch('/api/formulas/:id/delivery-status', asyncRoute(async (req) => notifyChanged(await db.updateFormulaDeliveryStatus(Number(req.params.id), body(req).deliveryStatus, body(req).sessionToken))));
app.delete('/api/formulas/:id', asyncRoute(async (req) => notifyChanged(await db.deleteFormula(Number(req.params.id), body(req).adminCreds, body(req).sessionToken))));

app.get('/api/saved-formulas', asyncRoute(async () => db.listSavedFormulas()));
app.post('/api/saved-formulas', asyncRoute(async (req) => notifyChanged(await db.addSavedFormula(body(req).formula, body(req).sessionToken))));
app.put('/api/saved-formulas/:id', asyncRoute(async (req) => notifyChanged(await db.updateSavedFormula(Number(req.params.id), body(req).formula, body(req).sessionToken))));
app.delete('/api/saved-formulas/:id', asyncRoute(async (req) => notifyChanged(await db.deleteSavedFormula(Number(req.params.id), body(req).adminCreds, body(req).sessionToken))));

app.get('/api/logs', asyncRoute(async (req) => db.listLogs(req.query)));

app.listen(port, '0.0.0.0', () => {
  console.log(`Servidor web PharmaFlow disponível em http://localhost:${port}`);
});
