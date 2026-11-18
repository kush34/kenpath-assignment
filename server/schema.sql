CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'patient',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'patient';
DO $$ BEGIN
  ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('patient', 'doctor'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS doctor_patient_assignments (
  doctor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (doctor_id, patient_id),
  CONSTRAINT doctor_cannot_be_patient CHECK (doctor_id <> patient_id)
);

CREATE INDEX IF NOT EXISTS doctor_assignments_patient_idx ON doctor_patient_assignments (patient_id);

CREATE TABLE IF NOT EXISTS readings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reading_date DATE NOT NULL,
  slot TEXT NOT NULL CHECK (slot IN ('morning', 'breakfast', 'lunch', 'dinner')),
  value INTEGER NOT NULL CHECK (value BETWEEN 40 AND 600),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT one_reading_per_slot_per_day UNIQUE (user_id, reading_date, slot)
);

CREATE INDEX IF NOT EXISTS readings_user_date_idx ON readings (user_id, reading_date DESC);
