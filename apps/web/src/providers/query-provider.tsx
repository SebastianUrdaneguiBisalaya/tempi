'use client';

import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { DomainError, DomainIssue } from '@tempi/core';
import { issueTranslation, type LeafPaths, type Translations } from '@tempi/i18n';
import { type ReactNode, useState } from 'react';
import { toast } from '@/components/ui/toast';
import { i18n } from '@/lib/i18n';

/** A translation key in `common.toasts`. */
export type ToastMessageKey = `toasts.${LeafPaths<Translations['common']['toasts']>}`;

type ErrorFeedbackMeta = {
	/** The caller (a form) shows issues that have a `field`; the error toast shows only the rest. */
	handlesFieldErrors?: boolean;
};

declare module '@tanstack/react-query' {
	interface Register {
		// Query and mutation functions only throw use-case failures (see `unwrap`).
		defaultError: DomainError;
		mutationMeta: ErrorFeedbackMeta & {
			/** Shown as a success toast after the mutation succeeds. */
			successMessage?: ToastMessageKey;
		};
		queryMeta: ErrorFeedbackMeta;
	}
}

const translateIssue = (issue: DomainIssue): string => {
	const { key, options } = issueTranslation(issue);
	// Params are only known at runtime, so i18next can't check them per key; a `defaultValue` selects its untyped overload.
	// Every ErrorKey is translated (enforced in @tempi/i18n), so the generic message is only a safety net.
	return i18n.t(key, { ...options, defaultValue: i18n.t('system.unexpected', { ns: 'errors' }) });
};

/** Logs every issue for developers and shows the translated ones, once each, in a single error toast. */
const showError = (error: DomainError, meta: ErrorFeedbackMeta | undefined): void => {
	for (const issue of error.issues) console.error(`[${error.code}] ${issue.key}: ${issue.detail}`);

	const shown = meta?.handlesFieldErrors === true ? error.issues.filter(issue => issue.field === undefined) : error.issues;
	const [title, ...rest] = [...new Set(shown.map(translateIssue))];
	if (title === undefined) return;
	toast.add({ description: rest.length > 0 ? rest.join(' ') : undefined, title, type: 'error' });
};

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
		// Feedback lives here, once, so data hooks only declare `meta` and never call `toast` themselves.
		mutationCache: new MutationCache({
			onError: (error, _variables, _context, mutation) => showError(error, mutation.meta),
			onSuccess: (_data, _variables, _context, mutation) => {
				const message = mutation.meta?.successMessage;
				if (message !== undefined) toast.add({ title: i18n.t(message), type: 'success' });
			},
		}),
		queryCache: new QueryCache({
			onError: (error, query) => showError(error, query.meta),
		}),
	});

/** One query cache for the app's lifetime, shared by every data hook. */
export function QueryProvider({ children }: { children: ReactNode }) {
	const [queryClient] = useState(createQueryClient);
	return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
