import type { Probe } from "../../../lib/ffmpeg";
import { detectSilences, tightenSilences, type Range } from "./videoUtils";

export const parseCommand = (command: string, probe: Probe, peaks: number[]): Range[] | null => {
  const q = command.trim().toLowerCase();

  // tighten silence > 2 leave 150ms
  const t = q.match(/tighten\s+silence(?:s)?\s*[>=>]\s*(\d+(?:\.\d+)?)\s*(?:leave\s*(\d+)\s*ms)?/i);
  if (t) {
    const min = parseFloat(t[1]);
    const leave = t[2] ? parseInt(t[2], 10) : 150;
    return tightenSilences(probe, peaks, min, leave);
  }

  // remove/cut silences > 2
  const m = q.match(/(?:remove|cut)\s+silence(?:s)?\s*[>=>]\s*(\d+(?:\.\d+)?)/i);
  if (m) {
    const min = parseFloat(m[1]);
    return detectSilences(probe, peaks, min);
  }

  // manual: cut 12.5 - 14.0
  const r = q.match(/cut\s*(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)/i);
  if (r) {
    const s = parseFloat(r[1]);
    const e = parseFloat(r[2]);
    return [{ start: Math.min(s, e), end: Math.max(s, e) }];
  }

  return null;
};