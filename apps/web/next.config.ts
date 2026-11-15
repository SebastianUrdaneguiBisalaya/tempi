import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
	// Static export (apps/web/out), embedded and served by @tempi/desktop: no server features.
	output: 'export',
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
