'use client';

import { avatarUrl } from '@tempi/ipc';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useProfile } from '@/features/profile/hooks/use-profile';
import { initials } from '@/lib/avatar-image';

/** The user's photo, or their initials when they didn't add one. Nothing outside the desktop app (no profile). */
export function UserAvatar() {
	const { data: profile } = useProfile();
	if (!profile) return null;

	const name = `${profile.firstName} ${profile.lastName}`;
	return (
		<Avatar aria-label={name} role='img'>
			{profile.avatar !== null && <AvatarImage alt='' src={avatarUrl(profile.avatar)} />}
			<AvatarFallback aria-hidden>{initials(profile.firstName, profile.lastName)}</AvatarFallback>
		</Avatar>
	);
}
