import { useState, useEffect, useRef, useCallback } from 'react';
import { readFileChunk, getFileSize } from '../../../lib/ffmpeg';
import { generateAdaptiveTimelinePreview, type TimelineClip } from '../../../lib/ffmpeg';
import type { Clip, MediaFile } from '../../../types';

interface PreviewState {
  previewUrl: string | null;
  isGenerating: boolean;
  error: string | null;
  progress: number;
}

interface UseTimelinePreviewOptions {
  clips: Clip[];
  mediaFiles: MediaFile[];
  playerWidth?: number;
  playerHeight?: number;
  debounceMs?: number;
  enabled?: boolean;
}

/**
 * Hook to manage timeline preview generation
 * Automatically regenerates preview when timeline changes
 */
export function useTimelinePreview({
  clips,
  mediaFiles,
  playerWidth = 1280,
  playerHeight = 720,
  debounceMs = 500,
  enabled = true,
}: UseTimelinePreviewOptions) {
  const [state, setState] = useState<PreviewState>({
    previewUrl: null,
    isGenerating: false,
    error: null,
    progress: 0,
  });

  const generationTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const currentGenerationRef = useRef<string | null>(null);
  const cacheRef = useRef<Map<string, string>>(new Map());

  // Generate a cache key from the current timeline state
  const generateCacheKey = useCallback((clips: Clip[]): string => {
    if (clips.length === 0) return 'empty';
    
    return clips
      .map(c => `${c.mediaFileId}_${c.startTime}_${c.endTime}_${c.offset}`)
      .sort()
      .join('|');
  }, []);

  // Calculate total duration from clips
  const calculateTotalDuration = useCallback((clips: Clip[]): number => {
    if (clips.length === 0) return 0;
    
    // Find the maximum end position (offset + clip duration)
    return Math.max(...clips.map(clip => 
      clip.offset + (clip.endTime - clip.startTime)
    ));
  }, []);

  // Convert UI clips to TimelineClip format
  const convertToTimelineClips = useCallback((clips: Clip[], mediaFiles: MediaFile[]): TimelineClip[] => {
    return clips
      .filter(clip => {
        const mediaFile = mediaFiles.find(mf => mf.id === clip.mediaFileId);
        return mediaFile && mediaFile.path;
      })
      .map(clip => {
        const mediaFile = mediaFiles.find(mf => mf.id === clip.mediaFileId)!;
        return {
          media_path: mediaFile.path,
          start_time: clip.startTime,
          end_time: clip.endTime,
          offset: clip.offset,
        };
      })
      .sort((a, b) => a.offset - b.offset);
  }, []);

  // Generate preview
  const generatePreview = useCallback(async (force: boolean = false) => {
    if (!enabled) return;
    if (clips.length === 0) {
      setState({
        previewUrl: null,
        isGenerating: false,
        error: null,
        progress: 0,
      });
      return;
    }

    const cacheKey = generateCacheKey(clips);
    
    // Check cache unless forcing regeneration
    if (!force && cacheRef.current.has(cacheKey)) {
      const cachedUrl = cacheRef.current.get(cacheKey)!;
      setState({
        previewUrl: cachedUrl,
        isGenerating: false,
        error: null,
        progress: 100,
      });
      return;
    }

    // Skip if already generating the same configuration
    if (currentGenerationRef.current === cacheKey && state.isGenerating) {
      return;
    }

    currentGenerationRef.current = cacheKey;

    setState(prev => ({
      ...prev,
      isGenerating: true,
      error: null,
      progress: 10,
    }));

    try {
      const timelineClips = convertToTimelineClips(clips, mediaFiles);
      
      console.log('📊 Preview Generation Debug:', {
        totalClips: clips.length,
        validClips: timelineClips.length,
        mediaFiles: mediaFiles.length,
        clips: clips.map(c => ({
          id: c.id,
          mediaFileId: c.mediaFileId,
          startTime: c.startTime,
          endTime: c.endTime,
          offset: c.offset,
        })),
        timelineClips: timelineClips.map(tc => ({
          path: tc.media_path,
          start: tc.start_time,
          end: tc.end_time,
          offset: tc.offset,
        })),
      });
      
      if (timelineClips.length === 0) {
        throw new Error('No valid clips to generate preview. Ensure media files have valid paths.');
      }

      const totalDuration = calculateTotalDuration(clips);

      setState(prev => ({ ...prev, progress: 30 }));

      console.log('🎬 Generating timeline preview...', {
        clipCount: timelineClips.length,
        totalDuration,
        playerWidth,
        playerHeight,
      });

      const previewPath = await generateAdaptiveTimelinePreview(
        timelineClips,
        playerWidth,
        playerHeight,
        totalDuration
      );

      console.log('✅ Preview path generated:', previewPath);

      setState(prev => ({ ...prev, progress: 90 }));

      // Read file as blob for reliable cross-platform playback (same method as main video player)
      console.log('📂 Reading preview file as blob...');
      const fileSize = await getFileSize(previewPath);
      const fileSizeMB = (fileSize / (1024 * 1024)).toFixed(2);
      console.log(`📊 File size: ${fileSizeMB} MB`);
      
      // Read file in chunks (2MB chunks)
      const chunkSize = 2 * 1024 * 1024;
      const chunks: Uint8Array[] = [];
      
      for (let offset = 0; offset < fileSize; offset += chunkSize) {
        const currentChunkSize = Math.min(chunkSize, fileSize - offset);
        const chunk = await readFileChunk(previewPath, offset, currentChunkSize);
        chunks.push(new Uint8Array(chunk));
      }
      
      console.log(`✅ Read ${chunks.length} chunks, creating blob...`);
      const blob = new Blob(chunks, { type: 'video/mp4' });
      const previewUrl = URL.createObjectURL(blob);

      console.log('🔗 Preview URL:', previewUrl);
      console.log('📁 Original path:', previewPath);
      console.log('💾 Blob size:', blob.size, 'bytes');

      // Cache the result
      cacheRef.current.set(cacheKey, previewUrl);

      // Limit cache size to prevent memory issues
      if (cacheRef.current.size > 10) {
        const firstKey = cacheRef.current.keys().next().value;
        cacheRef.current.delete(firstKey);
      }

      setState({
        previewUrl,
        isGenerating: false,
        error: null,
        progress: 100,
      });

      currentGenerationRef.current = null;
      console.log('✨ Timeline preview generated successfully');
    } catch (error) {
      console.error('❌ Failed to generate timeline preview:', error);
      console.error('Error details:', {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      setState({
        previewUrl: null,
        isGenerating: false,
        error: error instanceof Error ? error.message : 'Failed to generate preview',
        progress: 0,
      });
      currentGenerationRef.current = null;
    }
  }, [clips, mediaFiles, playerWidth, playerHeight, enabled, generateCacheKey, convertToTimelineClips, calculateTotalDuration, state.isGenerating]);

  // Debounced preview generation on timeline changes
  useEffect(() => {
    if (!enabled) return;

    const cacheKey = generateCacheKey(clips);
    
    // If we have this exact configuration cached, use it immediately (no debounce)
    if (cacheRef.current.has(cacheKey)) {
      const cachedUrl = cacheRef.current.get(cacheKey)!;
      console.log('⚡ Using cached preview (instant!)');
      setState({
        previewUrl: cachedUrl,
        isGenerating: false,
        error: null,
        progress: 100,
      });
      return;
    }

    // Clear any pending generation
    if (generationTimeoutRef.current) {
      clearTimeout(generationTimeoutRef.current);
    }

    // Debounce the generation for new configurations
    generationTimeoutRef.current = setTimeout(() => {
      generatePreview(false);
    }, debounceMs);

    return () => {
      if (generationTimeoutRef.current) {
        clearTimeout(generationTimeoutRef.current);
      }
    };
  }, [clips, mediaFiles, generatePreview, debounceMs, enabled, generateCacheKey]);

  // Clear cache and revoke blob URLs when unmounting
  useEffect(() => {
    return () => {
      // Revoke all blob URLs to free memory
      cacheRef.current.forEach((url) => {
        if (url.startsWith('blob:')) {
          URL.revokeObjectURL(url);
        }
      });
      cacheRef.current.clear();
    };
  }, []);

  return {
    previewUrl: state.previewUrl,
    isGenerating: state.isGenerating,
    error: state.error,
    progress: state.progress,
    regeneratePreview: () => generatePreview(true),
    clearCache: () => {
      // Revoke all blob URLs before clearing
      cacheRef.current.forEach((url) => {
        if (url.startsWith('blob:')) {
          URL.revokeObjectURL(url);
        }
      });
      cacheRef.current.clear();
      // Also revoke current preview URL if it's a blob
      if (state.previewUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(state.previewUrl);
      }
      setState(prev => ({ ...prev, previewUrl: null }));
    },
  };
}
