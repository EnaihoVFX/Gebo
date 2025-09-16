import type { TimelineTrack, TimelineSegment } from "../types";

export const timelineUtils = {
  /**
   * Format time in MM:SS.MS format
   */
  formatTime: (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 100);
    return `${mins}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
  },

  /**
   * Calculate effective duration based on tracks and segments
   */
  calculateEffectiveDuration: (tracks: TimelineTrack[], fallbackDuration?: number): number => {
    if (fallbackDuration && fallbackDuration > 0) {
      return fallbackDuration;
    }

    let maxEndTime = 0;
    tracks.forEach(track => {
      track.segments.forEach(segment => {
        const endTime = segment.offset + segment.duration;
        if (endTime > maxEndTime) {
          maxEndTime = endTime;
        }
      });
    });

    return Math.max(60, maxEndTime + 10); // Minimum 60 seconds, plus 10 second buffer
  },

  /**
   * Calculate time interval for ruler based on zoom level
   */
  calculateTimeInterval: (pixelsPerSecond: number): number => {
    if (!isFinite(pixelsPerSecond) || pixelsPerSecond <= 0) {
      return 1; // Default to 1 second intervals
    } else if (pixelsPerSecond > 2000) {
      return 0.005; // 5ms intervals when extremely zoomed in (2000%+)
    } else if (pixelsPerSecond > 1000) {
      return 0.01; // 10ms intervals when extremely zoomed in (1000%+)
    } else if (pixelsPerSecond > 800) {
      return 0.02; // 20ms intervals when very zoomed in (800%+)
    } else if (pixelsPerSecond > 600) {
      return 0.05; // 50ms intervals when very zoomed in (600%+)
    } else if (pixelsPerSecond > 400) {
      return 0.1; // 100ms intervals when zoomed in (400%+)
    } else if (pixelsPerSecond > 300) {
      return 0.2; // 200ms intervals when zoomed in (300%+)
    } else if (pixelsPerSecond > 200) {
      return 0.5; // 500ms intervals when zoomed in (200%+)
    } else if (pixelsPerSecond > 100) {
      return 1; // 1 second intervals (100%+)
    } else if (pixelsPerSecond > 50) {
      return 2; // 2 second intervals (50%+)
    } else if (pixelsPerSecond > 20) {
      return 5; // 5 second intervals (20%+)
    } else if (pixelsPerSecond > 10) {
      return 10; // 10 second intervals (10%+)
    } else if (pixelsPerSecond > 5) {
      return 15; // 15 second intervals (5%+)
    } else if (pixelsPerSecond > 2) {
      return 30; // 30 second intervals (2%+)
    } else if (pixelsPerSecond > 1) {
      return 60; // 60 second intervals (1%+)
    } else {
      return 120; // 120 second intervals when very zoomed out (<1%)
    }
  },

  /**
   * Calculate major interval for ruler labels
   */
  calculateMajorInterval: (timeInterval: number): number => {
    if (timeInterval <= 0.005) {
      return 0.1; // Show every 20th marker (100ms)
    } else if (timeInterval <= 0.01) {
      return 0.1; // Show every 10th marker (100ms)
    } else if (timeInterval <= 0.02) {
      return 0.1; // Show every 5th marker (100ms)
    } else if (timeInterval <= 0.05) {
      return 0.2; // Show every 4th marker (200ms)
    } else if (timeInterval <= 0.1) {
      return 0.5; // Show every 5th marker (500ms)
    } else if (timeInterval <= 0.2) {
      return 1.0; // Show every 5th marker (1s)
    } else if (timeInterval <= 0.5) {
      return 1.0; // Show every 2nd marker (1s)
    } else {
      return timeInterval; // Show every marker
    }
  },

  /**
   * Clamp zoom to safe bounds
   */
  clampZoom: (zoom: number, min: number = 0.1, max: number = 10): number => {
    return Math.max(min, Math.min(max, zoom));
  },

  /**
   * Clamp pan to valid range
   */
  clampPan: (pan: number, minPan: number = 0): number => {
    return Math.max(minPan, pan);
  },

  /**
   * Convert time to pixel position
   */
  timeToPixel: (time: number, duration: number, width: number, zoom: number, pan: number): number => {
    return (time / duration) * (width * zoom) - pan;
  },

  /**
   * Convert pixel position to time
   */
  pixelToTime: (pixel: number, duration: number, width: number, zoom: number, pan: number): number => {
    return ((pixel + pan) / (width * zoom)) * duration;
  },

  /**
   * Check if a point is within a time range on the timeline
   */
  isPointInTimeRange: (
    pointX: number, 
    startTime: number, 
    endTime: number, 
    duration: number, 
    width: number, 
    zoom: number, 
    pan: number,
    tolerance: number = 0
  ): boolean => {
    const startX = timelineUtils.timeToPixel(startTime, duration, width, zoom, pan);
    const endX = timelineUtils.timeToPixel(endTime, duration, width, zoom, pan);
    return pointX >= (startX - tolerance) && pointX <= (endX + tolerance);
  }
};