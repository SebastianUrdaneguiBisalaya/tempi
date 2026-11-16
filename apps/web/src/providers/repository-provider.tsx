'use client';

import { type CoreDeps, systemClock, uuidv7Ids } from '@tempi/core';
import { createIpcRepositories, type DesktopApi } from '@tempi/ipc';
import { createContext, type ReactNode, use, useSyncExternalStore } from 'react';

const RepositoryContext = createContext<CoreDeps | null>(null);

// `window.desktop` is set by the preload before any script runs and never changes, so there is nothing to subscribe to.
const subscribe = () => () => {
	// Nothing to unsubscribe from.
};
const getDesktop = (): DesktopApi | null => window.desktop ?? null;
// The static export is prerendered without a window.
const getServerDesktop = (): DesktopApi | null => null;

// One set of adapters per bridge, so consumers get stable port instances across renders.
let cached: { api: DesktopApi; deps: CoreDeps } | null = null;
const depsFor = (api: DesktopApi): CoreDeps => {
	if (cached?.api !== api) cached = { api, deps: { ...createIpcRepositories(api), clock: systemClock, ids: uuidv7Ids } };
	return cached.deps;
};

/** Injects the core ports: IPC adapters inside the desktop app, nothing elsewhere (plain browser, prerender). */
export function RepositoryProvider({ children }: { children: ReactNode }) {
	const desktop = useSyncExternalStore(subscribe, getDesktop, getServerDesktop);
	return <RepositoryContext value={desktop === null ? null : depsFor(desktop)}>{children}</RepositoryContext>;
}

/** The core ports for use cases, or null when storage is unavailable (not running inside the desktop app). */
export const useRepositories = (): CoreDeps | null => use(RepositoryContext);
