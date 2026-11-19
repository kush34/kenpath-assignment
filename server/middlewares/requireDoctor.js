import { pool } from '../config/db.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const requireDoctor = asyncHandler(async (req, res, next) => {
  const { rows } = await pool.query('SELECT role FROM users WHERE id = $1', [req.userId]);
  if (rows[0]?.role !== 'doctor') return res.status(403).json({ error: 'Doctor access is required.' });
  return next();
});
