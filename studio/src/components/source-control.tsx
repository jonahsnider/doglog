import { useFormatForDisplay } from '@tanstack/react-hotkeys';
import { useNavigate } from '@tanstack/react-router';
import {
	ChevronsUpDownIcon,
	DatabaseIcon,
	FileIcon,
	FolderOpenIcon,
	LaptopIcon,
	RadioTowerIcon,
	ZapIcon,
} from 'lucide-react';
import { useRef } from 'react';
import { Menu, MenuItem, MenuPopup, MenuSeparator, MenuTrigger } from '@/components/ui/menu';
import { SidebarMenuButton } from '@/components/ui/sidebar';
import { Spinner } from '@/components/ui/spinner';
import { toastManager } from '@/components/ui/toast';
import { shortcuts, startQuickConnect } from '@/commands';
import { connect, openLog, type Source, useSource } from '@/data/source';
import { cn } from '@/lib/utils';
import { getRobotHost, simulatorHost } from '@/robot-target';
import { useSettings } from '@/settings';

const statusLabels: Record<Source['status'], string> = {
	loading: 'Loading…',
	loaded: 'Log file',
	connecting: 'Connecting…',
	connected: 'Connected',
	disconnected: 'Disconnected, reconnecting…',
};

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
	const { robotTarget } = useSettings();
	const robotHost = getRobotHost(robotTarget);
	const navigate = useNavigate();
	const formatForDisplay = useFormatForDisplay();
	const fileInput = useRef<HTMLInputElement>(null);

	const connectToRobot = () => {
		if (robotHost !== undefined) {
			void connect(robotHost);
			return;
		}

		void navigate({ to: '/settings' });
		toastManager.add({
			type: 'info',
			title: 'Set up your robot connection',
			description: 'Enter your team number or robot IP address in Settings.',
		});
	};

	const name = source === undefined ? 'No data source' : source.type === 'log' ? source.fileName : source.host;
	const status = source === undefined ? 'Open a log or connect' : statusLabels[source.status];

	return (
		<>
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
					<MenuItem onClick={() => fileInput.current?.click()}>
						<FolderOpenIcon />
						Open log
					</MenuItem>
					<MenuSeparator />
					<MenuItem onClick={startQuickConnect}>
						<ZapIcon />
						Quick connect
						<span className="ms-auto text-xs text-muted-foreground">{formatForDisplay(shortcuts.quickConnect)}</span>
					</MenuItem>
					<MenuItem onClick={connectToRobot}>
						<RadioTowerIcon />
						Connect to robot
						<span className="ms-auto text-xs text-muted-foreground">{robotHost ?? 'Set up'}</span>
					</MenuItem>
					<MenuItem onClick={() => void connect(simulatorHost)}>
						<LaptopIcon />
						Simulator
					</MenuItem>
				</MenuPopup>
			</Menu>
			<input
				ref={fileInput}
				type="file"
				accept=".wpilog"
				hidden
				onChange={(event) => {
					const file = event.currentTarget.files?.[0];
					if (file) {
						void openLog(file);
					}
					// Allow choosing the same file again
					event.currentTarget.value = '';
				}}
			/>
		</>
	);
}
