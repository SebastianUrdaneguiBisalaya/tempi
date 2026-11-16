'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { DomainError } from '@tempi/core';
import { type ReactNode, useState } from 'react';

declare module '@tanstack/react-query' {
	interface Register {
		// Query and mutation functions only throw use-case failures (see `unwrap`).
		defaultError: DomainError;
	}
}

const createQueryClient = () =>
	new QueryClient({
		defaultOptions: {
			mutations: {
				// Data is local: never pause because the OS reports being offline.
				networkMode: 'always',
				retry: false,
			},
			queries: {
				networkMode: 'always',
				// Use cases fail deterministically (validation, not found); retrying only delays the error.
				retry: false,
				// This app is the only writer, so cached data changes only when a mutation invalidates it.
				refetchOnReconnect: false,
				refetchOnWindowFocus: false,
				staleTime: Number.POSITIVE_INFINITY,
			},
		},
	});

/** One query cache for the app's lifetime, shared by every data hook. */
export function QueryProvider({ children }: { children: ReactNode }) {
	const [queryClient] = useState(createQueryClient);
	return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
