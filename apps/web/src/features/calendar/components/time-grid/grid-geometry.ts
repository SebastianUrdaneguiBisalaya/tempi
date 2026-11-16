import { MINUTES_PER_DAY } from '@tempi/core';
import type { CSSProperties } from 'react';

// Sizes in rem so the grid follows the user's font size. Every position below derives from these.
export const SLOT_MINUTES = 30;
export const SLOTS_PER_DAY = MINUTES_PER_DAY / SLOT_MINUTES;
const SLOT_REM = 1.5;
/** Day headers; the all-day lane adds its rows below them. */
export const DAY_HEADER_REM = 3;
/** One row of the all-day lane. */
export const ALL_DAY_LANE_REM = 1.375;
export const GUTTER_REM = 4;
/** Narrowest day column in the week view; below it the grid scrolls sideways. */
const MIN_DAY_REM = 7;
/** Shortest height an event is drawn with, so its title stays readable. Also spaces short events apart. */
export const MIN_EVENT_MINUTES = 15;

const minutesToRem = (minutes: number) => (minutes / SLOT_MINUTES) * SLOT_REM;

// The header height varies with the all-day lane; children read it from this variable instead of a prop.
const HEADER = 'var(--time-grid-header)';

/** `headerRem`: day headers plus the all-day lane. */
export const gridStyle = (dayCount: number, headerRem: number): CSSProperties & Record<'--time-grid-header', string> => ({
	'--time-grid-header': `${headerRem}rem`,
	gridTemplateColumns: `${GUTTER_REM}rem repeat(${dayCount}, minmax(${dayCount > 1 ? MIN_DAY_REM : 0}rem, 1fr))`,
	gridTemplateRows: `${HEADER} repeat(${SLOTS_PER_DAY}, ${SLOT_REM}rem)`,
});

/** Absolute box for something spanning `[startMinute, endMinute)` in a day column, inside lane `column` of `columns`. */
export const boxStyle = (dayIndex: number, dayCount: number, startMinute: number, endMinute: number, column = 0, columns = 1): Pick<CSSProperties, 'height' | 'left' | 'top' | 'width'> => {
	const dayWidth = `(100% - ${GUTTER_REM}rem) / ${dayCount}`;
	return {
		height: `${minutesToRem(endMinute - startMinute)}rem`,
		left: `calc(${GUTTER_REM}rem + ${dayWidth} * ${dayIndex + column / columns})`,
		top: `calc(${HEADER} + ${minutesToRem(startMinute)}rem)`,
		width: `calc(${dayWidth} / ${columns})`,
	};
};

/** Scrolls the grid so the current hour (in the grid's time zone) sits near the top. Stable, so it runs once on mount. */
export const scrollToCurrentHour = (node: HTMLElement | null) => {
	const timeZone = node?.dataset.timeZone;
	const slot = node?.querySelector<HTMLElement>('[role="gridcell"]');
	if (!node || !timeZone || !slot) return;
	const hour = Temporal.Now.zonedDateTimeISO(timeZone).hour;
	// One hour of context above now.
	node.scrollTop = Math.max(0, hour - 1) * slot.offsetHeight * (60 / SLOT_MINUTES);
};
