'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { Calendar, CalendarPatch, DeleteCalendarInput, NewCalendarInput } from '@tempi/core';
import { queryKeys, STORAGE_UNAVAILABLE, unwrap } from '@/lib/query';
import { useApi } from '@/providers/api-provider';

// A calendar change can change how events show (color, visibility) or which exist (delete), so both refresh.
const useInvalidateCalendars = () => {
	const queryClient = useQueryClient();
	return () => Promise.all([queryClient.invalidateQueries({ queryKey: queryKeys.calendars.all }), queryClient.invalidateQueries({ queryKey: queryKeys.events.all })]);
};

export const useCreateCalendar = () => {
	const api = useApi();
	const invalidate = useInvalidateCalendars();
	return useMutation({
		mutationFn: async (input: NewCalendarInput) => {
			if (api === null) throw STORAGE_UNAVAILABLE;
			return unwrap(await api.calendars.create(input));
		},
		meta: { handlesFieldErrors: true, successMessage: 'toasts.calendarCreated' },
		onSuccess: invalidate,
	});
};

const updateCalendarFn =
	(api: ReturnType<typeof useApi>) =>
	async ({ id, patch }: { id: string; patch: CalendarPatch }) => {
		if (api === null) throw STORAGE_UNAVAILABLE;
		return unwrap(await api.calendars.update({ ...patch, id }));
	};

/** Renames, recolors or makes a calendar the default. */
export const useUpdateCalendar = () => {
	const api = useApi();
	const invalidate = useInvalidateCalendars();
	return useMutation({
		mutationFn: updateCalendarFn(api),
		meta: { handlesFieldErrors: true, successMessage: 'toasts.calendarUpdated' },
		onSuccess: invalidate,
	});
};

/**
 * Shows or hides a calendar's events. A view preference toggled in place, like collapsing the all-day lane: it
 * applies at once (optimistic) without a toast, and a failed save restores it and shows the error.
 */
export const useSetCalendarVisible = () => {
	const api = useApi();
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: ({ id, isVisible }: { id: string; isVisible: boolean }) => updateCalendarFn(api)({ id, patch: { isVisible } }),
		onMutate: async ({ id, isVisible }) => {
			await queryClient.cancelQueries({ queryKey: queryKeys.calendars.all });
			const previous = queryClient.getQueryData<Calendar[]>(queryKeys.calendars.all);
			queryClient.setQueryData<Calendar[]>(queryKeys.calendars.all, calendars => calendars?.map(calendar => (calendar.id === id ? { ...calendar, isVisible } : calendar)));
			return { previous };
		},
		onError: (_error, _variables, context) => queryClient.setQueryData(queryKeys.calendars.all, context?.previous),
		onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.calendars.all }),
	});
};

export const useDeleteCalendar = () => {
	const api = useApi();
	const invalidate = useInvalidateCalendars();
	return useMutation({
		mutationFn: async (input: DeleteCalendarInput) => {
			if (api === null) throw STORAGE_UNAVAILABLE;
			return unwrap(await api.calendars.delete(input));
		},
		meta: { successMessage: 'toasts.calendarDeleted' },
		onSuccess: invalidate,
	});
};
