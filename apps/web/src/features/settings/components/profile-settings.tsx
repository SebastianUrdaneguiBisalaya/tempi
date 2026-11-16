'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { profileUpdateInputSchema, type UserProfile, zodErrorKeyMap } from '@tempi/core';
import { avatarUrl } from '@tempi/ipc';
import { FormProvider, useForm } from 'react-hook-form';
import type { z } from 'zod';
import { AvatarField } from '@/features/profile/components/avatar-field';
import { LocationFields } from '@/features/profile/components/location-fields';
import { NameFields } from '@/features/profile/components/name-fields';
import { useUpdateProfile } from '@/features/profile/hooks/use-update-profile';
import { showFieldErrors } from './field-errors';
import { SettingsFooter } from './settings-footer';

type ProfileValues = z.input<typeof profileUpdateInputSchema>;
type ProfileOutput = z.output<typeof profileUpdateInputSchema>;

const FIELDS = ['avatar', 'country', 'firstName', 'lastName', 'timeZone'] as const;
const isField = (field: string): field is (typeof FIELDS)[number] => FIELDS.some(name => name === field);

// The avatar starts undefined: saving without touching it keeps the stored image.
const valuesOf = ({ country, firstName, lastName, timeZone }: UserProfile): ProfileValues => ({ avatar: undefined, country, firstName, lastName, timeZone });

/** Name, photo, country and time zone, with the onboarding's fields. */
export function ProfileSettings({ profile }: { profile: UserProfile }) {
	const updateProfile = useUpdateProfile();
	const form = useForm<ProfileValues, unknown, ProfileOutput>({
		defaultValues: valuesOf(profile),
		resolver: zodResolver(profileUpdateInputSchema, { error: zodErrorKeyMap }),
	});

	const submit = form.handleSubmit(values =>
		updateProfile.mutate(values, {
			onError: error => showFieldErrors(error, form.setError, isField),
			onSuccess: saved => form.reset(valuesOf(saved)),
		})
	);

	return (
		<FormProvider {...form}>
			<form className='flex flex-col gap-6' noValidate onSubmit={submit}>
				<AvatarField currentUrl={profile.avatar === null ? null : avatarUrl(profile.avatar)} />
				<NameFields />
				<LocationFields />
				<SettingsFooter dirty={form.formState.isDirty} saving={updateProfile.isPending} />
			</form>
		</FormProvider>
	);
}
