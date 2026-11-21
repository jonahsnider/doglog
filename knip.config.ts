import type { KnipConfig } from 'knip';

const config: KnipConfig = {
	// Only DogLog Studio is set up for Knip so far
	ignoreWorkspaces: ['lib', 'web'],
	ignoreBinaries: [
		// `pnpm build` in CI workflows runs in the web workspace
		'build',
		// Run from the studio workspace with `pnpm --dir studio exec`
		'wrangler',
		// Built into macOS
		'ditto',
		// Runs the field model's Python project in CI, see `studio/scripts/field3d`
		'uv',
	],
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
				// Passed to `vp lint -c` in `pnpm check`
				'vendored-lint.config.ts',
				// coss ui components are copied in from a registry, and are available even if unused
				'src/components/ui/**/*.tsx',
				'src/hooks/use-media-query.ts',
				// Run by hand once a season
				'scripts/field-model.ts',
			],
		},
	},
};

export default config;
