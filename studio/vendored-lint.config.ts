// Lint config for files copied in from registries, which `vite.config.ts` ignores, so they're only held to the rules here
import { defineConfig } from 'vite-plus';

export const lucideBarrelRestriction = {
	// The barrel makes dev load every icon and TypeScript load a 2.5 MB declaration file
	name: 'lucide-react',
	message:
		"Import each icon from 'lucide-react/icons/<name>' and types from 'lucide-react/types' instead of the barrel.",
};

export default defineConfig({
	lint: {
		categories: { correctness: 'off' },
		rules: {
			'eslint/no-restricted-imports': ['error', { paths: [lucideBarrelRestriction] }],
		},
		options: {
			denyWarnings: true,
		},
	},
});
