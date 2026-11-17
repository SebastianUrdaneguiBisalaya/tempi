import { describe, expect, test } from 'bun:test';
import type { LanguageModelV4StreamPart } from '@ai-sdk/provider';
import { type AssistantStreamEvent, type Calendar, type CalendarEvent, NO_SERIES } from '@tempi/core';
import { APICallError } from 'ai';
import { convertArrayToReadableStream, MockLanguageModelV4 } from 'ai/test';
import { runAssistant } from './assistant';
import type { AssistantContext } from './assistant-context';
import type { AssistantPorts } from './assistant-tools';

const T0 = '2026-11-15T10:00:00.000Z';

const calendar = (id: string, fields: Partial<Calendar> = {}): Calendar => ({
	color: '#3b82f6',
	createdAt: T0,
	deletedAt: null,
	id,
	isDefault: false,
	isVisible: true,
	name: id,
	readOnly: false,
	source: 'local',
	updatedAt: T0,
	...fields,
});

const context: AssistantContext = {
	calendars: [calendar('personal', { isDefault: true, name: 'Personal' }), calendar('holidays', { name: 'Holidays', readOnly: true })],
	defaultEventDuration: 60,
	language: 'es',
	now: new Date('2026-11-17T14:30:00Z'),
	timeZone: 'America/Lima',
	weekStart: 'monday',
};

const standup: CalendarEvent = {
	...NO_SERIES,
	allDay: false,
	calendarId: 'personal',
	createdAt: T0,
	deletedAt: null,
	description: null,
	endAt: '2026-11-19T14:30:00.000Z',
	id: 'evt-1',
	location: null,
	reminderMinutes: null,
	rrule: null,
	startAt: '2026-11-19T14:00:00.000Z',
	status: 'confirmed',
	timeZone: 'America/Lima',
	title: 'Standup',
	updatedAt: T0,
	videoUrl: null,
};

/** Read-only ports over one event, recording every call. */
const fakePorts = () => {
	const calls: string[] = [];
	const ports: AssistantPorts = {
		findEvent: id => {
			calls.push(`find ${id}`);
			return Promise.resolve(id === standup.id ? standup : null);
		},
		listEvents: range => {
			calls.push(`list ${range.start} ${range.end}`);
			return Promise.resolve([{ ...standup, key: standup.id, series: null }]);
		},
		searchEvents: query => {
			calls.push(`search ${query}`);
			return Promise.resolve([]);
		},
	};
	return { calls, ports };
};

const usage = { inputTokens: { cacheRead: 0, cacheWrite: 0, noCache: 10, total: 10 }, outputTokens: { reasoning: 0, text: 5, total: 5 } };

const toolStep = (toolName: string, input: unknown): LanguageModelV4StreamPart[] => [
	{ type: 'stream-start', warnings: [] },
	{ input: JSON.stringify(input), toolCallId: `call-${toolName}`, toolName, type: 'tool-call' },
	{ finishReason: { raw: 'tool_calls', unified: 'tool-calls' }, type: 'finish', usage },
];

const textStep = (text: string): LanguageModelV4StreamPart[] => [
	{ type: 'stream-start', warnings: [] },
	{ id: 't', type: 'text-start' },
	{ delta: text, id: 't', type: 'text-delta' },
	{ id: 't', type: 'text-end' },
	{ finishReason: { raw: 'stop', unified: 'stop' }, type: 'finish', usage },
];

/** A model that plays `steps` in order, one per call, recording the prompts it was sent. */
const scriptedModel = (...steps: LanguageModelV4StreamPart[][]) => new MockLanguageModelV4({ doStream: steps.map(chunks => ({ stream: convertArrayToReadableStream(chunks) })) });

const run = async (model: MockLanguageModelV4, text = 'Dentista mañana a las 3pm', voice?: boolean) => {
	const events: AssistantStreamEvent[] = [];
	const { calls, ports } = fakePorts();
	await runAssistant({ context, emit: event => events.push(event), messages: [{ role: 'user', text }], model, ports, provider: 'openai', ...(voice === undefined ? {} : { voice }) });
	return { calls, events };
};

/** What the model received back from its tool calls in the step after them. */
const toolOutputs = (model: MockLanguageModelV4): unknown[] =>
	(model.doStreamCalls[1]?.prompt ?? []).flatMap(message => (message.role === 'tool' ? message.content.map(part => ('output' in part ? part.output : null)) : []));

