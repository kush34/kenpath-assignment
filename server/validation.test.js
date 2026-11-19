import test from 'node:test';
import assert from 'node:assert/strict';
import { validateReading } from './validators/readingValidator.js';
import { todayISO } from '../client/src/date.js';

const valid = { date: '2026-11-18', slot: 'morning', value: 108 };
const today = '2026-11-18';

test('uses the IST calendar date across midnight', () => {
  assert.equal(todayISO(new Date('2026-11-18T18:29:59Z')), '2026-11-18');
  const istToday = todayISO(new Date('2026-11-18T18:30:00Z'));
  assert.equal(istToday, '2026-11-19');
  assert.equal(validateReading({ ...valid, date: '2026-11-19' }, istToday).errors.date, undefined);
  assert.equal(validateReading({ ...valid, date: '2026-11-20' }, istToday).errors.date, 'Date cannot be in the future.');
});

test('accepts whole-number readings at both allowed boundaries', () => {
  for (const value of [40, 600]) {
    const result = validateReading({ ...valid, value }, today);
    assert.deepEqual(result.errors, {});
    assert.equal(result.value, value);
  }
});

test('requires a glucose value', () => {
  const result = validateReading({ ...valid, value: '' }, today);
  assert.equal(result.errors.value, 'Please enter a glucose value.');
});

test('rejects fractional and out-of-range readings with the expected message', () => {
  for (const value of [39, 600.5, 601]) {
    const result = validateReading({ ...valid, value }, today);
    assert.equal(result.errors.value, 'Value must be between 40 and 600 mg/dL.');
  }
});

test('rejects future dates and malformed calendar dates', () => {
  assert.equal(validateReading({ ...valid, date: '2026-11-19' }, today).errors.date, 'Date cannot be in the future.');
  assert.equal(validateReading({ ...valid, date: '2026-02-30' }, today).errors.date, 'Please enter a valid date.');
});

test('accepts only the four assignment time slots', () => {
  for (const slot of ['morning', 'breakfast', 'lunch', 'dinner']) {
    assert.equal(validateReading({ ...valid, slot }, today).errors.slot, undefined);
  }
  assert.equal(validateReading({ ...valid, slot: 'bedtime' }, today).errors.slot, 'Please select a valid time slot.');
});
