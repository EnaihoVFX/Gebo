import { 
  useRef, 
  useState, 
  useCallback, 
  useImperativeHandle, 
  forwardRef, 
  useEffect,
  useMemo 
} from "react";
import { Scissors, Trash2, Undo2, Redo2, Plus } from "lucide-react";
import { TimeRuler } from "./components/TimeRuler";
import { TrackLine } from "./components/TrackLine";
import { TrackControls } from "../TrackControls";
import { timelineUtils } from "./utils/timelineUtils";
import { useProjectFile } from "../../hooks/useProjectFileManager";
import { getProject } from "../../../../lib/projectFile";
import type { Range } from "../../../../types";
import type { Track, Clip } from "../../../../lib/projectFile";
import type { TimelineTrack } from "./types";

interface AdvancedTimelineProps {
  duration: number;
  accepted: Range[];
  width?: number;
  height?: number;
  onSeek?: (t: number) => void;
  onUpdateTrack?: (trackId: string, updates: Partial<Track>) => void;
  onMarkIn?: () => void;
  onClearAllCuts?: () => void;
  onDeleteSegment?: (trackId: string, segmentId: string) => void;
  onUndo?: () => void;
  onRedo?: () => void;
  historyIndex?: number;
  editHistoryLength?: number;
  selectedSegmentId?: string | null;
  onSegmentSelect?: (segmentId: string | null) => void;
}

export interface AdvancedTimelineHandle {
  zoomIn: () => void;
  zoomOut: () => void;
  resetZoom: () => void;
  isZooming: boolean;
  zoomLevel: number;
}

