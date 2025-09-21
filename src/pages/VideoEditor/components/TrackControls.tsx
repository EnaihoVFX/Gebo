import { Video, Volume2 } from "lucide-react";
import type { Track } from "../../../types";

interface TrackControlsProps {
  track: Track;
  onUpdateTrack: (trackId: string, updates: Partial<Track>) => void;
  height: number;
  index: number;
}

export function TrackControls({ track, onUpdateTrack, height, index }: TrackControlsProps) {
  // Alternating track colors for better visual differentiation with glassmorphic styling
  // Use track order instead of array index to maintain consistent colors when tracks are added/removed
  const isEvenTrack = Math.abs(track.order) % 2 === 0;
  
  // Enhanced glassmorphic styling for tracks
  const trackBgStyle = isEvenTrack ? {
    background: 'linear-gradient(135deg, rgba(39, 39, 42, 0.35) 0%, rgba(63, 63, 70, 0.30) 50%, rgba(39, 39, 42, 0.25) 100%)',
    backdropFilter: 'blur(20px) saturate(1.6)'
  } : {
    background: 'linear-gradient(135deg, rgba(63, 63, 70, 0.35) 0%, rgba(39, 39, 42, 0.30) 50%, rgba(24, 24, 27, 0.25) 100%)',
    backdropFilter: 'blur(20px) saturate(1.6)'
  };

  const trackHoverStyle = isEvenTrack ? {
    background: 'linear-gradient(135deg, rgba(39, 39, 42, 0.45) 0%, rgba(63, 63, 70, 0.40) 50%, rgba(39, 39, 42, 0.35) 100%)',
    backdropFilter: 'blur(25px) saturate(1.8)'
  } : {
    background: 'linear-gradient(135deg, rgba(63, 63, 70, 0.45) 0%, rgba(39, 39, 42, 0.40) 50%, rgba(24, 24, 27, 0.35) 100%)',
    backdropFilter: 'blur(25px) saturate(1.8)'
  };

  return (
    <div 
      className="group flex items-center justify-center px-1 py-1 border-b border-white/10 transition-all duration-300 relative overflow-hidden"
      style={{ 
        height: `${height}px`, 
        minHeight: `${height}px`,
        ...trackBgStyle,
        border: '1px solid rgba(255, 255, 255, 0.08)',
        boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.05)'
      }}
      onMouseEnter={(e) => {
        Object.assign(e.currentTarget.style, trackHoverStyle);
        e.currentTarget.style.transform = 'translateX(1px)';
        e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.1)';
      }}
      onMouseLeave={(e) => {
        Object.assign(e.currentTarget.style, trackBgStyle);
        e.currentTarget.style.transform = 'translateX(0px)';
        e.currentTarget.style.boxShadow = 'inset 0 1px 0 rgba(255, 255, 255, 0.05)';
      }}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-white/3 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
      {/* Track type icon */}
      <div className="flex items-center justify-center relative z-10">
        {track.type === 'video' ? (
          <Video className="w-4 h-4 text-white/50 group-hover:text-white/90 transition-colors duration-300" />
        ) : (
          <Volume2 className="w-4 h-4 text-white/50 group-hover:text-white/90 transition-colors duration-300" />
        )}
      </div>
    </div>
  );
}
