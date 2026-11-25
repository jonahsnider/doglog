import { createContext, use } from 'react';

export type SidebarContextProps = {
	/** Whether it only shows icons, the rail. Peeking shows the full sidebar. */
	collapsed: boolean;
	/** Whether it's expanded, ex. not collapsed into the rail, even while it peeks */
	open: boolean;
	/** Whether it's the phone layout's drawer */
	isMobile: boolean;
	toggleSidebar: () => void;
};

export const SidebarContext = createContext<SidebarContextProps>({
	collapsed: false,
	open: true,
	isMobile: false,
	toggleSidebar: () => {},
});

export function useSidebar(): SidebarContextProps {
	return use(SidebarContext);
}
