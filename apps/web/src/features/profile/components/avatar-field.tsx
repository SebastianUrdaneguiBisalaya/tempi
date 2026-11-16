'use client';

import { XIcon } from 'lucide-react';
import { type ChangeEvent, useEffect, useRef, useState } from 'react';
import { useController, useFormContext, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { FormFieldError } from '@/components/form-field-error';
import { Attachment, AttachmentAction, AttachmentActions, AttachmentContent, AttachmentMedia, AttachmentTitle, AttachmentTrigger } from '@/components/ui/attachment';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { FieldError } from '@/components/ui/field';
import { initials, toAvatarImage } from '@/lib/avatar-image';
import type { ProfileFormFields } from './profile-fields';

const ACCEPTED_TYPES = 'image/png,image/jpeg,image/webp';

type AvatarFieldProps = {
	/** The stored avatar, shown while the field is undefined (kept). */
	currentUrl?: string | null;
	/** Reports an image that couldn't be read, so the surrounding step can show it as invalid. */
	onUnreadableChange?: (unreadable: boolean) => void;
};

/** Photo picker with a preview, falling back to the name's initials. */
export function AvatarField({ currentUrl = null, onUnreadableChange }: AvatarFieldProps) {
	const { t } = useTranslation();
	const { control } = useFormContext<ProfileFormFields>();
	const { field, fieldState } = useController({ control, name: 'avatar' });
	const [firstName, lastName] = useWatch({ control, name: ['firstName', 'lastName'] });
	const [previewUrl, setPreviewUrl] = useState<string | null>(null);
	const [unreadable, setUnreadable] = useState(false);
	const fileInput = useRef<HTMLInputElement>(null);

	// Object URLs hold the image in memory until revoked.
	useEffect(() => () => (previewUrl === null ? undefined : URL.revokeObjectURL(previewUrl)), [previewUrl]);

	// The form value is also cleared or reset elsewhere (Skip, a reset after saving), so the preview follows it.
	const shownUrl = field.value === undefined ? currentUrl : field.value === null ? null : previewUrl;
	const state = unreadable ? 'error' : shownUrl === null ? 'idle' : 'done';
	const pickLabel = shownUrl === null ? t('onboarding.avatar.choose') : t('onboarding.avatar.change');

	const markUnreadable = (value: boolean) => {
		setUnreadable(value);
		onUnreadableChange?.(value);
	};

	const onFile = async (event: ChangeEvent<HTMLInputElement>) => {
		const file = event.target.files?.[0];
		// Lets the same file be picked again after removing it.
		event.target.value = '';
		if (file === undefined) return;
		try {
			const { blob, image } = await toAvatarImage(file);
			markUnreadable(false);
			setPreviewUrl(URL.createObjectURL(blob));
			field.onChange(image);
		} catch (error) {
			console.error('Could not read the avatar image', error);
			markUnreadable(true);
		}
	};

	const remove = () => {
		markUnreadable(false);
		field.onChange(null);
	};

	return (
		<div className='flex flex-col gap-2'>
			<Attachment className='w-full max-w-sm' state={state}>
				<AttachmentMedia className='w-14 rounded-full bg-transparent'>
					<Avatar className='size-full'>
						{shownUrl !== null && <AvatarImage alt='' src={shownUrl} />}
						<AvatarFallback className='text-base font-medium'>{initials(firstName, lastName)}</AvatarFallback>
					</Avatar>
				</AttachmentMedia>
				<AttachmentContent>
					<AttachmentTitle>{pickLabel}</AttachmentTitle>
				</AttachmentContent>
				{/* Covers the whole card so clicking anywhere opens the picker; it's the accessible control. */}
				<AttachmentTrigger aria-label={pickLabel} onClick={() => fileInput.current?.click()} ref={field.ref} />
				{shownUrl !== null && (
					<AttachmentActions>
						<AttachmentAction aria-label={t('onboarding.avatar.remove')} onClick={remove}>
							<XIcon />
						</AttachmentAction>
					</AttachmentActions>
				)}
				{/* Opened by the trigger above. */}
				<input accept={ACCEPTED_TYPES} aria-hidden='true' className='sr-only' onChange={onFile} ref={fileInput} tabIndex={-1} type='file' />
			</Attachment>
			{unreadable && <FieldError>{t('onboarding.avatar.invalid')}</FieldError>}
			<FormFieldError error={fieldState.error} />
		</div>
	);
}
