import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { QuickAddRequest } from '@tempi/ai';
import { applyAiSettingsPatch, DEFAULT_AI_SETTINGS, fail, ok, type QuickAddContext, type QuickAddProposal, type Result } from '@tempi/core';
import type { Cipher } from '../google/token-store';
import { createAiKeyStore } from './key-store';
import { createQuickAdd } from './quick-add';
import { createAiSettingsStore } from './settings-store';

const cipher: Cipher = {
	decrypt: data => Promise.resolve(Buffer.from(data.toString('utf8'), 'base64').reverse().toString('utf8')),
	encrypt: text => Promise.resolve(Buffer.from(Buffer.from(text, 'utf8').reverse().toString('base64'), 'utf8')),
	isAvailable: () => Promise.resolve(true),
};

const context: QuickAddContext = { defaultEventDuration: 60, language: 'es', now: new Date('2026-11-19T15:00:00Z'), timeZone: 'America/Lima' };

const proposal: QuickAddProposal = {
	allDay: false,
	description: null,
	endAt: '2026-11-20T23:00:00.000Z',
	location: 'Larcomar',
	reminderMinutes: 30,
	startAt: '2026-11-20T22:00:00.000Z',
	title: 'Café con Ana',
};

const TEXT = 'Café con Ana en Larcomar mañana 5pm, avísame 30 min antes';

let dir: string;

beforeEach(async () => {
	dir = await mkdtemp(path.join(tmpdir(), 'tempi-quick-add-'));
});

afterEach(() => rm(dir, { force: true, recursive: true }));

/** Quick add over real stores, with the model and the parse as stand-ins that record what they were given. */
const setup = (answer: Result<QuickAddProposal> = ok(proposal)) => {
	const keys = createAiKeyStore(path.join(dir, 'ai-keys.bin'), cipher);
	const settings = createAiSettingsStore(path.join(dir, 'ai-settings.json'));
	const models: unknown[][] = [];
	const requests: QuickAddRequest[] = [];
	const quickAdd = createQuickAdd({
		context: () => Promise.resolve(context),
		keys,
		// The model is opaque here: it is only passed on to the parse.
		model: ((...args: unknown[]) => {
			models.push(args);
			return 'model';
		}) as never,
		parse: request => {
			requests.push(request);
			return Promise.resolve(answer);
		},
		settings,
	});
	const chooseAi = (provider: 'anthropic' | 'openai') => settings.write(applyAiSettingsPatch(DEFAULT_AI_SETTINGS, { quickAdd: { mode: 'ai', provider } }));
	return { keys, models, quickAdd, requests, chooseAi };
};

const keysOf = (result: Result<unknown>) => (result.ok ? [] : result.error.issues.map(issue => issue.key));

describe('quick add with AI', () => {
	test('with the default local mode, no provider is called even with a key saved', async () => {
		const { keys, quickAdd, requests } = setup();
		await keys.save('openai', 'sk-openai');
		expect(keysOf(await quickAdd({ text: TEXT }))).toEqual(['ai.invalidKey']);
		expect(requests).toEqual([]);
	});

	test('without a key for the chosen provider it fails before calling anything', async () => {
		const { keys, quickAdd, requests, chooseAi } = setup();
		await chooseAi('anthropic');
		await keys.save('openai', 'sk-openai');
		expect(keysOf(await quickAdd({ text: TEXT }))).toEqual(['ai.invalidKey']);
		expect(requests).toEqual([]);
	});

	test('reads the text with the chosen provider’s key and model, and answers the proposal without the key', async () => {
		const { keys, models, quickAdd, requests, chooseAi } = setup();
		await chooseAi('anthropic');
		await keys.save('anthropic', 'sk-ant-secret');
		const result = await quickAdd({ text: TEXT });

		expect(result).toEqual(ok(proposal));
		expect(JSON.stringify(result)).not.toContain('sk-ant-secret');
		expect(models).toEqual([['anthropic', 'sk-ant-secret', DEFAULT_AI_SETTINGS.models]]);
		expect(requests).toEqual([{ context, model: 'model' as never, provider: 'anthropic', text: TEXT }]);
	});

	test('an invalid reply comes back as the parse’s failure', async () => {
		const { keys, quickAdd, chooseAi } = setup(fail('internal', 'ai.invalidReply', { detail: 'anthropic replied with no valid event' }));
		await chooseAi('anthropic');
		await keys.save('anthropic', 'sk-ant-secret');
		expect(keysOf(await quickAdd({ text: TEXT }))).toEqual(['ai.invalidReply']);
	});
});
