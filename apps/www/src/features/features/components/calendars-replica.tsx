'use client';

import { cn } from 'cn';
import { CheckIcon, EyeIcon, EyeOffIcon, PipetteIcon, PlusIcon } from 'lucide-react';
import { useRef, useState } from 'react';
import { onEnter } from '@/components/showcase';
import { Button } from '@/components/ui/button';
import { Field, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { CALENDARS, type CalendarKey, type MockupCopy } from '@/features/why/components/app-mockup';
import { gsap, useMotion } from '@/lib/gsap';

// The app's calendar palette (packages/core `CALENDAR_PALETTE`).
const PALETTE = ['#ef4444', '#f97316', '#f59e0b', '#84cc16', '#22c55e', '#14b8a6', '#06b6d4', '#3b82f6', '#6366f1', '#8b5cf6', '#d946ef', '#ec4899'] as const;

const ROWS = ['work', 'personal', 'project', 'holidays'] as const satisfies readonly CalendarKey[];

export type CalendarsCopy = {
	name: string;
	color: string;
	/** The new calendar's name in the demo. */
	nameValue: string;
	cancel: string;
	create: string;
};

type CalendarsReplicaProps = {
	copy: CalendarsCopy;
	mockup: Pick<MockupCopy, 'calendarsTitle' | 'newCalendar' | 'default' | 'readOnly' | 'calendars'>;
};

/** The sidebar's calendar list (apps/web `calendar-list.tsx`) and the new calendar dialog; on enter one is hidden and shown, and a color picked. */
export function CalendarsReplica({ copy, mockup }: CalendarsReplicaProps) {
	const ref = useRef<HTMLDivElement>(null);
	const [hidden, setHidden] = useState(false);
	const [color, setColor] = useState<string>('#14b8a6');

	useMotion(ref, () => {
		setColor('#ef4444');
		gsap.timeline({ scrollTrigger: onEnter(ref.current), delay: 0.6 })
			.call(() => setHidden(true))
			.call(() => setHidden(false), [], '+=1.2')
			.call(() => setColor('#f59e0b'), [], '+=0.5')
			.call(() => setColor('#14b8a6'), [], '+=0.4');
		return () => {
			setHidden(false);
			setColor('#14b8a6');
		};
	});

	return (
		<div ref={ref} className='flex w-full max-w-md flex-col gap-3 text-xs/relaxed sm:flex-row sm:items-start'>
			<div className='w-full shrink-0 rounded-xl bg-popover p-2 text-popover-foreground shadow-2xl shadow-black/50 ring-1 ring-foreground/10 sm:w-48'>
				<p className='flex items-center justify-between px-2 py-1 font-medium text-muted-foreground'>
					{mockup.calendarsTitle}
					<PlusIcon className='size-3.5' />
				</p>
				<ul>
					{ROWS.map(calendar => {
						const visible = !(calendar === 'personal' && hidden);
						const VisibilityIcon = visible ? EyeIcon : EyeOffIcon;
						return (
							<li key={calendar} className={cn('flex items-center gap-2 rounded-md px-2 py-1.5 transition-colors', calendar === 'personal' && 'bg-muted')}>
								<span
									className='size-3 shrink-0 rounded-sm border-2 transition-colors'
									style={{ backgroundColor: visible ? CALENDARS[calendar] : 'transparent', borderColor: CALENDARS[calendar] }}
								/>
								<span className={cn('truncate', !visible && 'text-muted-foreground')}>{mockup.calendars[calendar]}</span>
								{calendar === 'work' && <span className='shrink-0 text-[0.65rem] text-muted-foreground'>{mockup.default}</span>}
								{calendar === 'holidays' && <span className='shrink-0 text-[0.65rem] text-muted-foreground'>{mockup.readOnly}</span>}
								{calendar === 'personal' && <VisibilityIcon className='ml-auto size-3.5 shrink-0 text-muted-foreground' />}
							</li>
						);
					})}
				</ul>
			</div>
			<div className='flex min-w-0 flex-1 flex-col gap-3 rounded-xl bg-popover p-4 text-popover-foreground shadow-2xl shadow-black/50 ring-1 ring-foreground/10'>
				<p className='font-heading text-sm font-semibold'>{mockup.newCalendar}</p>
				<Field>
					<FieldLabel>{copy.name}</FieldLabel>
					<Input readOnly tabIndex={-1} value={copy.nameValue} />
				</Field>
				<Field>
					<FieldLabel>{copy.color}</FieldLabel>
					<div className='flex flex-wrap gap-1.5'>
						{PALETTE.map(swatch => (
							<span key={swatch} className='flex size-5 items-center justify-center rounded-full' style={{ backgroundColor: swatch }}>
								{swatch === color && <CheckIcon className='size-3 text-white drop-shadow' />}
							</span>
						))}
						<span className='flex size-5 items-center justify-center rounded-full border border-dashed border-muted-foreground'>
							<PipetteIcon className='size-3 text-muted-foreground' />
						</span>
					</div>
				</Field>
				<div className='flex justify-end gap-2'>
					<Button size='sm' variant='outline'>
						{copy.cancel}
					</Button>
					<Button size='sm'>{copy.create}</Button>
				</div>
			</div>
		</div>
	);
}
