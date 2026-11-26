//! The window's backdrop on macOS: Liquid Glass over the HUD window material, tinted with the theme's colors. The HUD
//! material blurs other windows enough that they can't be made out, the glass alone barely blurs them.

use std::{cell::RefCell, collections::HashMap};

use objc2::{MainThreadMarker, rc::Retained, runtime::AnyClass, runtime::AnyObject};
use objc2_app_kit::{
    NSAutoresizingMaskOptions, NSColor, NSGlassEffectView, NSGlassEffectViewStyle, NSView, NSVisualEffectBlendingMode,
    NSVisualEffectMaterial, NSVisualEffectState, NSVisualEffectView, NSWindow, NSWindowOrderingMode,
};
use objc2_core_image::CIFilter;
use objc2_foundation::NSString;
use tauri::{WebviewWindow, Window};

type Rgb = (f64, f64, f64);

#[derive(Clone, Copy)]
struct Colors {
    body: Rgb,
    surface: Rgb,
    dark: bool,
}

struct Backdrop {
    hud: Retained<NSVisualEffectView>,
    /// Only on macOS 26 and later
    glass: Option<Retained<NSGlassEffectView>>,
    /// Shifts the blur toward the theme's color in dark mode, keeping its brightness, or tints it in light mode
    tint: Retained<NSView>,
    /// Adds contrast in dark mode
    fill: Retained<NSView>,
    colors: Option<Colors>,
    active: bool,
}

thread_local! {
    // AppKit views can only be used on the main thread
    static BACKDROPS: RefCell<HashMap<String, Backdrop>> = RefCell::default();
}

/// Add the backdrop's views under the webview. It's untinted until the frontend sends the theme's colors.
pub fn install(window: &WebviewWindow) {
    let label = window.label().to_owned();
    let result = window.with_webview(move |webview| {
        let Some(mtm) = MainThreadMarker::new() else {
            return;
        };
        // Tauri provides its live NSWindow on the AppKit thread in with_webview
        let ns_window = unsafe { &*webview.ns_window().cast::<NSWindow>() };
        let Some(content) = ns_window.contentView() else {
            return;
        };
        let bounds = content.bounds();
        let resize = NSAutoresizingMaskOptions::ViewWidthSizable | NSAutoresizingMaskOptions::ViewHeightSizable;

        let hud = NSVisualEffectView::initWithFrame(mtm.alloc(), bounds);
        hud.setMaterial(NSVisualEffectMaterial::HUDWindow);
        hud.setBlendingMode(NSVisualEffectBlendingMode::BehindWindow);
        // Hidden instead while the window is inactive, see `apply`
        hud.setState(NSVisualEffectState::Active);
        hud.setAutoresizingMask(resize);

        let glass = AnyClass::get(c"NSGlassEffectView").map(|_| {
            let glass = NSGlassEffectView::initWithFrame(mtm.alloc(), bounds);
            glass.setStyle(NSGlassEffectViewStyle::Regular);
            glass.setAutoresizingMask(resize);
            glass
        });

        let layer_view = || {
            let view = NSView::initWithFrame(mtm.alloc(), bounds);
            view.setWantsLayer(true);
            view.setLayerUsesCoreImageFilters(true);
            view.setAutoresizingMask(resize);
            view
        };
        let tint = layer_view();
        let fill = layer_view();

        // Each is added at the bottom, under the webview, so from top to bottom: fill, tint, glass, HUD material
        content.addSubview_positioned_relativeTo(&fill, NSWindowOrderingMode::Below, None);
        content.addSubview_positioned_relativeTo(&tint, NSWindowOrderingMode::Below, None);
        if let Some(glass) = &glass {
            content.addSubview_positioned_relativeTo(glass, NSWindowOrderingMode::Below, None);
        }
        content.addSubview_positioned_relativeTo(&hud, NSWindowOrderingMode::Below, None);

        let backdrop = Backdrop {
            hud,
            glass,
            tint,
            fill,
            colors: None,
            active: ns_window.isKeyWindow(),
        };
        apply(&backdrop);
        BACKDROPS.with_borrow_mut(|backdrops| backdrops.insert(label, backdrop));
    });
    if let Err(error) = result {
        log::warn!("Couldn't add the window's backdrop: {error}");
    }
}

