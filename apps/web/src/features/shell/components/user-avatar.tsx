'use client';

import { avatarUrl } from '@tempi/ipc';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { useProfile } from '@/features/profile/hooks/use-profile';
import { initials } from '@/lib/avatar-image';

/** The user's photo, or their initials when they didn't add one, as a button (it opens settings). Nothing outside the desktop app (no profile). */
export function UserAvatarButton({ label, onClick }: { label: string; onClick: () => void }) {
	const { data: profile } = useProfile();
	if (!profile) return null;

	return (
		<Button aria-label={label} className='rounded-full' onClick={onClick} size='icon' title={`${profile.firstName} ${profile.lastName}`} variant='ghost'>
			<Avatar aria-hidden>
				{profile.avatar !== null && <AvatarImage alt='' src={avatarUrl(profile.avatar)} />}
				<AvatarFallback>{initials(profile.firstName, profile.lastName)}</AvatarFallback>
			</Avatar>
		</Button>
	);
}
