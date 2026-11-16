'use client';

import { type ChangeEvent, useEffect, useRef, useState } from 'react';
import { useController, useFormContext, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { FormFieldError } from '@/components/form-field-error';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
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
			<div className='flex flex-col items-center gap-4 sm:flex-row'>
				<Avatar className='size-20'>
					{shownUrl !== null && <AvatarImage alt='' src={shownUrl} />}
					<AvatarFallback className='text-xl font-medium'>{initials(firstName, lastName)}</AvatarFallback>
				</Avatar>
				<div className='flex flex-wrap justify-center gap-2'>
					<Button onClick={() => fileInput.current?.click()} ref={field.ref} type='button' variant='outline'>
						{shownUrl === null ? t('onboarding.avatar.choose') : t('onboarding.avatar.change')}
					</Button>
					{shownUrl !== null && (
						<Button onClick={remove} type='button' variant='ghost'>
							{t('onboarding.avatar.remove')}
						</Button>
					)}
				</div>
				{/* Opened by the button above, which is the accessible control. */}
				<input accept={ACCEPTED_TYPES} aria-hidden='true' className='sr-only' onChange={onFile} ref={fileInput} tabIndex={-1} type='file' />
			</div>
			{unreadable && <FieldError>{t('onboarding.avatar.invalid')}</FieldError>}
			<FormFieldError error={fieldState.error} />
		</div>
	);
}
