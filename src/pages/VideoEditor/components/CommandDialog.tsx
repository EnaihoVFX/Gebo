import { useState } from "react";

interface CommandDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onExecute: (command: string) => void;
}

function CommandDialog({ isOpen, onClose, onExecute }: CommandDialogProps) {
  const [commandInput, setCommandInput] = useState("");

  const handleExecute = () => {
    onExecute(commandInput);
    setCommandInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleExecute();
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
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
          onKeyDown={handleKeyDown}
          className="w-full px-3 py-2 bg-zinc-800 border border-zinc-600 rounded text-zinc-100 focus:outline-none focus:border-cyan-500"
          placeholder="tighten silence > 2 leave 150ms"
          autoFocus
        />
        <div className="flex gap-2 mt-4">
          <button onClick={handleExecute} className="px-4 py-2 bg-cyan-600 text-white rounded hover:bg-cyan-700">Execute</button>
          <button onClick={onClose} className="px-4 py-2 bg-zinc-700 text-zinc-200 rounded hover:bg-zinc-600">Cancel</button>
        </div>
      </div>
    </div>
  );
}

export default CommandDialog;