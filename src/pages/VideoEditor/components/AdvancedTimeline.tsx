import { useRef, useEffect, useMemo, useState, useCallback, forwardRef, useImperativeHandle } from "react";
import { flushSync } from "react-dom";
import { Scissors, Trash2, Undo2, Redo2 } from "lucide-react";
import type { Range, Track, Clip, MediaFile } from "../../../types";
import { generateThumbnails } from "../../../lib/ffmpeg";
import { TrackControls } from "./TrackControls";

interface AdvancedTimelineProps {
  peaks: number[];
  duration: number;
  accepted: Range[];
  preview: Range[];
  filePath: string;
  tracks: Track[];
  clips: Clip[];
  mediaFiles: MediaFile[];
  width?: number;
  height?: number;
  onSeek?: (t: number) => void;
  onAddCut?: (range: Range) => void;
  onRemoveCut?: (index: number) => void;
  onUpdateTrack?: (trackId: string, updates: Partial<Track>) => void;
  onAddTrack?: (type: Track['type'], onTrackCreated?: (trackId: string) => void) => void;
  // Cut management props
  onMarkIn?: () => void;
  onClearAllCuts?: () => void;
  // Drag and drop props
  onDropMedia?: (mediaFile: any, trackId: string, offset: number, event?: React.DragEvent, retryCount?: number) => void;
  // Clip management props
  onDeleteClip?: (clipId: string) => void;
  // Undo/Redo props
  onUndo?: () => void;
  onRedo?: () => void;
  historyIndex?: number;
  editHistoryLength?: number;
}

export interface AdvancedTimelineHandle {
  zoomIn: () => void;
  zoomOut: () => void;
  resetZoom: () => void;
  isZooming: boolean;
  zoomLevel: number;
}

