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

export type ToolTrace = { id: string; status: 'done' | 'error' | 'running'; tool: AssistantTool };

export type ProposalStatus = 'confirmed' | 'pending';

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
	/** The provider picked in the panel; null until the user picks one (the first with a key is used). */
	provider: TextProvider | null;
	tab: AssistantTab;
};

const INITIAL: AssistantState = { draft: '', provider: null, requestId: null, tab: 'chat', turns: [] };

const proposalNote = ({ proposal, status }: ProposalItem): string => {
	const state = status === 'confirmed' ? 'the user confirmed it and it is saved' : 'not confirmed yet';
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
			return { ...turn, error: event.error, status: 'error', traces: turn.traces.map(trace => (trace.status === 'running' ? { ...trace, status: 'error' } : trace)) };
		case 'done':
			return { ...turn, status: 'done' };
	}
};

/**
 * The assistant's one conversation for this session, shared by the Chat and Voice tabs and kept in memory only. Lives
 * above the panel, so collapsing it keeps everything.
 */
export const createAssistantStore = () => {
	let state = INITIAL;
	const listeners = new Set<() => void>();
	const set = (next: AssistantState) => {
		state = next;
		for (const listener of listeners) listener();
	};
	const updateTurn = (id: string, update: (turn: AssistantTurn) => AssistantTurn) =>
		set({ ...state, turns: state.turns.map(turn => (turn.id === id && turn.role === 'assistant' ? update(turn) : turn)) });
	const finish = (api: TempiApi, requestId: string) => {
		api.ai.stopChat(requestId);
		if (state.requestId === requestId) set({ ...state, requestId: null });
	};

	const stop = (api: TempiApi) => {
		const { requestId } = state;
		if (requestId === null) return;
		finish(api, requestId);
		updateTurn(requestId, turn =>
			isEnded(turn.status) ? turn : { ...turn, status: 'stopped', traces: turn.traces.map(trace => (trace.status === 'running' ? { ...trace, status: 'error' } : trace)) }
		);
	};

	return {
		getSnapshot: () => state,
		subscribe: (listener: () => void) => {
			listeners.add(listener);
			return () => {
				listeners.delete(listener);
			};
		},
		setDraft: (draft: string) => set({ ...state, draft }),
		/** Adds dictated text after whatever the prompt already holds, for the user to review before sending. */
		appendDraft: (text: string) => {
			const current = state.draft.trimEnd();
			set({ ...state, draft: current === '' ? text : `${current} ${text}` });
		},
		setProvider: (provider: TextProvider) => set({ ...state, provider }),
		setTab: (tab: AssistantTab) => set({ ...state, tab }),
		setProposalStatus: (turnId: string, proposalId: string, status: ProposalStatus) =>
			updateTurn(turnId, turn => ({ ...turn, proposals: turn.proposals.map(item => (item.id === proposalId ? { ...item, status } : item)) })),
		/** Sends `text` and streams the reply. The reply's id is its request id, so its events find it. */
		send: async (api: TempiApi, provider: TextProvider, text: string) => {
			const trimmed = text.trim();
			if (trimmed === '' || state.requestId !== null) return;
			const requestId = crypto.randomUUID();
			const user: UserTurn = { id: crypto.randomUUID(), role: 'user', text: trimmed };
			const reply: AssistantTurn = { error: null, id: requestId, proposals: [], provider, role: 'assistant', status: 'streaming', text: '', traces: [] };
			const turns = [...state.turns, user];
			set({ ...state, draft: '', requestId, turns: [...turns, reply] });
			const started = await api.ai.chat({ messages: toModelMessages(turns), provider, requestId }, event => {
				updateTurn(requestId, turn => applyStreamEvent(turn, event));
				if (event.type === 'done' || event.type === 'error') finish(api, requestId);
			});
			if (!started.ok) {
				updateTurn(requestId, turn => applyStreamEvent(turn, { error: started.error, type: 'error' }));
				finish(api, requestId);
			}
		},
		stop,
		/** Starts over, for both tabs. A reply still streaming is stopped. */
		clear: (api: TempiApi) => {
			stop(api);
			set({ ...INITIAL, provider: state.provider, tab: state.tab });
		},
	};
};

export type AssistantStore = ReturnType<typeof createAssistantStore>;
