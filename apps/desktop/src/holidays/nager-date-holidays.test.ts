import { describe, expect, test } from 'bun:test';
import type { FetchLike } from '@usemeshly/auth';
import { createNagerDateHolidays } from './nager-date-holidays';

const json = (body: unknown, status = 200) => Promise.resolve(new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json' }, status }));

const answering = (respond: (url: URL) => Promise<Response>) => {
	const urls: URL[] = [];
	const fetch: FetchLike = url => {
		const parsed = new URL(url);
		urls.push(parsed);
		return respond(parsed);
	};
	return { fetch, urls };
};

const holiday = (date: string, name: string, overrides: object = {}) => ({
	countryCode: 'PE',
	date,
	holidayTypes: ['Public'],
	name,
	nationalHoliday: true,
	subdivisionCodes: null,
	...overrides,
});

describe('Nager.Date holidays', () => {
	test('asks the Community API for a country and year, keeping only nationwide public holidays', async () => {
		const { fetch, urls } = answering(() =>
			json([
				holiday('2026-01-01', 'New Year’s Day'),
				holiday('2026-06-07', 'Battle of Arica', { nationalHoliday: false, subdivisionCodes: ['PE-TAC'] }),
				holiday('2026-05-10', 'Mother’s Day', { holidayTypes: ['Observance'] }),
				holiday('2026-07-28', 'Independence Day', { holidayTypes: ['Public', 'Bank'], subdivisionCodes: [] }),
			])
		);
		expect(await createNagerDateHolidays(fetch).list('PE', 2026)).toEqual({
			ok: true,
			value: [
				{ date: '2026-01-01', name: 'New Year’s Day' },
				{ date: '2026-07-28', name: 'Independence Day' },
			],
		});
		expect(urls).toHaveLength(1);
		expect(urls[0]?.protocol).toBe('https:');
		expect(urls[0]?.pathname).toContain('2026');
		expect(urls[0]?.pathname).toContain('PE');
		// The Community plan sends no key.
		expect(urls[0]?.search).toBe('');
	});

	test('no content means no holidays', async () => {
		const { fetch } = answering(() => Promise.resolve(new Response(null, { status: 204 })));
		expect(await createNagerDateHolidays(fetch).list('PE', 2026)).toEqual({ ok: true, value: [] });
	});

	test('a country Nager.Date doesn’t cover has no holidays, instead of failing on every launch', async () => {
		const { fetch } = answering(() => json({ title: 'Not Found' }, 404));
		expect(await createNagerDateHolidays(fetch).list('AQ', 2026)).toEqual({ ok: true, value: [] });
	});

	test('maps a rate limit, the network and a bad answer to their keys', async () => {
		const limited = answering(() => json({}, 429));
		expect(await createNagerDateHolidays(limited.fetch).list('PE', 2026)).toMatchObject({ error: { issues: [{ key: 'holidays.rateLimited' }] }, ok: false });

		const offline = answering(() => Promise.reject(new TypeError('fetch failed')));
		expect(await createNagerDateHolidays(offline.fetch).list('PE', 2026)).toMatchObject({ error: { issues: [{ key: 'holidays.offline' }] }, ok: false });

		const broken = answering(() => json([{ date: 'soon' }]));
		expect(await createNagerDateHolidays(broken.fetch).list('PE', 2026)).toMatchObject({ error: { issues: [{ key: 'holidays.unavailable' }] }, ok: false });

		const failing = answering(() => json({}, 500));
		expect(await createNagerDateHolidays(failing.fetch).list('PE', 2026)).toMatchObject({ error: { issues: [{ key: 'holidays.unavailable' }] }, ok: false });
	});
});