export const AdvancedTimeline = forwardRef<AdvancedTimelineHandle, AdvancedTimelineProps>(({
  peaks, duration, accepted, preview, filePath, tracks, clips, mediaFiles, width, height, onSeek, onAddCut, onRemoveCut, onUpdateTrack, onAddTrack, onMarkIn, onClearAllCuts, onDropMedia, onDeleteClip, onUndo, onRedo, historyIndex, editHistoryLength,
}, ref) => {
  // Sort tracks by order to ensure proper positioning
  const sortedTracks = [...tracks].sort((a, b) => a.order - b.order);
  
  // Debug: Log when component renders
  console.log("🔄 AdvancedTimeline rendering with", clips.length, "clips and", sortedTracks.length, "tracks");
  console.log("🔄 Clips data:", clips.map(c => ({ id: c.id, name: c.name, trackId: c.trackId, offset: c.offset, startTime: c.startTime, endTime: c.endTime })));
  console.log("🔄 Tracks data:", sortedTracks.map(t => ({ id: t.id, name: t.name, type: t.type, order: t.order })));
  console.log("🔄 Preview cuts:", preview);
  console.log("🔄 Accepted cuts:", accepted);
  
  // Check for clips with missing tracks
  clips.forEach((clip, index) => {
    const trackExists = sortedTracks.find(track => track.id === clip.trackId);
    if (!trackExists) {
      console.log(`🚨 CLIP ${index} HAS MISSING TRACK!`, {
        clipId: clip.id,
        clipName: clip.name,
        clipTrackId: clip.trackId,
        availableTrackIds: sortedTracks.map(t => t.id)
      });
    }
  });
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [thumbnails, setThumbnails] = useState<string[]>([]);
  const [isGeneratingThumbnails, setIsGeneratingThumbnails] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState(0);
  const [isZooming, setIsZooming] = useState(false);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [isHoveringRuler, setIsHoveringRuler] = useState(false);
  const [isInteractingWithScrollbar, setIsInteractingWithScrollbar] = useState(false);
  const drawTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectionStart, setSelectionStart] = useState<number | null>(null);
  const [selectionEnd, setSelectionEnd] = useState<number | null>(null);
  const [showSelectionPreview, setShowSelectionPreview] = useState(false);
  const [hoveredCutIndex, setHoveredCutIndex] = useState<number | null>(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [isDragOver, setIsDragOver] = useState(false);
  const [currentDragData, setCurrentDragData] = useState<any>(null);
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  const [hoveredClipId, setHoveredClipId] = useState<string | null>(null);
  
  // Type guard for drag data
  const isMediaFileDragData = (data: any): data is { type: "media-file"; mediaFile: { type: "video" | "audio"; [key: string]: any } } => {
    return data && data.type === "media-file" && data.mediaFile && typeof data.mediaFile.type === "string";
  };

  // Helper function to determine if current drag is compatible with any track
  const isDragCompatible = useCallback(() => {
    if (!currentDragData || !isDragOver) return true;
    
    if (isMediaFileDragData(currentDragData)) {
      // Check if there's at least one compatible track
      return sortedTracks.some(track => track.type === currentDragData.mediaFile.type);
    }
    
    return true; // Default to compatible for non-media drags
  }, [currentDragData, isDragOver, sortedTracks]);
  const [forceRedraw, setForceRedraw] = useState(0);
  const [trackScrollOffset, setTrackScrollOffset] = useState(0);
  const trackScrollOffsetRef = useRef(0); // For immediate access during drawing
  const zoomTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const zoomAnimationRef = useRef<number | null>(null);
  const thumbnailCache = useRef<Map<string, HTMLImageElement>>(new Map());

  // Calculate responsive dimensions
  const timelineWidth = width || containerSize.width || 800;
  // Fixed timeline height - use a percentage of viewport height
  const timeRulerHeight = 30; // Keep original time ruler height
  const trackHeight = 50; // Fixed track height for consistency
  const maxVisibleTracks = 7; // Maximum number of tracks visible at once (7 * 50px = 350px)
  const tracksAreaHeight = maxVisibleTracks * trackHeight; // Fixed height for tracks area
  const scrollPadding = 100; // Padding at top and bottom of scroll area
  const timelineHeight = height || timeRulerHeight + tracksAreaHeight + 20 || 400; // Fixed timeline height
  
  // Calculate track positioning for scrolling
  const tracksStartY = timeRulerHeight;
  
  // Calculate total tracks height and scroll limits with padding
  const totalTracksHeight = sortedTracks.length * trackHeight;
  // Add padding at top and bottom, and enable scrolling when we have more tracks than can fit
  const scrollableTracksAreaHeight = (maxVisibleTracks - 1) * trackHeight;
  const maxScrollOffset = Math.max(0, totalTracksHeight - scrollableTracksAreaHeight + (scrollPadding * 2));
  
  // Scroll functions (removed individual up/down functions in favor of slider)
  
  const handleVerticalScroll = (e: React.WheelEvent) => {
    e.preventDefault();
    // Less sensitive scrolling - use even smaller increments for better control
    const scrollDelta = e.deltaY > 0 ? 8 : -8; // Much smaller increments for fine control
    const newOffset = Math.max(0, Math.min(maxScrollOffset, trackScrollOffsetRef.current + scrollDelta));
    
    // Update both state and ref for immediate access
    trackScrollOffsetRef.current = newOffset;
    setTrackScrollOffset(newOffset);
  };
  
  // Function to calculate track Y position based on order (top-down with scroll)
  const getTrackYPosition = useCallback((order: number) => {
    // Find the index of this track in the sorted array
    const trackIndex = sortedTracks.findIndex(track => track.order === order);
    if (trackIndex === -1) {
      console.log(`❌ Track with order ${order} not found in sortedTracks`);
      return tracksStartY;
    }
    
    // Simple top-down positioning: each track is positioned based on its index
    // Video tracks (negative orders) come first, then audio tracks (positive orders)
    // Add top padding so we can scroll above the first track
    // Use ref for immediate access during drawing to prevent sync issues
    const currentScrollOffset = trackScrollOffsetRef.current;
    const trackY = tracksStartY + scrollPadding + (trackIndex * trackHeight) - currentScrollOffset;
    
    console.log(`Track order ${order} -> index ${trackIndex} -> Y position ${trackY} (tracksStartY=${tracksStartY}, scrollPadding=${scrollPadding}, trackHeight=${trackHeight}, currentScrollOffset=${currentScrollOffset})`);
    
    return trackY;
  }, [sortedTracks, tracksStartY, scrollPadding, trackHeight]);

  // Function to find the best track and offset for placing a clip
  const findBestTrackAndOffset = useCallback((mediaType: string, requestedOffset: number, requestedTrackId?: string, mediaFile?: any) => {
    console.log(`=== findBestTrackAndOffset DEBUG ===`);
    console.log(`mediaType: ${mediaType}, requestedOffset: ${requestedOffset}, requestedTrackId: ${requestedTrackId}`);
    
    // Get all tracks of the same type as the media
    const compatibleTracks = sortedTracks.filter(track => track.type === mediaType);
    console.log(`Compatible tracks:`, compatibleTracks.map(t => ({ id: t.id, type: t.type })));
    
    if (compatibleTracks.length === 0) {
      // No compatible tracks exist - need to create a new one
      console.log(`No compatible tracks found, creating new track`);
      return { trackId: null, offset: Math.max(0, requestedOffset), needsNewTrack: true };
    }

    // Calculate clip duration from media file
    const clipDuration = mediaFile ? (mediaFile.duration || 5) : 5; // Default to 5 seconds if no duration
    console.log(`Clip duration: ${clipDuration}`);

    // For ALL tracks, use simple logic: exact placement or create new track (no snapping)
    if (requestedTrackId) {
      console.log(`Checking requested track: ${requestedTrackId}`);
      const requestedTrack = compatibleTracks.find(track => track.id === requestedTrackId);
      if (requestedTrack) {
        console.log(`Found requested track:`, requestedTrack);
        const trackClips = clips.filter(clip => clip.trackId === requestedTrackId);
        console.log(`Existing clips on track:`, trackClips.length);
        
        // Check if the requested position conflicts with existing clips on this track
        let hasConflict = false;
        
        for (const clip of trackClips) {
          const clipStart = clip.offset;
          const clipEnd = clip.offset + (clip.endTime - clip.startTime);
          const newClipStart = requestedOffset;
          const newClipEnd = requestedOffset + clipDuration;
          
          console.log(`Checking clip: start=${clipStart}, end=${clipEnd}, newStart=${newClipStart}, newEnd=${newClipEnd}`);
          
          // Check for overlap
          if ((newClipStart < clipEnd && newClipEnd > clipStart)) {
            console.log(`❌ CONFLICT DETECTED!`);
            hasConflict = true;
            break;
          }
        }
        
        // If no conflict on the requested track, place it exactly where the user dropped it
        if (!hasConflict) {
          console.log(`✅ No conflict, placing on requested track at exact position`);
          return { trackId: requestedTrackId, offset: Math.max(0, requestedOffset), needsNewTrack: false };
        }
        
        // If there is a conflict, create a new track (no snapping to other positions)
        console.log(`❌ Conflict detected, creating new track`);
        return { trackId: null, offset: Math.max(0, requestedOffset), needsNewTrack: true };
      } else {
        console.log(`Requested track ${requestedTrackId} not found in compatible tracks`);
      }
    } else {
      console.log(`No requestedTrackId provided`);
    }

    // If no specific track was requested, create a new track
    return { trackId: null, offset: Math.max(0, requestedOffset), needsNewTrack: true };
  }, [clips, sortedTracks]);

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

  const samples = useMemo(() => {
    if (!peaks?.length) return [];
    
    // Safety checks for zoom values
    const safeZoom = Math.max(0.1, Math.min(10, isFinite(zoom) ? zoom : 1));
    const sampleWidth = Math.floor(timelineWidth * safeZoom);
    
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
  }, [peaks, timelineWidth, zoom]);

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
    const totalTimelineWidth = timelineWidth * safeZoom; // Total visual width at current zoom
    const segmentWidth = totalTimelineWidth / thumbnails.length; // Visual width of each segment
    
    // Fixed thumbnail dimensions - consistent height, width based on segment
    const thumbnailHeight = timelineHeight * 0.4; // 40% of timeline height
    const thumbnailWidth = Math.max(20, segmentWidth * 0.8); // 80% of segment width, minimum 20px
    
    return {
      width: thumbnailWidth,
      height: thumbnailHeight,
      count: thumbnails.length, // Show all thumbnails
      spacing: 0, // No spacing - thumbnails touch each other
      segmentDuration: segmentDuration,
      segmentWidth: segmentWidth
    };
  }, [thumbnails.length, timelineWidth, timelineHeight, zoom, duration]);

  const formatTime = useCallback((seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 100);
    return `${mins}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
  }, []);

  // Calculate effective duration based on main video or clips
  const getEffectiveDuration = useCallback(() => {
    if (duration && duration > 0) {
      return duration;
    }
    
    // If no main video, calculate duration based on clips
    if (clips.length > 0) {
      const maxEndTime = Math.max(...clips.map(clip => clip.offset + (clip.endTime - clip.startTime)));
      return Math.max(60, maxEndTime + 10); // Add 10 seconds buffer, minimum 60 seconds
    }
    
    return 60; // Default fallback
  }, [duration, clips]);


  // Helper function to find clip at coordinates with tolerance
  const findClipAtPosition = useCallback((x: number, y: number, tolerance: number = 5) => {
    const effectiveDuration = getEffectiveDuration();
    
    // Don't detect clips in the ruler area (top time ruler)
    if (y <= timeRulerHeight) {
      return null;
    }
    
    for (const clip of clips) {
      const clipStartX = (clip.offset / effectiveDuration) * (timelineWidth * zoom) - pan;
      const clipEndX = ((clip.offset + (clip.endTime - clip.startTime)) / effectiveDuration) * (timelineWidth * zoom) - pan;
      
      // Find which track this clip belongs to
      const trackIndex = sortedTracks.findIndex(track => track.id === clip.trackId);
      if (trackIndex === -1) continue;
      
      // Calculate track position using center-based positioning
      const track = sortedTracks[trackIndex];
      const trackTopY = track ? getTrackYPosition(track.order) : timeRulerHeight;
      const trackBottomY = trackTopY + trackHeight;
      
      // Only check within the actual clip area (track area only, not ruler)
      const expandedStartX = clipStartX - tolerance;
      const expandedEndX = clipEndX + tolerance;
      const expandedTopY = trackTopY + tolerance;
      const expandedBottomY = trackBottomY - tolerance;
      
      // Check if click is within expanded bounds
      if (x >= expandedStartX && x <= expandedEndX && y >= expandedTopY && y <= expandedBottomY) {
        return clip;
      }
    }
    
    return null;
  }, [clips, tracks, trackHeight, getEffectiveDuration, timelineWidth, zoom, pan, timeRulerHeight]);

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

  // Simple, robust auto-scroll function
  const ensurePinMarkerVisible = useCallback((newCurrentTime: number) => {
    const effectiveDuration = getEffectiveDuration();
    const pinMarkerX = (newCurrentTime / effectiveDuration) * (timelineWidth * zoom) - pan;
    
    // Only auto-scroll when pin marker is actually going off-screen
    const leftEdge = 0;
    const rightEdge = timelineWidth;
    
    let newPan = pan;
    
    // If pin marker is going off the left edge, move it to 20% from left
    if (pinMarkerX < leftEdge) {
      newPan = Math.max(0, (newCurrentTime / effectiveDuration) * (timelineWidth * zoom) - (timelineWidth * 0.2));
    }
    // If pin marker is going off the right edge, move it to 80% from left
    else if (pinMarkerX > rightEdge) {
      newPan = (newCurrentTime / effectiveDuration) * (timelineWidth * zoom) - (timelineWidth * 0.8);
    }
    
    // Only update if we actually need to move
    if (newPan !== pan) {
      setPan(newPan);
    }
  }, [pan, timelineWidth, zoom, getEffectiveDuration]);

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
      if (!timelineWidth || timelineWidth <= 0) {
        console.warn('Invalid width for zoom calculation:', timelineWidth);
        return;
      }

      // Allow infinite panning beyond video duration
      
      // Calculate new pan position
      let newPan = pan;
      if (centerX !== undefined && isFinite(centerX)) {
        // Zoom towards the center point
        const zoomRatio = clampedZoom / zoom;
        newPan = centerX * zoomRatio - timelineWidth / 2;
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
  }, [zoom, pan, timelineWidth, animateZoom]);

  // Expose zoom functions to parent component
  const handleZoomIn = useCallback(() => {
    try {
      const targetZoom = Math.min(10, zoom * 1.15);
      safeZoom(targetZoom, undefined, true);
    } catch (error) {
      console.error('Error zooming in:', error);
    }
  }, [zoom, safeZoom]);

  const handleZoomOut = useCallback(() => {
    try {
      const targetZoom = zoom / 1.15;
      safeZoom(targetZoom, undefined, true);
    } catch (error) {
      console.error('Error zooming out:', error);
    }
  }, [zoom, safeZoom]);

  const handleResetZoom = useCallback(() => {
    try {
      safeZoom(1, undefined, true);
    } catch (error) {
      console.error('Error resetting zoom:', error);
      setZoom(1);
      setPan(0);
    }
  }, [safeZoom]);

  // Expose zoom functions to parent via ref
  useImperativeHandle(ref, () => ({
    zoomIn: handleZoomIn,
    zoomOut: handleZoomOut,
    resetZoom: handleResetZoom,
    isZooming: isZooming,
    zoomLevel: zoom
  }), [handleZoomIn, handleZoomOut, handleResetZoom, isZooming, zoom]);

  // Helper function to draw rounded rectangles (currently unused but kept for future use)
  // const drawRoundedRect = useCallback((ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) => {
  //   ctx.beginPath();
  //   ctx.moveTo(x + radius, y);
  //   ctx.lineTo(x + width - radius, y);
  //   ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  //   ctx.lineTo(x + width, y + height - radius);
  //   ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  //   ctx.lineTo(x + radius, y + height);
  //   ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  //   ctx.lineTo(x, y + radius);
  //   ctx.quadraticCurveTo(x, y, x + radius, y);
  //   ctx.closePath();
  // }, []);

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

    // Additional safety checks
    if (!timelineWidth || timelineWidth <= 0 || !timelineHeight || timelineHeight <= 0) {
      console.warn('Invalid timeline dimensions, skipping render:', { timelineWidth, timelineHeight });
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
    ctx.fillStyle = "#0a0a0a"; // editor.timeline.canvas equivalent
    ctx.fillRect(0, 0, timelineWidth, timelineHeight);

    // Calculate visible area based on zoom and pan (for reference)
    // const visibleStart = Math.max(0, pan);
    // const visibleEnd = Math.min(timelineWidth * zoom, pan + timelineWidth);

    // Calculate waveform and thumbnail dimensions
    const waveformHeight = trackHeight * 0.3; // 30% of track area for waveform
    const thumbnailAreaHeight = trackHeight - waveformHeight; // Remaining for thumbnails
    // Calculate effective duration for timeline operations
    const effectiveDuration = getEffectiveDuration();
    

    // Draw thumbnails container background
    if (thumbnails.length > 0) {
      const { height: thumbHeight } = thumbnailDimensions;
      const y = timeRulerHeight + Math.max(0, (thumbnailAreaHeight - thumbHeight) / 2);
      
      // Draw thumbnail container background
      ctx.fillStyle = "#1e293b"; // slate-800
      ctx.fillRect(0, timeRulerHeight, timelineWidth, thumbnailAreaHeight);
      
      // Draw thumbnail container border
      ctx.strokeStyle = "#334155"; // slate-700
      ctx.lineWidth = 1;
      ctx.strokeRect(0, timeRulerHeight, timelineWidth, thumbnailAreaHeight);
      
      // Draw all thumbnails positioned by their actual time segments
      for (let i = 0; i < thumbnails.length; i++) {
        // Calculate the actual time position for this thumbnail
        const segmentStartTime = (i / thumbnails.length) * duration;
        const segmentEndTime = ((i + 1) / thumbnails.length) * duration;
        
        // Convert time positions to pixel positions on the timeline
        const totalTimelineWidth = timelineWidth * zoom;
        const segmentStartX = (segmentStartTime / duration) * totalTimelineWidth - pan;
        const segmentEndX = (segmentEndTime / duration) * totalTimelineWidth - pan;
        const segmentPixelWidth = segmentEndX - segmentStartX;
        
        // Only draw if thumbnail is visible
        if (segmentEndX > 0 && segmentStartX < timelineWidth) {
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
                ctx.strokeStyle = "#404040"; // editor-border-secondary
                ctx.lineWidth = 1;
                ctx.strokeRect(segmentStartX, y, segmentPixelWidth, thumbnailHeight);
                
                // Add debug info
                if (segmentPixelWidth > 30) {
                  ctx.fillStyle = "#fff"; // editor-text-primary
                  ctx.font = "8px monospace";
                  ctx.fillText(`${i}`, segmentStartX + 2, y + 8);
                  if (segmentPixelWidth > 50) {
                    const cropPercent = Math.round((cropInfo.sourceWidth / img.naturalWidth) * 100);
                    ctx.fillText(`${cropPercent}%`, segmentStartX + 2, y + 16);
                  }
                  if (segmentPixelWidth > 70) {
                    const segmentDuration = duration / thumbnails.length;
                    ctx.fillText(`${segmentDuration.toFixed(1)}s`, segmentStartX + 2, y + thumbHeight + 8);
                  }
                }
              }
            })
            .catch(error => {
              console.warn(`Error loading cached thumbnail ${i}:`, error);
            });
        }
      }

      // Draw waveform container below thumbnails
      const waveformY = timeRulerHeight + thumbnailAreaHeight;
      const waveformHeight_px = waveformHeight;
      const mid = waveformY + waveformHeight_px / 2;
      
      // Draw waveform container background
      ctx.fillStyle = "#0f172a"; // slate-900
      ctx.fillRect(0, waveformY, timelineWidth, waveformHeight_px);
      
      // Draw waveform container border
      ctx.strokeStyle = "#334155"; // slate-700
      ctx.lineWidth = 1;
      ctx.strokeRect(0, waveformY, timelineWidth, waveformHeight_px);
      
      // Draw waveform inside container
      ctx.fillStyle = "#71717a"; // editor-timeline-waveform
      for (let x = 0; x < samples.length; x++) {
        const canvasX = x - pan;
        if (canvasX >= 0 && canvasX < timelineWidth) {
          const h = samples[x] * (waveformHeight_px * 0.9) * 0.5;
          ctx.fillRect(canvasX, mid - h, 1, h * 2);
        }
      }

    } else {
      // Fallback: just draw waveform container if no thumbnails
      const waveformY = timeRulerHeight;
      const waveformHeight_px = timelineHeight - timeRulerHeight;
      const mid = waveformY + waveformHeight_px / 2;
      
      // Draw waveform container background
      ctx.fillStyle = "#0f172a"; // slate-900
      ctx.fillRect(0, waveformY, timelineWidth, waveformHeight_px);
      
      // Draw waveform container border
      ctx.strokeStyle = "#334155"; // slate-700
      ctx.lineWidth = 1;
      ctx.strokeRect(0, waveformY, timelineWidth, waveformHeight_px);
      
      // Draw waveform inside container
      ctx.fillStyle = "#71717a"; // editor-timeline-waveform
      for (let x = 0; x < samples.length; x++) {
        const canvasX = x - pan;
        if (canvasX >= 0 && canvasX < timelineWidth) {
          const h = samples[x] * (waveformHeight_px * 0.9) * 0.5;
          ctx.fillRect(canvasX, mid - h, 1, h * 2);
        }
      }
    }

    // Draw cut overlays (cover entire timeline height)
    const drawRanges = (ranges: Range[], color: string, isHoverable: boolean = false) => {
      if (!ranges.length) return;
      
      for (let i = 0; i < ranges.length; i++) {
        const r = ranges[i];
        // Only draw cuts within the effective duration
        if (r.start >= 0 && r.end <= effectiveDuration) {
          const x1 = Math.max(0, Math.min(timelineWidth, (r.start / effectiveDuration) * (timelineWidth * zoom) - pan));
          const x2 = Math.max(0, Math.min(timelineWidth, (r.end / effectiveDuration) * (timelineWidth * zoom) - pan));
          const cutWidth = Math.max(1, x2 - x1);
          
          // Different opacity for hovered cuts
          const isHovered = isHoverable && hoveredCutIndex === i;
          const alpha = isHovered ? 0.6 : 0.35;
          
          ctx.fillStyle = color.replace('0.35', alpha.toString());
          ctx.fillRect(x1, 0, cutWidth, timelineHeight);
          
          // Add hover indicator
          if (isHovered) {
            ctx.strokeStyle = "#ffffff";
            ctx.lineWidth = 2;
            ctx.strokeRect(x1, 0, cutWidth, timelineHeight);
          }
          
          // Add cut info for accepted cuts
          if (cutWidth > 50 && color.includes("239, 68, 68")) {
            ctx.fillStyle = "#ffffff";
            ctx.font = "10px monospace";
            ctx.fillText(`Cut ${i + 1}`, x1 + 4, 20);
            ctx.fillText(`${r.start.toFixed(1)}s - ${r.end.toFixed(1)}s`, x1 + 4, 35);
          }
        }
      }
    };
    drawRanges(preview, "rgba(245, 158, 11, 0.35)", false); // editor-timeline-cut-preview
    drawRanges(accepted, "rgba(239, 68, 68, 0.35)", true);  // editor-timeline-cut-accepted - hoverable

    // Draw manual selection overlay
    if (showSelectionPreview && selectionStart !== null && selectionEnd !== null) {
      const startX = (selectionStart / effectiveDuration) * (timelineWidth * zoom) - pan;
      const endX = (selectionEnd / effectiveDuration) * (timelineWidth * zoom) - pan;
      const selectionWidth = Math.max(1, endX - startX);
      
      // Draw selection overlay
      ctx.fillStyle = "rgba(59, 130, 246, 0.3)"; // editor-timeline-cut-selection
      ctx.fillRect(startX, 0, selectionWidth, timelineHeight);
      
      // Draw selection border
      ctx.strokeStyle = "#3b82f6"; // editor-status-info
      ctx.lineWidth = 2;
      ctx.strokeRect(startX, 0, selectionWidth, timelineHeight);
      
      // Add selection info
      if (selectionWidth > 60) {
        ctx.fillStyle = "#ffffff"; // editor-text-primary
        ctx.font = "11px monospace";
        ctx.textAlign = "center";
        const centerX = startX + selectionWidth / 2;
        ctx.fillText("New Cut", centerX, 25);
        ctx.fillText(`${selectionStart.toFixed(1)}s - ${selectionEnd.toFixed(1)}s`, centerX, 40);
        ctx.fillText(`Duration: ${(selectionEnd - selectionStart).toFixed(1)}s`, centerX, 55);
        ctx.textAlign = "left";
      }
    }


    // Add "No Video" indicator when no video is loaded AND no clips are present
    if ((!duration || duration <= 0) && clips.length === 0) {
      ctx.fillStyle = "rgba(107, 114, 128, 0.1)"; // Subtle background
      ctx.fillRect(0, timeRulerHeight, timelineWidth, timelineHeight - timeRulerHeight);
      
      // Add "No Video Loaded" text
      ctx.fillStyle = "#6b7280"; // editor-text-muted
      ctx.font = "14px 'SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', monospace";
      ctx.textAlign = "center";
      const centerY = timeRulerHeight + (timelineHeight - timeRulerHeight) / 2;
      ctx.fillText("No Video Loaded", timelineWidth / 2, centerY);
      ctx.textAlign = "left"; // Reset alignment
    }

    // Draw next available position indicator
    const existingClipsOnTrack = clips.filter(clip => clip.trackId === sortedTracks[0].id);
    let nextAvailableOffset = 0;
    
    if (existingClipsOnTrack.length > 0) {
      const latestEndTime = Math.max(...existingClipsOnTrack.map(clip => clip.offset + (clip.endTime - clip.startTime)));
      nextAvailableOffset = latestEndTime;
    }
    
    // Draw a subtle line showing where the next clip will be placed
    if (nextAvailableOffset > 0) {
      const nextPosX = (nextAvailableOffset / effectiveDuration) * (timelineWidth * zoom) - pan;
      if (nextPosX > 0 && nextPosX < timelineWidth) {
        ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
        ctx.lineWidth = 1;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.moveTo(nextPosX, timeRulerHeight);
        ctx.lineTo(nextPosX, timeRulerHeight + trackHeight);
        ctx.stroke();
        ctx.setLineDash([]); // Reset dash pattern
      }
    }

    // Draw track backgrounds with alternating colors for visual differentiation
    sortedTracks.forEach((track) => {
      const trackTopY = getTrackYPosition(track.order);
      const isEvenTrack = track.order % 2 === 0;
      
      // Only draw tracks that are visible in the viewport
      if (trackTopY + trackHeight > timeRulerHeight && trackTopY < timelineHeight) {
        // Draw track background
        ctx.fillStyle = isEvenTrack ? "#1e293b" : "#0f172a"; // slate-800 and slate-900
        ctx.fillRect(0, trackTopY, timelineWidth, trackHeight);
        
        // Draw track border
        ctx.strokeStyle = "#334155"; // slate-700
        ctx.lineWidth = 1;
        ctx.strokeRect(0, trackTopY, timelineWidth, trackHeight);
      }
    });

    // Draw padding areas at top and bottom for auto-track creation
    // Top padding area
    const topPaddingY = tracksStartY;
    const topPaddingHeight = scrollPadding;
    if (topPaddingY + topPaddingHeight > timeRulerHeight && topPaddingY < timelineHeight) {
      ctx.fillStyle = "rgba(51, 65, 85, 0.05)"; // Very subtle background
      ctx.fillRect(0, topPaddingY, timelineWidth, topPaddingHeight);
      
      // Subtle dashed line to indicate drop zone
      ctx.strokeStyle = "rgba(51, 65, 85, 0.2)";
      ctx.lineWidth = 1;
      ctx.setLineDash([8, 8]);
      ctx.beginPath();
      ctx.moveTo(0, topPaddingY + topPaddingHeight / 2);
      ctx.lineTo(timelineWidth, topPaddingY + topPaddingHeight / 2);
      ctx.stroke();
      ctx.setLineDash([]); // Reset dash pattern
    }

    // Bottom padding area (if there are tracks)
    if (sortedTracks.length > 0) {
      const lastTrackY = getTrackYPosition(sortedTracks[sortedTracks.length - 1].order);
      const bottomPaddingY = lastTrackY + trackHeight;
      const bottomPaddingHeight = scrollPadding;
      
      if (bottomPaddingY + bottomPaddingHeight > timeRulerHeight && bottomPaddingY < timelineHeight) {
        ctx.fillStyle = "rgba(51, 65, 85, 0.05)"; // Very subtle background
        ctx.fillRect(0, bottomPaddingY, timelineWidth, bottomPaddingHeight);
        
        // Subtle dashed line to indicate drop zone
        ctx.strokeStyle = "rgba(51, 65, 85, 0.2)";
        ctx.lineWidth = 1;
        ctx.setLineDash([8, 8]);
        ctx.beginPath();
        ctx.moveTo(0, bottomPaddingY + bottomPaddingHeight / 2);
        ctx.lineTo(timelineWidth, bottomPaddingY + bottomPaddingHeight / 2);
        ctx.stroke();
        ctx.setLineDash([]); // Reset dash pattern
      }
    }

    // Draw clips with their own waveforms and thumbnails
    console.log(`=== CLIP RENDERING DEBUG ===`);
    console.log(`Drawing ${clips.length} clips`);
    console.log(`Timeline dimensions: width=${timelineWidth}, height=${timelineHeight}, zoom=${zoom}, pan=${pan}`);
    console.log(`Effective duration: ${effectiveDuration}`);
    console.log(`Available tracks:`, sortedTracks.map(t => ({ id: t.id, name: t.name, type: t.type, order: t.order })));
    
    // TEMPORARY: Draw all clips at the top of the timeline for debugging
    clips.forEach((clip, index) => {
      const clipStartX = (clip.offset / effectiveDuration) * (timelineWidth * zoom) - pan;
      const clipEndX = ((clip.offset + (clip.endTime - clip.startTime)) / effectiveDuration) * (timelineWidth * zoom) - pan;
      const clipWidth = Math.max(1, clipEndX - clipStartX);
      
      if (clipEndX > 0 && clipStartX < timelineWidth) {
        // Draw a small debug indicator at the top of the timeline
        const debugY = 10 + (index * 15); // Stack debug indicators
        ctx.fillStyle = "rgba(255, 0, 0, 0.8)"; // Red for debugging
        ctx.fillRect(clipStartX, debugY, clipWidth, 10);
        ctx.fillStyle = "#ffffff";
        ctx.font = "8px monospace";
        ctx.fillText(`${index}:${clip.name.slice(0, 8)}`, clipStartX + 2, debugY + 8);
      }
    });
    
    clips.forEach((clip, index) => {
      console.log(`--- Drawing clip ${index}: ${clip.name} ---`);
      console.log(`Clip details: offset=${clip.offset}, startTime=${clip.startTime}, endTime=${clip.endTime}, trackId=${clip.trackId}`);
      
      // Find the media file for this clip
      const mediaFile = mediaFiles.find(mf => mf.id === clip.mediaFileId);
      if (!mediaFile) {
        console.log(`Media file not found for clip ${index}, mediaFileId: ${clip.mediaFileId}`);
        console.log(`Available media files:`, mediaFiles.map(mf => ({ id: mf.id, name: mf.name })));
        return;
      }
      
      console.log(`Found media file for clip ${index}: ${mediaFile.name}`);

      const clipStartX = (clip.offset / effectiveDuration) * (timelineWidth * zoom) - pan;
      const clipEndX = ((clip.offset + (clip.endTime - clip.startTime)) / effectiveDuration) * (timelineWidth * zoom) - pan;
      const clipWidth = Math.max(1, clipEndX - clipStartX);
      
      // Find which track this clip belongs to
      const trackIndex = sortedTracks.findIndex(track => track.id === clip.trackId);
      if (trackIndex === -1) {
        console.log(`❌ Track not found for clip ${index}, trackId: ${clip.trackId}`);
        console.log(`❌ Available tracks:`, sortedTracks.map(t => ({ id: t.id, name: t.name, type: t.type, order: t.order })));
        console.log(`❌ Looking for trackId: ${clip.trackId}`);
        console.log(`❌ Clip details:`, { id: clip.id, name: clip.name, trackId: clip.trackId, offset: clip.offset });
        
        // Instead of returning, try to find a compatible track or create a fallback position
        // This handles the race condition where a clip is created before its track is fully added to state
        const mediaFile = mediaFiles.find(mf => mf.id === clip.mediaFileId);
        if (mediaFile) {
          const compatibleTracks = sortedTracks.filter(track => track.type === mediaFile.type);
          if (compatibleTracks.length > 0) {
            // Use the first compatible track as a fallback
            const fallbackTrack = compatibleTracks[0];
            console.log(`🔄 Using fallback track for clip ${index}: ${fallbackTrack.id}`);
            const fallbackTrackIndex = sortedTracks.findIndex(track => track.id === fallbackTrack.id);
            if (fallbackTrackIndex !== -1) {
              const track = sortedTracks[fallbackTrackIndex];
              const trackTopY = getTrackYPosition(track.order);
              console.log(`🔄 Drawing clip ${index} on fallback track at Y position: ${trackTopY}`);
              
              // Draw the clip on the fallback track with a different color to indicate it's misplaced
              if (clipEndX > 0 && clipStartX < timelineWidth) {
                ctx.fillStyle = "rgba(255, 165, 0, 0.6)"; // Orange color to indicate misplaced clip
                ctx.fillRect(clipStartX, trackTopY, clipWidth, trackHeight);
                
                ctx.strokeStyle = "#ffa500"; // Orange border
                ctx.lineWidth = 2;
                ctx.strokeRect(clipStartX, trackTopY, clipWidth, trackHeight);
                
                // Add text to indicate this is a misplaced clip
                ctx.fillStyle = "#ffffff";
                ctx.font = "10px monospace";
                ctx.fillText("?", clipStartX + 4, trackTopY + 15);
              }
            }
          }
        }
        return;
      }
      
      // Calculate track position using center-based positioning
      const track = sortedTracks[trackIndex];
      const trackTopY = track ? getTrackYPosition(track.order) : timeRulerHeight;
      
      console.log(`Clip ${index} positioning: startX=${clipStartX}, endX=${clipEndX}, width=${clipWidth}, trackIndex=${trackIndex}, trackTopY=${trackTopY}`);
      console.log(`Visibility check: clipEndX=${clipEndX} > 0? ${clipEndX > 0}, clipStartX=${clipStartX} < timelineWidth=${timelineWidth}? ${clipStartX < timelineWidth}`);
      
      // Only draw if clip is visible
      if (clipEndX > 0 && clipStartX < timelineWidth) {
        console.log(`✅ Drawing visible clip ${index} at (${clipStartX}, ${trackTopY}) with width ${clipWidth}`);
        
        // Clip background - different colors for selected, hovered, and normal clips
        const isSelected = selectedClipId === clip.id;
        const isHovered = hoveredClipId === clip.id;
        
        if (isSelected) {
          ctx.fillStyle = "rgba(255, 107, 53, 0.8)"; // More opaque orange for selected
        } else if (isHovered) {
          ctx.fillStyle = "rgba(59, 130, 246, 0.8)"; // More opaque blue for hovered
        } else {
          ctx.fillStyle = "rgba(59, 130, 246, 0.6)"; // More opaque normal blue
        }
        
        // Draw rounded rectangle for clip background
        console.log(`🎨 Drawing clip background: x=${clipStartX}, y=${trackTopY}, width=${clipWidth}, height=${trackHeight}, color=${ctx.fillStyle}`);
        
        // Temporarily draw a simple rectangle to test visibility
        ctx.fillRect(clipStartX, trackTopY, clipWidth, trackHeight);
        
        // Original rounded rectangle code (commented out for testing)
        // drawRoundedRect(ctx, clipStartX, trackTopY, clipWidth, trackHeight, clipRadius);
        // ctx.fill();

        // Clip border - different styles for selected, hovered, and normal clips
        if (isSelected) {
          ctx.strokeStyle = "#ff6b35"; // Orange border for selected
          ctx.lineWidth = 4;
        } else if (isHovered) {
          ctx.strokeStyle = "#60a5fa"; // Lighter blue border for hovered
          ctx.lineWidth = 3;
        } else {
          ctx.strokeStyle = "#3b82f6"; // Normal blue border
          ctx.lineWidth = 2;
        }
        
        // Draw rounded rectangle border
        console.log(`🎨 Drawing clip border: x=${clipStartX}, y=${trackTopY}, width=${clipWidth}, height=${trackHeight}, color=${ctx.strokeStyle}, width=${ctx.lineWidth}`);
        
        // Temporarily draw a simple rectangle border to test visibility
        ctx.strokeRect(clipStartX, trackTopY, clipWidth, trackHeight);
        
        // Original rounded rectangle border code (commented out for testing)
        // drawRoundedRect(ctx, clipStartX, trackTopY, clipWidth, trackHeight, clipRadius);
        // ctx.stroke();

        // Draw waveform for this clip (top half only, starting from bottom)
        if (mediaFile.peaks && mediaFile.peaks.length > 0) {
          console.log(`Drawing waveform for clip ${index}: ${mediaFile.peaks.length} peaks, clipWidth: ${clipWidth}`);
          console.log(`First 10 peak values:`, mediaFile.peaks.slice(0, 10));
          console.log(`Max peak value:`, Math.max(...mediaFile.peaks));
          console.log(`Min peak value:`, Math.min(...mediaFile.peaks));
          
          const samplesPerPixel = mediaFile.peaks.length / clipWidth;
          const maxPeak = Math.max(...mediaFile.peaks);
          
          ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
          
          // Calculate waveform area - leave more space at top for thumbnails
          const thumbnailSpace = trackHeight * 0.45; // 45% of track height for thumbnails
          const waveformAreaHeight = trackHeight - thumbnailSpace; // 55% of track height for waveform
          const waveformStartY = trackTopY + trackHeight; // Start from bottom of track
          
          // Draw more bars with rounded corners for finer detail
          const barSpacing = Math.max(1, Math.floor(clipWidth / 600)); // Max 600 bars (more bars = thinner)
          const barWidth = Math.max(1, barSpacing - 1);
          
          for (let x = 0; x < clipWidth; x += barSpacing) {
            const sampleIndex = Math.floor(x * samplesPerPixel);
            if (sampleIndex < mediaFile.peaks.length) {
              const amplitude = mediaFile.peaks[sampleIndex];
              
              // Only use positive amplitude (top half of waveform)
              const positiveAmplitude = Math.abs(amplitude);
              const normalizedAmplitude = maxPeak > 0 ? positiveAmplitude / maxPeak : 0;
              
              // Calculate bar height - use less of the available waveform area
              const maxBarHeight = waveformAreaHeight * 0.7; // Use 70% of available height
              const barHeight = Math.max(2, normalizedAmplitude * maxBarHeight);
              
              // Draw waveform bars starting from bottom
              const barX = clipStartX + x;
              const barY = waveformStartY - barHeight; // Start from bottom, go up
              
              // Create rounded rectangle
              ctx.beginPath();
              ctx.roundRect(barX, barY, barWidth, barHeight, barWidth / 2);
              ctx.fill();
            }
          }
        } else {
          console.log(`No peaks data for clip ${index}:`, mediaFile.peaks);
          // Draw a simple audio icon when no waveform data (positioned lower)
          ctx.fillStyle = "#ffffff";
          ctx.font = "24px Arial, sans-serif";
          ctx.textAlign = "center";
          ctx.fillText("♪", clipStartX + clipWidth / 2, trackTopY + trackHeight * 0.75 + 8);
          ctx.textAlign = "left"; // Reset alignment
        }

        // Draw filmstrip thumbnails for this clip (if it's a video)
        console.log(`Clip ${index} thumbnail check:`, {
          type: mediaFile.type,
          hasThumbnails: !!mediaFile.thumbnails,
          thumbnailCount: mediaFile.thumbnails?.length || 0,
          clipWidth,
          condition: mediaFile.type === 'video' && mediaFile.thumbnails && mediaFile.thumbnails.length > 0 && clipWidth > 100
        });
        
        if (mediaFile.type === 'video' && clipWidth > 100) {
          const thumbnailHeight = Math.min(trackHeight * 0.9, 40); // Back to original size for compact tracks
          
          // Calculate which thumbnails to show based on clip position and duration
          const clipDuration = clip.endTime - clip.startTime;
          const clipStartTime = clip.offset;
          
          // Calculate which thumbnails correspond to this time segment
          const totalDuration = mediaFile.duration;
          const availableThumbnails = mediaFile.thumbnails?.length || 0;
          
          // Calculate how many thumbnails we can fit in the clip width
          // Each thumbnail should represent a time segment, so calculate based on available space
          const thumbnailCount = Math.min(availableThumbnails, Math.floor((clipWidth - 8) / 20)); // Min 20px per thumbnail
          
          // Calculate the actual width each thumbnail should have to fill the segment
          const segmentThumbnailWidth = (clipWidth - 8) / thumbnailCount;
          
          console.log(`Drawing ${thumbnailCount} thumbnails for clip ${index} (${clipDuration.toFixed(2)}s segment), width: ${segmentThumbnailWidth.toFixed(1)}px each`);
          
          // Draw filmstrip thumbnails across the clip
          for (let i = 0; i < thumbnailCount; i++) {
            const thumbX = clipStartX + 4 + (i * segmentThumbnailWidth);
            const thumbY = trackTopY + 4;
            
            // Try to use actual thumbnails if available
            if (mediaFile.thumbnails && mediaFile.thumbnails.length > 0) {
              // Calculate which thumbnail corresponds to this position in the time segment
              const segmentProgress = thumbnailCount > 1 ? i / (thumbnailCount - 1) : 0; // 0 to 1 across the segment
              const segmentTime = clipStartTime + (segmentProgress * clipDuration);
              
              // Map segment time to thumbnail index
              const thumbnailIndex = Math.floor((segmentTime / totalDuration) * mediaFile.thumbnails.length);
              const clampedIndex = Math.max(0, Math.min(mediaFile.thumbnails.length - 1, thumbnailIndex));
              const thumbnailUrl = mediaFile.thumbnails[clampedIndex];
              
              console.log(`Thumbnail ${i}: segmentTime=${segmentTime.toFixed(2)}s, index=${clampedIndex}/${mediaFile.thumbnails.length}`);
              
              // Use cached thumbnail or create new one
              const cacheKey = `clip_${clip.id}_thumb_${i}_${thumbnailUrl}`;
              let img = thumbnailCache.current.get(cacheKey);
              
              if (img && img.complete && img.naturalWidth > 0) {
                // Draw cached thumbnail immediately
                ctx.drawImage(img, thumbX, thumbY, segmentThumbnailWidth, thumbnailHeight);
              } else if (!img) {
                // Create new image only if not cached
                img = new Image();
                img.onload = () => {
                  // Cache the loaded image
                  thumbnailCache.current.set(cacheKey, img!);
                  // Redraw the timeline to show the loaded thumbnail
                  if (canvasRef.current) {
                    drawTimeline();
                  }
                };
                img.onerror = () => {
                  // Draw a placeholder if thumbnail fails to load
                  ctx.fillStyle = "rgba(100, 100, 100, 0.5)";
                  ctx.fillRect(thumbX, thumbY, segmentThumbnailWidth, thumbnailHeight);
                  ctx.fillStyle = "#ffffff";
                  ctx.font = "10px Arial";
                  ctx.textAlign = "center";
                  ctx.fillText("ERR", thumbX + segmentThumbnailWidth / 2, thumbY + thumbnailHeight / 2 + 3);
                  ctx.textAlign = "left";
                };
                img.src = thumbnailUrl;
              }
            } else if (mediaFile.thumbnailUrl) {
              // Fallback: use the single thumbnail and duplicate it
              const fallbackCacheKey = `clip_${clip.id}_fallback_thumb_${i}_${mediaFile.thumbnailUrl}`;
              let fallbackImg = thumbnailCache.current.get(fallbackCacheKey);
              
              if (fallbackImg && fallbackImg.complete && fallbackImg.naturalWidth > 0) {
                // Draw cached fallback thumbnail immediately
                ctx.drawImage(fallbackImg, thumbX, thumbY, segmentThumbnailWidth, thumbnailHeight);
              } else if (!fallbackImg) {
                // Create new fallback image only if not cached
                fallbackImg = new Image();
                fallbackImg.onload = () => {
                  // Cache the loaded fallback image
                  thumbnailCache.current.set(fallbackCacheKey, fallbackImg!);
                  // Redraw the timeline to show the loaded thumbnail
                  if (canvasRef.current) {
                    drawTimeline();
                  }
                };
                fallbackImg.onerror = () => {
                  // Draw a placeholder if thumbnail fails to load
                  ctx.fillStyle = "rgba(100, 100, 100, 0.5)";
                  ctx.fillRect(thumbX, thumbY, segmentThumbnailWidth, thumbnailHeight);
                  ctx.fillStyle = "#ffffff";
                  ctx.font = "10px Arial";
                  ctx.textAlign = "center";
                  ctx.fillText("ERR", thumbX + segmentThumbnailWidth / 2, thumbY + thumbnailHeight / 2 + 3);
                  ctx.textAlign = "left";
                };
                fallbackImg.src = mediaFile.thumbnailUrl;
              }
            } else {
              // Draw test pattern if no thumbnails available
              ctx.fillStyle = `hsl(${(i * 36) % 360}, 70%, 50%)`;
              ctx.fillRect(thumbX, thumbY, segmentThumbnailWidth, thumbnailHeight);
              ctx.fillStyle = "#ffffff";
              ctx.font = "10px Arial";
              ctx.textAlign = "center";
              ctx.fillText(`${i + 1}`, thumbX + segmentThumbnailWidth / 2, thumbY + thumbnailHeight / 2 + 3);
              ctx.textAlign = "left";
            }
          }
        }


        // Clip name and info
        if (clipWidth > 60) {
          // Position text higher up in the clip area
          const textY = trackTopY + trackHeight - 12;
          const textX = clipStartX + 4;
          
          // Add selection indicator
          if (isSelected) {
            ctx.fillStyle = "#ff6b35";
            ctx.font = "10px Arial, sans-serif";
            ctx.textAlign = "left";
            ctx.fillText("●", textX, textY - 2);
          }
          
          // If there's a thumbnail, position text to the right of it
          // const thumbnailWidth = mediaFile.type === 'video' && clipWidth > 80 ? 
          //   Math.min(trackHeight * 0.9, 40) * (mediaFile.width / mediaFile.height) + 8 : 0; // Back to original size
          
          // Duration info in right corner
          if (clipWidth > 60) {
            const duration = (clip.endTime - clip.startTime).toFixed(1);
            ctx.fillStyle = "#ffffff";
            ctx.font = "11px Arial, sans-serif";
            ctx.textAlign = "right";
            ctx.fillText(`${duration}s`, clipStartX + clipWidth - 4, textY);
          }
        }
      } else {
        console.log(`❌ Clip ${index} NOT visible: clipEndX=${clipEndX}, clipStartX=${clipStartX}, timelineWidth=${timelineWidth}`);
      }
    });

    // Draw enhanced current time indicator (spans full height) - always show red pin marker
    // This is drawn after clips to ensure it appears on top of them
    if (currentTime >= 0) {
      const x = (currentTime / effectiveDuration) * (timelineWidth * zoom) - pan;
      // Always draw pin marker, even if slightly outside visible area (auto-scroll will handle positioning)
      if (x >= -50 && x < timelineWidth + 50) {
        // Always use the red pin marker styling (previously scrubbing mode)
        // Draw glow effect
        const glowGradient = ctx.createRadialGradient(x, timeRulerHeight / 2, 0, x, timeRulerHeight / 2, 20);
        glowGradient.addColorStop(0, "rgba(255, 107, 53, 0.3)");
        glowGradient.addColorStop(0.5, "rgba(255, 107, 53, 0.1)");
        glowGradient.addColorStop(1, "rgba(255, 107, 53, 0)");
        ctx.fillStyle = glowGradient;
        ctx.fillRect(x - 20, 0, 40, timeRulerHeight);
        
        // Main line with shadow
        ctx.strokeStyle = "rgba(0, 0, 0, 0.4)";
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(x + 1, 0);
        ctx.lineTo(x + 1, timelineHeight);
        ctx.stroke();
        
        ctx.strokeStyle = "#ff6b35"; // Bright orange/red
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, timelineHeight);
        ctx.stroke();
        
        // Enhanced indicator circle with gradient
        const circleGradient = ctx.createRadialGradient(x, 8, 0, x, 8, 8);
        circleGradient.addColorStop(0, "#ff8c5a");
        circleGradient.addColorStop(1, "#ff6b35");
        ctx.fillStyle = circleGradient;
        ctx.beginPath();
        ctx.arc(x, 8, 8, 0, 2 * Math.PI);
        ctx.fill();
        
        // Add white highlight to circle
        ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
        ctx.beginPath();
        ctx.arc(x - 2, 6, 3, 0, 2 * Math.PI);
        ctx.fill();
        
        // Pin marker without time label or background box
      }
    }

    // Draw time ruler at the top (drawn last so it appears on top of everything)
    // Draw enhanced time ruler at the top with gradient background
    const gradient = ctx.createLinearGradient(0, 0, 0, timeRulerHeight);
    gradient.addColorStop(0, "rgba(30, 30, 30, 0.4)"); // Dark gradient top
    gradient.addColorStop(1, "rgba(20, 20, 20, 0.2)"); // Dark gradient bottom
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, timelineWidth, timeRulerHeight);
    
    // Add enhanced border with better styling
    ctx.strokeStyle = "rgba(75, 85, 99, 0.4)";
    ctx.lineWidth = 1;
    ctx.strokeRect(0, 0, timelineWidth, timeRulerHeight);
    
    // Add subtle inner highlight for depth
    ctx.strokeStyle = "rgba(107, 114, 128, 0.2)";
    ctx.lineWidth = 0.5;
    ctx.strokeRect(0.5, 0.5, timelineWidth - 1, timeRulerHeight - 1);
   
   ctx.strokeStyle = "#404040"; // editor-border-secondary
   ctx.lineWidth = 1;
   ctx.fillStyle = "#888"; // editor-text-muted
   ctx.font = "10px monospace";
   
   // Calculate time interval based on zoom level for better readability
   const pixelsPerSecond = (timelineWidth * zoom) / effectiveDuration;
   let timeInterval;
   
   // Safety check for valid pixelsPerSecond
   if (!isFinite(pixelsPerSecond) || pixelsPerSecond <= 0) {
     timeInterval = 1; // Default to 1 second intervals
   } else if (pixelsPerSecond > 2000) {
     timeInterval = 0.005; // 5ms intervals when extremely zoomed in (2000%+)
   } else if (pixelsPerSecond > 1000) {
     timeInterval = 0.01; // 10ms intervals when extremely zoomed in (1000%+)
   } else if (pixelsPerSecond > 800) {
     timeInterval = 0.02; // 20ms intervals when very zoomed in (800%+)
   } else if (pixelsPerSecond > 600) {
     timeInterval = 0.05; // 50ms intervals when very zoomed in (600%+)
   } else if (pixelsPerSecond > 400) {
     timeInterval = 0.1; // 100ms intervals when zoomed in (400%+)
   } else if (pixelsPerSecond > 300) {
     timeInterval = 0.2; // 200ms intervals when zoomed in (300%+)
   } else if (pixelsPerSecond > 200) {
     timeInterval = 0.5; // 500ms intervals when zoomed in (200%+)
   } else if (pixelsPerSecond > 100) {
     timeInterval = 1; // 1 second intervals (100%+)
   } else if (pixelsPerSecond > 50) {
     timeInterval = 2; // 2 second intervals (50%+)
   } else if (pixelsPerSecond > 20) {
     timeInterval = 5; // 5 second intervals (20%+)
   } else if (pixelsPerSecond > 10) {
     timeInterval = 10; // 10 second intervals (10%+)
   } else if (pixelsPerSecond > 5) {
     timeInterval = 15; // 15 second intervals (5%+)
   } else if (pixelsPerSecond > 2) {
     timeInterval = 30; // 30 second intervals (2%+)
   } else if (pixelsPerSecond > 1) {
     timeInterval = 60; // 60 second intervals (1%+)
   } else {
     timeInterval = 120; // 120 second intervals when very zoomed out (<1%)
   }
   
   // Calculate visible time range for performance
   const visibleStartTime = (pan / (timelineWidth * zoom)) * effectiveDuration;
   const visibleEndTime = ((pan + timelineWidth) / (timelineWidth * zoom)) * effectiveDuration;
   
   // Extend range beyond visible area for infinite timeline (no negative times)
   const extendedStartTime = Math.max(0, visibleStartTime - timeInterval * 5);
   const extendedEndTime = visibleEndTime + timeInterval * 5;
   
   // Find the first marker time that's >= extendedStartTime
   const firstMarkerTime = Math.floor(extendedStartTime / timeInterval) * timeInterval;
   
   // Draw enhanced markers in the extended visible range (infinite beyond video duration)
   let markerCount = 0;
   let majorMarkerCount = 0;
   let lastTextX = -Infinity; // Track last text position to prevent overlapping
   
   // Performance optimization for Tauri: limit markers at extreme zoom levels
   const maxMarkers = pixelsPerSecond > 2000 ? 2000 : pixelsPerSecond > 1000 ? 3000 : pixelsPerSecond > 800 ? 4000 : pixelsPerSecond > 600 ? 5000 : pixelsPerSecond > 400 ? 6000 : pixelsPerSecond > 200 ? 8000 : 10000;
   
   // Adaptive minimum text spacing based on zoom level
   let minTextSpacing;
   if (pixelsPerSecond > 2000) {
     minTextSpacing = 12; // Very tight spacing at extreme zoom (2000%+)
   } else if (pixelsPerSecond > 1000) {
     minTextSpacing = 15; // Very tight spacing at extreme zoom (1000%+)
   } else if (pixelsPerSecond > 800) {
     minTextSpacing = 18; // Tight spacing at high zoom (800%+)
   } else if (pixelsPerSecond > 600) {
     minTextSpacing = 20; // Tight spacing at high zoom (600%+)
   } else if (pixelsPerSecond > 400) {
     minTextSpacing = 22; // Medium spacing at medium-high zoom (400%+)
   } else if (pixelsPerSecond > 200) {
     minTextSpacing = 25; // Medium spacing at medium-high zoom (200%+)
   } else if (pixelsPerSecond > 100) {
     minTextSpacing = 30; // Medium spacing at medium zoom (100%+)
   } else if (pixelsPerSecond > 50) {
     minTextSpacing = 35; // Normal spacing at normal zoom (50%+)
   } else if (pixelsPerSecond > 20) {
     minTextSpacing = 40; // More spacing when zoomed out (20%+)
   } else if (pixelsPerSecond > 10) {
     minTextSpacing = 50; // More spacing when zoomed out (10%+)
   } else if (pixelsPerSecond > 5) {
     minTextSpacing = 60; // More spacing when zoomed out (5%+)
   } else if (pixelsPerSecond > 2) {
     minTextSpacing = 70; // More spacing when zoomed out (2%+)
   } else if (pixelsPerSecond > 1) {
     minTextSpacing = 80; // More spacing when zoomed out (1%+)
   } else {
     minTextSpacing = 90; // Maximum spacing when very zoomed out (<1%)
   }
   
   for (let time = firstMarkerTime; time <= extendedEndTime; time += timeInterval) {
     // Safety check for valid time values
     if (!isFinite(time) || time < 0) continue;
     
     // Calculate x position - this allows times beyond video duration
     const x = (time / effectiveDuration) * (timelineWidth * zoom) - pan;
     
     // Safety check for valid x position
     if (!isFinite(x)) continue;
     
     // Only process markers in extended visible range to prevent lag
     if (x >= -100 && x < timelineWidth + 100) {
       markerCount++;
       
       // Performance check: only limit when we have too many visible markers
       if (markerCount >= maxMarkers) {
         console.warn(`Marker limit reached at ${markerCount} markers, stopping at time ${time.toFixed(3)}s`);
         break;
       }
       // Determine if this is a major marker - simplified and more consistent logic
       let majorInterval;
       
       // Calculate major interval based on time interval and zoom level
       if (timeInterval <= 0.005) {
         majorInterval = 0.1;
       } else if (timeInterval <= 0.01) {
         majorInterval = 0.1;
       } else if (timeInterval <= 0.02) {
         majorInterval = 0.1;
       } else if (timeInterval <= 0.05) {
         majorInterval = 0.2;
       } else if (timeInterval <= 0.1) {
         majorInterval = 0.5;
       } else if (timeInterval <= 0.2) {
         majorInterval = 1.0;
       } else if (timeInterval <= 0.5) {
         majorInterval = 1.0;
       } else if (timeInterval <= 1.0) {
         majorInterval = 1.0;
       } else if (timeInterval <= 2.0) {
         majorInterval = 2.0;
       } else if (timeInterval <= 5.0) {
         majorInterval = 5.0;
       } else if (timeInterval <= 10.0) {
         majorInterval = 10.0;
       } else if (timeInterval <= 15.0) {
         majorInterval = 15.0;
       } else if (timeInterval <= 30.0) {
         majorInterval = 30.0;
       } else if (timeInterval <= 60.0) {
         majorInterval = 60.0;
       } else {
         majorInterval = 120.0;
       }
       
       // Check if this marker should be major (with label)
       const isMajorMarker = Math.abs(time % majorInterval) < 0.001 || Math.abs(time) < 0.001;
       
       // Enhanced marker styling with better visual hierarchy
       if (isMajorMarker) {
         majorMarkerCount++;
         // Major markers - thicker, more prominent
         ctx.strokeStyle = "#9ca3af"; // Gray color for all major markers
         ctx.lineWidth = 1.5;
         ctx.beginPath();
         ctx.moveTo(x, 0);
         ctx.lineTo(x, timeRulerHeight);
         ctx.stroke();
         
         // Add subtle shadow effect for depth
         ctx.strokeStyle = "rgba(0, 0, 0, 0.3)";
         ctx.lineWidth = 1.5;
         ctx.beginPath();
         ctx.moveTo(x + 0.5, 0.5);
         ctx.lineTo(x + 0.5, timeRulerHeight + 0.5);
         ctx.stroke();
         
         // Draw text for major markers with better typography
         if (x >= 0 && x < timelineWidth - 60) { // Leave margin for text
           // Check if we have enough space from the last text to prevent overlapping
           const textX = x + 2;
           if (textX - lastTextX >= minTextSpacing) {
             // Improved text rendering logic - show more labels at high zoom
             let shouldRenderText = true;
             
             // Show more labels at high zoom levels since we're using better intervals
             if (pixelsPerSecond > 1000) {
               // At 1000%+ zoom, show every 2nd label for good density with 0.1s intervals
               shouldRenderText = (majorMarkerCount % 2 === 0);
             } else if (pixelsPerSecond > 500) {
               // At 500%+ zoom, show every marker (all labels) with 0.2s intervals
               shouldRenderText = true;
             } else if (pixelsPerSecond > 200) {
               // At 200%+ zoom, show every marker (all labels)
               shouldRenderText = true;
             } else if (pixelsPerSecond > 100) {
               // At 100%+ zoom, show every marker (all labels)
               shouldRenderText = true;
             }
             
             // Fallback: ensure we always show at least some labels
             // If we haven't shown a label in a while, force show this one
             if (!shouldRenderText && majorMarkerCount > 0 && majorMarkerCount % 5 === 0) {
               shouldRenderText = true;
             }
             
             if (shouldRenderText) {
               // Set font and alignment
               ctx.font = "11px 'SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', monospace";
               ctx.textAlign = "left";
               ctx.textBaseline = "top";
               
               const timeText = formatTime(time);
               
               // Calculate text position more precisely
               const textY = 2; // Start from top of ruler
               
               // Add text shadow for better readability
               ctx.fillStyle = "rgba(0, 0, 0, 0.9)";
               ctx.fillText(timeText, textX + 1, textY + 1);
               
               // Draw the actual text with high contrast
               ctx.fillStyle = "#e5e7eb";
               ctx.fillText(timeText, textX, textY);
               
               // Update last text position
               lastTextX = textX;
             }
           }
         }
       } else {
         // Minor markers - thinner, less prominent
         ctx.strokeStyle = "rgba(107, 114, 128, 0.4)";
         ctx.lineWidth = 0.8;
         ctx.beginPath();
         ctx.moveTo(x, timeRulerHeight * 0.3); // Start from 30% height
         ctx.lineTo(x, timeRulerHeight);
         ctx.stroke();
       }
      }
    }

    // Border
    ctx.strokeStyle = "#27272a"; // editor-border-accent
    ctx.lineWidth = 1;
    ctx.strokeRect(0, 0, timelineWidth, timelineHeight);
   }, [samples, accepted, preview, duration, timelineWidth, timelineHeight, thumbnails, currentTime, zoom, pan, formatTime, thumbnailDimensions, isScrubbing, isHoveringRuler, clips, tracks, trackHeight, scrollPadding, timeRulerHeight, getTrackYPosition]);

  // Immediate drawing for scroll changes to prevent lag
  useEffect(() => {
    const frameId = requestAnimationFrame(() => {
      drawTimeline();
    });
    
    return () => cancelAnimationFrame(frameId);
  }, [trackScrollOffset]); // Immediate for scroll changes

  useEffect(() => {
    // Debounced drawing for other changes (Tauri performance)
    if (drawTimeoutRef.current) {
      clearTimeout(drawTimeoutRef.current);
    }
    
    drawTimeoutRef.current = setTimeout(() => {
      const frameId = requestAnimationFrame(() => {
        drawTimeline();
      });
      
      return () => cancelAnimationFrame(frameId);
    }, 16); // ~60fps debounce
    
    return () => {
      if (drawTimeoutRef.current) {
        clearTimeout(drawTimeoutRef.current);
      }
    };
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

  // Clear selection when clips change (e.g., when a clip is deleted)
  useEffect(() => {
    if (selectedClipId && !clips.find(clip => clip.id === selectedClipId)) {
      setSelectedClipId(null);
    }
  }, [clips, selectedClipId]);

  // Note: Removed pan constraint to allow infinite panning

  // Effect to handle global mouse up for scrollbar interaction
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (isInteractingWithScrollbar) {
        console.log('Global mouse up - ending scrollbar interaction');
        setIsInteractingWithScrollbar(false);
      }
    };

    if (isInteractingWithScrollbar) {
      document.addEventListener('mouseup', handleGlobalMouseUp);
      return () => document.removeEventListener('mouseup', handleGlobalMouseUp);
    }
  }, [isInteractingWithScrollbar]);

  // Redraw timeline when selection changes or force redraw is triggered
  useEffect(() => {
    drawTimeline();
  }, [selectedClipId, forceRedraw, drawTimeline]);

  // Force redraw when tracks change to ensure clips are properly rendered
  useEffect(() => {
    console.log("🔄 Tracks changed, forcing redraw");
    setForceRedraw(prev => prev + 1);
  }, [tracks.length, sortedTracks.map(t => t.id).join(',')]);

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

  // Add comprehensive drag and drop debugging
  useEffect(() => {
    const handleGlobalDragStart = (e: DragEvent) => {
      console.log("Global drag start event detected on:", e.target);
      console.log("Global drag start dataTransfer types:", Array.from(e.dataTransfer?.types || []));
    };

    const handleGlobalDragOver = (e: DragEvent) => {
      console.log("Global drag over event detected on:", e.target);
      console.log("Global drag over dataTransfer types:", Array.from(e.dataTransfer?.types || []));
      console.log("Global drag over clientX:", e.clientX, "clientY:", e.clientY);
      e.preventDefault(); // Important: prevent default to allow drop
    };
    
    const handleGlobalDrop = (e: DragEvent) => {
      console.log("Global drop event detected on:", e.target);
      console.log("Global drop dataTransfer types:", Array.from(e.dataTransfer?.types || []));
      console.log("Global drop clientX:", e.clientX, "clientY:", e.clientY);
      e.preventDefault(); // Important: prevent default
    };

    const handleGlobalDragEnter = (e: DragEvent) => {
      console.log("Global drag enter event detected on:", e.target);
      console.log("Global drag enter clientX:", e.clientX, "clientY:", e.clientY);
      e.preventDefault(); // Important: prevent default
    };

    const handleGlobalDragLeave = (e: DragEvent) => {
      console.log("Global drag leave event detected on:", e.target);
    };

    const handleGlobalDragEnd = (e: DragEvent) => {
      console.log("Global drag end event detected on:", e.target);
    };

    // Add event listeners with capture phase to catch events early
    document.addEventListener('dragstart', handleGlobalDragStart, true);
    document.addEventListener('dragover', handleGlobalDragOver, true);
    document.addEventListener('drop', handleGlobalDrop, true);
    document.addEventListener('dragenter', handleGlobalDragEnter, true);
    document.addEventListener('dragleave', handleGlobalDragLeave, true);
    document.addEventListener('dragend', handleGlobalDragEnd, true);

    return () => {
      document.removeEventListener('dragstart', handleGlobalDragStart, true);
      document.removeEventListener('dragover', handleGlobalDragOver, true);
      document.removeEventListener('drop', handleGlobalDrop, true);
      document.removeEventListener('dragenter', handleGlobalDragEnter, true);
      document.removeEventListener('dragleave', handleGlobalDragLeave, true);
      document.removeEventListener('dragend', handleGlobalDragEnd, true);
    };
  }, []);

  // Custom drag and drop using mouse events
  const [isCustomDragging, setIsCustomDragging] = useState(false);
  const [customDragData, setCustomDragData] = useState<any>(null);
  
  console.log("🔄 AdvancedTimeline: isCustomDragging =", isCustomDragging);
  console.log("🔄 AdvancedTimeline: customDragData =", customDragData);

  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      // Check if we're over the timeline
      const timelineElement = document.querySelector('[data-timeline="true"]');
      if (timelineElement) {
        const rect = timelineElement.getBoundingClientRect();
        const isOverTimeline = e.clientX >= rect.left && e.clientX <= rect.right && 
                              e.clientY >= rect.top && e.clientY <= rect.bottom;
        
        if (isOverTimeline) {
          console.log("Mouse over timeline during custom drag");
          setIsCustomDragging(true);
        } else {
          setIsCustomDragging(false);
        }
      }
    };

    const handleGlobalMouseUp = (e: MouseEvent) => {
      if (customDragData) {
        console.log("Custom drag ended, checking for drop");
        
        // Check if we're over the timeline
        const timelineElement = document.querySelector('[data-timeline="true"]');
        if (timelineElement) {
          const rect = timelineElement.getBoundingClientRect();
          const isOverTimeline = e.clientX >= rect.left && e.clientX <= rect.right && 
                                e.clientY >= rect.top && e.clientY <= rect.bottom;
          
          if (isOverTimeline) {
            console.log("Custom drop on timeline");
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            console.log(`Custom drop position: x=${x}, y=${y}`);
            
            if (customDragData.type === "media-file" && customDragData.mediaFile && onDropMedia) {
              // Calculate which track the drop position corresponds to
              let targetTrack: Track | null = null;
              let minDistance = Infinity;
              
              // Find the closest COMPATIBLE track to the drop position
              const compatibleTracks = sortedTracks.filter(track => track.type === customDragData.mediaFile.type);
              for (const track of compatibleTracks) {
                const trackY = getTrackYPosition(track.order);
                const distance = Math.abs(y - (trackY + trackHeight / 2)); // Distance to track center
                if (distance < minDistance) {
                  minDistance = distance;
                  targetTrack = track;
                }
              }
              
              console.log(`Target track: ${targetTrack?.id}, distance: ${minDistance}`);
              
              if (targetTrack) {
                const effectiveDuration = getEffectiveDuration();
                const requestedOffset = ((x + pan) / (timelineWidth * zoom)) * effectiveDuration;
                
                // Find the best track and offset for this media
                const result = findBestTrackAndOffset(customDragData.mediaFile.type, requestedOffset, targetTrack.id, customDragData.mediaFile);
                
                if (result.needsNewTrack) {
                  // Create a new track first, then drop the media
                  console.log(`No available ${customDragData.mediaFile.type} tracks, creating new one`);
                  if (onAddTrack) {
                    onAddTrack(customDragData.mediaFile.type, (newTrackId) => {
                      // Drop the media on the newly created track
                      console.log("🚀 CALLBACK EXECUTED! Dropping media on newly created track:", newTrackId);
                      console.log("🚀 Media file:", customDragData.mediaFile);
                      console.log("🚀 Offset:", result.offset);
                      console.log("🚀 Available tracks at callback time:", sortedTracks.map(t => ({ id: t.id, name: t.name, type: t.type })));
                      onDropMedia(customDragData.mediaFile, newTrackId, result.offset, e as any);
                    });
                  }
                } else {
                  console.log(`Custom dropping on track: ${result.trackId}, requested offset: ${requestedOffset}, final offset: ${result.offset}`);
                  onDropMedia(customDragData.mediaFile, result.trackId!, result.offset, e as any);
                }
              } else {
                console.log(`No valid track found`);
                // Try to drop on the first available track as fallback
                if (sortedTracks.length > 0) {
                  const fallbackTrack = sortedTracks[0];
                  const effectiveDuration = getEffectiveDuration();
                  const requestedOffset = ((x + pan) / (timelineWidth * zoom)) * effectiveDuration;
                  
                  // Find the best track and offset for this media
                  const result = findBestTrackAndOffset(customDragData.mediaFile.type, requestedOffset, fallbackTrack.id, customDragData.mediaFile);
                  
                  if (result.needsNewTrack) {
                    // Create a new track first, then drop the media
                    console.log(`No available ${customDragData.mediaFile.type} tracks, creating new one`);
                    if (onAddTrack) {
                      onAddTrack(customDragData.mediaFile.type);
                      // Don't drop immediately - let the user drop again on the new track
                      // This prevents overlaying on the existing track
                      console.log(`New track created, please drop the media again on the new track`);
                    }
                  } else {
                    console.log(`Falling back to track: ${result.trackId}, requested offset: ${requestedOffset}, final offset: ${result.offset}`);
                    onDropMedia(customDragData.mediaFile, result.trackId!, result.offset, e as any);
                  }
                }
              }
            }
          } else {
            console.log("Custom drag ended outside timeline - no drop");
          }
        }
        
        setIsCustomDragging(false);
        setCustomDragData(null);
      }
    };

    // Listen for custom drag data from MediaGrid
    const handleCustomDragStart = (e: CustomEvent) => {
      console.log("🎯 === TIMELINE DRAG START RECEIVED ===");
      console.log("🎯 Custom drag start received:", e.detail);
      console.log("🎯 Event detail type:", typeof e.detail);
      console.log("🎯 Event detail keys:", Object.keys(e.detail || {}));
      setCustomDragData(e.detail);
      setIsCustomDragging(true);
      console.log("🎯 Set isCustomDragging to true");
    };

    const handleCustomDragEnd = (e: CustomEvent) => {
      console.log("🎯 === TIMELINE DRAG END RECEIVED ===");
      console.log("🎯 Custom drag end received:", e.detail);
      console.log("🎯 Current customDragData:", customDragData);
      console.log("🎯 Current isCustomDragging:", isCustomDragging);
      
      // Handle the drop when drag ends
      if (customDragData) {
        console.log("🎯 Custom drag ended, checking for drop");
        
        // Check if we're over the timeline using the mouse position from the event
        const timelineElement = document.querySelector('[data-timeline="true"]');
        if (timelineElement) {
          const rect = timelineElement.getBoundingClientRect();
          const clientX = e.detail?.clientX || 0;
          const clientY = e.detail?.clientY || 0;
          const isOverTimeline = clientX >= rect.left && clientX <= rect.right && 
                                clientY >= rect.top && clientY <= rect.bottom;
          
          if (isOverTimeline) {
            console.log("Custom drop on timeline");
            const x = clientX - rect.left;
            const y = clientY - rect.top;
            
            console.log(`Custom drop position: x=${x}, y=${y}`);
            
            if (customDragData.type === "media-file" && customDragData.mediaFile && onDropMedia) {
              // Calculate which track the drop position corresponds to
              let targetTrack: Track | null = null;
              let minDistance = Infinity;
              
              // Find the closest COMPATIBLE track to the drop position
              const compatibleTracks = sortedTracks.filter(track => track.type === customDragData.mediaFile.type);
              for (const track of compatibleTracks) {
                const trackY = getTrackYPosition(track.order);
                const distance = Math.abs(y - (trackY + trackHeight / 2)); // Distance to track center
                if (distance < minDistance) {
                  minDistance = distance;
                  targetTrack = track;
                }
              }
              
              console.log(`Target track: ${targetTrack?.id}, distance: ${minDistance}`);
              
              if (targetTrack) {
                // Check if media type is compatible with track type
                if (customDragData.mediaFile.type !== targetTrack.type) {
                  console.warn(`Cannot drop ${customDragData.mediaFile.type} file onto ${targetTrack.type} track`);
                  console.log(`Media type: ${customDragData.mediaFile.type}, Track type: ${targetTrack.type}`);
                  return; // Don't proceed with the drop
                }
                
                const effectiveDuration = getEffectiveDuration();
                const requestedOffset = ((x + pan) / (timelineWidth * zoom)) * effectiveDuration;
                
                // Find the best track and offset for this media
                const result = findBestTrackAndOffset(customDragData.mediaFile.type, requestedOffset, targetTrack.id, customDragData.mediaFile);
                
                if (result.needsNewTrack) {
                  // Create a new track first, then drop the media
                  console.log(`No available ${customDragData.mediaFile.type} tracks, creating new one`);
                  if (onAddTrack) {
                    onAddTrack(customDragData.mediaFile.type, (newTrackId) => {
                      // Drop the media on the newly created track
                      console.log("🚀 CALLBACK EXECUTED! Dropping media on newly created track:", newTrackId);
                      console.log("🚀 Media file:", customDragData.mediaFile);
                      console.log("🚀 Offset:", result.offset);
                      console.log("🚀 Available tracks at callback time:", sortedTracks.map(t => ({ id: t.id, name: t.name, type: t.type })));
                      onDropMedia(customDragData.mediaFile, newTrackId, result.offset, e as any);
                    });
                  }
                } else {
                  console.log(`Custom dropping on track: ${result.trackId}, requested offset: ${requestedOffset}, final offset: ${result.offset}`);
                  onDropMedia(customDragData.mediaFile, result.trackId!, result.offset, undefined);
                }
              } else {
                console.log(`No valid track found`);
                // Try to drop on the first available track as fallback
                if (sortedTracks.length > 0) {
                  const fallbackTrack = sortedTracks[0];
                  
                  // Check if media type is compatible with fallback track type
                  if (customDragData.mediaFile.type !== fallbackTrack.type) {
                    console.warn(`Cannot drop ${customDragData.mediaFile.type} file onto ${fallbackTrack.type} track (fallback)`);
                    console.log(`Media type: ${customDragData.mediaFile.type}, Track type: ${fallbackTrack.type}`);
                    return; // Don't proceed with the drop
                  }
                  
                  const effectiveDuration = getEffectiveDuration();
                  const requestedOffset = ((x + pan) / (timelineWidth * zoom)) * effectiveDuration;
                  
                  // Find the best track and offset for this media
                  const result = findBestTrackAndOffset(customDragData.mediaFile.type, requestedOffset, fallbackTrack.id, customDragData.mediaFile);
                  
                  if (result.needsNewTrack) {
                    // Create a new track first, then drop the media
                    console.log(`No available ${customDragData.mediaFile.type} tracks, creating new one`);
                    if (onAddTrack) {
                      onAddTrack(customDragData.mediaFile.type);
                      // Don't drop immediately - let the user drop again on the new track
                      // This prevents overlaying on the existing track
                      console.log(`New track created, please drop the media again on the new track`);
                    }
                  } else {
                    console.log(`Falling back to track: ${result.trackId}, requested offset: ${requestedOffset}, final offset: ${result.offset}`);
                    onDropMedia(customDragData.mediaFile, result.trackId!, result.offset, undefined);
                  }
                }
              }
            }
          } else {
            console.log("Custom drag ended outside timeline - no drop");
          }
        }
        
        setIsCustomDragging(false);
        setCustomDragData(null);
      }
    };

    document.addEventListener('mousemove', handleGlobalMouseMove);
    document.addEventListener('mouseup', handleGlobalMouseUp);
    document.addEventListener('customDragStart', handleCustomDragStart as EventListener);
    document.addEventListener('customDragEnd', handleCustomDragEnd as EventListener);

    return () => {
      document.removeEventListener('mousemove', handleGlobalMouseMove);
      document.removeEventListener('mouseup', handleGlobalMouseUp);
      document.removeEventListener('customDragStart', handleCustomDragStart as EventListener);
      document.removeEventListener('customDragEnd', handleCustomDragEnd as EventListener);
    };
  }, [isCustomDragging, customDragData, onDropMedia, tracks, timeRulerHeight, trackHeight, pan, timelineWidth, zoom, getEffectiveDuration, findBestTrackAndOffset]);

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const effectiveDuration = getEffectiveDuration();
    const t = ((x + pan) / (timelineWidth * zoom)) * effectiveDuration;
    
    // Check if we're in the time ruler area
    const isInRuler = y <= timeRulerHeight;
    
    // Check if click is on a clip
    const clickedClip = findClipAtPosition(x, y, 5);
    
    if (clickedClip) {
      // Clicked on a clip - select it
      flushSync(() => {
        setSelectedClipId(clickedClip.id);
      });
      // Force immediate redraw
      setForceRedraw(prev => prev + 1);
      // Also call drawTimeline directly for immediate visual feedback
      drawTimeline();
    } else if (isInRuler) {
      // Clicked in ruler area - move pin marker to that time
      flushSync(() => {
        setSelectedClipId(null);
        setCurrentTime(t);
      });
      ensurePinMarkerVisible(t);
      onSeek?.(t);
      // Force immediate redraw
      setForceRedraw(prev => prev + 1);
      // Also call drawTimeline directly for immediate visual feedback
      drawTimeline();
    } else {
      // Clicked in main timeline area - just deselect clip, don't move pin marker
      flushSync(() => {
        setSelectedClipId(null);
      });
      // Force immediate redraw
      setForceRedraw(prev => prev + 1);
      // Also call drawTimeline directly for immediate visual feedback
      drawTimeline();
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const effectiveDuration = getEffectiveDuration();
    const t = ((x + pan) / (timelineWidth * zoom)) * effectiveDuration;

    
    if (isScrubbing) {
      // Handle scrubbing - cursor follows mouse and updates time
      setCurrentTime(t);
      ensurePinMarkerVisible(t);
      onSeek?.(t);
    } else if (isSelecting && selectionStart !== null) {
      // Handle manual selection
      const clampedTime = Math.max(0, Math.min(effectiveDuration, t));
      setSelectionEnd(clampedTime);
      setShowSelectionPreview(true);
    } else {
      // Handle time preview during hover (only in ruler area)
      const isInRuler = y <= timeRulerHeight;
      
      setIsHoveringRuler(isInRuler);
      
      // Don't move pin marker on hover - only during active dragging or clicking
      
      // Check for hover over clips
      const hoveredClip = findClipAtPosition(x, y, 5);
      if (hoveredClip) {
        setHoveredClipId(hoveredClip.id);
        e.currentTarget.style.cursor = 'pointer'; // Show pointer cursor for clickable clips
      } else {
        setHoveredClipId(null);
        if (isInRuler) {
          e.currentTarget.style.cursor = 'ew-resize';
        } else {
          e.currentTarget.style.cursor = 'default';
        }
      }
      
      // Check for hover over accepted cuts
      const allCuts = [...accepted];
      let foundHover = false;
      for (let i = 0; i < allCuts.length; i++) {
        const cut = allCuts[i];
        const cutStartX = (cut.start / effectiveDuration) * (timelineWidth * zoom) - pan;
        const cutEndX = (cut.end / effectiveDuration) * (timelineWidth * zoom) - pan;
        if (x >= cutStartX && x <= cutEndX) {
          setHoveredCutIndex(i);
          foundHover = true;
          break;
        }
      }
      if (!foundHover) {
        setHoveredCutIndex(null);
      }
    }
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    console.log("🖱️ === MOUSE DOWN DEBUG ===");
    console.log("🖱️ Mouse down event:", { button: e.button, x: e.clientX, y: e.clientY, shiftKey: e.shiftKey });
    
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const effectiveDuration = getEffectiveDuration();
    const t = ((x + pan) / (timelineWidth * zoom)) * effectiveDuration;
    
    console.log("🖱️ Relative position:", { x, y, rectWidth: rect.width, rectHeight: rect.height });
    console.log("🖱️ Time at position:", t);
    
    // Check if we're in the time ruler area
    const isInRuler = y <= timeRulerHeight;
    console.log("🖱️ Is in ruler:", isInRuler, "rulerHeight:", timeRulerHeight);
    
    // Check if we're in the timeline area (not on zoom controls)
    if (e.target === e.currentTarget) {
      // Check for right-click or middle-click for different modes
      const isRightClick = e.button === 2;
      const isShiftClick = e.shiftKey;
      
      if (isRightClick || isShiftClick) {
        // Start manual selection mode
        const clampedTime = Math.max(0, Math.min(effectiveDuration, t));
        setIsSelecting(true);
        setSelectionStart(clampedTime);
        setSelectionEnd(clampedTime);
        setShowSelectionPreview(true);
      } else if (isInRuler) {
        // Start scrubbing mode when clicking in the ruler
        setIsScrubbing(true);
        setCurrentTime(t);
        onSeek?.(t);
      } else {
        // Check if clicking on a clip - if so, don't start dragging
        const clickedClip = findClipAtPosition(x, y, 5);
        if (!clickedClip) {
          // Just deselect clip when clicking in main timeline area (not ruler) and not on a clip
          setSelectedClipId(null);
        }
      }
    }
  };

  const handleMouseUp = () => {
    if (isSelecting && selectionStart !== null && selectionEnd !== null) {
      // Complete manual selection
      const start = Math.min(selectionStart, selectionEnd);
      const end = Math.max(selectionStart, selectionEnd);
      
      // Only add cut if selection is meaningful (at least 0.1 seconds)
      if (end - start >= 0.1) {
        onAddCut?.({ start, end });
      }
      
      // Reset selection
      setIsSelecting(false);
      setSelectionStart(null);
      setSelectionEnd(null);
      setShowSelectionPreview(false);
    }
    
    setIsScrubbing(false);
  };

  const handleMouseLeave = () => {
    setIsScrubbing(false);
    setIsHoveringRuler(false);
    // Don't reset selection states on mouse leave to avoid interfering with click events
    // Only reset manual selection if we're actually in selection mode
    if (isSelecting) {
      setIsSelecting(false);
      setSelectionStart(null);
      setSelectionEnd(null);
      setShowSelectionPreview(false);
    }
    setHoveredCutIndex(null);
    setHoveredClipId(null);
  };

  const handleDoubleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const effectiveDuration = getEffectiveDuration();
    
    // Double-click to remove cut at this position
    const allCuts = [...accepted];
    for (let i = 0; i < allCuts.length; i++) {
      const cut = allCuts[i];
        const cutStartX = (cut.start / effectiveDuration) * (timelineWidth * zoom) - pan;
        const cutEndX = (cut.end / effectiveDuration) * (timelineWidth * zoom) - pan;
      if (x >= cutStartX && x <= cutEndX) {
        onRemoveCut?.(i);
        break;
      }
    }
  };


  // Keyboard support for fine scrubbing
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle if timeline is focused or if no other element is focused
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') {
        return;
      }
      
      const effectiveDuration = getEffectiveDuration();
      
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
          newTime = Math.min(effectiveDuration, currentTime + step);
          break;
        case 'Home':
          e.preventDefault();
          newTime = 0;
          break;
        case 'End':
          e.preventDefault();
          newTime = effectiveDuration;
          break;
        case 'Backspace':
        case 'Delete':
          e.preventDefault();
          if (selectedClipId && onDeleteClip) {
            onDeleteClip(selectedClipId);
            setSelectedClipId(null);
          }
          return;
        default:
          return;
      }
      
      if (newTime !== currentTime) {
        setCurrentTime(newTime);
        ensurePinMarkerVisible(newTime);
        onSeek?.(newTime);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentTime, duration, onSeek, ensurePinMarkerVisible]);

  // Calculate track controls height
  const trackControlsHeight = trackHeight; // Track control height matches track content height

  // Drag and drop handlers are now inlined in the JSX for better debugging

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg overflow-hidden w-full">
      {/* Header with Timeline Controls */}
      <div className="px-3 sm:px-4 py-2 sm:py-3 border-b border-slate-700 bg-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-1">
          {/* Undo/Redo Controls */}
          <button
            onClick={onUndo}
            disabled={!historyIndex || historyIndex <= 0}
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-editor-bg-tertiary text-editor-text-primary hover:bg-editor-interactive-hover transition-colors border-0 p-0 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Undo (Ctrl+Z)"
          >
            <Undo2 className="w-4 h-4 flex-shrink-0" />
          </button>
          <button
            onClick={onRedo}
            disabled={!editHistoryLength || !historyIndex || historyIndex >= editHistoryLength - 1}
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-editor-bg-tertiary text-editor-text-primary hover:bg-editor-interactive-hover transition-colors border-0 p-0 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Redo (Ctrl+Y)"
          >
            <Redo2 className="w-4 h-4 flex-shrink-0" />
          </button>
        </div>
        
        {/* Timeline Controls */}
        <div className="flex items-center gap-1">
          
          {/* Zoom Controls */}
          <button
            onClick={handleZoomIn}
            disabled={isZooming}
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-editor-bg-tertiary text-editor-text-primary hover:bg-editor-interactive-hover transition-colors border-0 p-0 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Zoom In"
          >
            <span className="w-4 h-4 flex items-center justify-center text-sm font-medium">+</span>
          </button>
          <button
            onClick={handleZoomOut}
            disabled={isZooming}
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-editor-bg-tertiary text-editor-text-primary hover:bg-editor-interactive-hover transition-colors border-0 p-0 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Zoom Out"
          >
            <span className="w-4 h-4 flex items-center justify-center text-sm font-medium">-</span>
          </button>
          <button
            onClick={handleResetZoom}
            disabled={isZooming}
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-editor-bg-tertiary text-editor-text-primary hover:bg-editor-interactive-hover transition-colors border-0 p-0 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Reset Zoom"
          >
            <span className="w-4 h-4 flex items-center justify-center text-sm font-medium">⌂</span>
          </button>
          
          {/* Separator */}
          <div className="w-px h-6 bg-editor-bg-tertiary mx-1"></div>
          
          {/* Cut Management Tools */}
          <button
            onClick={onMarkIn}
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-editor-bg-tertiary text-editor-text-primary hover:bg-editor-interactive-hover transition-colors border-0 p-0"
            title="Mark In Point"
          >
            <Scissors className="w-4 h-4 flex-shrink-0" />
          </button>
          <button
            onClick={onClearAllCuts}
            disabled={accepted.length === 0}
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-editor-bg-tertiary text-editor-text-primary hover:bg-editor-interactive-hover transition-colors border-0 p-0 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Clear All Cuts"
          >
            <Trash2 className="w-4 h-4 flex-shrink-0" />
          </button>
          
        </div>
      </div>
      
      {/* Timeline Content with Track Controls */}
      <div className="bg-slate-900 flex">
        {/* Track Controls Sidebar */}
        <div className="w-12 bg-slate-800 border-r border-slate-700 flex-shrink-0 flex flex-col">
          {/* Ruler spacer to align with timeline ruler */}
          <div style={{ height: `${timeRulerHeight}px` }} className="bg-slate-750 border-b border-slate-700 flex-shrink-0"></div>
          
          {/* Track controls area */}
          <div 
            className="flex-1 relative overflow-hidden"
            style={{ height: `${tracksAreaHeight}px` }}
          >
            {sortedTracks.map((track, index) => {
              const trackY = getTrackYPosition(track.order);
              return (
                <div
                  key={track.id}
                  style={{
                    position: 'absolute',
                    top: `${trackY - timeRulerHeight}px`,
                    left: 0,
                    right: 0,
                    height: `${trackHeight}px`
                  }}
                >
                  <TrackControls
                    track={track}
                    onUpdateTrack={onUpdateTrack || (() => {})}
                    height={trackControlsHeight}
                    index={index}
                  />
                </div>
              );
            })}
          </div>
        </div>
        
        {/* Timeline Canvas with Scrollbar */}
        <div className="flex-1 flex flex-col">
          <div 
            data-timeline="true"
            className="flex-1 relative"
            style={{ height: `${timelineHeight}px` }}
          onDragOver={(e) => {
            console.log("AdvancedTimeline: Drag over timeline - event fired!");
            e.preventDefault();
            e.stopPropagation();
            
            // Try to get drag data to determine if drop would be valid
            try {
              const data = JSON.parse(e.dataTransfer.getData("application/json"));
              setCurrentDragData(data);
              
              // Check if we can determine compatibility
              if (isMediaFileDragData(data)) {
                const rect = e.currentTarget.getBoundingClientRect();
                const y = e.clientY - rect.top;
                
                // Find the closest track to determine compatibility
                let targetTrack: Track | null = null;
                let minDistance = Infinity;
                
                sortedTracks.forEach(track => {
                  const trackY = getTrackYPosition(track.order);
                  const distance = Math.abs(y - (trackY + trackHeight / 2));
                  if (distance < minDistance) {
                    minDistance = distance;
                    targetTrack = track;
                  }
                });
                
                // Set appropriate drop effect based on compatibility
                // @ts-ignore - TypeScript inference issue with drag data
                if (targetTrack && data.mediaFile && data.mediaFile.type === targetTrack.type) {
                  e.dataTransfer.dropEffect = "copy";
                } else {
                  e.dataTransfer.dropEffect = "none";
                }
              } else {
                e.dataTransfer.dropEffect = "copy";
              }
            } catch (error) {
              // If we can't parse the data, default to copy
              e.dataTransfer.dropEffect = "copy";
            }
            
            setIsDragOver(true);
          }}
          onDragEnter={(e) => {
            console.log("AdvancedTimeline: Drag enter timeline - event fired!");
            e.preventDefault();
            e.stopPropagation();
            
            // Try to get drag data
            try {
              const data = JSON.parse(e.dataTransfer.getData("application/json"));
              setCurrentDragData(data);
            } catch (error) {
              // Ignore parsing errors
            }
            
            e.dataTransfer.dropEffect = "copy";
            setIsDragOver(true);
          }}
          onDragLeave={(e) => {
            console.log("AdvancedTimeline: Drag leave timeline - event fired!");
            e.preventDefault();
            e.stopPropagation();
            // Only set drag over to false if we're actually leaving the timeline area
            const timelineContainer = e.currentTarget;
            const relatedTarget = e.relatedTarget as Node;
            
            if (!timelineContainer.contains(relatedTarget)) {
              setIsDragOver(false);
              setCurrentDragData(null);
            }
          }}
          onDrop={(e) => {
            console.log("AdvancedTimeline: Drop on timeline - event received");
            e.preventDefault();
            e.stopPropagation();
            setIsDragOver(false);
            setCurrentDragData(null);

            try {
              const data = JSON.parse(e.dataTransfer.getData("application/json"));
              console.log("Drop data:", data);
              console.log("onDropMedia function available:", !!onDropMedia);
              console.log("Data type:", data.type);
              console.log("Media file:", data.mediaFile);
              
              if (isMediaFileDragData(data) && onDropMedia) {
                const rect = e.currentTarget.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                
                console.log(`Drop position: x=${x}, y=${y}`);
                console.log(`Timeline dimensions: width=${timelineWidth}, height=${timelineHeight}`);
                console.log(`Time ruler height: ${timeRulerHeight}, track height: ${trackHeight}`);
                
                // Determine which track the user is dropping onto based on Y position
                let targetTrack: Track | null = null;
                let minDistance = Infinity;
                
                // Find the closest COMPATIBLE track to the drop position
                const compatibleTracks = sortedTracks.filter(track => track.type === data.mediaFile.type);
                compatibleTracks.forEach(track => {
                  const trackY = getTrackYPosition(track.order);
                  const distance = Math.abs(y - (trackY + trackHeight / 2)); // Distance to track center
                  if (distance < minDistance) {
                    minDistance = distance;
                    targetTrack = track;
                  }
                });
                
                const track = targetTrack;
                
                if (track) {
                  // Check if media type is compatible with track type
                  // @ts-ignore - TypeScript inference issue with drag data
                  if (data.mediaFile && data.mediaFile.type !== track.type) {
                    // @ts-ignore - TypeScript inference issue with drag data
                    console.warn(`Cannot drop ${data.mediaFile.type} file onto ${track.type} track`);
                    // @ts-ignore - TypeScript inference issue with drag data
                    console.log(`Media type: ${data.mediaFile.type}, Track type: ${track.type}`);
                    return; // Don't proceed with the drop
                  }
                  
                  // Calculate time offset based on x position
                  const effectiveDuration = getEffectiveDuration();
                  const requestedOffset = ((x + pan) / (timelineWidth * zoom)) * effectiveDuration;
                  
                  // Find the best track and offset for this media
                  const result = findBestTrackAndOffset(data.mediaFile.type, requestedOffset, (track as Track).id, data.mediaFile);
                  
                  if (result.needsNewTrack) {
                    // Create a new track first, then drop the media
                    console.log(`No available ${data.mediaFile.type} tracks, creating new one`);
                    if (onAddTrack) {
                      onAddTrack(data.mediaFile.type, (newTrackId) => {
                        // Drop the media on the newly created track
                        console.log("🚀 CALLBACK EXECUTED! Dropping media on newly created track:", newTrackId);
                        console.log("🚀 Media file:", data.mediaFile);
                        console.log("🚀 Offset:", result.offset);
                        console.log("🚀 Available tracks at callback time:", sortedTracks.map(t => ({ id: t.id, name: t.name, type: t.type })));
                        onDropMedia(data.mediaFile, newTrackId, result.offset, e);
                      });
                    }
                  } else {
                    console.log(`Dropping on track: ${result.trackId}, requested offset: ${requestedOffset}, final offset: ${result.offset}`);
                    onDropMedia(data.mediaFile, result.trackId!, result.offset, e);
                  }
                } else {
                  console.log(`No track found, available tracks: ${sortedTracks.length}`);
                }
              } else {
                console.log("Invalid drop data or missing onDropMedia handler");
              }
            } catch (error) {
              console.error("Error handling drop:", error);
            }
          }}
        >
          <div ref={containerRef} className="w-full h-full relative">
            <canvas 
              ref={canvasRef} 
              onClick={handleClick}
              onMouseMove={handleMouseMove}
              onMouseDown={handleMouseDown}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseLeave}
              onDoubleClick={handleDoubleClick}
              onWheel={handleVerticalScroll}
              onContextMenu={(e) => e.preventDefault()} // Prevent right-click menu
              tabIndex={0}
              className={`${isScrubbing ? 'cursor-grabbing' : isSelecting ? 'cursor-crosshair' : isDragOver ? (isDragCompatible() ? 'cursor-copy' : 'cursor-not-allowed') : 'cursor-default'} transition-all duration-200 ease-in-out block w-full focus:outline-none`}
              style={{ 
                height: `${timelineHeight}px`, 
                maxHeight: `${timelineHeight}px`,
                width: '100%',
                backgroundColor: isDragOver ? (isDragCompatible() ? 'rgba(59, 130, 246, 0.1)' : 'rgba(239, 68, 68, 0.1)') : 'transparent'
              }}
            />
            
            {/* Horizontal Scrollbar Overlay - Always visible */}
            <div 
              className="absolute bottom-0 left-0 right-0 h-12 bg-slate-800/95 backdrop-blur-sm border-t border-slate-700 flex items-center px-4 z-10"
            >
              {/* Debug info */}
              <div className="text-xs text-slate-300 mr-3 font-mono">
                Pan: {pan.toFixed(0)} | Zoom: {zoom.toFixed(2)}x | Infinite
              </div>
              <input
                type="range"
                min="0"
                max={Math.max(1000, timelineWidth * zoom * 2)} // Much larger range for infinite feel
                value={pan}
                onMouseDown={() => {
                  console.log('Scrollbar mouse down - starting interaction');
                  setIsInteractingWithScrollbar(true);
                }}
                onMouseUp={() => {
                  console.log('Scrollbar mouse up - ending interaction');
                  setIsInteractingWithScrollbar(false);
                }}
                onChange={(e) => {
                  const newPan = Number(e.target.value);
                  console.log('Infinite scrollbar pan change:', { 
                    newPan, 
                    max: Math.max(1000, timelineWidth * zoom * 2), 
                    timelineWidth, 
                    zoom
                  });
                  setPan(newPan);
                }}
                className="flex-1 h-3 bg-slate-700 rounded-lg appearance-none cursor-pointer timeline-scrollbar-overlay"
                style={{
                  background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${(pan / Math.max(1000, timelineWidth * zoom * 2)) * 100}%, #475569 ${(pan / Math.max(1000, timelineWidth * zoom * 2)) * 100}%, #475569 100%)`
                }}
              />
            </div>
          </div>

          {/* Drag indicator */}
          {isDragOver && (
            <div className={`absolute inset-0 border-2 border-dashed flex items-center justify-center pointer-events-none ${
              isDragCompatible() 
                ? 'border-blue-400 bg-blue-50 bg-opacity-10' 
                : 'border-red-400 bg-red-50 bg-opacity-10'
            }`}>
              <div className={`text-lg font-medium ${
                isDragCompatible() ? 'text-blue-400' : 'text-red-400'
              }`}>
                {isDragCompatible() 
                  ? (currentDragData?.mediaFile?.type === 'video' ? 'Drop video here' : 'Drop audio here')
                  : `Cannot drop ${currentDragData?.mediaFile?.type || 'this'} here`
                }
              </div>
            </div>
          )}

          {/* Thumbnail generation indicator */}
          {isGeneratingThumbnails && (
            <div className="absolute top-3 left-3 flex items-center gap-2 text-editor-status-warning bg-editor-bg-secondary px-2 py-1 rounded">
              <div className="w-3 h-3 border-2 border-editor-status-warning border-t-transparent rounded-full animate-spin"></div>
              <span className="text-xs">Generating thumbnails...</span>
            </div>
          )}

          {/* Vertical Scroll Slider */}
          {maxScrollOffset > 0 && (
            <div className="absolute right-2 top-1/2 transform -translate-y-1/2 z-20">
              <div className="relative w-6 h-64 bg-slate-700 rounded-full">
                {/* Slider track */}
                <div className="absolute inset-0 bg-slate-600 rounded-full"></div>
                
                {/* Slider thumb */}
                <div
                  className="absolute w-6 h-8 bg-slate-400 hover:bg-slate-300 rounded-full cursor-pointer transition-colors shadow-lg"
                  style={{
                    top: `${(trackScrollOffset / maxScrollOffset) * (256 - 32)}px`, // 256px height - 32px thumb height
                    transform: 'translateY(0)'
                  }}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    const slider = e.currentTarget.parentElement;
                    if (!slider) return;
                    
                    const sliderRect = slider.getBoundingClientRect();
                    const sliderHeight = sliderRect.height - 32; // Account for thumb height
                    
                    const handleMouseMove = (moveEvent: MouseEvent) => {
                      const relativeY = moveEvent.clientY - sliderRect.top - 16; // Center thumb
                      const percentage = Math.max(0, Math.min(1, relativeY / sliderHeight));
                      const newOffset = percentage * maxScrollOffset;
                      
                      // Update both state and ref for immediate access
                      trackScrollOffsetRef.current = newOffset;
                      setTrackScrollOffset(newOffset);
                    };
                    
                    const handleMouseUp = () => {
                      document.removeEventListener('mousemove', handleMouseMove);
                      document.removeEventListener('mouseup', handleMouseUp);
                    };
                    
                    document.addEventListener('mousemove', handleMouseMove);
                    document.addEventListener('mouseup', handleMouseUp);
                  }}
                ></div>
          </div>
            </div>
          )}
          
          {/* Scroll Position Indicator */}
          {maxScrollOffset > 0 && (
            <div className="absolute right-2 bottom-2 bg-slate-800/80 backdrop-blur-sm rounded px-2 py-1 text-xs text-slate-300 z-20">
              {Math.round((trackScrollOffset / maxScrollOffset) * 100)}%
        </div>
          )}
          </div>
          
        </div>
      </div>
    </div>
  );
});

AdvancedTimeline.displayName = 'AdvancedTimeline';
