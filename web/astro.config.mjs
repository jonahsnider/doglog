import markdoc from '@astrojs/markdoc';
import starlight from '@astrojs/starlight';
import AstroPWA from '@vite-pwa/astro';
import { defineConfig } from 'astro/config';
import starlightChangelogs from 'starlight-changelogs';

// https://astro.build/config
export default defineConfig({
	site: 'https://doglog.dev',
	trailingSlash: 'never',
	integrations: [
		starlight({
			title: 'DogLog Docs',
			plugins: [starlightChangelogs()],
			favicon: '/favicon.ico',
			social: [
				{
					href: 'https://github.com/jonahsnider/doglog',
					icon: 'github',
					label: 'GitHub',
				},
			],
			logo: {
				alt: 'DogLog logo',
				src: './public/logo.svg',
			},
			sidebar: [
				{
					label: 'Getting started',
					items: [{ autogenerate: { directory: 'getting-started' } }],
				},
				{
					label: 'Guides',
					items: [{ autogenerate: { directory: 'guides' } }],
				},
				{
					label: 'Reference',
					items: [
						{ autogenerate: { directory: 'reference' } },
						{
							label: 'Changelog',
							link: '/reference/changelog',
						},
						{
							label: 'Javadoc',
							link: 'https://javadoc.doglog.dev',
						},
					],
				},
			],
			customCss: ['/src/styles/custom.css'],
			components: {
				Head: './src/components/PwaHead.astro',
			},
		}),
		markdoc(),
		AstroPWA({
			base: '/',
			scope: '/',
			registerType: 'autoUpdate',
			workbox: {
				cleanupOutdatedCaches: true,
				cacheId: 'doglog-docs',
				globPatterns: ['**/*'],
			},
			manifest: {
				name: 'DogLog Docs',
				short_name: 'DogLog',
				background_color: '#ffffff',
				description: 'Simpler logging for FRC, DogLog is the easiest way to add logging to your robot code',
				theme_color: '#460b05',
				lang: 'en',
				display: 'minimal-ui',
				id: 'doglog.dev',
				start_url: '/',
				orientation: 'any',
			},
			pwaAssets: {
				image: './public/logo.svg',
			},
			experimental: {
				directoryAndTrailingSlashHandler: true,
			},
		}),
	],
	redirects: {
		'/guides/faults': '/reference/faults',
		'/guides/tunable-values': '/reference/tunable-values',
	},
});
