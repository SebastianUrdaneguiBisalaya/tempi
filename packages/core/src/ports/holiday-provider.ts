import type { Holiday } from '../domain/holiday';
import type { Result } from '../domain/result';

/**
 * Where public holidays come from (Nager.Date's Community API today). Failures come back as a failed `Result` with a
 * `holidays.*` key, never thrown.
 */
export type HolidayProvider = {
	/** The nationwide public holidays of `country` (ISO 3166-1 alpha-2) in `year`; empty when the provider has none. */
	list: (country: string, year: number) => Promise<Result<Holiday[]>>;
};
