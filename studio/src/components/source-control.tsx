import { useFormatForDisplay } from '@tanstack/react-hotkeys';
import { ChevronsUpDownIcon, DatabaseIcon, FileIcon, FolderOpenIcon, RadioTowerIcon } from 'lucide-react';
import { AppContextMenu, type MenuEntry } from '@/components/app-context-menu';
import { Menu, MenuItem, MenuPopup, MenuSeparator, MenuTrigger } from '@/components/ui/menu';
import { SidebarMenuButton, SidebarMenuItem } from '@/components/ui/sidebar';
import { Spinner } from '@/components/ui/spinner';
import { shortcuts, startConnect } from '@/commands';
import { chooseLog, type Source, useSource } from '@/data/source';
import { cn } from '@/lib/utils';

const statusLabels: Record<Source['status'], string> = {
	loading: 'Loading…',
	loaded: 'Log file',
	connecting: 'Connecting…',
	connected: 'Connected',
	disconnected: 'Disconnected, reconnecting…',
};

const menuItems: MenuEntry[] = [
	{ label: 'Open log', icon: FolderOpenIcon, shortcut: shortcuts.openLog, onSelect: chooseLog },
	'separator',
	{ label: 'Connect', icon: RadioTowerIcon, shortcut: shortcuts.connect, onSelect: startConnect },
];

function SourceIcon({ source }: { source: Source | undefined }) {
	if (source?.status === 'loading' || source?.status === 'connecting') {
		return <Spinner />;
	}

	if (source === undefined) {
		return <DatabaseIcon />;
	}
	if (source.type === 'log') {
		return <FileIcon />;
	}
	return <RadioTowerIcon className={source.status === 'connected' ? 'text-success' : 'text-destructive-foreground'} />;
}

/** Shows the active data source and lets the user open a log or connect live */
export function SourceControl() {
	const source = useSource();
	const formatForDisplay = useFormatForDisplay();

	const name = source === undefined ? 'No data source' : source.type === 'log' ? source.fileName : source.host;
	const status = source === undefined ? 'Open a log or connect' : statusLabels[source.status];

	return (
		<AppContextMenu items={menuItems} render={<SidebarMenuItem />}>
			<Menu>
				<MenuTrigger
					render={
						<SidebarMenuButton
							size="lg"
							// Keep the icon aligned and the height the same when only icons are shown
							className="group-data-[collapsible=icon]:h-12! group-data-[collapsible=icon]:p-2!"
							tooltip={`${name}: ${status}`}
						/>
					}
				>
					<SourceIcon source={source} />
					<div className="grid flex-1 text-left leading-tight">
						<span className="truncate font-medium">{name}</span>
						<span
							className={cn(
								'truncate text-xs text-muted-foreground',
								source?.status === 'disconnected' && 'text-destructive-foreground',
							)}
						>
							{status}
						</span>
					</div>
					<ChevronsUpDownIcon className="ms-auto text-muted-foreground" />
				</MenuTrigger>
				<MenuPopup align="start" className="w-(--anchor-width) min-w-56">
					<MenuItem onClick={chooseLog}>
						<FolderOpenIcon />
						Open log
						<span className="ms-auto text-xs text-muted-foreground">{formatForDisplay(shortcuts.openLog)}</span>
					</MenuItem>
					<MenuSeparator />
					<MenuItem onClick={startConnect}>
						<RadioTowerIcon />
						Connect
						<span className="ms-auto text-xs text-muted-foreground">{formatForDisplay(shortcuts.connect)}</span>
					</MenuItem>
				</MenuPopup>
			</Menu>
		</AppContextMenu>
	);
}
