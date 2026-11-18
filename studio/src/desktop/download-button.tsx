import { ChevronDownIcon, DownloadIcon } from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';
import { Group, GroupSeparator } from '@/components/ui/group';
import { Menu, MenuLinkItem, MenuPopup, MenuTrigger } from '@/components/ui/menu';

type Platform = 'macos' | 'windows' | 'linux';

const platformNames: Record<Platform, string> = { macos: 'macOS', windows: 'Windows', linux: 'Linux' };

/** Copies of the latest release's installers with fixed names, published by the release workflow */
const downloadsUrl = 'https://updates.doglog.dev/studio/';

/** The first download for each platform is the one offered by default */
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

	const menuPopup = (
		<MenuPopup align="end">
			{downloads.map((download) => (
				<MenuLinkItem key={download.file} href={downloadsUrl + download.file}>
					{download.label}
				</MenuLinkItem>
			))}
		</MenuPopup>
	);

	if (!primary) {
		return (
			<Menu>
				<MenuTrigger render={<Button />}>
					<DownloadIcon />
					Download
					<ChevronDownIcon />
				</MenuTrigger>
				{menuPopup}
			</Menu>
		);
	}

	return (
		<Group aria-label="Download the desktop app">
			<a href={downloadsUrl + primary.file} className={buttonVariants()} data-slot="button">
				<DownloadIcon />
				Download for {platformNames[primary.platform]}
			</a>
			<GroupSeparator />
			<Menu>
				<MenuTrigger render={<Button size="icon" aria-label="Other platforms" />}>
					<ChevronDownIcon />
				</MenuTrigger>
				{menuPopup}
			</Menu>
		</Group>
	);
}
