import { Video, Volume2 } from "lucide-react";
import type { Track } from "../../../types";

interface TrackControlsProps {
  track: Track;
  onUpdateTrack: (trackId: string, updates: Partial<Track>) => void;
  height: number;
  index: number;
}

export function TrackControls({ track, onUpdateTrack, height, index }: TrackControlsProps) {
  return (
    <div 
      className="group flex items-center justify-center px-1 py-1 transition-all duration-300 relative overflow-hidden bg-gradient-to-br from-editor-bg-glass-primary via-editor-bg-glass-primary to-editor-bg-glass-primary backdrop-blur-2xl"
      style={{ 
        height: `${height}px`, 
        minHeight: `${height}px`
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'rgba(63, 63, 70, 0.45)';
        e.currentTarget.style.transform = 'translateX(1px)';
        e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.1)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = '';
        e.currentTarget.style.transform = 'translateX(0px)';
        e.currentTarget.style.boxShadow = 'inset 0 1px 0 rgba(255, 255, 255, 0.05)';
      }}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-white/3 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
      {/* Track type icon */}
      <div className="flex items-center justify-center relative z-10">
        {track.type === 'video' ? (
          <Video className="w-4 h-4 text-editor-text-tertiary group-hover:text-editor-text-primary transition-colors duration-300" />
        ) : (
          <Volume2 className="w-4 h-4 text-editor-text-tertiary group-hover:text-editor-text-primary transition-colors duration-300" />
        )}
      </div>
    </div>
  );
}
