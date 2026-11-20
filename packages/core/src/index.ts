export type { AiKeyFlags, AiKeyInput, AiProvider, AiSettings, AiSettingsPatch, AiSettingsValues, AiVoice, TextProvider } from './domain/ai-settings';
export {
	AI_PROVIDERS,
	aiKeyFlagsSchema,
	aiKeyInputSchema,
	aiProviderSchema,
	aiSettingsPatchSchema,
	aiSettingsSchema,
	aiSettingsValuesSchema,
	aiVoiceSchema,
	applyAiSettingsPatch,
	DEFAULT_AI_SETTINGS,
	ELEVENLABS_STT_MODELS,
	ELEVENLABS_TTS_MODELS,
	TEXT_MODELS,
	TEXT_PROVIDERS,
	voiceIdSchema,
} from './domain/ai-settings';
export type { AppUpdateState, AppUpdateStatus } from './domain/app-update';
export { APP_UPDATE_STATES, appUpdateStatusSchema, compareVersions, isNewerVersion } from './domain/app-update';
export type { AssistantChatInput, AssistantMessage, AssistantProposal, AssistantStreamEvent, AssistantTool } from './domain/assistant';
export {
	ASSISTANT_TOOLS,
	assistantChatInputSchema,
	assistantMessageSchema,
	assistantProposalSchema,
	assistantStreamEventSchema,
	MAX_ASSISTANT_MESSAGE_LENGTH,
	MAX_ASSISTANT_MESSAGES,
} from './domain/assistant';
export type { AvatarImage, AvatarType } from './domain/avatar';
export { AVATAR_TYPES, avatarFileNameSchema, avatarImageSchema, MAX_AVATAR_BYTES } from './domain/avatar';
export type { Calendar, CalendarFields, CalendarPatch, CalendarSource, DeleteCalendarInput, NewCalendarInput } from './domain/calendar';
export { CALENDAR_PALETTE, CALENDAR_SOURCES, calendarFieldsSchema, calendarPatchSchema, calendarSchema, deleteCalendarInputSchema, newCalendarInputSchema, pickCalendarColor } from './domain/calendar';
export type { DateRange } from './domain/date-range';
export { dateRangeSchema, overlapsRange } from './domain/date-range';
export type { DictationAudioType, Transcription, TranscriptionInput } from './domain/dictation';
export { DICTATION_AUDIO_TYPES, dictationAudioType, MAX_DICTATION_BYTES, MAX_DICTATION_SECONDS, transcriptionInputSchema, transcriptionSchema } from './domain/dictation';
export type { ErrorKey } from './domain/error-keys';
export { ERROR_KEYS, isErrorKey } from './domain/error-keys';
export type { CalendarEvent, EventFields, EventOccurrence, EventPatch, EventStatus, NewEventInput, OccurrenceScope, OccurrenceTarget } from './domain/event';
export {
	calendarEventSchema,
	EVENT_STATUSES,
	eventFieldsSchema,
	eventOccurrenceSchema,
	eventPatchSchema,
	MAX_REMINDER_MINUTES,
	NO_SERIES,
	newEventInputSchema,
	OCCURRENCE_SCOPES,
	occurrenceTargetSchema,
} from './domain/event';
export type { GoogleAccount, GoogleConnectResult } from './domain/google-account';
export { googleAccountSchema, googleConnectResultSchema } from './domain/google-account';
export type { GoogleAccessRole, GoogleCalendarChoice, GoogleCalendarLink, GoogleEventLink, GoogleSyncState, GoogleSyncStatus, SelectGoogleCalendarsInput } from './domain/google-sync';
export {
	GOOGLE_ACCESS_ROLES,
	GOOGLE_SYNC_STATES,
	googleCalendarChoiceSchema,
	googleCalendarLinkSchema,
	googleEventLinkSchema,
	googleSyncStatusSchema,
	isWritableRole,
	selectGoogleCalendarsInputSchema,
} from './domain/google-sync';
export type { ExportEventsInput, ImportEventsInput, ImportedEvent, ImportSummary } from './domain/ical-transfer';
export { exportEventsInputSchema, importEventsInputSchema, importedEventSchema } from './domain/ical-transfer';
export type { MeetingLink, MeetingProvider } from './domain/meeting-link';
export { MEETING_PROVIDERS, meetingLink } from './domain/meeting-link';
export type { OnboardingInput } from './domain/onboarding';
export { onboardingInputSchema } from './domain/onboarding';
export type { OsPermission, OsPermissionState, OsPermissionStatus, OsPermissionsStatus } from './domain/os-permission';
export { OS_PERMISSION_STATES, OS_PERMISSIONS, osPermissionSchema, osPermissionsStatusSchema } from './domain/os-permission';
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
export type { RemainingToday } from './domain/remaining-today';
export { remainingToday, todayRange } from './domain/remaining-today';
export type { DomainError, DomainErrorCode, DomainIssue, IssueParams, Result } from './domain/result';
export { DOMAIN_ERROR_CODES, domainErrorSchema, fail, ok, parseWith, toDomainIssue, zodErrorKeyMap } from './domain/result';
export type { Language, Settings, SettingsPatch, SettingsValues, Theme, TimeFormat, UiSound, WeekStart } from './domain/settings';
export { DEFAULT_SETTINGS, LANGUAGES, resolveLanguage, settingsPatchSchema, settingsSchema, settingsValuesSchema, THEMES, TIME_FORMATS, UI_SOUNDS, WEEK_STARTS } from './domain/settings';
export type { Speech, SpeechInput } from './domain/speech';
export { MAX_SPEECH_LENGTH, SPEECH_AUDIO_TYPE, speechInputSchema, speechSchema } from './domain/speech';
export type { Timestamps } from './domain/timestamps';
export { singletonTimestampsSchema, storedEntitySchema, timestampsSchema } from './domain/timestamps';
export { UPCOMING_WINDOW_HOURS, upcomingEvents } from './domain/upcoming';
export type { ProfileInput, ProfileUpdateInput, UserProfile } from './domain/user-profile';
export { profileInputSchema, profileUpdateInputSchema, userProfileSchema } from './domain/user-profile';
export { uuidv7 } from './domain/uuidv7';
export { idSchema, isValidTimeZone, toUtcInstant, utcInstantSchema } from './domain/values';
export type { AvatarStore } from './ports/avatar-store';
export type { CalendarRepository } from './ports/calendar-repository';
export type { Clock } from './ports/clock';
export { systemClock } from './ports/clock';
export type { EventRepository } from './ports/event-repository';
export type { GoogleSyncRepository } from './ports/google-sync-repository';
export type { IdGenerator } from './ports/id-generator';
export { uuidv7Ids } from './ports/id-generator';
export type { ProfileRepository } from './ports/profile-repository';
export type { SettingsRepository } from './ports/settings-repository';
export type { OnboardingResult } from './use-cases/complete-onboarding';
export { completeOnboarding } from './use-cases/complete-onboarding';
export { countRemainingToday } from './use-cases/count-remaining-today';
export { createCalendar } from './use-cases/create-calendar';
export { createEvent } from './use-cases/create-event';
export { deleteCalendar } from './use-cases/delete-calendar';
export { deleteEvent } from './use-cases/delete-event';
export type { CoreDeps } from './use-cases/deps';
export { duplicateEvent } from './use-cases/duplicate-event';
export type { ExportedCalendars } from './use-cases/export-events';
export { exportEvents } from './use-cases/export-events';
export { getProfile } from './use-cases/get-profile';
export { getSettings } from './use-cases/get-settings';
export { detachGoogleCalendar, disconnectGoogleCalendars, listGoogleCalendars, selectGoogleCalendars } from './use-cases/google-calendars';
export { importEvents } from './use-cases/import-events';
export { initializeSettings } from './use-cases/initialize-settings';
export { listCalendars } from './use-cases/list-calendars';
export { listEvents } from './use-cases/list-events';
export type { Reminder } from './use-cases/list-reminders';
export { listReminders } from './use-cases/list-reminders';
export { asOccurrence, deleteOccurrence, updateOccurrence } from './use-cases/occurrences';
export { restoreEvent } from './use-cases/restore-event';
export { saveProfile } from './use-cases/save-profile';
export { saveSettings } from './use-cases/save-settings';
export { eventSearchQuerySchema, SEARCH_LIMIT, searchEvents } from './use-cases/search-events';
export { updateCalendar } from './use-cases/update-calendar';
export { updateEvent } from './use-cases/update-event';
export type { ProfileUpdate } from './use-cases/update-profile';
export { updateProfile } from './use-cases/update-profile';
export { writableCalendar } from './use-cases/writable-calendar';
