import { open, save } from "@tauri-apps/plugin-dialog";
import { convertFileSrc } from "@tauri-apps/api/core";
import { audioPeaks, exportCutlist, makePreviewProxy, probeVideo, type Probe } from "../../../lib/ffmpeg";
import type { Range } from "./videoUtils";

export interface FileProcessingResult {
  filePath: string;
  previewUrl: string;
  probe: Probe;
  peaks: number[];
}

export const processVideoFile = async (filePath: string): Promise<FileProcessingResult> => {
  // Start with original file path
  const originalUrl = convertFileSrc(filePath);

  // Probe video
  const probe = await probeVideo(filePath);

  // Get audio peaks
  const rawPeaks = await audioPeaks(filePath);
  const peaks = rawPeaks.map(v => Math.max(0, Math.min(32767, v)));

  let previewUrl = originalUrl;

  // Proactively proxy for MOV/MKV for reliable playback
  if (/\.(mkv|mov)$/i.test(filePath)) {
    try {
      const prox = await makePreviewProxy(filePath);
      previewUrl = convertFileSrc(prox);
    } catch (e) {
      // Continue with original if proxy fails
      console.warn("Proxy failed, continuing with original:", e);
    }
  }

  return {
    filePath,
    previewUrl,
    probe,
    peaks
  };
};

export const pickVideoFile = async (): Promise<string | null> => {
  const sel = await open({
    multiple: false,
    filters: [{ name: "Video", extensions: ["mp4", "mov", "mkv"] }]
  });
  return sel; // null or string, cannot be string[] as multiple == false
};

export const exportVideo = async (filePath: string, cuts: Range[]): Promise<string | null> => {
  const savePath = await save({
    defaultPath: "edited.mp4",
    filters: [{ name: "MP4", extensions: ["mp4"] }]
  });
  if (!savePath) return null;

  await exportCutlist(filePath, savePath as string, cuts);
  return savePath;
};