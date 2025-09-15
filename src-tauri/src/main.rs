#![cfg_attr(all(not(debug_assertions), target_os = "windows"), windows_subsystem = "windows")]

mod ffmpeg;
mod waveform;
mod project_file;


#[tauri::command]
fn probe_video(path: String) -> Result<ffmpeg::Probe, String> {
  ffmpeg::ffprobe(&path).map_err(|e| e.to_string())
}

#[tauri::command]
fn audio_peaks(path: String) -> Result<Vec<i16>, String> {
  waveform::pcm_peaks(&path).map_err(|e| e.to_string())
}

#[tauri::command]
fn export_cutlist(input: String, output: String, ranges_to_cut: Vec<(f64, f64)>) -> Result<(), String> {
  ffmpeg::export_with_cuts(&input, &output, &ranges_to_cut).map_err(|e| e.to_string())
}

#[tauri::command]
fn make_preview_proxy(input: String) -> Result<String, String> {
  ffmpeg::make_preview_proxy(&input, Some(960)).map_err(|e| e.to_string())
}

#[tauri::command]
fn read_file_as_base64(path: String) -> Result<String, String> {
  use std::fs;
  use base64::Engine;
  
  let data = fs::read(&path).map_err(|e| e.to_string())?;
  let encoded = base64::engine::general_purpose::STANDARD.encode(&data);
  Ok(encoded)
}

#[tauri::command]
fn download_audio_file(url: String, filename: String) -> Result<String, String> {
  use std::fs;
  use std::path::PathBuf;
  
  // Create downloads directory if it doesn't exist
  let app_data_dir = dirs::data_dir()
    .ok_or("Failed to get app data directory")?
    .join("video-copilot")
    .join("downloads");
  
  fs::create_dir_all(&app_data_dir)
    .map_err(|e| format!("Failed to create downloads directory: {}", e))?;
  
  let file_path = app_data_dir.join(&filename);
  
  // Download the file
  let response = reqwest::blocking::get(&url)
    .map_err(|e| format!("Failed to download file: {}", e))?;
  
  let mut file = fs::File::create(&file_path)
    .map_err(|e| format!("Failed to create file: {}", e))?;
  
  std::io::copy(&mut response.bytes().unwrap().as_ref(), &mut file)
    .map_err(|e| format!("Failed to write file: {}", e))?;
  
  Ok(file_path.to_string_lossy().to_string())
}

#[tauri::command]
fn copy_to_app_data(path: String) -> Result<String, String> {
  use std::fs;
  use std::path::Path;
  
  let input_path = Path::new(&path);
  let filename = input_path.file_name()
    .ok_or_else(|| "Invalid filename".to_string())?
    .to_string_lossy()
    .to_string();
  
  // Create app data directory
  let app_data_dir = dirs::data_dir()
    .ok_or_else(|| "Could not get app data directory".to_string())?
    .join("video-copilot");
  
  fs::create_dir_all(&app_data_dir).map_err(|e| e.to_string())?;
  
  let output_path = app_data_dir.join(&filename);
  
  // Copy file
  fs::copy(&path, &output_path).map_err(|e| e.to_string())?;
  
  Ok(output_path.to_string_lossy().to_string())
}

#[tauri::command]
fn get_file_url(path: String) -> Result<String, String> {
  // For now, just return the path as-is
  // In a real implementation, this would start an HTTP server
  Ok(format!("file://{}", path))
}

#[tauri::command]
fn read_file_chunk(path: String, offset: u64, size: u64) -> Result<Vec<u8>, String> {
  use std::fs::File;
  use std::io::{Seek, SeekFrom, Read};
  
  let mut file = File::open(&path).map_err(|e| e.to_string())?;
  file.seek(SeekFrom::Start(offset)).map_err(|e| e.to_string())?;
  
  let mut buffer = vec![0u8; size as usize];
  let bytes_read = file.read(&mut buffer).map_err(|e| e.to_string())?;
  buffer.truncate(bytes_read);
  
  Ok(buffer)
}

#[tauri::command]
fn get_file_size(path: String) -> Result<u64, String> {
  use std::fs;
  let metadata = fs::metadata(&path).map_err(|e| e.to_string())?;
  Ok(metadata.len())
}

#[tauri::command]
fn generate_thumbnails(path: String, count: usize, width: u32) -> Result<Vec<String>, String> {
  ffmpeg::generate_thumbnails(&path, count, width).map_err(|e| e.to_string())
}

#[tauri::command]
async fn resize_window(window: tauri::Window, width: f64, height: f64) -> Result<(), String> {
  window.set_size(tauri::LogicalSize::new(width, height)).map_err(|e| e.to_string())?;
  Ok(())
}

#[tauri::command]
async fn center_window(window: tauri::Window) -> Result<(), String> {
  window.center().map_err(|e| e.to_string())?;
  Ok(())
}

#[tauri::command]
async fn set_fullscreen(window: tauri::Window, fullscreen: bool) -> Result<(), String> {
  window.set_fullscreen(fullscreen).map_err(|e| e.to_string())?;
  Ok(())
}

#[tauri::command]
async fn create_editor_window(app: tauri::AppHandle) -> Result<(), String> {
  let _editor_window = tauri::WebviewWindowBuilder::new(
    &app,
    "editor",
    tauri::WebviewUrl::App("/editor".into())
  )
  .title("Video Editor")
  .fullscreen(false)
  .build()
  .map_err(|e| e.to_string())?;
  
  Ok(())
}

#[tauri::command]
async fn focus_main_window(app: tauri::AppHandle) -> Result<(), String> {
  use tauri::Manager;
  
  if let Some(main_window) = app.get_webview_window("main") {
    main_window.set_focus().map_err(|e| e.to_string())?;
  }
  Ok(())
}

// ProjectFile

#[tauri::command]
fn new_project(project_file: project_file::ProjectFile) -> Result<project_file::ProjectFile, String> {
  project_file::new_project(project_file).map_err(|e| e.to_string())
}

#[tauri::command]
fn load_project(path: String) -> Result<project_file::ProjectFile, String> {
  project_file::load_project(path).map_err(|e| e.to_string())
}

#[tauri::command]
fn save_project(new_path: Option<String>) -> Result<(), String> {
  project_file::save_project(new_path).map_err(|e| e.to_string())
}

#[tauri::command]
fn update_project(updated_project: project_file::ProjectFile) -> Result<(), String> {
  project_file::update_project(updated_project).map_err(|e| e.to_string())
}

#[tauri::command]
fn get_project() -> Result<Option<project_file::ProjectFile>, String> {
  project_file::get_project()
}


fn main() {
  tauri::Builder::default()
    .plugin(tauri_plugin_dialog::init())
    .invoke_handler(tauri::generate_handler![
      probe_video,
      audio_peaks,
      export_cutlist,
      make_preview_proxy,
      read_file_as_base64,
      download_audio_file,
      copy_to_app_data,
      get_file_url,
      read_file_chunk,
      get_file_size,
      generate_thumbnails,
      resize_window,
      center_window,
      set_fullscreen,
      create_editor_window,
      focus_main_window,
      // ProjectFile commands
      new_project,
      load_project,
      save_project,
      update_project,
      get_project
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
