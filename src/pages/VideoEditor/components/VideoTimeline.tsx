import { useRef, useEffect, useMemo, useState } from "react";
import type { Range } from "../../../types";
import { generateThumbnails } from "../../../lib/ffmpeg";

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
  peaks, duration, accepted, preview, filePath, width, height, onSeek,
}: VideoTimelineProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [thumbnails, setThumbnails] = useState<string[]>([]);
  const [isGeneratingThumbnails, setIsGeneratingThumbnails] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [zoom, setZoom] = useState(1);

  // Calculate responsive dimensions
  const timelineWidth = width || containerSize.width || 800;
  const timelineHeight = height || Math.max(180, Math.min(280, containerSize.width * 0.25)) || 250;

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
    const out: number[] = new Array(timelineWidth).fill(0);
    const step = peaks.length / timelineWidth;
    let max = 1;
    for (let x = 0; x < timelineWidth; x++) {
      const start = Math.floor(x * step);
      const end = Math.min(peaks.length, Math.floor((x + 1) * step) + 1);
      let m = 0;
      for (let i = start; i < end; i++) if (peaks[i] > m) m = peaks[i];
      out[x] = m; if (m > max) max = m;
    }
    return out.map(v => v / max);
  }, [peaks, timelineWidth]);

  const thumbnailWidth = useMemo(() => {
    return thumbnails.length > 0 ? timelineWidth / thumbnails.length : 0;
  }, [thumbnails.length, timelineWidth]);

  // Resize observer to handle responsive sizing
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateSize = () => {
      const rect = container.getBoundingClientRect();
      setContainerSize({ width: rect.width, height: rect.height });
    };

    // Initial size
    updateSize();

    const resizeObserver = new ResizeObserver(updateSize);
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || timelineWidth === 0 || timelineHeight === 0) return;

    // Prevent rendering issues by checking if canvas is visible
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) {
      return;
    }

    const dpr = window.devicePixelRatio || 1;
    canvas.width = timelineWidth * dpr;
    canvas.height = timelineHeight * dpr;
    canvas.style.width = timelineWidth + "px";
    canvas.style.height = timelineHeight + "px";
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Clear canvas
    ctx.fillStyle = "#0a0a0a"; // editor-bg-canvas
    ctx.fillRect(0, 0, timelineWidth, timelineHeight);

    // Draw thumbnails
    if (thumbnails.length > 0) {
      const thumbnailHeight = timelineHeight * 0.6; // 60% of timeline height for thumbnails
      const waveformHeight = timelineHeight * 0.4; // 40% for waveform
      
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
            // Silently handle thumbnail loading errors
          };
          img.src = `data:image/png;base64,${thumbnails[i]}`;
        } catch (error) {
          // Silently handle thumbnail loading errors
        }
      }

      // Draw waveform below thumbnails
      const waveformY = thumbnailHeight;
      const waveformHeight_px = waveformHeight;
      const mid = waveformY + waveformHeight_px / 2;
      
      ctx.fillStyle = "#71717a"; // editor-timeline-waveform
      for (let x = 0; x < samples.length; x++) {
        const h = samples[x] * (waveformHeight_px * 0.9) * 0.5;
        ctx.fillRect(x, mid - h, 1, h * 2);
      }
    } else {
      // Fallback: just draw waveform if no thumbnails
      const mid = timelineHeight / 2;
      ctx.fillStyle = "#71717a"; // editor-timeline-waveform
      for (let x = 0; x < samples.length; x++) {
        const h = samples[x] * (timelineHeight * 0.9) * 0.5;
        ctx.fillRect(x, mid - h, 1, h * 2);
      }
    }

    // Draw cut overlays
    const drawRanges = (ranges: Range[], color: string) => {
      if (!duration || !ranges.length) return;
      ctx.fillStyle = color;
      for (const r of ranges) {
        const x1 = Math.max(0, Math.min(timelineWidth, (r.start / duration) * timelineWidth));
        const x2 = Math.max(0, Math.min(timelineWidth, (r.end / duration) * timelineWidth));
        ctx.fillRect(x1, 0, Math.max(1, x2 - x1), timelineHeight);
      }
    };
    drawRanges(preview, "rgba(245, 158, 11, 0.35)"); // editor-timeline-cut-preview
    drawRanges(accepted, "rgba(239, 68, 68, 0.35)");  // editor-timeline-cut-accepted

    // Draw current time indicator
    if (currentTime > 0) {
      const x = (currentTime / duration) * timelineWidth;
      ctx.strokeStyle = "#00ff00"; // editor-timeline-indicator-current
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, timelineHeight);
      ctx.stroke();
    }

    // Draw time markers
    ctx.strokeStyle = "#404040"; // editor-border-secondary
    ctx.lineWidth = 1;
    const timeInterval = duration / 10; // 10 time markers
    for (let i = 0; i <= 10; i++) {
      const time = i * timeInterval;
      const x = (time / duration) * timelineWidth;
      ctx.beginPath();
      ctx.moveTo(x, timelineHeight - 20);
      ctx.lineTo(x, timelineHeight);
      ctx.stroke();
      
      // Draw time labels
      ctx.fillStyle = "#888"; // editor-text-muted
      ctx.font = "10px monospace";
      ctx.fillText(formatTime(time), x + 2, timelineHeight - 5);
    }

    // Border
    ctx.strokeStyle = "#27272a"; // editor-border-accent
    ctx.lineWidth = 1;
    ctx.strokeRect(0, 0, timelineWidth, timelineHeight);
  }, [samples, accepted, preview, duration, timelineWidth, timelineHeight, thumbnails, currentTime]);

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
    const rulerHeight = timelineHeight * 0.2;
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
    const rulerHeight = timelineHeight * 0.2;
    const isInRuler = y <= rulerHeight;
    
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
    // Clean up any hover state if needed
  };

  return (
    <div ref={containerRef} className="w-full">
      <div style={{ height: `${timelineHeight}px` }}>
        <canvas 
          ref={canvasRef} 
          onClick={handleClick}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          onWheel={handleWheel}
          className="cursor-pointer hover:opacity-90 transition-opacity block w-full rounded border border-editor-border-primary"
          style={{ height: `${timelineHeight}px`, maxHeight: `${timelineHeight}px` }}
        />
      </div>
    </div>
  );
}
