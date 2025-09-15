import { useState, useRef, useEffect } from "react";
import { Volume2, VolumeX, Eye, EyeOff, Edit3, Check, X } from "lucide-react";
import type { Track } from "../../../types";

interface TrackControlsProps {
  track: Track;
  onUpdateTrack: (trackId: string, updates: Partial<Track>) => void;
  onDeleteTrack: (trackId: string) => void;
  height: number;
}

export function TrackControls({ track, onUpdateTrack, onDeleteTrack, height }: TrackControlsProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(track.name);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleNameEdit = () => {
    if (editName.trim() && editName !== track.name) {
      onUpdateTrack(track.id, { name: editName.trim() });
    } else {
      setEditName(track.name);
    }
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setEditName(track.name);
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleNameEdit();
    } else if (e.key === 'Escape') {
      handleCancelEdit();
    }
  };


  return (
    <div 
      className={`flex items-center justify-between px-2 py-1 border-b border-slate-700 bg-slate-800 hover:bg-slate-750 transition-colors group`}
      style={{ height: `${height}px`, minHeight: `${height}px` }}
    >
      {/* Left Side: Track Name */}
      <div className="flex-1 min-w-0">
        {isEditing ? (
          <div className="flex items-center gap-1">
            <input
              ref={inputRef}
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onKeyDown={handleKeyDown}
              onBlur={handleNameEdit}
              className="flex-1 px-2 py-1 text-sm bg-slate-700 text-white border border-slate-600 rounded focus:outline-none focus:border-blue-500"
              maxLength={25}
            />
            <button
              onClick={handleNameEdit}
              className="p-1 text-green-400 hover:text-green-300 transition-colors"
              title="Save"
            >
              <Check className="w-3 h-3" />
            </button>
            <button
              onClick={handleCancelEdit}
              className="p-1 text-red-400 hover:text-red-300 transition-colors"
              title="Cancel"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ) : (
          <div 
            className="flex items-center gap-1 cursor-pointer hover:bg-slate-700 rounded px-2 py-1 transition-colors"
            onClick={() => setIsEditing(true)}
            title="Click to edit name"
          >
            <span className="text-sm text-white truncate">{track.name}</span>
            <Edit3 className="w-3 h-3 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
          </div>
        )}
      </div>

      {/* Right Side: Controls */}
      <div className="flex items-center gap-1">
        {/* Enable/Disable and Mute Toggles */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => onUpdateTrack(track.id, { enabled: !track.enabled })}
            className={`p-1 rounded transition-colors ${
              track.enabled 
                ? 'text-white hover:bg-slate-600' 
                : 'text-slate-500 hover:bg-slate-600 hover:text-slate-300'
            }`}
            title={track.enabled ? 'Disable track' : 'Enable track'}
          >
            {track.enabled ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
          </button>

          <button
            onClick={() => onUpdateTrack(track.id, { muted: !track.muted })}
            className={`p-1 rounded transition-colors ${
              track.muted 
                ? 'text-red-400 hover:bg-slate-600' 
                : 'text-white hover:bg-slate-600'
            }`}
            title={track.muted ? 'Unmute track' : 'Mute track'}
          >
            {track.muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
        </div>

        {/* Volume Slider (only for audio tracks) */}
        {track.type === 'audio' && (
          <div className="flex items-center gap-1">
            <input
              type="range"
              min="0"
              max="100"
              value={track.volume}
              onChange={(e) => onUpdateTrack(track.id, { volume: parseInt(e.target.value) })}
              className="w-12 h-1 bg-slate-600 rounded-lg appearance-none cursor-pointer slider"
              title={`Volume: ${track.volume}%`}
            />
            <span className="text-xs text-slate-400 w-4 text-right">{track.volume}</span>
          </div>
        )}
      </div>
    </div>
  );
}
