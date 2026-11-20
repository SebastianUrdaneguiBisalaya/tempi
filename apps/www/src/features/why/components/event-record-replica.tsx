'use client';

import { cn } from 'cn';
import { DatabaseIcon } from 'lucide-react';
import { Fragment, useRef, useState } from 'react';
import { onEnter } from '@/components/showcase';
import { gsap, useMotion } from '@/lib/gsap';

// One row of the `events` table (packages/db `0001_init.sql`). Column names and values are data, not copy, so they
// stay the same in every language; only the title is translated.
const EDITED_AT = '2026-11-20T15:42:07.118Z';
const ROW = [
	['id', "'0193a4c2-7e1f-7b3d-9c58-2f6e1d0a4b97'"],
	['calendar_id', "'0193a4b8-11c0-7d2e-a4f1-6b0c9e2d3a15'"],
	['title', null],
	['start_at', "'2026-11-20T14:00:00.000Z'"],
	['end_at', "'2026-11-20T15:00:00.000Z'"],
	['time_zone', "'America/Lima'"],
	['rrule', "'FREQ=WEEKLY;BYDAY=FR'"],
	['created_at', "'2026-11-02T09:15:31.402Z'"],
	['updated_at', null],
	['deleted_at', 'NULL'],
] as const;

/** A stored event as SQLite holds it: UUIDv7 ids, UTC instants, the IANA zone and an RRULE. On enter, it's edited once. */
export function EventRecordReplica({ title }: { title: string }) {
	const ref = useRef<HTMLDivElement>(null);
	const [updatedAt, setUpdatedAt] = useState(EDITED_AT);
	const [flash, setFlash] = useState(false);

	useMotion(ref, () => {
		setUpdatedAt('2026-11-02T09:15:31.402Z');
		gsap.from('[data-record-row]', { autoAlpha: 0, x: -8, duration: 0.4, stagger: 0.05, ease: 'power2.out', scrollTrigger: onEnter(ref.current) });
		gsap.timeline({ scrollTrigger: onEnter(ref.current), delay: 1.6 })
			.call(() => {
				setUpdatedAt(EDITED_AT);
				setFlash(true);
			})
			.call(() => setFlash(false), [], '+=1.2');
		return () => {
			setUpdatedAt(EDITED_AT);
			setFlash(false);
		};
	});

	const value = (column: string, stored: string | null) => {
		if (column === 'title') return `'${title.replaceAll("'", "''")}'`;
		if (column === 'updated_at') return `'${updatedAt}'`;
		return stored;
	};

	return (
		<div ref={ref} className='w-full max-w-md overflow-hidden rounded-xl bg-popover font-mono text-[0.7rem]/relaxed text-popover-foreground shadow-2xl shadow-black/50 ring-1 ring-foreground/10'>
			<p className='flex items-center gap-2 border-b px-3 py-2 text-muted-foreground'>
				<DatabaseIcon className='size-3.5' />
				tempi.db › events
			</p>
			<dl className='grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 px-3 py-2'>
				{ROW.map(([column, stored]) => (
					<Fragment key={column}>
						<dt data-record-row className='py-0.5 text-muted-foreground'>
							{column}
						</dt>
						<dd
							data-record-row
							className={cn(
								'truncate rounded-sm py-0.5 transition-colors duration-700',
								stored === 'NULL' ? 'text-muted-foreground/70' : 'text-emerald-600 dark:text-emerald-400',
								column === 'updated_at' && flash && 'bg-emerald-500/15'
							)}
						>
							{value(column, stored)}
						</dd>
					</Fragment>
				))}
			</dl>
		</div>
	);
}
