import {
	type AssistantMessage,
	type AssistantProposal,
	type AssistantStreamEvent,
	type AssistantTool,
	type DomainError,
	MAX_ASSISTANT_MESSAGE_LENGTH,
	MAX_ASSISTANT_MESSAGES,
	type TextProvider,
} from '@tempi/core';
import type { TempiApi } from '@tempi/ipc';
import { createStore } from 'zustand/vanilla';

export type ToolTrace = { id: string; status: 'done' | 'error' | 'running'; tool: AssistantTool };

export type ProposalStatus = 'canceled' | 'confirmed' | 'pending';

export type ProposalItem = { id: string; proposal: AssistantProposal; status: ProposalStatus };

export type UserTurn = { id: string; role: 'user'; text: string };

export type AssistantTurn = {
	id: string;
	role: 'assistant';
	/** The provider that wrote it. */
	provider: TextProvider;
	text: string;
	/** Tool calls and proposals, in the order they happened. */
	traces: ToolTrace[];
	proposals: ProposalItem[];
	status: 'done' | 'error' | 'stopped' | 'streaming';
	error: DomainError | null;
};

export type Turn = AssistantTurn | UserTurn;

export type AssistantTab = 'chat' | 'voice';

export type AssistantState = {
	turns: Turn[];
	/** The reply being streamed, if any. */
	requestId: string | null;
	/** The unsent prompt, kept while the panel is collapsed. */
	draft: string;
	/** The provider picked in the Chat tab; null until the user picks one (the first with a key is used). */
	provider: TextProvider | null;
	/** The provider picked in the Voice tab, independent of the Chat tab's. */
	voiceProvider: TextProvider | null;
	tab: AssistantTab;
};

const INITIAL: AssistantState = { draft: '', provider: null, requestId: null, tab: 'chat', turns: [], voiceProvider: null };

const STATE_NOTES = { canceled: 'the user canceled it', confirmed: 'the user confirmed it and it is saved', pending: 'not confirmed yet' } as const satisfies Record<ProposalStatus, string>;

const proposalNote = ({ proposal, status }: ProposalItem): string => {
	const state = STATE_NOTES[status];
	if (proposal.kind === 'create') return `[Proposed creating "${proposal.input.title}" at ${proposal.input.startAt}: ${state}.]`;
	if (proposal.kind === 'update') return `[Proposed editing "${proposal.event.title}" (id ${proposal.id}): ${state}.]`;
	return `[Proposed deleting "${proposal.event.title}" (id ${proposal.event.id}): ${state}.]`;
};

/**
 * The conversation as the model reads it: each turn's text, with notes on the proposals it made and whether the user
 * confirmed them, so the model doesn't propose the same change twice. Only the latest turns fit.
 */
export const toModelMessages = (turns: readonly Turn[]): AssistantMessage[] =>
	turns
		.map(
			(turn): AssistantMessage => ({
				role: turn.role,
				text: (turn.role === 'user' ? turn.text : [turn.text, ...turn.proposals.map(proposalNote)].join('\n')).trim().slice(0, MAX_ASSISTANT_MESSAGE_LENGTH),
			})
		)
		.filter(message => message.text !== '')
		.slice(-MAX_ASSISTANT_MESSAGES);

const isEnded = (status: AssistantTurn['status']) => status !== 'streaming';

const stopTraces = (traces: ToolTrace[]): ToolTrace[] => traces.map(trace => (trace.status === 'running' ? { ...trace, status: 'error' } : trace));

/** Applies one streamed event to the reply it belongs to. */
export const applyStreamEvent = (turn: AssistantTurn, event: AssistantStreamEvent): AssistantTurn => {
	if (isEnded(turn.status)) return turn;
	switch (event.type) {
		case 'text':
			return { ...turn, text: turn.text + event.text };
		case 'tool-start':
			return { ...turn, traces: [...turn.traces, { id: event.id, status: 'running', tool: event.tool }] };
		case 'tool-end':
			return { ...turn, traces: turn.traces.map(trace => (trace.id === event.id ? { ...trace, status: event.ok ? 'done' : 'error' } : trace)) };
		case 'proposal':
			return { ...turn, proposals: [...turn.proposals, { id: event.id, proposal: event.proposal, status: 'pending' }] };
		case 'error':
			return { ...turn, error: event.error, status: 'error', traces: stopTraces(turn.traces) };
		case 'done':
			return { ...turn, status: 'done' };
	}
};

