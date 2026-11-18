import { z } from 'zod';

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}, 'Expected a valid calendar date.');
const localTodayISO = () => {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
};

const readingSchema = z.object({
  id: z.string().uuid(),
  date: dateSchema,
  slot: z.enum(['morning', 'breakfast', 'lunch', 'dinner']),
  value: z.preprocess(value => typeof value === 'string' ? Number(value) : value, z.number().int().min(40).max(600))
});

export const readingFormSchema = z.object({
  date: dateSchema.refine(value => value <= localTodayISO(), 'Date cannot be in the future.'),
  slot: z.enum(['morning', 'breakfast', 'lunch', 'dinner'], { error: 'Please select a valid time slot.' }),
  value: z.preprocess(
    value => value === '' || value === undefined ? undefined : Number(value),
    z.number({ error: 'Please enter a glucose value.' })
      .int({ error: 'Value must be a whole number between 40 and 600 mg/dL.' })
      .min(40, { error: 'Value must be between 40 and 600 mg/dL.' })
      .max(600, { error: 'Value must be between 40 and 600 mg/dL.' })
  )
});

export const readingsResponseSchema = z.object({
  readings: z.array(readingSchema),
  pagination: z.object({
    page: z.number().int().positive(),
    limit: z.number().int().positive().max(100),
    total: z.number().int().nonnegative(),
    totalPages: z.number().int().nonnegative()
  })
});

export const doctorPatientsResponseSchema = z.object({
  patients: z.array(z.object({ id: z.string().uuid(), name: z.string().min(1) }))
});

export const reportResponseSchema = z.object({
  range: z.enum(['daily', 'mtd', 'monthly']),
  start: dateSchema,
  end: dateSchema,
  count: z.number().int().nonnegative(),
  highest: z.number().nullable(),
  lowest: z.number().nullable(),
  average: z.number().nullable(),
  readings: z.array(readingSchema)
});

export function validateResponse(schema, data, label) {
  const result = schema.safeParse(data);
  if (!result.success) {
    console.error(`Invalid ${label} response`, result.error.issues);
    throw new Error(`The ${label} data could not be validated. Please refresh and try again.`);
  }
  return result.data;
}
