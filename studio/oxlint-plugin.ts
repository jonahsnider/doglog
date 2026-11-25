import { definePlugin, defineRule } from 'vite-plus/lint/plugins';

const noManualMemo = 'no-manual-memo';
const memoHooks = new Set(['useMemo', 'useCallback']);

export default definePlugin({
	meta: { name: 'studio' },
	rules: {
		// React Compiler memoizes most values and functions on its own, so a useMemo() or useCallback() has to say why
		// it's still needed
		[noManualMemo]: defineRule({
			create: (context) => ({
				CallExpression(node) {
					if (node.callee.type === 'Identifier' && memoHooks.has(node.callee.name)) {
						context.report({
							node: node.callee,
							message: `React Compiler memoizes values and functions itself. If it can't here, keep ${node.callee.name}() with \`// oxlint-disable-next-line studio/${noManualMemo} -- <why>\`.`,
						});
					}
				},
				Program() {
					for (const directive of context.sourceCode.getDisableDirectives().directives) {
						if (directive.value.includes(`studio/${noManualMemo}`) && directive.justification.trim() === '') {
							context.report({
								node: directive.node,
								message: `Explain after \`--\` why React Compiler can't memoize this on its own.`,
							});
						}
					}
				},
			}),
		}),
	},
});
