import { useState } from "react";
import type { Range } from "../types";

export function useCommandLogic(probe: any, log: (m: string) => void) {
  const [showCommandDialog, setShowCommandDialog] = useState(false);
  const [commandInput, setCommandInput] = useState("");

  const openCommand = () => {
    setShowCommandDialog(true);
    setCommandInput("");
  };

  const executeCommand = (
    commandInput: string,
    setCommandInput: (value: string) => void,
    setShowCommandDialog: (show: boolean) => void,
    setPreviewCuts: (cuts: Range[]) => void,
    tightenSilences: (min: number, leave?: number) => Range[],
    detectSilences: (min: number) => Range[]
  ) => {
    const q = commandInput.trim().toLowerCase();
    setShowCommandDialog(false);
    if (!q || !probe) return;

    // tighten silence > 2 leave 150ms
    const t = q.match(/tighten\s+silence(?:s)?\s*[>=>]\s*(\d+(?:\.\d+)?)\s*(?:leave\s*(\d+)\s*ms)?/i);
    if (t) {
      const min = parseFloat(t[1]);
      const leave = t[2] ? parseInt(t[2], 10) : 150;
      const ranges = tightenSilences(min, leave);
      setPreviewCuts(ranges);
      log(`Preview: tighten silence > ${min}s leave ${leave}ms → ${ranges.length} cuts`);
      return;
    }

    // remove/cut silences > 2
    const m = q.match(/(?:remove|cut)\s+silence(?:s)?\s*[>=>]\s*(\d+(?:\.\d+)?)/i);
    if (m) {
      const min = parseFloat(m[1]);
      const ranges = detectSilences(min);
      setPreviewCuts(ranges);
      log(`Preview: remove silence > ${min}s → ${ranges.length} cuts`);
      return;
    }

    // manual: cut 12.5 - 14.0
    const r = q.match(/cut\s*(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)/i);
    if (r) {
      const s = parseFloat(r[1]); const e = parseFloat(r[2]);
      const range = { start: Math.min(s, e), end: Math.max(s, e) };
      setPreviewCuts([range]);
      log(`Preview: manual cut ${range.start.toFixed(2)}-${range.end.toFixed(2)}s`);
      return;
    }

    alert('Try: "tighten silence > 2 leave 150ms", "remove silence > 2", or "cut 12.5 - 14.0"');
  };

  return {
    showCommandDialog,
    commandInput,
    setCommandInput,
    setShowCommandDialog,
    openCommand,
    executeCommand,
  };
}
