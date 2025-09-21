import { Video, Volume2 } from "lucide-react";
import type { Track } from "../../../types";

interface TrackControlsProps {
  track: Track;
  onUpdateTrack: (trackId: string, updates: Partial<Track>) => void;
  height: number;
  index: number;
}

export function TrackControls({ track, onUpdateTrack, height, index }: TrackControlsProps) {
  // Alternating track colors for better visual differentiation
  // Use track order instead of array index to maintain consistent colors when tracks are added/removed
  const isEvenTrack = Math.abs(track.order) % 2 === 0;
  const trackBgColor = isEvenTrack ? 'bg-slate-800' : 'bg-slate-750';
  const trackHoverColor = isEvenTrack ? 'hover:bg-slate-750' : 'hover:bg-slate-700';

  return (
    <div 
      className={`flex items-center justify-center px-1 py-1 border-b border-slate-700 ${trackBgColor} ${trackHoverColor} transition-colors`}
      style={{ height: `${height}px`, minHeight: `${height}px` }}
    >
      {/* Track type icon */}
      <div className="flex items-center justify-center">
        {track.type === 'video' ? (
          <Video className="w-4 h-4 text-slate-300" />
        ) : (
          <Volume2 className="w-4 h-4 text-slate-300" />
        )}
      </div>
    </div>
  );
}
