import { forwardRef, useImperativeHandle, useRef, useEffect, useState } from "react";
import { Play, Pause, SkipBack, SkipForward } from "lucide-react";
import type { PlayerHandle, PlayerProps, Range } from "../../../types";

export const Player = forwardRef<PlayerHandle, PlayerProps>(function Player(
  { src, cuts, large = false },
  ref
) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  useSkipPlayback(videoRef, cuts);

  // Reset video when source changes
  useEffect(() => {
    if (videoRef.current && src) {
      console.log(`Loading video: ${src}`);
      videoRef.current.load();
    }
  }, [src]);

  // Control functions
  const handlePlay = () => {
    if (videoRef.current && videoRef.current.readyState >= 2) {
      videoRef.current.play().catch(console.error);
      setIsPlaying(true);
    }
  };

  const handlePause = () => {
    videoRef.current?.pause();
    setIsPlaying(false);
  };

  const handleTogglePlay = () => {
    if (isPlaying) {
      handlePause();
    } else {
      handlePlay();
    }
  };

  const handleSeekBack = () => {
    if (videoRef.current) {
      const newTime = Math.max(0, videoRef.current.currentTime - 1);
      videoRef.current.currentTime = newTime;
    }
  };

  const handleSeekForward = () => {
    if (videoRef.current) {
      const newTime = videoRef.current.currentTime + 1;
      videoRef.current.currentTime = newTime;
    }
  };

  // Update playing state when video state changes
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handlePlayEvent = () => setIsPlaying(true);
    const handlePauseEvent = () => setIsPlaying(false);
    const handleEndedEvent = () => setIsPlaying(false);

    video.addEventListener('play', handlePlayEvent);
    video.addEventListener('pause', handlePauseEvent);
    video.addEventListener('ended', handleEndedEvent);

    return () => {
      video.removeEventListener('play', handlePlayEvent);
      video.removeEventListener('pause', handlePauseEvent);
      video.removeEventListener('ended', handleEndedEvent);
    };
  }, []);

  useImperativeHandle(ref, () => ({
    play: handlePlay,
    pause: handlePause,
    seek: (t: number) => {
      if (videoRef.current && videoRef.current.readyState >= 2) {
        videoRef.current.currentTime = Math.max(0, t);
      }
    },
    isPlaying: () => !!videoRef.current && !videoRef.current.paused && !videoRef.current.ended,
    currentTime: () => videoRef.current?.currentTime || 0,
  }), []);

  return (
    <div className={`${large ? "w-full h-full flex flex-col" : "max-w-2xl w-full"}`}>
      <div 
        className={`${large ? "flex flex-col h-full" : "relative overflow-hidden rounded-2xl"}`}
        style={large ? {} : {
          background: 'linear-gradient(135deg, rgba(39, 39, 42, 0.6) 0%, rgba(63, 63, 70, 0.55) 25%, rgba(39, 39, 42, 0.5) 50%, rgba(24, 24, 27, 0.45) 75%, rgba(9, 9, 11, 0.4) 100%)',
          backdropFilter: 'blur(25px) saturate(1.8)',
          border: '1px solid rgba(255, 255, 255, 0.15)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3), 0 4px 16px rgba(0, 0, 0, 0.2), 0 2px 8px rgba(0, 0, 0, 0.15), inset 0 2px 4px rgba(255, 255, 255, 0.1), inset 0 -2px 4px rgba(0, 0, 0, 0.15)'
        }}>
        {!large && (
          <>
            {/* Glassmorphic overlay for depth */}
            <div className="absolute inset-0 bg-gradient-to-br from-white/3 to-transparent opacity-100 pointer-events-none rounded-2xl"></div>
            
            <div 
              className="px-3 sm:px-4 py-2 sm:py-3 border-b border-white/10 flex-shrink-0 relative z-10"
              style={{
                background: 'linear-gradient(135deg, rgba(39, 39, 42, 0.7) 0%, rgba(63, 63, 70, 0.65) 25%, rgba(39, 39, 42, 0.6) 50%, rgba(24, 24, 27, 0.55) 75%, rgba(9, 9, 11, 0.5) 100%)',
                backdropFilter: 'blur(25px) saturate(1.8)'
              }}>
              <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent rounded-t-2xl pointer-events-none"></div>
              <div className="flex items-center justify-between relative z-10">
                <h3 className="text-sm font-medium text-white/90">Player</h3>
                <div className="text-white/50">
                  <Play className="w-4 h-4" fill="currentColor" />
                </div>
              </div>
            </div>
          </>
        )}
        
        <div 
          className={`${large ? "p-0 flex-1 flex flex-col" : "p-2 sm:p-3 lg:p-4 relative z-10"}`}
          style={large ? {} : { background: 'rgba(39, 39, 42, 0.25)' }}>
          {src ? (
            <>
              <video
                key={`${src}|${cuts.length}|${JSON.stringify(cuts)}`}
                ref={videoRef}
                src={src}
                playsInline
                preload="metadata"
                disablePictureInPicture
                className={`w-full object-contain bg-black rounded video-no-overlay`}
                style={{
                  aspectRatio: "16 / 9",
                  maxWidth: large ? "100%" : "320px",
                  maxHeight: large ? "100%" : "180px",
                  border: "1px solid rgba(255, 255, 255, 0.10)"
                }}
                onLoadStart={() => {
                  console.log(`Video load started: ${src}`);
                }}
                onLoadedData={() => {
                  console.log(`Video data loaded: ${src}`);
                }}
                onError={(e) => {
                  const error = e.currentTarget.error;
                  console.error(`Video error: ${src}`, e);
                  console.error(`Video error details:`, error);
                  if (error) {
                    console.error(`Video Error: ${error.message || 'Unknown error'} (Code: ${error.code})`);
                    console.error(`Error details: ${JSON.stringify({
                      code: error.code,
                      message: error.message,
                      networkState: e.currentTarget.networkState,
                      readyState: e.currentTarget.readyState
                    })}`);
                  }
                }}
                onCanPlay={() => {
                  console.log(`Video can play: ${src}`);
                }}
              >
                <p>Your browser does not support the video tag.</p>
              </video>
              
              {/* Custom Video Controls with enhanced glassmorphic styling */}
              <div className={`${large ? "m-2 flex-shrink-0" : "mt-3"} flex items-center justify-center gap-3`}>
                <button
                  onClick={handleSeekBack}
                  className="group w-8 h-8 flex items-center justify-center text-editor-text-tertiary hover:text-editor-text-primary bg-editor-bg-glass-tertiary backdrop-blur-xl border border-editor-border-tertiary hover:bg-editor-interactive-hover hover:border-editor-border-secondary transition-all duration-300 rounded-lg focus:outline-none shadow-[0_2px_8px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.1)] relative overflow-hidden"
                  title="Seek Backward 1s"
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-lg"></div>
                  <SkipBack className="w-4 h-4 flex-shrink-0 relative z-10" />
                </button>
                <button
                  onClick={handleTogglePlay}
                  className="group w-8 h-8 flex items-center justify-center text-editor-text-tertiary hover:text-editor-text-primary bg-editor-bg-glass-tertiary backdrop-blur-xl border border-editor-border-tertiary hover:bg-editor-interactive-hover hover:border-editor-border-secondary transition-all duration-300 rounded-lg focus:outline-none shadow-[0_2px_8px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.1)] relative overflow-hidden"
                  title={isPlaying ? "Pause" : "Play"}
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-lg"></div>
                  {isPlaying ? (
                    <Pause className="w-4 h-4 flex-shrink-0 relative z-10" />
                  ) : (
                    <Play className="w-4 h-4 flex-shrink-0 relative z-10" />
                  )}
                </button>
                <button
                  onClick={handleSeekForward}
                  className="group w-8 h-8 flex items-center justify-center text-editor-text-tertiary hover:text-editor-text-primary bg-editor-bg-glass-tertiary backdrop-blur-xl border border-editor-border-tertiary hover:bg-editor-interactive-hover hover:border-editor-border-secondary transition-all duration-300 rounded-lg focus:outline-none shadow-[0_2px_8px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.1)] relative overflow-hidden"
                  title="Seek Forward 1s"
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-lg"></div>
                  <SkipForward className="w-4 h-4 flex-shrink-0 relative z-10" />
                </button>
              </div>
            </>
          ) : (
            <>
              {/* Black Screen Placeholder */}
              <div 
                className="w-full object-contain bg-black rounded"
                style={{
                  aspectRatio: "16 / 9",
                  maxWidth: large ? "100%" : "320px",
                  maxHeight: large ? "100%" : "180px",
                  border: "1px solid rgba(255, 255, 255, 0.10)"
                }}
              />
              
              {/* Disabled Video Controls */}
              <div className={`${large ? "m-2 flex-shrink-0" : "mt-3"} flex items-center justify-center gap-3`}>
                <button
                  disabled
                  className="group w-8 h-8 flex items-center justify-center text-editor-text-tertiary bg-editor-bg-glass-tertiary backdrop-blur-xl border border-editor-border-tertiary transition-all duration-300 rounded-lg focus:outline-none shadow-[0_2px_8px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.1)] relative overflow-hidden disabled:opacity-50 disabled:cursor-not-allowed"
                  title="No video loaded"
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-lg"></div>
                  <SkipBack className="w-4 h-4 flex-shrink-0 relative z-10" />
                </button>
                <button
                  disabled
                  className="group w-8 h-8 flex items-center justify-center text-editor-text-tertiary bg-editor-bg-glass-tertiary backdrop-blur-xl border border-editor-border-tertiary transition-all duration-300 rounded-lg focus:outline-none shadow-[0_2px_8px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.1)] relative overflow-hidden disabled:opacity-50 disabled:cursor-not-allowed"
                  title="No video loaded"
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-lg"></div>
                  <Play className="w-4 h-4 flex-shrink-0 relative z-10" />
                </button>
                <button
                  disabled
                  className="group w-8 h-8 flex items-center justify-center text-editor-text-tertiary bg-editor-bg-glass-tertiary backdrop-blur-xl border border-editor-border-tertiary transition-all duration-300 rounded-lg focus:outline-none shadow-[0_2px_8px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.1)] relative overflow-hidden disabled:opacity-50 disabled:cursor-not-allowed"
                  title="No video loaded"
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-lg"></div>
                  <SkipForward className="w-4 h-4 flex-shrink-0 relative z-10" />
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
});

function useSkipPlayback(videoRef: React.RefObject<HTMLVideoElement | null>, cuts: Range[]) {
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    const sorted = [...cuts].sort((a, b) => a.start - b.start);

    const onTime = () => {
      const t = el.currentTime;
      const hit = sorted.find(r => t >= r.start && t < r.end);
      if (hit) el.currentTime = hit.end + 0.0001;
    };
    el.addEventListener("timeupdate", onTime);
    return () => el.removeEventListener("timeupdate", onTime);
  }, [videoRef, cuts]);
}