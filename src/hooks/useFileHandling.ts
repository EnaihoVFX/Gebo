import { useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { convertFileSrc } from "@tauri-apps/api/core";
import { audioPeaks, makePreviewProxy, probeVideo, readFileAsBase64, copyToAppData, readFileChunk, getFileSize, type Probe } from "../lib/ffmpeg";
import type { Range } from "../types";

export function useFileHandling() {
  const [filePath, setFilePath] = useState<string>("");
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const [probe, setProbe] = useState<Probe | null>(null);
  const [peaks, setPeaks] = useState<number[]>([]);
  const [debug, setDebug] = useState<string>("");

  const log = (m: string) => setDebug(d => (d ? d + "\n" : "") + m);

  // Function to create blob URL from file chunks
  const createBlobFromFile = async (filePath: string) => {
    try {
      log(`Creating blob from file chunks...`);
      const fileSize = await getFileSize(filePath);
      const fileSizeMB = (fileSize / (1024 * 1024)).toFixed(1);
      log(`File size: ${fileSizeMB} MB`);
      
      // Read file in chunks to avoid memory issues
      const chunkSize = 2 * 1024 * 1024; // 2MB chunks for better performance
      const chunks: Uint8Array[] = [];
      
      for (let offset = 0; offset < fileSize; offset += chunkSize) {
        const currentChunkSize = Math.min(chunkSize, fileSize - offset);
        const chunk = await readFileChunk(filePath, offset, currentChunkSize);
        chunks.push(new Uint8Array(chunk));
        
        // Show progress every 20MB
        if (offset % (chunkSize * 10) === 0) {
          const progress = ((offset / fileSize) * 100).toFixed(1);
          log(`Progress: ${progress}% (${(offset / (1024 * 1024)).toFixed(1)} MB / ${fileSizeMB} MB)`);
        }
      }
      
      log(`All chunks read, creating blob...`);
      // Combine all chunks into a single blob
      const blob = new Blob(chunks, { type: 'video/mp4' });
      const blobUrl = URL.createObjectURL(blob);
      log(`✅ Blob URL created successfully: ${blobUrl}`);
      return blobUrl;
    } catch (e: any) {
      log(`❌ Blob creation failed: ${e?.toString?.() || e}`);
      throw e;
    }
  };

  const pickFile = async () => {
    try {
      const sel = await open({ multiple: false, filters: [{ name: "Video", extensions: ["mp4", "MP4", "mov", "MOV", "mkv", "MKV"] }] });
      if (typeof sel !== "string") return;

      setDebug("");
      setFilePath(sel);

      log(`Selected file: ${sel}`);

      // Use chunked blob method for reliable video loading
      try {
        log(`Creating blob URL for reliable playback...`);
        const blobUrl = await createBlobFromFile(sel);
        setPreviewUrl(blobUrl);
        log(`Using blob URL: ${blobUrl}`);
      } catch (e: any) {
        log(`Blob creation failed, falling back to asset protocol: ${e?.toString?.() || e}`);
        // Fallback to original method
        const originalUrl = convertFileSrc(sel);
        setPreviewUrl(originalUrl);
        log(`Fallback URL: ${originalUrl}`);
      }

      // Probe + peaks
      try {
        log(`Starting probe for: ${sel}`);
        const p = await probeVideo(sel);
        setProbe(p);
        log(`Probed: dur=${p.duration.toFixed(2)}s fps=${p.fps.toFixed(2)} rate=${p.audio_rate} codec=${p.v_codec}/${p.a_codec}`);
      } catch (e: any) {
        log(`Probe failed: ${e?.toString?.() || e}`);
        log(`Error details: ${JSON.stringify(e)}`);
        return;
      }

      try {
        log(`Starting audio peaks for: ${sel}`);
        const pk = await audioPeaks(sel);
        setPeaks(pk.map(v => Math.max(0, Math.min(32767, v))));
        log(`Peaks: ${pk.length}`);
      } catch (e: any) {
        log(`Audio peaks failed: ${e?.toString?.() || e}`);
        log(`Peaks error details: ${JSON.stringify(e)}`);
        setPeaks([]);
      }

      // Proactively proxy for MOV/MKV for reliable playback
      if (/\.(mkv|mov|MKV|MOV)$/i.test(sel)) {
        try {
          log(`Creating preview proxy for: ${sel}`);
          const prox = await makePreviewProxy(sel);
          log(`Proxy created, creating blob URL for proxy...`);
          const proxyBlobUrl = await createBlobFromFile(prox);
          setPreviewUrl(proxyBlobUrl);
          log(`Using preview proxy blob URL (H.264/AAC): ${proxyBlobUrl}`);
        } catch (e: any) {
          log("Proxy failed, continuing with original. " + (e?.toString?.() || e));
          log(`Proxy error details: ${JSON.stringify(e)}`);
        }
      }

      return sel;
    } catch (e: any) {
      log(`File picker failed: ${e?.toString?.() || e}`);
    }
  };

  const resetApp = () => {
    setPreviewUrl("");
    setFilePath("");
    setProbe(null);
    setPeaks([]);
    setDebug("");
    log("App reset - cleared all data");
  };

  return {
    filePath,
    previewUrl,
    probe,
    peaks,
    debug,
    log,
    setPreviewUrl,
    createBlobFromFile,
    pickFile,
    resetApp,
  };
}
