import { useRef, useEffect, useMemo } from "react";
import type { WaveformCanvasProps } from "../../../types";

export function WaveformCanvas({
  peaks, duration, accepted, preview, width = 1100, height = 160, onSeek,
}: WaveformCanvasProps) {
  const ref = useRef<HTMLCanvasElement>(null);

  const samples = useMemo(() => {
    if (!peaks?.length) return [];
    const out: number[] = new Array(width).fill(0);
    const step = peaks.length / width;
    let max = 1;
    for (let x = 0; x < width; x++) {
      const start = Math.floor(x * step);
      const end = Math.min(peaks.length, Math.floor((x + 1) * step) + 1);
      let m = 0;
      for (let i = start; i < end; i++) if (peaks[i] > m) m = peaks[i];
      out[x] = m; if (m > max) max = m;
    }
    return out.map(v => v / max);
  }, [peaks, width]);

  useEffect(() => {
    const c = ref.current; if (!c) return;
    const dpr = window.devicePixelRatio || 1;
    c.width = width * dpr; c.height = height * dpr;
    c.style.width = width + "px"; c.style.height = height + "px";
    const g = c.getContext("2d")!;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);

    // bg
    g.fillStyle = "#0a0a0a"; g.fillRect(0, 0, width, height);

    // waveform
    const mid = height / 2; g.fillStyle = "#71717a";
    for (let x = 0; x < samples.length; x++) {
      const h = samples[x] * (height * 0.9) * 0.5;
      g.fillRect(x, mid - h, 1, h * 2);
    }

    // overlays: preview (amber), accepted (red)
    const drawRanges = (ranges: any[], color: string) => {
      if (!duration || !ranges.length) return;
      g.fillStyle = color;
      for (const r of ranges) {
        const x1 = Math.max(0, Math.min(width, (r.start / duration) * width));
        const x2 = Math.max(0, Math.min(width, (r.end / duration) * width));
        g.fillRect(x1, 0, Math.max(1, x2 - x1), height);
      }
    };
    drawRanges(preview, "rgba(245, 158, 11, 0.35)"); // amber-500
    drawRanges(accepted, "rgba(239, 68, 68, 0.35)");  // red-600

    // border
    g.strokeStyle = "#27272a"; g.strokeRect(0, 0, width, height);
  }, [samples, accepted, preview, duration, width, height]);

  const onClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const t = (x / rect.width) * duration;
    onSeek?.(t);
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    // Prevent vertical scrolling on the timeline
    e.preventDefault();
    e.stopPropagation();
  };

  return (
    <div className="rounded bg-zinc-950 border border-zinc-800 p-2 overflow-x-auto overflow-y-hidden">
      <div style={{ height: `${height}px` }}>
        <canvas 
          ref={ref} 
          onClick={onClick} 
          onWheel={handleWheel}
          className="block"
          style={{ height: `${height}px`, maxHeight: `${height}px` }}
        />
      </div>
      <div className="mt-2 text-[11px] text-zinc-400 flex gap-3">
        <span className="inline-flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded-sm" style={{ background: "rgba(239,68,68,0.8)" }}></span> Accepted
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded-sm" style={{ background: "rgba(245,158,11,0.8)" }}></span> Preview
        </span>
        <span className="ml-auto">Tip: click the waveform to seek both players</span>
      </div>
    </div>
  );
}