export const AdvancedTimeline = forwardRef<AdvancedTimelineHandle, AdvancedTimelineProps>(({
  duration,
  accepted,
  width,
  height,
  onSeek,
  onUpdateTrack,
  onMarkIn,
  onClearAllCuts,
  onDeleteSegment,
  onUndo,
  onRedo,
  historyIndex,
  editHistoryLength,
  selectedSegmentId: externalSelectedSegmentId,
  onSegmentSelect
}, ref) => {
  // Get data from project manager as fallback
  const projectManager = useProjectFile();
  
  // Use provided data or fallback to project manager - make reactive to project changes
  const tracks = useMemo(() => {
    return projectManager.getTracks();
  }, [projectManager.project]); // Re-calculate when project changes
  
  const clipsArray = useMemo(() => {
    return projectManager.getClips();
  }, [projectManager.project]);
  
  // Convert clips array to Map for TrackLine component
  const clips = useMemo(() => {
    const clipsMap = new Map<string, Clip>();
    clipsArray.forEach(clip => clipsMap.set(clip.id, clip));
    return clipsMap;
  }, [clipsArray]);

  // Container and sizing
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  
  // Timeline state
  const [currentTime, setCurrentTime] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState(0);
  const [isZooming] = useState(false); // Reserved for future zoom animations
  
  // Selection and interaction (use external state if provided, otherwise internal)
  const [internalSelectedSegmentId, setInternalSelectedSegmentId] = useState<string | null>(null);
  const [hoveredSegmentId, setHoveredSegmentId] = useState<string | null>(null);
  const [trackScrollOffset, setTrackScrollOffset] = useState(0);

  // Use external selection state if provided, otherwise use internal
  const selectedSegmentId = externalSelectedSegmentId !== undefined ? externalSelectedSegmentId : internalSelectedSegmentId;
  const setSelectedSegmentId = onSegmentSelect || setInternalSelectedSegmentId;

  // Calculate responsive dimensions
  const timelineWidth = width || containerSize.width || 800;
  const timeRulerHeight = 24; // Slightly smaller ruler
  const trackHeight = 48; // Smaller tracks
  const maxVisibleTracks = 3; // Show only 3 tracks before scrolling
  const tracksAreaHeight = maxVisibleTracks * trackHeight; // 144px
  const timelineHeight = height || timeRulerHeight + tracksAreaHeight + 48 || 216; // Much more compact total height (~216px)

  // Convert legacy tracks to timeline tracks
  const timelineTracks: TimelineTrack[] = useMemo(() => {
    console.log('Converting tracks to timeline tracks. Input tracks:', tracks);
    const result = tracks.map(track => ({
      id: track.id,
      name: track.name,
      type: track.type,
      enabled: track.enabled,
      muted: track.muted,
      volume: track.volume,
      order: track.order,
      segments: track.segments?.map((segment: any) => ({
        id: segment.id,
        clipId: segment.clip_id,
        startTime: segment.start,
        endTime: segment.end,
        offset: 0, // This should be calculated based on segment position
        duration: segment.end - segment.start
      })) || []
    }));
    console.log('Converted timeline tracks:', result);
    return result;
  }, [tracks]);

  // Calculate effective duration
  const effectiveDuration = useMemo(() => {
    return timelineUtils.calculateEffectiveDuration(timelineTracks, duration);
  }, [timelineTracks, duration]);

  // Sort tracks by order
  const sortedTracks = useMemo(() => {
    const result = [...timelineTracks].sort((a, b) => a.order - b.order);
    console.log('Sorted tracks for rendering:', result);
    console.log('Number of sorted tracks:', result.length);
    return result;
  }, [timelineTracks]);

  // Calculate track Y position
  const getTrackYPosition = useCallback((order: number) => {
    // Position tracks starting from the top of the tracks area
    const result = (order * trackHeight) - trackScrollOffset;
    console.log(`Track order ${order} -> Y position: ${result} (trackHeight: ${trackHeight}, trackScrollOffset: ${trackScrollOffset})`);
    return result;
  }, [trackHeight, trackScrollOffset]);

  async function createNewTrack(type: Track['type']) {
    const newTrack: Omit<Track, 'id'> = {
      name: `Track ${tracks.length + 1}`,
      type,
      enabled: true,
      muted: false,
      volume: 1,
      order: tracks.length,
      segments: []
    };
    
    try {
      const trackId = await projectManager.addTrack(newTrack);
      console.log('Added new track with ID:', trackId);
    } catch (error) {
      console.error('Error adding track:', error);
    }
  }

  // Resize observer
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateSize = () => {
      const rect = container.getBoundingClientRect();
      setContainerSize({ width: rect.width, height: rect.height });
    };

    updateSize();
    const resizeObserver = new ResizeObserver(updateSize);
    resizeObserver.observe(container);

    return () => resizeObserver.disconnect();
  }, []);

  // Zoom functions
  const handleZoomIn = useCallback(() => {
    const newZoom = timelineUtils.clampZoom(zoom * 1.15);
    setZoom(newZoom);
  }, [zoom]);

  const handleZoomOut = useCallback(() => {
    const newZoom = timelineUtils.clampZoom(zoom / 1.15);
    setZoom(newZoom);
  }, [zoom]);

  const handleResetZoom = useCallback(() => {
    setZoom(1);
    setPan(0);
  }, []);

  // Auto-scroll to keep pin marker visible
  const ensurePinMarkerVisible = useCallback((newCurrentTime: number) => {
    const pinMarkerX = timelineUtils.timeToPixel(newCurrentTime, effectiveDuration, timelineWidth, zoom, pan);
    
    let newPan = pan;
    
    if (pinMarkerX < 0) {
      newPan = Math.max(0, (newCurrentTime / effectiveDuration) * (timelineWidth * zoom) - (timelineWidth * 0.2));
    } else if (pinMarkerX > timelineWidth) {
      newPan = (newCurrentTime / effectiveDuration) * (timelineWidth * zoom) - (timelineWidth * 0.8);
    }
    
    if (newPan !== pan) {
      setPan(timelineUtils.clampPan(newPan));
    }
  }, [pan, timelineWidth, zoom, effectiveDuration]);

  // Handle seeking
  const handleSeek = useCallback((time: number) => {
    setCurrentTime(time);
    ensurePinMarkerVisible(time);
    onSeek?.(time);
  }, [ensurePinMarkerVisible, onSeek]);

  // Handle scrubbing
  const handleScrubStart = useCallback(() => {
    // Scrubbing state handled internally by TimeRuler
  }, []);

  const handleScrubEnd = useCallback(() => {
    // Scrubbing state handled internally by TimeRuler
  }, []);

  // Expose zoom functions via ref
  useImperativeHandle(ref, () => ({
    zoomIn: handleZoomIn,
    zoomOut: handleZoomOut,
    resetZoom: handleResetZoom,
    isZooming: isZooming,
    zoomLevel: zoom
  }), [handleZoomIn, handleZoomOut, handleResetZoom, isZooming, zoom]);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') {
        return;
      }
      
      const fineStep = 0.1;
      const coarseStep = 1.0;
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
          if (selectedSegmentId && onDeleteSegment) {
            // Find the track that contains the selected segment
            const track = timelineTracks.find(t => 
              t.segments.some(s => s.id === selectedSegmentId)
            );
            if (track) {
              onDeleteSegment(track.id, selectedSegmentId);
              setSelectedSegmentId(null);
            }
          }
          return;
        default:
          return;
      }
      
      if (newTime !== currentTime) {
        handleSeek(newTime);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentTime, effectiveDuration, selectedSegmentId, onDeleteSegment, handleSeek, timelineTracks]);

  return (
    <div 
      className="bg-slate-800 border border-slate-700 rounded-lg overflow-hidden w-full"
      style={{ 
        height: `${timelineHeight}px`,
        maxHeight: `${timelineHeight}px`,
        minHeight: `${timelineHeight}px`
      }}
    >
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

        <div className="flex items-center gap-1">
            {/* Add Track Buttons */}
            <button onClick={async () => {
                await createNewTrack('Audio');
            }} className="flex items-center justify-center w-8 h-8 rounded-lg bg-editor-bg-tertiary text-editor-text-primary hover:bg-editor-interactive-hover transition-colors border-0 p-0">
              <Plus className="w-4 h-4 flex-shrink-0" />
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

        {/* Horizontal Scrollbar */}
        <div className="left-0 right-0 h-12 bg-slate-800/95 backdrop-blur-sm border-t border-slate-700 flex items-center px-4 z-10">
            <div className="text-xs text-slate-300 mr-3 font-mono">
            Pan: {pan.toFixed(0)} | Zoom: {zoom.toFixed(2)}x
            </div>
            <input
            type="range"
            min="0"
            max={Math.max(1000, timelineWidth * zoom * 2)}
            value={pan}
            onChange={(e) => setPan(timelineUtils.clampPan(Number(e.target.value)))}
            className="flex-1 h-3 bg-slate-700 rounded-lg appearance-none cursor-pointer"
            />
        </div>
      
      {/* Timeline Content */}
      <div className="bg-slate-900 flex" style={{ height: `${timelineHeight - 60}px` }}>
        
        {/* Main Timeline Area */}
        <div className="flex-1 flex flex-col" style={{ height: `${timelineHeight - 60}px` }}>
          <div 
            ref={containerRef}
            className="relative flex-1"
            style={{ 
              maxHeight: `${timelineHeight - 60}px`
            }}
          >
            {/* Time Ruler */}
            <TimeRuler
              width={timelineWidth}
              height={timeRulerHeight}
              zoom={zoom}
              pan={pan}
              effectiveDuration={effectiveDuration}
              currentTime={currentTime}
              onSeek={handleSeek}
              onScrubStart={handleScrubStart}
              onScrubEnd={handleScrubEnd}
            />
            
            {/* Tracks Area */}
            <div 
              className="absolute bg-slate-900 overflow-y-auto"
              style={{ 
                top: `${timeRulerHeight}px`,
                width: `${timelineWidth}px`,
                height: `${tracksAreaHeight}px`
              }}
              onScroll={(e) => {
                const newScrollOffset = e.currentTarget.scrollTop;
                setTrackScrollOffset(newScrollOffset);
                // Sync scroll with track controls sidebar
                const trackControlsElement = e.currentTarget.parentElement?.previousElementSibling?.querySelector('.overflow-y-auto');
                if (trackControlsElement && trackControlsElement.scrollTop !== newScrollOffset) {
                  trackControlsElement.scrollTop = newScrollOffset;
                }
              }}
            >
              <div style={{ height: `${sortedTracks.length * trackHeight}px`, position: 'relative' }}>
                {sortedTracks.map((track) => {
                  const trackY = getTrackYPosition(track.order);
                  
                  return (
                    <div
                      key={track.id}
                      style={{
                        position: 'absolute',
                        top: `${trackY}px`,
                        left: 0,
                        width: '100%',
                        height: `${trackHeight}px`
                      }}
                    >
                      <TrackLine
                        track={track}
                        clips={clips}
                        width={timelineWidth}
                        height={trackHeight}
                        zoom={zoom}
                        pan={pan}
                        effectiveDuration={effectiveDuration}
                        onSegmentSelect={setSelectedSegmentId}
                        onSegmentHover={setHoveredSegmentId}
                        selectedSegmentId={selectedSegmentId}
                        hoveredSegmentId={hoveredSegmentId}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

AdvancedTimeline.displayName = 'AdvancedTimeline';