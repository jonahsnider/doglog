import markdoc from '@astrojs/markdoc';
import starlight from '@astrojs/starlight';
import { defineConfig } from 'astro/config';
import fs from 'fs/promises';
import path from 'path';
import starlightLinksValidator from 'starlight-links-validator';
import AstroPWA from '@vite-pwa/astro';

// https://astro.build/config
export default defineConfig({
	site: 'https://doglog.dev',
	trailingSlash: 'never',
	integrations: [
		{
			name: 'copy-files',
			hooks: {
				'astro:config:setup': async () => {
					await Promise.all([writeChangelogToContent(), copyVendordep()]);
				},
			},
		},
		starlight({
			// TODO: Enable this once mdoc files are parsed properly https://github.com/HiDeoo/starlight-links-validator/issues/96
			// plugins: [starlightLinksValidator()],
			title: 'DogLog Docs',
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
				src: './src/assets/logo.svg',
			},
			sidebar: [
				{
					label: 'Getting started',
					autogenerate: { directory: 'getting-started' },
				},
				{
					label: 'Guides',
					autogenerate: { directory: 'guides' },
				},
				{
					label: 'Reference',
					autogenerate: { directory: 'reference' },
				},
				{
					label: 'Javadoc',
					link: 'https://javadoc.doglog.dev',
				},
			],
			customCss: ['/src/styles/custom.css'],
			components: {
				Head: './src/components/Head.astro',
				PageFooter: './src/components/PageFooter.astro',
			},
		}),
		markdoc(),
		AstroPWA({
			mode: 'production',
			base: '/',
			scope: '/',
			includeAssets: ['favicon.ico'],
			registerType: 'autoUpdate',
			manifest: {
				name: 'DogLog Docs',
				short_name: 'DogLog',
				description: 'DogLog documentation - A logging library for FRC robots',
				theme_color: '#E86D38',
				background_color: '#ffffff',
				display: 'standalone',
				orientation: 'portrait',
				scope: '/',
				start_url: '/',
				icons: [
					{
						src: '/favicon.ico',
						sizes: '48x48',
						type: 'image/x-icon',
					},
					{
						src: '/favicon.ico',
						sizes: '192x192',
						type: 'image/x-icon',
						purpose: 'any maskable',
					},
					{
						src: '/favicon.ico',
						sizes: '512x512',
						type: 'image/x-icon',
						purpose: 'any maskable',
					},
				],
			},
			workbox: {
				globDirectory: 'dist',
				globPatterns: ['**/*.{js,css,html,svg,png,ico,txt,json,md,mdoc}'],
				// Don't fallback on document based (e.g. `/some-page`) requests
				// This is useful for Astro static sites since all pages are pre-rendered
				navigateFallback: null,
				// Clean old caches
				cleanupOutdatedCaches: true,
				// Skip waiting for service worker activation
				skipWaiting: true,
				// Claim clients immediately
				clientsClaim: true,
				runtimeCaching: [
					// Cache Google Fonts stylesheets
					{
						urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
						handler: 'StaleWhileRevalidate',
						options: {
							cacheName: 'google-fonts-stylesheets',
							expiration: {
								maxEntries: 10,
								maxAgeSeconds: 60 * 60 * 24 * 365, // 365 days
							},
						},
					},
					// Cache Google Fonts webfonts
					{
						urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
						handler: 'CacheFirst',
						options: {
							cacheName: 'google-fonts-webfonts',
							expiration: {
								maxEntries: 30,
								maxAgeSeconds: 60 * 60 * 24 * 365, // 365 days
							},
						},
					},
					// Cache images
					{
						urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp|ico)$/i,
						handler: 'CacheFirst',
						options: {
							cacheName: 'images-cache',
							expiration: {
								maxEntries: 60,
								maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
							},
						},
					},
					// Cache CSS and JS files
					{
						urlPattern: /\.(?:js|css)$/i,
						handler: 'StaleWhileRevalidate',
						options: {
							cacheName: 'static-resources',
							expiration: {
								maxEntries: 60,
								maxAgeSeconds: 60 * 60 * 24 * 7, // 7 days
							},
						},
					},
					// Cache HTML pages (documentation pages)
					{
						urlPattern: /\.html$/i,
						handler: 'StaleWhileRevalidate',
						options: {
							cacheName: 'pages-cache',
							expiration: {
								maxEntries: 100,
								maxAgeSeconds: 60 * 60 * 24 * 7, // 7 days
							},
						},
					},
					// Cache API responses (if any)
					{
						urlPattern: /^https:\/\/doglog\.dev\/api\/.*/i,
						handler: 'NetworkFirst',
						options: {
							cacheName: 'api-cache',
							networkTimeoutSeconds: 3,
							expiration: {
								maxEntries: 50,
								maxAgeSeconds: 60 * 60 * 24, // 1 day
							},
						},
					},
				],
			},
		}),
	],
});

async function writeChangelogToContent() {
	const CHANGELOG_INPUT_PATH = path.join(import.meta.dirname, '..', 'CHANGELOG.md');
	const OUTPUT_PATH = path.join(import.meta.dirname, 'src', 'content', 'docs', 'reference', 'changelog.md');

	const rawChangelog = await fs.readFile(CHANGELOG_INPUT_PATH, 'utf-8');

	const newChangelog =
		[
			'---',
			'# AUTOGENERATED - see astro.config.mjs',
			'title: Changelog',
			'description: Changelog of updates to DogLog.',
			'---',
			'',
		].join('\n') + rawChangelog.replace('# Changelog', '');

	await fs.writeFile(OUTPUT_PATH, newChangelog);
}

async function copyVendordep() {
	const VENDORDEP_INPUT_PATH = path.join(import.meta.dirname, '..', 'vendordep.json');
	const OUTPUT_PATH = path.join(import.meta.dirname, 'public', 'vendordep.json');

	await fs.copyFile(VENDORDEP_INPUT_PATH, OUTPUT_PATH);
}
