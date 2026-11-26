/** Run `callback` once per frame, no matter how many times the returned function is called */
export function perFrame(callback: () => void): { schedule: () => void; cancel: () => void } {
	let frame: number | undefined;
	return {
		schedule: () => {
			frame ??= requestAnimationFrame(() => {
				frame = undefined;
				callback();
			});
		},
		cancel: () => {
			if (frame !== undefined) {
				cancelAnimationFrame(frame);
			}
		},
	};
}
