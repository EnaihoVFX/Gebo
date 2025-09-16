import React from "react";
import { VideoThumbnailOverlay } from "./VideoThumbnailOverlay";
import { WaveformVisualiser } from "./WaveformVisualiser";
import type { SegmentVisualizationProps } from "../types";

export const SegmentVisualization: React.FC<SegmentVisualizationProps> = ({
  segment,
  clip,
  width,
  height: _height, // Reserved for future proportional scaling
  trackHeight,
  zoom: _zoom, // Reserved for future zoom-based detail scaling
  pan,
  effectiveDuration,
  isSelected = false,
  isHovered = false,
  onSelect,
  onHover
}) => {
  // Calculate segment position and dimensions
  const segmentStartX = (segment.offset / effectiveDuration) * width - pan;
  const segmentWidth = (segment.duration / effectiveDuration) * width;
  
  // Only render if segment is visible
  if (segmentStartX + segmentWidth < 0 || segmentStartX > width) {
    return null;
  }

  const handleClick = () => {
    onSelect?.();
  };

  const handleMouseEnter = () => {
    onHover?.(true);
  };

  const handleMouseLeave = () => {
    onHover?.(false);
  };

  // Calculate visual properties
  const visualWidth = Math.max(1, segmentWidth);
  const visualHeight = trackHeight;
  
  // Get duration from clip probe data
  const clipDuration = clip.latest_probe?.duration || segment.duration;
  
  // Render different visualizations based on clip type
  const renderVisualization = () => {
    switch (clip.type) {
      case 'Video':
        return (
          <div className="relative w-full h-full">
            {/* Video thumbnails in top portion */}
            <div className="absolute inset-x-0 top-0 h-3/5">
              <VideoThumbnailOverlay
                clip={clip}
                width={visualWidth}
                height={Math.floor(visualHeight * 0.6)}
                startTime={segment.startTime}
                endTime={segment.endTime}
                zoom={1}
                pan={0}
                duration={clipDuration}
                thumbnailCount={Math.max(3, Math.floor(visualWidth / 40))}
              />
            </div>
            {/* Waveform in bottom portion if audio exists */}
            {clip.latest_probe && (
              <div className="absolute inset-x-0 bottom-0 h-2/5">
                <WaveformVisualiser
                  clip={clip}
                  width={visualWidth}
                  height={Math.floor(visualHeight * 0.4)}
                  startTime={segment.startTime}
                  endTime={segment.endTime}
                  zoom={1}
                  pan={0}
                  duration={clipDuration}
                />
              </div>
            )}
          </div>
        );
        
      case 'Audio':
        return (
          <WaveformVisualiser
            clip={clip}
            width={visualWidth}
            height={visualHeight}
            startTime={segment.startTime}
            endTime={segment.endTime}
            zoom={1}
            pan={0}
            duration={clipDuration}
          />
        );

      case 'Image':
        return (
          <div 
            className="w-full h-full flex items-center justify-center text-white text-sm bg-purple-600"
            style={{ backgroundColor: '#9333ea' }}
          >
            📷 Image
          </div>
        );
        
      default:
        return (
          <div 
            className="w-full h-full flex items-center justify-center text-white text-sm bg-gray-600"
            style={{ backgroundColor: '#6b7280' }}
          >
            🎬 {clip.type || 'Media'}
          </div>
        );
    }
  };

  // Calculate border and background styles
  const borderStyle = isSelected ? '3px solid #ff6b35' : isHovered ? '2px solid #60a5fa' : '1px solid #3b82f6';
  const backgroundOpacity = isSelected ? 0.8 : isHovered ? 0.7 : 0.6;

  return (
    <div
      style={{
        position: 'absolute',
        left: `${segmentStartX}px`,
        width: `${visualWidth}px`,
        height: `${visualHeight}px`,
        border: borderStyle,
        borderRadius: '6px',
        overflow: 'hidden',
        cursor: 'pointer',
        opacity: backgroundOpacity
      }}
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className="transition-all duration-150"
    >
      {renderVisualization()}
      
      {/* Segment info overlay */}
      {visualWidth > 60 && (
        <div 
          className="absolute bottom-1 left-1 text-xs text-white font-mono bg-black bg-opacity-50 px-1 rounded"
          style={{ fontSize: '10px' }}
        >
          {segment.duration.toFixed(1)}s
        </div>
      )}
      
      {/* Selection indicator */}
      {isSelected && (
        <div className="absolute top-1 left-1 w-2 h-2 bg-orange-500 rounded-full"></div>
      )}
    </div>
  );
};