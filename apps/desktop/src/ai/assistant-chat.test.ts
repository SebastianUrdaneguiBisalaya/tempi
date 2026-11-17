import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { AssistantContext, AssistantRequest } from '@tempi/ai';
import { type AssistantStreamEvent, DEFAULT_AI_SETTINGS } from '@tempi/core';
import type { Cipher } from '../google/token-store';
import { type AssistantSink, createAssistantChat } from './assistant-chat';
import { createAiKeyStore } from './key-store';
import { createAiSettingsStore } from './settings-store';

const cipher: Cipher = {
	decrypt: data => Buffer.from(data.toString('utf8'), 'base64').reverse().toString('utf8'),
	encrypt: text => Buffer.from(Buffer.from(text, 'utf8').reverse().toString('base64'), 'utf8'),
	isAvailable: () => true,
};

const context: AssistantContext = { calendars: [], defaultEventDuration: 60, language: 'en', now: new Date('2026-11-17T14:30:00Z'), timeZone: 'America/Lima', weekStart: 'monday' };
const ports = { findEvent: () => Promise.resolve(null), listEvents: () => Promise.resolve([]), searchEvents: () => Promise.resolve([]) };
const input = { messages: [{ role: 'user' as const, text: 'Hola' }], provider: 'anthropic' as const, requestId: '01890a5d-ac96-774b-bcce-b302099a8057' };

let dir: string;

beforeEach(async () => {
	dir = await mkdtemp(path.join(tmpdir(), 'tempi-chat-'));
});

afterEach(() => rm(dir, { force: true, recursive: true }));

/** A chat whose model and run are stand-ins, recording what they were given and what the sink saw. */
const setup = () => {
	const keys = createAiKeyStore(path.join(dir, 'ai-keys.bin'), cipher);
	const settings = createAiSettingsStore(path.join(dir, 'ai-settings.json'));
	const runs: AssistantRequest[] = [];
	const models: unknown[][] = [];
	const sent: AssistantStreamEvent[] = [];
	let closed = 0;
	let opened = 0;
	const chat = createAssistantChat({
		context: () => Promise.resolve(context),
		keys,
		// The model is opaque to the chat: it only passes it on to the run.
		model: ((...args: unknown[]) => {
			models.push(args);
			return 'model';
		}) as never,
		ports,
		run: request => {
			runs.push(request);
			request.emit({ type: 'done' });
			return Promise.resolve();
		},
		settings,
	});
	const openSink = (): AssistantSink => {
		opened++;
		return { close: () => void closed++, send: event => void sent.push(event), signal: new AbortController().signal };
	};
	return { chat, closed: () => closed, keys, models, opened: () => opened, openSink, runs, sent, settings };
};

describe('assistant chat', () => {
	test('a provider without a key fails before anything streams or reaches a provider', async () => {
		const { chat, opened, openSink, runs } = setup();
		expect(await chat(input, openSink)).toMatchObject({ error: { issues: [{ key: 'ai.invalidKey' }] }, ok: false });
		expect(opened()).toBe(0);
		expect(runs).toEqual([]);
	});

	test('runs the reply with the saved key and the model chosen in Settings, then closes the stream', async () => {
		const { chat, closed, keys, models, openSink, runs, sent, settings } = setup();
		await keys.save('anthropic', 'sk-ant');
		await settings.write({ ...DEFAULT_AI_SETTINGS, models: { ...DEFAULT_AI_SETTINGS.models, anthropic: 'claude-haiku-5-5' } });
		expect(await chat(input, openSink)).toEqual({ ok: true, value: null });
		await Promise.resolve();
		expect(models).toEqual([['anthropic', 'sk-ant', { ...DEFAULT_AI_SETTINGS.models, anthropic: 'claude-haiku-5-5' }]]);
		expect(runs[0]).toMatchObject({ context, messages: input.messages, model: 'model', provider: 'anthropic' });
		expect(sent).toEqual([{ type: 'done' }]);
		expect(closed()).toBe(1);
	});

	test('a reply for the Voice tab is run to be read aloud', async () => {
		const { chat, keys, openSink, runs } = setup();
		await keys.save('anthropic', 'sk-ant');
		await chat({ ...input, voice: true }, openSink);
		expect(runs[0]?.voice).toBe(true);
	});
});
