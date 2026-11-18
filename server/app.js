import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import { pool } from './db.js';
import { createToken, requireAuth } from './auth.js';
import { isValidEmail, validateReading } from './validation.js';

const app = express();
const route = handler => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
const slotOrder = "CASE slot WHEN 'morning' THEN 1 WHEN 'breakfast' THEN 2 WHEN 'lunch' THEN 3 ELSE 4 END";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

app.use(cors({ origin: process.env.CLIENT_ORIGIN?.split(',').map(value => value.trim()) || 'http://localhost:5173' }));
app.use(express.json({ limit: '32kb' }));

app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

app.post('/api/auth/signup', route(async (req, res) => {
  const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const password = req.body?.password;
  const errors = {};
  if (!name) errors.name = 'Please enter your name.';
  else if (name.length > 80) errors.name = 'Name must be 80 characters or fewer.';
  if (!isValidEmail(email)) errors.email = 'Please enter a valid email address.';
  if (typeof password !== 'string' || password.length < 8) errors.password = 'Password must be at least 8 characters.';
  else if (password.length > 72) errors.password = 'Password must be 72 characters or fewer.';
  if (Object.keys(errors).length) return res.status(400).json({ error: 'Please check the form.', errors });

  const passwordHash = await bcrypt.hash(password, 12);
  try {
    const { rows } = await pool.query(
      'INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING id, name, email',
      [name, email, passwordHash]
    );
    const user = rows[0];
    return res.status(201).json({ token: createToken(user.id), user });
  } catch (error) {
    if (error.code === '23505') return res.status(409).json({ error: 'An account with that email already exists.', errors: { email: 'This email is already registered.' } });
    throw error;
  }
}));

app.post('/api/auth/login', route(async (req, res) => {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const password = req.body?.password;
  if (!isValidEmail(email) || typeof password !== 'string' || !password) {
    return res.status(400).json({ error: 'Enter your email and password.' });
  }
  const { rows } = await pool.query('SELECT id, name, email, password_hash FROM users WHERE email = $1', [email]);
  const user = rows[0];
  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    return res.status(401).json({ error: 'Email or password is incorrect.' });
  }
  return res.json({ token: createToken(user.id), user: { id: user.id, name: user.name, email: user.email } });
}));

app.get('/api/auth/me', requireAuth, route(async (req, res) => {
  const { rows } = await pool.query('SELECT id, name, email FROM users WHERE id = $1', [req.userId]);
  if (!rows[0]) return res.status(401).json({ error: 'Account not found. Please log in again.' });
  return res.json({ user: rows[0] });
}));

app.get('/api/readings', requireAuth, route(async (req, res) => {
  const { date } = req.query;
  if (date !== undefined && validateReading({ date, slot: 'morning', value: 40 }).errors.date) {
    return res.status(400).json({ error: 'Please enter a valid date.' });
  }
  const params = [req.userId];
  const dateFilter = date ? (params.push(date), ` AND reading_date = $${params.length}::date`) : '';
  const { rows } = await pool.query(
    `SELECT id, reading_date::text AS date, slot, value, created_at, updated_at FROM readings WHERE user_id = $1${dateFilter} ORDER BY reading_date DESC, ${slotOrder}`,
    params
  );
  return res.json({ readings: rows });
}));

app.post('/api/readings', requireAuth, route(async (req, res) => {
  const checked = validateReading(req.body);
  if (Object.keys(checked.errors).length) return res.status(400).json({ error: 'Please check the reading.', errors: checked.errors });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))', [req.userId, checked.date]);
    const { rows: dayRows } = await client.query('SELECT slot FROM readings WHERE user_id = $1 AND reading_date = $2::date', [req.userId, checked.date]);
    if (dayRows.length >= 4) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'You can add only 4 readings per day.', errors: { slot: 'You can add only 4 readings per day.' } });
    }
    const duplicate = dayRows.some(row => row.slot === checked.slot);
    if (duplicate) {
      await client.query('ROLLBACK');
      const title = slotTitle(checked.slot);
      return res.status(409).json({ error: `You already have ${title.startsWith('After') ? 'an' : 'a'} ${title} reading for this date.`, errors: { slot: `You already have ${title.startsWith('After') ? 'an' : 'a'} ${title} reading for this date.` } });
    }
    const { rows } = await client.query(
      'INSERT INTO readings (user_id, reading_date, slot, value) VALUES ($1, $2::date, $3, $4) RETURNING id, reading_date AS date, slot, value, created_at, updated_at',
      [req.userId, checked.date, checked.slot, checked.value]
    );
    await client.query('COMMIT');
    return res.status(201).json({ reading: rows[0] });
  } catch (error) {
    await client.query('ROLLBACK');
    if (error.code === '23505') return res.status(409).json({ error: 'A reading already exists for this time slot and date.' });
    throw error;
  } finally {
    client.release();
  }
}));

