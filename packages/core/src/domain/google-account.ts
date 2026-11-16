import { z } from 'zod';

/** The Google account connected to Tempi, as the UI shows it. Tokens never leave the main process. */
export const googleAccountSchema = z.object({ email: z.email() });

export type GoogleAccount = z.output<typeof googleAccountSchema>;

/** Connecting waits on the user in the browser, where they can decline. */
export const googleConnectResultSchema = z.discriminatedUnion('status', [z.object({ status: z.literal('canceled') }), z.object({ account: googleAccountSchema, status: z.literal('connected') })]);

export type GoogleConnectResult = z.output<typeof googleConnectResultSchema>;
