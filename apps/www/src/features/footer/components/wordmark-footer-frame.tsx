'use client';

import { type ReactNode, useRef } from 'react';
import { WordmarkBand } from '@/features/wordmark/components/wordmark-band';

/**
 * The footer over the wordmark field: the field fills the background and follows the mouse across the whole footer,
 * links included, while the content sits on top.
 */
export function WordmarkFooterFrame({ label, children }: { label: string; children: ReactNode }) {
	const ref = useRef<HTMLElement>(null);
	return (
		<footer ref={ref} className='relative isolate flex min-h-svh flex-col overflow-hidden'>
			<div className='absolute inset-0 -z-10'>
				<WordmarkBand label={label} className='h-full' pointerArea={ref} />
			</div>
			{children}
		</footer>
	);
}
