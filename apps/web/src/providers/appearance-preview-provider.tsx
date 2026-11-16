'use client';

import type { Language, Theme } from '@tempi/core';
import { createContext, type ReactNode, use, useState } from 'react';

/** Unsaved theme and language choices, shown immediately (e.g. while onboarding) and dropped once the real settings are saved. */
export type AppearancePreview = { language?: Language; theme?: Theme };

type AppearancePreviewContextValue = {
	preview: AppearancePreview;
	setPreview: (preview: AppearancePreview) => void;
};

const AppearancePreviewContext = createContext<AppearancePreviewContextValue | null>(null);

export function AppearancePreviewProvider({ children }: { children: ReactNode }) {
	const [preview, setPreview] = useState<AppearancePreview>({});
	return <AppearancePreviewContext value={{ preview, setPreview }}>{children}</AppearancePreviewContext>;
}

/** The previewed theme and language, which win over the stored settings until cleared. */
export const useAppearancePreview = (): AppearancePreviewContextValue => {
	const context = use(AppearancePreviewContext);
	if (context === null) throw new Error('useAppearancePreview must be used within AppearancePreviewProvider');
	return context;
};
