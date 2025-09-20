import { 
  Download,
  Plus
} from "lucide-react";
import type { Range, Track } from "../../../types";

interface ToolbarProps {
  onExport: () => void;
  acceptedCuts: Range[];
  onAddTrack?: (type: Track['type'], onTrackCreated?: (trackId: string) => void) => void;
}

export function Toolbar({
  onExport,
  acceptedCuts,
  onAddTrack,
}: ToolbarProps) {
  return (
    <div className="flex items-center gap-1 sm:gap-2 lg:gap-3 overflow-x-auto">

      {/* Debug Add Track Actions */}
      {onAddTrack && (
        <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
          <button 
            onClick={() => onAddTrack('video')} 
            className="h-8 px-2 sm:px-3 lg:px-4 bg-green-600 text-white hover:bg-green-700 transition-colors text-xs sm:text-sm font-medium flex items-center gap-1.5 border-0 rounded-lg"
            title="Add Video Track (Debug)"
          >
            <Plus className="w-4 h-4 flex-shrink-0" />
            <span className="hidden sm:inline">Add Video Track</span>
          </button>
          <button 
            onClick={() => onAddTrack('audio')} 
            className="h-8 px-2 sm:px-3 lg:px-4 bg-blue-600 text-white hover:bg-blue-700 transition-colors text-xs sm:text-sm font-medium flex items-center gap-1.5 border-0 rounded-lg"
            title="Add Audio Track (Debug)"
          >
            <Plus className="w-4 h-4 flex-shrink-0" />
            <span className="hidden sm:inline">Add Audio Track</span>
          </button>
        </div>
      )}

      {/* Export Action */}
      <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
        <button 
          onClick={onExport} 
          disabled={!acceptedCuts.length} 
          className="h-8 px-2 sm:px-3 lg:px-4 bg-editor-status-info text-editor-text-primary disabled:opacity-50 hover:bg-indigo-700 transition-colors text-xs sm:text-sm font-medium flex items-center gap-1.5 border-0 rounded-lg"
        >
          <Download className="w-4 h-4 flex-shrink-0" />
          <span className="hidden sm:inline">Export</span>
        </button>
      </div>

    </div>
  );
}
