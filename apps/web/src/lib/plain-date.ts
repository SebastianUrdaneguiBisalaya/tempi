// Bridges between calendar days (`Temporal.PlainDate`) and the `Date`s that react-day-picker and `Intl` formatters take.

/** Local midnight of `date`, for react-day-picker, which compares days in the system zone. */
export const toLocalDate = (date: Temporal.PlainDate): Date => new Date(date.year, date.month - 1, date.day);

export const fromLocalDate = (date: Date): Temporal.PlainDate => Temporal.PlainDate.from({ day: date.getDate(), month: date.getMonth() + 1, year: date.getFullYear() });

/** UTC midnight of `date`: format it with `timeZone: 'UTC'` to print that calendar day whatever the system zone. */
export const toUtcDate = (date: Temporal.PlainDate): Date => new Date(Date.UTC(date.year, date.month - 1, date.day));
