import { defineConfig } from 'void/config';

export default defineConfig({
	worker: {
		compatibility_date: '2026-11-15',
	},
	cloudflare: {
		name: 'doglog-cloud',
		routes: [{ pattern: 'cloud.doglog.dev', custom_domain: true }],
		workers_dev: false,
		upload_source_maps: true,
		// Request telemetry must not log dashboard links.
		observability: {
			enabled: false,
			issues: { enabled: false },
			logs: { enabled: false },
			traces: { enabled: false },
		},
	},
});
