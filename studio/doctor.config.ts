import { defineConfig } from 'react-doctor/api';

export default defineConfig({
	ignore: {
		files: [
			'src/routeTree.gen.ts',
			// coss ui/shadcn files are copied in from a registry
			'src/components/ui/**',
			'src/hooks/use-media-query.ts',
			'src/lib/utils.ts',
			// Rust build output, the crypto libraries' test keys look like leaked secrets
			'src-tauri/target/**',
		],
	},
	// Fail on warnings too, so nothing silently accumulates
	blocking: 'warning',
	surfaces: {
		// Design rules and test files are left out of the CI gate by default
		ciFailure: { includeTags: ['design'], includeFileContexts: ['test'] },
	},
	// Opt-in rules worth enforcing. Unused code is left to Knip, and import cycles and style rules to Oxlint
	rules: {
		'react-doctor/data-table-requires-accessible-name': 'warn',
		'react-doctor/details-requires-summary': 'warn',
		'react-doctor/empty-table-header': 'warn',
		'react-doctor/fieldset-requires-legend': 'warn',
		'react-doctor/forwarded-set-state-in-effect': 'warn',
		'react-doctor/loading-action-preserves-trigger': 'warn',
		'react-doctor/no-array-index-key': 'warn',
		'react-doctor/no-aria-invalid-without-description': 'warn',
		'react-doctor/no-collapse-request-error-to-empty-state': 'warn',
		'react-doctor/no-controlled-selection-focus-effect': 'warn',
		'react-doctor/no-danger': 'warn',
		'react-doctor/no-duplicate-static-id-reference': 'warn',
		'react-doctor/no-focusable-content-in-role-text': 'warn',
		'react-doctor/no-passive-request-owner-ref': 'warn',
		'react-doctor/no-presentation-role-conflict': 'warn',
		'react-doctor/no-reduced-motion-content-removal': 'warn',
		'react-doctor/no-skipped-heading-level': 'warn',
		'react-doctor/no-unbounded-animation-frame-loop': 'warn',
		'react-doctor/no-ungated-tailwind-animation': 'warn',
		'react-doctor/no-usememo-simple-expression': 'warn',
		'react-doctor/prefer-module-scope-pure-function': 'warn',
		'react-doctor/prefer-module-scope-static-value': 'warn',
		'react-doctor/zod-v4-prefer-top-level-string-formats': 'warn',
	},
	// Don't upload diagnostics to the score API or create share links. Crash reports and usage metrics are only disabled by
	// the `--no-telemetry` flag in the `doctor` script
	noScore: true,
	share: false,
	// pnpm already enforces supply-chain policies, and this check sends every dependency to Socket.dev
	supplyChain: { enabled: false },
});
