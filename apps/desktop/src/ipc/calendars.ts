import type { CalendarRepository } from '@tempi/core';
import { CHANNELS } from '@tempi/ipc';
import { type HandlerContext, handle } from './handle';

export const registerCalendarHandlers = (context: HandlerContext, calendars: CalendarRepository): void => {
	handle(context, CHANNELS.calendars.get, id => calendars.findById(id));
	handle(context, CHANNELS.calendars.list, () => calendars.list());
	handle(context, CHANNELS.calendars.save, async calendar => {
		await calendars.save(calendar);
		return null;
	});
};
