# Sweety — Blood Glucose Tracker

Sweety is a small React + Express + PostgreSQL app for recording up to four blood glucose readings per day and reviewing daily and monthly summaries. It includes account signup/login and keeps each user's readings private to their account.

## Requirements

- Node.js 20 or newer
- PostgreSQL 14 or newer

## Setup

1. Create a PostgreSQL database:

   ```sh
   createdb sweety
   ```

   Or create a database named `sweety` using your PostgreSQL client.

2. Copy the example environment file and set the connection string and a long random JWT secret:

   ```sh
   cp .env.example .env
   ```

   Update `DATABASE_URL` if your local PostgreSQL username, password, host, or database name differs. The API creates the tables on startup. The database user needs permission to create tables and the `pgcrypto` extension.

3. Install dependencies:

   ```sh
   npm install
   ```

4. Start both apps together:

   ```sh
   npm run dev
   ```

   Or run the API and frontend in separate terminals with `npm run dev:server` and `npm run dev:client`. Open [http://localhost:5173](http://localhost:5173). The API listens on [http://localhost:4000](http://localhost:4000).

## Demo account

To seed the demo doctor and five sample patient accounts:

```sh
npm run db:seed
```

- Email: `demo@sweety.local`
- Password: `SweetyDemo123!`
- Other patient emails: `arjun.rao@sweety.local`, `priya.nair@sweety.local`, `daniel.kim@sweety.local`, `aisha.khan@sweety.local`
- All patient accounts use password: `SweetyDemo123!`
- Doctor email: `doctor@sweety.local`
- Doctor password: `SweetyDoctor123!`

The doctor is assigned to all five patients: Maya Patel, Arjun Rao, Priya Nair, Daniel Kim, and Aisha Khan. Each account receives 60 days of synthetic readings across four daily time slots. Re-running the seed replaces readings only for these five sample accounts and preserves readings for other patients.

## Docker Compose

Copy `.env.example` to `.env`, set `JWT_SECRET`, then build and start the development app with PostgreSQL and Redis:

```sh
docker compose up --build
```

Open [http://localhost:5173](http://localhost:5173). Compose keeps PostgreSQL data in the `sweety_data` volume. Report results are cached for one minute and invalidated when a reading is created, edited, or deleted. A worker logs accounts below four daily readings at 09:00 in `REMINDER_TIMEZONE`. Stop the services with `docker compose down`; use `docker compose down -v` only when you also want to delete the database volume.

## Features

- Register with name, email, and password; passwords are hashed with bcrypt before storage.
- Log in and access only readings associated with the signed-in account.
- Add, view, edit, and delete dated readings for Morning (fasting), After breakfast, After lunch, and After dinner.
- Validate required values, whole-number range (40–600 mg/dL), one reading per slot/day, four readings/day, and no future dates.
- View highest, lowest, average (one decimal), and reading count for a selected day, month to date, or the whole previous month.
- Browse readings with server-side pagination and filter them to one date when needed.
- Explore daily and monthly readings in a slot-colored line chart.
- Cache report responses in Redis and clear a user's cached ranges when their readings change.
- Run a BullMQ daily job that logs accounts with fewer than four readings; it does not send messages.
- Give doctors read-only access to reports for patients assigned to them.
- Show a friendly empty state when a report has no readings.

## API overview

All reading and report endpoints require `Authorization: Bearer <token>`.

| Method | Endpoint | Purpose |
| --- | --- | --- |
| POST | `/api/auth/signup` | Create an account |
| POST | `/api/auth/login` | Sign in |
| GET | `/api/auth/me` | Get the signed-in user |
| GET | `/api/readings?page=1&limit=20&date=YYYY-MM-DD` | List a page of the user's readings; date is optional |
| POST | `/api/readings` | Add a reading |
| PUT | `/api/readings/:id` | Edit a reading |
| DELETE | `/api/readings/:id` | Delete a reading |
| GET | `/api/reports?range=daily&date=YYYY-MM-DD` | Get a daily, `mtd`, or `monthly` report |
| GET | `/api/doctor/patients` | List patients assigned to the signed-in doctor |
| GET | `/api/doctor/patients/:patientId/reports?range=daily&date=YYYY-MM-DD` | View a report for an assigned patient |

The report's `monthly` range means the entire calendar month before the selected date's month. The `mtd` range ends on the selected date.

## Build

```sh
npm run build
```

Run the focused validation tests with:

```sh
npm test
```

The test command runs API validation tests and React Testing Library tests for required, bounded, whole-number readings and successful form submission. They do not require a running database.

## Assumptions and notes

- Calendar validation uses the API server's UTC date. This keeps API validation consistent across server deployments; a production version should use an explicit per-user timezone.
- The demo readings are sample data for trying the report ranges, not medical guidance.
- The UI presents readings for personal tracking and discussion with a care team; it does not interpret results or recommend treatment.
- The frontend stores the short-lived access token in browser local storage for this assessment prototype. A production deployment should use a carefully configured secure, HTTP-only cookie and HTTPS.
- All listed bonus tasks are implemented. For this prototype, patient-to-doctor assignments are provisioned by the seed script or database administration; there is no assignment-management screen.
