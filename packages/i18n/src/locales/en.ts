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
		toasts: {
			settingsSaved: 'Settings saved.',
		},
	},
	// Keys mirror core's ERROR_KEYS. Interpolation values come from `DomainIssue.params`.
	errors: {
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
