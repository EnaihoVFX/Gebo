import { useState, useRef, useEffect } from "react";
import { Player } from "./Player";
import type { ChatMessage as ChatMessageType } from "../../../types";

interface ChatMessageProps {
  message: ChatMessageType;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const [isVideoExpanded, setIsVideoExpanded] = useState(false);
  const [hasAutoPlayed, setHasAutoPlayed] = useState(false);
  const playerRef = useRef<any>(null);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Auto-play video when it first appears
  useEffect(() => {
    if (message.hasVideoPreview && message.videoPreview && !hasAutoPlayed && playerRef.current) {
      const timer = setTimeout(() => {
        playerRef.current?.play();
        setHasAutoPlayed(true);
      }, 500); // Small delay to ensure video is loaded
      
      return () => clearTimeout(timer);
    }
  }, [message.hasVideoPreview, message.videoPreview, hasAutoPlayed]);

  const renderContent = (content: string) => {
    // Simple markdown-like rendering for code blocks and inline code
    const parts = content.split(/(`[^`]+`)/g);
    return parts.map((part, index) => {
      if (part.startsWith('`') && part.endsWith('`')) {
        return (
          <code key={index} className="bg-zinc-800 px-1 py-0.5 rounded text-xs font-mono text-cyan-300">
            {part.slice(1, -1)}
          </code>
        );
      }
      return part;
    });
  };

  const renderActions = () => {
    if (!message.actions || message.actions.length === 0) return null;

    return (
      <div className="flex gap-2 mt-4">
        {message.actions.map((action, index) => (
          <button
            key={index}
            onClick={action.onClick}
            className={`px-4 py-2 text-sm rounded-md transition-colors border ${
              action.type === "accept"
                ? "bg-green-600/10 border-green-600/20 text-green-400 hover:bg-green-600/20 hover:border-green-600/30"
                : action.type === "reject"
                ? "bg-red-600/10 border-red-600/20 text-red-400 hover:bg-red-600/20 hover:border-red-600/30"
                : "bg-zinc-800/50 border-zinc-700 text-zinc-300 hover:bg-zinc-700/50 hover:border-zinc-600"
            }`}
          >
            {action.label}
          </button>
        ))}
      </div>
    );
  };

  const renderVideoPreview = () => {
    if (!message.hasVideoPreview || !message.videoPreview) return null;

    return (
      <div className="mt-4 space-y-3">
        {/* Video Preview - Embedded directly in message */}
        <div className="border-2 border-blue-500/30 rounded-lg overflow-hidden bg-zinc-900/40 shadow-lg">
          <div className="p-3 bg-gradient-to-r from-blue-900/20 to-zinc-800/50 border-b border-zinc-800">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-sm text-zinc-200 font-medium">
                Preview: {message.videoPreview.label}
              </span>
              <span className="text-xs text-zinc-500">
                ({message.videoPreview.cuts.length} changes)
              </span>
              <div className="ml-auto flex items-center gap-1 text-xs text-zinc-400">
                <div className="w-1 h-1 bg-blue-500 rounded-full animate-pulse"></div>
                <span>Auto-playing</span>
              </div>
            </div>
          </div>
          
          <div className="p-3">
            <Player
              ref={playerRef}
              src={message.videoPreview.src}
              label=""
              cuts={message.videoPreview.cuts}
              large={false}
            />
          </div>
        </div>
        
        {/* Changes Summary */}
        {message.videoPreview.cuts && message.videoPreview.cuts.length > 0 && (
          <div className="bg-zinc-900/20 border border-zinc-800 rounded-lg p-3">
            <div className="text-sm text-zinc-300 mb-2 font-medium">
              Changes Preview:
            </div>
            <div className="space-y-1">
              {message.videoPreview.cuts.slice(0, 3).map((cut, index) => (
                <div key={index} className="text-sm text-zinc-400 flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-red-500 rounded-full flex-shrink-0"></div>
                  <span>Remove {cut.start.toFixed(2)}s - {cut.end.toFixed(2)}s</span>
                </div>
              ))}
              {message.videoPreview.cuts.length > 3 && (
                <div className="text-sm text-zinc-500 italic">
                  ... and {message.videoPreview.cuts.length - 3} more segments
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  if (message.type === "assistant") {
    return (
      <div className="space-y-4">
        {/* AI Response - Plain text like Cursor */}
        <div className="text-sm text-zinc-200 leading-relaxed">
          {renderContent(message.content)}
        </div>
        
        {/* Agent Actions - Show what the agent is doing */}
        {message.hasVideoPreview && message.videoPreview && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm text-zinc-400">
              <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>
              <span>Agent has analyzed the video and prepared changes. Watch the preview below:</span>
            </div>
            
            {renderVideoPreview()}
          </div>
        )}
        
        {/* Actions */}
        {renderActions()}
      </div>
    );
  }

  // User message - keep the bubble style
  return (
    <div className="flex justify-end">
      <div className="max-w-[85%]">
        <div className="px-3 py-2 bg-blue-600 text-white rounded-lg">
          <div className="text-sm whitespace-pre-wrap">
            {renderContent(message.content)}
          </div>
        </div>
        <div className="text-xs text-zinc-500 mt-1 text-right">
          {formatTime(message.timestamp)}
        </div>
      </div>
    </div>
  );
}
