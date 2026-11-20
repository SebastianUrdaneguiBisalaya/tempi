'use client';

import { cn } from 'cn';
import { DatabaseBackupIcon, HistoryIcon } from 'lucide-react';
import { useRef, useState } from 'react';
import { SettingsReplica, type SettingsTab } from '@/components/settings-replica';
import { onEnter } from '@/components/showcase';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { gsap, useMotion } from '@/lib/gsap';

export type DataSettingsCopy = {
	backupTitle: string;
	backupDescription: string;
	backup: string;
	restoreTitle: string;
	restoreDescription: string;
	restore: string;
};

type DataSettingsReplicaProps = {
	copy: DataSettingsCopy;
	tabs: Record<SettingsTab, string>;
};

/** Replica of Settings › Data (apps/web `data-settings.tsx`); on enter, the backup button runs once. */
export function DataSettingsReplica({ copy, tabs }: DataSettingsReplicaProps) {
	const ref = useRef<HTMLDivElement>(null);
	const [saving, setSaving] = useState(false);

	useMotion(ref, () => {
		gsap.timeline({ scrollTrigger: onEnter(ref.current), delay: 0.6 })
			.call(() => setSaving(true))
			.call(() => setSaving(false), [], '+=1.2');
		return () => setSaving(false);
	});

	return (
		<SettingsReplica ref={ref} tabs={tabs} active='data'>
			<section className='flex flex-col items-start gap-2'>
				<h4 className='font-heading text-sm font-semibold'>{copy.backupTitle}</h4>
				<p className='text-muted-foreground'>{copy.backupDescription}</p>
				<Button variant='outline' className={cn('transition-transform', saving && 'scale-95')}>
					{saving ? <Spinner data-icon='inline-start' /> : <DatabaseBackupIcon data-icon='inline-start' />}
					{copy.backup}
				</Button>
			</section>
			<section className='flex flex-col items-start gap-2'>
				<h4 className='font-heading text-sm font-semibold'>{copy.restoreTitle}</h4>
				<p className='text-muted-foreground'>{copy.restoreDescription}</p>
				<Button variant='outline'>
					<HistoryIcon data-icon='inline-start' />
					{copy.restore}
				</Button>
			</section>
		</SettingsReplica>
	);
}
