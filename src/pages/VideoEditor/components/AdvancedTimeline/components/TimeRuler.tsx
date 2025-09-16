import React, { useRef, useEffect, useCallback } from "react";
import { timelineUtils } from "../utils/timelineUtils";

interface TimeRulerProps {
  width: number;
  height: number;
  zoom: number;
  pan: number;
  effectiveDuration: number;
  currentTime: number;
  onSeek?: (time: number) => void;
  onScrubStart?: () => void;
  onScrubEnd?: () => void;
}

export const TimeRuler: React.FC<TimeRulerProps> = ({
  width,
  height,
  zoom,
  pan,
  effectiveDuration,
  currentTime,
  onSeek,
  onScrubStart,
  onScrubEnd
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const drawRuler = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = width + "px";
    canvas.style.height = height + "px";
    
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Draw gradient background
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, "rgba(30, 30, 30, 0.4)");
    gradient.addColorStop(1, "rgba(20, 20, 20, 0.2)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    // Draw border
    ctx.strokeStyle = "rgba(75, 85, 99, 0.4)";
    ctx.lineWidth = 1;
    ctx.strokeRect(0, 0, width, height);

    // Calculate time markers
    const pixelsPerSecond = (width * zoom) / effectiveDuration;
    const timeInterval = timelineUtils.calculateTimeInterval(pixelsPerSecond);
    const majorInterval = timelineUtils.calculateMajorInterval(timeInterval);

    // Calculate visible time range
    const visibleStartTime = (pan / (width * zoom)) * effectiveDuration;
    const visibleEndTime = ((pan + width) / (width * zoom)) * effectiveDuration;
    const extendedStartTime = Math.max(0, visibleStartTime - timeInterval * 5);
    const extendedEndTime = visibleEndTime + timeInterval * 5;
    const firstMarkerTime = Math.floor(extendedStartTime / timeInterval) * timeInterval;

    // Draw time markers
    let lastTextX = -Infinity;
    const minTextSpacing = Math.max(30, Math.min(100, pixelsPerSecond / 10));

    for (let time = firstMarkerTime; time <= extendedEndTime; time += timeInterval) {
      if (!isFinite(time) || time < 0) continue;

      const x = timelineUtils.timeToPixel(time, effectiveDuration, width, zoom, pan);
      if (!isFinite(x) || x < -100 || x > width + 100) continue;

      const isMajorMarker = Math.abs(time % majorInterval) < 0.001 || Math.abs(time) < 0.001;

      if (isMajorMarker) {
        // Major marker
        ctx.strokeStyle = "#9ca3af";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();

        // Add text label
        if (x >= 0 && x < width - 60 && x - lastTextX >= minTextSpacing) {
          ctx.font = "11px 'SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', monospace";
          ctx.textAlign = "left";
          ctx.textBaseline = "top";
          
          const timeText = timelineUtils.formatTime(time);
          const textX = x + 2;
          const textY = 2;
          
          // Text shadow
          ctx.fillStyle = "rgba(0, 0, 0, 0.9)";
          ctx.fillText(timeText, textX + 1, textY + 1);
          
          // Main text
          ctx.fillStyle = "#e5e7eb";
          ctx.fillText(timeText, textX, textY);
          
          lastTextX = textX;
        }
      } else {
        // Minor marker
        ctx.strokeStyle = "rgba(107, 114, 128, 0.4)";
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(x, height * 0.3);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
    }

    // Draw current time indicator (pin marker)
    if (currentTime >= 0) {
      const pinX = timelineUtils.timeToPixel(currentTime, effectiveDuration, width, zoom, pan);
      
      if (pinX >= -50 && pinX < width + 50) {
        // Glow effect
        const glowGradient = ctx.createRadialGradient(pinX, height / 2, 0, pinX, height / 2, 20);
        glowGradient.addColorStop(0, "rgba(255, 107, 53, 0.3)");
        glowGradient.addColorStop(0.5, "rgba(255, 107, 53, 0.1)");
        glowGradient.addColorStop(1, "rgba(255, 107, 53, 0)");
        ctx.fillStyle = glowGradient;
        ctx.fillRect(pinX - 20, 0, 40, height);
        
        // Main line with shadow
        ctx.strokeStyle = "rgba(0, 0, 0, 0.4)";
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(pinX + 1, 0);
        ctx.lineTo(pinX + 1, height);
        ctx.stroke();
        
        ctx.strokeStyle = "#ff6b35";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(pinX, 0);
        ctx.lineTo(pinX, height);
        ctx.stroke();
        
        // Circle indicator
        const circleGradient = ctx.createRadialGradient(pinX, 8, 0, pinX, 8, 8);
        circleGradient.addColorStop(0, "#ff8c5a");
        circleGradient.addColorStop(1, "#ff6b35");
        ctx.fillStyle = circleGradient;
        ctx.beginPath();
        ctx.arc(pinX, 8, 8, 0, 2 * Math.PI);
        ctx.fill();
        
        // White highlight
        ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
        ctx.beginPath();
        ctx.arc(pinX - 2, 6, 3, 0, 2 * Math.PI);
        ctx.fill();
      }
    }
  }, [width, height, zoom, pan, effectiveDuration, currentTime]);

  useEffect(() => {
    drawRuler();
  }, [drawRuler]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0) { // Left click only
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const time = timelineUtils.pixelToTime(x, effectiveDuration, width, zoom, pan);
      
      onSeek?.(Math.max(0, time));
      onScrubStart?.();
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (e.buttons === 1) { // Only if left mouse button is pressed
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const time = timelineUtils.pixelToTime(x, effectiveDuration, width, zoom, pan);
      
      onSeek?.(Math.max(0, time));
    }
  };

  const handleMouseUp = () => {
    onScrubEnd?.();
  };

  return (
    <div style={{ width, height }} className="relative bg-slate-800">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 cursor-ew-resize"
        style={{ width: '100%', height: '100%' }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      />
    </div>
  );
};