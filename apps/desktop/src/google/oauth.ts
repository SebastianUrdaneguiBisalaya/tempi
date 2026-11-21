import type { OAuthClient } from '@tempi/google-calendar';
import { z } from 'zod';

/** What sync needs: the account's calendar list, and its events to read and write. */
export const CALENDAR_SCOPES = ['https://www.googleapis.com/auth/calendar.calendarlist.readonly', 'https://www.googleapis.com/auth/calendar.events'] as const;

// Who the account is, plus calendar access. The Privacy Policy and Terms on apps/www describe exactly these.
export const SCOPES = ['openid', 'email', ...CALENDAR_SCOPES] as const;

/**
 * The OAuth client the maintainer registers as a Google "Desktop app". Google requires its secret even with PKCE; for
 * installed apps it isn't confidential, but it is injected at build time like the id, never committed.
 */
export type TempiOAuthClient = Required<OAuthClient>;

const clientSchema = z.object({ id: z.string().trim().min(1), secret: z.string().trim().min(1) });

/** The client from build-time values, or null when this build has none (Google features stay off). */
export const oauthClientFrom = (values: { id: string | undefined; secret: string | undefined }): TempiOAuthClient | null => {
	const parsed = clientSchema.safeParse(values);
	return parsed.success ? parsed.data : null;
};
