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
