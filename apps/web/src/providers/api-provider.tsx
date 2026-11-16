'use client';

import { createIpcClient, type DesktopApi, type TempiApi } from '@tempi/ipc';
import { createContext, type ReactNode, use, useSyncExternalStore } from 'react';

const ApiContext = createContext<TempiApi | null>(null);

// `window.desktop` is set by the preload before any script runs and never changes, so there is nothing to subscribe to.
const subscribe = () => () => {
	// Nothing to unsubscribe from.
};
const getDesktop = (): DesktopApi | null => window.desktop ?? null;
// The static export is prerendered without a window.
const getServerDesktop = (): DesktopApi | null => null;

// One client per bridge, so consumers get a stable instance across renders.
let cached: { client: TempiApi; desktop: DesktopApi } | null = null;
const clientFor = (desktop: DesktopApi): TempiApi => {
	if (cached?.desktop !== desktop) cached = { client: createIpcClient(desktop), desktop };
	return cached.client;
};

/** Injects the app's use cases: the IPC client inside the desktop app, nothing elsewhere (plain browser, prerender). */
export function ApiProvider({ children }: { children: ReactNode }) {
	const desktop = useSyncExternalStore(subscribe, getDesktop, getServerDesktop);
	return <ApiContext value={desktop === null ? null : clientFor(desktop)}>{children}</ApiContext>;
}

/** The app's use cases, or null when storage is unavailable (not running inside the desktop app). Every call returns a `Result`. */
export const useApi = (): TempiApi | null => use(ApiContext);
