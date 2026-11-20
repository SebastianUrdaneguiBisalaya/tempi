import { cn } from 'cn';
import type { ReactNode, Ref } from 'react';

// The settings dialog's tabs, in the app's order (apps/web `settings-dialog.tsx`).
export const SETTINGS_TABS = ['profile', 'appearance', 'calendar', 'permissions', 'integrations', 'shortcuts', 'data', 'about'] as const;

export type SettingsTab = (typeof SETTINGS_TABS)[number];

type SettingsReplicaProps = {
	ref?: Ref<HTMLDivElement>;
	tabs: Record<SettingsTab, string>;
	active: SettingsTab;
	children: ReactNode;
};

/** The settings dialog with its side tabs, showing one tab's content. */
export function SettingsReplica({ ref, tabs, active, children }: SettingsReplicaProps) {
	return (
		<div ref={ref} className='flex w-full max-w-md overflow-hidden rounded-xl bg-popover text-xs/relaxed text-popover-foreground shadow-2xl shadow-black/50 ring-1 ring-foreground/10'>
			<ul className='flex w-28 shrink-0 flex-col gap-0.5 border-r p-2'>
				{SETTINGS_TABS.map(tab => (
					<li key={tab} className={cn('truncate rounded-md px-2 py-1 text-muted-foreground', tab === active && 'bg-muted font-medium text-foreground')}>
						{tabs[tab]}
					</li>
				))}
			</ul>
			<div className='flex min-w-0 flex-1 flex-col gap-5 p-4'>{children}</div>
		</div>
	);
}
