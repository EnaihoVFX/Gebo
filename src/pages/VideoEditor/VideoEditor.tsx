import { useEffect, useRef, useState } from "react";
import { exportCutlist } from "../../lib/ffmpeg";
import type { Range, PlayerHandle, Track, Clip } from "../../types";
import { useProject } from "../../hooks/useProject";
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
import { SongLibrary } from "./components/SongLibrary";
import { 
  Home, 
  Info, 
  BarChart3, 
  Play
} from "lucide-react";
import type { AgentContext } from "../../types";

import DebugProjectFileInfo from "./components/DebugProjectFileInfo";
import { DeveloperOverlay } from "./components/DeveloperOverlay";
import Modal from "../../components/Modal";
import { ApiKeyManager } from "../../components/ApiKeyManager";
import { getCurrentWindow } from '@tauri-apps/api/window';
import { invoke } from '@tauri-apps/api/core';
import { useProjectFile } from './hooks/useProjectFileManager';

// Panel Components
const TransitionsPanel = () => (
  <div className="bg-slate-950 flex-1 flex items-center justify-center">
    <div className="text-center">
      <svg className="w-16 h-16 mx-auto mb-4 text-slate-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 20 20">
        <polygon points="4,4 4,16 8,10" strokeLinecap="round" strokeLinejoin="round" />
        <polygon points="16,4 16,16 12,10" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <h3 className="text-lg font-medium text-slate-400 mb-2">Transitions</h3>
      <p className="text-slate-500">Transition effects will appear here</p>
    </div>
  </div>
);

// AudioPanel will be replaced with SongLibrary integration

const TextPanel = () => (
  <div className="bg-slate-950 flex-1 flex items-center justify-center">
    <div className="text-center">
      <svg className="w-16 h-16 mx-auto mb-4 text-slate-600" fill="currentColor" viewBox="0 0 16 16">
        <path d="M5.68412,13v-.72885l.221-.0181c.7641-.05812.947-.1896.98514-.22866.02573-.02668.1572-.202.1572-.99276V4.07755H6.47918A2.45938,2.45938,0,0,0,5.002,4.36909a2.26179,2.26179,0,0,0-.56259,1.35957l-.03811.19626H3.6038L3.70384,3h8.59994l.09242,2.92492h-.78411l-.02144-.09527a2.81746,2.81746,0,0,0-.58832-1.46532c-.14719-.13148-.52305-.28678-1.481-.28678H8.9606v7.12272c0,.67835.13815.8184.16578.83936a2.09154,2.09154,0,0,0,1.00943.21342l.223.0181V13Z"/>
      </svg>
      <h3 className="text-lg font-medium text-slate-400 mb-2">Text</h3>
      <p className="text-slate-500">Text tools and typography will appear here</p>
    </div>
  </div>
);

const EffectsPanel = () => (
  <div className="bg-slate-950 flex-1 flex items-center justify-center">
    <div className="text-center">
      <svg className="w-16 h-16 mx-auto mb-4 text-slate-600" fill="currentColor" viewBox="0 0 24 24">
        <path d="M15.199 9.945a2.6 2.6 0 0 1-.79-1.551l-.403-3.083-2.73 1.486a2.6 2.6 0 0 1-1.72.273L6.5 6.5l.57 3.056a2.6 2.6 0 0 1-.273 1.72l-1.486 2.73 3.083.403a2.6 2.6 0 0 1 1.55.79l2.138 2.257 1.336-2.807a2.6 2.6 0 0 1 1.23-1.231l2.808-1.336-2.257-2.137zm.025 5.563l-2.213 4.65a.6.6 0 0 1-.977.155l-3.542-3.739a.6.6 0 0 0-.357-.182l-5.107-.668a.6.6 0 0 1-.449-.881l2.462-4.524a.6.6 0 0 0 .062-.396L4.16 4.86a.6.6 0 0 1 .7-.7l5.063.943a.6.6 0 0 0 .396-.062l4.524-2.462a.6.6 0 0 1 .881.45l.668 5.106a.6.6 0 0 0 .182.357l3.739 3.542a.6.6 0 0 1-.155.977l-4.65 2.213a.6.6 0 0 0-.284.284zm.797 1.927l1.414-1.414 4.243 4.242-1.415 1.415-4.242-4.243z"/>
      </svg>
      <h3 className="text-lg font-medium text-slate-400 mb-2">Effects</h3>
      <p className="text-slate-500">Visual effects will appear here</p>
    </div>
  </div>
);

