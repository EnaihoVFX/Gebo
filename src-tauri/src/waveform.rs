use std::{io::Read, process::Command};

pub fn pcm_peaks(path: &str) -> anyhow::Result<Vec<i16>> {
  // Convert to mono 8kHz 16-bit PCM and stream to stdout
  let mut child = Command::new("ffmpeg")
    .args(["-v","error","-i", path, "-ac","1","-ar","8000","-f","s16le","-"])
    .stdout(std::process::Stdio::piped())
    .spawn()?;
  let mut buf = vec![];
  child.stdout.as_mut().unwrap().read_to_end(&mut buf)?;
  // Downsample to coarse peaks: one value per ~100 samples
  let mut peaks = vec![];
  for chunk in buf.chunks_exact(2*100) {
    let mut maxv: i16 = 0;
    for s in chunk.chunks_exact(2) {
      let v = i16::from_le_bytes([s[0], s[1]]).abs();
      if v > maxv { maxv = v; }
    }
    peaks.push(maxv);
  }
  Ok(peaks)
}
