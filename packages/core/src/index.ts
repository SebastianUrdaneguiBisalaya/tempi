export type { AvatarImage, AvatarType } from './domain/avatar';
export { AVATAR_TYPES, avatarFileNameSchema, avatarImageSchema, MAX_AVATAR_BYTES } from './domain/avatar';
export type { Calendar, CalendarFields, CalendarPatch, CalendarSource, DeleteCalendarInput, NewCalendarInput } from './domain/calendar';
export { CALENDAR_PALETTE, CALENDAR_SOURCES, calendarFieldsSchema, calendarPatchSchema, calendarSchema, deleteCalendarInputSchema, newCalendarInputSchema, pickCalendarColor } from './domain/calendar';
export type { CalendarView } from './domain/calendar-view';
export { CALENDAR_VIEWS, daysToUtcRange, isCalendarView, isWeekend, shiftDate, startOfWeek, visibleDays } from './domain/calendar-view';
export type { DateRange } from './domain/date-range';
export { dateRangeSchema, overlapsRange } from './domain/date-range';
export type { DaySegment } from './domain/day-layout';
export { layoutDay, MINUTES_PER_DAY } from './domain/day-layout';
export type { ErrorKey } from './domain/error-keys';
export { ERROR_KEYS, isErrorKey } from './domain/error-keys';
export type { CalendarEvent, EventFields, EventOccurrence, EventPatch, EventStatus, NewEventInput, OccurrenceScope, OccurrenceTarget } from './domain/event';
export { calendarEventSchema, EVENT_STATUSES, eventFieldsSchema, eventOccurrenceSchema, eventPatchSchema, newEventInputSchema, OCCURRENCE_SCOPES, occurrenceTargetSchema } from './domain/event';
export type { WeekSegment } from './domain/month-layout';
export { belongsInAllDayLane, fitWeek, itemDays, layoutWeek, monthWeeks, weekNumber } from './domain/month-layout';
export type { OnboardingInput } from './domain/onboarding';
export { onboardingInputSchema } from './domain/onboarding';
export type { Recurrence, RecurrenceFrequency, RecurrencePreset, Weekday } from './domain/recurrence';
export {
	fromRrule,
	MONTHLY_MODES,
	monthWeekday,
	presetOf,
	presetRecurrence,
	RECURRENCE_ENDS,
	RECURRENCE_FREQUENCIES,
	RECURRENCE_PRESETS,
	recurrenceSchema,
	recurrenceSchemaFor,
	toRrule,
	WEEKDAYS,
} from './domain/recurrence';
export type { TimeRange } from './domain/reschedule';
export { moveRange, resizeRange, SNAP_MINUTES, sweepRange, wallTime } from './domain/reschedule';
export type { DomainError, DomainErrorCode, DomainIssue, IssueParams, Result } from './domain/result';
export { DOMAIN_ERROR_CODES, fail, ok, parseWith, toDomainIssue, zodErrorKeyMap } from './domain/result';
export type { Language, Settings, SettingsPatch, SettingsValues, Theme, TimeFormat, WeekStart } from './domain/settings';
export { DEFAULT_SETTINGS, LANGUAGES, resolveLanguage, settingsPatchSchema, settingsSchema, settingsValuesSchema, THEMES, TIME_FORMATS, WEEK_STARTS } from './domain/settings';
export type { Timestamps } from './domain/timestamps';
export { singletonTimestampsSchema, storedEntitySchema, timestampsSchema } from './domain/timestamps';
export type { ProfileInput, ProfileUpdateInput, UserProfile } from './domain/user-profile';
export { profileInputSchema, profileUpdateInputSchema, userProfileSchema } from './domain/user-profile';
export { uuidv7 } from './domain/uuidv7';
export { idSchema, isValidTimeZone, toUtcInstant, utcInstantSchema } from './domain/values';
export type { AvatarStore } from './ports/avatar-store';
export type { CalendarRepository } from './ports/calendar-repository';
export type { Clock } from './ports/clock';
export { systemClock } from './ports/clock';
export type { EventRepository } from './ports/event-repository';
export type { IdGenerator } from './ports/id-generator';
export { uuidv7Ids } from './ports/id-generator';
export type { ProfileRepository } from './ports/profile-repository';
export type { SettingsRepository } from './ports/settings-repository';
export type { OnboardingResult } from './use-cases/complete-onboarding';
export { completeOnboarding } from './use-cases/complete-onboarding';
export { createCalendar } from './use-cases/create-calendar';
export { createEvent } from './use-cases/create-event';
export { deleteCalendar } from './use-cases/delete-calendar';
export { deleteEvent } from './use-cases/delete-event';
export type { CoreDeps } from './use-cases/deps';
export { duplicateEvent } from './use-cases/duplicate-event';
export { getProfile } from './use-cases/get-profile';
export { getSettings } from './use-cases/get-settings';
export { initializeSettings } from './use-cases/initialize-settings';
export { listCalendars } from './use-cases/list-calendars';
export { listEvents } from './use-cases/list-events';
export { asOccurrence, deleteOccurrence, updateOccurrence } from './use-cases/occurrences';
export { restoreEvent } from './use-cases/restore-event';
export { saveProfile } from './use-cases/save-profile';
export { saveSettings } from './use-cases/save-settings';
export { eventSearchQuerySchema, SEARCH_LIMIT, searchEvents } from './use-cases/search-events';
export { updateCalendar } from './use-cases/update-calendar';
export { updateEvent } from './use-cases/update-event';
export { updateProfile } from './use-cases/update-profile';
