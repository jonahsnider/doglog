import svgr from 'vite-plugin-svgr';
import { voidPlugin } from 'void';
import { defineConfig, lazyPlugins } from 'vite-plus';

/** Written by Void, see .gitignore */
const generated = ['.void/', '.void-wrangler.jsonc', '.cloudflare/', 'dist/'];

export default defineConfig({
	fmt: {
		singleQuote: true,
		useTabs: true,
		printWidth: 120,
		ignorePatterns: [...generated, 'void.lock.json'],
	},
	lint: {
		ignorePatterns: generated,
	},
	// Lazy since `voidPlugin()` reads and writes project files as soon as it's called, which linting doesn't need
	plugins: lazyPlugins(() => [
		// Studio's widget icons, which link preview images draw, include SVGs imported with `?react`
		svgr(),
		voidPlugin(),
	]),
	resolve: {
		// Studio's code imports its own modules with `@/`
		tsconfigPaths: true,
	},
});
