import { z } from 'zod';

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}, 'Expected a valid calendar date.');

const readingSchema = z.object({
  id: z.string().uuid(),
  date: dateSchema,
  slot: z.enum(['morning', 'breakfast', 'lunch', 'dinner']),
  value: z.preprocess(value => typeof value === 'string' ? Number(value) : value, z.number().int().min(40).max(600))
});

export const readingsResponseSchema = z.object({ readings: z.array(readingSchema) });

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
