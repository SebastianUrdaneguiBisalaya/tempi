import { describe, expect, test } from 'bun:test';
import { createGoogleCalendarApi, GoogleApiError, GoogleAuthError, type GoogleFetch, GoogleOfflineError, SyncTokenExpiredError } from './google-api';

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

describe('Google Calendar API client', () => {
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

	test('deleting an event that is already gone succeeds', async () => {
		await fakeFetch({ status: 410 }).api.deleteEvent('c', 'a');
		await fakeFetch({ status: 204 }).api.deleteEvent('c', 'a');
		await expect(fakeFetch({ status: 500 }).api.deleteEvent('c', 'a')).rejects.toBeInstanceOf(GoogleApiError);
	});
});
