import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
	// Static export (apps/web/out), embedded and served by @tempi/desktop: no server features.
	output: 'export',
	// Workspace packages ship TypeScript source; Next compiles them.
	transpilePackages: ['@tempi/core', '@tempi/i18n', '@tempi/ipc'],
	images: { unoptimized: true },
	turbopack: {
		rules: {
			'*.css': {
				loaders: ['@tailwindcss/turbopack'],
				as: '*.css',
			},
		},
	},
};

export default nextConfig;
