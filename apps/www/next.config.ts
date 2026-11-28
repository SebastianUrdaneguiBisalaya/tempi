import { withConsentManifest } from 'c15t/next/build';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
	/* config options here */
	turbopack: {
		rules: {
			'*.css': {
				loaders: ['@tailwindcss/turbopack'],
				as: '*.css',
			},
		},
	},
};

// Makes `c15t.config.ts` reachable to the consent root. In `local()` mode the build fetches nothing.
export default withConsentManifest(nextConfig);
