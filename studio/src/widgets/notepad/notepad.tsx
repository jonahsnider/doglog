import { colorVars, spacingVars, typeScaleVars, typographyVars } from '@astryxdesign/core/theme/tokens.stylex';
import * as stylex from '@stylexjs/stylex';
import { createCssVariablesTheme, createHighlighterCoreSync, type ThemedToken } from 'shiki/core';
import { createJavaScriptRegexEngine } from 'shiki/engine/javascript';
import markdown from 'shiki/langs/markdown.mjs';
import { type CSSProperties, Fragment, use, useSyncExternalStore } from 'react';
import { getDoc } from '@/dashboards/dashboards';
import { getDashboardNotes, setDashboardNotes } from '@/dashboards/doc';
import { DashboardIdContext } from '@/dashboards/panes';

// Colors that aren't set here inherit the text color
const theme = createCssVariablesTheme({
	variableDefaults: {
		'token-link': 'var(--color-text-accent)',
		'token-string': 'var(--color-text-success)',
		'token-keyword': 'var(--color-text-secondary)',
		'token-comment': 'var(--color-text-secondary)',
	},
});
theme.tokenColors!.push({ scope: 'markup.strikethrough', settings: { fontStyle: 'strikethrough' } });

// The JavaScript engine is smaller than Oniguruma's WebAssembly, and only Markdown is loaded
const highlighter = createHighlighterCoreSync({
	themes: [theme],
	langs: [markdown],
	engine: createJavaScriptRegexEngine(),
});

const styles = stylex.create({
	notepad: {
		display: 'grid',
		minHeight: '100%',
		gridTemplateColumns: 'minmax(0, 1fr)',
		padding: spacingVars['--spacing-2'],
		fontFamily: typographyVars['--font-family-code'],
		fontSize: typeScaleVars['--text-supporting-size'],
		lineHeight: '1.25rem',
		overflowWrap: 'break-word',
		whiteSpace: 'pre-wrap',
	},
	layer: {
		gridArea: '1 / 1',
	},
	field: {
		minWidth: 0,
		resize: 'none',
		overflow: 'hidden',
		backgroundColor: 'transparent',
		color: 'transparent',
		caretColor: colorVars['--color-text-primary'],
		// Like a code editor, the caret shows focus. Text fields always match `:focus-visible`, so a ring would show on every click.
		outline: 'none',
		'::selection': {
			backgroundColor: `color-mix(in srgb, ${colorVars['--color-accent']} 16%, transparent)`,
		},
		'::placeholder': {
			color: colorVars['--color-text-secondary'],
		},
	},
});

/** Shiki's `FontStyle` flags, it's a const enum so it can't be imported */
const italic = 1;
const bold = 2;
const underline = 4;
const strikethrough = 8;

function tokenStyle(token: ThemedToken): CSSProperties {
	const fontStyle: number = token.fontStyle ?? 0;
	const decorations = [fontStyle & underline && 'underline', fontStyle & strikethrough && 'line-through'].filter(
		Boolean,
	);
	return {
		color: token.color,
		fontStyle: fontStyle & italic ? 'italic' : undefined,
		fontWeight: fontStyle & bold ? 600 : undefined,
		textDecorationLine: decorations.length > 0 ? decorations.join(' ') : undefined,
	};
}

/** Markdown notes, highlighted like a code editor instead of rendered */
export function Notepad() {
	const dashboardId = use(DashboardIdContext);
	const { doc } = getDoc(dashboardId);
	const text = getDashboardNotes(doc);
	const notes = useSyncExternalStore(
		(onChange) => text.subscribe(onChange),
		() => text.toString(),
	);
	const lines = highlighter.codeToTokensBase(notes, { lang: 'markdown', theme: theme.name! });

	return (
		// The highlighted text sizes the cell, and the transparent text field on top of it takes the input.
		// Monospace, so bold and italic text stays the same width as the text field's.
		<div {...stylex.props(styles.notepad)}>
			<div aria-hidden {...stylex.props(styles.layer)}>
				{lines.map((line, lineIndex) => (
					// oxlint-disable-next-line react/no-array-index-key -- Lines have no identity besides their position
					<Fragment key={lineIndex}>
						{lineIndex > 0 && '\n'}
						{line.map((token) => (
							<span key={token.offset} style={tokenStyle(token)}>
								{token.content}
							</span>
						))}
					</Fragment>
				))}
				{/* A trailing newline needs a line after it to take up space */}
				{'\n'}
			</div>
			<textarea
				aria-label="Notes"
				placeholder="Write something..."
				spellCheck={false}
				{...stylex.props(styles.layer, styles.field)}
				value={notes}
				onChange={(event) => setDashboardNotes(doc, event.target.value)}
			/>
		</div>
	);
}
