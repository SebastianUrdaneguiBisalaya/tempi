import type { DatabaseSync, StatementSync } from 'node:sqlite';
import { type ProfileRepository, type UserProfile, userProfileSchema } from '@tempi/core';
import { z } from 'zod';
import { type DomainFields, defer, parseRow, toInstantColumn } from '../columns';

const profileRowSchema = z
	.object({
		avatar: z.string().nullable(),
		country: z.string(),
		created_at: z.string(),
		first_name: z.string(),
		last_name: z.string(),
		time_zone: z.string(),
		updated_at: z.string(),
	})
	.transform(
		(row): DomainFields<typeof userProfileSchema> => ({
			avatar: row.avatar,
			country: row.country,
			createdAt: row.created_at,
			firstName: row.first_name,
			lastName: row.last_name,
			timeZone: row.time_zone,
			updatedAt: row.updated_at,
		})
	)
	// Re-validate reads with the domain schema so a corrupt row never reaches use cases.
	.pipe(userProfileSchema);

export class SqliteProfileRepository implements ProfileRepository {
	private readonly getStatement: StatementSync;
	private readonly saveStatement: StatementSync;

	constructor(db: DatabaseSync) {
		this.getStatement = db.prepare('SELECT first_name, last_name, country, time_zone, avatar, created_at, updated_at FROM profile WHERE id = 1');
		this.saveStatement = db.prepare(
			`INSERT INTO profile (id, first_name, last_name, country, time_zone, avatar, created_at, updated_at)
			VALUES (1, :first_name, :last_name, :country, :time_zone, :avatar, :created_at, :updated_at)
			ON CONFLICT (id) DO UPDATE SET
				first_name = excluded.first_name, last_name = excluded.last_name, country = excluded.country,
				time_zone = excluded.time_zone, avatar = excluded.avatar,
				created_at = excluded.created_at, updated_at = excluded.updated_at`
		);
	}

	get(): Promise<UserProfile | null> {
		return defer(() => {
			const row = this.getStatement.get();
			return row === undefined ? null : parseRow(profileRowSchema, row);
		});
	}

	save(profile: UserProfile): Promise<void> {
		return defer(() => {
			this.saveStatement.run({
				avatar: profile.avatar,
				country: profile.country,
				created_at: toInstantColumn(profile.createdAt),
				first_name: profile.firstName,
				last_name: profile.lastName,
				time_zone: profile.timeZone,
				updated_at: toInstantColumn(profile.updatedAt),
			});
		});
	}
}
