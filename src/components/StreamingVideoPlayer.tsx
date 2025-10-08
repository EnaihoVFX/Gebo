import { forwardRef, useImperativeHandle, useRef, useEffect, useState, useCallback } from 'react';
import { Play, Pause, Loader2 } from 'lucide-react';

export interface StreamingPlayerHandle {
  play: () => void;
  pause: () => void;
  seek: (t: number) => void;
  isPlaying: () => boolean;
  currentTime: () => number;
}

export interface StreamingPlayerProps {
  onReady?: () => void;
  onError?: (error: string) => void;
  className?: string;
}

/**
 * Streaming video player using Media Source Extensions (MSE)
 * Allows progressive playback while video is still being encoded
 */
export const StreamingVideoPlayer = forwardRef<StreamingPlayerHandle, StreamingPlayerProps>(
  function StreamingVideoPlayer({ onReady, onError, className }, ref) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const mediaSourceRef = useRef<MediaSource | null>(null);
    const sourceBufferRef = useRef<SourceBuffer | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isBuffering, setIsBuffering] = useState(false);
    const [isReady, setIsReady] = useState(false);
    const chunksQueueRef = useRef<ArrayBuffer[]>([]);
    const isAppendingRef = useRef(false);
    const [bufferHealth, setBufferHealth] = useState(100);
    const maxQueueSize = 100; // Prevent memory issues

    // Initialize Media Source
    useEffect(() => {
      const video = videoRef.current;
      if (!video) return;

      // Check MSE support
      if (!window.MediaSource) {
        console.error('MSE not supported');
        onError?.('Media Source Extensions not supported in this browser');
        return;
      }

      const mimeCodec = 'video/mp4; codecs="avc1.42E01E, mp4a.40.2"';
      if (!MediaSource.isTypeSupported(mimeCodec)) {
        console.error('Codec not supported:', mimeCodec);
        onError?.('Required video codec not supported');
        return;
      }

      // Create MediaSource
      const mediaSource = new MediaSource();
      mediaSourceRef.current = mediaSource;
      video.src = URL.createObjectURL(mediaSource);

      mediaSource.addEventListener('sourceopen', () => {
        try {
          const sourceBuffer = mediaSource.addSourceBuffer(mimeCodec);
          sourceBufferRef.current = sourceBuffer;

          sourceBuffer.addEventListener('updateend', () => {
            isAppendingRef.current = false;
            // Process next chunk if available
            processChunkQueue();
          });

          sourceBuffer.addEventListener('error', (e) => {
            console.error('SourceBuffer error:', e);
            onError?.('Playback error occurred');
            
            // Try to recover by clearing buffer
            try {
              if (sourceBuffer.buffered.length > 0) {
                const start = sourceBuffer.buffered.start(0);
                const end = sourceBuffer.buffered.end(sourceBuffer.buffered.length - 1);
                sourceBuffer.remove(start, end);
              }
            } catch (removeError) {
              console.error('Failed to recover from error:', removeError);
            }
          });

          sourceBuffer.addEventListener('abort', () => {
            console.log('SourceBuffer aborted');
            isAppendingRef.current = false;
          });

          setIsReady(true);
          onReady?.();
          console.log('✅ MSE ready for streaming');
        } catch (e) {
          console.error('Failed to create source buffer:', e);
          onError?.('Failed to initialize streaming playback');
        }
      });

      mediaSource.addEventListener('sourceended', () => {
        console.log('Streaming complete');
      });

      return () => {
        if (mediaSourceRef.current && mediaSourceRef.current.readyState === 'open') {
          try {
            mediaSourceRef.current.endOfStream();
          } catch (e) {
            console.error('Error ending stream:', e);
          }
        }
        if (video.src) {
          URL.revokeObjectURL(video.src);
        }
      };
    }, [onReady, onError]);

    // Process chunk queue
    const processChunkQueue = useCallback(() => {
      const sourceBuffer = sourceBufferRef.current;
      if (!sourceBuffer || isAppendingRef.current || sourceBuffer.updating) {
        return;
      }

      const chunk = chunksQueueRef.current.shift();
      if (chunk) {
        try {
          isAppendingRef.current = true;
          console.log(`📥 Appending chunk (${chunk.byteLength} bytes), queue: ${chunksQueueRef.current.length}`);
          sourceBuffer.appendBuffer(chunk);
        } catch (e) {
          console.error('Failed to append buffer:', e);
          isAppendingRef.current = false;
        }
      }
    }, []);

  // Append chunk to source buffer with queue management
  const appendChunk = useCallback((chunk: ArrayBuffer) => {
    console.log('📦 Received chunk:', chunk.byteLength, 'bytes');
    
    // Prevent queue from growing too large
    if (chunksQueueRef.current.length >= maxQueueSize) {
      console.warn('⚠️ Buffer queue full, dropping oldest chunk');
      chunksQueueRef.current.shift();
    }
    
    chunksQueueRef.current.push(chunk);
    
    // Update buffer health indicator
    const health = Math.max(0, 100 - (chunksQueueRef.current.length / maxQueueSize * 100));
    setBufferHealth(health);
    
    processChunkQueue();
  }, [processChunkQueue]);

  // Monitor buffer levels
  useEffect(() => {
    const interval = setInterval(() => {
      const queueSize = chunksQueueRef.current.length;
      const sourceBuffer = sourceBufferRef.current;
      
      if (sourceBuffer && videoRef.current) {
        // Check buffered ranges
        const buffered = sourceBuffer.buffered;
        const currentTime = videoRef.current.currentTime;
        
        let bufferAhead = 0;
        for (let i = 0; i < buffered.length; i++) {
          if (buffered.start(i) <= currentTime && buffered.end(i) >= currentTime) {
            bufferAhead = buffered.end(i) - currentTime;
            break;
          }
        }
        
        // Update health based on buffer ahead
        const health = Math.min(100, bufferAhead * 20); // 5s buffer = 100%
        setBufferHealth(health);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, []);

    // Complete streaming
    const completeStream = useCallback(() => {
      const mediaSource = mediaSourceRef.current;
      const video = videoRef.current;
      
      if (mediaSource && mediaSource.readyState === 'open') {
        // Wait for all chunks to be appended
        const checkComplete = () => {
          const sourceBuffer = sourceBufferRef.current;
          if (sourceBuffer && !sourceBuffer.updating && chunksQueueRef.current.length === 0) {
            try {
              mediaSource.endOfStream();
              console.log('✅ Stream ended successfully');
              
              // Log video state after stream completion
              if (video) {
                console.log('📊 Video state after stream:', {
                  readyState: video.readyState,
                  duration: video.duration,
                  buffered: video.buffered.length > 0 ? {
                    start: video.buffered.start(0),
                    end: video.buffered.end(0)
                  } : 'none',
                  currentTime: video.currentTime
                });
                
                // Ensure video is at start
                if (video.currentTime === 0 && video.readyState >= 2) {
                  console.log('🎬 Video ready to play!');
                }
              }
            } catch (e) {
              console.error('Error ending stream:', e);
            }
          } else {
            setTimeout(checkComplete, 100);
          }
        };
        checkComplete();
      }
    }, []);

  // Reset streaming state
  const reset = useCallback(() => {
    // Clear queue
    chunksQueueRef.current = [];
    isAppendingRef.current = false;
    
    // Reset source buffer if exists
    const sourceBuffer = sourceBufferRef.current;
    if (sourceBuffer && !sourceBuffer.updating) {
      try {
        if (sourceBuffer.buffered.length > 0) {
          const start = sourceBuffer.buffered.start(0);
          const end = sourceBuffer.buffered.end(sourceBuffer.buffered.length - 1);
          sourceBuffer.remove(start, end);
        }
      } catch (e) {
        console.error('Error resetting buffer:', e);
      }
    }
    
    // Reset video
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
      videoRef.current.pause();
    }
    
    setBufferHealth(100);
    console.log('🔄 Streaming player reset');
  }, []);

  // Expose methods via ref
  useImperativeHandle(ref, () => ({
    appendChunk,
    completeStream,
    reset,
    play: () => {
      videoRef.current?.play()?.catch(console.error);
    },
    pause: () => {
      videoRef.current?.pause();
    },
    seek: (t: number) => {
      if (videoRef.current) {
        videoRef.current.currentTime = t;
      }
    },
    isPlaying: () => {
      return !!videoRef.current && !videoRef.current.paused && !videoRef.current.ended;
    },
    currentTime: () => videoRef.current?.currentTime || 0,
    // Expose for diagnostics
    videoRef,
    mediaSourceRef,
    sourceBufferRef,
  }));

    // Play/pause handlers
    const handleTogglePlay = () => {
      const video = videoRef.current;
      if (!video) {
        console.error('No video element');
        return;
      }

      console.log('🎮 Toggle play:', {
        isPlaying,
        readyState: video.readyState,
        paused: video.paused,
        currentTime: video.currentTime,
        duration: video.duration,
        buffered: video.buffered.length,
        networkState: video.networkState,
        error: video.error
      });

      if (isPlaying) {
        video.pause();
      } else {
        // Try to play
        const playPromise = video.play();
        if (playPromise) {
          playPromise
            .then(() => {
              console.log('✅ Playback started successfully');
            })
            .catch((error) => {
              console.error('❌ Play failed:', error);
              // Common issue: not enough data
              if (video.readyState < 3) {
                console.log('⏳ Waiting for more data... readyState:', video.readyState);
              }
            });
        }
      }
    };

    // Track playing state and video readiness
    useEffect(() => {
      const video = videoRef.current;
      if (!video) return;

      const handlePlay = () => {
        console.log('▶️ Video play event');
        setIsPlaying(true);
      };
      
      const handlePause = () => {
        console.log('⏸️ Video pause event');
        setIsPlaying(false);
      };
      
      const handleWaiting = () => {
        console.log('⏳ Video waiting for data');
        setIsBuffering(true);
      };
      
      const handleCanPlay = () => {
        console.log('✅ Video can play (some data available)');
        setIsBuffering(false);
      };

      const handleCanPlayThrough = () => {
        console.log('✅ Video can play through (enough data)');
        setIsBuffering(false);
      };

      const handleLoadedMetadata = () => {
        console.log('📊 Video metadata loaded:', {
          duration: video.duration,
          videoWidth: video.videoWidth,
          videoHeight: video.videoHeight
        });
      };

      const handleLoadedData = () => {
        console.log('📦 Video data loaded (first frame ready)');
      };

      const handleError = (e: Event) => {
        console.error('❌ Video error event:', video.error);
        onError?.(video.error?.message || 'Video playback error');
      };

      const handleStalled = () => {
        console.warn('⚠️ Video stalled (network issue?)');
      };

      video.addEventListener('play', handlePlay);
      video.addEventListener('pause', handlePause);
      video.addEventListener('waiting', handleWaiting);
      video.addEventListener('canplay', handleCanPlay);
      video.addEventListener('canplaythrough', handleCanPlayThrough);
      video.addEventListener('loadedmetadata', handleLoadedMetadata);
      video.addEventListener('loadeddata', handleLoadedData);
      video.addEventListener('error', handleError);
      video.addEventListener('stalled', handleStalled);

      return () => {
        video.removeEventListener('play', handlePlay);
        video.removeEventListener('pause', handlePause);
        video.removeEventListener('waiting', handleWaiting);
        video.removeEventListener('canplay', handleCanPlay);
        video.removeEventListener('canplaythrough', handleCanPlayThrough);
        video.removeEventListener('loadedmetadata', handleLoadedMetadata);
        video.removeEventListener('loadeddata', handleLoadedData);
        video.removeEventListener('error', handleError);
        video.removeEventListener('stalled', handleStalled);
      };
    }, [onError]);

    return (
      <div className={className}>
        <div className="relative w-full">
          <video
            ref={videoRef}
            className="w-full object-contain bg-black rounded"
            style={{ aspectRatio: "16 / 9" }}
            playsInline
            controls={false}
          />

          {/* Buffering indicator */}
          {isBuffering && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/20">
              <Loader2 className="w-8 h-8 text-white animate-spin" />
            </div>
          )}

          {/* Controls */}
          {isReady && (
            <div className="mt-2 flex flex-col items-center gap-2">
              <div className="flex items-center justify-center gap-3">
                <button
                  onClick={handleTogglePlay}
                  className="group w-10 h-10 flex items-center justify-center text-white hover:text-blue-400 bg-black/50 hover:bg-black/70 backdrop-blur border border-white/20 hover:border-blue-400/50 rounded-lg transition-all duration-200"
                >
                  {isPlaying ? (
                    <Pause className="w-5 h-5" />
                  ) : (
                    <Play className="w-5 h-5" />
                  )}
                </button>
                
                {/* Diagnostic info */}
                <button
                  onClick={() => {
                    const video = videoRef.current;
                    if (video) {
                      console.log('🔍 Video diagnostic:', {
                        readyState: video.readyState,
                        readyStateText: ['HAVE_NOTHING', 'HAVE_METADATA', 'HAVE_CURRENT_DATA', 'HAVE_FUTURE_DATA', 'HAVE_ENOUGH_DATA'][video.readyState],
                        networkState: video.networkState,
                        duration: video.duration,
                        currentTime: video.currentTime,
                        paused: video.paused,
                        ended: video.ended,
                        seeking: video.seeking,
                        buffered: Array.from({ length: video.buffered.length }, (_, i) => ({
                          start: video.buffered.start(i),
                          end: video.buffered.end(i)
                        })),
                        error: video.error,
                        src: video.src.substring(0, 50)
                      });
                    }
                  }}
                  className="text-xs px-2 py-1 text-white/60 hover:text-white/90 bg-black/30 hover:bg-black/50 border border-white/10 rounded transition-all"
                  title="Show diagnostic info in console"
                >
                  Debug
                </button>
              </div>
              
              {/* Ready state indicator */}
              {videoRef.current && (
                <div className="text-xs text-white/50">
                  {videoRef.current.readyState < 2 ? '⏳ Loading...' :
                   videoRef.current.readyState < 3 ? '📦 Data available' :
                   videoRef.current.readyState < 4 ? '▶️ Can play' :
                   '✅ Ready'}
                </div>
              )}
            </div>
          )}

          {!isReady && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/40">
              <div className="text-white text-sm">Initializing player...</div>
            </div>
          )}
        </div>
      </div>
    );
  }
);

// Extend the handle type to include streaming methods
export interface ExtendedStreamingPlayerHandle extends StreamingPlayerHandle {
  appendChunk: (chunk: ArrayBuffer) => void;
  completeStream: () => void;
  reset: () => void;
}

