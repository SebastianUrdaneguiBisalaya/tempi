import { type AiProvider, ok, type Result, type TextProvider } from '@tempi/core';
import { networkFailure, REQUEST_TIMEOUT_MS, statusFailure } from './failures';
import { type AiRequestOptions, listVoices } from './voices';

/**
 * Each text provider's model list: a read-only GET that needs a valid key and spends no tokens, so testing a key costs
 * the user nothing.
 */
const KEY_CHECKS = {
	anthropic: key => ({ headers: { 'anthropic-version': '2023-06-01', 'x-api-key': key }, url: 'https://api.anthropic.com/v1/models' }),
	google: key => ({ headers: { 'x-goog-api-key': key }, url: 'https://generativelanguage.googleapis.com/v1beta/models' }),
	groq: key => ({ headers: { authorization: `Bearer ${key}` }, url: 'https://api.groq.com/openai/v1/models' }),
	openai: key => ({ headers: { authorization: `Bearer ${key}` }, url: 'https://api.openai.com/v1/models' }),
	xai: key => ({ headers: { authorization: `Bearer ${key}` }, url: 'https://api.x.ai/v1/models' }),
} as const satisfies Record<TextProvider, (key: string) => { headers: Record<string, string>; url: string }>;

/** Checks that `provider` accepts `key`, without generating anything. Fails with `ai.invalidKey`, `ai.rateLimited`, `ai.network` or `ai.providerError`. */
export const testKey = async (provider: AiProvider, key: string, options: AiRequestOptions = {}): Promise<Result<null>> => {
	if (provider === 'elevenlabs') {
		const voices = await listVoices(key, options);
		return voices.ok ? ok(null) : voices;
	}
	const { headers, url } = KEY_CHECKS[provider](key);
	let response: Response;
	try {
		response = await (options.fetch ?? fetch)(url, { headers, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
	} catch (error) {
		return networkFailure(provider, error);
	}
	// The body isn't needed; release the connection.
	await response.body?.cancel().catch(() => undefined);
	return response.ok ? ok(null) : statusFailure(provider, response.status);
};
