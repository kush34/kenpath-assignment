import { pool } from '../config/db.js';
import { validateReading } from '../validators/readingValidator.js';
import { invalidateReportCache } from '../config/cache.js';
import { slotOrder, UUID_PATTERN, slotTitle } from '../utils/readings.js';

export async function listReadings(req, res) {
  const { date } = req.query;
  if (date !== undefined && validateReading({ date, slot: 'morning', value: 40 }).errors.date) {
    return res.status(400).json({ error: 'Please enter a valid date.' });
  }
  const page = req.query.page === undefined ? 1 : Number(req.query.page);
  const limit = req.query.limit === undefined ? 20 : Number(req.query.limit);
  if (!Number.isSafeInteger(page) || page < 1 || !Number.isSafeInteger(limit) || limit < 1 || limit > 100) {
    return res.status(400).json({ error: 'Page must be positive and limit must be between 1 and 100.' });
  }
  const params = [req.userId];
  const dateFilter = date ? (params.push(date), ` AND reading_date = $${params.length}::date`) : '';
  const [{ rows }, { rows: countRows }] = await Promise.all([
    pool.query(
      `SELECT id, reading_date::text AS date, slot, value, created_at, updated_at FROM readings WHERE user_id = $1${dateFilter} ORDER BY reading_date DESC, ${slotOrder} LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, (page - 1) * limit]
    ),
    pool.query(`SELECT COUNT(*)::int AS total FROM readings WHERE user_id = $1${dateFilter}`, params)
  ]);
  const total = countRows[0].total;
  return res.json({ readings: rows, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
}

export async function createReading(req, res) {
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
    await invalidateReportCache(req.userId);
    return res.status(201).json({ reading: rows[0] });
  } catch (error) {
    await client.query('ROLLBACK');
    if (error.code === '23505') return res.status(409).json({ error: 'A reading already exists for this time slot and date.' });
    throw error;
  } finally {
    client.release();
  }
}

export async function updateReading(req, res) {
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
    await invalidateReportCache(req.userId);
    return res.json({ reading: rows[0] });
  } catch (error) {
    await client.query('ROLLBACK');
    if (error.code === '23505') return res.status(409).json({ error: 'A reading already exists for this time slot and date.' });
    throw error;
  } finally {
    client.release();
  }
}

export async function deleteReading(req, res) {
  if (!UUID_PATTERN.test(req.params.id)) return res.status(400).json({ error: 'Please enter a valid reading ID.' });
  const { rowCount } = await pool.query('DELETE FROM readings WHERE id = $1 AND user_id = $2', [req.params.id, req.userId]);
  if (!rowCount) return res.status(404).json({ error: 'Reading not found.' });
  await invalidateReportCache(req.userId);
  return res.status(204).end();
}
