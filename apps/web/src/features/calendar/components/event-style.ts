import type { CalendarEvent } from '@tempi/core';
import type { CSSProperties } from 'react';

/** How an event reads at a glance: tentative ones are striped, past ones are muted. */
export type EventLook = { past: boolean; tentative: boolean };

/** True once the event has ended; false while prerendering (`now` is null). */
export const isPast = (event: Pick<CalendarEvent, 'endAt'>, now: number | null): boolean => now !== null && Date.parse(event.endAt) <= now;

export const eventLook = (event: Pick<CalendarEvent, 'endAt' | 'status'>, now: number | null): EventLook => ({ past: isPast(event, now), tentative: event.status === 'tentative' });

/**
 * Fill and accent for an event tinted with its calendar's color. Everything is mixed with the theme's own
 * background and muted colors, so it reads the same in light and dark: confirmed is a solid tint, tentative a
 * lighter tint with diagonal stripes, and past events lose half their tint and turn their accent grey.
 */
export const eventSurface = (color: string, { past, tentative }: EventLook, strength: number): { accent: string; style: CSSProperties } => {
	const tint = past ? Math.round(strength / 2) : strength;
	const accent = past ? `color-mix(in oklab, ${color} 40%, var(--muted-foreground))` : color;
	const style: CSSProperties = tentative
		? {
				backgroundColor: `color-mix(in oklab, ${accent} ${Math.round(tint / 2)}%, var(--background))`,
				backgroundImage: `repeating-linear-gradient(135deg, color-mix(in oklab, ${accent} ${tint}%, transparent) 0 0.25rem, transparent 0.25rem 0.5rem)`,
			}
		: { backgroundColor: `color-mix(in oklab, ${accent} ${tint}%, var(--background))` };
	return { accent, style };
};
