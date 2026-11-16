import { type CoreDeps, createEvent, deleteEvent, deleteOccurrence, duplicateEvent, listEvents, restoreEvent, searchEvents, updateEvent, updateOccurrence } from '@tempi/core';
import { CHANNELS } from '@tempi/ipc';
import { type HandlerContext, handle } from './handle';

/** `onChanged` runs after every committed write, so main-process views of the events (reminders) can refresh. */
export const registerEventHandlers = (context: HandlerContext, deps: CoreDeps, onChanged?: () => void): void => {
	const changed = () => onChanged?.();
	handle(context, CHANNELS.events.list, range => listEvents(deps, range));
	handle(context, CHANNELS.events.search, query => searchEvents(deps, query));
	handle(context, CHANNELS.events.create, input => createEvent(deps, input), changed);
	handle(context, CHANNELS.events.update, ({ id, ...patch }) => updateEvent(deps, id, patch), changed);
	handle(context, CHANNELS.events.delete, id => deleteEvent(deps, id), changed);
	handle(context, CHANNELS.events.restore, id => restoreEvent(deps, id), changed);
	handle(context, CHANNELS.events.updateOccurrence, ({ originalStartAt, scope, seriesId, ...patch }) => updateOccurrence(deps, { originalStartAt, scope, seriesId }, patch), changed);
	handle(context, CHANNELS.events.deleteOccurrence, target => deleteOccurrence(deps, target), changed);
	handle(context, CHANNELS.events.duplicate, id => duplicateEvent(deps, id), changed);
};
