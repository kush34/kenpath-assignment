import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { initializeDatabase, pool } from './db.js';

function toISO(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function daysAgo(days) {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() - days);
  return toISO(date);
}

function previousMonthDay(day) {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(1);
  date.setMonth(date.getMonth() - 1);
  const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  date.setDate(Math.min(day, lastDay));
  return toISO(date);
}

try {
  await initializeDatabase();
  const passwordHash = await bcrypt.hash('SweetyDemo123!', 12);
  const { rows } = await pool.query(
    `INSERT INTO users (name, email, password_hash)
     VALUES ('Demo User', 'demo@sweety.local', $1)
     ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name, password_hash = EXCLUDED.password_hash, role = 'patient'
     RETURNING id`,
    [passwordHash]
  );
  const userId = rows[0].id;
  const doctorPasswordHash = await bcrypt.hash('SweetyDoctor123!', 12);
  const { rows: doctorRows } = await pool.query(
    `INSERT INTO users (name, email, password_hash, role)
     VALUES ('Demo Doctor', 'doctor@sweety.local', $1, 'doctor')
     ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name, password_hash = EXCLUDED.password_hash, role = 'doctor'
     RETURNING id`,
    [doctorPasswordHash]
  );
  await pool.query(
    'INSERT INTO doctor_patient_assignments (doctor_id, patient_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
    [doctorRows[0].id, userId]
  );
  await pool.query('DELETE FROM readings WHERE user_id = $1', [userId]);
  const samples = [
    [daysAgo(0), 'morning', 108], [daysAgo(0), 'breakfast', 134],
    [daysAgo(1), 'morning', 112], [daysAgo(1), 'lunch', 128],
    [daysAgo(2), 'morning', 105], [daysAgo(2), 'dinner', 139],
    [daysAgo(6), 'breakfast', 126],
    [previousMonthDay(4), 'morning', 111], [previousMonthDay(13), 'lunch', 119], [previousMonthDay(24), 'dinner', 131]
  ];
  for (const [date, slot, value] of samples) {
    await pool.query('INSERT INTO readings (user_id, reading_date, slot, value) VALUES ($1, $2::date, $3, $4)', [userId, date, slot, value]);
  }
  console.log('Seeded patient demo@sweety.local / SweetyDemo123! and doctor doctor@sweety.local / SweetyDoctor123!.');
} catch (error) {
  console.error('Could not seed the database:', error.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
