import { base64ToUint8Array, stringToBase64 } from 'uint8array-extras';
import type { RenderOptions } from 'takumi-js';
import { themePalette } from '@astryxdesign/core/palette';
import { team581Seeds } from '@/theme/team581-colors';
import plexSansUrl from '@fontsource-variable/ibm-plex-sans/files/ibm-plex-sans-latin-wght-normal.woff2?inline';
import sourceSansUrl from '@fontsource-variable/source-sans-3/files/source-sans-3-latin-wght-normal.woff2?inline';
import logo from '../../public/logo.svg?raw';

/** Facebook and LinkedIn's recommended size, X crops it to 2:1 from the center */
export const previewImageSize = { width: 1200, height: 630 } as const;

// Previews can't know the viewer's theme, so they always use the Team 581 theme in dark mode
const { tokens } = themePalette(team581Seeds);
export const colors = {
	frame: tokens['--color-background-body']![1],
	pane: tokens['--color-background-surface']![1],
	text: tokens['--color-text-primary']![1],
	mutedText: tokens['--color-text-secondary']![1],
};

// Quoted, since CSS can't parse an unquoted family name ending in a number
export const headingFont = '"Source Sans 3"';

function dataUrlBytes(url: string): Uint8Array {
	return base64ToUint8Array(url.slice(url.indexOf(',') + 1));
}

/** For drawing and measuring with Studio's UI font, and its heading font. Inlined since a server can't count on fetching them. */
export const renderOptions = {
	fonts: [
		{ name: 'IBM Plex Sans', data: dataUrlBytes(plexSansUrl) },
		{ name: 'Source Sans 3', data: dataUrlBytes(sourceSansUrl) },
	],
	emoji: 'from-font',
} satisfies RenderOptions;

export const logoUrl = `data:image/svg+xml;base64,${stringToBase64(logo)}`;
