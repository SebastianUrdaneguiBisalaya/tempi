'use client';

import { GoogleMeet } from '@ridemountainpig/svgl-react';
import { CalendarIcon, MapPinIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { useRef } from 'react';
import { onEnter } from '@/components/showcase';
import { buttonVariants } from '@/components/ui/button';
import { CALENDARS, eventStyle } from '@/features/why/components/app-mockup';
import { gsap, useMotion } from '@/lib/gsap';
import { useHydrated } from '@/lib/hydrated';
import type { Locale } from '@/lib/i18n';

export type EventPreviewCopy = {
	calendar: string;
	location: string;
	/** The event's place in the demo. */
	locationValue: string;
	join: string;
};

type EventPreviewReplicaProps = {
	locale: Locale;
	copy: EventPreviewCopy;
	title: string;
	calendarName: string;
};

const at = (hour: number) => {
	const now = new Date();
	return new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour);
};

function PreviewRow({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
	return (
		<div className='flex items-start gap-2 [&_svg]:mt-0.5 [&_svg]:size-3.5 [&_svg]:shrink-0 [&_svg]:text-muted-foreground'>
			{icon}
			<dt className='sr-only'>{label}</dt>
			<dd className='min-w-0'>{children}</dd>
		</div>
	);
}

/** An event in the grid and the preview it opens (apps/web `event-preview.tsx`), with its place and the Meet link to join; it opens on enter. */
export function EventPreviewReplica({ locale, copy, title, calendarName }: EventPreviewReplicaProps) {
	const ref = useRef<HTMLDivElement>(null);
	const hydrated = useHydrated();

	useMotion(ref, () => {
		gsap.from('[data-preview-popover]', { autoAlpha: 0, x: -8, scale: 0.97, transformOrigin: 'left top', duration: 0.4, ease: 'power3.out', delay: 0.6, scrollTrigger: onEnter(ref.current) });
	});

	const when = `${new Intl.DateTimeFormat(locale, { weekday: 'long', day: 'numeric', month: 'long' }).format(at(13))} · ${new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit' }).formatRange(at(13), at(14))}`;

	return (
		<div ref={ref} className='flex w-full max-w-md items-start gap-2 text-xs/relaxed'>
			<div className='flex w-28 shrink-0 flex-col rounded-md border-l-[3px] px-2 py-1 shadow-lg' style={{ height: '4.5rem', ...eventStyle(CALENDARS.work) }}>
				<span className='truncate font-medium'>{title}</span>
			</div>
			<div data-preview-popover className='flex w-72 min-w-0 flex-col gap-3 rounded-lg bg-popover p-3 text-popover-foreground shadow-2xl shadow-black/50 ring-1 ring-foreground/10'>
				<div className='flex items-start gap-2'>
					<span className='mt-1 size-2.5 shrink-0 rounded-full' style={{ backgroundColor: CALENDARS.work }} />
					<div className='flex min-w-0 flex-col gap-1'>
						<p className='font-heading text-sm font-medium'>{title}</p>
						<p className='h-4 text-muted-foreground first-letter:uppercase'>{hydrated && when}</p>
					</div>
				</div>
				<dl className='flex flex-col gap-2'>
					<PreviewRow icon={<CalendarIcon />} label={copy.calendar}>
						{calendarName}
					</PreviewRow>
					<PreviewRow icon={<MapPinIcon />} label={copy.location}>
						{copy.locationValue}
					</PreviewRow>
				</dl>
				<span className={buttonVariants({ variant: 'outline', className: 'self-start' })}>
					<GoogleMeet data-icon='inline-start' />
					{copy.join}
				</span>
			</div>
		</div>
	);
}
