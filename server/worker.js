import 'dotenv/config';
import { Queue, Worker } from 'bullmq';
import { initializeDatabase, pool } from './config/db.js';

const QUEUE_NAME = 'daily-reading-reminders';
const timezone = process.env.REMINDER_TIMEZONE || 'Asia/Kolkata';

function redisConnection() {
  if (!process.env.REDIS_URL) throw new Error('REDIS_URL is required to run the reminder worker.');
  const url = new URL(process.env.REDIS_URL);
  return {
    host: url.hostname,
    port: Number(url.port || 6379),
    username: url.username ? decodeURIComponent(url.username) : undefined,
    password: url.password ? decodeURIComponent(url.password) : undefined,
    db: url.pathname.length > 1 ? Number(url.pathname.slice(1)) : 0,
    tls: url.protocol === 'rediss:' ? {} : undefined,
    maxRetriesPerRequest: null
  };
}

function currentDateInTimezone() {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(new Date()).map(part => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

async function start() {
  await initializeDatabase();
  const connection = redisConnection();
  const queue = new Queue(QUEUE_NAME, { connection });
  const worker = new Worker(QUEUE_NAME, async () => {
    const date = currentDateInTimezone();
    const { rows } = await pool.query(
      `SELECT users.id, COUNT(readings.id)::int AS count
       FROM users LEFT JOIN readings ON readings.user_id = users.id AND readings.reading_date = $1::date
       GROUP BY users.id HAVING COUNT(readings.id) < 4`,
      [date]
    );
    for (const user of rows) {
      console.info(`[daily-reminder] user=${user.id} date=${date} readings=${user.count}/4`);
    }
    console.info(`[daily-reminder] checked ${rows.length} incomplete account(s) for ${date}`);
    return { date, incompleteAccounts: rows.length };
  }, { connection, concurrency: 1 });

  worker.on('failed', (job, error) => console.error(`Reminder job ${job?.id || ''} failed:`, error));
  // Keep the existing scheduler ID so restarting updates it instead of adding a second schedule.
  await queue.upsertJobScheduler('daily-at-nine', { pattern: '0 22 * * *', tz: timezone }, {
    name: 'log-incomplete-reading-accounts', data: {}, opts: { removeOnComplete: 100, removeOnFail: 100 }
  });
  console.info(`Daily reminder worker scheduled for 22:00 ${timezone}.`);

  let shuttingDown = false;
  const shutdown = async () => {
    if (shuttingDown) return;
    shuttingDown = true;
    await worker.close();
    await queue.close();
    await pool.end();
    process.exit(0);
  };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
}

try {
  await start();
} catch (error) {
  console.error('Could not start the reminder worker:', error.message);
  await pool.end();
  process.exitCode = 1;
}
