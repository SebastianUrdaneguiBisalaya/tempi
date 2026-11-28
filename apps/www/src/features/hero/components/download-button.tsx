'use client';

import { cn } from 'cn';
import { DownloadIcon } from 'lucide-react';
import { useSyncExternalStore } from 'react';
import { buttonVariants } from '@/components/ui/button';
import { track } from '@/lib/analytics';
import { DOWNLOADS } from '@/lib/downloads';
import { detectPlatform, PLATFORM_NAMES } from '@/lib/platform';
import { SECTION_IDS } from '@/lib/site';

type DownloadButtonProps = {
	/** Label with an `{os}` placeholder, e.g. "Download for {os}". */
	labelForPlatform: string;
	label: string;
	className?: string;
};

// The user agent never changes during a visit, so there's nothing to subscribe to.
const subscribe = () => () => {
	// Nothing to unsubscribe from.
};

export function DownloadButton({ labelForPlatform, label, className }: DownloadButtonProps) {
	const platform = useSyncExternalStore(
		subscribe,
		() => detectPlatform(navigator.userAgent),
		() => null
	);

	return (
		<a
			href={platform ? DOWNLOADS[platform][0].url : `#${SECTION_IDS.download}`}
			// Without a known platform the button only scrolls to the Download section, which isn't a download.
			onClick={platform ? () => track('download_click', { platform, variant: DOWNLOADS[platform][0].key, source: 'hero' }) : undefined}
			className={cn(buttonVariants({ className }))}
		>
			<DownloadIcon data-icon='inline-start' />
			{platform ? labelForPlatform.replace('{os}', PLATFORM_NAMES[platform]) : label}
		</a>
	);
}
