import { useRef, useEffect, useMemo, useState } from "react";
import type { Range } from "../types";
import { generateThumbnails } from "../lib/ffmpeg";

interface VideoTimelineProps {
  peaks: number[];
  duration: number;
  accepted: Range[];
  preview: Range[];
  filePath: string;
  width?: number;
  height?: number;
  onSeek?: (t: number) => void;
}

export function VideoTimeline({
  peaks, duration, accepted, preview, filePath, width = 1100, height = 200, onSeek,
}: VideoTimelineProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [thumbnails, setThumbnails] = useState<string[]>([]);
  const [isGeneratingThumbnails, setIsGeneratingThumbnails] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [isHoveringRuler, setIsHoveringRuler] = useState(false);

  // Generate thumbnails when file path changes
  useEffect(() => {
    if (!filePath || !duration) return;
    
    // Reset timeline state when new file is loaded
    setCurrentTime(0);
    
    setIsGeneratingThumbnails(true);
    // More reasonable thumbnail count based on duration
    // Aim for roughly 1 thumbnail per 2-3 seconds of video
    const thumbnailCount = Math.min(30, Math.max(5, Math.floor(duration / 2.5)));
    
    generateThumbnails(filePath, thumbnailCount, 120)
      .then(setThumbnails)
      .catch(console.error)
      .finally(() => setIsGeneratingThumbnails(false));
  }, [filePath, duration]);

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

  const thumbnailWidth = useMemo(() => {
    return thumbnails.length > 0 ? width / thumbnails.length : 0;
  }, [thumbnails.length, width]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Prevent rendering issues by checking if canvas is visible
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) {
      return;
    }

    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = width + "px";
    canvas.style.height = height + "px";
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Clear canvas
    ctx.fillStyle = "#0a0a0a";
    ctx.fillRect(0, 0, width, height);

    // Draw thumbnails
    if (thumbnails.length > 0) {
      const thumbnailHeight = height * 0.6; // 60% of timeline height for thumbnails
      const waveformHeight = height * 0.4; // 40% for waveform
      
      for (let i = 0; i < thumbnails.length; i++) {
        const x = i * thumbnailWidth;
        try {
          const img = new Image();
          img.onload = () => {
            // Only draw if canvas is still valid
            if (canvas && ctx) {
              ctx.drawImage(img, x, 0, thumbnailWidth, thumbnailHeight);
            }
          };
          img.onerror = () => {
            console.warn(`Failed to load thumbnail ${i}`);
          };
          img.src = `data:image/png;base64,${thumbnails[i]}`;
        } catch (error) {
          console.warn(`Error loading thumbnail ${i}:`, error);
        }
      }

      // Draw waveform below thumbnails
      const waveformY = thumbnailHeight;
      const waveformHeight_px = waveformHeight;
      const mid = waveformY + waveformHeight_px / 2;
      
      ctx.fillStyle = "#71717a";
      for (let x = 0; x < samples.length; x++) {
        const h = samples[x] * (waveformHeight_px * 0.9) * 0.5;
        ctx.fillRect(x, mid - h, 1, h * 2);
      }
    } else {
      // Fallback: just draw waveform if no thumbnails
      const mid = height / 2;
      ctx.fillStyle = "#71717a";
      for (let x = 0; x < samples.length; x++) {
        const h = samples[x] * (height * 0.9) * 0.5;
        ctx.fillRect(x, mid - h, 1, h * 2);
      }
    }

    // Draw cut overlays
    const drawRanges = (ranges: Range[], color: string) => {
      if (!duration || !ranges.length) return;
      ctx.fillStyle = color;
      for (const r of ranges) {
        const x1 = Math.max(0, Math.min(width, (r.start / duration) * width));
        const x2 = Math.max(0, Math.min(width, (r.end / duration) * width));
        ctx.fillRect(x1, 0, Math.max(1, x2 - x1), height);
      }
    };
    drawRanges(preview, "rgba(245, 158, 11, 0.35)"); // amber-500
    drawRanges(accepted, "rgba(239, 68, 68, 0.35)");  // red-600

    // Draw current time indicator
    if (currentTime > 0) {
      const x = (currentTime / duration) * width;
      ctx.strokeStyle = "#00ff00";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }

    // Draw time markers
    ctx.strokeStyle = "#404040";
    ctx.lineWidth = 1;
    const timeInterval = duration / 10; // 10 time markers
    for (let i = 0; i <= 10; i++) {
      const time = i * timeInterval;
      const x = (time / duration) * width;
      ctx.beginPath();
      ctx.moveTo(x, height - 20);
      ctx.lineTo(x, height);
      ctx.stroke();
      
      // Draw time labels
      ctx.fillStyle = "#888";
      ctx.font = "10px monospace";
      ctx.fillText(formatTime(time), x + 2, height - 5);
    }

    // Border
    ctx.strokeStyle = "#27272a";
    ctx.lineWidth = 1;
    ctx.strokeRect(0, 0, width, height);
  }, [samples, accepted, preview, duration, width, height, thumbnails, currentTime]);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const t = (x / rect.width) * duration;
    
    // Only allow scrubbing in the ruler area (top 20% of timeline)
    const rulerHeight = height * 0.2;
    const isInRuler = y <= rulerHeight;
    
    if (isInRuler) {
      setCurrentTime(t);
      onSeek?.(t);
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const t = (x / rect.width) * duration;
    
    // Check if we're in the ruler area (top 20% of timeline)
    const rulerHeight = height * 0.2;
    const isInRuler = y <= rulerHeight;
    
    setIsHoveringRuler(isInRuler);
    
    if (isInRuler) {
      setCurrentTime(t);
    }
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    // Prevent vertical scrolling on the timeline
    e.preventDefault();
    e.stopPropagation();
  };

  const handleMouseLeave = () => {
    setIsHoveringRuler(false);
  };

  return (
    <div className="rounded bg-zinc-950 border border-zinc-800 p-2 overflow-x-auto overflow-y-hidden">
      <div className="text-xs mb-2 text-zinc-400 flex items-center justify-between">
        <span>Video Timeline</span>
        {isGeneratingThumbnails && (
          <span className="text-amber-400">Generating thumbnails...</span>
        )}
        <span className="text-zinc-500">
          {formatTime(currentTime)} / {formatTime(duration)}
        </span>
      </div>
      
      <div style={{ height: `${height}px` }}>
        <canvas 
          ref={canvasRef} 
          onClick={handleClick}
           onMouseMove={handleMouseMove}
           onMouseLeave={handleMouseLeave}
           onWheel={handleWheel}
          className="cursor-pointer hover:opacity-90 transition-opacity block"
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
        <span className="ml-auto">Click to seek • Hover to preview</span>
      </div>
    </div>
  );
}
