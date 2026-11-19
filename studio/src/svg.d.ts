// SVGs imported as React components by vite-plugin-svgr. Its own `vite-plugin-svgr/client` types import React from
// its package, where pnpm doesn't install React, so the type-aware linter can't resolve them.
declare module '*.svg?react' {
	import type { ComponentProps, FunctionComponent } from 'react';

	const Component: FunctionComponent<ComponentProps<'svg'>>;
	export default Component;
}
