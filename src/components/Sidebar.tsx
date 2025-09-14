import { useState } from "react";
import { Chat } from "./Chat";
import type { Range } from "../types";

interface SidebarProps {
  debug: string;
  filePath: string;
  previewUrl: string;
  probe: any;
  peaks: number[];
  acceptedCuts: Range[];
  previewCuts: Range[];
  onExecuteCommand: (command: string) => void;
  onAcceptPlan: () => void;
  onRejectPlan: () => void;
}

export function Sidebar({
  debug,
  filePath,
  previewUrl,
  probe,
  peaks,
  acceptedCuts,
  previewCuts,
  onExecuteCommand,
  onAcceptPlan,
  onRejectPlan,
}: SidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isLogExpanded, setIsLogExpanded] = useState(false);
  const [isDebugExpanded, setIsDebugExpanded] = useState(false);

  return (
    <div className={`${isCollapsed ? 'w-12' : 'w-full'} bg-zinc-900 border-r border-zinc-800 flex flex-col transition-all duration-300 h-full min-h-0`}>
      {/* Header */}
      <div className="p-4 border-b border-zinc-800 flex items-center justify-end">
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
          {/* Chat Section - Main Focus */}
          <div className="flex-1 overflow-hidden flex flex-col">
            <Chat
              onExecuteCommand={onExecuteCommand}
              previewCuts={previewCuts}
              acceptedCuts={acceptedCuts}
              previewUrl={previewUrl}
              onAcceptPlan={onAcceptPlan}
              onRejectPlan={onRejectPlan}
            />
          </div>

          {/* Activity Log Section - Collapsible */}
          <div className="border-t border-zinc-800">
            <div 
              className="p-3 border-b border-zinc-800 cursor-pointer hover:bg-zinc-800 transition-colors"
              onClick={() => setIsLogExpanded(!isLogExpanded)}
            >
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-medium text-zinc-300">Activity Log</h3>
                <span className="text-zinc-500 text-xs">
                  {isLogExpanded ? "▼" : "▶"}
                </span>
              </div>
            </div>
            {isLogExpanded && (
              <div className="max-h-32 overflow-y-auto p-3">
                <pre className="text-xs text-zinc-400 whitespace-pre-wrap leading-relaxed">
                  {debug || "Logs will appear here…"}
                </pre>
              </div>
            )}
          </div>

          {/* Debug Info Section - Collapsible */}
          <div className="border-t border-zinc-800">
            <div 
              className="p-3 border-b border-zinc-800 cursor-pointer hover:bg-zinc-800 transition-colors"
              onClick={() => setIsDebugExpanded(!isDebugExpanded)}
            >
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-medium text-zinc-300">Debug Info</h3>
                <span className="text-zinc-500 text-xs">
                  {isDebugExpanded ? "▼" : "▶"}
                </span>
              </div>
            </div>
            {isDebugExpanded && (
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
            )}
          </div>
        </>
      )}
    </div>
  );
}
