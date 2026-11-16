import { SLOT_MINUTES, SLOTS_PER_DAY } from './grid-geometry';

const SLOTS_PER_HOUR = 60 / SLOT_MINUTES;

/** What has keyboard focus in the grid: a slot, or an event that starts in that slot. */
export type GridFocus = { day: number; eventId: string | null; slot: number };

/** Events by day index, each with the slot it starts in, in reading order (start, then lane). */
export type DayEvents = readonly (readonly { id: string; slot: number }[])[];

export const focusKey = ({ day, eventId, slot }: GridFocus): string => (eventId === null ? `${day}:${slot}` : `${day}:${slot}:${eventId}`);

// One day reads top to bottom as each slot followed by the events that start in it, so ↑/↓ walk slots and events alike.
const dayItems = (events: DayEvents, day: number): GridFocus[] =>
	Array.from({ length: SLOTS_PER_DAY }, (_, slot) => [
		{ day, eventId: null, slot },
		...(events[day] ?? []).filter(event => event.slot === slot).map(event => ({ day, eventId: event.id, slot })),
	]).flat();

/** Where focus goes for a key press, or null when the key isn't a grid key (or focus is already at the edge). */
export const nextFocus = (focus: GridFocus, key: string, ctrlKey: boolean, events: DayEvents, dayCount: number): GridFocus | null => {
	const slotIn = (day: number, slot: number): GridFocus => ({ day: Math.min(Math.max(day, 0), dayCount - 1), eventId: null, slot: Math.min(Math.max(slot, 0), SLOTS_PER_DAY - 1) });
	switch (key) {
		case 'ArrowDown':
		case 'ArrowUp': {
			const items = dayItems(events, focus.day);
			const index = items.findIndex(item => focusKey(item) === focusKey(focus));
			return items[index + (key === 'ArrowDown' ? 1 : -1)] ?? null;
		}
		case 'ArrowLeft':
			return focus.day > 0 ? slotIn(focus.day - 1, focus.slot) : null;
		case 'ArrowRight':
			return focus.day < dayCount - 1 ? slotIn(focus.day + 1, focus.slot) : null;
		case 'Home':
			return ctrlKey ? slotIn(focus.day, 0) : slotIn(0, focus.slot);
		case 'End':
			return ctrlKey ? slotIn(focus.day, SLOTS_PER_DAY - 1) : slotIn(dayCount - 1, focus.slot);
		case 'PageUp':
			return slotIn(focus.day, focus.slot - SLOTS_PER_HOUR);
		case 'PageDown':
			return slotIn(focus.day, focus.slot + SLOTS_PER_HOUR);
		default:
			return null;
	}
};
