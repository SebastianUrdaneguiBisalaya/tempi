import type { Language } from '@tempi/core';

/** Each language in its own words ("English", "Español"), so it's recognizable whatever the current UI language. */
export const nativeLanguageName = (language: Language): string => {
	const name = new Intl.DisplayNames([language], { type: 'language' }).of(language) ?? language;
	return name.charAt(0).toLocaleUpperCase(language) + name.slice(1);
};
