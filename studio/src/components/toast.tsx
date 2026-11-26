import type { Hotkey } from '@tanstack/react-hotkeys';
import { nanoid } from 'nanoid';
import type { ReactNode } from 'react';
import { toast } from 'sonner';
import { ToastCard } from '@/components/toasts';

export type ToastType = 'info' | 'success' | 'warning' | 'error' | 'loading';

export interface ToastOptions {
	type?: ToastType;
	title: ReactNode;
	description?: ReactNode;
	/** A button at the end of the toast, with its shortcut in a tooltip */
	actionProps?: { children: string; onClick: () => void; shortcut?: Hotkey };
	/** Milliseconds before it hides on its own, 0 keeps it until it's dismissed. Errors and loading toasts always stay. */
	timeout?: number;
}

/**
 * Shows toasts from anywhere, including outside React and before `Toasts` renders. `update` replaces a toast's contents
 * in place, or shows it with that ID if it's gone.
 */
export const toastManager = {
	add(options: ToastOptions): string {
		const id = nanoid();
		toastManager.update(id, options);
		return id;
	},
	update(id: string, { type = 'info', timeout, ...options }: ToastOptions): void {
		toast.custom(() => <ToastCard id={id} type={type} {...options} />, {
			id,
			// Undefined uses the toaster's default, and resets the duration of a toast this replaces
			duration: type === 'error' || type === 'loading' || timeout === 0 ? Infinity : timeout,
		});
	},
	close(id: string): void {
		toast.dismiss(id);
	},
};
