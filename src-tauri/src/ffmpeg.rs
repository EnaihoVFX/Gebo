use anyhow::{anyhow, Context, Result};
use serde::Serialize;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;

/// --- Public Types ------------------------------------------------------------------

#[derive(Serialize, Debug, Clone)]
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
    
    (
      v["width"].as_u64().unwrap_or(1920) as u32,
      v["height"].as_u64().unwrap_or(1080) as u32,
      fps,
      v["codec_name"].as_str().unwrap_or("h264").to_string()
    )
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
    let base64 = base64::encode(&output.stdout);
    thumbnails.push(base64);
  }

  Ok(thumbnails)
}
