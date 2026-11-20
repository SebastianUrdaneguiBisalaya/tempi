'use client';

import { RotateCwIcon } from 'lucide-react';
import { useRef, useState } from 'react';
import { SettingsReplica, type SettingsTab } from '@/components/settings-replica';
import { onEnter } from '@/components/showcase';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { gsap, useMotion } from '@/lib/gsap';

// The installed version and the next one; only examples, the replica never checks.
const CURRENT = '0.1.0';
const LATEST = '0.2.0';

type Phase = 'checking' | 'downloading' | 'ready';

export type UpdatesCopy = {
	title: string;
	/** With a `{version}` placeholder, as are the statuses but `checking`. */
	version: string;
	updatesTitle: string;
	status: Record<Phase, string>;
	restart: string;
	check: string;
};

type UpdatesReplicaProps = {
	copy: UpdatesCopy;
	tabs: Record<SettingsTab, string>;
};

/** Settings › About's updates (apps/web `about-settings.tsx`); on enter a new version is found, downloaded and ready. */
export function UpdatesReplica({ copy, tabs }: UpdatesReplicaProps) {
	const ref = useRef<HTMLDivElement>(null);
	const [phase, setPhase] = useState<Phase>('ready');

	useMotion(ref, () => {
		setPhase('checking');
		gsap.timeline({ scrollTrigger: onEnter(ref.current), delay: 0.6 })
			.call(() => setPhase('downloading'), [], '+=1')
			.call(() => setPhase('ready'), [], '+=1.6');
		return () => setPhase('ready');
	});

	return (
		<SettingsReplica ref={ref} tabs={tabs} active='about'>
			<div className='flex flex-col gap-0.5'>
				<h4 className='font-heading text-sm font-semibold'>{copy.title}</h4>
				<p className='text-muted-foreground'>{copy.version.replace('{version}', CURRENT)}</p>
			</div>
			<section className='flex flex-col items-start gap-2'>
				<h4 className='font-heading text-sm font-semibold'>{copy.updatesTitle}</h4>
				<p>{copy.status[phase].replace('{version}', LATEST)}</p>
				{phase === 'ready' ? (
					<Button size='sm'>
						<RotateCwIcon data-icon='inline-start' />
						{copy.restart}
					</Button>
				) : (
					<Button size='sm' variant='outline'>
						<Spinner data-icon='inline-start' />
						{copy.check}
					</Button>
				)}
			</section>
		</SettingsReplica>
	);
}
