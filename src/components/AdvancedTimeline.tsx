import { useRef, useEffect, useMemo, useState, useCallback } from "react";
import type { Range } from "../types";
import { generateThumbnails } from "../lib/ffmpeg";

interface AdvancedTimelineProps {
  peaks: number[];
  duration: number;
  accepted: Range[];
  preview: Range[];
  filePath: string;
  width?: number;
  height?: number;
  onSeek?: (t: number) => void;
}

export function AdvancedTimeline({
  peaks, duration, accepted, preview, filePath, width = 1100, height = 250, onSeek,
}: AdvancedTimelineProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [thumbnails, setThumbnails] = useState<string[]>([]);
  const [isGeneratingThumbnails, setIsGeneratingThumbnails] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, pan: 0 });
  const [isZooming, setIsZooming] = useState(false);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [isHoveringRuler, setIsHoveringRuler] = useState(false);
  const zoomTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const zoomAnimationRef = useRef<number | null>(null);
  const thumbnailCache = useRef<Map<string, HTMLImageElement>>(new Map());

  // Generate thumbnails when file path changes
  useEffect(() => {
    if (!filePath || !duration) return;
    
    // Reset timeline state when new file is loaded
    setZoom(1);
    setPan(0);
    setCurrentTime(0);
    
    // Clear thumbnail cache when file changes
    thumbnailCache.current.clear();
    
    setIsGeneratingThumbnails(true);
    // More reasonable thumbnail count based on duration
    // Aim for roughly 1 thumbnail per 1-2 seconds of video for advanced view
    const thumbnailCount = Math.min(50, Math.max(10, Math.floor(duration / 1.5)));
    
    generateThumbnails(filePath, thumbnailCount, 160)
      .then(setThumbnails)
      .catch(console.error)
      .finally(() => setIsGeneratingThumbnails(false));
  }, [filePath, duration]);

  const samples = useMemo(() => {
    if (!peaks?.length) return [];
    
    // Safety checks for zoom values
    const safeZoom = Math.max(0.1, Math.min(10, isFinite(zoom) ? zoom : 1));
    const sampleWidth = Math.floor(width * safeZoom);
    
    // Prevent excessive memory usage
    if (sampleWidth > 50000) {
      console.warn('Sample width too large, capping at 50000:', sampleWidth);
      return [];
    }
    
    const out: number[] = new Array(sampleWidth).fill(0);
    const step = peaks.length / sampleWidth;
    let max = 1;
    
    for (let x = 0; x < sampleWidth; x++) {
      const start = Math.floor(x * step);
      const end = Math.min(peaks.length, Math.floor((x + 1) * step) + 1);
      let m = 0;
      for (let i = start; i < end; i++) {
        if (peaks[i] > m) m = peaks[i];
      }
      out[x] = m; 
      if (m > max) max = m;
    }
    
    return out.map(v => max > 0 ? v / max : 0);
  }, [peaks, width, zoom]);

  // Calculate thumbnail dimensions and segment information - simplified and robust
  const thumbnailDimensions = useMemo(() => {
    if (thumbnails.length === 0 || !duration) return { 
      width: 0, 
      height: 0, 
      count: thumbnails.length, // Always show all thumbnails
      spacing: 0, 
      segmentDuration: 0,
      segmentWidth: 0
    };
    
    // Safety checks
    const safeZoom = Math.max(0.1, Math.min(10, isFinite(zoom) ? zoom : 1));
    
    // Calculate segment information
    const segmentDuration = duration / thumbnails.length; // Duration each thumbnail represents
    const totalTimelineWidth = width * safeZoom; // Total visual width at current zoom
    const segmentWidth = totalTimelineWidth / thumbnails.length; // Visual width of each segment
    
    // Fixed thumbnail dimensions - consistent height, width based on segment
    const thumbnailHeight = height * 0.4; // 40% of timeline height
    const thumbnailWidth = Math.max(20, segmentWidth * 0.8); // 80% of segment width, minimum 20px
    
    return {
      width: thumbnailWidth,
      height: thumbnailHeight,
      count: thumbnails.length, // Show all thumbnails
      spacing: 0, // No spacing - thumbnails touch each other
      segmentDuration: segmentDuration,
      segmentWidth: segmentWidth
    };
  }, [thumbnails.length, width, height, zoom, duration]);

  const formatTime = useCallback((seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 100);
    return `${mins}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
  }, []);

  // Get cached thumbnail or create new one
  const getCachedThumbnail = useCallback((base64Data: string, index: number): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
      const cacheKey = `${filePath}_${index}_${base64Data.slice(0, 20)}`;
      
      // Check if already cached
      if (thumbnailCache.current.has(cacheKey)) {
        const cachedImg = thumbnailCache.current.get(cacheKey)!;
        if (cachedImg.complete && cachedImg.naturalWidth > 0) {
          resolve(cachedImg);
          return;
        }
      }
      
      // Create new image
      const img = new Image();
      img.onload = () => {
        // Cache the loaded image
        thumbnailCache.current.set(cacheKey, img);
        resolve(img);
      };
      img.onerror = () => {
        console.warn(`Failed to load thumbnail ${index}`);
        reject(new Error(`Failed to load thumbnail ${index}`));
      };
      img.src = `data:image/png;base64,${base64Data}`;
    });
  }, [filePath]);

  // Simple and robust thumbnail crop - maintains height, crops width based on zoom
  const calculateThumbnailCrop = useCallback((
    img: HTMLImageElement, 
    segmentPixelWidth: number,
    segmentIndex: number,
    totalSegments: number
  ) => {
    try {
      const imgWidth = img.naturalWidth;
      const imgHeight = img.naturalHeight;
      
      if (imgWidth <= 0 || imgHeight <= 0) {
        return {
          sourceX: 0,
          sourceY: 0,
          sourceWidth: imgWidth,
          sourceHeight: imgHeight
        };
      }

      // Always use full height
      const sourceHeight = imgHeight;
      
      // Calculate crop width to match segment size
      // If segment is very wide, show more of the image
      // If segment is narrow, show less (center crop)
      let cropWidth: number;
      if (segmentPixelWidth >= imgWidth) {
        cropWidth = imgWidth; // Show full width if segment is wide enough
      } else {
        // Crop to segment size, but ensure we don't go below minimum
        cropWidth = Math.max(imgWidth * 0.2, segmentPixelWidth * 2); // At least 20% of image or 2x segment width
        cropWidth = Math.min(cropWidth, imgWidth); // Don't exceed image width
      }
      
      // Calculate position based on segment index
      // Distribute the crop across the image width
      const segmentPosition = segmentIndex / (totalSegments - 1); // 0 to 1
      const maxOffset = imgWidth - cropWidth;
      const sourceX = Math.max(0, Math.min(maxOffset, segmentPosition * maxOffset));
      
      return {
        sourceX: sourceX,
        sourceY: 0,
        sourceWidth: cropWidth,
        sourceHeight: sourceHeight
      };
    } catch (error) {
      console.warn('Error calculating thumbnail crop:', error);
      return {
        sourceX: 0,
        sourceY: 0,
        sourceWidth: img.naturalWidth,
        sourceHeight: img.naturalHeight
      };
    }
  }, []);

  // Robust zoom utility with comprehensive safety checks
  // Smooth zoom animation function
  const animateZoom = useCallback((startZoom: number, endZoom: number, startPan: number, endPan: number, duration: number = 200) => {
    if (zoomAnimationRef.current) {
      cancelAnimationFrame(zoomAnimationRef.current);
    }

    const startTime = performance.now();
    
    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Use easeOutCubic for smooth deceleration
      const easeProgress = 1 - Math.pow(1 - progress, 3);
      
      const currentZoom = startZoom + (endZoom - startZoom) * easeProgress;
      const currentPan = startPan + (endPan - startPan) * easeProgress;
      
      setZoom(currentZoom);
      setPan(currentPan);
      
      if (progress < 1) {
        zoomAnimationRef.current = requestAnimationFrame(animate);
      } else {
        setIsZooming(false);
        zoomAnimationRef.current = null;
      }
    };
    
    setIsZooming(true);
    zoomAnimationRef.current = requestAnimationFrame(animate);
  }, []);

  const safeZoom = useCallback((targetZoom: number, centerX?: number, animated: boolean = true) => {
    try {
      // Validate inputs
      if (!isFinite(targetZoom) || targetZoom <= 0) {
        console.warn('Invalid zoom value:', targetZoom);
        return;
      }

      // Clamp zoom to safe bounds
      const MIN_ZOOM = 0.1;
      const MAX_ZOOM = 10; // 1000% max zoom
      const clampedZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, targetZoom));
      
      // Validate width is available
      if (!width || width <= 0) {
        console.warn('Invalid width for zoom calculation:', width);
        return;
      }

      // Allow infinite panning beyond video duration
      
      // Calculate new pan position
      let newPan = pan;
      if (centerX !== undefined && isFinite(centerX)) {
        // Zoom towards the center point
        const zoomRatio = clampedZoom / zoom;
        newPan = centerX * zoomRatio - width / 2;
      } else {
        // Maintain current view position proportionally
        const zoomRatio = clampedZoom / zoom;
        newPan = pan * zoomRatio;
      }
      
      // Clamp pan to valid range (allow infinite panning beyond video duration)
      newPan = Math.max(0, newPan); // Only prevent negative pan, allow infinite positive pan
      
      // Validate calculated values
      if (!isFinite(newPan) || newPan < 0) {
        console.warn('Invalid pan calculation:', newPan);
        newPan = 0;
      }

      // Clear any existing zoom timeouts
      if (zoomTimeoutRef.current) {
        clearTimeout(zoomTimeoutRef.current);
        zoomTimeoutRef.current = null;
      }

      if (animated && Math.abs(clampedZoom - zoom) > 0.01) {
        // Use smooth animation for significant zoom changes
        animateZoom(zoom, clampedZoom, pan, newPan, 150);
      } else {
        // Immediate update for small changes
        setZoom(clampedZoom);
        setPan(newPan);
        setIsZooming(false);
      }

    } catch (error) {
      console.error('Error in safeZoom:', error);
      // Fallback to safe defaults
      setZoom(1);
      setPan(0);
      setIsZooming(false);
    }
  }, [zoom, pan, width, animateZoom]);

  const drawTimeline = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Prevent rendering issues by checking if canvas is visible
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) {
      return;
    }

    // Validate zoom and pan values before rendering
    if (!isFinite(zoom) || zoom <= 0 || !isFinite(pan) || pan < 0) {
      console.warn('Invalid zoom/pan values, skipping render:', { zoom, pan });
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

    // Calculate visible area based on zoom and pan (for reference)
    // const visibleStart = Math.max(0, pan);
    // const visibleEnd = Math.min(width * zoom, pan + width);

    // Draw time ruler at the top (infinite across entire timeline)
    const timeRulerHeight = height * 0.15; // 15% for time ruler at top
    const waveformHeight = height * 0.3; // 30% for waveform
    const thumbnailAreaHeight = height - timeRulerHeight - waveformHeight;
    
     // Draw infinite time ruler at the top
     // Add subtle background to indicate infinite timeline and scrubbing area
     if (isHoveringRuler || isScrubbing) {
       ctx.fillStyle = "rgba(100, 150, 255, 0.1)"; // Blue tint when hovering/scrubbing
     } else {
       ctx.fillStyle = "rgba(64, 64, 64, 0.2)"; // Default gray
     }
     ctx.fillRect(0, 0, width, timeRulerHeight);
     
     // Add a subtle border to indicate the scrubbing area
     ctx.strokeStyle = isHoveringRuler || isScrubbing ? "rgba(100, 150, 255, 0.5)" : "rgba(100, 100, 100, 0.3)";
     ctx.lineWidth = 1;
     ctx.strokeRect(0, 0, width, timeRulerHeight);
    
    ctx.strokeStyle = "#404040";
    ctx.lineWidth = 1;
    ctx.fillStyle = "#888";
    ctx.font = "10px monospace";
    
    // Calculate time interval based on zoom level for better readability
    // More responsive to zoom - smaller intervals when zoomed in
    if (!duration || duration <= 0) return; // Safety check
    
    const pixelsPerSecond = (width * zoom) / duration;
    let timeInterval;
    
    if (pixelsPerSecond > 100) {
      timeInterval = 0.1; // 100ms intervals when very zoomed in
    } else if (pixelsPerSecond > 50) {
      timeInterval = 0.5; // 500ms intervals when zoomed in
    } else if (pixelsPerSecond > 20) {
      timeInterval = 1; // 1 second intervals
    } else if (pixelsPerSecond > 10) {
      timeInterval = 2; // 2 second intervals
    } else if (pixelsPerSecond > 5) {
      timeInterval = 5; // 5 second intervals
    } else if (pixelsPerSecond > 2) {
      timeInterval = 10; // 10 second intervals
    } else {
      timeInterval = 30; // 30 second intervals when very zoomed out
    }
    
    // Calculate visible time range for performance
    const visibleStartTime = (pan / (width * zoom)) * duration;
    const visibleEndTime = ((pan + width) / (width * zoom)) * duration;
    
    // Extend range beyond visible area for infinite timeline (no negative times)
    const extendedStartTime = Math.max(0, visibleStartTime - timeInterval * 5);
    const extendedEndTime = visibleEndTime + timeInterval * 5;
    
    // Find the first marker time that's >= extendedStartTime
    const firstMarkerTime = Math.floor(extendedStartTime / timeInterval) * timeInterval;
    
    // Draw markers in the extended visible range (infinite beyond video duration)
    for (let time = firstMarkerTime; time <= extendedEndTime; time += timeInterval) {
      // Calculate x position - this allows times beyond video duration
      const x = (time / duration) * (width * zoom) - pan;
      
      // Only draw if marker is in extended visible range to prevent lag
      if (x >= -100 && x < width + 100) {
        // Determine if this is a major marker (every 5th marker, or at 0)
        const majorInterval = timeInterval * 5;
        const isMajorMarker = Math.abs(time % majorInterval) < 0.001 || Math.abs(time) < 0.001;
        
        // Draw markers across entire timeline width (infinite)
        ctx.strokeStyle = isMajorMarker ? "#666" : "#444";
        ctx.lineWidth = isMajorMarker ? 1 : 0.5;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, timeRulerHeight);
        ctx.stroke();
        
        // Only draw text for major markers and if it's in the visible area
        if (isMajorMarker && x >= 0 && x < width - 50) { // Leave some margin for text
          ctx.fillStyle = "#888";
          ctx.fillText(formatTime(time), x + 2, timeRulerHeight - 2);
        }
      }
    }

    // Draw thumbnails - positioned by actual time segments
    if (thumbnails.length > 0) {
      const { height: thumbHeight } = thumbnailDimensions;
      const y = timeRulerHeight + Math.max(0, (thumbnailAreaHeight - thumbHeight) / 2);
      
      // Draw all thumbnails positioned by their actual time segments
      for (let i = 0; i < thumbnails.length; i++) {
        // Calculate the actual time position for this thumbnail
        const segmentStartTime = (i / thumbnails.length) * duration;
        const segmentEndTime = ((i + 1) / thumbnails.length) * duration;
        
        // Convert time positions to pixel positions on the timeline
        const timelineWidth = width * zoom;
        const segmentStartX = (segmentStartTime / duration) * timelineWidth - pan;
        const segmentEndX = (segmentEndTime / duration) * timelineWidth - pan;
        const segmentPixelWidth = segmentEndX - segmentStartX;
        
        // Only draw if thumbnail is visible
        if (segmentEndX > 0 && segmentStartX < width) {
          // Use cached thumbnail to prevent flashing
          getCachedThumbnail(thumbnails[i], i)
            .then(img => {
              // Only draw if canvas is still valid
              if (canvas && ctx) {
                // Calculate crop for this thumbnail based on its segment
                const cropInfo = calculateThumbnailCrop(img, segmentPixelWidth, i, thumbnails.length);
                
                // Use consistent height, crop width to segment size
                const thumbnailHeight = thumbHeight; // Fixed height
                const thumbnailWidth = Math.max(20, segmentPixelWidth); // Width matches segment
                
                // Center the thumbnail in its segment
                const thumbnailX = segmentStartX;
                
                // Draw the cropped thumbnail
                ctx.drawImage(
                  img,
                  cropInfo.sourceX, cropInfo.sourceY, cropInfo.sourceWidth, cropInfo.sourceHeight,
                  thumbnailX, y, thumbnailWidth, thumbnailHeight
                );
                
                // Add border around the segment
                ctx.strokeStyle = "#404040";
                ctx.lineWidth = 1;
                ctx.strokeRect(segmentStartX, y, segmentPixelWidth, thumbnailHeight);
                
                // Add debug info
                if (segmentPixelWidth > 30) {
                  ctx.fillStyle = "#fff";
                  ctx.font = "8px monospace";
                  ctx.fillText(`${i}`, segmentStartX + 2, y + 8);
                  if (segmentPixelWidth > 50) {
                    const cropPercent = Math.round((cropInfo.sourceWidth / img.naturalWidth) * 100);
                    ctx.fillText(`${cropPercent}%`, segmentStartX + 2, y + 16);
                  }
                  if (segmentPixelWidth > 70) {
                    const segmentDuration = duration / thumbnails.length;
                    ctx.fillText(`${segmentDuration.toFixed(1)}s`, segmentStartX + 2, y + 24);
                  }
                }
              }
            })
            .catch(error => {
              console.warn(`Error loading cached thumbnail ${i}:`, error);
            });
        }
      }

      // Draw waveform below thumbnails
      const waveformY = timeRulerHeight + thumbnailAreaHeight;
      const waveformHeight_px = waveformHeight;
      const mid = waveformY + waveformHeight_px / 2;
      
      ctx.fillStyle = "#71717a";
      for (let x = 0; x < samples.length; x++) {
        const canvasX = x - pan;
        if (canvasX >= 0 && canvasX < width) {
          const h = samples[x] * (waveformHeight_px * 0.9) * 0.5;
          ctx.fillRect(canvasX, mid - h, 1, h * 2);
        }
      }

    } else {
      // Fallback: just draw waveform if no thumbnails
      const waveformY = timeRulerHeight;
      const waveformHeight_px = height - timeRulerHeight;
      const mid = waveformY + waveformHeight_px / 2;
      ctx.fillStyle = "#71717a";
      for (let x = 0; x < samples.length; x++) {
        const canvasX = x - pan;
        if (canvasX >= 0 && canvasX < width) {
          const h = samples[x] * (waveformHeight_px * 0.9) * 0.5;
          ctx.fillRect(canvasX, mid - h, 1, h * 2);
        }
      }
    }

    // Draw cut overlays (cover entire timeline height)
    const drawRanges = (ranges: Range[], color: string) => {
      if (!duration || !ranges.length) return;
      ctx.fillStyle = color;
      for (const r of ranges) {
        // Only draw cuts within the video duration
        if (r.start >= 0 && r.end <= duration) {
          const x1 = Math.max(0, Math.min(width, (r.start / duration) * (width * zoom) - pan));
          const x2 = Math.max(0, Math.min(width, (r.end / duration) * (width * zoom) - pan));
          ctx.fillRect(x1, 0, Math.max(1, x2 - x1), height);
        }
      }
    };
    drawRanges(preview, "rgba(245, 158, 11, 0.35)"); // amber-500
    drawRanges(accepted, "rgba(239, 68, 68, 0.35)");  // red-600

    // Draw current time indicator (spans full height)
    if (currentTime >= 0) {
      const x = (currentTime / duration) * (width * zoom) - pan;
      if (x >= 0 && x < width) {
        // Different colors for scrubbing vs normal playback
        ctx.strokeStyle = isScrubbing ? "#ff6b35" : "#00ff00";
        ctx.lineWidth = isScrubbing ? 3 : 2;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
        
        // Add scrub indicator circle at the top
        if (isScrubbing) {
          ctx.fillStyle = "#ff6b35";
          ctx.beginPath();
          ctx.arc(x, 8, 6, 0, 2 * Math.PI);
          ctx.fill();
          
          // Add time label above the scrub cursor
          ctx.fillStyle = "#ff6b35";
          ctx.font = "12px monospace";
          ctx.textAlign = "center";
          ctx.fillText(formatTime(currentTime), x, 20);
          ctx.textAlign = "left"; // Reset alignment
        }
      }
    }

    // Border
    ctx.strokeStyle = "#27272a";
    ctx.lineWidth = 1;
    ctx.strokeRect(0, 0, width, height);
   }, [samples, accepted, preview, duration, width, height, thumbnails, currentTime, zoom, pan, formatTime, thumbnailDimensions, isScrubbing, isHoveringRuler]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      drawTimeline();
    }, 0);
    
    return () => clearTimeout(timeoutId);
  }, [drawTimeline]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Clear any pending zoom operations
      if (zoomTimeoutRef.current) {
        clearTimeout(zoomTimeoutRef.current);
        zoomTimeoutRef.current = null;
      }
      
      // Clear any pending canvas operations
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
      }
      
      // Clear thumbnail cache on unmount
      thumbnailCache.current.clear();
      
      // Cancel any pending zoom animation
      if (zoomAnimationRef.current) {
        cancelAnimationFrame(zoomAnimationRef.current);
        zoomAnimationRef.current = null;
      }
    };
  }, []);

  // Reset zoom when file changes
  useEffect(() => {
    if (filePath && duration) {
      // Reset to safe defaults when new file is loaded
      setZoom(1);
      setPan(0);
      setIsZooming(false);
      if (zoomTimeoutRef.current) {
        clearTimeout(zoomTimeoutRef.current);
        zoomTimeoutRef.current = null;
      }
    }
  }, [filePath, duration]);

  // Add visibility observer to prevent rendering issues when component is off-screen
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          // Component is visible, ensure it's rendered
          requestAnimationFrame(() => {
    drawTimeline();
          });
        }
      });
    }, { threshold: 0.1 });

    observer.observe(canvas);

    return () => {
      observer.disconnect();
    };
  }, [drawTimeline]);

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const t = ((x + pan) / (width * zoom)) * duration;
    setCurrentTime(t);
    onSeek?.(t);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!duration) return;
    
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const t = ((x + pan) / (width * zoom)) * duration;
    
    if (isDragging) {
      // Handle panning during drag (allow infinite panning)
      const deltaX = e.clientX - dragStart.x;
      const newPan = Math.max(0, dragStart.pan - deltaX); // Remove maxPan limit for infinite panning
      setPan(newPan);
    } else if (isScrubbing) {
      // Handle scrubbing - cursor follows mouse and updates time
      setCurrentTime(t);
      onSeek?.(t);
    } else {
      // Handle time preview during hover (only in ruler area)
      const timeRulerHeight = height * 0.15;
      const isInRuler = y <= timeRulerHeight;
      
      setIsHoveringRuler(isInRuler);
      
      if (isInRuler) {
        setCurrentTime(t);
      }
    }
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!duration) return;
    
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const t = ((x + pan) / (width * zoom)) * duration;
    
    // Check if we're in the time ruler area (top 15% of timeline)
    const timeRulerHeight = height * 0.15;
    const isInRuler = y <= timeRulerHeight;
    
    // Check if we're in the timeline area (not on zoom controls)
    if (e.target === e.currentTarget) {
      if (isInRuler) {
        // Start scrubbing mode when clicking in the ruler
        setIsScrubbing(true);
        setCurrentTime(t);
        onSeek?.(t);
      } else {
        // Start panning mode when clicking outside the ruler
        setIsDragging(true);
        setDragStart({ x: e.clientX, pan });
      }
    } else {
      // Start panning mode for zoom controls
      setIsDragging(true);
      setDragStart({ x: e.clientX, pan });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setIsScrubbing(false);
  };

  const handleMouseLeave = () => {
    setIsDragging(false);
    setIsScrubbing(false);
    setIsHoveringRuler(false);
  };


  // Keyboard support for fine scrubbing
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle if timeline is focused or if no other element is focused
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') {
        return;
      }
      
      if (!duration) return;
      
      const fineStep = 0.1; // 100ms steps
      const coarseStep = 1.0; // 1 second steps
      const step = e.shiftKey ? coarseStep : fineStep;
      
      let newTime = currentTime;
      
      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          newTime = Math.max(0, currentTime - step);
          break;
        case 'ArrowRight':
          e.preventDefault();
          newTime = Math.min(duration, currentTime + step);
          break;
        case 'Home':
          e.preventDefault();
          newTime = 0;
          break;
        case 'End':
          e.preventDefault();
          newTime = duration;
          break;
        default:
          return;
      }
      
      if (newTime !== currentTime) {
        setCurrentTime(newTime);
        onSeek?.(newTime);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentTime, duration, onSeek]);

  return (
    <div className="rounded bg-zinc-950 border border-zinc-800 p-2 overflow-x-auto overflow-y-hidden">
      <div className="text-xs mb-2 text-zinc-400 flex items-center justify-between">
        <span>Advanced Video Timeline</span>
        <div className="flex items-center gap-4">
          {isGeneratingThumbnails && (
            <span className="text-amber-400">Generating thumbnails...</span>
          )}
          <div className="flex items-center gap-2">
            <span className="text-zinc-500">Zoom: {Math.round(zoom * 100)}%</span>
          </div>
          <div className="text-zinc-500 text-xs">
            Thumbnails: {thumbnails.length} | 
            Segment: {thumbnailDimensions.segmentDuration.toFixed(1)}s | 
            Timeline: {(width * zoom).toFixed(0)}px | 
            Pixels/sec: {((width * zoom) / duration).toFixed(1)} | 
            Interval: {duration > 0 ? (duration / (width * zoom / 30)).toFixed(1) + 's' : 'N/A'}
          </div>
          <span className="text-zinc-500">
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>
        </div>
      </div>
      
      <div ref={containerRef} className="relative" style={{ height: `${height}px` }}>
        <canvas 
          ref={canvasRef} 
          onClick={handleClick}
          onMouseMove={handleMouseMove}
          onMouseDown={handleMouseDown}
           onMouseUp={handleMouseUp}
           onMouseLeave={handleMouseLeave}
          tabIndex={0}
          className={`${isScrubbing ? 'cursor-grabbing' : 'cursor-grab'} hover:opacity-90 transition-opacity block focus:outline-none focus:ring-2 focus:ring-blue-500`}
          style={{ height: `${height}px`, maxHeight: `${height}px` }}
        />
        
        {/* Zoom controls overlay */}
        <div className="absolute top-2 right-2 flex flex-col gap-1">
          <button
            onClick={() => {
              try {
                const targetZoom = Math.min(10, zoom * 1.15); // Smoother zoom step
                safeZoom(targetZoom, undefined, true); // Use animation
              } catch (error) {
                console.error('Error zooming in:', error);
              }
            }}
            className={`w-6 h-6 bg-zinc-800 text-zinc-200 rounded text-xs hover:bg-zinc-700 ${isZooming ? 'opacity-50' : ''}`}
            title="Zoom In"
            disabled={isZooming}
          >
            +
          </button>
          <button
            onClick={() => {
              try {
                const targetZoom = zoom / 1.15; // Smoother zoom step
                safeZoom(targetZoom, undefined, true); // Use animation
              } catch (error) {
                console.error('Error zooming out:', error);
              }
            }}
            className={`w-6 h-6 bg-zinc-800 text-zinc-200 rounded text-xs hover:bg-zinc-700 ${isZooming ? 'opacity-50' : ''}`}
            title="Zoom Out"
            disabled={isZooming}
          >
            -
          </button>
          <button
            onClick={() => {
              try {
                safeZoom(1, undefined, true); // Reset to 1x zoom with animation
              } catch (error) {
                console.error('Error resetting zoom:', error);
                // Fallback to direct state reset
              setZoom(1);
              setPan(0);
              }
            }}
            className={`w-6 h-6 bg-zinc-800 text-zinc-200 rounded text-xs hover:bg-zinc-700 ${isZooming ? 'opacity-50' : ''}`}
            title="Reset View"
            disabled={isZooming}
          >
            ⌂
          </button>
        </div>
      </div>
      
      <div className="mt-2 text-[11px] text-zinc-400 flex gap-3">
        <span className="inline-flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded-sm" style={{ background: "rgba(239,68,68,0.8)" }}></span> Accepted
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded-sm" style={{ background: "rgba(245,158,11,0.8)" }}></span> Preview
        </span>
         <span className="ml-auto">Click ruler to scrub • Drag timeline to pan • Use +/- buttons to zoom • Arrow keys: fine scrub • Shift+arrows: coarse scrub</span>
      </div>
    </div>
  );
}
