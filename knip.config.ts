import type { KnipConfig } from 'knip';

const config: KnipConfig = {
	// Only DogLog Studio is set up for Knip so far
	ignoreWorkspaces: ['lib', 'web'],
	ignoreBinaries: [
		// `pnpm build` in CI workflows runs in the web workspace
		'build',
	],
	workspaces: {
		studio: {
			entry: [
				// Knip has no React Doctor plugin
				'doctor.config.ts',
				// coss ui components are copied in from a registry, and are available even if unused
				'src/components/ui/**/*.tsx',
				'src/hooks/use-media-query.ts',
			],
		},
	},
};

export default config;
