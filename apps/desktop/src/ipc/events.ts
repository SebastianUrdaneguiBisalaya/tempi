import type { EventRepository } from '@tempi/core';
import { CHANNELS } from '@tempi/ipc';
import { type HandlerContext, handle } from './handle';

export const registerEventHandlers = (context: HandlerContext, events: EventRepository): void => {
	handle(context, CHANNELS.events.get, id => events.findById(id));
	handle(context, CHANNELS.events.list, range => events.listInRange(range));
	handle(context, CHANNELS.events.save, async event => {
		await events.save(event);
		return null;
	});
	handle(context, CHANNELS.events.deleteByCalendar, async ({ calendarId, deletedAt }) => {
		await events.softDeleteByCalendar(calendarId, deletedAt);
		return null;
	});
};
