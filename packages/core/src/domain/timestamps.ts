import { z } from 'zod';
import { idSchema, utcInstantSchema } from './values';

/** Sync-ready bookkeeping shared by every stored entity. All values are UTC ISO-8601. */
export const timestampsSchema = z.object({
	createdAt: utcInstantSchema,
	deletedAt: utcInstantSchema.nullable(),
	updatedAt: utcInstantSchema,
});

export type Timestamps = z.output<typeof timestampsSchema>;

/** Id and timestamps of a soft-deletable stored entity. */
export const storedEntitySchema = timestampsSchema.extend({ id: idSchema });

/** Timestamps of a singleton record (profile, settings), which is never deleted. */
export const singletonTimestampsSchema = timestampsSchema.omit({ deletedAt: true });
