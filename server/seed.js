import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { initializeDatabase, pool } from './db.js';
import { todayISO } from '../client/src/date.js';

const patients = [
  { name: 'Maya Patel', email: 'demo@sweety.local', baseline: 104 },
  { name: 'Arjun Rao', email: 'arjun.rao@sweety.local', baseline: 112 },
  { name: 'Priya Nair', email: 'priya.nair@sweety.local', baseline: 99 },
  { name: 'Daniel Kim', email: 'daniel.kim@sweety.local', baseline: 118 },
  { name: 'Aisha Khan', email: 'aisha.khan@sweety.local', baseline: 108 }
];
const slots = ['morning', 'breakfast', 'lunch', 'dinner'];

const seedToday = todayISO();

function dateDaysAgo(days) {
  const date = new Date(`${seedToday}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

function sampleValue(baseline, patientIndex, dayIndex, slotIndex) {
  const variation = Math.round(
    Math.sin((dayIndex + 1) * (patientIndex + 2) * 0.71 + slotIndex) * 17
      + Math.cos(dayIndex * 0.37 + slotIndex * 1.2 + patientIndex) * 11
  );
  const mealEffect = [0, 17, 11, 8][slotIndex];
  return Math.min(190, Math.max(72, baseline + variation + mealEffect));
}

try {
  await initializeDatabase();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const patientPasswordHash = await bcrypt.hash('SweetyDemo123!', 12);
    const doctorPasswordHash = await bcrypt.hash('SweetyDoctor123!', 12);
    const { rows: doctorRows } = await client.query(
      `INSERT INTO users (name, email, password_hash, role)
       VALUES ('Demo Doctor', 'doctor@sweety.local', $1, 'doctor')
       ON CONFLICT (email) DO UPDATE
         SET name = EXCLUDED.name, password_hash = EXCLUDED.password_hash, role = 'doctor'
       RETURNING id`,
      [doctorPasswordHash]
    );

    const patientIds = [];
    for (const patient of patients) {
      const { rows } = await client.query(
        `INSERT INTO users (name, email, password_hash, role)
         VALUES ($1, $2, $3, 'patient')
         ON CONFLICT (email) DO UPDATE
           SET name = EXCLUDED.name, password_hash = EXCLUDED.password_hash, role = 'patient'
         RETURNING id`,
        [patient.name, patient.email, patientPasswordHash]
      );
      patientIds.push(rows[0].id);
    }

    await client.query('DELETE FROM readings WHERE user_id = ANY($1::uuid[])', [patientIds]);
    const readingUsers = [];
    const readingDates = [];
    const readingSlots = [];
    const readingValues = [];
    patients.forEach((patient, patientIndex) => {
      for (let dayIndex = 0; dayIndex < 60; dayIndex += 1) {
        slots.forEach((slot, slotIndex) => {
          readingUsers.push(patientIds[patientIndex]);
          readingDates.push(dateDaysAgo(dayIndex));
          readingSlots.push(slot);
          readingValues.push(sampleValue(patient.baseline, patientIndex, dayIndex, slotIndex));
        });
      }
    });
    await client.query(
      `INSERT INTO readings (user_id, reading_date, slot, value)
       SELECT seeded.user_id, seeded.reading_date::date, seeded.slot, seeded.value
       FROM unnest($1::uuid[], $2::text[], $3::text[], $4::int[])
         AS seeded(user_id, reading_date, slot, value)`,
      [readingUsers, readingDates, readingSlots, readingValues]
    );

    await client.query(
      `INSERT INTO doctor_patient_assignments (doctor_id, patient_id)
       SELECT $1, patient_id FROM unnest($2::uuid[]) AS assigned(patient_id)
       ON CONFLICT DO NOTHING`,
      [doctorRows[0].id, patientIds]
    );
    await client.query('COMMIT');
    console.log(`Seeded ${patients.length} demo patients with 60 days of synthetic readings each and assigned them to doctor@sweety.local.`);
    console.log('Patient login: use each listed email with password SweetyDemo123!.');
    console.log('Doctor login: doctor@sweety.local / SweetyDoctor123!.');
    console.log(`Patients: ${patients.map(({ name, email }) => `${name} (${email})`).join(', ')}`);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
} catch (error) {
  console.error('Could not seed the database:', error.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
