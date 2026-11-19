import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import app from './app.js';
import { pool } from './config/db.js';
import { createToken } from './utils/token.js';
import { buildReport, reportRange } from './services/reportService.js';

let server;
let baseURL;
before(async () => {
  server = app.listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  baseURL = `http://127.0.0.1:${server.address().port}`;
});
after(async () => {
  if (server?.listening) await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
});

async function request(method, url, { body, token } = {}) {
  const response = await fetch(`${baseURL}${url}`, {
    method, body,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' })
    }
  });
  return { status: response.status, body: await response.json() };
}

test('routers retain health, authentication, validation, and access checks', async () => {
  const previousSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = 'backend-refactor-test-secret';
  const originalQuery = pool.query;
  const originalError = console.error;
  try {
    const token = createToken('00000000-0000-4000-8000-000000000001');
    pool.query = async () => { throw new Error('Unexpected database access'); };
    assert.deepEqual(await request('GET', '/api/health'), { status: 200, body: { status: 'ok' } });
    for (const path of ['/api/auth/me', '/api/readings', '/api/reports', '/api/doctor/patients']) {
      assert.equal((await request('GET', path)).status, 401, path);
    }
    assert.equal((await request('POST', '/api/auth/signup', { body: '{}' })).status, 400);
    assert.equal((await request('POST', '/api/auth/login', { body: '{}' })).status, 400);
    assert.equal((await request('POST', '/api/readings', { token, body: '{}' })).status, 400);
    assert.equal((await request('GET', '/api/readings?page=0', { token })).status, 400);
    assert.equal((await request('PUT', '/api/readings/invalid', { token, body: '{}' })).status, 400);
    assert.equal((await request('DELETE', '/api/readings/invalid', { token })).status, 400);
    assert.equal((await request('GET', '/api/reports?date=invalid', { token })).status, 400);
    pool.query = async () => ({ rows: [{ role: 'patient' }] });
    assert.equal((await request('GET', '/api/doctor/patients', { token })).status, 403);
    pool.query = async () => ({ rows: [{ role: 'doctor' }] });
    assert.equal((await request('GET', '/api/doctor/patients/invalid/reports', { token })).status, 400);
    console.error = () => {};
    const malformed = await request('POST', '/api/auth/login', { body: '{' });
    assert.deepEqual(malformed, { status: 400, body: { error: 'Request body must be valid JSON.' } });
  } finally {
    pool.query = originalQuery;
    console.error = originalError;
    if (previousSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previousSecret;
  }
});

test('report service preserves calendar ranges and aggregate responses', async () => {
  assert.deepEqual(reportRange('daily', '2026-01-15'), { start: '2026-01-15', end: '2026-01-15' });
  assert.deepEqual(reportRange('mtd', '2026-01-15'), { start: '2026-01-01', end: '2026-01-15' });
  assert.deepEqual(reportRange('monthly', '2026-01-15'), { start: '2025-12-01', end: '2025-12-31' });
  assert.deepEqual(reportRange('monthly', '2024-03-01'), { start: '2024-02-01', end: '2024-02-29' });
  const originalQuery = pool.query;
  try {
    const readings = [{ value: 100 }, { value: 121 }];
    pool.query = async (_sql, params) => {
      assert.deepEqual(params, ['patient-id', '2026-01-15', '2026-01-15']);
      return { rows: readings };
    };
    assert.deepEqual(await buildReport('patient-id', 'daily', '2026-01-15'), {
      range: 'daily', start: '2026-01-15', end: '2026-01-15', count: 2,
      highest: 121, lowest: 100, average: 110.5, readings
    });
    pool.query = async () => ({ rows: [] });
    const empty = await buildReport('patient-id', 'daily', '2026-01-15');
    assert.equal(empty.count, 0);
    assert.equal(empty.highest, null);
    assert.equal(empty.lowest, null);
    assert.equal(empty.average, null);
  } finally { pool.query = originalQuery; }
});
