use anyhow::{anyhow, Context, Result};
use serde::{Serialize, Deserialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
use base64::Engine;

/// --- Public Types ------------------------------------------------------------------

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Probe {
  pub duration: f64,
  pub width: u32,
  pub height: u32,
  pub fps: f64,
  pub audio_rate: u32,
  pub audio_channels: u8,
  pub v_codec: String,
  pub a_codec: String,
  pub container: String,
}

/// Cut range (seconds).
pub type Cut = (f64, f64);

/// --- Probe -------------------------------------------------------------------------

pub fn ffprobe(input: &str) -> Result<Probe> {
  let out = Command::new("ffprobe")
    .args([
      "-v",
      "error",
      "-print_format",
      "json",
      "-show_streams",
      "-show_format",
      input,
    ])
    .output()
    .with_context(|| "failed to spawn ffprobe")?;

  if !out.status.success() {
    return Err(anyhow!(
      "ffprobe failed: {}",
      String::from_utf8_lossy(&out.stderr)
    ));
  }

  let json: serde_json::Value =
    serde_json::from_slice(&out.stdout).with_context(|| "invalid ffprobe JSON")?;

  let fmt = &json["format"];
  let duration = fmt["duration"]
    .as_str()
    .unwrap_or("0")
    .parse::<f64>()
    .unwrap_or(0.0);
  let container = fmt["format_name"]
    .as_str()
    .unwrap_or_default()
    .to_string();

  let empty_vec = vec![];
  let streams = json["streams"].as_array().unwrap_or(&empty_vec);

  // Find video and audio streams (video stream is optional for audio-only files)
  let v = streams.iter().find(|s| s["codec_type"] == "video");
  let a = streams
    .iter()
    .find(|s| s["codec_type"] == "audio")
    .ok_or_else(|| anyhow!("no audio stream"))?;

  // Handle video stream (if present)
  let (width, height, fps, v_codec) = if let Some(v) = v {
    // fps as num/den
    let r = v["r_frame_rate"].as_str().unwrap_or("30/1");
    let mut parts = r.split('/');
    let num: f64 = parts.next().unwrap_or("30").parse().unwrap_or(30.0);
    let den: f64 = parts.next().unwrap_or("1").parse().unwrap_or(1.0);
    let fps = if den > 0.0 { num / den } else { 30.0 };
    
    // Get width and height - if they're not present or are 0, treat as audio-only
    let w = v["width"].as_u64().unwrap_or(0) as u32;
    let h = v["height"].as_u64().unwrap_or(0) as u32;
    
    // If width or height is 0, this is likely an audio file with an embedded image
    if w == 0 || h == 0 {
      (0, 0, 0.0, "none".to_string())
    } else {
      (
        w,
        h,
        fps,
        v["codec_name"].as_str().unwrap_or("h264").to_string()
      )
    }
  } else {
    // Audio-only file
    (0, 0, 0.0, "none".to_string())
  };

  Ok(Probe {
    duration,
    width,
    height,
    fps,
    audio_rate: a["sample_rate"]
      .as_str()
      .unwrap_or("48000")
      .parse()
      .unwrap_or(48000),
    audio_channels: a["channels"].as_u64().unwrap_or(2) as u8,
    v_codec,
    a_codec: a["codec_name"].as_str().unwrap_or("aac").to_string(),
    container,
  })
}

/// --- Utilities ---------------------------------------------------------------------

/// Return `true` if ffmpeg & ffprobe appear available.
pub fn ffmpeg_exists() -> bool {
  Command::new("ffmpeg").arg("-version").output().is_ok()
    && Command::new("ffprobe").arg("-version").output().is_ok()
}

/// Clamp/sort/merge cut ranges; discard invalid or tiny (< 1ms) after clamping.
fn normalize_cuts(mut cuts: Vec<Cut>, duration: f64) -> Vec<Cut> {
  if duration <= 0.0 {
    return vec![];
  }
  for (s, e) in cuts.iter_mut() {
    // normalize order
    if *e < *s {
      std::mem::swap(s, e);
    }
    // clamp to [0, duration]
    *s = s.max(0.0);
    *e = e.min(duration);
  }
  // drop invalid / degenerate
  cuts.retain(|(s, e)| *e > *s + 0.001);

  // sort + merge overlaps
  cuts.sort_by(|a, b| a.0.partial_cmp(&b.0).unwrap());
  let mut merged: Vec<Cut> = Vec::new();
  for (s, e) in cuts {
    if let Some((_ms, me)) = merged.last_mut() {
      if s <= *me + 0.005 {
        *me = me.max(e);
      } else {
        merged.push((s, e));
      }
    } else {
      merged.push((s, e));
    }
  }
  merged
}


/// Convert cut ranges into kept segments across [0, duration].
fn to_kept_segments(cuts: &[Cut], duration: f64) -> Vec<Cut> {
  if duration <= 0.0 {
    return vec![];
  }
  if cuts.is_empty() {
    return vec![(0.0, duration)];
  }
  let mut kept: Vec<Cut> = Vec::new();
  let mut t = 0.0;
  for (s, e) in cuts {
    if *s > t {
      kept.push((t, *s));
    }
    t = *e;
  }
  if t < duration {
    kept.push((t, duration));
  }
  kept
}

/// Build a filter_complex string that trims video/audio to `kept` segments and concats them.
fn build_filter_complex(kept: &[Cut]) -> String {
  // labels [v0],[a0].. concat to [outv][outa]
  let mut filter = String::new();
  let mut v_labels = Vec::with_capacity(kept.len());
  let mut a_labels = Vec::with_capacity(kept.len());

  for (i, (s, e)) in kept.iter().enumerate() {
    filter.push_str(&format!(
      "[0:v]trim=start={}:end={},setpts=PTS-STARTPTS[v{idx}];\
       [0:a]atrim=start={}:end={},asetpts=PTS-STARTPTS,aresample=async=1:first_pts=0[a{idx}];",
      s, e, s, e, idx = i
    ));
    v_labels.push(format!("[v{}]", i));
    a_labels.push(format!("[a{}]", i));
  }
  filter.push_str(&format!(
    "{}{}concat=n={}:v=1:a=1[outv][outa]",
    v_labels.join(""),
    a_labels.join(""),
    kept.len()
  ));
  filter
}

/// Create a sibling path `.../name.tmp.ext` for atomic writes.
fn temp_output_path(output: &Path) -> PathBuf {
  let parent = output.parent().unwrap_or_else(|| Path::new("."));
  let stem = output
    .file_stem()
    .and_then(|s| s.to_str())
    .unwrap_or("out");
  let ext = output.extension().and_then(|s| s.to_str()).unwrap_or("mp4");
  parent.join(format!("{stem}.tmp.{ext}"))
}

/// --- Export with cuts ----------------------------------------------------------------

/// Export a new file with the specified `ranges_to_cut` removed.
/// Uses filter_complex trim/concat (re-encodes to H.264/AAC).
pub fn export_with_cuts(input: &str, output: &str, ranges_to_cut: &[(f64, f64)]) -> Result<()> {
  if !ffmpeg_exists() {
    return Err(anyhow!("ffmpeg/ffprobe not found on PATH"));
  }

  // If nothing to cut → copy as-is (fast).
  if ranges_to_cut.is_empty() {
    fs::copy(input, output)
      .with_context(|| format!("failed to copy {} -> {}", input, output))?;
    return Ok(());
  }

  let probe = ffprobe(input).context("ffprobe failed")?;
  let duration = probe.duration;

  // Normalize requested cuts.
  let normalized = normalize_cuts(ranges_to_cut.to_vec(), duration);
  if normalized.is_empty() {
    // All cuts invalid/degenerate → just copy.
    fs::copy(input, output)
      .with_context(|| format!("failed to copy {} -> {}", input, output))?;
    return Ok(());
  }

  // Convert to kept segments.
  let kept = to_kept_segments(&normalized, duration);
  if kept.is_empty() {
    return Err(anyhow!("All content would be cut out (no kept segments)."));
  }

  let filter_complex = build_filter_complex(&kept);
  let tmp = temp_output_path(Path::new(output));

  // Encode. You can switch codecs/presets as needed.
  let status = Command::new("ffmpeg")
    .args([
      "-v",
      "error",
      "-i",
      input,
      "-filter_complex",
      &filter_complex,
      "-map",
      "[outv]",
      "-map",
      "[outa]",
      "-c:v",
      "libx264",
      "-preset",
      "medium",
      "-crf",
      "20",
      "-pix_fmt",
      "yuv420p",
      "-c:a",
      "aac",
      "-b:a",
      "192k",
      "-movflags",
      "+faststart",
      "-y",
      tmp.to_string_lossy().as_ref(),
    ])
    .status()
    .with_context(|| "failed to spawn ffmpeg for export")?;

  if !status.success() {
    // Cleanup partial temp
    let _ = fs::remove_file(&tmp);
    return Err(anyhow!("ffmpeg export failed (status {:?})", status.code()));
  }

  // Atomic replace.
  fs::rename(&tmp, output).with_context(|| "failed to move tmp output into place")?;
  Ok(())
}

/// --- Preview Proxy -------------------------------------------------------------------

/// Make a small H.264/AAC proxy mp4 for reliable WebView playback.
/// Returns the output path. If `max_w` is `Some`, downscales width, preserving AR.
pub fn make_preview_proxy(input: &str, max_w: Option<u32>) -> Result<String> {
  if !ffmpeg_exists() {
    return Err(anyhow!("ffmpeg/ffprobe not found on PATH"));
  }

  let input_path = Path::new(input);
  let stem = input_path
    .file_stem()
    .ok_or_else(|| anyhow!("Invalid input file path"))?
    .to_string_lossy();

  // Use Downloads directory for better Tauri compatibility
  let downloads_dir = dirs::download_dir().unwrap_or_else(|| std::env::temp_dir());
  let out_path = downloads_dir.join(format!("{}_proxy.mp4", stem));
  let out_str = out_path.to_string_lossy().to_string();

  // scale filter if requested (960 width by default is a good dev choice)
  let scale = max_w.unwrap_or(960);
  let vf = format!("scale='min({scale},iw)':-2");

  let status = Command::new("ffmpeg")
    .args([
      "-v",
      "error",
      "-i",
      input,
      "-vf",
      &vf,
      "-c:v",
      "libx264",
      "-preset",
      "ultrafast",
      "-crf",
      "28",
      "-pix_fmt",
      "yuv420p",
      "-c:a",
      "aac",
      "-b:a",
      "96k",
      "-movflags",
      "+faststart",
      "-y",
      &out_str,
    ])
    .status()
    .with_context(|| "failed to spawn ffmpeg for proxy")?;

  if !status.success() {
    return Err(anyhow!(
      "ffmpeg proxy creation failed (status {:?})",
      status.code()
    ));
  }

  Ok(out_str)
}

/// --- Thumbnail Generation ------------------------------------------------------------

/// Generate video thumbnails at regular intervals for timeline scrubbing.
/// Returns a vector of base64-encoded thumbnail images.
/// For audio files, returns an empty vector.
pub fn generate_thumbnails(input: &str, count: usize, width: u32) -> Result<Vec<String>> {
  if !ffmpeg_exists() {
    return Err(anyhow!("ffmpeg/ffprobe not found on PATH"));
  }

  let probe = ffprobe(input).context("ffprobe failed")?;
  let duration = probe.duration;
  
  if duration <= 0.0 {
    return Err(anyhow!("Invalid media duration"));
  }

  // Check if this is a video file (has video stream)
  if probe.width == 0 || probe.height == 0 {
    // Audio-only file, return empty thumbnails
    return Ok(vec![]);
  }

  let mut thumbnails = Vec::new();
  let interval = duration / (count as f64);
  
  for i in 0..count {
    let timestamp = (i as f64) * interval;
    
    // Generate thumbnail using ffmpeg
    let output = Command::new("ffmpeg")
      .args([
        "-v", "error",
        "-ss", &timestamp.to_string(),
        "-i", input,
        "-vframes", "1",
        "-vf", &format!("scale={}:-1", width),
        "-f", "image2pipe",
        "-vcodec", "png",
        "-"
      ])
      .output()
      .with_context(|| format!("failed to spawn ffmpeg for thumbnail at {}", timestamp))?;

    if !output.status.success() {
      return Err(anyhow!(
        "ffmpeg thumbnail generation failed at {}: {}",
        timestamp,
        String::from_utf8_lossy(&output.stderr)
      ));
    }

    // Convert to base64
    let base64 = base64::engine::general_purpose::STANDARD.encode(&output.stdout);
    thumbnails.push(base64);
  }

  Ok(thumbnails)
}

/// --- Album Art Extraction -------------------------------------------------------------

/// Extract album art from audio file and return as base64-encoded PNG.
/// Returns None if no album art is found.
pub fn extract_album_art(input: &str) -> Result<Option<String>> {
  if !ffmpeg_exists() {
    return Err(anyhow!("ffmpeg/ffprobe not found on PATH"));
  }

  // Try to extract album art using ffmpeg
  let output = Command::new("ffmpeg")
    .args([
      "-v", "error",
      "-i", input,
      "-an",  // Disable audio
      "-c:v", "png",  // Convert to PNG
      "-f", "image2pipe",
      "-vframes", "1",
      "-"
    ])
    .output()
    .with_context(|| "failed to spawn ffmpeg for album art extraction")?;

  // If ffmpeg failed or returned no data, there's no album art
  if !output.status.success() || output.stdout.is_empty() {
    return Ok(None);
  }

  // Convert to base64
  let base64 = base64::engine::general_purpose::STANDARD.encode(&output.stdout);
  Ok(Some(base64))
}

/// --- Timeline Preview Generation -------------------------------------------------------

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct TimelineClip {
  pub media_path: String,
  pub start_time: f64,  // Start time within the source media
  pub end_time: f64,    // End time within the source media
  pub offset: f64,      // Position on the timeline
}

/// Generate a preview video from a timeline composition
/// This creates a fast, lower quality preview optimized for the player dimensions
pub fn generate_timeline_preview(
  clips: &[TimelineClip],
  output_width: u32,
  _total_duration: f64,
) -> Result<String> {
  if !ffmpeg_exists() {
    return Err(anyhow!("ffmpeg/ffprobe not found on PATH"));
  }

  if clips.is_empty() {
    return Err(anyhow!("No clips provided for timeline preview"));
  }

  // Use Downloads directory for preview storage
  let downloads_dir = dirs::download_dir().unwrap_or_else(|| std::env::temp_dir());
  let timestamp = std::time::SystemTime::now()
    .duration_since(std::time::UNIX_EPOCH)
    .unwrap()
    .as_secs();
  let out_path = downloads_dir.join(format!("timeline_preview_{}.mp4", timestamp));
  let out_str = out_path.to_string_lossy().to_string();

  // Sort clips by offset
  let mut sorted_clips = clips.to_vec();
  sorted_clips.sort_by(|a, b| a.offset.partial_cmp(&b.offset).unwrap());

  // Build filter_complex for concatenating clips
  let mut filter = String::new();
  let mut stream_labels = Vec::new();

  for (i, clip) in sorted_clips.iter().enumerate() {
    let _clip_duration = clip.end_time - clip.start_time;
    
    // Trim and scale each clip
    filter.push_str(&format!(
      "[{}:v]trim=start={}:end={},setpts=PTS-STARTPTS,scale='min({},iw)':-2[v{}]; \
       [{}:a]atrim=start={}:end={},asetpts=PTS-STARTPTS,aresample=async=1:first_pts=0[a{}]; ",
      i, clip.start_time, clip.end_time, output_width, i,
      i, clip.start_time, clip.end_time, i
    ));
    
    // Concat expects streams in pairs: [v0][a0][v1][a1]...
    stream_labels.push(format!("[v{}][a{}]", i, i));
  }

  // Concatenate all clips - join the paired labels
  filter.push_str(&format!(
    "{}concat=n={}:v=1:a=1[outv][outa]",
    stream_labels.join(""),
    sorted_clips.len()
  ));

  // Build ffmpeg command with multiple inputs
  let mut cmd = Command::new("ffmpeg");
  cmd.args(["-v", "error"]);
  
  // Add all input files
  for clip in &sorted_clips {
    cmd.args(["-i", &clip.media_path]);
  }

  // Add filter and output settings
  cmd.args([
    "-filter_complex",
    &filter,
    "-map",
    "[outv]",
    "-map",
    "[outa]",
    "-c:v",
    "libx264",
    "-preset",
    "ultrafast",  // Fast encoding for preview
    "-crf",
    "28",  // Lower quality for faster preview
    "-pix_fmt",
    "yuv420p",
    "-c:a",
    "aac",
    "-b:a",
    "96k",
    "-movflags",
    "+faststart",
    "-y",
    &out_str,
  ]);

  let status = cmd
    .status()
    .with_context(|| "failed to spawn ffmpeg for timeline preview")?;

  if !status.success() {
    return Err(anyhow!(
      "ffmpeg timeline preview creation failed (status {:?})",
      status.code()
    ));
  }

  Ok(out_str)
}

/// Generate a fast preview with dynamic resolution based on player dimensions
pub fn generate_adaptive_timeline_preview(
  clips: &[TimelineClip],
  player_width: u32,
  _player_height: u32,
  _total_duration: f64,
) -> Result<String> {
  if !ffmpeg_exists() {
    return Err(anyhow!("ffmpeg/ffprobe not found on PATH"));
  }

  if clips.is_empty() {
    return Err(anyhow!("No clips provided for timeline preview"));
  }

  // Calculate optimal preview resolution
  // Aim for slightly higher than player size to avoid pixelation
  let target_width = (player_width as f32 * 1.2).min(1280.0) as u32;

  // Use Downloads directory for preview storage
  let downloads_dir = dirs::download_dir().unwrap_or_else(|| std::env::temp_dir());
  let timestamp = std::time::SystemTime::now()
    .duration_since(std::time::UNIX_EPOCH)
    .unwrap()
    .as_secs();
  let out_path = downloads_dir.join(format!("timeline_preview_{}.mp4", timestamp));
  let out_str = out_path.to_string_lossy().to_string();

  // Sort clips by offset
  let mut sorted_clips = clips.to_vec();
  sorted_clips.sort_by(|a, b| a.offset.partial_cmp(&b.offset).unwrap());

  // For single clip, use simpler approach
  if sorted_clips.len() == 1 {
    let clip = &sorted_clips[0];
    let clip_duration = clip.end_time - clip.start_time;
    
    let output = Command::new("ffmpeg")
      .args([
        "-v", "error",
        "-ss", &clip.start_time.to_string(),
        "-t", &clip_duration.to_string(),
        "-i", &clip.media_path,
        "-vf", &format!("scale='min({},iw)':-2", target_width),
        "-c:v", "libx264",
        "-preset", "ultrafast",
        "-crf", "26",  // Slightly better quality for single clip
        "-pix_fmt", "yuv420p",
        "-c:a", "aac",
        "-b:a", "128k",
        "-movflags", "+faststart",
        "-y",
        &out_str,
      ])
      .output()
      .with_context(|| "failed to spawn ffmpeg for single clip preview")?;

    if !output.status.success() {
      let stderr = String::from_utf8_lossy(&output.stderr);
      eprintln!("FFmpeg error output: {}", stderr);
      return Err(anyhow!("ffmpeg preview creation failed: {}", stderr));
    }

    return Ok(out_str);
  }

  // Build filter_complex for multiple clips
  let mut filter = String::new();
  let mut stream_labels = Vec::new();

  for (i, clip) in sorted_clips.iter().enumerate() {
    let _clip_duration = clip.end_time - clip.start_time;
    
    // Trim, scale, and prepare each clip
    filter.push_str(&format!(
      "[{}:v]trim=start={}:end={},setpts=PTS-STARTPTS,scale='min({},iw)':-2,fps=30[v{}]; \
       [{}:a]atrim=start={}:end={},asetpts=PTS-STARTPTS,aresample=async=1:first_pts=0[a{}]; ",
      i, clip.start_time, clip.end_time, target_width, i,
      i, clip.start_time, clip.end_time, i
    ));
    
    // Concat expects streams in pairs: [v0][a0][v1][a1]...
    stream_labels.push(format!("[v{}][a{}]", i, i));
  }

  // Concatenate all clips - join the paired labels
  filter.push_str(&format!(
    "{}concat=n={}:v=1:a=1[outv][outa]",
    stream_labels.join(""),
    sorted_clips.len()
  ));

  // Build ffmpeg command with multiple inputs
  let mut cmd = Command::new("ffmpeg");
  cmd.args(["-v", "error"]);
  
  // Add all input files
  for clip in &sorted_clips {
    cmd.args(["-i", &clip.media_path]);
  }

  // Add filter and output settings
  cmd.args([
    "-filter_complex",
    &filter,
    "-map", "[outv]",
    "-map", "[outa]",
    "-c:v", "libx264",
    "-preset", "ultrafast",
    "-crf", "26",
    "-pix_fmt", "yuv420p",
    "-c:a", "aac",
    "-b:a", "128k",
    "-movflags", "+faststart",
    "-y",
    &out_str,
  ]);

  let output = cmd
    .output()
    .with_context(|| "failed to spawn ffmpeg for timeline preview")?;

  if !output.status.success() {
    let stderr = String::from_utf8_lossy(&output.stderr);
    eprintln!("FFmpeg error output: {}", stderr);
    return Err(anyhow!(
      "ffmpeg timeline preview creation failed: {}",
      stderr
    ));
  }

  Ok(out_str)
}
