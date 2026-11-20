import { describe, expect, test } from 'bun:test';
import type { LanguageModelV4CallOptions } from '@ai-sdk/provider';
import type { QuickAddContext } from '@tempi/core';
import { APICallError } from 'ai';
import { MockLanguageModelV4 } from 'ai/test';
import { parseQuickAdd } from './quick-add';

const context: QuickAddContext = { defaultEventDuration: 60, language: 'es', now: new Date('2026-11-19T15:00:00Z'), timeZone: 'America/Lima' };

const usage = { inputTokens: { cacheRead: 0, cacheWrite: 0, noCache: 10, total: 10 }, outputTokens: { reasoning: 0, text: 5, total: 5 } };

/** A model that answers `text`, recording the calls it gets. */
const answering = (text: string) => {
	const calls: LanguageModelV4CallOptions[] = [];
	const model = new MockLanguageModelV4({
		doGenerate: options => {
			calls.push(options);
			return Promise.resolve({ content: [{ text, type: 'text' }], finishReason: { raw: 'stop', unified: 'stop' }, usage, warnings: [] });
		},
	});
	return { calls, model };
};

const coffee = {
	allDay: false,
	description: null,
	endAt: '2026-11-20T18:00:00-05:00',
	location: 'Larcomar',
	reminderMinutes: 30,
	startAt: '2026-11-20T17:00:00-05:00',
	title: 'Café con Ana',
};

const TEXT = 'Café con Ana en Larcomar mañana 5pm, avísame 30 min antes';

describe('parseQuickAdd', () => {
	test('asks for the event schema with the user’s context and answers the parsed proposal', async () => {
		const { calls, model } = answering(JSON.stringify(coffee));
		const result = await parseQuickAdd({ context, model, provider: 'openai', text: TEXT });

		expect(result).toEqual({ ok: true, value: { ...coffee, endAt: '2026-11-20T23:00:00.000Z', startAt: '2026-11-20T22:00:00.000Z' } });
		const [call] = calls;
		expect(call?.responseFormat?.type).toBe('json');
		const schema = call?.responseFormat?.type === 'json' ? call.responseFormat.schema : undefined;
		// Strict structured output needs every field required and nothing else allowed.
		expect([...(schema?.required ?? [])].sort()).toEqual(Object.keys(coffee).sort());
		expect(schema?.additionalProperties).toBe(false);
		const prompt = JSON.stringify(call?.prompt);
		expect(prompt).toContain(TEXT);
		expect(prompt).toContain('2026-11-19T10:00:00-05:00');
		expect(prompt).toContain('America/Lima');
		expect(prompt).toContain('60 minutes');
	});

	test('a reply that breaks the event rules fails with ai.invalidReply', async () => {
		const { model } = answering(JSON.stringify({ ...coffee, endAt: coffee.startAt, title: '' }));
		const result = await parseQuickAdd({ context, model, provider: 'openai', text: TEXT });
		expect(result.ok ? null : result.error.issues.map(issue => issue.key)).toEqual(['ai.invalidReply']);
	});

	test('a reply that isn’t JSON fails with ai.invalidReply', async () => {
		const { model } = answering('Sure! Coffee with Ana tomorrow.');
		const result = await parseQuickAdd({ context, model, provider: 'openai', text: TEXT });
		expect(result.ok ? null : result.error.issues.map(issue => issue.key)).toEqual(['ai.invalidReply']);
	});

	test('a rejected key fails with ai.invalidKey', async () => {
		const model = new MockLanguageModelV4({
			doGenerate: () => {
				throw new APICallError({ message: 'Unauthorized', requestBodyValues: {}, statusCode: 401, url: 'https://api.openai.com/v1/responses' });
			},
		});
		const result = await parseQuickAdd({ context, model, provider: 'openai', text: TEXT });
		expect(result.ok ? null : result.error.issues.map(issue => issue.key)).toEqual(['ai.invalidKey']);
	});

	test('a provider that doesn’t answer in time fails with ai.network', async () => {
		const model = new MockLanguageModelV4({
			doGenerate: ({ abortSignal }) =>
				new Promise((_, reject) => {
					abortSignal?.addEventListener('abort', () => reject(abortSignal.reason));
				}),
		});
		const result = await parseQuickAdd({ context, model, provider: 'openai', text: TEXT, timeoutMs: 20 });
		expect(result.ok ? null : result.error.issues.map(issue => issue.key)).toEqual(['ai.network']);
	});
});
