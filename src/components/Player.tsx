import { forwardRef, useImperativeHandle, useRef, useEffect } from "react";
import type { PlayerHandle, PlayerProps, Range } from "../types";

export const Player = forwardRef<PlayerHandle, PlayerProps>(function Player(
  { src, label, cuts, large = false },
  ref
) {
  const videoRef = useRef<HTMLVideoElement>(null);
  useSkipPlayback(videoRef, cuts);

  // Reset video when source changes
  useEffect(() => {
    if (videoRef.current && src) {
      console.log(`Loading video: ${src}`);
      videoRef.current.load();
    }
  }, [src]);

  useImperativeHandle(ref, () => ({
    play: () => {
      if (videoRef.current && videoRef.current.readyState >= 2) {
        videoRef.current.play().catch(console.error);
      }
    },
    pause: () => videoRef.current?.pause(),
    seek: (t: number) => {
      if (videoRef.current && videoRef.current.readyState >= 2) {
        videoRef.current.currentTime = Math.max(0, t);
      }
    },
    isPlaying: () => !!videoRef.current && !videoRef.current.paused && !videoRef.current.ended,
    currentTime: () => videoRef.current?.currentTime || 0,
  }), []);

  return (
    <div className={`rounded border border-zinc-800 ${large ? "p-3" : "p-2"} ${large ? "max-w-[900px]" : "max-w-[450px]"}`}>
      <div className="text-xs mb-2 text-zinc-400">{label}</div>
      <div className="text-xs mb-1 text-zinc-500 truncate">Source: {src}</div>
      <video
        key={`${src}|${cuts.length}|${JSON.stringify(cuts)}`}
        ref={videoRef}
        src={src}
        controls
        playsInline
        preload="metadata"
        disablePictureInPicture
        className={`rounded w-full ${large ? "max-h-[25vh] max-w-[800px]" : "max-h-[15vh] max-w-[400px]"} object-contain bg-black video-no-overlay`}
        style={{
          minHeight: large ? "120px" : "80px",
          maxHeight: large ? "300px" : "180px",
          maxWidth: large ? "800px" : "400px",
          border: "1px solid #444"
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
