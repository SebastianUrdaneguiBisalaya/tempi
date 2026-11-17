import { type AiProvider, fail, type Result } from '@tempi/core';

/** How long a provider may take to answer a key check before it counts as unreachable. */
export const REQUEST_TIMEOUT_MS = 15_000;

/**
 * The failure a provider's HTTP status means. A key check is a plain GET, so a 400 can only be about the key (Google
 * and xAI answer an invalid key with 400 instead of 401).
 */
export const statusFailure = <T>(provider: AiProvider, status: number): Result<T> => {
	const detail = `${provider} answered ${status}`;
	if (status === 400 || status === 401 || status === 403) return fail('validation', 'ai.invalidKey', { detail, field: 'key' });
	if (status === 402 || status === 429) return fail('conflict', 'ai.rateLimited', { detail });
	return fail('internal', 'ai.providerError', { detail });
};

/** The failure for a request that never got an answer (offline, DNS, timeout). Never includes the key. */
export const networkFailure = <T>(provider: AiProvider, error: unknown): Result<T> =>
	fail('internal', 'ai.network', { detail: `${provider} could not be reached: ${error instanceof Error ? error.message : String(error)}` });
