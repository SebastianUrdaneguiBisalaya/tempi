'use client';

import type { TextProvider } from '@tempi/core';
import { createContext, type ReactNode, use, useState, useSyncExternalStore } from 'react';
import { useShortcut } from '@/features/shortcuts/hooks/use-shortcut';
import { useApi } from '@/providers/api-provider';
import { type AssistantState, type AssistantStore, type AssistantTab, createAssistantStore, type ProposalStatus } from '../assistant-store';

type AssistantContextValue = { open: boolean; setOpen: (open: boolean) => void; store: AssistantStore };

const AssistantContext = createContext<AssistantContextValue | null>(null);

/** Owns the assistant for the session: its conversation and whether the panel is open. ⌘J toggles it. */
export function AssistantProvider({ children }: { children: ReactNode }) {
	const [store] = useState(createAssistantStore);
	const [open, setOpen] = useState(false);
	useShortcut('toggleAssistant', () => setOpen(current => !current));
	return <AssistantContext value={{ open, setOpen, store }}>{children}</AssistantContext>;
}

const useAssistantContext = (): AssistantContextValue => {
	const context = use(AssistantContext);
	if (context === null) throw new Error('useAssistant must be used inside AssistantProvider');
	return context;
};

/** Whether the panel is open, and a way to change it. */
export const useAssistantPanel = () => {
	const { open, setOpen } = useAssistantContext();
	return { open, setOpen, toggle: () => setOpen(!open) };
};

export type AssistantActions = {
	send: (provider: TextProvider, text: string) => void;
	stop: () => void;
	clear: () => void;
	setDraft: (draft: string) => void;
	setProvider: (provider: TextProvider) => void;
	setTab: (tab: AssistantTab) => void;
	setProposalStatus: (turnId: string, proposalId: string, status: ProposalStatus) => void;
};

/** The conversation and what can be done with it. Outside the desktop app there is no API, so sending does nothing. */
export const useAssistant = (): AssistantState & AssistantActions => {
	const { store } = useAssistantContext();
	const api = useApi();
	const state = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
	return {
		...state,
		clear: () => (api === null ? undefined : store.clear(api)),
		send: (provider, text) => {
			if (api !== null) void store.send(api, provider, text);
		},
		setDraft: store.setDraft,
		setProposalStatus: store.setProposalStatus,
		setProvider: store.setProvider,
		setTab: store.setTab,
		stop: () => (api === null ? undefined : store.stop(api)),
	};
};
