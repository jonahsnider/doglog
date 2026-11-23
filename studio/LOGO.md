# DogLog Studio logo

A geometric "S" plotted in realtime on a graph: the trace enters from the left edge, as though recording started before the window, and a vertical playhead with a hollow cursor ring marks the live right tip.

## Grid and geometry

Constructed on an `8u x 8u` grid (`1u = 16` on the `128 x 128` viewBox, `1u = 128` on the `1024 x 1024` Icon Composer assets):

- **Frame**: macOS-style squircle (`28` corner curve on `128 x 128`).
- **S stroke**: `3u x 4u` core (`x: 2u..5u`, `y: 2u..6u`), semicircular turns with `R = 1u` centered at `(3u, 3u)` and `(4u, 5u)`, stroke width `1u` (`16`).
- **Left tail**: the bottom bar runs from the left edge (`x = 0`) at `y = 6u`, solid with no fade, so every edge stays crisp (Liquid Glass can't follow a feathered edge).
- **Cursor ring**: centered at `(6u, 2u)` (`96, 32`), outer diameter `1.75u` (`28`), ring stroke `0.5u` (`8`), hollow center `0.75u` (`12`). Both the top bar and playhead terminate inside the ring wall so no mask is needed.
- **Playhead**: `x = 6u`, width `3/8u` (`6`), vertical opacity stops `1/4 -> 7/8 -> 5/8 -> 1/4` (`0%, 25%, 75%, 100%`).
- **Gridlines**: `3x3` interior lines, width `1/8u` (`2`). Rows sit at `2u` spacing (`y = 32, 64, 96`). Columns sit at `x = 30, 62`, with the playhead taking the third: `1/8u` left of `2u` and `4u` so the wider playhead doesn't squeeze the column beside it, leaving symmetric gaps of `29, 30, 30, 29`. Horizontal lines are segmented around the vertical gridlines, playhead, and hollow cursor hole, and gridlines and playhead stop `1px` inside the frame where the rim's visible band begins, so semi-transparent strokes never double-composite.

## Color

Derived from Studio's Team 581 MD3 2025 palette (`src/theme/theme-color.ts`):

- **Background**: `#591616` (Team 581 seed, HCT `H=22 C=43 T=19`). Large icons use a vertical HCT `+-6` tone gradient (`#6b2322 -> #591616 -> #48090b`) and a `2px` inner rim (`#fff7f6` at `1/4 -> 1/16`).
- **Foreground**: `#fff7f6` (MD3 2025 light `onPrimary`, HCT tone ~98).
- **Gridlines**: `#fff7f6` at `1/8` (`0.125`) opacity.

## Variants and usage

| Asset                | Use                                                               | Differences                                                                                                                                                                                                                                    |
| -------------------- | ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `public/logo.svg`    | Sizes `> 32px`: About dialog, OG link previews, PWA icons         | Full spec (gridlines, HCT `+-6` gradient, rim)                                                                                                                                                                                                 |
| `public/favicon.svg` | Sizes `<= 32px`: browser favicons, `32x32` / `30x30` desktop PNGs | No gridlines, flat `#591616`, solid `0.5u` (`8`) playhead at `3/4` opacity, `2u` (`32`) dot (`1u` hole)                                                                                                                                        |
| `assets/mac.icon`    | macOS 26+ app icon (Apple Icon Composer)                          | Layered `Grid.svg` and `Playhead.svg` under Liquid Glass `Trace.svg` and `Cursor.svg`, over `#6b2322 -> #48090b`. `Cursor` is its own group so it floats above the S. Gridlines and playhead stop at the glass edge so they don't show through |
| `src-tauri/icons/`   | macOS 15 `.icns`, Windows `.ico`/Appx, Linux PNGs                 | Generated from `public/logo.svg` (`pnpm tauri icon public/logo.svg --ios-color "#591616"`); `32x32.png` and `Square30x30Logo.png` rendered from `public/favicon.svg`                                                                           |