export type AssistantActions = {
	setDraft: (draft: string) => void;
	/** Adds dictated text after whatever the prompt already holds, for the user to review before sending. */
	appendDraft: (text: string) => void;
	setProvider: (provider: TextProvider) => void;
	setVoiceProvider: (voiceProvider: TextProvider) => void;
	setTab: (tab: AssistantTab) => void;
	setProposalStatus: (turnId: string, proposalId: string, status: ProposalStatus) => void;
	/**
	 * Sends `text` and streams the reply. The reply's id is its request id, so its events find it. Resolves with the
	 * reply once it ended (done, failed or stopped), or null if nothing was sent. `voice` asks for a reply to be heard.
	 */
	send: (api: TempiApi, provider: TextProvider, text: string, options?: { voice?: boolean }) => Promise<AssistantTurn | null>;
	stop: (api: TempiApi) => void;
	/** Starts over, for both tabs. A reply still streaming is stopped. */
	clear: (api: TempiApi) => void;
};

/**
 * The assistant's one conversation for this session, shared by the Chat and Voice tabs and kept in memory only. Lives
 * above the panel, so collapsing it keeps everything.
 */
export const createAssistantStore = () =>
	createStore<AssistantState & AssistantActions>()((set, get) => {
		const updateTurn = (id: string, update: (turn: AssistantTurn) => AssistantTurn) =>
			set(state => ({ turns: state.turns.map(turn => (turn.id === id && turn.role === 'assistant' ? update(turn) : turn)) }));
		// Who waits for each reply to end (the Voice tab, to read it aloud).
		const waiting = new Map<string, (turn: AssistantTurn | null) => void>();
		const finish = (api: TempiApi, requestId: string) => {
			api.ai.stopChat(requestId);
			if (get().requestId === requestId) set({ requestId: null });
			const turn = get().turns.find((candidate): candidate is AssistantTurn => candidate.id === requestId && candidate.role === 'assistant');
			waiting.get(requestId)?.(turn ?? null);
			waiting.delete(requestId);
		};

		return {
			...INITIAL,
			setDraft: draft => set({ draft }),
			appendDraft: text => {
				const current = get().draft.trimEnd();
				set({ draft: current === '' ? text : `${current} ${text}` });
			},
			setProvider: provider => set({ provider }),
			setVoiceProvider: voiceProvider => set({ voiceProvider }),
			setTab: tab => set({ tab }),
			setProposalStatus: (turnId, proposalId, status) => updateTurn(turnId, turn => ({ ...turn, proposals: turn.proposals.map(item => (item.id === proposalId ? { ...item, status } : item)) })),
			send: (api, provider, text, { voice = false } = {}) => {
				const trimmed = text.trim();
				if (trimmed === '' || get().requestId !== null) return Promise.resolve(null);
				const requestId = crypto.randomUUID();
				const turns = [...get().turns, { id: crypto.randomUUID(), role: 'user', text: trimmed } satisfies UserTurn];
				const reply: AssistantTurn = { error: null, id: requestId, proposals: [], provider, role: 'assistant', status: 'streaming', text: '', traces: [] };
				// A spoken message leaves the Chat tab's unsent prompt alone.
				set(state => ({ draft: voice ? state.draft : '', requestId, turns: [...turns, reply] }));
				const ended = new Promise<AssistantTurn | null>(resolve => waiting.set(requestId, resolve));
				void api.ai
					.chat({ messages: toModelMessages(turns), provider, requestId, ...(voice ? { voice } : {}) }, event => {
						updateTurn(requestId, turn => applyStreamEvent(turn, event));
						if (event.type === 'done' || event.type === 'error') finish(api, requestId);
					})
					.then(started => {
						if (started.ok) return;
						updateTurn(requestId, turn => applyStreamEvent(turn, { error: started.error, type: 'error' }));
						finish(api, requestId);
					});
				return ended;
			},
			stop: api => {
				const { requestId } = get();
				if (requestId === null) return;
				updateTurn(requestId, turn => (isEnded(turn.status) ? turn : { ...turn, status: 'stopped', traces: stopTraces(turn.traces) }));
				finish(api, requestId);
			},
			clear: api => {
				get().stop(api);
				set({ draft: '', requestId: null, turns: [] });
			},
		};
	});

export type AssistantStore = ReturnType<typeof createAssistantStore>;
