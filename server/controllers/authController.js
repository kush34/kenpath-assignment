import bcrypt from 'bcryptjs';
import { pool } from '../config/db.js';
import { createToken } from '../utils/token.js';
import { isValidEmail } from '../validators/readingValidator.js';

export async function signup(req, res) {
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
      'INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING id, name, email, role',
      [name, email, passwordHash]
    );
    const user = rows[0];
    return res.status(201).json({ token: createToken(user.id), user });
  } catch (error) {
    if (error.code === '23505') return res.status(409).json({ error: 'An account with that email already exists.', errors: { email: 'This email is already registered.' } });
    throw error;
  }
}

export async function login(req, res) {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const password = req.body?.password;
  if (!isValidEmail(email) || typeof password !== 'string' || !password) {
    return res.status(400).json({ error: 'Enter your email and password.' });
  }
  const { rows } = await pool.query('SELECT id, name, email, role, password_hash FROM users WHERE email = $1', [email]);
  const user = rows[0];
  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    return res.status(401).json({ error: 'Email or password is incorrect.' });
  }
  return res.json({ token: createToken(user.id), user: { id: user.id, name: user.name, email: user.email, role: user.role } });
}

export async function getCurrentUser(req, res) {
  const { rows } = await pool.query('SELECT id, name, email, role FROM users WHERE id = $1', [req.userId]);
  if (!rows[0]) return res.status(401).json({ error: 'Account not found. Please log in again.' });
  return res.json({ user: rows[0] });
}
