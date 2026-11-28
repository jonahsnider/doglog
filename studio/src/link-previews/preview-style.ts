import { base64ToUint8Array, stringToBase64 } from 'uint8array-extras';
import type { RenderOptions } from 'takumi-js';
import { team581Palette } from '@team581/astryx-theme/colors';
import sourceSansUrl from '@fontsource-variable/source-sans-3/files/source-sans-3-latin-wght-normal.woff2?inline';
import logo from '../../public/logo.svg?raw';

/** Facebook and LinkedIn's recommended size, X crops it to 2:1 from the center */
export const previewImageSize = { width: 1200, height: 630 } as const;

// Previews can't know the viewer's theme, so they always use the DogLog preset in dark mode
const { tokens } = team581Palette;
export const colors = {
	pane: tokens['--color-background-surface']![1],
	text: tokens['--color-text-primary']![1],
};

// Quoted, since CSS can't parse an unquoted family name ending in a number
export const headingFont = '"Source Sans 3"';

/** Inline the font so drawing a preview doesn't require a network request. */
export const renderOptions = {
	fonts: [{ name: 'Source Sans 3', data: base64ToUint8Array(sourceSansUrl.slice(sourceSansUrl.indexOf(',') + 1)) }],
	emoji: 'from-font',
} satisfies RenderOptions;

export const logoUrl = `data:image/svg+xml;base64,${stringToBase64(logo)}`;
