import { createCssVariablesTheme, createHighlighterCoreSync, type ThemedToken } from 'shiki/core';
import { createJavaScriptRegexEngine } from 'shiki/engine/javascript';
import markdown from 'shiki/langs/markdown.mjs';
import { type CSSProperties, Fragment, useMemo, useSyncExternalStore } from 'react';
import { createPersistedDoc } from '@/lib/persisted-store';

/** Notes are shared by every notepad, and kept when they're closed */
const doc = createPersistedDoc('notepad');
const notesText = doc.getText('notes');

const subscribe = (onChange: () => void) => notesText.subscribe(onChange);
const getNotes = () => notesText.toString();

function setNotes(notes: string): void {
	notesText.update(notes);
	doc.commit();
}

// Colors that aren't set here inherit the text color
const theme = createCssVariablesTheme({
	variableDefaults: {
		'token-link': 'var(--color-primary)',
		'token-string': 'var(--color-success-foreground)',
		'token-keyword': 'var(--color-muted-foreground)',
		'token-comment': 'var(--color-muted-foreground)',
	},
});
theme.tokenColors!.push({ scope: 'markup.strikethrough', settings: { fontStyle: 'strikethrough' } });

// The JavaScript engine is smaller than Oniguruma's WebAssembly, and only Markdown is loaded
const highlighter = createHighlighterCoreSync({
	themes: [theme],
	langs: [markdown],
	engine: createJavaScriptRegexEngine(),
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
	const notes = useSyncExternalStore(subscribe, getNotes);
	const lines = useMemo(() => highlighter.codeToTokensBase(notes, { lang: 'markdown', theme: theme.name! }), [notes]);

	return (
		// The highlighted text sizes the cell, and the transparent text field on top of it takes the input.
		// Monospace, so bold and italic text stays the same width as the text field's.
		<div className="grid min-h-full grid-cols-1 p-2 font-mono text-xs leading-5 wrap-break-word whitespace-pre-wrap *:[grid-area:1/1]">
			<div aria-hidden>
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
				placeholder="Write notes in Markdown"
				spellCheck={false}
				className="min-w-0 resize-none overflow-hidden text-transparent caret-foreground outline-none selection:bg-primary/25 placeholder:text-muted-foreground"
				value={notes}
				onChange={(event) => setNotes(event.target.value)}
			/>
		</div>
	);
}
