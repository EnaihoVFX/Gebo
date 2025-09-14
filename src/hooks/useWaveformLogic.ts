import type { Range } from "../types";

export function useWaveformLogic(probe: any, peaks: number[]) {
  const mergeRanges = (rs: Range[], eps = 0.01) => {
    if (!rs.length) return rs;
    const s = [...rs].sort((a, b) => a.start - b.start);
    const out: Range[] = [{ ...s[0] }];
    for (let i = 1; i < s.length; i++) {
      const prev = out[out.length - 1];
      const cur = s[i];
      if (cur.start <= prev.end + eps) prev.end = Math.max(prev.end, cur.end);
      else out.push({ ...cur });
    }
    return out;
  };

  const detectSilences = (minSeconds: number): Range[] => {
    if (!probe || peaks.length === 0) return [];
    const duration = probe.duration;
    const binSec = duration / peaks.length;
    const threshold = 0.15 * Math.max(...peaks, 1); // 15% of max amp
    const out: Range[] = [];
    let start = -1;
    for (let i = 0; i < peaks.length; i++) {
      const silent = peaks[i] < threshold;
      if (silent && start < 0) start = i;
      if ((!silent || i === peaks.length - 1) && start >= 0) {
        const endIdx = silent ? i : i - 1;
        const s = start * binSec;
        const e = (endIdx + 1) * binSec;
        if (e - s >= minSeconds) out.push({ start: s, end: e });
        start = -1;
      }
    }
    return mergeRanges(out);
  };

  const tightenSilences = (minSeconds: number, leaveMs = 150): Range[] => {
    const spans = detectSilences(minSeconds);
    const pad = leaveMs / 1000;
    const cuts = spans.map(r => ({
      start: Math.min(r.end - pad, r.start + pad),
      end: Math.max(r.start + pad, r.end - pad),
    })).filter(c => c.end - c.start > 0.001);
    return mergeRanges(cuts);
  };

  return {
    mergeRanges,
    detectSilences,
    tightenSilences,
  };
}
