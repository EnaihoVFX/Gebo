import { useState } from "react";
import { 
  X,
  Plus,
  History,
  MoreHorizontal
} from "lucide-react";
import { Chat } from "./Chat";
import type { Range } from "../../../types";

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

  return (
    <div className={`${isCollapsed ? 'w-12' : 'w-full'} bg-slate-800 rounded-lg flex flex-col transition-all duration-300 h-full min-h-0 overflow-hidden`}>
      {!isCollapsed ? (
        <>
          {/* Header */}
          <div className="px-3 sm:px-4 py-1 sm:py-1.5 border-b border-slate-700 bg-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="px-2 py-1 bg-slate-600 text-white text-xs rounded">Chat</div>
            </div>
            <div className="flex items-center gap-1">
              <button className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-700 transition-colors rounded-lg border-0 p-0" title="New Chat">
                <Plus className="w-4 h-4 flex-shrink-0" />
              </button>
              <button className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-700 transition-colors rounded-lg border-0 p-0" title="History">
                <History className="w-4 h-4 flex-shrink-0" />
              </button>
              <button className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-700 transition-colors rounded-lg border-0 p-0" title="More Options">
                <MoreHorizontal className="w-4 h-4 flex-shrink-0" />
              </button>
              <button className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-700 transition-colors rounded-lg border-0 p-0" title="Close">
                <X className="w-4 h-4 flex-shrink-0" />
              </button>
            </div>
          </div>
          
          {/* Chat Content */}
          <div className="flex-1 overflow-hidden flex flex-col bg-slate-900 pt-0.5">
            <Chat
              onExecuteCommand={onExecuteCommand}
              previewCuts={previewCuts}
              acceptedCuts={acceptedCuts}
              previewUrl={previewUrl}
              onAcceptPlan={onAcceptPlan}
              onRejectPlan={onRejectPlan}
            />
          </div>
        </>
      ) : (
        <div className="flex items-center justify-center h-full">
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-700 transition-colors rounded-lg border-0 p-0"
            title="Expand sidebar"
          >
            <X className="w-4 h-4 flex-shrink-0" />
          </button>
        </div>
      )}
    </div>
  );
}
