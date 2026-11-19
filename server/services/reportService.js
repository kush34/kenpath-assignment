import { pool } from '../config/db.js';
import { slotOrder } from '../utils/readings.js';

export function reportRange(range, date) {
  const selected = new Date(`${date}T00:00:00Z`);
  let start = date, end = date;
  if (range === 'mtd') start = `${date.slice(0, 7)}-01`;
  if (range === 'monthly') {
    const firstOfSelectedMonth = new Date(Date.UTC(selected.getUTCFullYear(), selected.getUTCMonth(), 1));
    end = new Date(firstOfSelectedMonth.getTime() - 86400000).toISOString().slice(0, 10);
    start = `${end.slice(0, 7)}-01`;
  }
  return { start, end };
}

export async function buildReport(userId, range, date) {
  const { start, end } = reportRange(range, date);
  const { rows } = await pool.query(
    `SELECT id, reading_date::text AS date, slot, value FROM readings WHERE user_id = $1 AND reading_date BETWEEN $2::date AND $3::date ORDER BY reading_date, ${slotOrder}`,
    [userId, start, end]
  );
  const values = rows.map(row => Number(row.value));
  const count = values.length;
  return {
    range, start, end, count,
    highest: count ? Math.max(...values) : null,
    lowest: count ? Math.min(...values) : null,
    average: count ? Number((values.reduce((sum, value) => sum + value, 0) / count).toFixed(1)) : null,
    readings: rows
  };
}
