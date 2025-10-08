import { useState, useEffect, useRef, useCallback, type RefObject } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import type { Clip, MediaFile } from '../../../types';
import type { ExtendedStreamingPlayerHandle } from '../../../components/StreamingVideoPlayer';

interface StreamingPreviewState {
  isStreaming: boolean;
  error: string | null;
  progress: number;
  chunksReceived: number;
  isComplete: boolean;
}

interface UseStreamingPreviewOptions {
  clips: Clip[];
  mediaFiles: MediaFile[];
  playerRef: RefObject<ExtendedStreamingPlayerHandle | null>;
  enabled?: boolean;
}

interface StreamingSegment {
  media_path: string;
  start_time: number;
  end_time: number;
  timeline_offset: number;
}

/**
 * Streaming preview hook using MSE for progressive playback
 * Streams video chunks as they're encoded - truly instant preview
 */
export function useStreamingPreview({
  clips,
  mediaFiles,
  playerRef,
  enabled = true,
}: UseStreamingPreviewOptions) {
  const [state, setState] = useState<StreamingPreviewState>({
    isStreaming: false,
    error: null,
    progress: 0,
    chunksReceived: 0,
    isComplete: false,
  });

  const currentClipsHashRef = useRef<string>('');
  const unlistenChunkRef = useRef<(() => void) | null>(null);
  const unlistenCompleteRef = useRef<(() => void) | null>(null);
  const unlistenErrorRef = useRef<(() => void) | null>(null);

  // Generate hash for clips to detect changes
  const generateClipsHash = useCallback((clips: Clip[]): string => {
    return clips
      .map(c => `${c.mediaFileId}_${c.startTime}_${c.endTime}_${c.offset}`)
      .join('|');
  }, []);

  // Convert clips to streaming segments
  const clipsToSegments = useCallback((clips: Clip[], mediaFiles: MediaFile[]): StreamingSegment[] => {
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
          timeline_offset: clip.offset,
        };
      })
      .sort((a, b) => a.timeline_offset - b.timeline_offset);
  }, []);

  // Start streaming preview (memoized to prevent re-creation)
  const startStreamingRef = useRef<((force?: boolean) => Promise<void>) | null>(null);
  
  useEffect(() => {
    startStreamingRef.current = async (force = false) => {
      console.log('📊 Streaming check:', { enabled, clipsCount: clips.length, hasPlayer: !!playerRef.current });
      
      if (!enabled || clips.length === 0 || !playerRef.current) {
        console.log('⏸️ Streaming not started:', {
          enabled,
          clipsCount: clips.length,
          hasPlayer: !!playerRef.current
        });
        return;
      }

      const clipsHash = generateClipsHash(clips);
      
      // If same clips and not forcing, don't restart
      if (!force && clipsHash === currentClipsHashRef.current) {
        console.log('⚡ Same configuration, skipping restart');
        return;
      }

      console.log('🎬 New configuration detected, starting stream');
      currentClipsHashRef.current = clipsHash;

      const segments = clipsToSegments(clips, mediaFiles);
      
      if (segments.length === 0) {
        setState({ isStreaming: false, error: 'No valid segments', progress: 0, chunksReceived: 0, isComplete: false });
        return;
      }

      console.log('🎬 Starting streaming preview...', { segments: segments.length });

      setState({ isStreaming: true, error: null, progress: 0, chunksReceived: 0, isComplete: false });

    // Clean up existing listeners
    if (unlistenChunkRef.current) unlistenChunkRef.current();
    if (unlistenCompleteRef.current) unlistenCompleteRef.current();
    if (unlistenErrorRef.current) unlistenErrorRef.current();

    try {
      // Listen for streaming chunks
      const unlistenChunk = await listen<string>('preview-chunk', (event) => {
        const base64Chunk = event.payload;
        
        try {
          // Decode base64 to ArrayBuffer
          const binaryString = atob(base64Chunk);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }

          console.log(`🎞️ Decoded chunk: ${bytes.length} bytes from ${base64Chunk.length} base64 chars`);

          // Append to player
          if (playerRef.current) {
            playerRef.current.appendChunk(bytes.buffer);
          } else {
            console.warn('⚠️ No player ref available to append chunk');
          }
          
          setState(prev => ({
            ...prev,
            chunksReceived: prev.chunksReceived + 1,
            progress: Math.min(95, (prev.chunksReceived / 40) * 100), // Estimate based on typical chunk count
          }));
        } catch (error) {
          console.error('Failed to process chunk:', error);
        }
      });
      unlistenChunkRef.current = unlistenChunk;

      // Listen for completion
      const unlistenComplete = await listen('preview-complete', () => {
        console.log('✅ Streaming preview complete');
        playerRef.current?.completeStream();
        setState(prev => ({ ...prev, isStreaming: false, isComplete: true, progress: 100 }));
        
        // Diagnostic check after 2 seconds
        setTimeout(() => {
          console.log('🔍 Auto-diagnostic running...');
          const player = playerRef.current as any;
          const video = player?.videoRef?.current;
          const mediaSource = player?.mediaSourceRef?.current;
          const sourceBuffer = player?.sourceBufferRef?.current;
          
          if (video) {
            console.log('📊 Video diagnostic after completion:', {
              readyState: video.readyState,
              readyStateText: ['HAVE_NOTHING', 'HAVE_METADATA', 'HAVE_CURRENT_DATA', 'HAVE_FUTURE_DATA', 'HAVE_ENOUGH_DATA'][video.readyState],
              duration: video.duration,
              currentTime: video.currentTime,
              buffered: Array.from({ length: video.buffered.length }, (_, i) => ({
                start: video.buffered.start(i),
                end: video.buffered.end(i)
              })),
              error: video.error,
              networkState: video.networkState,
              paused: video.paused
            });
            
            if (mediaSource) {
              console.log('📊 MediaSource state:', {
                readyState: mediaSource.readyState,
                duration: mediaSource.duration,
                sourceBuffers: mediaSource.sourceBuffers.length
              });
            }
            
            if (sourceBuffer) {
              console.log('📊 SourceBuffer state:', {
                updating: sourceBuffer.updating,
                buffered: Array.from({ length: sourceBuffer.buffered.length }, (_, i) => ({
                  start: sourceBuffer.buffered.start(i),
                  end: sourceBuffer.buffered.end(i)
                })),
                appendWindowStart: sourceBuffer.appendWindowStart,
                appendWindowEnd: sourceBuffer.appendWindowEnd,
                mode: sourceBuffer.mode
              });
            }
            
            if (video.readyState < 2) {
              console.error('❌ ISSUE: Video readyState is too low!');
              console.log('💡 This means chunks were received but video can\'t read them.');
              console.log('💡 Possible causes: codec not supported, MSE error, or incomplete stream');
              if (video.error) {
                console.error('Video error details:', {
                  code: video.error.code,
                  message: video.error.message
                });
              }
            } else if (video.duration === Infinity || isNaN(video.duration)) {
              console.error('❌ ISSUE: Video duration is invalid!');
              console.log('💡 This means MediaSource.endOfStream() might not have been called properly');
            } else {
              console.log('✅ Video looks good! Should be playable.');
            }
          } else {
            console.error('❌ Could not access video element for diagnostics');
          }
        }, 2000);
      });
      unlistenCompleteRef.current = unlistenComplete;

      // Listen for errors
      const unlistenError = await listen<string>('preview-error', (event) => {
        console.error('❌ Streaming preview error:', event.payload);
        setState({ isStreaming: false, error: event.payload, progress: 0, chunksReceived: 0, isComplete: false });
      });
      unlistenErrorRef.current = unlistenError;

      // Start streaming from backend
      await invoke('start_streaming_preview', {
        clips: segments,
        width: 1280,
      });

    } catch (error) {
      console.error('Failed to start streaming:', error);
      setState({ 
        isStreaming: false, 
        error: error instanceof Error ? error.message : 'Failed to start streaming',
        progress: 0,
        chunksReceived: 0,
        isComplete: false,
      });
    }
  };
}, [clips, mediaFiles, enabled, playerRef, clipsToSegments, generateClipsHash]);

  // Trigger streaming when clips change (with proper dependency management)
  useEffect(() => {
    if (!enabled || clips.length === 0) {
      return;
    }

    const clipsHash = generateClipsHash(clips);
    
    // Skip if this exact configuration is already streaming or complete
    if (clipsHash === currentClipsHashRef.current) {
      console.log('⚡ Same configuration, skipping re-encode');
      return;
    }
    
    // If clips changed, reset player and restart streaming
    console.log('🔄 Timeline changed, resetting player');
    playerRef.current?.reset();

    // Minimal debounce for rapid edits
    const timer = setTimeout(() => {
      startStreamingRef.current?.();
    }, 300); // Very short debounce - just enough to batch rapid edits

    return () => clearTimeout(timer);
  }, [clips, mediaFiles, enabled, generateClipsHash, playerRef]);

  // Cleanup listeners on unmount
  useEffect(() => {
    return () => {
      if (unlistenChunkRef.current) unlistenChunkRef.current();
      if (unlistenCompleteRef.current) unlistenCompleteRef.current();
      if (unlistenErrorRef.current) unlistenErrorRef.current();
    };
  }, []);

  return {
    isStreaming: state.isStreaming,
    error: state.error,
    progress: state.progress,
    chunksReceived: state.chunksReceived,
    isComplete: state.isComplete,
    restart: () => startStreamingRef.current?.(true),
  };
}

