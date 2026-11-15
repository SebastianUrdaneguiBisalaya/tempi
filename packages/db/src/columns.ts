import { toUtcInstant } from '@tempi/core';
import { z } from 'zod';

/** SQLite has no boolean type: 0/1 integers in storage, booleans in the domain. */
export const booleanColumn = z.union([z.literal(0), z.literal(1)]).transform(value => value === 1);

export const toBooleanColumn = (value: boolean): 0 | 1 => (value ? 1 : 0);

/** A stored instant must already be normalized UTC (`…Z`), the only format whose text order is chronological. */
export const instantColumn = z.string().refine(value => toUtcInstant(value) === value, 'Stored instant is not normalized UTC');

/**
 * Normalizes an instant to UTC before it is written, so range queries can compare text.
 * Use cases already pass UTC; this guards the adapter against any other caller.
 */
export const toInstantColumn = (value: string): string => {
	const utc = toUtcInstant(value);
	if (utc === null) throw new Error(`Cannot store "${value}": not an ISO-8601 instant with offset`);
	return utc;
};

/** Bookkeeping fields shared by soft-deletable entities, as read back from storage. */
export const storedEntitySchema = z.object({
	createdAt: instantColumn,
	deletedAt: instantColumn.nullable(),
	id: z.string().min(1),
	updatedAt: instantColumn,
});

/**
 * Shape a row mapper returns before the domain schema validates it: every field that schema reads, values unchecked.
 * Typing the mapper with it catches misspelled fields at compile time.
 */
export type DomainFields<S extends z.ZodType> = { [K in keyof z.input<S>]: unknown };

/** Parses a row read from storage. A failure means the database is corrupt, so it throws. */
export const parseRow = <S extends z.ZodType>(schema: S, row: unknown): z.output<S> => {
	const parsed = schema.safeParse(row);
	if (!parsed.success) throw new Error(`Invalid row in database: ${z.prettifyError(parsed.error)}`);
	return parsed.data;
};

/** Port methods are async while `node:sqlite` is sync; this keeps thrown errors as rejections. */
export const defer = <T>(fn: () => T): Promise<T> => new Promise<T>(resolve => resolve(fn()));
