#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};
use tauri::Manager;
use tauri::tray::{TrayIconBuilder, MouseButton, MouseButtonState, TrayIconEvent};
use tauri::menu::{MenuBuilder, MenuItemBuilder};
use tauri_plugin_autostart::MacosLauncher;

// Flag to track if user requested real quit (from tray menu)
static QUIT_REQUESTED: AtomicBool = AtomicBool::new(false);

mod ai;
mod audio;
mod commands;
mod local_models;
mod secure_storage;

use commands::AppState;

#[tokio::main]
async fn main() {
    // Initialize AI Proxy
    let ai_proxy = Arc::new(ai::AIProxy::new());

    // Initialize Audio Recording Manager
    let audio_manager = Arc::new(audio::AudioRecordingManager::new());

    let app_state = AppState {
        ai_proxy,
        audio_manager,
        active_operations: Arc::new(tokio::sync::RwLock::new(std::collections::HashMap::new())),
    };

    tauri::Builder::default()
        .plugin(tauri_plugin_autostart::init(MacosLauncher::LaunchAgent, None))
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
            }
        }))
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .manage(app_state)
        .invoke_handler(tauri::generate_handler![
            // AI commands - credentials passed per-request
            commands::chat_completion,
            commands::chat_completion_stream,
            commands::fetch_provider_models,
            // AI Audio commands - credentials passed per-request
            commands::transcribe_audio,
            commands::text_to_speech,
            // Abort operations
            commands::abort_operation,
            // Secure storage commands
            secure_storage::secure_storage_set,
            secure_storage::secure_storage_get,
            secure_storage::secure_storage_delete,
            secure_storage::secure_storage_has,
            secure_storage::secure_storage_set_provider_keys,
            secure_storage::secure_storage_get_provider_keys,
            // Keyboard simulation
            commands::simulate_paste,
            // Audio recording commands
            commands::start_audio_recording,
            commands::stop_audio_recording,
            commands::cancel_audio_recording,
            commands::reset_audio_recording,
            // Local model commands
            // System settings
            commands::check_accessibility_permission,
            commands::open_accessibility_settings,
            // Notification sound
            commands::play_notification_sound,
            // Local model commands
            commands::local_models_list,
            commands::local_model_download,
            commands::local_model_delete,
            commands::local_transcribe_audio,
            commands::read_audio_file_as_wav,
        ])
        .setup(|app| {
            // Initialize Secure Storage with app data directory
            let app_data_dir = app.path().app_data_dir()
                .expect("Failed to get app data directory");
            let secure_storage = secure_storage::SecureStorage::new(app_data_dir.clone());

            // Initialize Local Model Manager
            let local_model_manager = Arc::new(local_models::LocalModelManager::new(app_data_dir));
            app.manage(secure_storage);
            app.manage(local_model_manager);

            // Create tray menu items
            let show_item = MenuItemBuilder::with_id("show", "Pokaż").build(app)?;
            let quit_item = MenuItemBuilder::with_id("quit", "Zamknij").build(app)?;

            // Build tray menu
            let menu = MenuBuilder::new(app)
                .item(&show_item)
                .separator()
                .item(&quit_item)
                .build()?;

            // Create tray icon with menu
            let _tray = TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .show_menu_on_left_click(false)
                .tooltip("AI Assistant")
                .on_menu_event(|app, event| {
                    match event.id().as_ref() {
                        "show" => {
                            if let Some(window) = app.get_webview_window("main") {
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                        }
                        "quit" => {
                            QUIT_REQUESTED.store(true, Ordering::SeqCst);
                            app.exit(0);
                        }
                        _ => {}
                    }
                })
                .on_tray_icon_event(|tray, event| {
                    // Show window on left click
                    if let TrayIconEvent::Click { button: MouseButton::Left, button_state: MouseButtonState::Up, .. } = event {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                })
                .build(app)?;

            // Note: Microphone permissions are handled by the OS
            // On macOS: Info.plist includes NSMicrophoneUsageDescription
            // The system will show a permission dialog on first microphone access
            Ok(())
        })
        .on_window_event(|window, event| {
            let label = window.label();

            match event {
                tauri::WindowEvent::CloseRequested { api, .. } => {
                    if label == "main" {
                        if let Err(e) = window.hide() {
                            eprintln!("[Window] Failed to hide main window: {}", e);
                        }
                        api.prevent_close();
                    }
                }
                _ => {}
            }
        })
        .build(tauri::generate_context!())
        .expect("error building tauri application")
        .run(|_app_handle, event| {
            match event {
                tauri::RunEvent::ExitRequested { api, .. } => {
                    // Only prevent exit if it wasn't requested from tray menu
                    if !QUIT_REQUESTED.load(Ordering::SeqCst) {
                        api.prevent_exit();
                    }
                }
                _ => {}
            }
        });
}
