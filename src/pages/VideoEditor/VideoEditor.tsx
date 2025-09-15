import { useEffect, useRef, useState } from "react";
import { exportCutlist } from "../../lib/ffmpeg";
import type { Range, PlayerHandle, Track, Clip } from "../../types";
import { Player } from "./components/Player";
import { AdvancedTimeline, type AdvancedTimelineHandle } from "./components/AdvancedTimeline";
import { VideoTimeline } from "./components/VideoTimeline";
import { CommandDialog } from "./components/CommandDialog";
import { Sidebar } from "./components/Sidebar";
import { Toolbar } from "./components/Toolbar";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { ExportDialog } from "./components/ExportDialog";
import Footer from "./components/Footer";
import { useFileHandling } from "./hooks/useFileHandling";
import { useWaveformLogic } from "./hooks/useWaveformLogic";
import { useCommandLogic } from "./hooks/useCommandLogic";
import { MediaGrid } from "./components/MediaGrid";
import { 
  Home, 
  Info, 
  BarChart3, 
  Play
} from "lucide-react";

import DebugProjectFileInfo from "./components/DebugProjectFileInfo";
import { DeveloperOverlay } from "./components/DeveloperOverlay";
import Modal from "../../components/Modal";
import { getCurrentWindow } from '@tauri-apps/api/window';
import { invoke } from '@tauri-apps/api/core';
import { useProjectFileStore } from '../../stores/projectFileStore';

