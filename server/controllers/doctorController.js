import { pool } from '../config/db.js';
import { validateReading } from '../validators/readingValidator.js';
import { todayISO } from '../../client/src/date.js';
import { getOrSetCache } from '../config/cache.js';
import { buildReport } from '../services/reportService.js';
import { UUID_PATTERN } from '../utils/readings.js';

export async function listPatients(req, res) {
  const { rows } = await pool.query(
    `SELECT users.id, users.name FROM doctor_patient_assignments
     JOIN users ON users.id = doctor_patient_assignments.patient_id AND users.role = 'patient'
     WHERE doctor_patient_assignments.doctor_id = $1 ORDER BY users.name`,
    [req.userId]
  );
  return res.json({ patients: rows });
}

export async function getPatientReport(req, res) {
  if (!UUID_PATTERN.test(req.params.patientId)) return res.status(400).json({ error: 'Please enter a valid patient ID.' });
  const { rows } = await pool.query(
    `SELECT users.id FROM doctor_patient_assignments
     JOIN users ON users.id = doctor_patient_assignments.patient_id AND users.role = 'patient'
     WHERE doctor_patient_assignments.doctor_id = $1 AND doctor_patient_assignments.patient_id = $2`,
    [req.userId, req.params.patientId]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Patient not found or not assigned to this doctor.' });
  const date = req.query.date || todayISO();
  const dateError = validateReading({ date, slot: 'morning', value: 40 }).errors.date;
  if (dateError) return res.status(400).json({ error: dateError });
  const range = ['daily', 'mtd', 'monthly'].includes(req.query.range) ? req.query.range : 'daily';
  const result = await getOrSetCache(`sweety:doctor-report:${req.userId}:${req.params.patientId}:${range}:${date}`, () => buildReport(req.params.patientId, range, date));
  return res.json(result);
}
