import { useEffect, useState, useCallback } from 'react';
import { projectManager, type ProjectData, type MediaFileData, type TrackData, type ClipData } from '../lib/projectManager';

// Hook to use the project manager
export function useProject() {
  const [projectData, setProjectData] = useState<ProjectData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Subscribe to project changes
    const unsubscribe = projectManager.subscribe((data) => {
      setProjectData(data);
      setIsLoading(false);
    });

    // Get initial data
    const initialData = projectManager.getProjectData();
    if (initialData) {
      setProjectData(initialData);
      setIsLoading(false);
    }

    return unsubscribe;
  }, []);

  // Media file operations
  const addMediaFile = useCallback((mediaFile: MediaFileData) => {
    projectManager.addMediaFile(mediaFile);
  }, []);

  const removeMediaFile = useCallback((mediaFileId: string) => {
    projectManager.removeMediaFile(mediaFileId);
  }, []);

  // Track operations
  const addTrack = useCallback((track: TrackData) => {
    projectManager.addTrack(track);
  }, []);

  const updateTrack = useCallback((trackId: string, updates: Partial<TrackData>) => {
    projectManager.updateTrack(trackId, updates);
  }, []);

  const removeTrack = useCallback((trackId: string) => {
    projectManager.removeTrack(trackId);
  }, []);

  // Clip operations
  const addClip = useCallback((clip: ClipData) => {
    projectManager.addClip(clip);
  }, []);

  const updateClip = useCallback((clipId: string, updates: Partial<ClipData>) => {
    projectManager.updateClip(clipId, updates);
  }, []);

  const removeClip = useCallback((clipId: string) => {
    projectManager.removeClip(clipId);
  }, []);

  // Timeline operations
  const updateTimeline = useCallback((updates: Partial<ProjectData['timeline']>) => {
    projectManager.updateTimeline(updates);
  }, []);

  // Timeline tools
  const splitClip = useCallback((clipId: string, splitTime: number) => {
    projectManager.splitClip(clipId, splitTime);
  }, []);

  const resizeClip = useCallback((clipId: string, newStartTime: number, newEndTime: number) => {
    projectManager.resizeClip(clipId, newStartTime, newEndTime);
  }, []);

  // AI operations
  const aiAddClip = useCallback((
    mediaFileId: string, 
    trackId: string, 
    offset: number, 
    startTime: number, 
    endTime: number, 
    options?: {
      name?: string;
      description?: string;
      tags?: string[];
    }
  ) => {
    projectManager.aiAddClip(mediaFileId, trackId, offset, startTime, endTime, options);
  }, []);

  const aiMoveClip = useCallback((clipId: string, newOffset: number) => {
    projectManager.aiMoveClip(clipId, newOffset);
  }, []);

  const aiTrimClip = useCallback((clipId: string, newStartTime: number, newEndTime: number) => {
    projectManager.aiTrimClip(clipId, newStartTime, newEndTime);
  }, []);

  // Export/Import
  const exportProject = useCallback(() => {
    return projectManager.exportToJSON();
  }, []);

  const importProject = useCallback((jsonString: string) => {
    projectManager.importFromJSON(jsonString);
  }, []);

  const saveProject = useCallback(async (filePath: string) => {
    await projectManager.saveToFile(filePath);
  }, []);

  const loadProject = useCallback(async (filePath: string) => {
    await projectManager.loadFromFile(filePath);
  }, []);

  return {
    projectData,
    isLoading,
    // Media operations
    addMediaFile,
    removeMediaFile,
    // Track operations
    addTrack,
    updateTrack,
    removeTrack,
    // Clip operations
    addClip,
    updateClip,
    removeClip,
    // Timeline operations
    updateTimeline,
    splitClip,
    resizeClip,
    // AI operations
    aiAddClip,
    aiMoveClip,
    aiTrimClip,
    // Export/Import
    exportProject,
    importProject,
    saveProject,
    loadProject,
  };
}

// Hook for AI operations specifically
export function useAITimelineOperations() {
  const { projectData, aiAddClip, aiMoveClip, aiTrimClip, splitClip, resizeClip, removeClip } = useProject();

  // Get current timeline state for AI
  const getTimelineState = useCallback(() => {
    if (!projectData) return null;
    
    return {
      clips: projectData.clips,
      tracks: projectData.tracks,
      mediaFiles: projectData.mediaFiles,
      timeline: projectData.timeline,
    };
  }, [projectData]);

  // AI-friendly clip operations
  const aiOperations = {
    // Add a clip to the timeline
    addClip: (mediaFileId: string, trackId: string, offset: number, startTime: number, endTime: number, options?: {
      name?: string;
      description?: string;
      tags?: string[];
    }) => {
      aiAddClip(mediaFileId, trackId, offset, startTime, endTime, options);
    },

    // Move a clip to a new position
    moveClip: (clipId: string, newOffset: number) => {
      aiMoveClip(clipId, newOffset);
    },

    // Trim a clip's content (change start/end times within the media file)
    trimClip: (clipId: string, newStartTime: number, newEndTime: number) => {
      aiTrimClip(clipId, newStartTime, newEndTime);
    },

    // Split a clip at a specific time
    splitClip: (clipId: string, splitTime: number) => {
      splitClip(clipId, splitTime);
    },

    // Resize a clip (change its timeline duration)
    resizeClip: (clipId: string, newStartTime: number, newEndTime: number) => {
      resizeClip(clipId, newStartTime, newEndTime);
    },

    // Remove a clip
    removeClip: (clipId: string) => {
      removeClip(clipId);
    },

    // Get timeline state for analysis
    getTimelineState,
  };

  return aiOperations;
}


