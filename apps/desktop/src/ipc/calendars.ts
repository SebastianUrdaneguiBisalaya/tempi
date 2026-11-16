import { type CoreDeps, createCalendar, deleteCalendar, listCalendars, ok, updateCalendar } from '@tempi/core';
import { CHANNELS } from '@tempi/ipc';
import { type HandlerContext, handle } from './handle';

export const registerCalendarHandlers = (context: HandlerContext, deps: CoreDeps): void => {
	handle(context, CHANNELS.calendars.list, async () => ok(await listCalendars(deps)));
	handle(context, CHANNELS.calendars.create, input => createCalendar(deps, input));
	handle(context, CHANNELS.calendars.update, ({ id, ...patch }) => updateCalendar(deps, id, patch));
	handle(context, CHANNELS.calendars.delete, id => deleteCalendar(deps, id));
};
