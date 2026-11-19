import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const { Pool } = pg;

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });
pool.on('error', error => console.error('Unexpected PostgreSQL pool error:', error));

export async function initializeDatabase() {
  await pool.query('CREATE EXTENSION IF NOT EXISTS pgcrypto');
  const schemaPath = new URL('../schema.sql', import.meta.url);
  const schema = await readFile(fileURLToPath(schemaPath), 'utf8');
  await pool.query(schema);
}
