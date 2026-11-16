import { type CoreDeps, createEvent, deleteEvent, listEvents, restoreEvent, updateEvent } from '@tempi/core';
import { CHANNELS } from '@tempi/ipc';
import { type HandlerContext, handle } from './handle';

export const registerEventHandlers = (context: HandlerContext, deps: CoreDeps): void => {
	handle(context, CHANNELS.events.list, range => listEvents(deps, range));
	handle(context, CHANNELS.events.create, input => createEvent(deps, input));
	handle(context, CHANNELS.events.update, ({ id, ...patch }) => updateEvent(deps, id, patch));
	handle(context, CHANNELS.events.delete, id => deleteEvent(deps, id));
	handle(context, CHANNELS.events.restore, id => restoreEvent(deps, id));
};
