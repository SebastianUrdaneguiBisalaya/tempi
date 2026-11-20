'use client';

import { GoogleCalendar } from '@ridemountainpig/svgl-react';
import { LogOutIcon, RefreshCwIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { useRef, useState } from 'react';
import { onEnter } from '@/components/showcase';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Field, FieldDescription, FieldLabel, FieldLegend, FieldSet } from '@/components/ui/field';
import { Spinner } from '@/components/ui/spinner';
import { gsap, useMotion } from '@/lib/gsap';

export type GoogleCardCopy = {
	title: string;
	description: string;
	connect: string;
	notConnected: string;
	disconnect: string;
	/** With an `{email}` placeholder. */
	connectedAs: string;
	privacy: string;
	terms: string;
};

export type GoogleSyncCopy = {
	/** Before the demo syncs. */
	statusBefore: string;
	statusAfter: string;
	syncNow: string;
	calendarsTitle: string;
	calendarsDescription: string;
	readOnly: string;
	calendars: { work: string; personal: string; holidays: string; birthdays: string };
};

// An example account; the replica never signs in.
const EMAIL = 'you@gmail.com';

// Google's own calendar colors.
const GOOGLE_CALENDARS = [
	{ key: 'work', color: '#4285f4', selected: true },
	{ key: 'personal', color: '#33b679', selected: true },
	{ key: 'holidays', color: '#f4511e', selected: true, readOnly: true },
	{ key: 'birthdays', color: '#8e24aa', selected: false, readOnly: true },
] as const;

type GoogleCardProps = { copy: GoogleCardCopy; action: ReactNode; children: ReactNode };

/** The Google card in Settings › Integrations (apps/web `integrations-settings.tsx`). */
function GoogleCard({ copy, action, children }: GoogleCardProps) {
	return (
		<Card size='sm' className='w-full max-w-md shadow-2xl shadow-black/50'>
			<CardHeader>
				<div className='flex items-center gap-3'>
					<GoogleCalendar className='size-8 shrink-0' />
					<div className='flex min-w-0 flex-col gap-0.5'>
						<CardTitle>{copy.title}</CardTitle>
						<CardDescription>{copy.description}</CardDescription>
					</div>
				</div>
				<CardAction>{action}</CardAction>
			</CardHeader>
			<CardContent className='flex flex-col items-start gap-4'>
				{children}
				<p className='flex flex-wrap gap-x-4 gap-y-1 text-muted-foreground'>
					<span>{copy.privacy}</span>
					<span>{copy.terms}</span>
				</p>
			</CardContent>
		</Card>
	);
}

/** No account connected: Tempi works as is, and connecting is one button away. */
export function GoogleConnectReplica({ copy }: { copy: GoogleCardCopy }) {
	return (
		<GoogleCard
			copy={copy}
			action={
				<Button size='sm' variant='outline'>
					{copy.connect}
				</Button>
			}
		>
			<p className='text-muted-foreground'>{copy.notConnected}</p>
		</GoogleCard>
	);
}

type GoogleSyncReplicaProps = { card: GoogleCardCopy; copy: GoogleSyncCopy };

/** A connected account with its calendars (apps/web `google-sync-settings.tsx`); on enter it syncs once. */
export function GoogleSyncReplica({ card, copy }: GoogleSyncReplicaProps) {
	const ref = useRef<HTMLDivElement>(null);
	const [syncing, setSyncing] = useState(false);
	const [synced, setSynced] = useState(true);

	useMotion(ref, () => {
		setSynced(false);
		gsap.timeline({ scrollTrigger: onEnter(ref.current), delay: 0.6 })
			.call(() => setSyncing(true))
			.call(
				() => {
					setSyncing(false);
					setSynced(true);
				},
				[],
				'+=1.4'
			);
		return () => {
			setSyncing(false);
			setSynced(true);
		};
	});

	return (
		<div ref={ref} className='flex w-full justify-center text-xs/relaxed'>
			<GoogleCard
				copy={card}
				action={
					<Button size='sm' variant='outline'>
						<LogOutIcon data-icon='inline-start' />
						{card.disconnect}
					</Button>
				}
			>
				<p className='break-all'>{card.connectedAs.replace('{email}', EMAIL)}</p>
				<div className='flex flex-wrap items-center gap-2'>
					<p className='text-muted-foreground'>{synced ? copy.statusAfter : copy.statusBefore}</p>
					<Button size='sm' variant='outline'>
						{syncing ? <Spinner data-icon='inline-start' /> : <RefreshCwIcon data-icon='inline-start' />}
						{copy.syncNow}
					</Button>
				</div>
				<FieldSet className='w-full'>
					<FieldLegend variant='label'>{copy.calendarsTitle}</FieldLegend>
					<FieldDescription>{copy.calendarsDescription}</FieldDescription>
					{GOOGLE_CALENDARS.map(calendar => (
						<Field key={calendar.key} orientation='horizontal'>
							<Checkbox checked={calendar.selected} tabIndex={-1} />
							<FieldLabel className='min-w-0 font-normal'>
								<span className='size-3 shrink-0 rounded-sm' style={{ backgroundColor: calendar.color }} />
								<span className='truncate'>{copy.calendars[calendar.key]}</span>
								{'readOnly' in calendar && <Badge variant='outline'>{copy.readOnly}</Badge>}
							</FieldLabel>
						</Field>
					))}
				</FieldSet>
			</GoogleCard>
		</div>
	);
}
