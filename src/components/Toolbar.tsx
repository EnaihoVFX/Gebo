import { useState } from "react";
import type { Range } from "../types";

interface ToolbarProps {
  onPickFile: () => void;
  onResetApp: () => void;
  onTestSampleVideo: () => void;
  onUseLocalFileBlob: () => void;
  onTryFileProtocol: () => void;
  onClearVideo: () => void;
  onTestFileAccess: () => void;
  onForceProxy: () => void;
  onCopyToAppData: () => void;
  onTryBlobUrl: () => void;
  onCreateBlobFromChunks: () => void;
  onTryDataUrl: () => void;
  onOpenCommand: () => void;
  onAcceptPlan: () => void;
  onRejectPlan: () => void;
  onExport: () => void;
  onTogglePlay: () => void;
  onSeekBack: () => void;
  onSeekForward: () => void;
  onClearAllCuts: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onMarkIn: () => void;
  onMarkOut: () => void;
  filePath: string;
  probe: any;
  previewCuts: Range[];
  acceptedCuts: Range[];
  editedRef: React.RefObject<any>;
}

export function Toolbar({
  onPickFile,
  onResetApp,
  onTestSampleVideo,
  onUseLocalFileBlob,
  onTryFileProtocol,
  onClearVideo,
  onTestFileAccess,
  onForceProxy,
  onCopyToAppData,
  onTryBlobUrl,
  onCreateBlobFromChunks,
  onTryDataUrl,
  onOpenCommand,
  onAcceptPlan,
  onRejectPlan,
  onExport,
  onTogglePlay,
  onSeekBack,
  onSeekForward,
  onClearAllCuts,
  onUndo,
  onRedo,
  onMarkIn,
  onMarkOut,
  filePath,
  probe,
  previewCuts,
  acceptedCuts,
  editedRef,
}: ToolbarProps) {
  const [showDebugButtons, setShowDebugButtons] = useState(false);

  return (
    <div className="flex items-center gap-2 flex-wrap p-2">
      {/* Essential buttons */}
      <button onClick={onPickFile} className="px-3 py-2 rounded bg-cyan-600 text-white hover:bg-cyan-700">Open video</button>
      <button onClick={onTestSampleVideo} className="px-3 py-2 rounded bg-blue-600 text-white hover:bg-blue-700">Test Sample</button>
      <button onClick={onResetApp} className="px-3 py-2 rounded bg-gray-600 text-white hover:bg-gray-700">Reset</button>
      
      {/* Debug toggle */}
      <button 
        onClick={() => setShowDebugButtons(!showDebugButtons)} 
        className="px-3 py-2 rounded bg-zinc-700 text-zinc-300 hover:bg-zinc-600 text-sm"
      >
        {showDebugButtons ? "Hide Debug" : "Debug"}
      </button>

      {/* Debug buttons - only show when toggled */}
      {showDebugButtons && (
        <>
          <button onClick={onUseLocalFileBlob} disabled={!filePath} className="px-3 py-2 rounded bg-green-600 text-white disabled:opacity-50 hover:bg-green-700 text-sm">Use Blob</button>
          <button onClick={onTryFileProtocol} disabled={!filePath} className="px-3 py-2 rounded bg-teal-600 text-white disabled:opacity-50 hover:bg-teal-700 text-sm">File Protocol</button>
          <button onClick={onClearVideo} className="px-3 py-2 rounded bg-yellow-600 text-white hover:bg-yellow-700 text-sm">Clear</button>
          <button onClick={onTestFileAccess} disabled={!filePath} className="px-3 py-2 rounded bg-yellow-600 text-white disabled:opacity-50 hover:bg-yellow-700 text-sm">Test Access</button>
          <button onClick={onForceProxy} disabled={!filePath} className="px-3 py-2 rounded bg-purple-600 text-white disabled:opacity-50 hover:bg-purple-700 text-sm">Force Proxy</button>
          <button onClick={onCopyToAppData} disabled={!filePath} className="px-3 py-2 rounded bg-indigo-600 text-white disabled:opacity-50 hover:bg-indigo-700 text-sm">Copy to App Data</button>
          <button onClick={onTryBlobUrl} disabled={!filePath} className="px-3 py-2 rounded bg-orange-600 text-white disabled:opacity-50 hover:bg-orange-700 text-sm">Try Blob URL</button>
          <button onClick={onCreateBlobFromChunks} disabled={!filePath} className="px-3 py-2 rounded bg-pink-600 text-white disabled:opacity-50 hover:bg-pink-700 text-sm">Blob from Chunks</button>
          <button onClick={onTryDataUrl} disabled={!filePath || !probe} className="px-3 py-2 rounded bg-red-600 text-white disabled:opacity-50 hover:bg-red-700 text-sm">Data URL</button>
        </>
      )}

      {/* Main workflow buttons */}
      <button onClick={onOpenCommand} disabled={!probe} className="px-3 py-2 rounded bg-zinc-800 text-zinc-200 disabled:opacity-50 hover:bg-zinc-700">⌘K Command</button>
      <button onClick={onAcceptPlan} disabled={!previewCuts.length} className="px-3 py-2 rounded bg-green-600 text-white disabled:opacity-50 hover:bg-green-700">Accept</button>
      <button onClick={onRejectPlan} disabled={!previewCuts.length} className="px-3 py-2 rounded bg-zinc-800 text-zinc-200 disabled:opacity-50 hover:bg-zinc-700">Reject</button>
      
      {/* Manual editing tools */}
      <button onClick={onUndo} className="px-3 py-2 rounded bg-zinc-800 text-zinc-200 hover:bg-zinc-700" title="Undo (Ctrl+Z)">↶</button>
      <button onClick={onRedo} className="px-3 py-2 rounded bg-zinc-800 text-zinc-200 hover:bg-zinc-700" title="Redo (Ctrl+Y)">↷</button>
      <button onClick={onMarkIn} disabled={!probe} className="px-3 py-2 rounded bg-blue-600 text-white disabled:opacity-50 hover:bg-blue-700" title="Mark In Point (I)">I</button>
      <button onClick={onMarkOut} disabled={!probe} className="px-3 py-2 rounded bg-blue-600 text-white disabled:opacity-50 hover:bg-blue-700" title="Mark Out Point (O)">O</button>
      <button onClick={onClearAllCuts} disabled={!acceptedCuts.length} className="px-3 py-2 rounded bg-red-600 text-white disabled:opacity-50 hover:bg-red-700" title="Clear All Cuts">Clear All</button>
      
      <button onClick={onExport} disabled={!acceptedCuts.length} className="px-3 py-2 rounded bg-indigo-600 text-white disabled:opacity-50 hover:bg-indigo-700">Export MP4</button>

      {/* Transport controls */}
      <div className="ml-auto flex items-center gap-2">
        <button onClick={onTogglePlay} className="px-3 py-2 rounded bg-zinc-800 text-zinc-200 hover:bg-zinc-700">Play/Pause</button>
        <button onClick={onSeekBack} className="px-2 py-2 rounded bg-zinc-800 text-zinc-200 hover:bg-zinc-700">-1s</button>
        <button onClick={onSeekForward} className="px-2 py-2 rounded bg-zinc-800 text-zinc-200 hover:bg-zinc-700">+1s</button>
      </div>
    </div>
  );
}
