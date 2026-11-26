# Studio design guide

Studio follows the [Astryx](https://astryx.design) design guidelines (`pnpm exec astryx docs principles`) and Team 581's design guide (the `team581-design` skill from `@team581/astryx-theme`).
This guide lists only the app-wide rules Studio adds to them.
Change rules that apply to every Team 581 app in `@team581/astryx-theme` instead.
Keep feature behavior and functionality in `openspec/specs`.

## Components

- Build context menus with `AppContextMenu`
- Let panels that slide in on touch devices close with a swipe toward their edge using `useSwipeToClose` from `@/hooks/use-swipe-to-close`, and don't add swipes that start at the screen's edge, since browsers and installed web apps use them to go back
- Group related account or settings actions in a `SettingsGroup` card of `ListItem` rows, with each action at the row's end and anything that can't be undone in its own group

### Keyboard shortcuts

- Show keys with `Shortcut` from `@/components/shortcut`, not Astryx's `Kbd`

## Layout and styling

- The app sits on a darker frame (`--color-background-body`) where panes/pages are cards on it, separated by gaps instead of divider lines
  - The sidebars and timeline sit directly on the frame
- Text isn't selectable by default, set `userSelect: 'text'` on content people copy, like console messages and table values
- Hide controls and hover marks from captures and video exports with the capture classes in `src/index.css`

## Color

- Colors Astryx has no token for are CSS variables: series colors, code colors, FRC game colors, and test mode
- Presets are seeds for Astryx's palette generator, see `src/theme/theme-color.ts`; change a seed or a palette stop rather than overriding single tokens
- Make ramps with `shade()` in `src/theme/series-palette.ts`
- An entry keeps its series color in every source; sources are told apart by line style (`sourceDash()`), shown with `LineSample` in the source list and legends, and labeled only while several are visible

## Motion

- Don't use the `prefers-reduced-motion` media query, since users can configure their own overrides to the system setting
  - In CSS and StyleX, multiply durations by `--motion-scale` (ex. `calc(var(--duration-fast) * var(--motion-scale))`)
  - With the motion library, use `duration`, `easing`, and `useMotionTransition()` from `@/lib/motion`
  - Outside React, check `reducesMotion()`
- Use `TextMorph` from `@/components/text-morph` for changing counts and short state labels
  - Avoid for values that change quickly or should immediately reflect current state (ex. tooltips on a graph, progress bar percentages)
