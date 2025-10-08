use anyhow::{anyhow, Context, Result};
use serde::{Serialize, Deserialize};
use std::io::{BufReader, Read};
use std::process::{Command, Stdio};
use std::sync::mpsc::{channel, Receiver};
use std::thread;
use base64::Engine;

/// Check if ffmpeg exists
fn ffmpeg_exists() -> bool {
  Command::new("ffmpeg").arg("-version").output().is_ok()
    && Command::new("ffprobe").arg("-version").output().is_ok()
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StreamingSegment {
  pub media_path: String,
  pub start_time: f64,
  pub end_time: f64,
  pub timeline_offset: f64,
}

/// Encode a segment to fragmented MP4 and return base64 chunks as they're produced
pub fn encode_segment_streaming(
  media_path: &str,
  start_time: f64,
  end_time: f64,
  width: u32,
) -> Result<(Receiver<String>, thread::JoinHandle<Result<()>>)> {
  if !ffmpeg_exists() {
    return Err(anyhow!("ffmpeg/ffprobe not found on PATH"));
  }

  let duration = end_time - start_time;
  if duration <= 0.0 {
    return Err(anyhow!("Invalid duration"));
  }
  
  // Create channel for streaming base64 chunks
  let (tx, rx) = channel::<String>();
  
  let media_path = media_path.to_string();
  
  // Spawn encoding thread
  let handle = thread::spawn(move || -> Result<()> {
    let mut child = Command::new("ffmpeg")
      .args([
        "-v", "error",
        "-ss", &start_time.to_string(),
        "-t", &duration.to_string(),
        "-i", &media_path,
        "-vf", &format!("scale='min({},iw)':-2", width),
        "-c:v", "libx264",
        "-preset", "ultrafast",
        "-tune", "zerolatency",  // Optimize for low latency streaming
        "-crf", "26",
        "-g", "15",  // Keyframe every 15 frames for better seeking
        "-pix_fmt", "yuv420p",
        "-c:a", "aac",
        "-b:a", "128k",
        // Fragmented MP4 for streaming (compatible with MSE)
        "-movflags", "frag_keyframe+empty_moov+default_base_moof",
        "-frag_duration", "500000", // 500ms fragments
        "-f", "mp4",
        "pipe:1", // Output to stdout
      ])
      .stdout(Stdio::piped())
      .stderr(Stdio::piped())
      .spawn()
      .with_context(|| "failed to spawn ffmpeg for streaming")?;

    let stdout = child.stdout.take().ok_or_else(|| anyhow!("failed to capture stdout"))?;
    let mut reader = BufReader::new(stdout);
    
    // Stream chunks as they're produced
    let mut buffer = vec![0u8; 64 * 1024]; // 64KB chunks
    let mut chunk_count = 0;
    
    loop {
      match reader.read(&mut buffer) {
        Ok(0) => {
          // EOF
          eprintln!("Streaming complete, sent {} chunks", chunk_count);
          break;
        }
        Ok(n) => {
          // Encode chunk to base64 and send
          let chunk = buffer[..n].to_vec();
          let base64_chunk = base64::engine::general_purpose::STANDARD.encode(&chunk);
          
          if tx.send(base64_chunk).is_err() {
            // Receiver dropped, stop encoding
            eprintln!("Receiver dropped, stopping encoding");
            let _ = child.kill();
            break;
          }
          
          chunk_count += 1;
          if chunk_count % 10 == 0 {
            eprintln!("Streamed {} chunks...", chunk_count);
          }
        }
        Err(e) => {
          eprintln!("Error reading ffmpeg output: {}", e);
          break;
        }
      }
    }

    let output = child.wait_with_output()
      .with_context(|| "failed to wait for ffmpeg")?;

    if !output.status.success() {
      let stderr = String::from_utf8_lossy(&output.stderr);
      eprintln!("FFmpeg streaming error: {}", stderr);
      return Err(anyhow!("ffmpeg streaming failed: {}", stderr));
    }

    eprintln!("FFmpeg streaming encoding completed successfully");
    Ok(())
  });

  Ok((rx, handle))
}

/// Generate streaming preview for multiple segments
pub fn generate_streaming_preview(
  segments: Vec<StreamingSegment>,
  width: u32,
) -> Result<(Receiver<String>, thread::JoinHandle<Result<()>>)> {
  if segments.is_empty() {
    return Err(anyhow!("No segments provided"));
  }

  let (tx, rx) = channel::<String>();
  
  let handle = thread::spawn(move || -> Result<()> {
    for (i, segment) in segments.iter().enumerate() {
      eprintln!("Encoding segment {}/{}: {}s to {}s", 
        i + 1, segments.len(), segment.start_time, segment.end_time);
      
      let (seg_rx, seg_handle) = encode_segment_streaming(
        &segment.media_path,
        segment.start_time,
        segment.end_time,
        width,
      )?;

      // Forward chunks from this segment
      while let Ok(chunk) = seg_rx.recv() {
        if tx.send(chunk).is_err() {
          eprintln!("Receiver dropped, stopping multi-segment encoding");
          return Ok(());
        }
      }

      // Wait for segment to complete
      seg_handle.join().unwrap()?;
      eprintln!("Segment {}/{} completed", i + 1, segments.len());
    }

    eprintln!("All segments encoded successfully");
    Ok(())
  });

  Ok((rx, handle))
}

