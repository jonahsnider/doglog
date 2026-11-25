# Studio design guide

How Studio's UI is built. The OpenSpec specs in `openspec/specs` describe what users see, and `openspec/config.yaml` records tech decisions. This guide covers the patterns in between: which components to reach for, how to style them, and how things should look and move.

## Components

- Use [Astryx](https://astryx.design) components before writing custom ones, and follow its patterns over recreating older layouts. Look them up with `pnpm exec astryx component <Name> --dense`, `pnpm exec astryx search "<query>"`, and `pnpm exec astryx template <name> --type page`.
- The Astryx theme is in `src/theme`: `team581-theme.ts` is the Team 581 theme shared across the team's apps, and `studio-theme.tsx` extends it with Studio's generated theme colors.
- The sidebar's rows are built from `src/sidebar/sidebar-ui.tsx`, styled like Astryx's `SideNavItem` with its shared nav item styles. Astryx's `SideNav` can't peek over the panes or animate in the steps Studio's sidebar does, see the app shell spec. On phones the sidebar is an Astryx `MobileNav`.
- Write a custom component when Astryx has nothing close, or when the component is specific to Studio (ex. panes, widgets, the timeline).
- Use Astryx `Selector` for dropdowns that only pick a value, such as playback speed or field orientation. The trigger can match its surroundings: a compact toolbar button or a labeled field.
- Controls for a row in dense widget and pane UI, like removing a legend row, show while it's hovered or focused, and always without hover, like the pane controls. Lists on utility pages always show them.
- In Cloud, keep unavailable delete buttons visible for the account and its current team. Put the reason on the disabled button and make it available on hover, focus, and tap rather than adding explanatory text to the panel.
- Use Astryx `DropdownMenu` for in-app command menus, including menus that mix choices and commands, such as the source menu. Content that isn't a menu item, like the source switcher, goes in its `header`.
- Keep the 16px file icon in the source control and switcher even when a match or date replaces the filename. The background live status badge doesn't change the icon's size. Show the original filename in the source control tooltip.
- Context menus go through `AppContextMenu`, which uses Astryx `ContextMenu`. Don't pop up native menus, they don't match the app's styling. Dashboard and entry `…` buttons offer the same commands as right-click. A pane's `…` button offers the commands for the whole pane; right-click a specific binding for commands that act on it. The app menu bar on macOS stays native.
- In the pane actions and context menus, put commands that act on the whole widget next to **Change widget**, such as **Reset view** in Graph. Keep commands that depend on the right-clicked binding or scene position with the contextual commands.
- In a binding's context menu, put mutually exclusive choices in a named submenu, with radio items that show the current selection. Name the setting in the widget's terms (ex. **Show as** for Field, **Placement** for Graph, **Mechanism plane** for Robot). Don't list the choices as top-level checkboxes. A dedicated picker, like the role dropdown on a legend row, can show its choices directly. Keep checkboxes for independent toggles, like the entries in the pane's **Entries** submenu.
- Widget options are declared on the widget type (`WidgetType.options`) and rendered by the widget options popover, so every widget's options look the same. Use a small segmented control when choices fit in one row, or a dropdown when they don't. Add a new option kind there when a widget needs one, instead of building settings UI in the widget. Text options (ex. the video widget's video and sync) draw their own control in the popover. Widgets don't add their own pane header buttons, their settings and actions go in the popover.
- Settings that belong to one field entry, such as a camera's feed and field of view, go on its legend row, not in the widget options.
- The keyboard shortcuts dialog lists app-wide shortcuts only. A widget's own shortcuts are shown in the widget, as a `Kbd` on the control or readout they act on (ex. the field's measuring tools), never added to the dialog. Hide persistent shortcut badges in the phone layout, but keep the shortcuts active. Leave out only keys that act the same everywhere, like Escape to cancel.
- Show transient scene hints only on unbound widgets with a scene to navigate. Use short action and gesture labels with `Kbd` for keys, no focus caption, and one set of gestures based on the primary pointer.
- Use `lucide-react` for UI icons and `@ridemountainpig/svgl-react` for product logos. Custom UI icons should match Lucide's 24×24 viewBox, 2-unit `currentColor` outline, and rounded caps and joins.

## Styling

- Style with Astryx component props first, then StyleX: `stylex.create()` styles passed to a component's `xstyle` or spread with `stylex.props()`, using token vars from `@astryxdesign/core/theme/tokens.stylex` instead of raw values. Put `styles` at module scope, name them by role (`header`, `dragged`), and combine them conditionally in `stylex.props(styles.a, active && styles.b)` instead of building class strings.
- Style a child by its ancestor's hover or focus with a marker: `stylex.defaultMarker()`, or one from `stylex.defineMarker()` in a `.stylex.ts` file imported by a relative path, since the compiler doesn't resolve the `@/` alias. Write `stylex.when.ancestor(...)` inline in `stylex.create()`.
- When StyleX can't express a selector, like `:has()`, `@starting-style`, or elements inside another component's DOM, use a small CSS file next to the component, hooked on `data-*` attributes and using Astryx's CSS variables (ex. `src/sidebar/sidebar-ui.css`).
- Global CSS lives in `src/index.css`, only for the theme colors, base styles, shared keyframes, and the capture and video export classes below.
- The app's base is a darker frame (`--color-background-body`). Panes and pages other than dashboards are cards on it, `--color-background-surface` with `--radius-element` corners, set apart by gaps instead of divider lines. The sidebars (the app sidebar and the entry browser) and the timeline sit directly on the frame, without a surface or corners of their own. The collapsed sidebar peeks as an opaque drawer with a shadow, sliding over the rail and the panes from the window's edge while the rail stays put. It doesn't grow out of the rail, since the rail can show the window's backdrop and the panes can't. Resizable gaps show a line in their middle when hovered or dragged, when a dragged gap snaps in line with them, and when they move with the hovered or dragged gap.
- On a dashboard with an active source, put the timeline in a window-wide row below the panes and both sidebars. Line up the peek drawer's lower edge with the panes and let its shadow fall onto the timeline. Sidebar toggles and resizes shouldn't move the scrubber. Fit the timeline beneath the panes in captures and the video export preview so they don't include either sidebar.
- Keep a widget's file drop hint inside that widget. Use a dashed primary outline and an action label without blurring the rest of the dashboard. The window-wide drop hint is for opening logs.
- Use `UtilityPage` for titled pages like Settings, Cloud, and the Logs sync overview. It's an Astryx `Layout` with the title and optional actions in a header above a centered, scrolling column. Dashboards don't use it.
- Lay out settings like Astryx's settings form: a `UtilityPageSection` per group, with its title and a short description beside its controls on wide windows, separated by a `Divider`. Put controls directly in the section rather than in cards.
- The frame tints a native window backdrop where available: regular Liquid Glass on macOS 26 and later, sidebar vibrancy on macOS 15, and Desktop Acrylic on Windows 11 22H2 and later. It shows through wherever the frame does, including under the sidebars and the timeline; panes and pages stay opaque. Use the solid frame on other platforms or when the system requests reduced transparency or forced colors. Don't use CSS blur to imitate the desktop backdrop.
- A capture uses the solid frame color and the current pane sizes. Use the `capture-hidden` and `capture-invisible` classes to hide controls and hover marks that recipients don't need, `capture-invisible` where hiding them would move the widget content. On macOS, a native cover holds the last visible frame while those styles are active, so they only appear in the copied image. Video export mode shows the dashboard with capture styling the whole time, so its preview matches the video. Use the `saving-video-hidden`, `saving-video-invisible`, and `saving-video-only` classes for video export mode's own marks on the dashboard, like the range handles, which stay out of the video's frames. Other capture styles go in a component's CSS file under `[data-capturing]`.
- Set sidebar sections apart with spacing and muted labels instead of divider lines.
- Sidebar rows are inset 8px from the sidebar's edges and highlight as rounded pills, so they line up with controls like search boxes above them. Rows pinned while scrolling have no background, shadow, or fade of their own, since the frame behind them can be translucent; the rows scrolled under them are hidden instead.
- Keep footer actions visible below the What's new card so the card doesn't appear to float above empty space.
- Toolbar icon buttons, like the sidebar toggles and pane header buttons, are 24px ghost Astryx `IconButton`s. The app sidebar's rail shows its 32px navigation rows as icons. Both collapsed sidebars are 48px of frame beside the panes, with their buttons centered in it: the rail's rows 8px from each side, and the toggles 12px. Buttons stay where they are when a sidebar expands, so they don't move under the cursor that toggled them.
- In the phone layout, put the sidebar and entry browser toggles at opposite ends of a top bar instead of reserving rails. The sidebar is an Astryx `MobileNav` and the entry browser an Astryx `Drawer`, each with a close button; keep the docked layout preferences separate.
- Keep pane header controls visible in the phone layout. When the timeline itself is narrow, give the scrubber a row below the playback controls so the track has room to drag.
- Fonts: IBM Plex Sans for UI text (`--font-family-body`), Source Sans 3 for headings and titles like the title bar's app name, pane titles, and section labels (`--font-family-heading`), and IBM Plex Mono for code, entry values, and keyboard shortcuts (`--font-family-code`). Numbers are tabular everywhere so changing values don't shift.
- Give compact struct previews more room than generic values so coordinates and angles fit on one line, without overlapping the entry name. Separate values with spaces and mute their labels, not their numbers.
- Text isn't selectable by default, like a native app. Set `userSelect: 'text'` on content people would copy, like console messages and table values, not to labels or controls.
- Label the cursor-to-hover time difference on a bracket between the graph's two time markers. Keep the value tooltip separate so the measurement reads on the time axis without repeating either timestamp.

## Color

- Use Astryx's color tokens (`colorVars` from `@astryxdesign/core/theme/tokens.stylex`), like `--color-accent`, `--color-text-secondary`, `--color-border`, or the status colors. Studio's own colors that Astryx has no token for are CSS variables: the series colors (`--chart-1` to `--chart-5`), the code colors, game colors, and MD3 roles as `--md-*` (ex. `--md-surface-bright`). Don't use hex values or fixed palettes, since they ignore the theme color and the light and dark variants.
- Reserve destructive styling in menus for actions users can't undo. Use the default item style for all dashboard close commands, since closed dashboards can be reopened.
- Don't change a color's opacity to make a shade between two roles (ex. secondary text at 60%), use the MD3 role for it (ex. `outline`, which sits between `outline-variant` and `on-surface-variant`). Opacity is only for MD3's state values: state layers at 8% for hover (`--color-overlay-hover`), 10% for focus and pressed (`--color-overlay-pressed`), and 16% for dragged, disabled content at 38% and containers at 12%, and scrims at 32%. Mix them with `color-mix(in srgb, <color> 12%, transparent)`. Shadows use Astryx's `--shadow-low`, `--shadow-med`, and `--shadow-high`.
- Team 581 uses muted neutral palettes so surfaces stay close to neutral and the team color carries emphasis: HCT chroma 1 and 2 in light mode, where MD3 2025 boosts container chroma, and 2 and 3.5 in dark mode. Keep the Tonal Spot accent palettes so buttons and selected rows still carry the team color.
- match13 uses pale blue or black surfaces and blue accents. Dark primary actions and focus rings use the site's `sky-400` at Standard contrast, with lighter tones for Medium and High and darker labels for contrast.
- FrogLog uses a leaf-green seed and a separate stream-blue secondary palette, so primary actions are green and selected sidebar items are blue.
- Neutral replaces the accent and neutral palettes with untinted grays, so only status, series, and error colors have a hue. Gray has no hue for them to start from, so they're generated from a fixed blue (`#3b82f6`).
- Colors are generated from the theme color as a Material Design 3 scheme (`src/theme/theme-color.ts`). When a new color is needed, derive it there too:
  - By default, categorical colors (ex. series) rotate the hue in HCT and share one tone, so each contrasts equally with the background.
  - Visualization color palettes override only the five widget series colors. Use fixed light and dark colors checked under the corresponding color vision simulation; don't shift them toward the theme color.
  - Semantic colors (ex. success) harmonize a fixed hue toward the theme color. Don't harmonize hue-sensitive colors like warning.
  - Use mid tones (about 60 in light and 70 in dark) for fills, and 40 or 80 for text.
- Colors that come from robot data are drawn as logged, since teams pick them on purpose: Mechanism2d ligament and background colors. Like the field image, they don't follow the theme.
- Light 3D models with the shared scene's fixed, neutral environment rather than a light that follows the camera. Leave the environment out of the background so the pane still follows the theme.
- Use low-gloss shading for imported CAD. Keep material colors, opacity, and metalness, but override roughness so glossy exports don't wash out details.
- Draw field points as dots in their series color, with an attached solid heading arrow for poses. Match their size in field meters and give both a thin outline from the series color's Material 3 tonal palette. Use the nearest 10-tone step at least 10 tones darker, or lighter if the fill is below tone 20. In 3D, keep the markers unlit and let field geometry occlude them. Paths stay single colored strokes.
- Official game colors are fixed too, since teams know them from the field (ex. `--fuel` for REBUILT's fuel). Define them in `src/index.css`, and outline light ones with a darker tone of their hue where they'd barely show on light backgrounds.
- Per-user colors (ex. presence avatars) pick a series color by hashing the user's ID, with `--color-on-accent` on it. Inactive users are grayed out rather than given another color.
- The Team 581 theme (`src/theme/team581-theme.ts`) maps MD3's roles to Astryx's tokens. Content (panes and pages) is `surface` (`--color-background-surface`), and the frame the sidebars and timeline sit on is `surface-dim` (`--color-background-body`), also used for sidebar parts that need to be opaque. Dark themes' surface dim matches surface, so the frame uses `surface-container-lowest` there. Menus and popovers are `surface-container`, and selected items are `secondary-container` (`--color-accent-muted`) like the selected item in MD3's navigation drawer. Controls with nothing inside them to see them by (text fields, selects, checkboxes, radios) are bounded with `outline` (`--color-border-emphasized`) instead of `outline-variant` (`--color-border`).
- Drawings of physical things, like the controller widget, raise their buttons with `surface-bright` (`--md-surface-bright`) and sink their wells with the frame color (`--color-background-body`), since those stay lighter and darker than the muted body in both light and dark.
- Check new colors with several theme colors in both light and dark. Muddy yellows and hues drifting toward the error color are the usual problems.

## Motion

Studio uses [Material Design 3 motion](https://m3.material.io/styles/motion/easing-and-duration/tokens-specs). `src/index.css` defines the Material curves as CSS variables.

| Easing              | Variable             | Use for                                                     |
| ------------------- | -------------------- | ----------------------------------------------------------- |
| Standard            | `var(--ease-in-out)` | Things that move or change within the screen                |
| Standard decelerate | `var(--ease-out)`    | Things entering the screen                                  |
| Standard accelerate | `var(--ease-in)`     | Things leaving the screen                                   |
| Linear              | `linear`             | Progress and continuous motion, like a progress bar filling |

Durations come from Material's scale. Pick by how far something moves or how much of the screen it covers, and make exits a step shorter than entrances.

| Duration | Use for                                         |
| -------- | ----------------------------------------------- |
| 100ms    | Hover and focus feedback, showing controls      |
| 150ms    | Color changes and small fades                   |
| 200ms    | Menus, the sidebar, things leaving              |
| 250ms    | Pane layout changes, like splitting and zooming |
| 300ms    | Larger entrances, like the timeline sliding up  |

- Looping and feedback animations (ex. skeletons, blinking carets, toast nudges) can use their own timing, since they don't move things around the screen.
- With the motion library, use `easing` and `useMotionTransition()` from `@/lib/motion`, which mirror the CSS curves and skip animating when the system or the Reduce motion setting reduces motion. Outside React, check `reducesMotion()` instead of the media query.
- Use `TextMorph` from `@/components/text-morph` for changing counts, progress numbers, and short state labels. Keep clocks and sampled telemetry instant. Turn off numeric rolling for identifiers like addresses and version strings.
- In CSS and StyleX, multiply durations by `--motion-scale` (ex. `calc(200ms * var(--motion-scale))`) so changes happen instantly when reducing motion. It's 0 when the system or the Reduce motion setting reduces motion, so use it instead of the `prefers-reduced-motion` media query, which ignores the setting.
- Spinners keep turning, just slower, when reducing motion, since they show that something is still loading. Use Astryx `Spinner` for loading indicators.
- On the match13 preset, Monte rides the leading edge of the log-loading and video-saving progress fills. Clip the skier at the track's ends so labels and controls stay readable. Keep graph traces and timeline scrubbers undecorated.
- Show 3D widget canvases as soon as they draw, without an entrance fade.
- Prefer animating `transform` and `opacity`, which the browser can run without laying out the page again. When a layout property has to animate (ex. pane sizes), keep the content inside at a fixed size with `contain: strict` and clip it, so it isn't laid out again every frame. React Doctor flags layout animations, so explain why one is needed when disabling the rule.

## Checking changes

Run `pnpm check:dev`, which adds a React Doctor scan of changed files to `pnpm check`. A lint rule in `vite.config.ts` enforces reduced motion through `@/lib/motion`; review the colors, opacities, durations, and easing in StyleX and CSS against this guide by hand. Check UI changes in the dev server at https://doglog.studio.localhost, in both light and dark.
