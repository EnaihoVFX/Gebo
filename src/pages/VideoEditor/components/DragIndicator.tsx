import { Video, Music } from "lucide-react";

type DragIndicatorProps = {
  visible: boolean;
  x: number;
  y: number;
  mediaType?: "video" | "audio";
};

export function DragIndicator({ visible, x, y, mediaType = "video" }: DragIndicatorProps) {
  console.log("DragIndicator render:", { visible, x, y, mediaType });
  
  if (!visible) return null;

  const Icon = mediaType === "audio" ? Music : Video;

  return (
    <div
      className="fixed z-[9999] pointer-events-none"
      style={{ left: x, top: y, transform: "translate(-50%, -50%)" }}
    >
      <div className="w-16 h-16 rounded-xl bg-slate-700/60 border border-slate-500/50 shadow-2xl backdrop-blur-sm flex items-center justify-center">
        <Icon className="w-8 h-8 text-white/90" />
      </div>
    </div>
  );
}