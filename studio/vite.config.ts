import tailwindcss from '@tailwindcss/vite';
import { execFileSync } from 'node:child_process';
import { tanstackRouter } from '@tanstack/router-plugin/vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { defineConfig, lazyPlugins } from 'vite-plus';
import packageJson from './package.json' with { type: 'json' };

const ignorePatterns = [
	'src/routeTree.gen.ts',
	'src-tauri/target/',
	'src-tauri/gen/',
	// coss ui/shadcn files are copied in from a registry
	'src/components/ui/',
	'src/hooks/use-media-query.ts',
	'src/lib/utils.ts',
	// Edited with Apple's Icon Composer
	'assets/mac.icon/',
];

/** Short hash of the commit Studio is built from, or `null` outside a Git repository */
function getCommitHash(): string | null {
	try {
		return execFileSync('git', ['rev-parse', '--short', 'HEAD'], { encoding: 'utf8' }).trim();
	} catch {
		return null;
	}
}

// https://vite.dev/config/
export default defineConfig({
	fmt: {
		singleQuote: true,
		useTabs: true,
		printWidth: 120,
		ignorePatterns,
	},
	lint: {
		// react-perf is left out: without React Compiler, its rules ask for useCallback/useMemo around every inline prop
		plugins: ['eslint', 'typescript', 'unicorn', 'oxc', 'react', 'jsx-a11y', 'import', 'promise', 'vitest'],
		categories: {
			correctness: 'error',
			suspicious: 'error',
			pedantic: 'error',
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

			// Too noisy or opinionated
			// The automatic JSX runtime doesn't need React in scope
			'react/react-in-jsx-scope': 'off',
			// Library and DOM types aren't deeply readonly, so this flags almost every parameter
			'typescript/prefer-readonly-parameter-types': 'off',
			// Components and hooks are naturally long and import a lot
			'eslint/max-lines-per-function': 'off',
			'import/max-dependencies': 'off',
			// Zod's `.catch()` looks like a promise chain
			'unicorn/prefer-top-level-await': 'off',
			// TypeScript often needs an explicit `undefined`, ex. for required parameters and `noImplicitReturns`
			'unicorn/no-useless-undefined': 'off',
			// Flags ARIA roles on components and SVG icons, where a native tag isn't an option
			'jsx-a11y/prefer-tag-over-role': 'off',
			// Only used to focus inputs opened by a user action, ex. renaming a dashboard
			'jsx-a11y/no-autofocus': 'off',

			// Rule options
			'typescript/no-confusing-void-expression': ['error', { ignoreArrowShorthand: true }],
			'typescript/switch-exhaustiveness-check': ['error', { considerDefaultExhaustiveForUnions: true }],
			'import/no-unassigned-import': ['error', { allow: ['**/*.css'] }],

			// Selected rules from the restriction and style categories, which are too opinionated to enable wholesale
			'eslint/curly': 'error',
			'eslint/no-alert': 'error',
			'eslint/no-console': 'error',
			'eslint/no-implicit-coercion': 'error',
			'eslint/no-param-reassign': 'error',
			'eslint/no-sequences': 'error',
			'eslint/no-var': 'error',
			'eslint/object-shorthand': 'error',
			'eslint/prefer-const': 'error',
			'eslint/prefer-object-has-own': 'error',
			'eslint/prefer-object-spread': 'error',
			'eslint/prefer-spread': 'error',
			'eslint/prefer-template': 'error',
			'import/first': 'error',
			'import/no-cycle': 'error',
			'import/no-duplicates': 'error',
			'import/no-mutable-exports': 'error',
			'promise/no-nesting': 'error',
			'promise/param-names': 'error',
			'react/button-has-type': 'error',
			'react/jsx-boolean-value': 'error',
			'react/jsx-curly-brace-presence': 'error',
			'react/jsx-fragments': 'error',
			'react/no-danger': 'error',
			'react/no-unknown-property': 'error',
			'react/self-closing-comp': 'error',
			'typescript/array-type': 'error',
			'typescript/consistent-type-assertions': 'error',
			'typescript/consistent-type-imports': 'error',
			'typescript/no-empty-object-type': 'error',
			'typescript/no-explicit-any': 'error',
			'typescript/no-import-type-side-effects': 'error',
			'typescript/no-inferrable-types': 'error',
			'typescript/prefer-for-of': 'error',
			'typescript/use-unknown-in-catch-callback-variable': 'error',
			'unicorn/filename-case': 'error',
			'unicorn/no-abusive-eslint-disable': 'error',
			'unicorn/no-array-method-this-argument': 'error',
			'unicorn/prefer-array-index-of': 'error',
			'unicorn/prefer-includes': 'error',
			'unicorn/prefer-keyboard-event-key': 'error',
			'unicorn/prefer-modern-dom-apis': 'error',
			'unicorn/prefer-modern-math-apis': 'error',
			'unicorn/prefer-negative-index': 'error',
			'unicorn/prefer-node-protocol': 'error',
			'unicorn/prefer-number-properties': 'error',
			'unicorn/prefer-optional-catch-binding': 'error',
			'unicorn/prefer-structured-clone': 'error',
			'unicorn/require-array-join-separator': 'error',
			'unicorn/throw-new-error': 'error',
			'vitest/no-identical-title': 'error',
			'vitest/prefer-to-be': 'error',
			'vitest/prefer-to-have-length': 'error',
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
			denyWarnings: true,
			reportUnusedDisableDirectives: 'error',
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
				globIgnores: ['**/_headers'],
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
			// Generates icons from public/logo.svg and injects their links into index.html
			pwaAssets: {
				config: true,
			},
		}),
	]),
	define: {
		STUDIO_VERSION: JSON.stringify(packageJson.version),
		STUDIO_COMMIT: JSON.stringify(getCommitHash()),
	},
	resolve: {
		tsconfigPaths: true,
	},
	test: {
		// Lets `theme-color.test.ts` import the default colors with `?raw`, Vitest replaces CSS with an empty string by default
		css: { include: [/index\.css/u] },
		server: {
			deps: {
				// Its ESM imports leave off file extensions, which Node can't resolve
				inline: ['@material/material-color-utilities'],
			},
		},
	},
	// Tauri expects a fixed dev server port
	clearScreen: false,
	server: {
		strictPort: true,
	},
});
