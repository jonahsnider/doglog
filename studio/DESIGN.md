# Studio design guide

Studio follows the [Astryx](https://astryx.design) design guidelines (`pnpm exec astryx docs principles`).
This guide lists only the app-wide rules Studio adds to them.
If a specific feature/component deviates from typical Astryx patterns, consider documenting that in the relevant code rather than cluttering this file.
Keep feature behavior and functionality in `openspec/specs`.

## Components

- Build context menus with `AppContextMenu` instead of native menus
  - macOS menu bar is an exception since it's in addition to the in-app menus
  - Use a `…` button to expose the same commands as right-clicking
- Put mutually exclusive choices in a submenu of radio items (ex. **Show as**) instead of cluttering top-level menus
- Reserve destructive styling for actions users can't undo
- In dense pane UI, show a row's controls while it's hovered or focused, and always on devices without hover.
- If a control is disabled, explain why with a tooltip rather than hiding the control or adding additional text around the control.
  - Exceptions can be made when a tooltip isn't able to effectively communicate

### Keyboard shortcuts

- Show keys with `Shortcut` from `@/components/shortcut`, not Astryx's `Kbd`
- The keyboard shortcuts dialog lists only app-wide shortcuts
  - Shortcuts for a specific feature/component should be shown visually on the relevant controls

### Icons

- Use `lucide-react` for UI icons and `@ridemountainpig/svgl-react` for product logos
- Custom icons can be used when Lucide doesn't have something suitable
  - Try to keep them consistent with the Lucide style

## Layout and styling

- The app sits on a darker frame (`--color-background-body`) where panes/pages are cards on it, separated by gaps instead of divider lines
  - The sidebars and timeline sit directly on the frame
- Import `.stylex.ts` files by a relative path, since the StyleX compiler doesn't resolve `@/`
- Text isn't selectable by default, set `userSelect: 'text'` on content people copy, like console messages and table values
- Hide controls and hover marks from captures and video exports with the capture classes in `src/index.css`

## Color

- Use Astryx semantic color tokens
- Colors Astryx has no token for are CSS variables: series colors, code colors, FRC game colors, and test mode
- Presets are seeds for Astryx's palette generator, see `src/theme/theme-color.ts`; change a seed or a palette stop rather than overriding single tokens
- Use a token in between two colors instead of introducing arbitrary opacity percentages to colors
  - Use opacity only for state values: 8% hover, 10% focus and pressed, 16% dragged, 38% disabled content, 12% disabled containers, and 32% scrims
- Make new colors from Astryx's tokens, data colors, or ramps (`shade()` in `src/theme/series-palette.ts`) instead of picking hex values, so they follow color modes and high contrast
- Colors explicitly defined (ex. in robot code or FRC game colors) should be used as-is, not themed
- Check new colors with several theme colors in light and dark
  - Muddy yellows and hues drifting toward the error color are the usual problems

## Motion

- Don't use the `prefers-reduced-motion` media query, since users can configure their own overrides to the system setting
  - In CSS and StyleX, multiply durations by `--motion-scale` (ex. `calc(var(--duration-fast) * var(--motion-scale))`)
  - With the motion library, use `duration`, `easing`, and `useMotionTransition()` from `@/lib/motion`
  - Outside React, check `reducesMotion()`
- Use `TextMorph` from `@/components/text-morph` for changing counts and short state labels
  - Avoid for values that change quickly or should immediately reflect current state (ex. tooltips on a graph, progress bar percentages)
