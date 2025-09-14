import { useEffect, useRef, forwardRef, useImperativeHandle } from "react";
import type { Range } from "../utils/videoUtils";

export type PlayerHandle = {
  play: () => void;
  pause: () => void;
  seek: (t: number) => void;
  isPlaying: () => boolean;
  currentTime: () => number;
};

interface PlayerProps {
  src: string;
  label: string;
  cuts: Range[];
  large?: boolean;
}

const Player = forwardRef<PlayerHandle, PlayerProps>(function Player(
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
    <div className={`rounded border border-zinc-800 ${large ? "p-3" : "p-2"}`}>
      <div className="text-xs mb-2 text-zinc-400">{label}</div>
      <video
        key={`${src}|${cuts.length}|${JSON.stringify(cuts)}`}
        ref={videoRef}
        src={src}
        controls
        playsInline
        className={`rounded w-full ${large ? "max-h-[60vh]" : "max-h-[36vh]"} object-contain bg-black`}
        onLoadStart={() => {
          console.log(`Video load started: ${src}`);
        }}
        onLoadedData={() => {
          console.log(`Video data loaded: ${src}`);
        }}
        onError={(e) => {
          console.error(`Video error: ${src}`, e);
          console.error(`Video error details: ${e.currentTarget.error?.message || 'Unknown error'}`);
        }}
        onCanPlay={() => {
          console.log(`Video can play: ${src}`);
        }}
      />
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

export default Player;