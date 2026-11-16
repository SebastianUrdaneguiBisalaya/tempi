'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { CalendarEvent, EventPatch, NewEventInput, TimeRange } from '@tempi/core';
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

/**
 * Moves or resizes an event from the grid (drag or keyboard). The grids show the new times right away, so repeated
 * key presses build on each other; any failure refetches the stored times. Errors go to a toast: there is no form.
 */
export const useRescheduleEvent = () => {
	const api = useApi();
	const queryClient = useQueryClient();
	const invalidate = useInvalidateEvents();
	return useMutation({
		mutationFn: async ({ id, range }: { id: string; range: TimeRange }) => {
			if (api === null) throw STORAGE_UNAVAILABLE;
			return unwrap(await api.events.update({ endAt: range.endAt, id, startAt: range.startAt }));
		},
		meta: { successMessage: 'toasts.eventUpdated' },
		onMutate: async ({ id, range }) => {
			await queryClient.cancelQueries({ queryKey: queryKeys.events.all });
			queryClient.setQueriesData<CalendarEvent[]>({ queryKey: queryKeys.events.all }, events => events?.map(event => (event.id === id ? { ...event, ...range } : event)));
		},
		onSettled: invalidate,
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
