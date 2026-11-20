import { defineConfig } from 'void/config';

export default defineConfig({
	worker: {
		compatibility_date: '2026-11-15',
	},
	cloudflare: {
		name: 'doglog-cloud',
		routes: [{ pattern: 'cloud.doglog.dev', custom_domain: true }],
		workers_dev: false,
	},
});
