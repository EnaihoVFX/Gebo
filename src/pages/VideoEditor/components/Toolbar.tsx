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
          className="group h-8 px-2 sm:px-3 lg:px-4 text-white/80 hover:text-white disabled:opacity-50 transition-all duration-300 hover:scale-105 text-xs sm:text-sm font-medium flex items-center gap-1.5 rounded-xl relative overflow-hidden disabled:cursor-not-allowed"
          style={{
            background: acceptedCuts.length ? 'linear-gradient(135deg, rgba(39, 39, 42, 0.6) 0%, rgba(63, 63, 70, 0.55) 25%, rgba(39, 39, 42, 0.5) 50%, rgba(24, 24, 27, 0.45) 75%, rgba(9, 9, 11, 0.4) 100%)' : 'rgba(39, 39, 42, 0.3)',
            backdropFilter: 'blur(20px) saturate(1.6)',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.1)'
          }}
          onMouseEnter={(e) => {
            if (acceptedCuts.length) {
              e.currentTarget.style.background = 'linear-gradient(135deg, rgba(39, 39, 42, 0.7) 0%, rgba(63, 63, 70, 0.65) 25%, rgba(39, 39, 42, 0.6) 50%, rgba(24, 24, 27, 0.55) 75%, rgba(9, 9, 11, 0.5) 100%)';
              e.currentTarget.style.transform = 'translateY(-1px) scale(1.05)';
              e.currentTarget.style.boxShadow = '0 4px 16px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2)';
            }
          }}
          onMouseLeave={(e) => {
            if (acceptedCuts.length) {
              e.currentTarget.style.background = 'linear-gradient(135deg, rgba(39, 39, 42, 0.6) 0%, rgba(63, 63, 70, 0.55) 25%, rgba(39, 39, 42, 0.5) 50%, rgba(24, 24, 27, 0.45) 75%, rgba(9, 9, 11, 0.4) 100%)';
              e.currentTarget.style.transform = 'translateY(0px) scale(1)';
              e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.1)';
            }
          }}>
          <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-xl"></div>
          <Download className="w-4 h-4 flex-shrink-0 relative z-10" />
          <span className="hidden sm:inline relative z-10">Export</span>
        </button>
      </div>

    </div>
  );
}
