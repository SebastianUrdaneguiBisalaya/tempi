'use client';

import { cn } from 'cn';
import { CheckIcon, ChevronRightIcon, FileDownIcon, FileUpIcon } from 'lucide-react';
import { useRef, useState } from 'react';
import { onEnter } from '@/components/showcase';
import { CALENDARS, type CalendarKey } from '@/features/why/components/app-mockup';
import { gsap, useMotion } from '@/lib/gsap';

export type ImportExportCopy = {
	importIcs: string;
	exportAll: string;
	file: string;
	/** The toast after importing. */
	done: string;
};

// The calendars an .ics can go into; read-only ones (holidays) can't take events.
const TARGETS = ['work', 'personal', 'project'] as const satisfies readonly CalendarKey[];

const MENU = 'rounded-lg bg-popover p-1 text-xs/relaxed text-popover-foreground shadow-2xl shadow-black/50 ring-1 ring-foreground/10';

type ImportExportReplicaProps = {
	copy: ImportExportCopy;
	calendars: Record<CalendarKey, string>;
};

/** The command menu's import submenu and export item (apps/web `command-menu.tsx`); on enter, a file goes into Personal. */
export function ImportExportReplica({ copy, calendars }: ImportExportReplicaProps) {
	const ref = useRef<HTMLDivElement>(null);
	const [target, setTarget] = useState<CalendarKey | null>('personal');

	useMotion(ref, () => {
		setTarget(null);
		gsap.timeline({ scrollTrigger: onEnter(ref.current), delay: 0.5 })
			.from('[data-ics-file]', { autoAlpha: 0, y: -16, rotate: -6, duration: 0.5, ease: 'back.out(1.6)' })
			.call(() => setTarget('work'), [], '+=0.3')
			.call(() => setTarget('personal'), [], '+=0.4')
			.from('[data-ics-toast]', { autoAlpha: 0, y: 12, duration: 0.4, ease: 'power3.out' }, '+=0.6');
		return () => setTarget('personal');
	});

	return (
		<div ref={ref} className='relative flex w-full max-w-md flex-col items-start gap-3'>
			<span data-ics-file className='flex items-center gap-1.5 self-end rounded-md border bg-card px-2 py-1 font-mono text-[0.65rem] shadow-lg'>
				<FileUpIcon className='size-3.5 text-muted-foreground' />
				{copy.file}
			</span>
			<div className='flex w-full items-start gap-1'>
				<ul className={cn(MENU, 'w-56 shrink-0')}>
					<li className='flex min-h-7 items-center gap-2 rounded-md bg-muted px-2.5 py-1.5'>
						<FileUpIcon className='size-3.5 text-muted-foreground' />
						<span className='truncate'>{copy.importIcs}</span>
						<ChevronRightIcon className='ml-auto size-3.5 text-muted-foreground' />
					</li>
					<li className='flex min-h-7 items-center gap-2 rounded-md px-2.5 py-1.5'>
						<FileDownIcon className='size-3.5 text-muted-foreground' />
						<span className='truncate'>{copy.exportAll}</span>
					</li>
				</ul>
				<ul className={cn(MENU, 'w-40 min-w-0')}>
					{TARGETS.map(calendar => (
						<li key={calendar} className={cn('flex min-h-7 items-center gap-2 rounded-md px-2.5 py-1.5 transition-colors', target === calendar && 'bg-muted')}>
							<span className='size-2 shrink-0 rounded-full' style={{ backgroundColor: CALENDARS[calendar] }} />
							<span className='truncate'>{calendars[calendar]}</span>
						</li>
					))}
				</ul>
			</div>
			<p data-ics-toast className={cn(MENU, 'flex items-center gap-2 self-end px-3 py-2')}>
				<CheckIcon className='size-3.5 shrink-0 text-emerald-500' />
				{copy.done}
			</p>
		</div>
	);
}
