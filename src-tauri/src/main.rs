#![cfg_attr(all(not(debug_assertions), target_os = "windows"), windows_subsystem = "windows")]

mod ffmpeg;
mod waveform;

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

fn main() {
  tauri::Builder::default()
    .plugin(tauri_plugin_dialog::init())
    .invoke_handler(tauri::generate_handler![
      probe_video,
      audio_peaks,
      export_cutlist,
      make_preview_proxy
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
