import { useState } from "react";
import type { Range } from "../types";

interface SidebarProps {
  debug: string;
  filePath: string;
  previewUrl: string;
  probe: any;
  peaks: number[];
  acceptedCuts: Range[];
  previewCuts: Range[];
}

export function Sidebar({
  debug,
  filePath,
  previewUrl,
  probe,
  peaks,
  acceptedCuts,
  previewCuts,
}: SidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <div className={`${isCollapsed ? 'w-12' : 'w-full'} bg-zinc-900 border-r border-zinc-800 flex flex-col transition-all duration-300 h-full`}>
      {/* Header */}
      <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
        {!isCollapsed && <h2 className="text-sm font-medium text-zinc-200">Logs & Debug</h2>}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="p-1 text-zinc-400 hover:text-zinc-200 transition-colors"
          title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {isCollapsed ? "→" : "←"}
        </button>
      </div>

      {!isCollapsed && (
        <>
          {/* Logs Section */}
          <div className="flex-1 overflow-hidden flex flex-col">
            <div className="p-3 border-b border-zinc-800">
              <h3 className="text-xs font-medium text-zinc-300 mb-2">Activity Log</h3>
            </div>
            <div className="flex-1 overflow-y-auto p-3">
              <pre className="text-xs text-zinc-400 whitespace-pre-wrap leading-relaxed">
                {debug || "Logs will appear here…"}
              </pre>
            </div>
          </div>

          {/* Debug Info Section */}
          <div className="border-t border-zinc-800">
            <div className="p-3 border-b border-zinc-800">
              <h3 className="text-xs font-medium text-zinc-300 mb-2">Debug Info</h3>
            </div>
            <div className="p-3 space-y-2">
              <div className="text-xs">
                <span className="text-zinc-500">File Path:</span>
                <div className="text-zinc-400 break-all">{filePath || "None"}</div>
              </div>
              <div className="text-xs">
                <span className="text-zinc-500">Preview URL:</span>
                <div className="text-zinc-400 break-all">{previewUrl || "None"}</div>
              </div>
              <div className="text-xs">
                <span className="text-zinc-500">Probe:</span>
                <div className="text-zinc-400">{probe ? `Duration: ${probe.duration}s` : "None"}</div>
              </div>
              <div className="text-xs">
                <span className="text-zinc-500">Peaks:</span>
                <div className="text-zinc-400">{peaks.length} samples</div>
              </div>
              <div className="text-xs">
                <span className="text-zinc-500">Accepted Cuts:</span>
                <div className="text-zinc-400">{acceptedCuts.length}</div>
              </div>
              <div className="text-xs">
                <span className="text-zinc-500">Preview Cuts:</span>
                <div className="text-zinc-400">{previewCuts.length}</div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
