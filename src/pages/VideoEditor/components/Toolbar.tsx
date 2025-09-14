import type { PlayerHandle } from "./Player";

interface ToolbarProps {
  onPickFile: () => void;
  onOpenCommand: () => void;
  onAccept: () => void;
  onReject: () => void;
  onExport: () => void;
  onTogglePlay: () => void;
  onSeek: (t: number) => void;
  hasProbe: boolean;
  hasPreviewCuts: boolean;
  hasAcceptedCuts: boolean;
  editedRef: React.RefObject<PlayerHandle | null>;
}

function Toolbar({
  onPickFile,
  onOpenCommand,
  onAccept,
  onReject,
  onExport,
  onTogglePlay,
  onSeek,
  hasProbe,
  hasPreviewCuts,
  hasAcceptedCuts,
  editedRef
}: ToolbarProps) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <button onClick={onPickFile} className="px-3 py-2 rounded bg-cyan-600 text-white">
        Open video
      </button>
      <button onClick={onOpenCommand} disabled={!hasProbe} className="px-3 py-2 rounded bg-zinc-800 text-zinc-200 disabled:opacity-50">
        ⌘K Command
      </button>
      <button onClick={onAccept} disabled={!hasPreviewCuts} className="px-3 py-2 rounded bg-green-600 text-white disabled:opacity-50">
        Accept
      </button>
      <button onClick={onReject} disabled={!hasPreviewCuts} className="px-3 py-2 rounded bg-zinc-800 text-zinc-200 disabled:opacity-50">
        Reject
      </button>
      <button onClick={onExport} disabled={!hasAcceptedCuts} className="px-3 py-2 rounded bg-indigo-600 text-white disabled:opacity-50">
        Export MP4
      </button>

      {/* Shared transport */}
      <div className="ml-auto flex items-center gap-2">
        <button onClick={onTogglePlay} className="px-3 py-2 rounded bg-zinc-800 text-zinc-200">
          Play/Pause
        </button>
        <button
          onClick={() => onSeek(Math.max(0, (editedRef.current?.currentTime() || 0) - 1))}
          className="px-2 py-2 rounded bg-zinc-800 text-zinc-200"
        >
          -1s
        </button>
        <button
          onClick={() => onSeek((editedRef.current?.currentTime() || 0) + 1)}
          className="px-2 py-2 rounded bg-zinc-800 text-zinc-200"
        >
          +1s
        </button>
      </div>
    </div>
  );
}

export default Toolbar;