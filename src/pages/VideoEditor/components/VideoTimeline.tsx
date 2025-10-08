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

    // Clear canvas with glassmorphic background matching other panels
    const backgroundGradient = ctx.createLinearGradient(0, 0, 0, timelineHeight);
    backgroundGradient.addColorStop(0, "rgba(39, 39, 42, 0.25)"); // editor-bg-glass-secondary
    backgroundGradient.addColorStop(0.5, "rgba(39, 39, 42, 0.22)");
    backgroundGradient.addColorStop(1, "rgba(39, 39, 42, 0.20)");
    ctx.fillStyle = backgroundGradient;
    ctx.fillRect(0, 0, timelineWidth, timelineHeight);
    
    // Add subtle overlay gradient for depth
    const overlayGradient = ctx.createLinearGradient(0, 0, 0, timelineHeight);
    overlayGradient.addColorStop(0, "rgba(255, 255, 255, 0.03)");
    overlayGradient.addColorStop(0.5, "rgba(255, 255, 255, 0.015)");
    overlayGradient.addColorStop(1, "rgba(255, 255, 255, 0.02)");
    ctx.fillStyle = overlayGradient;
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

    // Draw enhanced time markers with three-tier visual hierarchy
    const rulerHeight = 20; // Height of ruler area at bottom
    const rulerStartY = timelineHeight - rulerHeight;
    
    // Calculate appropriate time intervals
    const numMajorMarkers = 10;
    const majorInterval = duration / numMajorMarkers;
    const minorInterval = majorInterval / 5; // 5 minor ticks per major interval
    
    // Draw minor markers first (so major markers overlay them)
    for (let time = 0; time <= duration; time += minorInterval) {
      const x = (time / duration) * timelineWidth;
      const isMajor = Math.abs(time % majorInterval) < 0.001;
      
      if (!isMajor) {
        // Minor markers - very short, very light ticks (20% of ruler height)
        const markerHeight = rulerHeight * 0.20;
        ctx.strokeStyle = "rgba(255, 255, 255, 0.20)"; // Much lighter
        ctx.lineWidth = 0.75; // Thinner
        ctx.lineCap = "butt";
        ctx.beginPath();
        ctx.moveTo(x, timelineHeight - markerHeight);
        ctx.lineTo(x, timelineHeight);
        ctx.stroke();
      }
    }
    
    // Draw major markers with labels
    for (let i = 0; i <= numMajorMarkers; i++) {
      const time = i * majorInterval;
      const x = (time / duration) * timelineWidth;
      
      // Major markers - shorter, lighter markers (50% of ruler height)
      const markerHeight = rulerHeight * 0.5;
      const markerStartY = timelineHeight - markerHeight;
      
      ctx.shadowColor = "rgba(0, 0, 0, 0.3)";
      ctx.shadowBlur = 2;
      ctx.shadowOffsetX = 0.5;
      ctx.shadowOffsetY = 0;
      ctx.strokeStyle = "rgba(255, 255, 255, 0.45)"; // Much lighter
      ctx.lineWidth = 1.5; // Thinner
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(x, markerStartY);
      ctx.lineTo(x, timelineHeight);
      ctx.stroke();
      
      // Reset shadow
      ctx.shadowColor = "transparent";
      ctx.shadowBlur = 0;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
      
      // Draw enhanced time labels with modern typography
      if (x < timelineWidth - 60) { // Leave margin for last label
        const fontSize = 11;
        const fontWeight = 600; // Semi-bold
        ctx.font = `${fontWeight} ${fontSize}px -apple-system, BlinkMacSystemFont, 'SF Pro', 'Segoe UI', 'Inter', 'Roboto', system-ui, sans-serif`;
        ctx.textAlign = "left";
        ctx.textBaseline = "top";
        
        const showMs = duration < 60; // Show milliseconds for short videos
        const timeText = formatTime(time, showMs);
        const textY = rulerStartY + 2;
        const textX = x + 3;
        
        // Enhanced shadow with blur for better readability
        ctx.shadowColor = "rgba(0, 0, 0, 0.95)";
        ctx.shadowBlur = 4;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
        ctx.fillStyle = "rgba(0, 0, 0, 0.9)";
        ctx.fillText(timeText, textX + 1, textY + 1);
        
        // Reset shadow
        ctx.shadowColor = "transparent";
        ctx.shadowBlur = 0;
        
        // Secondary shadow for depth
        ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
        ctx.fillText(timeText, textX + 0.5, textY + 0.5);
        
        // Main text with gradient fill
        const textGradient = ctx.createLinearGradient(textX, textY, textX, textY + fontSize);
        textGradient.addColorStop(0, "rgba(255, 255, 255, 1.0)");
        textGradient.addColorStop(0.5, "rgba(245, 245, 250, 1.0)");
        textGradient.addColorStop(1, "rgba(235, 240, 245, 0.98)");
        ctx.fillStyle = textGradient;
        ctx.fillText(timeText, textX, textY);
        
        // Subtle highlight
        ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
        ctx.fillText(timeText, textX - 0.3, textY - 0.3);
      }
    }
    
    // Add refined ruler border for clarity
    ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, rulerStartY);
    ctx.lineTo(timelineWidth, rulerStartY);
    ctx.stroke();
    
    // Add subtle shadow below ruler for depth
    const rulerShadowGradient = ctx.createLinearGradient(0, rulerStartY, 0, rulerStartY + 4);
    rulerShadowGradient.addColorStop(0, "rgba(0, 0, 0, 0.2)");
    rulerShadowGradient.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = rulerShadowGradient;
    ctx.fillRect(0, rulerStartY, timelineWidth, 4);

    // Border system matching other panels
    // Outer border
    ctx.strokeStyle = "rgba(255, 255, 255, 0.10)"; // editor-border-tertiary
    ctx.lineWidth = 1;
    ctx.strokeRect(0, 0, timelineWidth, timelineHeight);
    
    // Inner highlight for subtle depth
    ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";
    ctx.lineWidth = 0.5;
    ctx.strokeRect(0.5, 0.5, timelineWidth - 1, timelineHeight - 1);
  }, [samples, accepted, preview, duration, timelineWidth, timelineHeight, thumbnails, currentTime, isHovering]);

  const formatTime = (seconds: number, showMilliseconds: boolean = false): string => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 100);
    
    if (showMilliseconds) {
      if (hours > 0) {
        return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
      }
      return `${mins}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
    }
    
    if (hours > 0) {
      return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
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
          className="cursor-pointer hover:opacity-90 transition-opacity block w-full rounded-xl border border-editor-border-tertiary bg-editor-bg-glass-secondary backdrop-blur-xl"
          style={{ height: `${timelineHeight}px`, maxHeight: `${timelineHeight}px` }}
        />
      </div>
    </div>
  );
}
