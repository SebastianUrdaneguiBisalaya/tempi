'use client';

import { useRef, useState } from 'react';
import { SettingsReplica, type SettingsTab } from '@/components/settings-replica';
import { onEnter } from '@/components/showcase';
import { FieldLabel, FieldLegend, FieldSet } from '@/components/ui/field';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { gsap, useMotion } from '@/lib/gsap';
import type { Locale } from '@/lib/i18n';

const THEMES = ['light', 'dark', 'system'] as const;

type Theme = (typeof THEMES)[number];

// Each language in its own name, as the app lists them (apps/web `nativeLanguageName`).
const LANGUAGES = [
	{ value: 'en', name: 'English' },
	{ value: 'es', name: 'Español' },
] as const satisfies readonly { value: Locale; name: string }[];

export type AppearanceCopy = {
	theme: string;
	language: string;
	themes: Record<Theme, string>;
};

type AppearanceReplicaProps = {
	locale: Locale;
	copy: AppearanceCopy;
	tabs: Record<SettingsTab, string>;
};

/** Settings › Appearance (apps/web `appearance-settings.tsx`); on enter the theme goes through all three and back to System. */
export function AppearanceReplica({ locale, copy, tabs }: AppearanceReplicaProps) {
	const ref = useRef<HTMLDivElement>(null);
	const [theme, setTheme] = useState<Theme>('system');

	useMotion(ref, () => {
		gsap.timeline({ scrollTrigger: onEnter(ref.current), delay: 0.6 })
			.call(() => setTheme('light'))
			.call(() => setTheme('dark'), [], '+=0.7')
			.call(() => setTheme('system'), [], '+=0.7');
		return () => setTheme('system');
	});

	return (
		<SettingsReplica ref={ref} tabs={tabs} active='appearance'>
			<FieldSet>
				<FieldLegend>{copy.theme}</FieldLegend>
				<RadioGroup value={theme}>
					{THEMES.map(option => (
						<div key={option} className='flex items-center gap-2'>
							<RadioGroupItem value={option} tabIndex={-1} />
							<FieldLabel className='font-normal'>{copy.themes[option]}</FieldLabel>
						</div>
					))}
				</RadioGroup>
			</FieldSet>
			<FieldSet>
				<FieldLegend>{copy.language}</FieldLegend>
				<RadioGroup value={locale}>
					{LANGUAGES.map(option => (
						<div key={option.value} className='flex items-center gap-2'>
							<RadioGroupItem value={option.value} tabIndex={-1} />
							<FieldLabel className='font-normal' lang={option.value}>
								{option.name}
							</FieldLabel>
						</div>
					))}
				</RadioGroup>
			</FieldSet>
		</SettingsReplica>
	);
}
