import { useEffect, useMemo, useRef, useState, forwardRef, useImperativeHandle } from "react";
import { open, save } from "@tauri-apps/plugin-dialog";
import { convertFileSrc } from "@tauri-apps/api/core";
import { audioPeaks, exportCutlist, makePreviewProxy, probeVideo, type Probe } from "./lib/ffmpeg";

type Range = { start:number; end:number };

export default function App() {
  // File + media
  const [filePath, setFilePath] = useState<string>("");
  const [previewUrl, setPreviewUrl] = useState<string>(""); // actual video src used by <video>
  const [probe, setProbe] = useState<Probe | null>(null);
  const [peaks, setPeaks] = useState<number[]>([]);

  // Edits
  const [previewCuts, setPreviewCuts] = useState<Range[]>([]);
  const [acceptedCuts, setAcceptedCuts] = useState<Range[]>([]);

  // Command dialog
  const [showCommandDialog, setShowCommandDialog] = useState(false);
  const [commandInput, setCommandInput] = useState("");

  // Players control
  const editedRef = useRef<PlayerHandle>(null);
  const proposedRef = useRef<PlayerHandle>(null);

  // Debug
  const [debug, setDebug] = useState<string>("");
  const log = (m: string) => setDebug(d => (d ? d + "\n" : "") + m);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        openCommand();
      } else if (e.key === " ") {
        // space toggles play/pause on both when focused anywhere
        e.preventDefault();
        togglePlay();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const openCommand = () => {
    setShowCommandDialog(true);
    setCommandInput("");
  };

  // ---------- File picking & proxy ----------
  const pickFile = async () => {
    try {
      const sel = await open({ multiple: false, filters: [{ name:"Video", extensions:["mp4","mov","mkv"] }]});
      if (typeof sel !== "string") return;

      setDebug("");
      setFilePath(sel);
      setAcceptedCuts([]);
      setPreviewCuts([]);

      log(`Selected file: ${sel}`);

      // Start with original file path
      const originalUrl = convertFileSrc(sel);
      setPreviewUrl(originalUrl);
      log(`Original URL: ${originalUrl}`);
      log(`File exists check: ${sel}`);

      // Probe + peaks
      try {
        log(`Starting probe for: ${sel}`);
        const p = await probeVideo(sel);
        setProbe(p);
        log(`Probed: dur=${p.duration.toFixed(2)}s fps=${p.fps.toFixed(2)} rate=${p.audio_rate} codec=${p.v_codec}/${p.a_codec}`);
      } catch (e: unknown) {
        log(`Probe failed: ${e instanceof Error ? e.message : String(e)}`);
        log(`Error details: ${JSON.stringify(e)}`);
        return;
      }

      try {
        log(`Starting audio peaks for: ${sel}`);
        const pk = await audioPeaks(sel);
        setPeaks(pk.map(v => Math.max(0, Math.min(32767, v))));
        log(`Peaks: ${pk.length}`);
      } catch (e: unknown) {
        log(`Audio peaks failed: ${e instanceof Error ? e.message : String(e)}`);
        log(`Peaks error details: ${JSON.stringify(e)}`);
        setPeaks([]);
      }

      // Proactively proxy for MOV/MKV for reliable playback
      if (/\.(mkv|mov)$/i.test(sel)) {
        try {
          log(`Creating preview proxy for: ${sel}`);
          const prox = await makePreviewProxy(sel);
          const proxyUrl = convertFileSrc(prox);
          setPreviewUrl(proxyUrl);
          log(`Using preview proxy (H.264/AAC) for playback: ${proxyUrl}`);
        } catch (e: unknown) {
          log("Proxy failed, continuing with original. " + (e instanceof Error ? e.message : String(e)));
          log(`Proxy error details: ${JSON.stringify(e)}`);
        }
      }

      // Seek both players to 0 after a short delay to ensure video is loaded
      setTimeout(() => {
        editedRef.current?.seek(0);
        proposedRef.current?.seek(0);
      }, 100);
    } catch (e: unknown) {
      log(`File picker failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  // ---------- Waveform helpers ----------
  const mergeRanges = (rs: Range[], eps = 0.01) => {
    if (!rs.length) return rs;
    const s = [...rs].sort((a,b)=>a.start-b.start);
    const out: Range[] = [{...s[0]}];
    for (let i=1;i<s.length;i++){
      const prev = out[out.length-1];
      const cur = s[i];
      if (cur.start <= prev.end + eps) prev.end = Math.max(prev.end, cur.end);
      else out.push({...cur});
    }
    return out;
  };

  const detectSilences = (minSeconds:number): Range[] => {
    if (!probe || peaks.length === 0) return [];
    const duration = probe.duration;
    const binSec = duration / peaks.length;
    const threshold = 0.15 * Math.max(...peaks, 1); // 15% of max amp
    const out: Range[] = [];
    let start = -1;
    for (let i=0;i<peaks.length;i++){
      const silent = peaks[i] < threshold;
      if (silent && start < 0) start = i;
      if ((!silent || i === peaks.length-1) && start >= 0) {
        const endIdx = silent ? i : i-1;
        const s = start * binSec;
        const e = (endIdx+1) * binSec;
        if (e - s >= minSeconds) out.push({ start: s, end: e });
        start = -1;
      }
    }
    return mergeRanges(out);
  };

  const tightenSilences = (minSeconds:number, leaveMs=150): Range[] => {
    const spans = detectSilences(minSeconds);
    const pad = leaveMs / 1000;
    const cuts = spans.map(r => ({
      start: Math.min(r.end - pad, r.start + pad),
      end: Math.max(r.start + pad, r.end - pad),
    })).filter(c => c.end - c.start > 0.001);
    return mergeRanges(cuts);
  };

  // ---------- Commands ----------
  const executeCommand = () => {
    const q = commandInput.trim().toLowerCase();
    setShowCommandDialog(false);
    if (!q || !probe) return;

    // tighten silence > 2 leave 150ms
    const t = q.match(/tighten\\s+silence(?:s)?\\s*[>=>]\\s*(\\d+(?:\\.\\d+)?)\\s*(?:leave\\s*(\\d+)\\s*ms)?/i);
    if (t) {
      const min = parseFloat(t[1]);
      const leave = t[2] ? parseInt(t[2],10) : 150;
      const ranges = tightenSilences(min, leave);
      setPreviewCuts(ranges);
      log(`Preview: tighten silence > ${min}s leave ${leave}ms → ${ranges.length} cuts`);
      return;
    }

    // remove/cut silences > 2
    const m = q.match(/(?:remove|cut)\\s+silence(?:s)?\\s*[>=>]\\s*(\\d+(?:\\.\\d+)?)/i);
    if (m) {
      const min = parseFloat(m[1]);
      const ranges = detectSilences(min);
      setPreviewCuts(ranges);
      log(`Preview: remove silence > ${min}s → ${ranges.length} cuts`);
      return;
    }

    // manual: cut 12.5 - 14.0
    const r = q.match(/cut\\s*(\\d+(?:\\.\\d+)?)\\s*-\\s*(\\d+(?:\\.\\d+)?)/i);
    if (r) {
      const s = parseFloat(r[1]); const e = parseFloat(r[2]);
      const range = { start: Math.min(s,e), end: Math.max(s,e) };
      setPreviewCuts([range]);
      log(`Preview: manual cut ${range.start.toFixed(2)}-${range.end.toFixed(2)}s`);
      return;
    }

    alert('Try: "tighten silence > 2 leave 150ms", "remove silence > 2", or "cut 12.5 - 14.0"');
  };

  const acceptPlan = () => {
    setAcceptedCuts(mergeRanges([...acceptedCuts, ...previewCuts]));
    setPreviewCuts([]);
    log(`Accepted. Total accepted cuts: ${acceptedCuts.length + previewCuts.length}`);
  };
  const rejectPlan = () => { setPreviewCuts([]); };

  // ---------- Export ----------
  const onExport = async () => {
    if (!filePath || !probe) return;
    if (!acceptedCuts.length) { alert("No accepted cuts yet."); return; }
    const savePath = await save({ defaultPath: "edited.mp4", filters:[{name:"MP4", extensions:["mp4"]}]});
    if (!savePath) return;
    await exportCutlist(filePath, savePath as string, acceptedCuts);
    alert("Export complete: " + savePath);
    log("Exported to " + savePath);
  };

  // ---------- Playback controls ----------
  const playBoth = () => { editedRef.current?.play(); proposedRef.current?.play(); };
  const pauseBoth = () => { editedRef.current?.pause(); proposedRef.current?.pause(); };
  const togglePlay = () => {
    if (editedRef.current?.isPlaying() || proposedRef.current?.isPlaying()) pauseBoth();
    else playBoth();
  };
  const seekBoth = (t: number) => { editedRef.current?.seek(t); proposedRef.current?.seek(t); };

  const duration = probe?.duration || 0;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-4 space-y-3">
      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        <button onClick={pickFile} className="px-3 py-2 rounded bg-cyan-600 text-white">Open video</button>
        <button onClick={openCommand} disabled={!probe} className="px-3 py-2 rounded bg-zinc-800 text-zinc-200 disabled:opacity-50">⌘K Command</button>
        <button onClick={acceptPlan} disabled={!previewCuts.length} className="px-3 py-2 rounded bg-green-600 text-white disabled:opacity-50">Accept</button>
        <button onClick={rejectPlan} disabled={!previewCuts.length} className="px-3 py-2 rounded bg-zinc-800 text-zinc-200 disabled:opacity-50">Reject</button>
        <button onClick={onExport} disabled={!acceptedCuts.length} className="px-3 py-2 rounded bg-indigo-600 text-white disabled:opacity-50">Export MP4</button>

        {/* Shared transport */}
        <div className="ml-auto flex items-center gap-2">
          <button onClick={togglePlay} className="px-3 py-2 rounded bg-zinc-800 text-zinc-200">Play/Pause</button>
          <button onClick={()=>seekBoth(Math.max(0, (editedRef.current?.currentTime() || 0) - 1))} className="px-2 py-2 rounded bg-zinc-800 text-zinc-200">-1s</button>
          <button onClick={()=>seekBoth((editedRef.current?.currentTime() || 0) + 1)} className="px-2 py-2 rounded bg-zinc-800 text-zinc-200">+1s</button>
        </div>
      </div>

      {previewUrl ? (
        <>
          {/* Center + Side layout */}
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-4">
            {/* Center: Edited (accepted only) */}
            <Player
              ref={editedRef}
              src={previewUrl}
              label="Edited (Accepted timeline)"
              cuts={acceptedCuts}
              large
            />
            {/* Right: Proposed (accepted + preview) */}
            <Player
              ref={proposedRef}
              src={previewUrl}
              label="Proposed (Accepted + Preview)"
              cuts={[...acceptedCuts, ...previewCuts]}
            />
          </div>

          {/* Timeline with dual overlays + click-to-seek */}
          <div className="rounded border border-zinc-800 p-2">
            <div className="text-xs mb-2 text-zinc-400">Timeline</div>
            <WaveformCanvas
              peaks={peaks}
              duration={duration}
              accepted={acceptedCuts}
              preview={previewCuts}
              onSeek={seekBoth}
            />
            <div className="text-xs text-zinc-400 mt-2">
              Accepted: {acceptedCuts.length} • Preview: {previewCuts.length}
            </div>
          </div>
        </>
      ) : (
        <div className="text-center py-12 text-zinc-400">
          <p>No video loaded. Click "Open video" to select a video file.</p>
        </div>
      )}

      {/* Command dialog */}
      {showCommandDialog && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-zinc-900 border border-zinc-700 rounded-lg p-6 w-[480px]">
            <h3 className="text-lg font-semibold text-zinc-100 mb-3">Enter Command</h3>
            <p className="text-sm text-zinc-400 mb-3">
              Examples: <code>remove silence &gt; 2</code>, <code>tighten silence &gt; 2 leave 150ms</code>, <code>cut 12.5 - 14.0</code>
            </p>
            <input
              type="text"
              value={commandInput}
              onChange={(e) => setCommandInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') executeCommand();
                if (e.key === 'Escape') setShowCommandDialog(false);
              }}
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-600 rounded text-zinc-100 focus:outline-none focus:border-cyan-500"
              placeholder="tighten silence > 2 leave 150ms"
              autoFocus
            />
            <div className="flex gap-2 mt-4">
              <button onClick={executeCommand} className="px-4 py-2 bg-cyan-600 text-white rounded hover:bg-cyan-700">Execute</button>
              <button onClick={() => setShowCommandDialog(false)} className="px-4 py-2 bg-zinc-700 text-zinc-200 rounded hover:bg-zinc-600">Cancel</button>
            </div>
          </div>
        </div>
      )}

      <pre className="mt-2 text-xs text-zinc-400 bg-zinc-900 border border-zinc-800 p-3 rounded whitespace-pre-wrap">
{debug || "Logs will appear here…"}
      </pre>
    </div>
  );
}

/* ---------------- Players (with cut-skipping) ---------------- */

type PlayerHandle = {
  play: () => void;
  pause: () => void;
  seek: (t:number) => void;
  isPlaying: () => boolean;
  currentTime: () => number;
};

const Player = forwardRef(function Player(
  {
    src, label, cuts, large = false,
  }: { src: string; label: string; cuts: Range[]; large?: boolean },
  ref: React.Ref<PlayerHandle>
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
    seek: (t:number) => { 
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
    const sorted = [...cuts].sort((a,b)=>a.start-b.start);

    const onTime = () => {
      const t = el.currentTime;
      const hit = sorted.find(r => t >= r.start && t < r.end);
      if (hit) el.currentTime = hit.end + 0.0001;
    };
    el.addEventListener("timeupdate", onTime);
    return () => el.removeEventListener("timeupdate", onTime);
  }, [videoRef, cuts]);
}

/* ---------------- Waveform Canvas ---------------- */

function WaveformCanvas({
  peaks, duration, accepted, preview, width = 1100, height = 160, onSeek,
}: {
  peaks:number[];
  duration:number;
  accepted: Range[];
  preview: Range[];
  width?: number;
  height?: number;
  onSeek?: (t:number) => void;
}) {
  const ref = useRef<HTMLCanvasElement>(null);

  const samples = useMemo(()=>{
    if (!peaks?.length) return [];
    const out:number[] = new Array(width).fill(0);
    const step = peaks.length / width;
    let max = 1;
    for (let x=0;x<width;x++){
      const start = Math.floor(x*step);
      const end = Math.min(peaks.length, Math.floor((x+1)*step)+1);
      let m = 0;
      for (let i=start;i<end;i++) if (peaks[i] > m) m = peaks[i];
      out[x] = m; if (m > max) max = m;
    }
    return out.map(v => v / max);
  }, [peaks, width]);

  useEffect(()=>{
    const c = ref.current; if (!c) return;
    const dpr = window.devicePixelRatio || 1;
    c.width = width * dpr; c.height = height * dpr;
    c.style.width = width + "px"; c.style.height = height + "px";
    const g = c.getContext("2d")!;
    g.setTransform(dpr,0,0,dpr,0,0);

    // bg
    g.fillStyle = "#0a0a0a"; g.fillRect(0,0,width,height);

    // waveform
    const mid = height/2; g.fillStyle = "#71717a";
    for (let x=0;x<samples.length;x++){
      const h = samples[x] * (height*0.9) * 0.5;
      g.fillRect(x, mid-h, 1, h*2);
    }

    // overlays: preview (amber), accepted (red)
    const drawRanges = (ranges:Range[], color:string) => {
      if (!duration || !ranges.length) return;
      g.fillStyle = color;
      for (const r of ranges) {
        const x1 = Math.max(0, Math.min(width, (r.start/duration)*width));
        const x2 = Math.max(0, Math.min(width, (r.end/duration)*width));
        g.fillRect(x1, 0, Math.max(1, x2-x1), height);
      }
    };
    drawRanges(preview, "rgba(245, 158, 11, 0.35)"); // amber-500
    drawRanges(accepted, "rgba(239, 68, 68, 0.35)");  // red-600

    // border
    g.strokeStyle = "#27272a"; g.strokeRect(0,0,width,height);
  }, [samples, accepted, preview, duration, width, height]);

  const onClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const t = (x / rect.width) * duration;
    onSeek?.(t);
  };

  return (
    <div className="rounded bg-zinc-950 border border-zinc-800 p-2 overflow-x-auto">
      <canvas ref={ref} onClick={onClick} />
      <div className="mt-2 text-[11px] text-zinc-400 flex gap-3">
        <span className="inline-flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded-sm" style={{background:"rgba(239,68,68,0.8)"}}></span> Accepted
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded-sm" style={{background:"rgba(245,158,11,0.8)"}}></span> Preview
        </span>
        <span className="ml-auto">Tip: click the waveform to seek both players</span>
      </div>
    </div>
  );
}
