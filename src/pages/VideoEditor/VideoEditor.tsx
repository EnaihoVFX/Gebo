import { useEffect, useRef, useState, useCallback } from "react";
import type { Probe } from "../../lib/ffmpeg";
import { mergeRanges, type Range } from "./utils/videoUtils";
import { parseCommand } from "./utils/commandUtils";
import { processVideoFile, exportVideo, pickVideoFile } from "./utils/fileUtils";
import Player, { type PlayerHandle } from "./components/Player";
import WaveformCanvas from "./components/WaveformCanvas";
import Toolbar from "./components/Toolbar";
import CommandDialog from "./components/CommandDialog";
import { useNavigate } from 'react-router-dom';
import DebugProjectFileInfo from "./components/DebugProjectFileInfo";

export default function VideoEditor() {
  // Navigator (for back to home button)
  const navigate = useNavigate();

  // File + media
  const [filePath, setFilePath] = useState<string>("");
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const [probe, setProbe] = useState<Probe | null>(null);
  const [peaks, setPeaks] = useState<number[]>([]);

  // Edits
  const [previewCuts, setPreviewCuts] = useState<Range[]>([]);
  const [acceptedCuts, setAcceptedCuts] = useState<Range[]>([]);

  // UI state
  const [showCommandDialog, setShowCommandDialog] = useState(false);
  const [debug, setDebug] = useState<string>("");

  // Refs
  const editedRef = useRef<PlayerHandle>(null);
  const proposedRef = useRef<PlayerHandle>(null);

  const log = (message: string) =>
    setDebug(prev => (prev ? prev + "\n" : "") + message);

  // Playback controls
  const playBoth = () => {
    editedRef.current?.play();
    proposedRef.current?.play();
  };

  const pauseBoth = () => {
    editedRef.current?.pause();
    proposedRef.current?.pause();
  };

  const togglePlay = useCallback(() => {
    if (editedRef.current?.isPlaying() || proposedRef.current?.isPlaying()) {
      pauseBoth();
    } else {
      playBoth();
    }
  }, []);

  const seekBoth = (time: number) => {
    editedRef.current?.seek(time);
    proposedRef.current?.seek(time);
  };

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setShowCommandDialog(true);
      } else if (e.key === " ") {
        e.preventDefault();
        togglePlay();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [togglePlay]);

  // File operations
  const pickFile = async () => {
    try {
      const selectedFile = await pickVideoFile();
      if (!selectedFile) return;

      setDebug("");
      setFilePath(selectedFile);
      setAcceptedCuts([]);
      setPreviewCuts([]);

      log(`Selected file: ${selectedFile}`);

      const result = await processVideoFile(selectedFile);
      setPreviewUrl(result.previewUrl);
      setProbe(result.probe);
      setPeaks(result.peaks);

      log(`Probed: dur=${result.probe.duration.toFixed(2)}s fps=${result.probe.fps.toFixed(2)} rate=${result.probe.audio_rate} codec=${result.probe.v_codec}/${result.probe.a_codec}`);
      log(`Peaks: ${result.peaks.length}`);

      // Seek both players to 0 after loading
      setTimeout(() => {
        editedRef.current?.seek(0);
        proposedRef.current?.seek(0);
      }, 100);
    } catch (e: unknown) {
      log(`File processing failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  // Command execution
  const executeCommand = (command: string) => {
    if (!command || !probe) return;

    const ranges = parseCommand(command, probe, peaks);
    if (ranges) {
      setPreviewCuts(ranges);
      log(`Preview: ${command} → ${ranges.length} cuts`);
    } else {
      alert('Try: "tighten silence > 2 leave 150ms", "remove silence > 2", or "cut 12.5 - 14.0"');
    }
  };

  // Edit operations
  const acceptPlan = () => {
    setAcceptedCuts(mergeRanges([...acceptedCuts, ...previewCuts]));
    setPreviewCuts([]);
    log(`Accepted. Total accepted cuts: ${acceptedCuts.length + previewCuts.length}`);
  };

  const rejectPlan = () => {
    setPreviewCuts([]);
  };

  const handleExport = async () => {
    if (!filePath || !acceptedCuts.length) {
      alert("No accepted cuts yet.");
      return;
    }

    try {
      const savePath = await exportVideo(filePath, acceptedCuts);
      if (savePath) {
        alert("Export complete: " + savePath);
        log("Exported to " + savePath);
      }
    } catch (e: unknown) {
      log(`Export failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const duration = probe?.duration || 0;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-4 space-y-3">
      <DebugProjectFileInfo /> 
      <Toolbar
        onPickFile={pickFile}
        onOpenCommand={() => setShowCommandDialog(true)}
        onAccept={acceptPlan}
        onReject={rejectPlan}
        onExport={handleExport}
        onTogglePlay={togglePlay}
        onSeek={seekBoth}
        hasProbe={!!probe}
        hasPreviewCuts={previewCuts.length > 0}
        hasAcceptedCuts={acceptedCuts.length > 0}
        editedRef={editedRef}
      />

      {previewUrl ? (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-4">
            <Player
              ref={editedRef}
              src={previewUrl}
              label="Edited (Accepted timeline)"
              cuts={acceptedCuts}
              large
            />
            <Player
              ref={proposedRef}
              src={previewUrl}
              label="Proposed (Accepted + Preview)"
              cuts={[...acceptedCuts, ...previewCuts]}
            />
          </div>

          <div className="rounded border border-zinc-800 p-2">
            <div className="text-xs mb-2 text-zinc-400">Timeline</div>
            <WaveformCanvas
              peaks={peaks}
              duration={duration}
              accepted={acceptedCuts}
              preview={previewCuts}
              onSeek={seekBoth}
            />
            <div className="text-xs text-zinc-400 mt-2">
              Accepted: {acceptedCuts.length} • Preview: {previewCuts.length}
            </div>
          </div>
        </>
      ) : (
        <div className="text-center py-12 text-zinc-400">
          <p>No video loaded. Click "Open video" to select a video file.</p>
        </div>
      )}

      <button onClick={() => navigate('/')}>DEBUG Go to Home</button>

      <CommandDialog
        isOpen={showCommandDialog}
        onClose={() => setShowCommandDialog(false)}
        onExecute={(command) => {
          executeCommand(command);
          setShowCommandDialog(false);
        }}
      />

      <pre className="mt-2 text-xs text-zinc-400 bg-zinc-900 border border-zinc-800 p-3 rounded whitespace-pre-wrap">
        {debug || "Logs will appear here…"}
      </pre>
    </div>
  );
}