import { Button } from '@astryxdesign/core/Button';
import { ButtonGroup } from '@astryxdesign/core/ButtonGroup';
import { DropdownMenu, DropdownMenuItem } from '@astryxdesign/core/DropdownMenu';
import { invoke } from '@tauri-apps/api/core';
import ChevronDownIcon from 'lucide-react/icons/chevron-down';
import DownloadIcon from 'lucide-react/icons/download';
import type { ReactElement } from 'react';
import { Menu, MenuGroup, MenuGroupLabel, MenuItem, MenuLinkItem, MenuPopup, MenuTrigger } from '@/components/ui/menu';
import { toastManager } from '@/components/toast';

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
	const ua = navigator.userAgent;
	// Phones and tablets can't run the desktop app, iPads say they're Macs but have touch screens
	if (/Android|iPhone|iPad/u.test(ua) || (ua.includes('Mac') && navigator.maxTouchPoints > 1)) {
		return undefined;
	}
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
export function DownloadButton() {
	const platform = detectPlatform();
	const primary = downloads.find((download) => download.platform === platform);
	const items = downloads.map((download) => (
		<DropdownMenuItem key={download.file} label={download.label} href={downloadsUrl + download.file} />
	));

	if (!primary) {
		return (
			<DropdownMenu button={{ label: 'Download', variant: 'primary', icon: <DownloadIcon /> }} alignment="center">
				{items}
			</DropdownMenu>
		);
	}

	return (
		<ButtonGroup label="Download the desktop app">
			<Button
				label={`Download for ${platformNames[primary.platform]}`}
				variant="primary"
				icon={<DownloadIcon />}
				href={downloadsUrl + primary.file}
			/>
			<DropdownMenu
				button={{ label: 'Other platforms', variant: 'primary', isIconOnly: true, icon: <ChevronDownIcon /> }}
				hasChevron={false}
				alignment="end"
			>
				{items}
			</DropdownMenu>
		</ButtonGroup>
	);
}

async function copyDownloadLink(file: string): Promise<void> {
	try {
		await invoke('plugin:clipboard-manager|write_text', { text: downloadsUrl + file });
		toastManager.add({ type: 'success', title: 'Copied download link' });
	} catch {
		toastManager.add({ type: 'error', title: 'Couldn’t copy download link' });
	}
}

/** Lists every installer, which downloads in the browser and copies its link in the desktop app for sharing */
export function DownloadMenu({ trigger }: { trigger: ReactElement }) {
	return (
		<Menu>
			<MenuTrigger render={trigger} />
			<MenuPopup align="start" side="top">
				{STUDIO_DESKTOP ? (
					<MenuGroup>
						<MenuGroupLabel>Copy download link</MenuGroupLabel>
						{downloads.map(({ file, label }) => (
							<MenuItem key={file} onClick={() => void copyDownloadLink(file)}>
								{label}
							</MenuItem>
						))}
					</MenuGroup>
				) : (
					downloads.map(({ file, label }) => (
						<MenuLinkItem key={file} href={downloadsUrl + file}>
							{label}
						</MenuLinkItem>
					))
				)}
			</MenuPopup>
		</Menu>
	);
}
