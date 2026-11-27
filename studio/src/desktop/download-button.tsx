import { Button, type ButtonSize } from '@astryxdesign/core/Button';
import { ButtonGroup } from '@astryxdesign/core/ButtonGroup';
import { DropdownMenu, DropdownMenuItem, type DropdownMenuTriggerProps } from '@astryxdesign/core/DropdownMenu';
import ChevronDownIcon from 'lucide-react/icons/chevron-down';
import DownloadIcon from 'lucide-react/icons/download';
import type { ReactNode } from 'react';
import { isMobileDevice } from '@/lib/mobile-layout';

type Platform = 'macos' | 'windows' | 'linux';

const platformNames: Record<Platform, string> = { macos: 'macOS', windows: 'Windows', linux: 'Linux' };

/** Copies of the latest release's installers with fixed names, published by the release workflow */
const downloadsUrl = 'https://updates.doglog.dev/studio/';

const downloads: { platform: Platform; label: string; file: string }[] = [
	// Browsers can't reliably tell Apple silicon from Intel, so Intel Macs pick theirs from the menu
	{ platform: 'macos', label: 'macOS (Apple silicon)', file: 'DogLog-Studio-macos-apple-silicon.dmg' },
	{ platform: 'macos', label: 'macOS (Intel)', file: 'DogLog-Studio-macos-intel.dmg' },
	{ platform: 'windows', label: 'Windows', file: 'DogLog-Studio-windows-setup.exe' },
	{ platform: 'linux', label: 'Linux (AppImage)', file: 'DogLog-Studio-linux.AppImage' },
	{ platform: 'linux', label: 'Linux (.deb)', file: 'DogLog-Studio-linux.deb' },
];

function detectPlatform(): Platform | undefined {
	if (isMobileDevice()) {
		return undefined;
	}
	const ua = navigator.userAgent;
	if (ua.includes('Win')) {
		return 'windows';
	}
	if (ua.includes('Mac')) {
		return 'macos';
	}
	if (ua.includes('Linux')) {
		return 'linux';
	}
	return undefined;
}

/** Downloads the desktop app for the user's platform, with the other platforms in a menu */
export function DownloadButton({ size }: { size?: ButtonSize }) {
	const platform = detectPlatform();
	const primary = downloads.find((download) => download.platform === platform);
	const items = downloads.map((download) => (
		<DropdownMenuItem key={download.file} label={download.label} href={downloadsUrl + download.file} />
	));

	if (!primary) {
		return (
			<DropdownMenu button={{ label: 'Download', variant: 'primary', size, icon: <DownloadIcon /> }} alignment="center">
				{items}
			</DropdownMenu>
		);
	}

	return (
		<ButtonGroup label="Download the desktop app">
			<Button
				label={`Download for ${platformNames[primary.platform]}`}
				variant="primary"
				size={size}
				icon={<DownloadIcon />}
				href={downloadsUrl + primary.file}
			/>
			<DropdownMenu
				button={{ label: 'Other platforms', variant: 'primary', size, isIconOnly: true, icon: <ChevronDownIcon /> }}
				hasChevron={false}
				alignment="end"
			>
				{items}
			</DropdownMenu>
		</ButtonGroup>
	);
}

export function DownloadMenu({ renderTrigger }: { renderTrigger: (props: DropdownMenuTriggerProps) => ReactNode }) {
	return (
		<DropdownMenu placement="above" renderTrigger={renderTrigger}>
			{downloads.map(({ file, label }) => (
				<DropdownMenuItem key={file} label={label} href={downloadsUrl + file} />
			))}
		</DropdownMenu>
	);
}