describe('runAssistant', () => {
	test('tells the model the date, time zone, week start and calendars so relative dates resolve', async () => {
		const model = scriptedModel(textStep('Hola'));
		await run(model);
		const system = JSON.stringify(model.doStreamCalls[0]?.prompt[0]);
		expect(system).toContain('Tuesday, 2026-11-17T09:30:00-05:00');
		expect(system).toContain('America/Lima');
		expect(system).toContain('monday');
		expect(system).toContain('Personal (id: personal)');
		expect(system).toContain('read-only');
	});

	test('a reply to be read aloud is asked for in plain spoken sentences; a written one is not', async () => {
		const spoken = scriptedModel(textStep('Hola'));
		await run(spoken, '¿Qué tengo mañana?', true);
		expect(JSON.stringify(spoken.doStreamCalls[0]?.prompt[0])).toContain('hears your reply read aloud');

		const written = scriptedModel(textStep('Hola'));
		await run(written);
		expect(JSON.stringify(written.doStreamCalls[0]?.prompt[0])).not.toContain('read aloud');
	});

	test('a valid new event becomes a proposal, and nothing is written', async () => {
		const input = { calendarId: 'personal', endAt: '2026-11-18T16:00:00-05:00', startAt: '2026-11-18T15:00:00-05:00', timeZone: 'America/Lima', title: 'Dentista' };
		const model = scriptedModel(toolStep('createEvent', input), textStep('Listo para confirmar.'));
		const { calls, events } = await run(model);
		expect(events).toEqual([
			{ id: 'call-createEvent', tool: 'createEvent', type: 'tool-start' },
			{ id: 'call-createEvent', ok: true, tool: 'createEvent', type: 'tool-end' },
			{
				id: 'proposal-call-createEvent',
				proposal: {
					input: {
						...input,
						allDay: false,
						description: null,
						endAt: '2026-11-18T21:00:00.000Z',
						location: null,
						reminderMinutes: null,
						rrule: null,
						startAt: '2026-11-18T20:00:00.000Z',
						status: 'confirmed',
						videoUrl: null,
					},
					kind: 'create',
				},
				type: 'proposal',
			},
			{ text: 'Listo para confirmar.', type: 'text' },
			{ type: 'done' },
		]);
		expect(calls).toEqual([]);
		expect(toolOutputs(model)).toEqual([{ type: 'json', value: { note: 'Shown to the user to confirm. Nothing is saved until they confirm it.', status: 'proposed' } }]);
	});

	test('an invalid proposal returns every core issue to the model instead of proposing', async () => {
		const model = scriptedModel(
			toolStep('createEvent', { calendarId: 'personal', endAt: '2026-11-18T15:00:00-05:00', startAt: '2026-11-18T15:00:00-05:00', timeZone: 'America/Lima', title: '' }),
			textStep('¿A qué hora?')
		);
		const { events } = await run(model);
		expect(events.some(event => event.type === 'proposal')).toBe(false);
		expect(toolOutputs(model)).toEqual([
			{
				type: 'json',
				value: {
					issues: [
						{ detail: 'Value is required', field: 'title', key: 'validation.required' },
						{ detail: 'Event end must be after its start', field: 'endAt', key: 'event.endBeforeStart' },
					],
					status: 'invalid',
				},
			},
		]);
	});

	test('a read-only calendar is refused like any other invalid field', async () => {
		const model = scriptedModel(
			toolStep('createEvent', { calendarId: 'holidays', endAt: '2026-11-18T16:00:00-05:00', startAt: '2026-11-18T15:00:00-05:00', timeZone: 'America/Lima', title: 'Party' }),
			textStep('No puedo.')
		);
		const { events } = await run(model);
		expect(events.some(event => event.type === 'proposal')).toBe(false);
		expect(JSON.stringify(toolOutputs(model))).toContain('calendar.readOnly');
	});

	test('updates and deletes look the event up and only propose', async () => {
		const update = scriptedModel(toolStep('updateEvent', { id: 'evt-1', title: 'Daily' }), textStep('ok'));
		const updated = await run(update);
		expect(updated.calls).toEqual(['find evt-1']);
		expect(updated.events.find(event => event.type === 'proposal')).toEqual({
			id: 'proposal-call-updateEvent',
			proposal: { event: standup, id: 'evt-1', kind: 'update', patch: { title: 'Daily' } },
			type: 'proposal',
		});

		const remove = scriptedModel(toolStep('deleteEvent', { id: 'evt-1' }), textStep('ok'));
		expect((await run(remove)).events.find(event => event.type === 'proposal')).toEqual({ id: 'proposal-call-deleteEvent', proposal: { event: standup, kind: 'delete' }, type: 'proposal' });
	});

	test('an update that breaks a cross-field rule or a missing event is returned as issues', async () => {
		const backwards = scriptedModel(toolStep('updateEvent', { endAt: '2026-11-19T08:00:00-05:00', id: 'evt-1' }), textStep('ok'));
		await run(backwards);
		expect(JSON.stringify(toolOutputs(backwards))).toContain('event.endBeforeStart');

		const missing = scriptedModel(toolStep('deleteEvent', { id: 'nope' }), textStep('ok'));
		await run(missing);
		expect(JSON.stringify(toolOutputs(missing))).toContain('event.notFound');
	});

	test('answers schedule questions from real events, with times in the user’s zone', async () => {
		const model = scriptedModel(toolStep('listEvents', { end: '2026-11-20T00:00:00-05:00', start: '2026-11-19T00:00:00-05:00' }), textStep('Tienes Standup.'));
		const { calls, events } = await run(model, '¿Qué tengo el jueves?');
		expect(calls).toEqual(['list 2026-11-19T05:00:00.000Z 2026-11-20T05:00:00.000Z']);
		expect(JSON.stringify(toolOutputs(model))).toContain('"start":"2026-11-19T09:00:00-05:00"');
		expect(events.map(event => event.type)).toEqual(['tool-start', 'tool-end', 'text', 'done']);
	});

	test('a rejected key ends the reply with ai.invalidKey', async () => {
		const model = new MockLanguageModelV4({
			doStream: () => {
				throw new APICallError({ message: 'Unauthorized', requestBodyValues: {}, statusCode: 401, url: 'https://api.openai.com/v1/responses' });
			},
		});
		const { events } = await run(model);
		expect(events.at(-1)).toMatchObject({ error: { issues: [{ key: 'ai.invalidKey' }] }, type: 'error' });
	});
});
