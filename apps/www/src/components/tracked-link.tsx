'use client';

import { type AnalyticsEvent, type AnalyticsParams, track } from '@/lib/analytics';

type TrackedLinkProps<E extends AnalyticsEvent> = React.ComponentProps<'a'> & { event: E; params: AnalyticsParams<E> };

/** A link that reports its click to analytics, for Server Components that can't pass an `onClick`. */
export function TrackedLink<E extends AnalyticsEvent>({ event, params, onClick, ...props }: TrackedLinkProps<E>) {
	return (
		<a
			{...props}
			onClick={clickEvent => {
				track(event, params);
				onClick?.(clickEvent);
			}}
		/>
	);
}
