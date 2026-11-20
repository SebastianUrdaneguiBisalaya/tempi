export const MEETING_PROVIDERS = ['meet', 'zoom', 'teams'] as const;

/** A known call provider, or `other` for a video link of any other service. */
export type MeetingProvider = (typeof MEETING_PROVIDERS)[number] | 'other';

export type MeetingLink = { provider: MeetingProvider; url: string };

type MeetingSource = { description: string | null; location: string | null; videoUrl: string | null };

// Hosts of each provider's join links, subdomains included (`us02web.zoom.us`, `teams.live.com`).
const PROVIDER_HOSTS: Record<(typeof MEETING_PROVIDERS)[number], readonly string[]> = {
	meet: ['meet.google.com'],
	teams: ['teams.microsoft.com', 'teams.live.com'],
	zoom: ['zoom.us', 'zoomgov.com'],
};

// Links in free text end at whitespace or a character that can't end one; trailing punctuation belongs to the sentence.
const URL_IN_TEXT = /https?:\/\/[^\s<>"'`]+/gi;
const TRAILING_PUNCTUATION = /[.,;:!?)\]}]+$/;

const providerOf = (url: string): MeetingProvider | null => {
	let host: string;
	try {
		const parsed = new URL(url);
		if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null;
		host = parsed.hostname.toLowerCase();
	} catch {
		return null;
	}
	return MEETING_PROVIDERS.find(provider => PROVIDER_HOSTS[provider].some(known => host === known || host.endsWith(`.${known}`))) ?? null;
};

const linksIn = (text: string | null): string[] => (text === null ? [] : [...text.matchAll(URL_IN_TEXT)].map(([match]) => match.replace(TRAILING_PUNCTUATION, '')));

/**
 * The link to join an event's call: its video link first (where Google's `hangoutLink` lands), any service; otherwise
 * the first Meet, Zoom or Teams link in the location, then in the description. Worked out for display, never saved.
 */
export const meetingLink = (event: MeetingSource): MeetingLink | null => {
	if (event.videoUrl !== null) return { provider: providerOf(event.videoUrl) ?? 'other', url: event.videoUrl };
	for (const url of [...linksIn(event.location), ...linksIn(event.description)]) {
		const provider = providerOf(url);
		if (provider !== null) return { provider, url };
	}
	return null;
};
