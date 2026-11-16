// Source locale: every other locale must have exactly these keys (enforced by `Messages` in ../types.ts).
export const en = {
	common: {
		actions: {
			cancel: 'Cancel',
			close: 'Close',
			confirm: 'Confirm',
			create: 'Create',
			delete: 'Delete',
			edit: 'Edit',
			save: 'Save',
		},
		calendar: {
			allDay: {
				collapse: 'Show fewer all-day events',
				expand: 'Show all all-day events',
				events: 'All-day: {{titles}}',
				more: '+{{count}} more',
			},
			grid: 'Schedule',
			month: {
				more: '+{{count}} more',
				week: 'Week {{number}}',
				weekNumber: 'Week',
			},
		},
		onboarding: {
			actions: {
				back: 'Back',
				finish: 'Get started',
				next: 'Continue',
				skip: 'Skip',
			},
			avatar: {
				change: 'Change photo',
				choose: 'Choose photo',
				description: 'Optional. It stays on this device.',
				invalid: 'This image can’t be used. Try another one.',
				remove: 'Remove photo',
				title: 'Add a profile photo',
			},
			language: {
				description: 'You can change it later in settings.',
				title: 'Choose your language',
			},
			location: {
				country: 'Country',
				countryEmpty: 'No countries found.',
				countryPlaceholder: 'Select a country',
				countrySearch: 'Search countries…',
				description: 'Your time zone keeps every event at the right hour.',
				timeZone: 'Time zone',
				title: 'Where are you?',
			},
			name: {
				description: 'It personalizes your calendar.',
				firstName: 'First name',
				lastName: 'Last name',
				title: 'What’s your name?',
			},
			progress: 'Step {{current}} of {{total}}',
			theme: {
				description: 'You can change it later in settings.',
				options: {
					dark: 'Dark',
					light: 'Light',
					system: 'System',
				},
				systemDescription: 'Follows your device.',
				title: 'Choose a theme',
			},
			title: 'Welcome to Tempi',
		},
		shell: {
			header: {
				label: 'Calendar navigation',
				next: {
					day: 'Next day',
					month: 'Next month',
					week: 'Next week',
				},
				previous: {
					day: 'Previous day',
					month: 'Previous month',
					week: 'Previous week',
				},
				today: 'Today',
			},
			panel: {
				label: 'Details',
				open: 'Open details',
				search: 'Search',
			},
			sidebar: {
				datePicker: 'Go to date',
				close: 'Close sidebar',
				label: 'Sidebar',
				toggle: 'Toggle sidebar',
			},
			views: {
				day: 'Day',
				label: 'View',
				month: 'Month',
				week: 'Week',
			},
		},
		toasts: {
			onboardingCompleted: 'You’re all set.',
			settingsSaved: 'Settings saved.',
		},
	},
	// Keys mirror core's ERROR_KEYS. Interpolation values come from `DomainIssue.params`.
	errors: {
		avatar: {
			fileName: 'This photo can’t be found.',
			tooLarge: 'This photo is too large.',
		},
		calendar: {
			color: 'Pick a valid color.',
			defaultNotDeletable: 'The default calendar can’t be deleted.',
			defaultRequired: 'Make another calendar the default first.',
			notFound: 'This calendar no longer exists.',
		},
		event: {
			endBeforeStart: 'The end must be after the start.',
			notFound: 'This event no longer exists.',
			rrule: 'The repeat rule isn’t valid.',
		},
		profile: {
			country: 'Pick a valid country.',
		},
		range: {
			endBeforeStart: 'The end of the range must be after its start.',
		},
		system: {
			unexpected: 'Something went wrong. Please try again.',
		},
		validation: {
			custom: 'This value isn’t valid.',
			instant: 'Enter a valid date and time.',
			integer: 'Enter a whole number.',
			invalid_element: 'One of the items isn’t valid.',
			invalid_format: 'The format isn’t valid.',
			invalid_key: 'One of the keys isn’t valid.',
			invalid_type: 'This value has the wrong type.',
			invalid_union: 'This value isn’t valid.',
			invalid_value: 'Pick one of the available options.',
			max: 'Must be {{maximum}} or less.',
			min: 'Must be {{minimum}} or more.',
			not_multiple_of: 'Must be a multiple of {{divisor}}.',
			required: 'This field is required.',
			timeZone: 'Pick a valid time zone.',
			too_big: 'Must be {{maximum}} or less.',
			too_small: 'Must be {{minimum}} or more.',
			unrecognized_keys: 'There are unknown fields.',
			url: 'Enter a valid http(s) link.',
		},
	},
} as const;
