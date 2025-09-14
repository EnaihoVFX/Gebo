import { invoke } from "@tauri-apps/api/core";

export type Probe = { 
  duration: number; 
  width: number; 
  height: number; 
  fps: number; 
  audio_rate: number;
  audio_channels: number;
  v_codec: string;
  a_codec: string;
  container: string;
};

export async function probeVideo(path: string): Promise<Probe> {
  return await invoke("probe_video", { path }) as Probe;
}
export async function audioPeaks(path: string): Promise<number[]> {
  return await invoke("audio_peaks", { path }) as number[];
}
export async function exportCutlist(input: string, output: string, ranges: {start:number; end:number}[]) {
  const pairs = ranges.map(r => [r.start, r.end]);
  await invoke("export_cutlist", { input, output, rangesToCut: pairs });
}
export async function makePreviewProxy(path: string): Promise<string> {
  return await invoke("make_preview_proxy", { input: path }) as string;
}
export async function readFileAsBase64(path: string): Promise<string> {
  return await invoke("read_file_as_base64", { path }) as string;
}
export async function copyToAppData(path: string): Promise<string> {
  return await invoke("copy_to_app_data", { path }) as string;
}
export async function readFileChunk(path: string, offset: number, size: number): Promise<number[]> {
  return await invoke("read_file_chunk", { path, offset, size }) as number[];
}
export async function getFileSize(path: string): Promise<number> {
  return await invoke("get_file_size", { path }) as number;
}

export async function generateThumbnails(path: string, count: number, width: number): Promise<string[]> {
  return await invoke("generate_thumbnails", { path, count, width }) as string[];
}
