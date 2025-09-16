import React, { useMemo } from "react";
import { SegmentVisualization } from "./SegmentVisualization";
import type { TrackLineProps, TimelineSegment } from "../types";

export const TrackLine: React.FC<TrackLineProps> = ({
  track,
  clips,
  width,
  height,
  zoom,
  pan,
  effectiveDuration,
  onSegmentSelect,
  onSegmentHover,
  selectedSegmentId,
  hoveredSegmentId
}) => {
  console.log(`TrackLine rendering for track: ${track.name} (${track.id}) at ${width}x${height}`);
  
  // Convert track segments to timeline segments with corresponding clips
  const segmentsWithClips = useMemo(() => {
    return track.segments.map(segment => {
      // Find the clip that corresponds to this segment
      const clip = clips.get(segment.clipId);

      const timelineSegment: TimelineSegment = {
        id: segment.id,
        clipId: segment.clipId,
        startTime: segment.startTime,
        endTime: segment.endTime,
        offset: segment.offset,
        duration: segment.endTime - segment.startTime
      };

      return { segment: timelineSegment, clip };
    });
  }, [track, clips]);

  // Calculate track background styling
  const getTrackBackgroundColor = () => {
    switch (track.type) {
      case 'Video': return '#1e293b'; // slate-800
      case 'Audio': return '#0f172a'; // slate-900
      case 'Text': return '#166534'; // green-800
      case 'Effect': return '#92400e'; // amber-800
      default: return '#374151'; // gray-700
    }
  };

  // Handle drop zone styling
  const trackStyle = {
    width: `${width}px`,
    height: `${height}px`,
    backgroundColor: getTrackBackgroundColor(),
    border: '1px solid #334155', // slate-700
    position: 'relative' as const,
    overflow: 'hidden' as const
  };

  return (
    <div style={trackStyle} className="transition-colors duration-200">
      {/* Track background pattern for drop zones */}
      <div 
        className="absolute inset-0 opacity-10"
        style={{
          backgroundImage: `repeating-linear-gradient(
            45deg,
            transparent,
            transparent 10px,
            rgba(255,255,255,0.1) 10px,
            rgba(255,255,255,0.1) 20px
          )`
        }}
      />
      
      {/* Track label (visible when track is wide enough) */}
      {width > 100 && (
        <div className="absolute top-1 left-2 text-xs text-white font-medium bg-black bg-opacity-50 px-2 py-1 rounded">
          {track.name} ({track.type})
          {!track.enabled && <span className="ml-1 text-red-400">🔇</span>}
          {track.muted && <span className="ml-1 text-yellow-400">🔇</span>}
        </div>
      )}
      
      {/* Render all segments */}
      {segmentsWithClips.map(({ segment, clip }) => {
        if (!clip) {
          // Render placeholder for missing clip
          return (
            <div
              key={segment.id}
              style={{
                position: 'absolute',
                left: `${(segment.offset / effectiveDuration) * width - pan}px`,
                width: `${(segment.duration / effectiveDuration) * width}px`,
                height: `${height}px`,
                backgroundColor: '#ef4444', // red-500
                border: '2px solid #dc2626', // red-600
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontSize: '12px'
              }}
            >
              ❌ Missing Clip
            </div>
          );
        }

        return (
          <SegmentVisualization
            key={segment.id}
            segment={segment}
            clip={clip}
            width={width}
            height={height}
            trackHeight={height}
            zoom={zoom}
            pan={pan}
            effectiveDuration={effectiveDuration}
            isSelected={selectedSegmentId === segment.id}
            isHovered={hoveredSegmentId === segment.id}
            onSelect={() => onSegmentSelect?.(segment.id)}
            onHover={(hover) => onSegmentHover?.(hover ? segment.id : null)}
          />
        );
      })}
      
      {/* Track empty state */}
      {track.segments.length === 0 && width > 200 && (
        <div className="absolute inset-0 flex items-center justify-center text-slate-400 text-sm">
          Drop media here to add clips to {track.name}
        </div>
      )}
      
      {/* Track volume indicator for audio tracks */}
      {track.type === 'Audio' && width > 150 && (
        <div className="absolute bottom-1 right-2 text-xs text-white bg-black bg-opacity-50 px-2 py-1 rounded">
          🔊 {track.volume}%
        </div>
      )}
    </div>
  );
};