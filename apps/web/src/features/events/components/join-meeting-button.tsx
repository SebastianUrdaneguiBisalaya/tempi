'use client';

import { GoogleMeet, MicrosoftTeams, Zoom } from '@ridemountainpig/svgl-react';
import { type EventOccurrence, type MeetingProvider, meetingLink } from '@tempi/core';
import { VideoIcon } from 'lucide-react';
import type { ComponentType, SVGProps } from 'react';
import { useTranslation } from 'react-i18next';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const ICONS: Record<MeetingProvider, ComponentType<SVGProps<SVGSVGElement>>> = { meet: GoogleMeet, other: VideoIcon, teams: MicrosoftTeams, zoom: Zoom };

type JoinMeetingButtonProps = {
	className?: string;
	event: Pick<EventOccurrence, 'description' | 'location' | 'videoUrl'>;
	size?: 'default' | 'sm' | 'xs';
};

/**
 * "Join" with the provider's icon, for an event with a call link (its video link, or a Meet, Zoom or Teams link in the
 * location or description). Nothing for an event without one. Only http(s) links come out of `meetingLink`, and the
 * desktop app hands new-window links to the OS through its external link checks.
 */
export function JoinMeetingButton({ className, event, size = 'sm' }: JoinMeetingButtonProps) {
	const { t } = useTranslation();
	const link = meetingLink(event);
	if (link === null) return null;
	const Icon = ICONS[link.provider];
	const label = link.provider === 'other' ? t('events.join') : t('events.joinOn', { provider: t(`events.meetingProviders.${link.provider}`) });
	return (
		<a aria-label={label} className={cn(buttonVariants({ size, variant: 'outline' }), className)} href={link.url} rel='noreferrer' target='_blank' title={label}>
			<Icon aria-hidden data-icon='inline-start' />
			{t('events.join')}
		</a>
	);
}
