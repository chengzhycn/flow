use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, TrayIconBuilder, TrayIconEvent},
    Manager, WindowEvent,
};

// 追踪 quick-add 窗口的显示状态
static QUICK_ADD_VISIBLE: AtomicBool = AtomicBool::new(false);
// 上次点击时间戳（毫秒），用于防抖
static LAST_CLICK_TIME: AtomicU64 = AtomicU64::new(0);
// 窗口显示时间戳，用于防止刚显示就被关闭
static WINDOW_SHOWN_TIME: AtomicU64 = AtomicU64::new(0);

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations(
                    "sqlite:flow.db",
                    vec![tauri_plugin_sql::Migration {
                        version: 1,
                        description:
                            "Initial schema with todos, pomodoro_sessions, and sync tables",
                        sql: include_str!("../migrations/001_init.sql"),
                        kind: tauri_plugin_sql::MigrationKind::Up,
                    }],
                )
                .build(),
        )
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            // System Tray Setup
            let quick_add_i =
                MenuItem::with_id(app, "quick_add", "Quick Add Task", true, None::<&str>)?;
            let quit_i = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let show_i = MenuItem::with_id(app, "show", "Open Flow", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&quick_add_i, &show_i, &quit_i])?;

            let _tray = TrayIconBuilder::with_id("tray")
                .icon(app.default_window_icon().unwrap().clone())
                .icon_as_template(true) // macOS: use as template image for auto dark/light mode
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "quit" => {
                        app.exit(0);
                    }
                    "show" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                    "quick_add" => {
                        if let Some(window) = app.get_webview_window("quick-add") {
                            let _ = window.show();
                            let _ = window.set_focus();
                            QUICK_ADD_VISIBLE.store(true, Ordering::SeqCst);
                        }
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| match event {
                    TrayIconEvent::Click {
                        button: MouseButton::Left,
                        ..
                    } => {
                        // 防抖：忽略 300ms 内的重复点击
                        let now = SystemTime::now()
                            .duration_since(UNIX_EPOCH)
                            .unwrap()
                            .as_millis() as u64;
                        let last = LAST_CLICK_TIME.load(Ordering::SeqCst);
                        if now - last < 300 {
                            return;
                        }
                        LAST_CLICK_TIME.store(now, Ordering::SeqCst);

                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("quick-add") {
                            // 使用原子变量追踪状态，不依赖 is_visible()
                            let currently_visible = QUICK_ADD_VISIBLE.load(Ordering::SeqCst);

                            if currently_visible {
                                let _ = window.hide();
                                QUICK_ADD_VISIBLE.store(false, Ordering::SeqCst);
                            } else {
                                // Get tray position to position window
                                if let Some(rect) = tray.rect().ok().flatten() {
                                    let (rx, ry, _rw, rh, is_physical) =
                                        match (rect.position, rect.size) {
                                            (
                                                tauri::Position::Physical(p),
                                                tauri::Size::Physical(s),
                                            ) => (
                                                p.x as f64,
                                                p.y as f64,
                                                s.width as f64,
                                                s.height as f64,
                                                true,
                                            ),
                                            (
                                                tauri::Position::Logical(l),
                                                tauri::Size::Logical(s),
                                            ) => (l.x, l.y, s.width, s.height, false),
                                            _ => (0.0, 0.0, 0.0, 0.0, true),
                                        };

                                    // Calculate X: Align window left edge with tray icon left edge
                                    let x = if rx < 0.0 { 0.0 } else { rx };

                                    // Calculate Y: Below tray icon with small gap
                                    let y = ry + rh + 4.0;

                                    let new_pos = if is_physical {
                                        tauri::Position::Physical(tauri::PhysicalPosition {
                                            x: x as i32,
                                            y: y as i32,
                                        })
                                    } else {
                                        tauri::Position::Logical(tauri::LogicalPosition { x, y })
                                    };

                                    let _ = window.set_position(new_pos);
                                }

                                let _ = window.show();
                                let _ = window.set_focus();
                                QUICK_ADD_VISIBLE.store(true, Ordering::SeqCst);
                                // 记录窗口显示时间
                                let show_time = SystemTime::now()
                                    .duration_since(UNIX_EPOCH)
                                    .unwrap()
                                    .as_millis()
                                    as u64;
                                WINDOW_SHOWN_TIME.store(show_time, Ordering::SeqCst);
                            }
                        }
                    }
                    _ => {}
                })
                .build(app)?;

            Ok(())
        })
        .on_window_event(|window, event| {
            match event {
                WindowEvent::CloseRequested { api, .. } => {
                    // If it's the main window or quick-add, hide instead of close
                    // This keeps the app running in the background with tray icon
                    if window.label() == "main" {
                        let _ = window.hide();
                        api.prevent_close();
                    }
                    if window.label() == "quick-add" {
                        let _ = window.hide();
                        api.prevent_close();
                        QUICK_ADD_VISIBLE.store(false, Ordering::SeqCst);
                    }
                }
                WindowEvent::Focused(focused) => {
                    // 当 quick-add 窗口失去焦点时自动隐藏
                    if window.label() == "quick-add" && !focused {
                        // 检查窗口是否已经显示足够长时间（500ms）
                        let now = SystemTime::now()
                            .duration_since(UNIX_EPOCH)
                            .unwrap()
                            .as_millis() as u64;
                        let shown_time = WINDOW_SHOWN_TIME.load(Ordering::SeqCst);

                        // 只有在窗口显示超过 500ms 后才响应失焦事件
                        if now - shown_time > 500 {
                            let _ = window.hide();
                            QUICK_ADD_VISIBLE.store(false, Ordering::SeqCst);
                        }
                    }
                }
                _ => {}
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