/// Tint the window's backdrop with the theme's body and surface colors, as `#rrggbb`, in its light or dark mode
#[tauri::command]
pub fn set_window_backdrop(window: WebviewWindow, body: String, surface: String, dark: bool) -> Result<(), String> {
    let (Some(body), Some(surface)) = (parse_hex(&body), parse_hex(&surface)) else {
        return Err(format!("Invalid backdrop colors: {body}, {surface}"));
    };
    let label = window.label().to_owned();
    window
        .run_on_main_thread(move || {
            BACKDROPS.with_borrow_mut(|backdrops| {
                if let Some(backdrop) = backdrops.get_mut(&label) {
                    backdrop.colors = Some(Colors { body, surface, dark });
                    apply(backdrop);
                }
            });
        })
        .map_err(|error| error.to_string())
}

/// Called on the main thread when the window gains or loses focus
pub fn set_active(window: &Window, active: bool) {
    BACKDROPS.with_borrow_mut(|backdrops| {
        if let Some(backdrop) = backdrops.get_mut(window.label()) {
            backdrop.active = active;
            apply(backdrop);
        }
    });
}

pub fn remove(label: &str) {
    BACKDROPS.with_borrow_mut(|backdrops| backdrops.remove(label));
}

/// The layers and amounts are the same as a native glass app's theme tinted style
fn apply(backdrop: &Backdrop) {
    let active = backdrop.active;
    // An inactive window keeps only the glass, which shows more of what's behind it. Without glass the HUD material
    // stays, or the window would be see-through.
    backdrop.hud.setHidden(!active && backdrop.glass.is_some());

    let Some(Colors { body, surface, dark }) = backdrop.colors else {
        return;
    };
    if let Some(glass) = &backdrop.glass {
        glass.setTintColor(Some(&color(body, 0.5)));
    }
    let black = (0.0, 0.0, 0.0);
    let (tint, tint_filter, fill, fill_filter) = match (dark, active) {
        (true, true) => (
            Some(color(surface, 0.5)),
            Some("CIColorBlendMode"),
            Some(color(black, 0.3)),
            Some("CIOverlayBlendMode"),
        ),
        (true, false) => (None, None, Some(color(black, 0.2)), None),
        (false, true) => (Some(color(body, 0.55)), None, None, None),
        (false, false) => (Some(color(body, 0.6)), None, None, None),
    };
    set_layer(&backdrop.tint, tint, tint_filter);
    set_layer(&backdrop.fill, fill, fill_filter);
}

fn set_layer(view: &NSView, color: Option<Retained<NSColor>>, filter: Option<&str>) {
    let Some(layer) = view.layer() else {
        return;
    };
    layer.setBackgroundColor(color.map(|color| color.CGColor()).as_deref());
    let filter = filter.and_then(|name| unsafe { CIFilter::filterWithName(&NSString::from_str(name)) });
    // A Core Image filter is what a layer's compositing filter takes on macOS
    unsafe { layer.setCompositingFilter(filter.as_deref().map(|filter| -> &AnyObject { filter })) };
}

fn color((red, green, blue): Rgb, alpha: f64) -> Retained<NSColor> {
    NSColor::colorWithSRGBRed_green_blue_alpha(red, green, blue, alpha)
}

fn parse_hex(hex: &str) -> Option<Rgb> {
    let hex = hex.strip_prefix('#')?;
    let channel = |start: usize| {
        let value = u8::from_str_radix(hex.get(start..start + 2)?, 16).ok()?;
        Some(f64::from(value) / 255.0)
    };
    Some((channel(0)?, channel(2)?, channel(4)?))
}
