import { 
  Undo2, 
  Redo2, 
  Download
} from "lucide-react";
import type { Range } from "../../../types";

interface ToolbarProps {
  onExport: () => void;
  onUndo: () => void;
  onRedo: () => void;
  acceptedCuts: Range[];
}

export function Toolbar({
  onExport,
  onUndo,
  onRedo,
  acceptedCuts,
}: ToolbarProps) {
  return (
    <div className="flex items-center gap-1 sm:gap-2 lg:gap-3 overflow-x-auto">

      {/* Editing Tools - Hidden on small screens */}
      <div className="hidden sm:flex items-center gap-0.5 lg:gap-1 flex-shrink-0">
        <button 
          onClick={onUndo} 
          className="w-8 h-8 flex items-center justify-center rounded-lg bg-editor-bg-tertiary text-editor-text-primary hover:bg-editor-interactive-hover transition-colors border-0 p-0"
          title="Undo (Ctrl+Z)"
        >
          <Undo2 className="w-4 h-4 flex-shrink-0" />
        </button>
        <button 
          onClick={onRedo} 
          className="w-8 h-8 flex items-center justify-center rounded-lg bg-editor-bg-tertiary text-editor-text-primary hover:bg-editor-interactive-hover transition-colors border-0 p-0"
          title="Redo (Ctrl+Y)"
        >
          <Redo2 className="w-4 h-4 flex-shrink-0" />
        </button>
      </div>

      {/* Separator - Hidden on small screens */}
      <div className="hidden lg:block w-px h-6 bg-editor-bg-tertiary flex-shrink-0"></div>

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
