import 'dotenv/config';
import app from './app.js';
import { connectCache } from './cache.js';
import { initializeDatabase, pool } from './db.js';

const port = Number(process.env.PORT || 4000);
if (!process.env.JWT_SECRET) {
  console.error('JWT_SECRET is required. Copy .env.example to .env and set a secret.');
  process.exit(1);
}

try {
  await initializeDatabase();
  await connectCache();
  app.listen(port, () => console.log(`Sweety API listening on http://localhost:${port}`));
} catch (error) {
  console.error('Could not start the Sweety API:', error.message);
  await pool.end();
  process.exit(1);
}
