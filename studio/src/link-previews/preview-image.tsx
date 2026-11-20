// Open Graph images for Studio links: a dashboard's name over a wireframe of its panes, like Studio's own dashboards.
// Free of the browser, so the cloud server can draw dashboard links' images and the build can draw the generic one.
import { hexFromArgb } from '@material/material-color-utilities';
import { measure, render } from 'takumi-js';
import type { Pane, PaneNode } from '@/panes/layout';
import { childSizes } from '@/panes/split-sizes';
import { suggestWidgetName } from '@/dashboards/label';
import { defaultThemeColor, schemeColors } from '@/theme/theme-color';
import { widgetIcons } from '@/widgets/icons';
import { optionValues } from '@/widgets/options';
import { getWidgetInfo } from '@/widgets/widget-info';
import { widgetTitle } from '@/widgets/widget-type';
import plexSansUrl from '@fontsource-variable/ibm-plex-sans/files/ibm-plex-sans-latin-wght-normal.woff2?inline';
import sourceSansUrl from '@fontsource-variable/source-sans-3/files/source-sans-3-latin-wght-normal.woff2?inline';
import logo from '../../public/logo.svg?raw';

/** Facebook and LinkedIn's recommended size, X crops it to 2:1 from the center */
export const previewImageSize = { width: 1200, height: 630 } as const;

// Previews can't know the viewer's theme, so they always use the default theme color in dark mode
const color = schemeColors(defaultThemeColor, true, 'standard', 'team581');
const colors = {
	frame: hexFromArgb(color('surfaceContainerLowest')),
	pane: hexFromArgb(color('surface')),
	text: hexFromArgb(color('onSurface')),
	mutedText: hexFromArgb(color('onSurfaceVariant')),
};

// Quoted, since CSS can't parse an unquoted family name ending in a number
const headingFont = '"Source Sans 3"';

// Sizes the layout and `fittingHeaders()` both use, in pixels
const imagePadding = 48;
const splitGap = 10;
const panePaddingX = 22;
const headerIconSize = 30;
const headerGap = 12;
const headerText = { fontFamily: headingFont, fontSize: 28, fontWeight: 600 } as const;

function dataUrlBytes(url: string): Uint8Array {
	return Uint8Array.fromBase64(url.slice(url.indexOf(',') + 1));
}

// Studio's UI font, and its heading font for the app's name. Inlined since a server can't count on fetching them.
const fonts = [
	{ name: 'IBM Plex Sans', data: dataUrlBytes(plexSansUrl) },
	{ name: 'Source Sans 3', data: dataUrlBytes(sourceSansUrl) },
];

const logoUrl = `data:image/svg+xml;base64,${new TextEncoder().encode(logo).toBase64()}`;

/** A pane's header like Studio shows it: its widget's icon and title. `undefined` for empty panes. */
function paneHeader({ widget }: Pane) {
	const info = widget && getWidgetInfo(widget.type);
	return (
		widget && {
			Icon: info && widgetIcons[info.id],
			title: info ? widgetTitle(info, optionValues(info, widget, [])) : widget.type,
		}
	);
}

/** Each pane with its width in the image, given its node's width */
function paneWidths(node: PaneNode, width: number): [Pane, number][] {
	if (node.kind === 'pane') {
		return [[node, width]];
	}
	const sizes = childSizes(node);
	const shared = width - splitGap * (node.children.length - 1);
	return node.children.flatMap((child, index) =>
		paneWidths(child, node.direction === 'row' ? shared * (sizes[index] ?? 0) : width),
	);
}

/** IDs of the panes whose header fits without cutting off its title, the others leave it out */
async function fittingHeaders(layout: PaneNode): Promise<Set<string>> {
	const fitting = await Promise.all(
		paneWidths(layout, previewImageSize.width - 2 * imagePadding).map(async ([pane, width]) => {
			const header = paneHeader(pane);
			if (header === undefined) {
				return [];
			}
			const text = await measure(<span style={headerText}>{header.title}</span>, { fonts, emoji: 'from-font' });
			const iconWidth = header.Icon ? headerIconSize + headerGap : 0;
			return iconWidth + text.width <= width - 2 * panePaddingX ? [pane.id] : [];
		}),
	);
	return new Set(fitting.flat());
}

