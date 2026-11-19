#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::sync::atomic::{AtomicBool, Ordering};
use serde::Serialize;
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Emitter, Manager, State, WebviewWindow, WindowEvent};
use tauri_plugin_dialog::DialogExt;
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutState};

struct AppState {
    is_quitting: AtomicBool,
}

#[derive(Serialize)]
struct ThemeFilePayload {
    path: String,
    name: String,
    content: String,
    error: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct DesktopCaptureSourceDto {
    id: String,
    name: String,
    thumbnail: String,
    app_icon: Option<String>,
}

#[tauri::command]
fn minimize_window(window: WebviewWindow) -> Result<(), String> {
    window.minimize().map_err(|e| e.to_string())
}

#[tauri::command]
fn maximize_window(window: WebviewWindow) -> Result<bool, String> {
    let currently_maximized = window.is_maximized().map_err(|e| e.to_string())?;
    if currently_maximized {
        window.unmaximize().map_err(|e| e.to_string())?;
    } else {
        window.maximize().map_err(|e| e.to_string())?;
    }
    let next_state = !currently_maximized;
    let _ = window.emit("window-maximize-changed", next_state);
    Ok(next_state)
}

#[tauri::command]
fn close_window(window: WebviewWindow) -> Result<(), String> {
    window.hide().map_err(|e| e.to_string())
}

#[tauri::command]
fn is_maximized(window: WebviewWindow) -> Result<bool, String> {
    window.is_maximized().map_err(|e| e.to_string())
}

#[tauri::command]
fn set_overlay_mode(
    window: WebviewWindow,
    enabled: bool,
    interactive: bool,
) -> Result<bool, String> {
    window
        .set_always_on_top(enabled)
        .map_err(|e| e.to_string())?;
    window
        .set_ignore_cursor_events(enabled && !interactive)
        .map_err(|e| e.to_string())?;
    Ok(true)
}

#[tauri::command]
fn set_tray_badge(app: AppHandle, count: u32) -> Result<(), String> {
    if let Some(tray) = app.tray_by_id("main-tray") {
        let tooltip = if count > 0 {
            format!("ProtutechChat ({count} unread)")
        } else {
            "ProtutechChat".to_string()
        };
        tray.set_tooltip(Some(&tooltip))
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
async fn open_theme_file_dialog(app: AppHandle) -> Result<Option<ThemeFilePayload>, String> {
    let picked = app
        .dialog()
        .file()
        .add_filter("CSS Stylesheets", &["css"])
        .blocking_pick_file();

    let Some(file_path) = picked else {
        return Ok(None);
    };

    let path_buf = file_path.into_path().map_err(|e| e.to_string())?;
    let name = path_buf
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| "theme.css".to_string());
    let path_str = path_buf.to_string_lossy().to_string();

    match std::fs::read_to_string(&path_buf) {
        Ok(content) => Ok(Some(ThemeFilePayload {
            path: path_str,
            name,
            content,
            error: None,
        })),
        Err(err) => Ok(Some(ThemeFilePayload {
            path: path_str,
            name,
            content: String::new(),
            error: Some(err.to_string()),
        })),
    }
}

#[tauri::command]
fn get_desktop_sources() -> Vec<DesktopCaptureSourceDto> {
    // WebView2 / browser native getDisplayMedia handles screen/window capture selection in Tauri
    Vec::new()
}

#[tauri::command]
fn select_capture_source(_source_id: String) -> bool {
    true
}

#[tauri::command]
fn relaunch_app(app: AppHandle) {
    app.restart();
}

fn show_main_window(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}

fn setup_tray(app: &AppHandle) -> tauri::Result<()> {
    let open_item = MenuItem::with_id(app, "open", "Open Protutech", true, None::<&str>)?;
    let sep1 = PredefinedMenuItem::separator(app)?;
    let voice_item = MenuItem::with_id(
        app,
        "join_voice",
        "Join Voice Lounge (<30ms)",
        true,
        None::<&str>,
    )?;
    let mute_item = MenuItem::with_id(
        app,
        "toggle_mute",
        "Toggle Mute (Ctrl+Shift+M)",
        true,
        None::<&str>,
    )?;
    let deafen_item = MenuItem::with_id(
        app,
        "toggle_deafen",
        "Toggle Deafen (Ctrl+Shift+D)",
        true,
        None::<&str>,
    )?;
    let overlay_item = MenuItem::with_id(
        app,
        "toggle_overlay",
        "Toggle In-Game Overlay (Alt+Shift+O)",
        true,
        None::<&str>,
    )?;
    let sep2 = PredefinedMenuItem::separator(app)?;
    let quit_item = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;

    let menu = Menu::with_items(
        app,
        &[
            &open_item,
            &sep1,
            &voice_item,
            &mute_item,
            &deafen_item,
            &overlay_item,
            &sep2,
            &quit_item,
        ],
    )?;

    let mut builder = TrayIconBuilder::with_id("main-tray")
        .menu(&menu)
        .tooltip("ProtutechChat")
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "open" => show_main_window(app),
            "join_voice" => {
                show_main_window(app);
                let _ = app.emit("native-join-voice", "livekit_lounge");
            }
            "toggle_mute" => {
                let _ = app.emit("native-toggle-mute", ());
            }
            "toggle_deafen" => {
                let _ = app.emit("native-toggle-deafen", ());
            }
            "toggle_overlay" => {
                let _ = app.emit("native-toggle-overlay", ());
            }
            "quit" => {
                let state: State<AppState> = app.state();
                state.is_quitting.store(true, Ordering::SeqCst);
                app.exit(0);
            }
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                show_main_window(tray.app_handle());
            }
        });

    if let Some(icon) = app.default_window_icon() {
        builder = builder.icon(icon.clone());
    }

    builder.build(app)?;
    Ok(())
}

