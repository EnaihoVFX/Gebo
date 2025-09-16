import type { Clip } from "../../../../lib/projectFile";

export interface TimelineSegment {
  id: string;
  clipId: string;
  startTime: number; // Start time within the clip (in seconds)
  endTime: number; // End time within the clip (in seconds) 
  offset: number; // Position on timeline (in seconds)
  duration: number; // Calculated duration (endTime - startTime)
}

export interface TimelineTrack {
  id: string;
  name: string;
  type: 'Video' | 'Audio' | 'Text' | 'Effect';
  enabled: boolean;
  muted: boolean;
  volume: number;
  order: number;
  segments: TimelineSegment[];
}

export interface VisualizationProps {
  width: number;
  height: number;
  zoom: number;
  pan: number;
  duration: number;
}

export interface VideoThumbnailOverlayProps extends VisualizationProps {
  clip: Clip;
  startTime: number;
  endTime: number;
  thumbnailCount?: number;
}

export interface WaveformVisualiserProps extends VisualizationProps {
  clip: Clip;
  peaks?: number[];
  startTime: number;
  endTime: number;
}

export interface TrackLineProps {
  track: TimelineTrack;
  clips: Map<string, Clip>;
  width: number;
  height: number;
  zoom: number;
  pan: number;
  effectiveDuration: number;
  onSegmentSelect?: (segmentId: string) => void;
  onSegmentHover?: (segmentId: string | null) => void;
  selectedSegmentId?: string | null;
  hoveredSegmentId?: string | null;
}

export interface SegmentVisualizationProps {
  segment: TimelineSegment;
  clip: Clip;
  width: number;
  height: number;
  trackHeight: number;
  zoom: number;
  pan: number;
  effectiveDuration: number;
  isSelected?: boolean;
  isHovered?: boolean;
  onSelect?: () => void;
  onHover?: (hover: boolean) => void;
}