function PreviewNode({ node, headers }: { node: PaneNode; headers: ReadonlySet<string> }) {
	if (node.kind === 'pane') {
		const header = paneHeader(node);
		// What the widget shows, or its icon for widgets the header already describes, ex. a notepad
		const content = node.widget && suggestWidgetName(node.widget);
		const Icon = header?.Icon;
		return (
			<div
				style={{
					display: 'flex',
					flexDirection: 'column',
					flexGrow: 1,
					minWidth: 0,
					minHeight: 0,
					overflow: 'hidden',
					padding: `18px ${panePaddingX}px`,
					borderRadius: 16,
					backgroundColor: colors.pane,
					color: colors.mutedText,
				}}
			>
				{header && headers.has(node.id) && (
					<div style={{ display: 'flex', alignItems: 'center', gap: headerGap, whiteSpace: 'nowrap', ...headerText }}>
						{Icon && <Icon width={headerIconSize} height={headerIconSize} style={{ flexShrink: 0 }} />}
						{header.title}
					</div>
				)}
				<div style={{ display: 'flex', flexGrow: 1, minHeight: 0, alignItems: 'center', justifyContent: 'center' }}>
					{content === undefined ? (
						// Up to 96 px, smaller in short panes so it isn't cut off
						Icon && <Icon style={{ width: 'auto', height: '100%', maxHeight: 96, aspectRatio: 1, opacity: 0.5 }} />
					) : (
						<span
							style={{
								maxWidth: '100%',
								color: colors.text,
								fontSize: 44,
								fontWeight: 600,
								lineHeight: 1.2,
								textAlign: 'center',
								// Only splits words longer than the pane is wide
								overflowWrap: 'break-word',
							}}
						>
							{content}
						</span>
					)}
				</div>
			</div>
		);
	}

	const sizes = childSizes(node);
	return (
		<div
			style={{
				display: 'flex',
				flexGrow: 1,
				flexDirection: node.direction,
				minWidth: 0,
				minHeight: 0,
				gap: splitGap,
			}}
		>
			{node.children.map((child, index) => (
				// Basis 0 so each child's share of the space matches its size
				<div key={child.id} style={{ display: 'flex', flex: `${sizes[index]} 1 0`, minWidth: 0, minHeight: 0 }}>
					<PreviewNode node={child} headers={headers} />
				</div>
			))}
		</div>
	);
}

/** A PNG with Studio's logo, a title, and a wireframe of `layout` */
export async function renderPreviewImage({
	title,
	layout,
}: {
	title: string;
	layout: PaneNode;
}): Promise<Uint8Array<ArrayBuffer>> {
	const headers = await fittingHeaders(layout);
	return render(
		<div
			style={{
				display: 'flex',
				flexDirection: 'column',
				width: '100%',
				height: '100%',
				gap: 28,
				padding: imagePadding,
				backgroundColor: colors.frame,
				color: colors.text,
				fontFamily: 'IBM Plex Sans',
			}}
		>
			<div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
				<div
					style={{
						display: 'flex',
						alignItems: 'center',
						gap: 14,
						color: colors.mutedText,
						// Like the app's name in Studio's title bar
						fontFamily: headingFont,
						fontSize: 28,
						fontWeight: 600,
					}}
				>
					<img src={logoUrl} width={40} height={40} alt="" />
					DogLog Studio
				</div>
				<div
					style={{
						fontFamily: headingFont,
						fontSize: 64,
						fontWeight: 600,
						lineHeight: 1.1,
						overflowWrap: 'break-word',
					}}
				>
					{title}
				</div>
			</div>
			<PreviewNode node={layout} headers={headers} />
		</div>,
		{ ...previewImageSize, format: 'png', fonts, emoji: 'from-font' },
	);
}

/** The image for every other Studio link, ex. the home page: Studio's logo and name, centered */
export function renderGenericPreviewImage(): Promise<Uint8Array<ArrayBuffer>> {
	return render(
		<div
			style={{
				display: 'flex',
				alignItems: 'center',
				justifyContent: 'center',
				gap: 36,
				width: '100%',
				height: '100%',
				// Studio's background, which panes use too
				backgroundColor: colors.pane,
				color: colors.text,
				fontFamily: headingFont,
				fontSize: 112,
				fontWeight: 600,
			}}
		>
			<img src={logoUrl} width={160} height={160} alt="" />
			DogLog Studio
		</div>,
		{ ...previewImageSize, format: 'png', fonts, emoji: 'from-font' },
	);
}
