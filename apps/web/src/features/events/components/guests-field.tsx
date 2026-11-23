'use client';

import { guestEmailSchema, zodErrorKeyMap } from '@tempi/core';
import { PlusIcon, XIcon } from 'lucide-react';
import { type KeyboardEvent, type Ref, useState } from 'react';
import type { FieldError } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { FormFieldError } from '@/components/form-field-error';
import { Badge } from '@/components/ui/badge';
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field';
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from '@/components/ui/input-group';

type GuestsFieldProps = {
	/** Without a writable Google calendar there is no one to send the invitations. */
	available: boolean;
	error: FieldError | undefined;
	id: string;
	onChange: (guests: string[]) => void;
	/** Someone else's event: its guests only change on Google. */
	readOnly: boolean;
	ref: Ref<HTMLInputElement>;
	value: string[];
};

/** The guests' emails: typed one at a time (Enter or the add button), each checked with core's schema, and removable. */
export function GuestsField({ available, error, id, onChange, readOnly, ref, value }: GuestsFieldProps) {
	const { t } = useTranslation();
	const [draft, setDraft] = useState('');
	const [draftError, setDraftError] = useState<FieldError | undefined>(undefined);
	const disabled = !available || readOnly;
	const hintId = `${id}-hint`;
	const errorId = `${id}-error`;

	const add = () => {
		if (draft.trim() === '') return;
		const parsed = guestEmailSchema.safeParse(draft, { error: zodErrorKeyMap });
		if (!parsed.success) {
			setDraftError({ message: parsed.error.issues[0]?.message ?? 'validation.email', type: 'validate' });
			return;
		}
		if (!value.includes(parsed.data)) onChange([...value, parsed.data]);
		setDraft('');
		setDraftError(undefined);
	};
	const addOnEnter = (event: KeyboardEvent<HTMLInputElement>) => {
		if (event.key !== 'Enter') return;
		// Enter adds the guest instead of submitting the event form.
		event.preventDefault();
		add();
	};
	const shownError = draftError ?? error;
	const hint = !available ? 'events.form.guestsUnavailable' : readOnly ? 'events.form.guestsReadOnly' : 'events.form.guestsHint';

	return (
		<Field data-disabled={disabled || undefined} data-invalid={shownError !== undefined || undefined}>
			<FieldLabel htmlFor={disabled ? undefined : id}>{t('events.form.guests')}</FieldLabel>
			{!disabled && (
				<InputGroup>
					<InputGroupInput
						aria-describedby={shownError === undefined ? hintId : `${hintId} ${errorId}`}
						aria-invalid={shownError !== undefined || undefined}
						autoComplete='email'
						id={id}
						inputMode='email'
						onChange={event => {
							setDraft(event.target.value);
							setDraftError(undefined);
						}}
						onKeyDown={addOnEnter}
						placeholder={t('events.form.guestsPlaceholder')}
						ref={ref}
						type='email'
						value={draft}
					/>
					<InputGroupAddon align='inline-end'>
						<InputGroupButton aria-label={t('events.form.guestAdd')} onClick={add} size='icon-xs' title={t('events.form.guestAdd')}>
							<PlusIcon />
						</InputGroupButton>
					</InputGroupAddon>
				</InputGroup>
			)}
			{value.length > 0 && (
				<ul aria-label={t('events.form.guests')} className='flex flex-wrap gap-1.5'>
					{value.map(email => (
						<li className='min-w-0 max-w-full' key={email}>
							<Badge className='max-w-full gap-1 pr-0.5' variant='secondary'>
								<span className='truncate'>{email}</span>
								{!disabled && (
									<button
										aria-label={t('events.form.guestRemove', { email })}
										className='inline-flex size-4 shrink-0 items-center justify-center rounded-sm hover:bg-foreground/10 focus-visible:outline-2 focus-visible:outline-ring'
										onClick={() => onChange(value.filter(guest => guest !== email))}
										type='button'
									>
										<XIcon aria-hidden className='size-3' />
									</button>
								)}
							</Badge>
						</li>
					))}
				</ul>
			)}
			<FieldDescription id={hintId}>{t(hint)}</FieldDescription>
			<FormFieldError error={shownError} id={errorId} />
		</Field>
	);
}
