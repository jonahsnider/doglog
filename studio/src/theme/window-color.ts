import { useSelector } from '@tanstack/react-store';
import { createAtom } from '@tanstack/store';

/** How many chart colors there are for the 2nd, 3rd, … open window, repeating after the last */
const colorCount = 5;

/** Position of this window among open Studio tabs and windows, `0` for the first */
const slotStore = createAtom<number | undefined>(undefined);

/** Try to hold the lock for `slot` until this window closes, resolves whether it was free */
function claimSlot(slot: number): Promise<boolean> {
	return new Promise((resolve) => {
		void navigator.locks.request(`doglog-studio:window-${slot}`, { ifAvailable: true }, (lock) => {
			resolve(lock !== null);
			// Never settles, so the lock is held until the window closes and frees the slot for the next one
			return lock === null ? undefined : new Promise(() => {});
		});
	});
}

/** Take the lowest free slot, closed windows free theirs */
async function claimLowestSlot(): Promise<void> {
	let slot = 0;
	// oxlint-disable-next-line no-await-in-loop -- Trying slots in order is what makes it the lowest free one
	while (!(await claimSlot(slot))) {
		slot++;
	}
	slotStore.set(slot);
}

// Not awaited so the app can start rendering first. Tests run without Web Locks
if (typeof navigator !== 'undefined' && 'locks' in navigator) {
	void claimLowestSlot();
}

/**
 * Chart color number (1-5) that tells this window apart from other open ones, `undefined` for the first window.
 * Set it as `data-window-color` to tint an element, see `index.css`.
 */
export function useWindowColor(): number | undefined {
	const slot = useSelector(slotStore);
	return slot === undefined || slot === 0 ? undefined : ((slot - 1) % colorCount) + 1;
}
