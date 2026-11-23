'use client';

import { GoogleMeet } from '@ridemountainpig/svgl-react';
import { useId, useRef, useState } from 'react';
import { onEnter } from '@/components/showcase';
import { buttonVariants } from '@/components/ui/button';
import { Field, FieldContent, FieldDescription, FieldLabel } from '@/components/ui/field';
import { Switch } from '@/components/ui/switch';
import { gsap, useMotion } from '@/lib/gsap';

export type GoogleMeetCopy = {
	label: string;
	hint: string;
	join: string;
	/** The Join button's accessible name, as the app's "Join on Google Meet". */
	joinLabel: string;
};

/**
 * The event form's Google Meet switch (apps/web `event-form.tsx`) turned on, with the "Join" button of the link Google
 * created (`join-meeting-button.tsx`); on enter the switch turns on and the link shows up once the event syncs.
 */
export function GoogleMeetReplica({ copy }: { copy: GoogleMeetCopy }) {
	const id = useId();
	const ref = useRef<HTMLDivElement>(null);
	const [on, setOn] = useState(true);
	const [synced, setSynced] = useState(true);

	useMotion(ref, () => {
		setOn(false);
		setSynced(false);
		const demo = gsap.timeline({ scrollTrigger: onEnter(ref.current), delay: 0.6 });
		demo.call(() => setOn(true), [], '+=0.4').call(() => setSynced(true), [], '+=1');
		return () => {
			setOn(true);
			setSynced(true);
		};
	});

	return (
		<div ref={ref} className='flex w-full max-w-sm flex-col gap-3 rounded-xl bg-popover p-4 text-xs/relaxed text-popover-foreground shadow-2xl shadow-black/50 ring-1 ring-foreground/10'>
			<Field orientation='horizontal'>
				<Switch aria-describedby={`${id}-meet-hint`} checked={on} id={`${id}-meet`} tabIndex={-1} />
				<FieldContent>
					<FieldLabel htmlFor={`${id}-meet`}>
						<GoogleMeet aria-hidden className='size-4 shrink-0' />
						{copy.label}
					</FieldLabel>
					<FieldDescription id={`${id}-meet-hint`}>{copy.hint}</FieldDescription>
				</FieldContent>
				{on && synced && (
					<span aria-label={copy.joinLabel} className={buttonVariants({ size: 'default', variant: 'outline', className: 'self-center' })} title={copy.joinLabel}>
						<GoogleMeet aria-hidden data-icon='inline-start' />
						{copy.join}
					</span>
				)}
			</Field>
		</div>
	);
}
