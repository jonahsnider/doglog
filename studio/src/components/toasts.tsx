import { ToastViewport, useToast } from '@astryxdesign/core/Toast';
import { type ReactNode, useEffect } from 'react';
import { connectToasts } from '@/components/toast';

/** Where `toastManager` shows toasts, wrapped around the app once at the root */
export function Toasts({ children }: { children: ReactNode }) {
	return (
		<ToastViewport position="bottomEnd">
			<ToastBridge />
			{children}
		</ToastViewport>
	);
}

function ToastBridge() {
	const show = useToast();
	useEffect(() => connectToasts(show), [show]);
	return null;
}
