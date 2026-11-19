import { todayISO } from '../../client/src/date.js';

const SLOT_IDS = new Set(['morning', 'breakfast', 'lunch', 'dinner']);
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function validateReading(input, today = todayISO()) {
  const errors = {};
  const date = input?.date;
  const slot = input?.slot;
  const rawValue = input?.value;

  if (typeof date !== 'string' || !DATE_PATTERN.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00Z`)) || new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date) {
    errors.date = 'Please enter a valid date.';
  } else if (date > today) {
    errors.date = 'Date cannot be in the future.';
  }

  if (!SLOT_IDS.has(slot)) errors.slot = 'Please select a valid time slot.';

  if (rawValue === undefined || rawValue === null || rawValue === '') {
    errors.value = 'Please enter a glucose value.';
  } else if (!Number.isInteger(Number(rawValue)) || Number(rawValue) < 40 || Number(rawValue) > 600) {
    errors.value = 'Value must be between 40 and 600 mg/dL.';
  }

  return { errors, value: Number(rawValue), date, slot };
}

export function isValidEmail(email) {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}
