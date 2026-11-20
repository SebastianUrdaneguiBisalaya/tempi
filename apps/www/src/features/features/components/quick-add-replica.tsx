'use client';

import { SearchIcon, SparklesIcon } from 'lucide-react';
import { useRef, useState } from 'react';
import { onEnter } from '@/components/showcase';
import { Spinner } from '@/components/ui/spinner';
import { gsap, useMotion } from '@/lib/gsap';
import { useHydrated } from '@/lib/hydrated';
import type { Locale } from '@/lib/i18n';

export type QuickAddCopy = {
	placeholder: string;
	group: string;
	/** With a `{title}` placeholder. */
	create: string;
	reading: string;
	/** What the demo types, and the title and time read from it. */
	typed: string;
	title: string;
	hour: number;
};

const TYPE_DELAY = 0.05;

const tomorrowAt = (hour: number) => {
	const now = new Date();
	return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, hour);
};

/**
 * The command menu reading a new event from typed text (apps/web `command-menu.tsx`, `quick-add.ts`), with an AI
 * provider chosen for quick add; on enter the text is typed and the item picked.
 */
export function QuickAddReplica({ locale, copy }: { locale: Locale; copy: QuickAddCopy }) {
	const ref = useRef<HTMLDivElement>(null);
	const hydrated = useHydrated();
	const [typed, setTyped] = useState(copy.typed);
	const [reading, setReading] = useState(false);

	useMotion(ref, () => {
		setTyped('');
		const demo = gsap.timeline({ scrollTrigger: onEnter(ref.current), delay: 0.6 });
		for (let index = 1; index <= copy.typed.length; index++) {
			demo.call(() => setTyped(copy.typed.slice(0, index)), [], `+=${TYPE_DELAY}`);
		}
		demo.call(() => setReading(true), [], '+=0.8').call(() => setReading(false), [], '+=1.6');
		return () => {
			setTyped(copy.typed);
			setReading(false);
		};
	});

	// The item appears once the text holds a date, as the parser needs one.
	const parsed = typed.length >= copy.typed.length - 4;
	const start = tomorrowAt(copy.hour);
	const end = tomorrowAt(copy.hour + 1);
	const when = `${new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(start)} · ${new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit' }).formatRange(start, end)}`;

	return (
		<div ref={ref} className='w-full max-w-md overflow-hidden rounded-xl bg-popover text-xs/relaxed text-popover-foreground shadow-2xl shadow-black/50 ring-1 ring-foreground/10'>
			<div className='flex h-10 items-center gap-2 border-b px-3'>
				<SearchIcon className='size-3.5 shrink-0 opacity-50' />
				<span className='flex min-w-0 items-center'>
					{typed === '' ? <span className='text-muted-foreground'>{copy.placeholder}</span> : <span className='truncate'>{typed}</span>}
					<span className='ml-px h-4 w-px animate-pulse bg-foreground' />
				</span>
			</div>
			<div className='h-28 p-1'>
				{parsed && (
					<div className='p-1'>
						<p className='px-2.5 py-1.5 font-medium text-muted-foreground'>{copy.group}</p>
						<div className='flex min-h-7 items-center gap-2 rounded-md bg-muted px-2.5 py-1.5'>
							{reading ? <Spinner /> : <SparklesIcon className='size-3.5 shrink-0' />}
							<span className='truncate'>{reading ? copy.reading : copy.create.replace('{title}', copy.title)}</span>
							<span className='ml-auto shrink-0 text-muted-foreground'>{hydrated && when}</span>
						</div>
					</div>
				)}
			</div>
		</div>
	);
}
