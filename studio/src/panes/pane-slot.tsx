import * as stylex from '@stylexjs/stylex';
import { type ReactNode, useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { hostOf, type PaneHosts } from '@/panes/pane-hosts';

const styles = stylex.create({
	// Lays the pane out as if it were in its place itself
	slot: { display: 'contents' },
});

/** Where a pane goes in the layout, it's rendered elsewhere into its host, see `usePaneHosts()` */
export function PaneSlot({ hosts, paneId }: { hosts: PaneHosts; paneId: string }) {
	const host = hostOf(hosts, paneId);
	const { release } = hosts;
	const slot = useRef<HTMLDivElement>(null);
	useLayoutEffect(() => {
		// Only moved when it's somewhere else, since moving it loses its scroll positions
		if (host.parentNode !== slot.current) {
			slot.current?.replaceChildren(host);
		}
		// Closed panes go once they're no longer in a slot, including ones closed while the dashboard was hidden
		release();
		return release;
	}, [host, release]);
	return <div ref={slot} {...stylex.props(styles.slot)} />;
}

/** A pane rendered into its host. Render it after the layout, so the pane is in its place before its own effects run. */
export function PanePortal({ hosts, paneId, children }: { hosts: PaneHosts; paneId: string; children: ReactNode }) {
	return createPortal(children, hostOf(hosts, paneId));
}
