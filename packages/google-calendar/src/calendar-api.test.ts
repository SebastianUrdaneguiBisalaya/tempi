import { describe, expect, test } from 'bun:test';
import { createGoogleCalendarApi, GoogleApiError, GoogleAuthError, type GoogleFetch, GoogleOfflineError, SyncTokenExpiredError } from './calendar-api';

/** Answers requests in order with the given responses, recording the URLs and headers. */
const fakeFetch = (...responses: { body?: unknown; status: number }[]) => {
	const requests: { headers: Record<string, string>; method: string; url: string }[] = [];
	const fetch: GoogleFetch = (url, init) => {
		requests.push({ headers: init.headers, method: init.method, url });
		const response = responses.shift();
		if (response === undefined) return Promise.reject(new TypeError('fetch failed'));
		return Promise.resolve({ json: () => Promise.resolve(response.body), ok: response.status < 300, status: response.status });
	};
	return { api: createGoogleCalendarApi({ accessToken: () => Promise.resolve('token-1'), fetch }), requests };
};

/** A fetch that never answers on its own, only rejects when its request is aborted. */
const hangingFetch: GoogleFetch = (_url, init) =>
	new Promise((_resolve, reject) => {
		init.signal.addEventListener('abort', () => reject(init.signal.reason), { once: true });
	});

describe('Google Calendar API client', () => {
	test('a request Google never answers ends as offline at the deadline instead of hanging', async () => {
		const api = createGoogleCalendarApi({ accessToken: () => Promise.resolve('token-1'), fetch: hangingFetch, timeoutMs: 10 });
		await expect(api.listCalendars()).rejects.toBeInstanceOf(GoogleOfflineError);
	});

	test('a body cut off by the deadline is offline too, not an empty answer', async () => {
		const fetch: GoogleFetch = (_url, init) =>
			Promise.resolve({
				json: () => new Promise((_resolve, reject) => init.signal.addEventListener('abort', () => reject(init.signal.reason), { once: true })),
				ok: true,
				status: 200,
			});
		const api = createGoogleCalendarApi({ accessToken: () => Promise.resolve('token-1'), fetch, timeoutMs: 10 });
		await expect(api.listCalendars()).rejects.toBeInstanceOf(GoogleOfflineError);
	});

	test('reads every page and returns the final sync token', async () => {
		const { api, requests } = fakeFetch(
			{ body: { items: [{ etag: '"1"', id: 'a' }], nextPageToken: 'p2' }, status: 200 },
			{ body: { items: [{ etag: '"2"', id: 'b' }, { broken: true }], nextSyncToken: 's1' }, status: 200 }
		);
		const result = await api.listEvents('ada@example.com', 's0');
		expect(result).toEqual({
			items: [
				{ etag: '"1"', id: 'a' },
				{ etag: '"2"', id: 'b' },
			],
			nextSyncToken: 's1',
		});
		expect(requests[0]?.url).toBe('https://www.googleapis.com/calendar/v3/calendars/ada%40example.com/events?maxResults=2500&showDeleted=true&syncToken=s0');
		expect(requests[1]?.url).toContain('pageToken=p2');
		expect(requests[0]?.headers.Authorization).toBe('Bearer token-1');
	});

	test('tells an expired sync token, a lost grant and no connection apart', async () => {
		await expect(fakeFetch({ status: 410 }).api.listEvents('c', 's0')).rejects.toBeInstanceOf(SyncTokenExpiredError);
		await expect(fakeFetch({ status: 401 }).api.listCalendars()).rejects.toBeInstanceOf(GoogleAuthError);
		await expect(fakeFetch({ body: { error: { errors: [{ reason: 'insufficientPermissions' }] } }, status: 403 }).api.listCalendars()).rejects.toBeInstanceOf(GoogleAuthError);
		await expect(fakeFetch({ body: { error: 'rateLimitExceeded' }, status: 403 }).api.listCalendars()).rejects.toBeInstanceOf(GoogleApiError);
		await expect(fakeFetch().api.listCalendars()).rejects.toBeInstanceOf(GoogleOfflineError);
	});

	test('gets one event, or null when Google has none', async () => {
		const { api, requests } = fakeFetch({ body: { etag: '"1"', id: 'a b' }, status: 200 });
		expect(await api.getEvent('ada@example.com', 'a b')).toEqual({ etag: '"1"', id: 'a b' });
		expect(requests[0]).toMatchObject({ method: 'GET', url: 'https://www.googleapis.com/calendar/v3/calendars/ada%40example.com/events/a%20b' });
		expect(await fakeFetch({ status: 404 }).api.getEvent('c', 'a')).toBeNull();
		await expect(fakeFetch({ body: { id: 'a' }, status: 200 }).api.getEvent('c', 'a')).rejects.toBeInstanceOf(GoogleApiError);
	});

	test('deleting an event that is already gone succeeds', async () => {
		await fakeFetch({ status: 410 }).api.deleteEvent('c', 'a');
		await fakeFetch({ status: 204 }).api.deleteEvent('c', 'a');
		await expect(fakeFetch({ status: 500 }).api.deleteEvent('c', 'a')).rejects.toBeInstanceOf(GoogleApiError);
	});
});
