'use client';

import { useRef, useState } from 'react';
import { onEnter } from '@/components/showcase';
import { Button } from '@/components/ui/button';
import { Field, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CALENDARS } from '@/features/why/components/app-mockup';
import { gsap, useMotion } from '@/lib/gsap';
import { SHOWN_SHORTCUTS } from '@/lib/hotkeys';
import { Hotkey } from './hotkey';

export type NewEventCopy = {
	newEvent: string;
	title: string;
	/** What the demo types as the title. */
	titleValue: string;
	titlePlaceholder: string;
	calendar: string;
	cancel: string;
	create: string;
};

const TYPE_DELAY = 0.06;

/** C opens the event form (apps/web `event-form.tsx`) on the next free slot, with the title focused; on enter, one is typed. */
export function NewEventReplica({ copy, calendarName }: { copy: NewEventCopy; calendarName: string }) {
	const ref = useRef<HTMLDivElement>(null);
	const [typed, setTyped] = useState(copy.titleValue);

	useMotion(ref, () => {
		setTyped('');
		const demo = gsap.timeline({ scrollTrigger: onEnter(ref.current), delay: 0.4 });
		demo.from('[data-new-event-key]', { scale: 0.9, duration: 0.15, ease: 'power2.out' })
			.from('[data-new-event-form]', { autoAlpha: 0, y: 12, scale: 0.97, duration: 0.4, ease: 'power3.out' })
			.to({}, { duration: 0.3 });
		for (let index = 1; index <= copy.titleValue.length; index++) {
			demo.call(() => setTyped(copy.titleValue.slice(0, index)), [], `+=${TYPE_DELAY}`);
		}
		return () => setTyped(copy.titleValue);
	});

	return (
		<div ref={ref} className='flex w-full max-w-sm flex-col items-center gap-4 text-xs/relaxed'>
			<span data-new-event-key className='flex items-center gap-2 rounded-lg border bg-popover px-2.5 py-1.5 shadow-lg'>
				<Hotkey keys={SHOWN_SHORTCUTS.newEvent} />
				<span className='text-muted-foreground'>{copy.newEvent}</span>
			</span>
			<div data-new-event-form className='flex w-full flex-col gap-3 rounded-xl bg-popover p-4 text-popover-foreground shadow-2xl shadow-black/50 ring-1 ring-foreground/10'>
				<p className='font-heading text-sm font-semibold'>{copy.newEvent}</p>
				<Field>
					<FieldLabel>{copy.title}</FieldLabel>
					<Input placeholder={copy.titlePlaceholder} readOnly tabIndex={-1} value={typed} className='border-ring ring-2 ring-ring/30' />
				</Field>
				<Field>
					<FieldLabel>{copy.calendar}</FieldLabel>
					<Select items={[{ label: calendarName, value: 'work' }]} value='work'>
						<SelectTrigger className='w-full' tabIndex={-1}>
							<span className='size-2 shrink-0 rounded-full' style={{ backgroundColor: CALENDARS.work }} />
							<SelectValue />
						</SelectTrigger>
					</Select>
				</Field>
				<div className='flex justify-end gap-2'>
					<Button variant='outline'>{copy.cancel}</Button>
					<Button disabled={typed === ''}>{copy.create}</Button>
				</div>
			</div>
		</div>
	);
}
