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
      <div className={`${large ? "flex flex-col h-full" : "bg-slate-800 rounded-lg border border-slate-700 overflow-hidden"}`}>
        {!large && (
          <div className="px-3 sm:px-4 py-2 sm:py-3 border-b border-slate-700 bg-slate-800 flex-shrink-0">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-white">Player</h3>
              <div className="text-slate-400">
                <Play className="w-4 h-4" fill="currentColor" />
              </div>
            </div>
          </div>
        )}
        
        <div className={`${large ? "p-0 flex-1 flex flex-col" : "p-2 sm:p-3 lg:p-4 bg-slate-900"}`}>
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
                  border: "1px solid #334155"
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
              
              {/* Custom Video Controls */}
              <div className={`${large ? "m-2 flex-shrink-0" : "mt-3"} flex items-center justify-center gap-2`}>
                <button
                  onClick={handleSeekBack}
                  className="p-2 text-slate-300 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
                  title="Seek Backward 1s"
                >
                  <SkipBack className="w-4 h-4" />
                </button>
                <button
                  onClick={handleTogglePlay}
                  className="p-2 text-slate-300 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
                  title={isPlaying ? "Pause" : "Play"}
                >
                  {isPlaying ? (
                    <Pause className="w-4 h-4" />
                  ) : (
                    <Play className="w-4 h-4" />
                  )}
                </button>
                <button
                  onClick={handleSeekForward}
                  className="p-2 text-slate-300 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
                  title="Seek Forward 1s"
                >
                  <SkipForward className="w-4 h-4" />
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
                  border: "1px solid #334155"
                }}
              />
              
              {/* Disabled Video Controls */}
              <div className={`${large ? "m-2 flex-shrink-0" : "mt-3"} flex items-center justify-center gap-2`}>
                <button
                  disabled
                  className="p-2 text-slate-600 rounded-lg transition-colors cursor-not-allowed"
                  title="No video loaded"
                >
                  <SkipBack className="w-4 h-4" />
                </button>
                <button
                  disabled
                  className="p-2 text-slate-600 rounded-lg transition-colors cursor-not-allowed"
                  title="No video loaded"
                >
                  <Play className="w-4 h-4" />
                </button>
                <button
                  disabled
                  className="p-2 text-slate-600 rounded-lg transition-colors cursor-not-allowed"
                  title="No video loaded"
                >
                  <SkipForward className="w-4 h-4" />
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