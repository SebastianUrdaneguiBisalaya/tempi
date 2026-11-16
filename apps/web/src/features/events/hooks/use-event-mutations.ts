'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { EventPatch, NewEventInput } from '@tempi/core';
import { queryKeys, STORAGE_UNAVAILABLE, unwrap } from '@/lib/query';
import { useApi } from '@/providers/api-provider';

// Every event mutation refreshes every view of events (grid, month, lane) through the domain's root key.
const useInvalidateEvents = () => {
	const queryClient = useQueryClient();
	return () => queryClient.invalidateQueries({ queryKey: queryKeys.events.all });
};

export const useCreateEvent = () => {
	const api = useApi();
	const invalidate = useInvalidateEvents();
	return useMutation({
		mutationFn: async (input: NewEventInput) => {
			if (api === null) throw STORAGE_UNAVAILABLE;
			return unwrap(await api.events.create(input));
		},
		meta: { handlesFieldErrors: true, successMessage: 'toasts.eventCreated' },
		onSuccess: invalidate,
	});
};

export const useUpdateEvent = () => {
	const api = useApi();
	const invalidate = useInvalidateEvents();
	return useMutation({
		mutationFn: async ({ id, patch }: { id: string; patch: EventPatch }) => {
			if (api === null) throw STORAGE_UNAVAILABLE;
			return unwrap(await api.events.update({ ...patch, id }));
		},
		meta: { handlesFieldErrors: true, successMessage: 'toasts.eventUpdated' },
		onSuccess: invalidate,
	});
};

export const useRestoreEvent = () => {
	const api = useApi();
	const invalidate = useInvalidateEvents();
	return useMutation({
		mutationFn: async (id: string) => {
			if (api === null) throw STORAGE_UNAVAILABLE;
			return unwrap(await api.events.restore(id));
		},
		meta: { successMessage: 'toasts.eventRestored' },
		onSuccess: invalidate,
	});
};

/** Deletes an event; its toast offers Undo (also ⌘Z), which restores it. */
export const useDeleteEvent = () => {
	const api = useApi();
	const invalidate = useInvalidateEvents();
	const restore = useRestoreEvent();
	return useMutation({
		mutationFn: async (id: string) => {
			if (api === null) throw STORAGE_UNAVAILABLE;
			return unwrap(await api.events.delete(id));
		},
		meta: {
			successMessage: 'toasts.eventDeleted',
			undo: id => {
				if (typeof id === 'string') restore.mutate(id);
			},
		},
		onSuccess: invalidate,
	});
};
