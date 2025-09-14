import { useEffect, useRef, useState } from "react";
// import { save } from "@tauri-apps/plugin-dialog"; // Removed unused import
import { convertFileSrc } from "@tauri-apps/api/core";
import { exportCutlist, makePreviewProxy, readFileAsBase64, copyToAppData } from "./lib/ffmpeg";
import type { Range, PlayerHandle } from "./types";
import { Player } from "./components/Player";
import { AdvancedTimeline } from "./components/AdvancedTimeline";
import { VideoTimeline } from "./components/VideoTimeline";
import { CommandDialog } from "./components/CommandDialog";
import { Sidebar } from "./components/Sidebar";
import { Toolbar } from "./components/Toolbar";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { PrecisionControls } from "./components/PrecisionControls";
import { ExportDialog } from "./components/ExportDialog";
import { useFileHandling } from "./hooks/useFileHandling";
import { useWaveformLogic } from "./hooks/useWaveformLogic";
import { useCommandLogic } from "./hooks/useCommandLogic";

export default function App() {
  // Edits
  const [previewCuts, setPreviewCuts] = useState<Range[]>([]);
  const [acceptedCuts, setAcceptedCuts] = useState<Range[]>([]);
  
  // Undo/Redo system
  const [editHistory, setEditHistory] = useState<Range[][]>([[]]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [inOutPoints, setInOutPoints] = useState<{ in: number | null; out: number | null }>({ in: null, out: null });
  
  // Export dialog
  const [showExportDialog, setShowExportDialog] = useState(false);
  
  // Timeline view mode
  const [useAdvancedTimeline, setUseAdvancedTimeline] = useState(true);
  
  // Mobile debug panel
  const [showMobileDebug, setShowMobileDebug] = useState(false);

  // Players control
  const editedRef = useRef<PlayerHandle>(null);

  // Custom hooks
  const {
    filePath,
    previewUrl,
    probe,
    peaks,
    debug,
    log,
    setPreviewUrl,
    createBlobFromFile,
    pickFile,
    resetApp,
  } = useFileHandling();

  const { mergeRanges, detectSilences, tightenSilences } = useWaveformLogic(probe, peaks);

  const {
    showCommandDialog,
    commandInput,
    setCommandInput,
    setShowCommandDialog,
    openCommand,
    executeCommand,
  } = useCommandLogic(probe, log);


  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        openCommand();
      } else if (e.key === " ") {
        // Check if we're in an input field (including contenteditable)
        const target = e.target as HTMLElement;
        const isInputField = target instanceof HTMLInputElement || 
                           target instanceof HTMLTextAreaElement ||
                           target.contentEditable === 'true' ||
                           target.closest('[contenteditable="true"]') ||
                           target.closest('input') ||
                           target.closest('textarea');
        
        // Also check if the active element is an input
        const activeElement = document.activeElement;
        const isActiveInput = activeElement instanceof HTMLInputElement || 
                            activeElement instanceof HTMLTextAreaElement ||
                            (activeElement as HTMLElement)?.contentEditable === 'true';
        
        if (!isInputField && !isActiveInput) {
          // space toggles play/pause when not in input fields
          e.preventDefault();
          togglePlay();
        }
      }
    };
    
    // Prevent scroll-related rendering issues
    const onScroll = () => {
      // Force a small delay to prevent rendering issues during scroll
      requestAnimationFrame(() => {
        // This ensures the DOM is stable during scroll
      });
    };
    
    window.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, { passive: true });
    
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  // ---------- File handling ----------
  const handlePickFile = async () => {
    const selectedFile = await pickFile();
    if (selectedFile) {
      setAcceptedCuts([]);
      setPreviewCuts([]);
      // Seek player to 0 after a short delay to ensure video is loaded
      setTimeout(() => {
        editedRef.current?.seek(0);
      }, 100);
    }
  };

  const handleResetApp = () => {
    resetApp();
    setAcceptedCuts([]);
    setPreviewCuts([]);
  };

  // ---------- Commands ----------
  const handleExecuteCommand = (command: string) => {
    executeCommand(
      command,
      setCommandInput,
      setShowCommandDialog,
      setPreviewCuts,
      tightenSilences,
      detectSilences
    );
  };

  const acceptPlan = () => {
    const newAcceptedCuts = mergeRanges([...acceptedCuts, ...previewCuts]);
    setAcceptedCuts(newAcceptedCuts);
    setPreviewCuts([]);
    saveToHistory(newAcceptedCuts);
    log(`Accepted. Total accepted cuts: ${newAcceptedCuts.length}`);
  };
  const rejectPlan = () => { setPreviewCuts([]); };

  // Undo/Redo system
  const saveToHistory = (newCuts: Range[]) => {
    const newHistory = editHistory.slice(0, historyIndex + 1);
    newHistory.push([...newCuts]);
    setEditHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  };

  const undo = () => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      setAcceptedCuts([...editHistory[newIndex]]);
      log(`Undo: Restored ${editHistory[newIndex].length} cuts`);
    }
  };

  const redo = () => {
    if (historyIndex < editHistory.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      setAcceptedCuts([...editHistory[newIndex]]);
      log(`Redo: Restored ${editHistory[newIndex].length} cuts`);
    }
  };

  // Manual cut management
  const handleAddCut = (range: Range) => {
    setPreviewCuts([...previewCuts, range]);
    log(`Manual cut added: ${range.start.toFixed(2)}s - ${range.end.toFixed(2)}s`);
  };

  const handleRemoveCut = (index: number) => {
    if (index >= 0 && index < acceptedCuts.length) {
      const removedCut = acceptedCuts[index];
      const newAcceptedCuts = acceptedCuts.filter((_, i) => i !== index);
      setAcceptedCuts(newAcceptedCuts);
      saveToHistory(newAcceptedCuts);
      log(`Removed cut ${index + 1}: ${removedCut.start.toFixed(2)}s - ${removedCut.end.toFixed(2)}s`);
    }
  };

  const clearAllCuts = () => {
    if (acceptedCuts.length > 0) {
      setAcceptedCuts([]);
      setPreviewCuts([]);
      saveToHistory([]);
      log("Cleared all cuts");
    }
  };

  // Mark In/Out functionality
  const markIn = () => {
    const currentTime = editedRef.current?.currentTime() || 0;
    setInOutPoints(prev => ({ ...prev, in: currentTime }));
    log(`Mark In: ${currentTime.toFixed(2)}s`);
  };

  const markOut = () => {
    const currentTime = editedRef.current?.currentTime() || 0;
    setInOutPoints(prev => ({ ...prev, out: currentTime }));
    log(`Mark Out: ${currentTime.toFixed(2)}s`);
    
    // If both in and out are set, create a cut
    if (inOutPoints.in !== null && currentTime > inOutPoints.in) {
      const range = { start: inOutPoints.in, end: currentTime };
      handleAddCut(range);
    }
  };

  // ---------- Export ----------
  const onExport = async () => {
    if (!filePath || !probe) return;
    if (!acceptedCuts.length) { 
      alert("No accepted cuts yet."); 
      return; 
    }
    setShowExportDialog(true);
  };

  const handleExportWithOptions = async (savePath: string, options: any) => {
    try {
      // For now, use the basic exportCutlist function
      // In a real implementation, you would modify FFmpeg parameters based on options
      await exportCutlist(filePath, savePath, acceptedCuts);
      log(`Exported to ${savePath} with options: ${JSON.stringify(options)}`);
    } catch (error) {
      console.error('Export failed:', error);
      throw error;
    }
  };

  // ---------- Playback controls ----------
  const playVideo = () => { editedRef.current?.play(); };
  const pauseVideo = () => { editedRef.current?.pause(); };
  const togglePlay = () => {
    if (editedRef.current?.isPlaying()) pauseVideo();
    else playVideo();
  };
  const seekVideo = (t: number) => { editedRef.current?.seek(t); };

  // Frame-by-frame navigation
  const frameStep = (direction: 'forward' | 'backward') => {
    const currentTime = editedRef.current?.currentTime() || 0;
    const frameRate = probe?.fps || 30;
    const frameDuration = 1 / frameRate;
    const newTime = direction === 'forward' 
      ? currentTime + frameDuration 
      : Math.max(0, currentTime - frameDuration);
    seekVideo(newTime);
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle shortcuts when typing in input fields
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      const isCtrl = e.ctrlKey || e.metaKey;
      const currentTime = editedRef.current?.currentTime() || 0;

      switch (e.key.toLowerCase()) {
        case ' ':
          e.preventDefault();
          togglePlay();
          break;
        case 'i':
          e.preventDefault();
          markIn();
          break;
        case 'o':
          e.preventDefault();
          markOut();
          break;
        case 'z':
          if (isCtrl) {
            e.preventDefault();
            if (e.shiftKey) {
              redo();
            } else {
              undo();
            }
          }
          break;
        case 'y':
          if (isCtrl) {
            e.preventDefault();
            redo();
          }
          break;
        case 'arrowleft':
          e.preventDefault();
          if (e.shiftKey) {
            seekVideo(Math.max(0, currentTime - 10)); // 10 second jump
          } else {
            seekVideo(Math.max(0, currentTime - 1)); // 1 second jump
          }
          break;
        case 'arrowright':
          e.preventDefault();
          if (e.shiftKey) {
            seekVideo(currentTime + 10); // 10 second jump
          } else {
            seekVideo(currentTime + 1); // 1 second jump
          }
          break;
        case ',':
          e.preventDefault();
          frameStep('backward');
          break;
        case '.':
          e.preventDefault();
          frameStep('forward');
          break;
        case 'home':
          e.preventDefault();
          seekVideo(0);
          break;
        case 'end':
          e.preventDefault();
          seekVideo(probe?.duration || 0);
          break;
        case 'enter':
          if (e.shiftKey) {
            e.preventDefault();
            acceptPlan();
          }
          break;
        case 'escape':
          e.preventDefault();
          rejectPlan();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [probe, undo, redo, markIn, markOut, togglePlay, acceptPlan, rejectPlan]);

  const duration = probe?.duration || 0;

  // ---------- Toolbar handlers ----------
  const handleTestSampleVideo = () => {
    const testUrl = "https://sample-videos.com/zip/10/mp4/SampleVideo_1280x720_1mb.mp4";
    setPreviewUrl(testUrl);
    log(`Testing with sample video: ${testUrl}`);
  };

  const handleUseLocalFileBlob = async () => {
    if (filePath) {
      try {
        log(`Creating blob URL for local file...`);
        const blobUrl = await createBlobFromFile(filePath);
        setPreviewUrl(blobUrl);
        log(`Using local file blob URL: ${blobUrl}`);
      } catch (e: any) {
        log(`Blob creation failed: ${e?.toString?.() || e}`);
      }
    }
  };

  const handleTryFileProtocol = () => {
    if (filePath) {
      const fileUrl = `file://${filePath}`;
      setPreviewUrl(fileUrl);
      log(`Using file:// URL: ${fileUrl}`);
    }
  };

  const handleClearVideo = () => {
    setPreviewUrl("");
    log("Cleared preview URL - video players should be empty now");
  };

  const handleTestFileAccess = () => {
    if (filePath) {
      log(`Raw file path: ${filePath}`);
      log(`File exists check: ${filePath}`);
      // Test if we can access the file directly
      fetch(convertFileSrc(filePath))
        .then(response => {
          log(`File fetch response: ${response.status} ${response.statusText}`);
          if (!response.ok) {
            log(`File fetch failed: ${response.statusText}`);
          }
        })
        .catch(err => {
          log(`File fetch error: ${err.message}`);
        });
    }
  };

  const handleForceProxy = async () => {
    if (filePath) {
      try {
        log(`Creating preview proxy for problematic file...`);
        const prox = await makePreviewProxy(filePath);
        const proxyUrl = convertFileSrc(prox);
        setPreviewUrl(proxyUrl);
        log(`Using proxy: ${proxyUrl}`);
      } catch (e: any) {
        log(`Proxy creation failed: ${e?.toString?.() || e}`);
      }
    }
  };

  const handleCopyToAppData = async () => {
    if (filePath) {
      try {
        log(`Copying file to app data directory...`);
        const appDataPath = await copyToAppData(filePath);
        const appDataUrl = convertFileSrc(appDataPath);
        setPreviewUrl(appDataUrl);
        log(`Using app data file: ${appDataUrl}`);
      } catch (e: any) {
        log(`App data copy failed: ${e?.toString?.() || e}`);
      }
    }
  };

  const handleTryBlobUrl = async () => {
    if (filePath) {
      try {
        log(`Trying blob URL approach...`);
        // Try to read the file as a blob and create a blob URL
        const response = await fetch(convertFileSrc(filePath));
        if (response.ok) {
          const blob = await response.blob();
          const blobUrl = URL.createObjectURL(blob);
          setPreviewUrl(blobUrl);
          log(`Using blob URL: ${blobUrl}`);
        } else {
          log(`Failed to fetch file for blob: ${response.status}`);
        }
      } catch (e: any) {
        log(`Blob URL creation failed: ${e?.toString?.() || e}`);
      }
    }
  };

  const handleCreateBlobFromChunks = async () => {
    if (filePath) {
      try {
        const blobUrl = await createBlobFromFile(filePath);
        setPreviewUrl(blobUrl);
        log(`Using chunked blob URL: ${blobUrl}`);
      } catch (e: any) {
        log(`Chunked blob creation failed: ${e?.toString?.() || e}`);
      }
    }
  };

  const handleTryDataUrl = async () => {
    if (filePath && probe) {
      try {
        // Only try base64 for smaller files (< 50MB estimated)
        const estimatedSize = probe.duration * 1000000; // rough estimate
        if (estimatedSize > 50000000) {
          log(`File too large for base64 approach (estimated ${Math.round(estimatedSize / 1000000)}MB). Use Force Proxy instead.`);
          return;
        }

        log(`Trying base64 data URL approach for small file...`);
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Timeout after 30 seconds')), 30000)
        );

        const base64Promise = readFileAsBase64(filePath);
        const base64 = await Promise.race([base64Promise, timeoutPromise]) as string;
        const dataUrl = `data:video/mp4;base64,${base64}`;
        setPreviewUrl(dataUrl);
        log(`Using data URL (first 100 chars): ${dataUrl.substring(0, 100)}...`);
      } catch (e: any) {
        log(`Base64 data URL creation failed: ${e?.toString?.() || e}`);
      }
    }
  };

  return (
    <div className="h-screen bg-zinc-950 text-zinc-100 flex flex-col overflow-hidden">
      {/* Toolbar */}
      <div className="border-b border-zinc-800 flex-shrink-0">
        <Toolbar
          onPickFile={handlePickFile}
          onResetApp={handleResetApp}
          onTestSampleVideo={handleTestSampleVideo}
          onUseLocalFileBlob={handleUseLocalFileBlob}
          onTryFileProtocol={handleTryFileProtocol}
          onClearVideo={handleClearVideo}
          onTestFileAccess={handleTestFileAccess}
          onForceProxy={handleForceProxy}
          onCopyToAppData={handleCopyToAppData}
          onTryBlobUrl={handleTryBlobUrl}
          onCreateBlobFromChunks={handleCreateBlobFromChunks}
          onTryDataUrl={handleTryDataUrl}
          onOpenCommand={openCommand}
          onAcceptPlan={acceptPlan}
          onRejectPlan={rejectPlan}
          onExport={onExport}
          onTogglePlay={togglePlay}
          onSeekBack={() => seekVideo(Math.max(0, (editedRef.current?.currentTime() || 0) - 1))}
          onSeekForward={() => seekVideo((editedRef.current?.currentTime() || 0) + 1)}
          onClearAllCuts={clearAllCuts}
          onUndo={undo}
          onRedo={redo}
          onMarkIn={markIn}
          onMarkOut={markOut}
          filePath={filePath}
          probe={probe}
          previewCuts={previewCuts}
          acceptedCuts={acceptedCuts}
          editedRef={editedRef}
        />
      </div>

      {/* Main Content Area */}
      <div className="flex-1 grid grid-cols-[1fr_320px] overflow-hidden min-h-0">
        {/* Center Content */}
        <div className="flex flex-col overflow-hidden min-h-0">
          {/* Mobile Debug Toggle - Only visible on small screens */}
          <div className="md:hidden border-b border-zinc-800 p-2">
            <button
              onClick={() => setShowMobileDebug(!showMobileDebug)}
              className="w-full px-3 py-2 text-xs rounded bg-zinc-800 text-zinc-200 hover:bg-zinc-700"
            >
              {showMobileDebug ? "Hide" : "Show"} Debug Info
            </button>
          </div>

          {/* Mobile Debug Panel */}
          {showMobileDebug && (
            <div className="md:hidden border-b border-zinc-800 p-4 bg-zinc-900">
              <div className="space-y-2 text-xs">
                <div>
                  <span className="text-zinc-500">File Path:</span>
                  <div className="text-zinc-400 break-all">{filePath || "None"}</div>
                </div>
                <div>
                  <span className="text-zinc-500">Duration:</span>
                  <div className="text-zinc-400">{probe ? `${probe.duration}s` : "None"}</div>
                </div>
                <div>
                  <span className="text-zinc-500">Cuts:</span>
                  <div className="text-zinc-400">Accepted: {acceptedCuts.length}, Preview: {previewCuts.length}</div>
                </div>
                <div className="mt-2">
                  <span className="text-zinc-500">Recent Logs:</span>
                  <pre className="text-zinc-400 whitespace-pre-wrap text-xs max-h-32 overflow-y-auto">
                    {debug.split('\n').slice(-5).join('\n') || "No recent logs"}
                  </pre>
                </div>
              </div>
            </div>
          )}

          {previewUrl ? (
            <>
              {/* Main Preview Area - Only Edited Video */}
              <div className="flex-1 flex flex-col p-3 overflow-hidden min-h-0">
                {/* Main Player - Edited (accepted only) */}
                <div className="flex-1 min-h-0 max-h-full flex items-center justify-center">
                  <Player
                    ref={editedRef}
                    src={previewUrl}
                    label="Edited (Accepted timeline)"
                    cuts={acceptedCuts}
                    large
                  />
                </div>
              </div>

              {/* Precision Controls */}
              <div className="flex-shrink-0 p-3 border-t border-zinc-800">
                <PrecisionControls
                  currentTime={editedRef.current?.currentTime() || 0}
                  duration={duration}
                  onSeek={seekVideo}
                  onFrameStep={frameStep}
                  frameRate={probe?.fps || 30}
                />
              </div>

              {/* Timeline at Bottom */}
              <div className="flex-shrink-0 border-t border-zinc-800 p-3 min-h-0">
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <div className="text-xs text-zinc-400">
                      Timeline View: {useAdvancedTimeline ? "Advanced (Zoom & Pan)" : "Basic"}
                    </div>
                    <button
                      onClick={() => setUseAdvancedTimeline(!useAdvancedTimeline)}
                      className="px-3 py-1 text-xs rounded bg-zinc-800 text-zinc-200 hover:bg-zinc-700"
                    >
                      {useAdvancedTimeline ? "Switch to Basic" : "Switch to Advanced"}
                    </button>
                  </div>
                  
                  <ErrorBoundary>
                    {useAdvancedTimeline ? (
                      <AdvancedTimeline
                        peaks={peaks}
                        duration={duration}
                        accepted={acceptedCuts}
                        preview={previewCuts}
                        filePath={filePath}
                        onSeek={seekVideo}
                        onAddCut={handleAddCut}
                        onRemoveCut={handleRemoveCut}
                      />
                    ) : (
                      <VideoTimeline
                        peaks={peaks}
                        duration={duration}
                        accepted={acceptedCuts}
                        preview={previewCuts}
                        filePath={filePath}
                        onSeek={seekVideo}
                      />
                    )}
                  </ErrorBoundary>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-zinc-400">
              <div className="text-center">
                <p className="text-lg mb-2">No video loaded</p>
                <p className="text-sm">Click "Open video" to select a video file.</p>
              </div>
            </div>
          )}
        </div>

        {/* Right Sidebar - Hidden on small screens, collapsible on larger screens */}
        <div className="hidden md:block">
          <Sidebar
            debug={debug}
            filePath={filePath}
            previewUrl={previewUrl}
            probe={probe}
            peaks={peaks}
            acceptedCuts={acceptedCuts}
            previewCuts={previewCuts}
            onExecuteCommand={handleExecuteCommand}
            onAcceptPlan={acceptPlan}
            onRejectPlan={rejectPlan}
          />
        </div>
      </div>

      {/* Command dialog */}
      <CommandDialog
        isOpen={showCommandDialog}
        commandInput={commandInput}
        onCommandInputChange={setCommandInput}
        onExecute={() => handleExecuteCommand(commandInput)}
        onClose={() => setShowCommandDialog(false)}
      />
      
      <ExportDialog
        isOpen={showExportDialog}
        onClose={() => setShowExportDialog(false)}
        filePath={filePath}
        acceptedCuts={acceptedCuts}
        onExport={handleExportWithOptions}
      />
    </div>
  );
}