const FiltersPanel = () => (
  <div className="bg-slate-950 flex-1 flex items-center justify-center">
    <div className="text-center">
      <svg className="w-16 h-16 mx-auto mb-4 text-slate-600" fill="currentColor" viewBox="0 0 24 24">
        <path d="M16,1a6.956,6.956,0,0,0-4,1.264A7,7,0,1,0,5.19,14.407a7,7,0,1,0,13.62,0A7,7,0,0,0,16,1ZM12.881,9.062a6.29,6.29,0,0,0-1.762,0A4.88,4.88,0,0,1,12,5.031a4.88,4.88,0,0,1,.881,4.031Zm-2.387,3.246A4.938,4.938,0,0,1,8.028,13a5.015,5.015,0,0,1,1.9-1.533A7,7,0,0,0,10.494,12.308Zm3.58-.844A5.015,5.015,0,0,1,15.972,13a4.938,4.938,0,0,1-2.466-.689A7,7,0,0,0,14.074,11.464ZM3,8A5.006,5.006,0,0,1,8,3a4.948,4.948,0,0,1,2.494.692,6.911,6.911,0,0,0-1.3,5.9,7.037,7.037,0,0,0-3.264,2.943A5,5,0,0,1,3,8Zm14,8a5,5,0,1,1-9.881-1.062A6.839,6.839,0,0,0,12,13.736a6.839,6.839,0,0,0,4.881,1.2A4.959,4.959,0,0,1,17,16Zm1.074-3.464A7.029,7.029,0,0,0,14.81,9.594a6.913,6.913,0,0,0-1.3-5.9A4.948,4.948,0,0,1,16,3a4.992,4.992,0,0,1,2.074,9.536Z"/>
      </svg>
      <h3 className="text-lg font-medium text-slate-400 mb-2">Filters</h3>
      <p className="text-slate-500">Filter options will appear here</p>
    </div>
  </div>
);

