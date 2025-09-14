import { useState, useEffect } from "react";

interface PrecisionControlsProps {
  currentTime: number;
  duration: number;
  onSeek: (time: number) => void;
  onFrameStep: (direction: 'forward' | 'backward') => void;
  frameRate?: number;
}

export function PrecisionControls({
  currentTime,
  duration,
  onSeek,
  onFrameStep,
  frameRate = 30
}: PrecisionControlsProps) {
  const [timeInput, setTimeInput] = useState("");
  const [isEditing, setIsEditing] = useState(false);

  // Update time input when currentTime changes (but not when user is editing)
  useEffect(() => {
    if (!isEditing) {
      setTimeInput(formatTimeForInput(currentTime));
    }
  }, [currentTime, isEditing]);

  const formatTimeForInput = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const frames = Math.floor((seconds % 1) * frameRate);
    
    if (hours > 0) {
      return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${frames.toString().padStart(2, '0')}`;
    } else {
      return `${mins}:${secs.toString().padStart(2, '0')}.${frames.toString().padStart(2, '0')}`;
    }
  };

  const parseTimeInput = (input: string): number => {
    // Support formats: MM:SS.FF, HH:MM:SS.FF, or just seconds
    const parts = input.split(':');
    if (parts.length === 1) {
      // Just seconds
      return parseFloat(parts[0]) || 0;
    } else if (parts.length === 2) {
      // MM:SS.FF
      const [mins, secPart] = parts;
      const [secs, frames] = secPart.split('.');
      const minutes = parseInt(mins, 10) || 0;
      const seconds = parseInt(secs, 10) || 0;
      const frameNumber = parseInt(frames || '0', 10) || 0;
      return minutes * 60 + seconds + frameNumber / frameRate;
    } else if (parts.length === 3) {
      // HH:MM:SS.FF
      const [hours, mins, secPart] = parts;
      const [secs, frames] = secPart.split('.');
      const hourNumber = parseInt(hours, 10) || 0;
      const minutes = parseInt(mins, 10) || 0;
      const seconds = parseInt(secs, 10) || 0;
      const frameNumber = parseInt(frames || '0', 10) || 0;
      return hourNumber * 3600 + minutes * 60 + seconds + frameNumber / frameRate;
    }
    return 0;
  };

  const handleTimeInputSubmit = () => {
    const newTime = parseTimeInput(timeInput);
    const clampedTime = Math.max(0, Math.min(duration, newTime));
    onSeek(clampedTime);
    setIsEditing(false);
  };

  const handleTimeInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleTimeInputSubmit();
    } else if (e.key === 'Escape') {
      setTimeInput(formatTimeForInput(currentTime));
      setIsEditing(false);
    }
  };

  const frameStep = 1 / frameRate;

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3">
      <div className="text-xs text-zinc-400 mb-2">Precision Controls</div>
      
      <div className="flex items-center gap-2 mb-3">
        {/* Time Input */}
        <div className="flex items-center gap-1">
          <span className="text-xs text-zinc-500">Time:</span>
          <input
            type="text"
            value={timeInput}
            onChange={(e) => {
              setTimeInput(e.target.value);
              setIsEditing(true);
            }}
            onBlur={handleTimeInputSubmit}
            onKeyDown={handleTimeInputKeyDown}
            className="px-2 py-1 text-xs bg-zinc-800 border border-zinc-700 rounded text-zinc-200 focus:outline-none focus:border-blue-500 w-24"
            placeholder="M:SS.FF"
          />
        </div>

        {/* Frame Navigation */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => onFrameStep('backward')}
            className="px-2 py-1 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded"
            title={`Previous frame (${frameStep.toFixed(3)}s)`}
          >
            ⏮
          </button>
          <span className="text-xs text-zinc-500">Frame</span>
          <button
            onClick={() => onFrameStep('forward')}
            className="px-2 py-1 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded"
            title={`Next frame (${frameStep.toFixed(3)}s)`}
          >
            ⏭
          </button>
        </div>

        {/* Quick Jump Buttons */}
        <div className="flex items-center gap-1 ml-auto">
          <button
            onClick={() => onSeek(0)}
            className="px-2 py-1 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded"
            title="Go to start"
          >
            ⏪
          </button>
          <button
            onClick={() => onSeek(duration)}
            className="px-2 py-1 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded"
            title="Go to end"
          >
            ⏩
          </button>
        </div>
      </div>

      {/* Time Display */}
      <div className="text-xs text-zinc-400">
        Current: {formatTimeForInput(currentTime)} / {formatTimeForInput(duration)}
        <span className="ml-2 text-zinc-500">
          ({Math.round(currentTime * frameRate)} / {Math.round(duration * frameRate)} frames)
        </span>
      </div>
    </div>
  );
}
