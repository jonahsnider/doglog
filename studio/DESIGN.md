# Studio design guide

How Studio's UI is built. The OpenSpec specs in `openspec/specs` describe what users see, and `openspec/config.yaml` records tech decisions. This guide covers the patterns in between: which components to reach for, how to style them, and how things should look and move.

## Components

- Use [coss ui](https://coss.com/ui) components (Base UI and Tailwind CSS) before writing custom ones. Add them with the shadcn CLI from the `@coss` registry in `components.json`, ex. `pnpm dlx shadcn@latest add @coss/popover`.
- `src/components/ui` holds those components. Treat them as vendored: compose and wrap them in app code instead of changing them. Change them only to fix something everywhere they're used (ex. pointer cursors on buttons), and keep the change small so it's easy to reapply when updating from upstream.
- Write a custom component when coss ui has nothing close, or when the component is specific to Studio (ex. panes, widgets, the timeline). Build it from Base UI primitives when it needs accessible behavior like menus, focus management, or keyboard navigation.
- Context menus go through `AppContextMenu`, which uses native menus on desktop and coss menus on the web.
- Widget options are declared on the widget type (`WidgetType.options`) and rendered by the widget options popover, so every widget's options look the same. Choices use a small segmented control. Add a new option kind there when a widget needs one, instead of building settings UI in the widget.
- Icons come from `lucide-react`. Brand logos, which Lucide doesn't have, are single color SVG files with `fill="currentColor"`, imported as components with `?react` (ex. `src/entries/logos`).

## Styling

- Style with Tailwind utility classes, joined with `cn()` from `@/lib/utils` when they're conditional.
- Global CSS lives in `src/index.css`, only for the theme, base styles, keyframes, and rules that utilities can't express (ex. styling elements by a data attribute a library renders).
- The app's regions sit in rounded containers on a darker frame (`bg-frame`), set apart by gaps instead of divider lines. Panes and pages other than dashboards are `rounded-lg bg-background` cards. The timeline is `rounded-t-lg bg-background`, flush with the bottom edge of the window. Sidebars (the app sidebar and the entry browser) are `bg-sidebar`, flush with the window's edges and rounded only on the corners facing the rest of the app. Resizable gaps show a line in their middle when hovered or dragged.
- The frame tints a native window backdrop where available: regular Liquid Glass on macOS 26 and later, sidebar vibrancy on macOS 15, and Desktop Acrylic on Windows 11 22H2 and later. Only the gaps and outer edges reveal it; panes, sidebars, and the timeline stay opaque. Use the solid frame on other platforms or when the system requests reduced transparency or forced colors. Don't use CSS blur to imitate the desktop backdrop.
- Set sidebar sections apart with spacing and muted labels instead of divider lines.
- Fonts: IBM Plex Sans for UI text (`font-sans`), Source Sans 3 for headings (`font-heading`), and IBM Plex Mono for code, entry values, and keyboard shortcuts (`font-mono`). Numbers are tabular everywhere so changing values don't shift.
- Text isn't selectable by default, like a native app. Add `select-text` to content people would copy, like console messages and table values, not to labels or controls.
- Label the cursor-to-hover time difference on a bracket between the graph's two time markers. Keep the value tooltip separate so the measurement reads on the time axis without repeating either timestamp.

## Color

- Use semantic color classes, like `bg-primary`, `text-muted-foreground`, `border-border`, or the status and series colors. Don't use Tailwind's palette (ex. `bg-red-500`) or hex values, since they ignore the theme color and the light and dark variants.
- Team 581 uses muted neutral palettes (HCT chroma 2 and 3.5) in both light and dark mode. Keep the Tonal Spot accent palettes so buttons and selected rows still carry the team color.
- match13 uses pale blue or black surfaces and blue accents. Dark primary actions and focus rings use the site's `sky-400` at Standard contrast, with lighter tones for Medium and High and darker labels for contrast.
- Colors are generated from the theme color as a Material Design 3 scheme (`src/theme/theme-color.ts`). When a new color is needed, derive it there too:
  - Categorical colors (ex. series) rotate the hue in HCT and share one tone, so each contrasts equally with the background.
  - Semantic colors (ex. success) harmonize a fixed hue toward the theme color. Don't harmonize hue-sensitive colors like warning.
  - Use mid tones (about 60 in light and 70 in dark) for fills, and 40 or 80 for text.
- Colors that come from robot data are drawn as logged, since teams pick them on purpose: Mechanism2d ligament and background colors. Like the field image, they don't follow the theme.
- Official game colors are fixed too, since teams know them from the field (ex. `bg-fuel` for REBUILT's fuel). Define them in `src/index.css`, and outline light ones with a darker tone of their hue where they'd barely show on light backgrounds.
- Per-user colors (ex. presence avatars) pick a chart color by hashing the user's ID, with `text-primary-foreground` on it. Inactive users are grayed out rather than given another color.
- Surfaces follow MD3's roles: content (panes, the timeline, pages) is `surface` (`bg-background`), sidebars are `surface-container-low` like MD3's navigation drawer (`bg-sidebar`), and the frame behind them is `surface-dim` (`bg-frame`). Dark themes' surface dim matches surface, so the frame uses `surface-container-lowest` there.
- Other MD3 roles coss ui doesn't have are applied in `src/index.css` by the slots the components render: dialogs are `surface-container-high` (menus and popovers stay `surface-container`), and controls with nothing inside them to see them by (text fields, selects, checkboxes, radios) are bounded with `outline` (`border-outline` in app code) instead of `outline-variant`, and the open item in the sidebar is `secondary-container` like the selected item in MD3's navigation drawer.
- Check new colors with several theme colors in both light and dark. Muddy yellows and hues drifting toward the error color are the usual problems.

## Motion

Studio uses [Material Design 3 motion](https://m3.material.io/styles/motion/easing-and-duration/tokens-specs). `src/index.css` redefines Tailwind's easing names as Material curves, so `ease-*` classes, plain `transition-*` classes, and coss ui components all match.

| Easing              | Class                                             | Use for                                                     |
| ------------------- | ------------------------------------------------- | ----------------------------------------------------------- |
| Standard            | `ease-in-out`, and the default for `transition-*` | Things that move or change within the screen                |
| Standard decelerate | `ease-out`                                        | Things entering the screen                                  |
| Standard accelerate | `ease-in`                                         | Things leaving the screen                                   |
| Linear              | `ease-linear`                                     | Progress and continuous motion, like a progress bar filling |

Durations come from Material's scale. Pick by how far something moves or how much of the screen it covers, and make exits a step shorter than entrances.

| Duration                               | Use for                                         |
| -------------------------------------- | ----------------------------------------------- |
| 100ms                                  | Hover and focus feedback, showing controls      |
| 150ms (the default for `transition-*`) | Color changes and small fades                   |
| 200ms                                  | Menus, the sidebar, things leaving              |
| 250ms                                  | Pane layout changes, like splitting and zooming |
| 300ms                                  | Larger entrances, like the timeline sliding up  |

- Looping and feedback animations (ex. skeletons, blinking carets, toast nudges) can use their own timing, since they don't move things around the screen.
- With the motion library, use `easing` and `useMotionTransition()` from `@/lib/motion`, which mirror the CSS curves and skip animating when the system reduces motion.
- In CSS, use `motion-safe:` and `motion-reduce:` so layout changes happen instantly when the system reduces motion.
- Prefer animating `transform` and `opacity`, which the browser can run without laying out the page again. When a layout property has to animate (ex. pane sizes), keep the content inside at a fixed size with `contain: strict` and clip it, so it isn't laid out again every frame. React Doctor flags layout animations, so explain why one is needed when disabling the rule.

## Checking changes

Run `pnpm check:dev`, which adds a React Doctor scan of changed files to `pnpm check`. Lint rules in `vite.config.ts` enforce parts of this guide: no Tailwind palette or hex colors, durations from the scale, no custom easing curves, and reduced motion through `@/lib/motion`. Check UI changes in the dev server at https://studio.doglog.dev.localhost, in both light and dark.