export default function VideoEditor() {
  console.log("VideoEditor component rendering...");
  
  const [jsonModal, setJsonModal] = useState(false); // JSON Data modal state
  const [activePanel, setActivePanel] = useState<'media' | 'transitions' | 'audio' | 'text' | 'effects' | 'filters'>('media'); // Active panel state

  // Edits
  const [previewCuts, setPreviewCuts] = useState<Range[]>([]);
  const [acceptedCuts, setAcceptedCuts] = useState<Range[]>([]);
  
  // Use JSON-based project system
  const { 
    projectData, 
    addTrack, 
    updateTrack, 
    addClip, 
    removeClip, 
    splitClip: projectSplitClip, 
    resizeClip: projectResizeClip,
  } = useProject();

  // Extract tracks and clips from project data
  const tracks = (projectData?.tracks || []) as Track[];
  const clips = (projectData?.clips || []) as Clip[];
  
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
  
  // API Key manager
  const [showApiKeyManager, setShowApiKeyManager] = useState(false);
  
  // Project manager (from merged PR)
  const projectManager = useProjectFile();
  const projectFile = projectManager.getSerializedProject();

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


  // Track management functions (now using project system)
  const handleUpdateTrack = (trackId: string, updates: Partial<Track>) => {
    updateTrack(trackId, updates);
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
    
    // Add clip using project system
    addClip(clip);
    log(`Created clip: ${clip.name} (${clip.startTime.toFixed(2)}s - ${clip.endTime.toFixed(2)}s) at offset ${clip.offset.toFixed(2)}s`);

    // Note: Clips are now independent and don't need to be converted to cuts
    // Each clip will show its own waveform and thumbnail
  };

  const handleAddTrack = (type: Track['type']) => {
    const newTrack: Track = {
      id: `${type}-${Date.now()}`,
      name: `${type.charAt(0).toUpperCase() + type.slice(1)} Track ${tracks.filter(t => t.type === type).length + 1}`,
      type,
      enabled: true,
      muted: false,
      volume: 100,
      order: tracks.length,
    };

    addTrack(newTrack);
    log(`Added new ${type} track: ${newTrack.name}`);
  };

  // Temporarily disabled: Function to automatically delete empty tracks
  // const deleteEmptyTracks = useCallback(() => {
  //   const tracksWithClips = new Set(clips.map(clip => clip.trackId));
  //   const emptyTracks = tracks.filter(track => !tracksWithClips.has(track.id));

  //   // Don't delete the last track, even if it's empty
  //   if (emptyTracks.length > 0 && tracks.length > 1) {
  //     const tracksToDelete = emptyTracks.slice(0, -1); // Keep at least one track

  //     if (tracksToDelete.length > 0) {
  //       setTracks(prevTracks => prevTracks.filter(track => !tracksToDelete.some(t => t.id === track.id)));
  //       log(`Automatically deleted ${tracksToDelete.length} empty track(s): ${tracksToDelete.map(t => t.name).join(', ')}`);
  //     }
  //   }
  // }, [clips, tracks, log]);

  const deleteClip = (clipId: string) => {
    const clip = clips.find(c => c.id === clipId);
    if (clip) {
      removeClip(clipId);
      log(`Deleted clip: ${clip.name}`);
    }
  };

  const splitClip = (clipId: string, splitTime: number) => {
    const clip = clips.find(c => c.id === clipId);
    if (!clip) return;

    // Calculate the split position relative to the clip's timeline position
    const clipStart = clip.offset;
    const clipEnd = clip.offset + (clip.endTime - clip.startTime);
    
    // Ensure split time is within the clip bounds
    const relativeSplitTime = Math.max(clipStart, Math.min(splitTime, clipEnd));
    
    // Note: The actual splitting is handled by the project system

    // Use project system to split clip
    projectSplitClip(clipId, relativeSplitTime);
    log(`Split clip "${clip.name}" at ${relativeSplitTime.toFixed(2)}s into two segments`);
  };

  const resizeClip = (clipId: string, newStartTime: number, newEndTime: number) => {
    const clip = clips.find(c => c.id === clipId);
    if (!clip) return;

    // Ensure the new times are valid
    
    // Note: The actual resizing is handled by the project system

    // Use project system to resize clip
    projectResizeClip(clipId, newStartTime, newEndTime);
    log(`Resized clip "${clip.name}" from ${newStartTime.toFixed(2)}s to ${newEndTime.toFixed(2)}s`);
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

      // Also don't handle shortcuts when typing in chat container
      const target = e.target as Element;
      if (target && target.closest('.chat-container')) {
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

  // Automatically delete empty tracks when clips change
  // Temporarily disabled: Automatically delete empty tracks when clips or tracks change
  // useEffect(() => {
  //   deleteEmptyTracks();
  // }, [deleteEmptyTracks]);

  const duration = probe?.duration || 0;

  const getFileName = (path: string) => {
    if (!path) return "No file loaded";
    return path.split('/').pop() || path.split('\\').pop() || path;
  };

  // Create agent context for AI agent
  const agentContext: AgentContext = {
    currentProject: {
      filePath: filePath || "",
      duration,
      tracks,
      clips,
      mediaFiles,
      acceptedCuts,
      previewCuts,
    },
    userIntent: "", // Will be set by the agent based on user input
    conversationHistory: [], // Could be populated from chat history if needed
  };

  // Test if basic JavaScript is working
  console.log("About to render VideoEditor component");
  
  return (
    <div className="h-screen bg-editor-bg-primary text-white flex flex-col overflow-hidden">
      
      {/* Header Bar - Glassmorphic Design */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between px-3 sm:px-4 py-2 sm:py-3 bg-editor-bg-glass-primary backdrop-blur-2xl border border-editor-border-tertiary rounded-2xl mx-3 mt-3 mb-1 flex-shrink-0 gap-3 lg:gap-0 relative shadow-[0_8px_32px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.1)]">
        <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent rounded-2xl"></div>
        
        {/* Debug Console - Always visible when enabled */}
        {showMobileDebug && (
          <div className="w-full border border-editor-border-tertiary rounded-lg p-3 bg-editor-bg-glass-secondary backdrop-blur-xl mb-2">
            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-editor-text-secondary font-medium">Debug Console</span>
                <button 
                  onClick={() => setShowMobileDebug(false)}
                  className="text-editor-text-tertiary hover:text-editor-text-primary"
                >
                  ✕
                </button>
              </div>
              <div>
                <span className="text-editor-text-tertiary">File Path:</span>
                <div className="text-editor-text-secondary break-all">{filePath || "None"}</div>
              </div>
              <div>
                <span className="text-editor-text-tertiary">Duration:</span>
                <div className="text-editor-text-secondary">{probe ? `${probe.duration}s` : "None"}</div>
              </div>
              <div>
                <span className="text-editor-text-tertiary">Cuts:</span>
                <div className="text-editor-text-secondary">Accepted: {acceptedCuts.length}, Preview: {previewCuts.length}</div>
              </div>
              <div>
                <span className="text-editor-text-tertiary">Media Files:</span>
                <div className="text-editor-text-secondary">{mediaFiles.length} files loaded</div>
              </div>
              <div className="mt-2">
                <span className="text-editor-text-tertiary">Recent Logs:</span>
                <pre className="text-editor-text-secondary whitespace-pre-wrap text-xs max-h-32 overflow-y-auto bg-editor-bg-canvas p-2 rounded">
                  {debug.split('\n').slice(-10).join('\n') || "No recent logs"}
                </pre>
              </div>
            </div>
          </div>
        )}
        <div className="flex items-center gap-3 sm:gap-4 h-10 relative z-10">
          <div className="flex items-center gap-2">
            <img src="/logo.png" alt="Video Copilot Logo" className="h-6 w-auto opacity-90" />
          </div>
          <div className="flex items-center gap-1 sm:gap-2">
            <button 
              onClick={handleGoHome}
              className="group flex items-center justify-center w-8 h-8 text-editor-text-tertiary hover:text-editor-text-primary bg-editor-bg-glass-tertiary backdrop-blur-xl border border-editor-border-tertiary rounded-xl transition-all duration-300 hover:bg-editor-interactive-hover hover:border-editor-border-secondary hover:scale-105 shadow-[0_2px_8px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.1)] relative overflow-hidden"
              title="Close Editor"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-xl"></div>
              <Home className="w-4 h-4 flex-shrink-0 relative z-10" />
            </button>
            <button 
              onClick={() => setJsonModal(true)}
              className="group flex items-center justify-center w-8 h-8 text-editor-text-tertiary hover:text-editor-text-primary bg-editor-bg-glass-tertiary backdrop-blur-xl border border-editor-border-tertiary rounded-xl transition-all duration-300 hover:bg-editor-interactive-hover hover:border-editor-border-secondary hover:scale-105 shadow-[0_2px_8px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.1)] relative overflow-hidden"
              title="Project Info"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-xl"></div>
              <Info className="w-4 h-4 flex-shrink-0 relative z-10" />
            </button>
            <button 
              onClick={() => setShowDeveloperOverlay(true)}
              className="group flex items-center justify-center w-8 h-8 text-editor-text-tertiary hover:text-editor-text-primary bg-editor-bg-glass-tertiary backdrop-blur-xl border border-editor-border-tertiary rounded-xl transition-all duration-300 hover:bg-editor-interactive-hover hover:border-editor-border-secondary hover:scale-105 shadow-[0_2px_8px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.1)] relative overflow-hidden"
              title="Open Developer Console"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-xl"></div>
              <BarChart3 className="w-4 h-4 flex-shrink-0 relative z-10" />
            </button>
            <button 
              onClick={() => setShowApiKeyManager(true)}
              className="group flex items-center justify-center w-8 h-8 text-editor-text-tertiary hover:text-editor-text-primary bg-editor-bg-glass-tertiary backdrop-blur-xl border border-editor-border-tertiary rounded-xl transition-all duration-300 hover:bg-editor-interactive-hover hover:border-editor-border-secondary hover:scale-105 shadow-[0_2px_8px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.1)] relative overflow-hidden"
              title="Configure AI API Key"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-xl"></div>
              <svg className="w-4 h-4 flex-shrink-0 relative z-10" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12.65 10C11.83 7.67 9.61 6 7 6c-3.31 0-6 2.69-6 6s2.69 6 6 6c2.61 0 4.83-1.67 5.65-4H17v4h4v-4h2v-4H12.65zM7 14c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z"/>
              </svg>
            </button>
          </div>
        </div>
        
        {/* Main Toolbar - Responsive */}
        <div className="flex items-center justify-end lg:justify-start h-10 relative z-10">
          <Toolbar
            onExport={onExport}
            acceptedCuts={acceptedCuts}
          />
        </div>
      </div>

      {/* Main Content Area - Media Left, Video Center, Tools Right */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* Left Panel - Tools & Media */}
        <div className="block w-[36rem] 2xl:w-[40rem] flex h-full min-h-0 gap-3 p-2">
          {/* Left Section - Menu */}
          <div className="w-12 bg-editor-bg-glass-primary backdrop-blur-2xl border border-editor-border-tertiary rounded-2xl overflow-hidden flex flex-col h-full min-h-0 shadow-[0_8px_32px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.1)] relative">
            <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent rounded-2xl"></div>
            {/* Header */}
            <div className="px-2 py-2.5 border-b border-editor-border-tertiary bg-editor-bg-glass-secondary backdrop-blur-xl flex items-center justify-center relative z-10">
              <div className="text-editor-text-muted">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
                </svg>
              </div>
            </div>
            
            {/* Menu Content */}
            <div className="bg-editor-bg-glass-secondary backdrop-blur-xl flex-1 p-1 flex flex-col justify-center relative z-10">
              <div className="space-y-3 -mt-1">
                {/* Media */}
                <button 
                  onClick={() => setActivePanel('media')}
                  className={`group w-full h-10 rounded-xl transition-all duration-300 flex items-center justify-center focus:outline-none relative overflow-hidden ${
                    activePanel === 'media' 
                      ? 'text-editor-text-primary bg-editor-interactive-active border border-editor-border-secondary shadow-[0_4px_12px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.2)]' 
                      : 'text-editor-text-tertiary hover:text-editor-text-primary bg-editor-bg-glass-tertiary backdrop-blur-xl border border-editor-border-tertiary hover:bg-editor-interactive-hover hover:border-editor-border-secondary hover:scale-105 shadow-[0_2px_8px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.1)]'
                  }`}
                  title="Media"
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-xl"></div>
                  <svg className="w-5 h-5 relative z-10 text-current" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M19,4H5A3,3,0,0,0,2,7V17a3,3,0,0,0,3,3H19a3,3,0,0,0,3-3V7A3,3,0,0,0,19,4ZM5,18a1,1,0,0,1-1-1V14.58l3.3-3.29a1,1,0,0,1,1.4,0L15.41,18Zm15-1a1,1,0,0,1-1,1h-.77l-3.81-3.83.88-.88a1,1,0,0,1,1.4,0L20,16.58Zm0-3.24-1.88-1.87a3.06,3.06,0,0,0-4.24,0l-.88.88L10.12,9.89a3.06,3.06,0,0,0-4.24,0L4,11.76V7A1,1,0,0,1,5,6H19a1,1,0,0,1,1,1Z"/>
                  </svg>
                </button>

                {/* Transitions */}
                <button 
                  onClick={() => setActivePanel('transitions')}
                  className={`group w-full h-10 rounded-xl transition-all duration-300 flex items-center justify-center focus:outline-none relative overflow-hidden ${
                    activePanel === 'transitions' 
                      ? 'text-editor-text-primary bg-editor-interactive-active border border-editor-border-secondary shadow-[0_4px_12px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.2)]' 
                      : 'text-editor-text-tertiary hover:text-editor-text-primary bg-editor-bg-glass-tertiary backdrop-blur-xl border border-editor-border-tertiary hover:bg-editor-interactive-hover hover:border-editor-border-secondary hover:scale-105 shadow-[0_2px_8px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.1)]'
                  }`}
                  title="Transitions"
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-xl"></div>
                  <svg className="w-5 h-5 relative z-10" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 20 20">
                    <polygon points="4,4 4,16 8,10" strokeLinecap="round" strokeLinejoin="round" />
                    <polygon points="16,4 16,16 12,10" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>

                {/* Audio */}
                <button 
                  onClick={() => setActivePanel('audio')}
                  className={`group w-full h-10 rounded-xl transition-all duration-300 flex items-center justify-center focus:outline-none relative overflow-hidden ${
                    activePanel === 'audio' 
                      ? 'text-editor-text-primary bg-editor-interactive-active border border-editor-border-secondary shadow-[0_4px_12px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.2)]' 
                      : 'text-editor-text-tertiary hover:text-editor-text-primary bg-editor-bg-glass-tertiary backdrop-blur-xl border border-editor-border-tertiary hover:bg-editor-interactive-hover hover:border-editor-border-secondary hover:scale-105 shadow-[0_2px_8px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.1)]'
                  }`}
                  title="Audio"
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-xl"></div>
                  <svg className="w-5 h-5 relative z-10" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M9.772 4.28c.56-.144 1.097.246 1.206.814.1.517-.263 1.004-.771 1.14A7 7 0 1 0 19 12.9c.009-.5.4-.945.895-1 .603-.067 1.112.371 1.106.977L21 13c0 .107-.002.213-.006.32a.898.898 0 0 1 0 .164l-.008.122a9 9 0 0 1-9.172 8.392A9 9 0 0 1 9.772 4.28z"/>
                    <path d="M15.93 13.753a4.001 4.001 0 1 1-6.758-3.581A4 4 0 0 1 12 9c.75 0 1.3.16 2 .53 0 0 .15.09.25.17-.1-.35-.228-1.296-.25-1.7a58.75 58.75 0 0 1-.025-2.035V2.96c0-.52.432-.94.965-.94.103 0 .206.016.305.048l4.572 1.689c.446.145.597.23.745.353.148.122.258.27.33.446.073.176.108.342.108.801v1.16c0 .518-.443.94-.975.94a.987.987 0 0 1-.305-.049l-1.379-.447-.151-.05c-.437-.14-.618-.2-.788-.26a5.697 5.697 0 0 1-.514-.207 3.53 3.53 0 0 1-.213-.107c-.098-.05-.237-.124-.521-.263L16 6l.011 7c0 .255-.028.507-.082.753h.001z"/>
                  </svg>
                </button>

                {/* Text */}
                <button 
                  onClick={() => setActivePanel('text')}
                  className={`group w-full h-10 rounded-xl transition-all duration-300 flex items-center justify-center focus:outline-none relative overflow-hidden ${
                    activePanel === 'text' 
                      ? 'text-editor-text-primary bg-editor-interactive-active border border-editor-border-secondary shadow-[0_4px_12px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.2)]' 
                      : 'text-editor-text-tertiary hover:text-editor-text-primary bg-editor-bg-glass-tertiary backdrop-blur-xl border border-editor-border-tertiary hover:bg-editor-interactive-hover hover:border-editor-border-secondary hover:scale-105 shadow-[0_2px_8px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.1)]'
                  }`}
                  title="Text"
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-xl"></div>
                  <svg className="w-5 h-5 relative z-10" fill="currentColor" viewBox="0 0 16 16">
                    <path d="M5.68412,13v-.72885l.221-.0181c.7641-.05812.947-.1896.98514-.22866.02573-.02668.1572-.202.1572-.99276V4.07755H6.47918A2.45938,2.45938,0,0,0,5.002,4.36909a2.26179,2.26179,0,0,0-.56259,1.35957l-.03811.19626H3.6038L3.70384,3h8.59994l.09242,2.92492h-.78411l-.02144-.09527a2.81746,2.81746,0,0,0-.58832-1.46532c-.14719-.13148-.52305-.28678-1.481-.28678H8.9606v7.12272c0,.67835.13815.8184.16578.83936a2.09154,2.09154,0,0,0,1.00943.21342l.223.0181V13Z"/>
                  </svg>
                </button>

                {/* Effects */}
                <button 
                  onClick={() => setActivePanel('effects')}
                  className={`group w-full h-10 rounded-xl transition-all duration-300 flex items-center justify-center focus:outline-none relative overflow-hidden ${
                    activePanel === 'effects' 
                      ? 'text-editor-text-primary bg-editor-interactive-active border border-editor-border-secondary shadow-[0_4px_12px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.2)]' 
                      : 'text-editor-text-tertiary hover:text-editor-text-primary bg-editor-bg-glass-tertiary backdrop-blur-xl border border-editor-border-tertiary hover:bg-editor-interactive-hover hover:border-editor-border-secondary hover:scale-105 shadow-[0_2px_8px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.1)]'
                  }`}
                  title="Effects"
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-xl"></div>
                  <svg className="w-5 h-5 relative z-10" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M15.199 9.945a2.6 2.6 0 0 1-.79-1.551l-.403-3.083-2.73 1.486a2.6 2.6 0 0 1-1.72.273L6.5 6.5l.57 3.056a2.6 2.6 0 0 1-.273 1.72l-1.486 2.73 3.083.403a2.6 2.6 0 0 1 1.55.79l2.138 2.257 1.336-2.807a2.6 2.6 0 0 1 1.23-1.231l2.808-1.336-2.257-2.137zm.025 5.563l-2.213 4.65a.6.6 0 0 1-.977.155l-3.542-3.739a.6.6 0 0 0-.357-.182l-5.107-.668a.6.6 0 0 1-.449-.881l2.462-4.524a.6.6 0 0 0 .062-.396L4.16 4.86a.6.6 0 0 1 .7-.7l5.063.943a.6.6 0 0 0 .396-.062l4.524-2.462a.6.6 0 0 1 .881.45l.668 5.106a.6.6 0 0 0 .182.357l3.739 3.542a.6.6 0 0 1-.155.977l-4.65 2.213a.6.6 0 0 0-.284.284zm.797 1.927l1.414-1.414 4.243 4.242-1.415 1.415-4.242-4.243z"/>
                  </svg>
                </button>

                {/* Filters */}
                <button 
                  onClick={() => setActivePanel('filters')}
                  className={`group w-full h-10 rounded-xl transition-all duration-300 flex items-center justify-center focus:outline-none relative overflow-hidden ${
                    activePanel === 'filters' 
                      ? 'text-editor-text-primary bg-editor-interactive-active border border-editor-border-secondary shadow-[0_4px_12px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.2)]' 
                      : 'text-editor-text-tertiary hover:text-editor-text-primary bg-editor-bg-glass-tertiary backdrop-blur-xl border border-editor-border-tertiary hover:bg-editor-interactive-hover hover:border-editor-border-secondary hover:scale-105 shadow-[0_2px_8px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.1)]'
                  }`}
                  title="Filters"
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-xl"></div>
                  <svg className="w-5 h-5 relative z-10" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M16,1a6.956,6.956,0,0,0-4,1.264A7,7,0,1,0,5.19,14.407a7,7,0,1,0,13.62,0A7,7,0,0,0,16,1ZM12.881,9.062a6.29,6.29,0,0,0-1.762,0A4.88,4.88,0,0,1,12,5.031a4.88,4.88,0,0,1,.881,4.031Zm-2.387,3.246A4.938,4.938,0,0,1,8.028,13a5.015,5.015,0,0,1,1.9-1.533A7,7,0,0,0,10.494,12.308Zm3.58-.844A5.015,5.015,0,0,1,15.972,13a4.938,4.938,0,0,1-2.466-.689A7,7,0,0,0,14.074,11.464ZM3,8A5.006,5.006,0,0,1,8,3a4.948,4.948,0,0,1,2.494.692,6.911,6.911,0,0,0-1.3,5.9,7.037,7.037,0,0,0-3.264,2.943A5,5,0,0,1,3,8Zm14,8a5,5,0,1,1-9.881-1.062A6.839,6.839,0,0,0,12,13.736a6.839,6.839,0,0,0,4.881,1.2A4.959,4.959,0,0,1,17,16Zm1.074-3.464A7.029,7.029,0,0,0,14.81,9.594a6.913,6.913,0,0,0-1.3-5.9A4.948,4.948,0,0,1,16,3a4.992,4.992,0,0,1,2.074,9.536Z"/>
                  </svg>
                </button>

              </div>
            </div>
          </div>

          {/* Right Section - Dynamic Panel */}
          <div className="flex-1 bg-editor-bg-glass-primary backdrop-blur-2xl border border-editor-border-tertiary rounded-2xl overflow-hidden flex flex-col h-full min-h-0 shadow-[0_8px_32px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.1)] relative">
            <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent rounded-2xl"></div>
            {/* Header */}
            <div className="px-3 sm:px-4 py-0 border-b border-editor-border-tertiary bg-editor-bg-glass-secondary backdrop-blur-xl flex items-center justify-between min-h-[2.3125rem] relative z-10">
              <h3 className="text-sm font-medium text-editor-text-primary capitalize">
                {activePanel === 'audio' ? 'Song Library' : activePanel}
              </h3>
              <div className="flex items-center">
                {activePanel === 'media' && (
                  <button
                    onClick={() => pickMultipleFiles()}
                    className="group flex items-center gap-1.5 px-3 py-1.5 text-xs bg-editor-bg-glass-tertiary backdrop-blur-xl border border-editor-border-secondary text-editor-text-primary rounded-xl hover:bg-editor-interactive-hover hover:border-editor-border-primary transition-all duration-300 hover:scale-105 shadow-[0_2px_8px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.1)] relative overflow-hidden"
                  >
                    <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-xl"></div>
                    <svg className="w-3 h-3 relative z-10" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                    </svg>
                    <span className="relative z-10">Add Media</span>
                  </button>
                )}
                {activePanel === 'audio' && (
                  <div className="text-xs text-editor-text-muted">
                    Royalty-free music
                  </div>
                )}
              </div>
            </div>
            
            {/* Dynamic Panel Content */}
            <div className="bg-editor-bg-canvas flex-1 relative z-10">
              {activePanel === 'media' && (
                <MediaGrid
                  mediaFiles={mediaFiles}
                  onAddMedia={pickMultipleFiles}
                  onRemoveMedia={removeMediaFile}
                  onDragStart={(mediaFile) => {
                    // Handle drag start - this will be used for drag and drop to timeline
                    log(`Started dragging: ${mediaFile.name}`);
                  }}
                />
              )}
              {activePanel === 'transitions' && <TransitionsPanel />}
              {activePanel === 'audio' && (
                <SongLibrary
                  onAddSong={(song) => {
                    // Add the downloaded song to media files
                    log(`Added song to library: ${song.name}`);
                    // Note: The song is already added to the songDownloader's cache
                    // We could add it to the main mediaFiles state if needed
                  }}
                  onDragStart={(song) => {
                    // Handle drag start for songs - this will be used for drag and drop to timeline
                    log(`Started dragging song: ${song.name}`);
                    // We'll handle the drop in the timeline component
                  }}
                />
              )}
              {activePanel === 'text' && <TextPanel />}
              {activePanel === 'effects' && <EffectsPanel />}
              {activePanel === 'filters' && <FiltersPanel />}
            </div>
          </div>
        </div>

        {/* Center Panel - Video Preview */}
        <div className="flex-1 flex flex-col overflow-hidden min-h-0 bg-transparent min-w-0 p-2">
          <div className="bg-editor-bg-glass-primary backdrop-blur-2xl border border-editor-border-tertiary rounded-2xl overflow-hidden flex flex-col h-full min-h-0 shadow-[0_8px_32px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.1)] relative">
            <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent rounded-2xl"></div>
            {/* Header */}
            <div className="px-3 sm:px-4 py-1.5 sm:py-2 border-b border-editor-border-tertiary bg-editor-bg-glass-secondary backdrop-blur-xl flex items-center justify-between relative z-10">
              <h3 className="text-sm font-medium text-editor-text-primary">Preview</h3>
              <div className="text-editor-text-muted">
                <Play className="w-4 h-4" fill="currentColor" />
              </div>
            </div>
            
            {/* Content */}
            <div className="flex-1 flex flex-col overflow-hidden min-h-0 bg-editor-bg-canvas relative z-10">
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
                <div className="lg:hidden border-b border-editor-border-tertiary p-4 bg-editor-bg-glass-secondary backdrop-blur-xl">
                  <div className="space-y-2 text-xs">
                    <div>
                      <span className="text-editor-text-tertiary">File Path:</span>
                      <div className="text-editor-text-secondary break-all">{filePath || "None"}</div>
                    </div>
                    <div>
                      <span className="text-editor-text-tertiary">Duration:</span>
                      <div className="text-editor-text-secondary">{probe ? `${probe.duration}s` : "None"}</div>
                    </div>
                    <div>
                      <span className="text-editor-text-tertiary">Cuts:</span>
                      <div className="text-editor-text-secondary">Accepted: {acceptedCuts.length}, Preview: {previewCuts.length}</div>
                    </div>
                    <div className="mt-2">
                      <span className="text-editor-text-tertiary">Recent Logs:</span>
                      <pre className="text-editor-text-secondary whitespace-pre-wrap text-xs max-h-32 overflow-y-auto">
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
        <div className="hidden lg:block w-[26rem] xl:w-[30rem] flex h-full min-h-0 gap-3 p-2">
          <div className="flex-1 bg-editor-bg-glass-primary backdrop-blur-2xl border border-editor-border-tertiary rounded-2xl overflow-hidden flex flex-col h-full min-h-0 shadow-[0_8px_32px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.1)] relative">
            <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent rounded-2xl"></div>
            <Sidebar
              previewUrl={previewUrl}
              acceptedCuts={acceptedCuts}
              previewCuts={previewCuts}
              onExecuteCommand={handleExecuteCommand}
              onAcceptPlan={acceptPlan}
              onRejectPlan={rejectPlan}
              agentContext={agentContext}
            />
          </div>
        </div>
      </div>

      {/* Timeline Section - Always Visible */}
      <div className="flex-shrink-0 border-t border-editor-border-tertiary bg-editor-bg-glass-overlay backdrop-blur-2xl relative">
        <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent"></div>
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
              onUpdateTrack={handleUpdateTrack}
              onAddTrack={handleAddTrack}
              onDropMedia={handleDropMedia}
              onDeleteClip={deleteClip}
              onSplitClip={splitClip}
              onResizeClip={resizeClip}
              onUndo={undo}
              onRedo={redo}
              historyIndex={historyIndex}
              editHistoryLength={editHistory.length}
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

      {/* API Key Manager */}
      <ApiKeyManager
        isOpen={showApiKeyManager}
        onClose={() => setShowApiKeyManager(false)}
        onApiKeySet={() => {
          console.log('API key configured successfully');
        }}
      />
    </div>
  );
}