import tailwindcss from '@tailwindcss/vite';
import { tanstackRouter } from '@tanstack/router-plugin/vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { defineConfig, lazyPlugins } from 'vite-plus';

const ignorePatterns = [
	'src/routeTree.gen.ts',
	'src-tauri/target/',
	'src-tauri/gen/',
	// coss ui/shadcn files are copied in from a registry
	'src/components/ui/',
	'src/hooks/use-media-query.ts',
	'src/lib/utils.ts',
];

// https://vite.dev/config/
export default defineConfig({
	fmt: {
		singleQuote: true,
		useTabs: true,
		printWidth: 120,
		ignorePatterns,
	},
	lint: {
		plugins: ['react', 'typescript', 'oxc'],
		categories: {
			correctness: 'error',
			perf: 'error',
		},
		rules: {
			'react/rules-of-hooks': 'error',
			'react/only-export-components': [
				'warn',
				{
					allowConstantExport: true,
				},
			],
			'vite-plus/prefer-vite-plus-imports': 'error',
		},
		overrides: [
			{
				// TanStack Router splits route components into their own chunks, so Fast Refresh still works
				files: ['src/routes/**'],
				rules: { 'react/only-export-components': 'off' },
			},
		],
		ignorePatterns,
		options: {
			typeAware: true,
			typeCheck: true,
		},
		jsPlugins: [
			{
				name: 'vite-plus',
				specifier: 'vite-plus/oxlint-plugin',
			},
		],
	},
	plugins: lazyPlugins(() => [
		tanstackRouter({ target: 'react', autoCodeSplitting: true }),
		react(),
		tailwindcss(),
		VitePWA({
			registerType: 'autoUpdate',
			workbox: {
				globPatterns: ['**/*'],
				cleanupOutdatedCaches: true,
			},
			manifest: {
				name: 'DogLog Studio',
				short_name: 'DogLog Studio',
				description: 'Review FRC robot logs and debug robots live',
				display: 'standalone',
				theme_color: '#591616',
				start_url: '/',
			},
		}),
	]),
	resolve: {
		tsconfigPaths: true,
	},
	// Tauri expects a fixed dev server port
	clearScreen: false,
	server: {
		strictPort: true,
	},
});
