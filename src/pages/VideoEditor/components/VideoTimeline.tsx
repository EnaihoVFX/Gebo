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
  const [isHovering, setIsHovering] = useState(false);

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

    // Clear canvas with enhanced glassmorphic background matching sidebar style
    const backgroundGradient = ctx.createLinearGradient(0, 0, 0, timelineHeight);
    backgroundGradient.addColorStop(0, "rgba(63, 63, 70, 0.35)"); // Enhanced top opacity
    backgroundGradient.addColorStop(0.5, "rgba(55, 55, 60, 0.30)"); // Mid-tone
    backgroundGradient.addColorStop(1, "rgba(39, 39, 42, 0.25)"); // Enhanced bottom opacity
    ctx.fillStyle = backgroundGradient;
    ctx.fillRect(0, 0, timelineWidth, timelineHeight);
    
    // Add subtle backdrop blur effect simulation
    const blurGradient = ctx.createLinearGradient(0, 0, 0, timelineHeight);
    blurGradient.addColorStop(0, "rgba(255, 255, 255, 0.08)");
    blurGradient.addColorStop(0.5, "rgba(255, 255, 255, 0.03)");
    blurGradient.addColorStop(1, "rgba(255, 255, 255, 0.05)");
    ctx.fillStyle = blurGradient;
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

    // Draw enhanced current time indicator with sophisticated glassmorphic design
    if (currentTime > 0) {
      const x = (currentTime / duration) * timelineWidth;
      
      // No glow effect - clean pointer design
      
      // Main line with enhanced shadow for depth
      ctx.strokeStyle = "rgba(0, 0, 0, 0.5)";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(x + 1, 0);
      ctx.lineTo(x + 1, timelineHeight);
      ctx.stroke();
      
      // Primary indicator line with dynamic styling based on hover state
      const lineOpacity = isHovering ? 1.0 : 0.95;
      const lineWidth = isHovering ? 4 : 3;
      
      ctx.strokeStyle = `rgba(0, 255, 0, ${lineOpacity})`; // Dynamic visibility
      ctx.lineWidth = lineWidth;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, timelineHeight);
      ctx.stroke();
      
      // Add subtle inner highlight for glassmorphic effect
      ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x - 0.5, 0);
      ctx.lineTo(x - 0.5, timelineHeight);
      ctx.stroke();
      
      // Draw SVG-based pointer head (rotated 90 degrees, properly sized and centered)
      const needleIntensity = isHovering ? 1.2 : 1.0;
      const needleScale = 0.06; // Fixed scale, no hover scaling
      const needleY = 8;
      
      // SVG path data (rotated 90 degrees clockwise)
      const svgPath = new Path2D("M395.6 36.5 c-0.7 -1.7 -2.5 -3.6 -4 -4.3 -2.1 -0.9 -32.8 -1.2 -135.7 -1.2 -146.4 0 -137.5 -0.4 -139.8 6.1 -1.7 4.8 -1.5 324.4 0.2 328.1 1.3 3 133.5 113.8 137.3 115.1 1.3 0.5 3.5 0.5 4.8 0 4.1 -1.4 135.3 -111.5 137 -115 1.4 -2.8 1.6 -20.7 1.6 -164.5 -0.1 -131.2 -0.3 -161.9 -1.4 -164.3z");
      
      // Save context for transformation
      ctx.save();
      
      // Transform to position and scale the needle (center it on the line)
      ctx.translate(x, needleY);
      ctx.scale(needleScale, needleScale);
      ctx.translate(-256, -256); // Center the SVG (512x512 viewBox, so center at 256,256)
      
      // Needle gradient
      const needleGradient = ctx.createLinearGradient(0, 0, 0, 512);
      needleGradient.addColorStop(0, `rgba(0, 255, 0, ${0.95 * needleIntensity})`);
      needleGradient.addColorStop(0.3, `rgba(0, 220, 0, ${0.9 * needleIntensity})`);
      needleGradient.addColorStop(0.7, `rgba(0, 180, 0, ${0.85 * needleIntensity})`);
      needleGradient.addColorStop(1, `rgba(0, 150, 0, ${0.8 * needleIntensity})`);
      
      // Draw needle head
      ctx.fillStyle = needleGradient;
      ctx.fill(svgPath);
      
      // Needle border
      ctx.strokeStyle = `rgba(255, 255, 255, ${0.6 * needleIntensity})`;
      ctx.lineWidth = 2;
      ctx.stroke(svgPath);
      
      // Restore context
      ctx.restore();
    }

    // Draw enhanced time markers with sophisticated styling
    const timeInterval = duration / 10; // 10 time markers
    for (let i = 0; i <= 10; i++) {
      const time = i * timeInterval;
      const x = (time / duration) * timelineWidth;
      
      // Enhanced marker styling
      ctx.strokeStyle = "rgba(255, 255, 255, 0.6)"; // Enhanced visibility
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x, timelineHeight - 20);
      ctx.lineTo(x, timelineHeight);
      ctx.stroke();
      
      // Add subtle shadow for depth
      ctx.strokeStyle = "rgba(0, 0, 0, 0.3)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x + 0.5, timelineHeight - 20 + 0.5);
      ctx.lineTo(x + 0.5, timelineHeight + 0.5);
      ctx.stroke();
      
      // Draw enhanced time labels with better typography
      ctx.font = "10px 'SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', monospace";
      
      // Add text shadow for better readability
      ctx.fillStyle = "rgba(0, 0, 0, 0.8)";
      ctx.fillText(formatTime(time), x + 3, timelineHeight - 3);
      
      // Main text with enhanced contrast
      ctx.fillStyle = "rgba(255, 255, 255, 0.9)"; // Enhanced text visibility
      ctx.fillText(formatTime(time), x + 2, timelineHeight - 4);
    }

    // Enhanced border system with multiple layers
    // Outer border with enhanced visibility
    ctx.strokeStyle = "rgba(255, 255, 255, 0.20)"; // Enhanced border visibility
    ctx.lineWidth = 1;
    ctx.strokeRect(0, 0, timelineWidth, timelineHeight);
    
    // Inner highlight for glassmorphic depth
    ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
    ctx.lineWidth = 0.5;
    ctx.strokeRect(0.5, 0.5, timelineWidth - 1, timelineHeight - 1);
    
    // Subtle inner shadow for depth
    ctx.strokeStyle = "rgba(0, 0, 0, 0.15)";
    ctx.lineWidth = 0.5;
    ctx.strokeRect(1, 1, timelineWidth - 2, timelineHeight - 2);
  }, [samples, accepted, preview, duration, timelineWidth, timelineHeight, thumbnails, currentTime, isHovering]);

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
      setIsHovering(true);
    } else {
      setIsHovering(false);
    }
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    // Prevent vertical scrolling on the timeline
    e.preventDefault();
    e.stopPropagation();
  };

  const handleMouseLeave = () => {
    // Clean up hover state when mouse leaves
    setIsHovering(false);
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
          className="cursor-pointer hover:opacity-90 transition-opacity block w-full rounded border border-editor-border-tertiary bg-editor-bg-glass-primary backdrop-blur-xl"
          style={{ height: `${timelineHeight}px`, maxHeight: `${timelineHeight}px` }}
        />
      </div>
    </div>
  );
}
