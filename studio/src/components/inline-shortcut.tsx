import type { ComponentProps } from 'react';
import { Kbd } from '@/components/ui/kbd';
import { useMobileLayout } from '@/lib/mobile-layout';

/** An always-visible shortcut hint, omitted in the phone layout. */
export function InlineShortcut(props: ComponentProps<typeof Kbd>) {
	return useMobileLayout() ? null : <Kbd {...props} />;
}
