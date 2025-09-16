import { Video, Volume2 } from "lucide-react";
import { type Track } from "../../../lib/projectFile";

interface TrackControlsProps {
  track: Track;
  onUpdateTrack: (trackId: string, updates: Partial<Track>) => void;
  height: number;
  index: number;
}

export function TrackControls({ track, onUpdateTrack, height, index }: TrackControlsProps) {
  console.log(`TrackControls rendering for track: ${track.name} (${track.id}) at height ${height}, index ${index}`);
  
  // Alternating track colors for better visual differentiation
  const isEvenTrack = index % 2 === 0;
  const trackBgColor = isEvenTrack ? 'bg-slate-800' : 'bg-slate-750';
  const trackHoverColor = isEvenTrack ? 'hover:bg-slate-750' : 'hover:bg-slate-700';

  return (
    <div 
      className={`flex items-center justify-between px-2 py-1 border-b border-slate-700 ${trackBgColor} ${trackHoverColor} transition-colors w-full`}
      style={{ height: `${height}px`, minHeight: `${height}px` }}
    >
      {/* Track info */}
      <div className="flex items-center gap-2 min-w-0 flex-1">
        {/* Track type icon */}
        <div className="flex items-center justify-center flex-shrink-0">
          {track.type === 'Video' ? (
            <Video className="w-4 h-4 text-slate-300" />
          ) : (
            <Volume2 className="w-4 h-4 text-slate-300" />
          )}
        </div>
        
        {/* Track name */}
        <div className="text-xs text-slate-300 truncate flex-1 min-w-0">
          {track.name}
        </div>
      </div>
      
      {/* Track controls */}
      <div className="flex items-center gap-1 flex-shrink-0">
        {/* Mute button */}
        <button
          onClick={() => onUpdateTrack(track.id, { muted: !track.muted })}
          className={`w-5 h-5 rounded text-xs flex items-center justify-center transition-colors ${
            track.muted 
              ? 'bg-red-600 text-white' 
              : 'bg-slate-600 text-slate-300 hover:bg-slate-500'
          }`}
          title={track.muted ? 'Unmute' : 'Mute'}
        >
          {track.muted ? '🔇' : '🔊'}
        </button>
      </div>
    </div>
  );
}