fn setup_global_shortcuts(app: &AppHandle) {
    let shortcuts = [
        "CommandOrControl+Shift+M",
        "CommandOrControl+Shift+D",
        "Alt+Shift+O",
        "CommandOrControl+Shift+O",
    ];

    for spec in shortcuts {
        if let Ok(sc) = spec.parse::<Shortcut>() {
            let _ = app.global_shortcut().register(sc);
        }
    }
}

fn main() {
    let mute_sc: Option<Shortcut> = "CommandOrControl+Shift+M".parse().ok();
    let deafen_sc: Option<Shortcut> = "CommandOrControl+Shift+D".parse().ok();
    let overlay_alt_sc: Option<Shortcut> = "Alt+Shift+O".parse().ok();
    let overlay_ctrl_sc: Option<Shortcut> = "CommandOrControl+Shift+O".parse().ok();

    tauri::Builder::default()
        .manage(AppState {
            is_quitting: AtomicBool::new(false),
        })
        .plugin(tauri_plugin_dialog::init())
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(move |app, shortcut, event| {
                    if event.state() != ShortcutState::Pressed {
                        return;
                    }
                    if mute_sc.as_ref() == Some(shortcut) {
                        let _ = app.emit("native-toggle-mute", ());
                    } else if deafen_sc.as_ref() == Some(shortcut) {
                        let _ = app.emit("native-toggle-deafen", ());
                    } else if overlay_alt_sc.as_ref() == Some(shortcut)
                        || overlay_ctrl_sc.as_ref() == Some(shortcut)
                    {
                        let _ = app.emit("native-toggle-overlay", ());
                    }
                })
                .build(),
        )
        .setup(|app| {
            setup_tray(app.handle())?;
            setup_global_shortcuts(app.handle());
            Ok(())
        })
        .on_window_event(|window, event| {
            match event {
                WindowEvent::CloseRequested { api, .. } => {
                    let state: State<AppState> = window.state();
                    if !state.is_quitting.load(Ordering::SeqCst) {
                        api.prevent_close();
                        let _ = window.hide();
                    }
                }
                WindowEvent::Resized(_) => {
                    if let Ok(maximized) = window.is_maximized() {
                        let _ = window.emit("window-maximize-changed", maximized);
                    }
                }
                _ => {}
            }
        })
        .invoke_handler(tauri::generate_handler![
            minimize_window,
            maximize_window,
            close_window,
            is_maximized,
            set_overlay_mode,
            set_tray_badge,
            open_theme_file_dialog,
            get_desktop_sources,
            select_capture_source,
            relaunch_app,
        ])
        .run(tauri::generate_context!())
        .expect("error while running ProtutechChat Tauri application");
}
