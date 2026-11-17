import { cn } from 'cn';
import type { ComponentProps } from 'react';

type MarqueeProps = ComponentProps<'div'> & {
	/** Pauses while the pointer is over it. */
	pauseOnHover?: boolean;
	/** How many copies of `children` slide side by side; enough to fill the widest row. */
	repeat?: number;
};

/**
 * Content sliding sideways without end, in CSS only (adapted from Magic UI's marquee). The copies are decorative and hidden
 * from assistive tech; give it an accessible equivalent. With reduced motion only the first copy shows, still and centered.
 * Set `[--duration:…]` (40s) and `[--gap:…]` (1rem) through `className`.
 */
export function Marquee({ className, pauseOnHover = false, repeat = 4, children, ...props }: MarqueeProps) {
	return (
		<div {...props} aria-hidden className={cn('group flex gap-[var(--gap,1rem)] overflow-hidden motion-reduce:justify-center', className)}>
			{Array.from({ length: repeat }, (_, copy) => `copy-${copy}`).map((key, copy) => (
				<div
					key={key}
					className={cn(
						'flex shrink-0 animate-marquee items-center justify-around gap-[var(--gap,1rem)] motion-reduce:animate-none',
						pauseOnHover && 'group-hover:[animation-play-state:paused]',
						copy > 0 && 'motion-reduce:hidden'
					)}
				>
					{children}
				</div>
			))}
		</div>
	);
}
