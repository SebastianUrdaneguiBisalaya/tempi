import { type CoreDeps, createCalendar, deleteCalendar, listCalendars, ok, updateCalendar } from '@tempi/core';
import { CHANNELS } from '@tempi/ipc';
import { type HandlerContext, handle } from './handle';

/** `onChanged` runs after a committed write that can change which events are shown: a calendar hidden, shown or deleted. */
export const registerCalendarHandlers = (context: HandlerContext, deps: CoreDeps, onChanged?: () => void): void => {
	const changed = () => onChanged?.();
	handle(context, CHANNELS.calendars.list, async () => ok(await listCalendars(deps)));
	handle(context, CHANNELS.calendars.create, input => createCalendar(deps, input));
	handle(context, CHANNELS.calendars.update, ({ id, ...patch }) => updateCalendar(deps, id, patch), changed);
	handle(context, CHANNELS.calendars.delete, input => deleteCalendar(deps, input), changed);
};
