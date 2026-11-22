'use client';

import { type ReactNode, useRef } from 'react';
import { WordmarkBand } from '@/features/wordmark/components/wordmark-band';

/**
 * The footer over the bracket field: the field fills the whole footer and follows the mouse across it, the mark sits
 * in the empty space at the top, and the links sit below the mark.
 */
export function WordmarkFooterFrame({ label, children }: { label: string; children: ReactNode }) {
	const footerRef = useRef<HTMLElement>(null);
	const markRef = useRef<HTMLDivElement>(null);
	return (
		<footer ref={footerRef} className='relative isolate overflow-hidden'>
			<div className='absolute inset-0 -z-10'>
				<WordmarkBand label={label} className='h-full' pointerArea={footerRef} markArea={markRef} />
			</div>
			<div ref={markRef} aria-hidden className='h-[60svh]' />
			{children}
		</footer>
	);
}
