'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { asOccurrence, type EventOccurrence, type EventPatch, type NewEventInput, type OccurrenceScope, type TimeRange } from '@tempi/core';
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
		/** `scope` is required for an occurrence of a recurring event. */
		mutationFn: async ({ occurrence, range, scope }: { occurrence: EventOccurrence; range: TimeRange; scope?: OccurrenceScope }): Promise<EventOccurrence> => {
			if (api === null) throw STORAGE_UNAVAILABLE;
			const times = { endAt: range.endAt, startAt: range.startAt };
			if (occurrence.series === null || scope === undefined) return asOccurrence(unwrap(await api.events.update({ ...times, id: occurrence.id })));
			return unwrap(await api.events.updateOccurrence({ ...times, originalStartAt: occurrence.series.originalStartAt, scope, seriesId: occurrence.series.id }));
		},
		meta: { successMessage: 'toasts.eventUpdated' },
		// Only the moved occurrence moves until the refetch shows the rest of its series.
		onMutate: async ({ occurrence, range }) => {
			await queryClient.cancelQueries({ queryKey: queryKeys.events.all });
			queryClient.setQueriesData<EventOccurrence[]>({ queryKey: queryKeys.events.all }, events => events?.map(event => (event.key === occurrence.key ? { ...event, ...range } : event)));
		},
		onSettled: invalidate,
	});
};

/** Edits one occurrence of a recurring event, it and the following ones, or the whole series. */
export const useUpdateOccurrence = () => {
	const api = useApi();
	const invalidate = useInvalidateEvents();
	return useMutation({
		mutationFn: async ({ occurrence, patch, scope }: { occurrence: EventOccurrence & { series: NonNullable<EventOccurrence['series']> }; patch: EventPatch; scope: OccurrenceScope }) => {
			if (api === null) throw STORAGE_UNAVAILABLE;
			return unwrap(await api.events.updateOccurrence({ ...patch, originalStartAt: occurrence.series.originalStartAt, scope, seriesId: occurrence.series.id }));
		},
		meta: { handlesFieldErrors: true, successMessage: 'toasts.eventUpdated' },
		onSuccess: invalidate,
	});
};

/** Deletes one occurrence of a recurring event, it and the following ones, or the whole series. There is no undo. */
export const useDeleteOccurrence = () => {
	const api = useApi();
	const invalidate = useInvalidateEvents();
	return useMutation({
		mutationFn: async ({ series, scope }: { scope: OccurrenceScope; series: NonNullable<EventOccurrence['series']> }) => {
			if (api === null) throw STORAGE_UNAVAILABLE;
			return unwrap(await api.events.deleteOccurrence({ originalStartAt: series.originalStartAt, scope, seriesId: series.id }));
		},
		meta: { successMessage: 'toasts.eventDeleted' },
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
