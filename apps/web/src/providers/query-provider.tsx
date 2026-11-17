'use client';

import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { DomainError, DomainIssue } from '@tempi/core';
import { issueTranslation, type LeafPaths, type Translations } from '@tempi/i18n';
import { type ReactNode, useState } from 'react';
import { toast } from '@/components/ui/toast';
import { i18n } from '@/lib/i18n';
import { offerUndo, runUndo, withdrawUndo } from '@/lib/undo';

type ToastMessages = Translations['common']['toasts'];

/** A translation key in `common.toasts` without placeholders; toasts with values come from `successToast`. */
export type ToastMessageKey = `toasts.${{ [K in LeafPaths<ToastMessages>]: ToastMessages[K] extends `${string}{{${string}` ? never : K }[LeafPaths<ToastMessages>]}`;

type ErrorFeedbackMeta = {
	/** The caller (a form) shows issues that have a `field`; the error toast shows only the rest. */
	handlesFieldErrors?: boolean;
	/** A failure the user can't act on (e.g. a best-effort probe): issues are only logged, never toasted. */
	silentErrors?: boolean;
};

declare module '@tanstack/react-query' {
	interface Register {
		// Query and mutation functions only throw use-case failures (see `unwrap`).
		defaultError: DomainError;
		mutationMeta: ErrorFeedbackMeta & {
			/** Shown as a loading toast while the mutation runs (e.g. a long import), replaced by the outcome's toast. */
			progressMessage?: ToastMessageKey;
			/** Shown as a success toast after the mutation succeeds. */
			successMessage?: ToastMessageKey;
			/** A success toast that depends on the result, already translated by the hook; null shows none (e.g. a canceled dialog). */
			successToast?: (data: unknown) => string | null;
			/** Reverts a successful mutation from its variables. Adds Undo to the success toast and makes it the ⌘Z action. */
			undo?: (variables: unknown) => void;
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
	if (meta?.silentErrors === true) return;

	const shown = meta?.handlesFieldErrors === true ? error.issues.filter(issue => issue.field === undefined) : error.issues;
	const [title, ...rest] = [...new Set(shown.map(translateIssue))];
	if (title === undefined) return;
	toast.add({ description: rest.length > 0 ? rest.join(' ') : undefined, title, type: 'error' });
};

// Loading toasts of running mutations, closed once each settles.
const progressToasts = new WeakMap<object, string>();

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
			onMutate: (_variables, mutation) => {
				const progress = mutation.meta?.progressMessage;
				if (progress !== undefined) progressToasts.set(mutation, toast.add({ timeout: 0, title: i18n.t(progress), type: 'loading' }));
			},
			onSettled: (_data, _error, _variables, _context, mutation) => {
				const id = progressToasts.get(mutation);
				if (id !== undefined) toast.close(id);
				progressToasts.delete(mutation);
			},
			onSuccess: (data, variables, _context, mutation) => {
				const custom = mutation.meta?.successToast?.(data);
				if (custom != null) {
					toast.add({ title: custom, type: 'success' });
					return;
				}
				const message = mutation.meta?.successMessage;
				if (message === undefined) return;
				const undo = mutation.meta?.undo;
				if (undo === undefined) {
					toast.add({ title: i18n.t(message), type: 'success' });
					return;
				}
				let toastId = '';
				const undoId = offerUndo(() => {
					toast.close(toastId);
					undo(variables);
				});
				toastId = toast.add({
					actionProps: { children: i18n.t('actions.undo'), onClick: () => runUndo() },
					onClose: () => withdrawUndo(undoId),
					title: i18n.t(message),
					type: 'success',
				});
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
