import { describe, expect, test } from 'bun:test';
import { meetingLink } from './meeting-link';

const event = (fields: { description?: string; location?: string; videoUrl?: string }) => ({ description: null, location: null, videoUrl: null, ...fields });

describe('meetingLink', () => {
	test.each([
		['https://meet.google.com/abc-defg-hij', 'meet'],
		['https://us02web.zoom.us/j/81234567890?pwd=abc', 'zoom'],
		['https://zoom.us/my/someone', 'zoom'],
		['https://teams.microsoft.com/l/meetup-join/19%3ameeting_abc%40thread.v2/0', 'teams'],
		['https://teams.live.com/meet/9387', 'teams'],
	] as const)('recognizes %s', (url, provider) => {
		expect(meetingLink(event({ videoUrl: url }))).toEqual({ provider, url });
		expect(meetingLink(event({ description: `Join here: ${url}` }))).toEqual({ provider, url });
	});

	test('prefers the video link, of any service, over links in the text', () => {
		const videoUrl = 'https://whereby.com/team-room';
		expect(meetingLink(event({ description: 'https://meet.google.com/abc-defg-hij', videoUrl }))).toEqual({ provider: 'other', url: videoUrl });
	});

	test('looks in the location before the description, and drops the sentence punctuation around a link', () => {
		const found = meetingLink(event({ description: 'Or https://zoom.us/j/1', location: '(https://meet.google.com/abc-defg-hij).' }));
		expect(found).toEqual({ provider: 'meet', url: 'https://meet.google.com/abc-defg-hij' });
	});

	test('skips links that are not calls and lookalike hosts', () => {
		expect(meetingLink(event({ description: 'Agenda: https://docs.google.com/document/d/1 and https://zoom.us.evil.com/j/1', location: 'Room 4' }))).toBeNull();
		expect(meetingLink(event({ description: 'https://notzoom.us/j/1, then https://zoom.us/j/2' }))).toEqual({ provider: 'zoom', url: 'https://zoom.us/j/2' });
		expect(meetingLink(event({}))).toBeNull();
	});
});