export default function VideoEditor() {
  console.log("VideoEditor component rendering...");
  
  const [jsonModal, setJsonModal] = useState(false); // JSON Data modal state

  // Edits
  const [previewCuts, setPreviewCuts] = useState<Range[]>([]);
  const [acceptedCuts, setAcceptedCuts] = useState<Range[]>([]);
  
  // Tracks
  const [tracks, setTracks] = useState<Track[]>([
    {
      id: 'video-1',
      name: 'Video Track',
      type: 'video',
      enabled: true,
      muted: false,
      volume: 100,
      order: 0
    }
  ]);

  // Clips on timeline
  const [clips, setClips] = useState<Clip[]>([]);
  
  // Undo/Redo system
  const [editHistory, setEditHistory] = useState<Range[][]>([[]]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [inOutPoints, setInOutPoints] = useState<{ in: number | null; out: number | null }>({ in: null, out: null });
  
  // Export dialog
  const [showExportDialog, setShowExportDialog] = useState(false);
  
  // Timeline view mode
  const [useAdvancedTimeline] = useState(true);
  
  // Zoom level tracking
  const [zoomLevel, setZoomLevel] = useState(1);
  
  // Mobile debug panel
  const [showMobileDebug, setShowMobileDebug] = useState(false);
  
  // Developer overlay
  const [showDeveloperOverlay, setShowDeveloperOverlay] = useState(false);
  
  // Project file store
  const projectFile = useProjectFileStore(state => state.projectFile);

  // Players control
  const editedRef = useRef<PlayerHandle>(null);
  const advancedTimelineRef = useRef<AdvancedTimelineHandle>(null);

  // Custom hooks
  const {
    filePath,
    previewUrl,
    probe,
    peaks,
    debug,
    log,
    mediaFiles,
    pickMultipleFiles,
    removeMediaFile,
  } = useFileHandling();

  // Debug: Log the pickMultipleFiles function
  console.log("pickMultipleFiles function:", typeof pickMultipleFiles, pickMultipleFiles);
  console.log("VideoEditor state:", { 
    mediaFiles: mediaFiles.length, 
    filePath, 
    probe: !!probe,
    showMobileDebug 
  });

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
  // Note: handlePickFile and handleResetApp are no longer used since we're using MediaGrid

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


  // Track management functions
  const updateTrack = (trackId: string, updates: Partial<Track>) => {
    setTracks(prevTracks => 
      prevTracks.map(track => 
        track.id === trackId ? { ...track, ...updates } : track
      )
    );
  };

  // Handle dropping media files onto timeline tracks
  const handleDropMedia = (mediaFile: any, trackId: string, offset: number, event?: React.DragEvent) => {
    console.log("handleDropMedia called with:", { mediaFile, trackId, offset });
    console.log("MediaFile object:", mediaFile);
    console.log("Current clips before drop:", clips.length);
    log(`Dropped ${mediaFile.name} onto track ${trackId} at ${offset.toFixed(2)}s`);
    
    // Create a clip from the media file
    // Use full video duration
    const clipDuration = mediaFile.duration;
    
    // Check if user wants manual placement (hold Shift key)
    const isManualPlacement = event?.shiftKey || false;
    
    let finalOffset = offset;
    
    if (!isManualPlacement) {
      // Auto-placement: Find the next available position (end of last clip on this track)
      const existingClipsOnTrack = clips.filter(clip => clip.trackId === trackId);
      let nextAvailableOffset = 0;
      
      if (existingClipsOnTrack.length > 0) {
        // Find the latest end time of clips on this track
        const latestEndTime = Math.max(...existingClipsOnTrack.map(clip => clip.offset + (clip.endTime - clip.startTime)));
        nextAvailableOffset = latestEndTime;
      }
      
      finalOffset = nextAvailableOffset;
      log(`Auto-placing clip at ${finalOffset.toFixed(2)}s (next available position)`);
    } else {
      log(`Manual placement at ${finalOffset.toFixed(2)}s (Shift key held)`);
    }
    
    const clip: Clip = {
      id: `clip-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      mediaFileId: mediaFile.id,
      name: mediaFile.name,
      startTime: 0, // Start from beginning of media
      endTime: clipDuration, // Use limited duration
      trackId: trackId,
      offset: finalOffset
    };
    
    console.log("Created clip:", clip);
    
    // Add clip to state
    setClips(prevClips => {
      const newClips = [...prevClips, clip];
      console.log("Updated clips array:", newClips);
      console.log("New clip created:", clip);
      log(`Created clip: ${clip.name} (${clip.startTime.toFixed(2)}s - ${clip.endTime.toFixed(2)}s) at offset ${clip.offset.toFixed(2)}s`);
      log(`Total clips now: ${newClips.length}`);
      return newClips;
    });

    // Note: Clips are now independent and don't need to be converted to cuts
    // Each clip will show its own waveform and thumbnail
  };

  const addTrack = (type: Track['type']) => {
    const newTrack: Track = {
      id: `${type}-${Date.now()}`,
      name: `${type.charAt(0).toUpperCase() + type.slice(1)} Track ${tracks.filter(t => t.type === type).length + 1}`,
      type,
      enabled: true,
      muted: false,
      volume: 100,
      order: tracks.length
    };
    setTracks(prevTracks => [...prevTracks, newTrack]);
    log(`Added new ${type} track: ${newTrack.name}`);
  };

  const deleteTrack = (trackId: string) => {
    const track = tracks.find(t => t.id === trackId);
    if (track) {
      setTracks(prevTracks => prevTracks.filter(t => t.id !== trackId));
      log(`Deleted track: ${track.name}`);
    }
  };

  const deleteClip = (clipId: string) => {
    const clip = clips.find(c => c.id === clipId);
    if (clip) {
      setClips(prevClips => prevClips.filter(c => c.id !== clipId));
      log(`Deleted clip: ${clip.name}`);
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

  const handleExportWithOptions = async (savePath: string, options: unknown) => {
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

  const handleGoHome = async () => {
    // Focus the main window before closing this one
    try {
      await invoke('focus_main_window');
    } catch (error) {
      console.error('Failed to focus main window:', error);
    }
    
    // Close the editor window
    const window = getCurrentWindow();
    await window.close();
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
          // If there are preview cuts, reject them first
          if (previewCuts.length > 0) {
            rejectPlan();
          } else {
            // Otherwise, close the editor window
            handleGoHome();
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [probe, undo, redo, markIn, markOut, togglePlay, acceptPlan, rejectPlan, previewCuts, handleGoHome]);

  // Track zoom level from AdvancedTimeline
  useEffect(() => {
    const interval = setInterval(() => {
      if (advancedTimelineRef.current) {
        setZoomLevel(advancedTimelineRef.current.zoomLevel);
      }
    }, 100); // Update every 100ms

    return () => clearInterval(interval);
  }, []);

  const duration = probe?.duration || 0;

  const getFileName = (path: string) => {
    if (!path) return "No file loaded";
    return path.split('/').pop() || path.split('\\').pop() || path;
  };

  // Test if basic JavaScript is working
  console.log("About to render VideoEditor component");
  
  return (
    <div className="h-screen bg-editor-bg-primary text-slate-100 flex flex-col overflow-hidden">
      
      {/* Header Bar - Responsive Design */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between px-3 sm:px-4 py-2 sm:py-3 bg-editor-bg-secondary border-b border-editor-border-secondary flex-shrink-0 gap-3 lg:gap-0">
        
        {/* Debug Console - Always visible when enabled */}
        {showMobileDebug && (
          <div className="w-full border border-slate-600 rounded-lg p-3 bg-slate-800 mb-2">
            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-300 font-medium">Debug Console</span>
                <button 
                  onClick={() => setShowMobileDebug(false)}
                  className="text-slate-400 hover:text-slate-200"
                >
                  ✕
                </button>
              </div>
              <div>
                <span className="text-slate-400">File Path:</span>
                <div className="text-slate-300 break-all">{filePath || "None"}</div>
              </div>
              <div>
                <span className="text-slate-400">Duration:</span>
                <div className="text-slate-300">{probe ? `${probe.duration}s` : "None"}</div>
              </div>
              <div>
                <span className="text-slate-400">Cuts:</span>
                <div className="text-slate-300">Accepted: {acceptedCuts.length}, Preview: {previewCuts.length}</div>
              </div>
              <div>
                <span className="text-slate-400">Media Files:</span>
                <div className="text-slate-300">{mediaFiles.length} files loaded</div>
              </div>
              <div className="mt-2">
                <span className="text-slate-400">Recent Logs:</span>
                <pre className="text-slate-300 whitespace-pre-wrap text-xs max-h-32 overflow-y-auto bg-slate-900 p-2 rounded">
                  {debug.split('\n').slice(-10).join('\n') || "No recent logs"}
                </pre>
              </div>
            </div>
          </div>
        )}
        <div className="flex items-center gap-3 sm:gap-4 h-10">
          <div className="flex items-center gap-2">
            <img src="/logo.png" alt="Video Copilot Logo" className="h-6 w-auto" />
          </div>
          <div className="flex items-center gap-1 sm:gap-2">
            <button 
              onClick={handleGoHome}
              className="flex items-center justify-center w-8 h-8 text-editor-text-secondary hover:text-editor-text-primary hover:bg-editor-bg-tertiary rounded-lg transition-colors border-0 p-0"
              title="Close Editor"
            >
              <Home className="w-4 h-4 flex-shrink-0" />
            </button>
            <button 
              onClick={() => setJsonModal(true)}
              className="flex items-center justify-center w-8 h-8 text-editor-text-secondary hover:text-editor-text-primary hover:bg-editor-bg-tertiary rounded-lg transition-colors border-0 p-0"
              title="Project Info"
            >
              <Info className="w-4 h-4 flex-shrink-0" />
            </button>
            <button 
              onClick={() => setShowDeveloperOverlay(true)}
              className="flex items-center justify-center w-8 h-8 text-editor-text-secondary hover:text-editor-text-primary hover:bg-editor-bg-tertiary rounded-lg transition-colors border-0 p-0"
              title="Open Developer Console"
            >
              <BarChart3 className="w-4 h-4 flex-shrink-0" />
            </button>
          </div>
        </div>
        
        {/* Main Toolbar - Responsive */}
        <div className="flex items-center justify-end lg:justify-start h-10">
          <Toolbar
            onExport={onExport}
            onUndo={undo}
            onRedo={redo}
            acceptedCuts={acceptedCuts}
          />
        </div>
      </div>

      {/* Main Content Area - Media Left, Video Center, Tools Right */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* Left Panel - Tools & Media */}
        <div className="block w-[42rem] 2xl:w-[46rem] flex h-full min-h-0 gap-0">
          {/* Left Section - Tools */}
          <div className="w-56 border border-slate-700 bg-slate-700 rounded-l-lg overflow-hidden flex flex-col h-full min-h-0">
            {/* Header */}
            <div className="px-3 sm:px-4 py-2 sm:py-3 border-b border-slate-700 bg-slate-800 flex items-center justify-between">
              <h3 className="text-sm font-medium text-white">Tools</h3>
              <div className="text-slate-400">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
                </svg>
              </div>
            </div>
            
            {/* Tools Content */}
            <div className="bg-slate-800 flex-1 p-3">
              <div className="space-y-3">
                {/* Quick Actions */}
                <div className="space-y-2">
                  <h4 className="text-xs font-medium text-slate-300 uppercase tracking-wide">Quick Actions</h4>
                  <div className="space-y-1">
                    <button 
                      onClick={markIn}
                      className="w-full px-3 py-2 text-sm bg-slate-700 text-slate-200 hover:bg-slate-600 rounded transition-colors flex items-center gap-2"
                    >
                      <span className="text-xs">I</span>
                      Mark In
                    </button>
                    <button 
                      onClick={markOut}
                      className="w-full px-3 py-2 text-sm bg-slate-700 text-slate-200 hover:bg-slate-600 rounded transition-colors flex items-center gap-2"
                    >
                      <span className="text-xs">O</span>
                      Mark Out
                    </button>
                    <button 
                      onClick={togglePlay}
                      className="w-full px-3 py-2 text-sm bg-blue-600 text-white hover:bg-blue-700 rounded transition-colors flex items-center gap-2"
                    >
                      <span className="text-xs">Space</span>
                      Play/Pause
                    </button>
                  </div>
                </div>

                {/* Track Management */}
                <div className="space-y-2">
                  <h4 className="text-xs font-medium text-slate-300 uppercase tracking-wide">Tracks</h4>
                  <div className="space-y-1">
                    <button 
                      onClick={() => addTrack('video')}
                      className="w-full px-3 py-2 text-sm bg-slate-700 text-slate-200 hover:bg-slate-600 rounded transition-colors flex items-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                      </svg>
                      Add Video Track
                    </button>
                    <button 
                      onClick={() => addTrack('audio')}
                      className="w-full px-3 py-2 text-sm bg-slate-700 text-slate-200 hover:bg-slate-600 rounded transition-colors flex items-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                      </svg>
                      Add Audio Track
                    </button>
                  </div>
                </div>

                {/* Edit History */}
                <div className="space-y-2">
                  <h4 className="text-xs font-medium text-slate-300 uppercase tracking-wide">History</h4>
                  <div className="space-y-1">
                    <button 
                      onClick={undo}
                      disabled={historyIndex <= 0}
                      className="w-full px-3 py-2 text-sm bg-slate-700 text-slate-200 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed rounded transition-colors flex items-center gap-2"
                    >
                      <span className="text-xs">⌘Z</span>
                      Undo
                    </button>
                    <button 
                      onClick={redo}
                      disabled={historyIndex >= editHistory.length - 1}
                      className="w-full px-3 py-2 text-sm bg-slate-700 text-slate-200 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed rounded transition-colors flex items-center gap-2"
                    >
                      <span className="text-xs">⌘⇧Z</span>
                      Redo
                    </button>
                  </div>
                </div>

                {/* Project Info */}
                <div className="space-y-2">
                  <h4 className="text-xs font-medium text-slate-300 uppercase tracking-wide">Project</h4>
                  <div className="text-xs text-slate-400 space-y-1">
                    <div>Clips: {clips.length}</div>
                    <div>Tracks: {tracks.length}</div>
                    <div>Cuts: {acceptedCuts.length}</div>
                    {probe && (
                      <div>Duration: {probe.duration?.toFixed(1)}s</div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Section - Media */}
          <div className="flex-1 border border-l-0 border-slate-700 bg-slate-900 rounded-r-lg overflow-hidden flex flex-col h-full min-h-0">
            {/* Header */}
            <div className="px-3 sm:px-4 py-1.5 sm:py-2.5 border-b border-slate-700 bg-slate-800 flex items-center justify-between">
              <h3 className="text-sm font-medium text-white">Media</h3>
              <button
                onClick={() => pickMultipleFiles()}
                className="flex items-center gap-1.5 px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
              >
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                </svg>
                Add Media
              </button>
            </div>
            
            {/* Media Grid Section */}
            <div className="bg-slate-950 flex-1">
              <MediaGrid
                mediaFiles={mediaFiles}
                onAddMedia={pickMultipleFiles}
                onRemoveMedia={removeMediaFile}
                onDragStart={(mediaFile) => {
                  // Handle drag start - this will be used for drag and drop to timeline
                  log(`Started dragging: ${mediaFile.name}`);
                }}
              />
            </div>
          </div>
        </div>

        {/* Center Panel - Video Preview */}
        <div className="flex-1 flex flex-col overflow-hidden min-h-0 bg-slate-900 min-w-0">
          <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden flex flex-col h-full min-h-0">
            {/* Header */}
            <div className="px-3 sm:px-4 py-2 sm:py-3 border-b border-slate-700 bg-slate-800 flex items-center justify-between">
              <h3 className="text-sm font-medium text-white">Preview</h3>
              <div className="text-slate-400">
                <Play className="w-4 h-4" fill="currentColor" />
              </div>
            </div>
            
            {/* Content */}
            <div className="flex-1 flex flex-col overflow-hidden min-h-0 bg-slate-900">
              {/* Mobile Debug Toggle */}
              <div className="lg:hidden border-b border-slate-700 p-2">
                <button
                  onClick={() => setShowDeveloperOverlay(true)}
                  className="w-full px-3 py-2 text-xs rounded bg-slate-700 text-slate-300 hover:bg-slate-600 transition-colors flex items-center justify-center gap-2"
                >
                  <BarChart3 className="w-4 h-4" />
                  Developer Console
                </button>
              </div>

              {/* Mobile Debug Panel */}
              {showMobileDebug && (
                <div className="lg:hidden border-b border-slate-700 p-4 bg-slate-800">
                  <div className="space-y-2 text-xs">
                    <div>
                      <span className="text-slate-400">File Path:</span>
                      <div className="text-slate-300 break-all">{filePath || "None"}</div>
                    </div>
                    <div>
                      <span className="text-slate-400">Duration:</span>
                      <div className="text-slate-300">{probe ? `${probe.duration}s` : "None"}</div>
                    </div>
                    <div>
                      <span className="text-slate-400">Cuts:</span>
                      <div className="text-slate-300">Accepted: {acceptedCuts.length}, Preview: {previewCuts.length}</div>
                    </div>
                    <div className="mt-2">
                      <span className="text-slate-400">Recent Logs:</span>
                      <pre className="text-slate-300 whitespace-pre-wrap text-xs max-h-32 overflow-y-auto">
                        {debug.split('\n').slice(-5).join('\n') || "No recent logs"}
                      </pre>
                    </div>
                  </div>
                </div>
              )}

              {/* Video Preview Area - Always Visible */}
              <div className="flex-1 flex flex-col overflow-hidden min-h-0 p-2 sm:p-3 lg:p-4">
                <div className="flex-1 flex items-center justify-center w-full h-full">
                  <Player
                    ref={editedRef}
                    src={clips.length > 0 ? mediaFiles.find(mf => mf.id === clips[0].mediaFileId)?.previewUrl || previewUrl || "" : previewUrl || ""}
                    label="Preview"
                    cuts={acceptedCuts}
                    large
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Panel - Tools & Chat */}
        <div className="hidden lg:block w-80 xl:w-96 border border-slate-700 bg-slate-800 rounded-lg overflow-hidden flex flex-col h-full min-h-0">
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

      {/* Timeline Section - Always Visible */}
      <div className="flex-shrink-0 border-t border-editor-border-secondary bg-editor-bg-primary">
        <ErrorBoundary>
          {useAdvancedTimeline ? (
            <AdvancedTimeline
              ref={advancedTimelineRef}
              peaks={peaks}
              duration={duration}
              accepted={acceptedCuts}
              preview={previewCuts}
              filePath={filePath}
              tracks={tracks}
              clips={clips}
              mediaFiles={mediaFiles}
              onSeek={seekVideo}
              onAddCut={handleAddCut}
              onRemoveCut={handleRemoveCut}
              onUpdateTrack={updateTrack}
              onAddTrack={addTrack}
              onDeleteTrack={deleteTrack}
              onDropMedia={handleDropMedia}
              onDeleteClip={deleteClip}
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

      {/* Footer */}
      <Footer
        acceptedCuts={acceptedCuts.length}
        previewCuts={previewCuts.length}
        clips={clips.length}
        tracks={tracks.length}
        projectName={filePath ? getFileName(filePath) : "No Project"}
        resolution={probe?.width && probe?.height ? `${probe.width}x${probe.height}` : "No video loaded"}
        frameRate={probe?.fps ? Math.round(probe.fps) : 0}
        duration={duration}
        filePath={filePath || ""}
        audioChannels={probe?.audio_channels || 0}
        audioRate={probe?.audio_rate || 0}
        videoCodec={probe?.v_codec || ""}
        audioCodec={probe?.a_codec || ""}
        container={probe?.container || ""}
        zoomLevel={zoomLevel}
        currentTool="Select"
        selectionInfo=""
        onSettingsClick={() => {
          // TODO: Implement settings dialog
          console.log('Settings clicked');
        }}
      />

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

      <Modal
        isOpen={jsonModal}
        onClose={() => setJsonModal(false)}
      >
        <DebugProjectFileInfo /> 
      </Modal>

      {/* Developer Overlay */}
      <DeveloperOverlay
        debug={debug}
        filePath={filePath}
        previewUrl={previewUrl}
        probe={probe}
        peaks={peaks}
        acceptedCuts={acceptedCuts}
        previewCuts={previewCuts}
        projectFile={projectFile}
        isOpen={showDeveloperOverlay}
        onClose={() => setShowDeveloperOverlay(false)}
      />
    </div>
  );
}