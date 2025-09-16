import { useEffect, useRef, useState, useCallback } from "react";
import { audioPeaks } from "../../../../../lib/ffmpeg";
import type { WaveformVisualiserProps } from "../types";

export const WaveformVisualiser: React.FC<WaveformVisualiserProps> = ({
  clip,
  width,
  height,
  startTime,
  endTime,
  zoom,
  pan,
  duration,
  peaks: providedPeaks
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [peaks, setPeaks] = useState<number[]>(providedPeaks || []);
  const [isLoading, setIsLoading] = useState(false);

  // Load audio peaks if not provided
  useEffect(() => {
    if (providedPeaks && providedPeaks.length > 0) {
      setPeaks(providedPeaks);
      return;
    }

    if (!clip.path) return;

    setIsLoading(true);
    audioPeaks(clip.path)
      .then(setPeaks)
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, [clip.path, providedPeaks]);

  // Process peaks for the specific time segment
  const processedPeaks = useCallback(() => {
    if (!peaks.length || !duration) return [];

    // const segmentDuration = endTime - startTime; // Reserved for future duration-based processing
    const startRatio = startTime / duration;
    const endRatio = endTime / duration;
    
    const startIndex = Math.floor(startRatio * peaks.length);
    const endIndex = Math.ceil(endRatio * peaks.length);
    
    const segmentPeaks = peaks.slice(startIndex, endIndex);
    
    // Resample to fit the width
    const targetSamples = Math.floor(width * zoom);
    if (targetSamples >= segmentPeaks.length) {
      return segmentPeaks;
    }
    
    const step = segmentPeaks.length / targetSamples;
    const resampled: number[] = [];
    
    for (let i = 0; i < targetSamples; i++) {
      const start = Math.floor(i * step);
      const end = Math.min(segmentPeaks.length, Math.floor((i + 1) * step));
      
      let max = 0;
      for (let j = start; j < end; j++) {
        if (Math.abs(segmentPeaks[j]) > max) {
          max = Math.abs(segmentPeaks[j]);
        }
      }
      resampled.push(max);
    }
    
    // Normalize
    const maxPeak = Math.max(...resampled);
    return resampled.map(peak => maxPeak > 0 ? peak / maxPeak : 0);
  }, [peaks, startTime, endTime, duration, width, zoom]);

  // Draw waveform
  const drawWaveform = useCallback(() => {
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
    ctx.clearRect(0, 0, width, height);

    const samples = processedPeaks();
    if (!samples.length) return;

    const centerY = height / 2;
    const maxBarHeight = height * 0.8; // Use 80% of height
    
    // Draw waveform bars
    ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
    
    const barWidth = Math.max(1, width / samples.length);
    const barSpacing = Math.max(1, Math.floor(barWidth));
    
    for (let i = 0; i < samples.length; i += barSpacing) {
      const amplitude = samples[i];
      const barHeight = amplitude * maxBarHeight * 0.5; // Only use positive amplitude
      
      const x = (i / samples.length) * width - pan;
      
      // Only draw bars that are visible
      if (x >= -barWidth && x < width + barWidth) {
        const y = centerY - barHeight;
        
        // Draw rounded bar
        ctx.beginPath();
        ctx.roundRect(x, y, Math.max(1, barWidth - 1), barHeight * 2, barWidth / 2);
        ctx.fill();
      }
    }
  }, [width, height, pan, processedPeaks]);

  useEffect(() => {
    drawWaveform();
  }, [drawWaveform]);

  if (isLoading) {
    return (
      <div 
        style={{ width, height }} 
        className="bg-slate-800 flex items-center justify-center text-xs text-slate-400"
      >
        Loading waveform...
      </div>
    );
  }

  return (
    <div style={{ width, height }} className="relative overflow-hidden bg-slate-800">
      <canvas 
        ref={canvasRef}
        className="absolute inset-0"
        style={{ width: '100%', height: '100%' }}
      />
    </div>
  );
};