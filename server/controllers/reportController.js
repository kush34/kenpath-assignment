import { validateReading } from '../validators/readingValidator.js';
import { todayISO } from '../../client/src/date.js';
import { getOrSetCache } from '../config/cache.js';
import { buildReport } from '../services/reportService.js';

export async function getReport(req, res) {
  const date = req.query.date || todayISO();
  const dateError = validateReading({ date, slot: 'morning', value: 40 }).errors.date;
  if (dateError) return res.status(400).json({ error: dateError });
  const range = ['daily', 'mtd', 'monthly'].includes(req.query.range) ? req.query.range : 'daily';
  const result = await getOrSetCache(`sweety:report:${req.userId}:${range}:${date}`, () => buildReport(req.userId, range, date));
  return res.json(result);
}
