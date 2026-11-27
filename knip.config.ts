import type { KnipConfig } from 'knip';

const config: KnipConfig = {
	// Only DogLog Studio is set up for Knip so far
	ignoreWorkspaces: ['lib', 'web'],
	ignoreBinaries: [
		// `pnpm build` in CI workflows runs in the web workspace
		'build',
		// Run from the studio workspace with `pnpm --dir studio exec`
		'wrangler',
		// Runs the field model's Python project in CI, see `studio/scripts/field3d`
		'uv',
	],
	compilers: {
		// Finds packages Studio imports from CSS, like its fonts
		css: (text: string) => [...text.matchAll(/(?<=@)import[^;]+/g)].join('\n'),
	},
	workspaces: {
		cloud: {
			// Void loads routes by their file paths
			entry: ['routes/**/*.ts', 'void.config.ts'],
			// Loading the Vite config runs Void's plugin, which writes project files relative to the working directory
			vite: false,
		},
		studio: {
			entry: [
				// Knip has no React Doctor plugin
				'doctor.config.ts',
				// Run by hand once a season
				'scripts/field-model.ts',
			],
		},
	},
};

export default config;
