import type { Range } from "../../../types";

interface DebugPanelProps {
  debug: string;
  filePath: string;
  previewUrl: string;
  probe: any;
  peaks: number[];
  acceptedCuts: Range[];
  previewCuts: Range[];
}

export function DebugPanel({
  debug,
  filePath,
  previewUrl,
  probe,
  peaks,
  acceptedCuts,
  previewCuts,
}: DebugPanelProps) {
  return (
    <>
      <pre className="mt-2 text-xs text-zinc-400 bg-zinc-900 border border-zinc-800 p-3 rounded whitespace-pre-wrap">
        {debug || "Logs will appear here…"}
      </pre>

      {/* Debug info */}
      <div className="mt-2 text-xs text-zinc-500 bg-zinc-900 border border-zinc-800 p-3 rounded">
        <div>Debug Info:</div>
        <div>File Path: {filePath || "None"}</div>
        <div>Preview URL: {previewUrl || "None"}</div>
        <div>Probe: {probe ? `Duration: ${probe.duration}s` : "None"}</div>
        <div>Peaks: {peaks.length} samples</div>
        <div>Accepted Cuts: {acceptedCuts.length}</div>
        <div>Preview Cuts: {previewCuts.length}</div>
      </div>
    </>
  );
}
