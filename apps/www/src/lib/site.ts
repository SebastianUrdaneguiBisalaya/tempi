export const SITE_URL = 'https://tempi.sebastianurdanegui.com';

export const AUTHOR_URL = 'https://sebastianurdanegui.com';

// Both are registered in Google Cloud, so the legal pages list both.
export const CONTACT_EMAILS = ['sebasurdanegui@gmail.com', 'sebasub147@gmail.com'] as const;

// The legal pages, under each locale; Google's OAuth consent screen links to them.
export const LEGAL_PAGES = ['terms', 'privacy'] as const;

export const GITHUB_URL = 'https://github.com/SebastianUrdaneguiBisalaya/tempi';

// Section ids shared by the header links and the sections they scroll to.
export const SECTION_IDS = {
	why: 'why-tempi',
	features: 'features',
	planning: 'planning',
	ai: 'ai',
	faq: 'faq',
	download: 'download',
} as const;