app.put('/api/readings/:id', requireAuth, route(async (req, res) => {
  if (!UUID_PATTERN.test(req.params.id)) return res.status(400).json({ error: 'Please enter a valid reading ID.' });
  const checked = validateReading(req.body);
  if (Object.keys(checked.errors).length) return res.status(400).json({ error: 'Please check the reading.', errors: checked.errors });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: existingRows } = await client.query(
      'SELECT id, reading_date::text AS date FROM readings WHERE id = $1 AND user_id = $2 FOR UPDATE',
      [req.params.id, req.userId]
    );
    const existing = existingRows[0];
    if (!existing) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Reading not found.' });
    }
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))', [req.userId, checked.date]);
    const { rows: dayRows } = await client.query('SELECT id, slot FROM readings WHERE user_id = $1 AND reading_date = $2::date', [req.userId, checked.date]);
    const duplicate = dayRows.some(row => row.id !== req.params.id && row.slot === checked.slot);
    if (duplicate) {
      await client.query('ROLLBACK');
      const title = slotTitle(checked.slot);
      return res.status(409).json({ error: `You already have ${title.startsWith('After') ? 'an' : 'a'} ${title} reading for this date.`, errors: { slot: `You already have ${title.startsWith('After') ? 'an' : 'a'} ${title} reading for this date.` } });
    }
    const dayCount = dayRows.filter(row => row.id !== req.params.id).length;
    if (dayCount >= 4) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'You can add only 4 readings per day.', errors: { slot: 'You can add only 4 readings per day.' } });
    }
    const { rows } = await client.query(
      'UPDATE readings SET reading_date = $1::date, slot = $2, value = $3, updated_at = NOW() WHERE id = $4 AND user_id = $5 RETURNING id, reading_date AS date, slot, value, created_at, updated_at',
      [checked.date, checked.slot, checked.value, req.params.id, req.userId]
    );
    await client.query('COMMIT');
    return res.json({ reading: rows[0] });
  } catch (error) {
    await client.query('ROLLBACK');
    if (error.code === '23505') return res.status(409).json({ error: 'A reading already exists for this time slot and date.' });
    throw error;
  } finally {
    client.release();
  }
}));

app.delete('/api/readings/:id', requireAuth, route(async (req, res) => {
  if (!UUID_PATTERN.test(req.params.id)) return res.status(400).json({ error: 'Please enter a valid reading ID.' });
  const { rowCount } = await pool.query('DELETE FROM readings WHERE id = $1 AND user_id = $2', [req.params.id, req.userId]);
  if (!rowCount) return res.status(404).json({ error: 'Reading not found.' });
  return res.status(204).end();
}));

app.get('/api/reports', requireAuth, route(async (req, res) => {
  const date = req.query.date || new Date().toISOString().slice(0, 10);
  const dateError = validateReading({ date, slot: 'morning', value: 40 }).errors.date;
  if (dateError) return res.status(400).json({ error: dateError });
  const range = ['daily', 'mtd', 'monthly'].includes(req.query.range) ? req.query.range : 'daily';
  const selected = new Date(`${date}T00:00:00Z`);
  let start = date, end = date;
  if (range === 'mtd') start = `${date.slice(0, 7)}-01`;
  if (range === 'monthly') {
    const firstOfSelectedMonth = new Date(Date.UTC(selected.getUTCFullYear(), selected.getUTCMonth(), 1));
    end = new Date(firstOfSelectedMonth.getTime() - 86400000).toISOString().slice(0, 10);
    start = `${end.slice(0, 7)}-01`;
  }
  const { rows } = await pool.query(
    `SELECT id, reading_date::text AS date, slot, value FROM readings WHERE user_id = $1 AND reading_date BETWEEN $2::date AND $3::date ORDER BY reading_date, ${slotOrder}`,
    [req.userId, start, end]
  );
  const values = rows.map(row => Number(row.value));
  const count = values.length;
  return res.json({
    range, start, end, count,
    highest: count ? Math.max(...values) : null,
    lowest: count ? Math.min(...values) : null,
    average: count ? Number((values.reduce((sum, value) => sum + value, 0) / count).toFixed(1)) : null,
    readings: range === 'daily' ? rows : []
  });
}));

function slotTitle(slot) {
  return ({ morning: 'Morning', breakfast: 'After breakfast', lunch: 'After lunch', dinner: 'After dinner' })[slot] || slot;
}

app.use((error, _req, res, _next) => {
  console.error(error);
  if (error.type === 'entity.parse.failed') return res.status(400).json({ error: 'Request body must be valid JSON.' });
  if (error.code === '22P02') return res.status(400).json({ error: 'Please enter a valid reading ID.' });
  return res.status(500).json({ error: 'Something went wrong. Please try again.' });
});

export default app;
