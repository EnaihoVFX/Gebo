import { 
  Download
} from "lucide-react";
import type { Range } from "../../../types";

interface ToolbarProps {
  onExport: () => void;
  acceptedCuts: Range[];
}

export function Toolbar({
  onExport,
  acceptedCuts,
}: ToolbarProps) {
  return (
    <div className="flex items-center gap-1 sm:gap-2 lg:gap-3 overflow-x-auto">

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
