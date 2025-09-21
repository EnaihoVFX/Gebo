import { useState, useRef, useEffect } from "react";
import { Check, X, Circle, Play, CheckCircle, Loader, XCircle, Clock, Scissors, Plus, Trash2, SlidersHorizontal, Type, Music } from "lucide-react";
import { Player } from "./Player";
import type { ChatMessage as ChatMessageType, ThinkingStep, EditOperation } from "../../../types";

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
          <code key={index} className="bg-editor-bg-secondary px-1 py-0.5 rounded text-xs font-mono text-editor-status-info">
            {part.slice(1, -1)}
          </code>
        );
      }
      return part;
    });
  };

  const renderThinkingSteps = (steps: ThinkingStep[]) => {
    if (!steps || steps.length === 0) return null;

    return (
      <div className="mb-4 p-4 bg-gradient-to-r from-blue-900/10 to-purple-900/10 border border-blue-500/20 rounded-lg">
        <div className="flex items-center gap-2 mb-3">
          <div className="flex gap-1">
            <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-pulse"></div>
            <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-pulse" style={{ animationDelay: "0.2s" }}></div>
            <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-pulse" style={{ animationDelay: "0.4s" }}></div>
          </div>
          <h4 className="text-sm font-semibold text-blue-300 flex items-center gap-2">
            <Clock className="w-4 h-4" />
            Agent Thinking
          </h4>
        </div>
        <div className="space-y-3">
          {steps.map((step, index) => (
            <div key={step.id} className="flex items-start gap-3 p-2 bg-black/20 rounded border border-blue-500/10">
              <div className="flex-shrink-0 mt-0.5">
                {step.status === 'completed' && <CheckCircle className="w-4 h-4 text-green-400" />}
                {step.status === 'in_progress' && <Loader className="w-4 h-4 text-blue-400 animate-spin" />}
                {step.status === 'pending' && <Circle className="w-4 h-4 text-gray-400" />}
                {step.status === 'error' && <XCircle className="w-4 h-4 text-red-400" />}
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-blue-200 mb-1">
                  {step.title}
                  {step.duration && <span className="ml-2 text-xs text-blue-400">({step.duration}ms)</span>}
                </p>
                {step.description && (
                  <p className="text-xs text-blue-300/80 leading-relaxed">
                    {step.description}
                  </p>
                )}
                {step.details && (
                  <div className="mt-2 p-2 bg-black/30 rounded text-xs text-blue-200/70 border-l-2 border-blue-400/30">
                    <span className="font-medium text-blue-300">Analysis:</span> {step.details}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderEditOperations = (edits: EditOperation[]) => {
    if (!edits || edits.length === 0) return null;

    const getIcon = (type: EditOperation['type']) => {
      switch (type) {
        case 'cut':
        case 'split':
        case 'trim':
          return <Scissors className="w-3 h-3 text-red-400" />;
        case 'merge':
          return <Plus className="w-3 h-3 text-green-400" />;
        case 'add_transition':
          return <SlidersHorizontal className="w-3 h-3 text-purple-400" />;
        case 'add_effect':
          return <SlidersHorizontal className="w-3 h-3 text-yellow-400" />;
        case 'add_text':
          return <Type className="w-3 h-3 text-blue-400" />;
        case 'adjust_audio':
          return <Music className="w-3 h-3 text-teal-400" />;
        default:
          return <Trash2 className="w-3 h-3 text-gray-400" />;
      }
    };

    return (
      <div className="mt-4 p-3 bg-editor-bg-secondary rounded-lg border border-editor-border-secondary">
        <h4 className="text-sm font-semibold text-editor-text-primary mb-3 flex items-center gap-2">
          <Scissors className="w-4 h-4 text-editor-status-warning" />
          Proposed Edit Operations
        </h4>
        <div className="space-y-2">
          {edits.map((edit) => (
            <div key={edit.id} className="flex items-start gap-2 bg-editor-bg-tertiary p-2 rounded">
              <div className="flex-shrink-0 mt-0.5">
                {getIcon(edit.type)}
              </div>
              <div className="flex-1">
                <p className="text-xs font-medium text-editor-text-secondary">
                  {edit.description}
                </p>
                {edit.timeRange && (
                  <p className="text-xs text-editor-text-muted mt-0.5">
                    Time: {edit.timeRange.start.toFixed(2)}s - {edit.timeRange.end.toFixed(2)}s
                  </p>
                )}
                {edit.targetClipId && (
                  <p className="text-xs text-editor-text-muted mt-0.5">
                    Target Clip: {edit.targetClipId}
                  </p>
                )}
                {edit.targetTrackId && (
                  <p className="text-xs text-editor-text-muted mt-0.5">
                    Target Track: {edit.targetTrackId}
                  </p>
                )}
                {Object.keys(edit.parameters).length > 0 && (
                  <p className="text-xs text-editor-text-muted italic mt-0.5">
                    Params: {JSON.stringify(edit.parameters)}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderActions = () => {
    if (!message.actions || message.actions.length === 0) return null;

    return (
      <div className="flex gap-2 mt-3">
        {message.actions.map((action, index) => (
          <button
            key={index}
            onClick={action.onClick}
            className={`px-3 py-1.5 text-xs rounded-md transition-colors border flex items-center gap-1.5 ${
              action.type === "accept"
                ? "bg-green-600/10 border-green-600/20 text-green-400 hover:bg-green-600/20 hover:border-green-600/30"
                : action.type === "reject"
                ? "bg-red-600/10 border-red-600/20 text-red-400 hover:bg-red-600/20 hover:border-red-600/30"
                : "bg-editor-bg-secondary/50 border-editor-border-secondary text-editor-text-secondary hover:bg-editor-interactive-hover/50 hover:border-editor-border-primary"
            }`}
          >
            {action.type === "accept" ? (
              <Check className="w-3 h-3" />
            ) : action.type === "reject" ? (
              <X className="w-3 h-3" />
            ) : null}
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
        <div className="border-2 border-blue-500/30 rounded-lg overflow-hidden bg-editor-bg-primary/40 shadow-lg">
          <div className="p-2 bg-gradient-to-r from-blue-900/20 to-zinc-800/50 border-b border-editor-border-secondary">
            <div className="flex items-center gap-2">
              <Circle className="w-1.5 h-1.5 fill-green-500 text-green-500 animate-pulse" />
              <span className="text-xs text-editor-text-secondary font-medium">
                Preview: {message.videoPreview.label}
              </span>
              <span className="text-xs text-editor-text-muted">
                ({message.videoPreview.cuts.length} changes)
              </span>
              <div className="ml-auto flex items-center gap-1 text-xs text-editor-text-tertiary">
                <Play className="w-2.5 h-2.5 text-blue-500 animate-pulse" />
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
          <div className="bg-editor-bg-primary/20 border border-editor-border-secondary rounded-lg p-2">
            <div className="text-xs text-editor-text-secondary mb-1 font-medium">
              Changes Preview:
            </div>
            <div className="space-y-1">
              {message.videoPreview.cuts.slice(0, 3).map((cut, index) => (
                <div key={index} className="text-xs text-editor-text-tertiary flex items-center gap-2">
                  <Circle className="w-1 h-1 fill-red-500 text-red-500 flex-shrink-0" />
                  <span>Remove {cut.start.toFixed(2)}s - {cut.end.toFixed(2)}s</span>
                </div>
              ))}
              {message.videoPreview.cuts.length > 3 && (
                <div className="text-xs text-editor-text-muted italic">
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
      <div className="space-y-3">
        {/* Show thinking indicator if message is in thinking state */}
        {message.status === "thinking" && (
          <div className="flex items-center gap-2 text-editor-text-tertiary">
            <div className="flex gap-1">
              <div className="w-1 h-1 bg-blue-500 rounded-full animate-bounce"></div>
              <div className="w-1 h-1 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: "0.1s" }}></div>
              <div className="w-1 h-1 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: "0.2s" }}></div>
            </div>
            <span className="text-xs">Agent is processing...</span>
          </div>
        )}

        {/* Thinking Steps - Show on top before response */}
        {message.thinkingSteps && message.thinkingSteps.length > 0 && renderThinkingSteps(message.thinkingSteps)}

        {/* AI Response - Only show if not just thinking */}
        {message.content && message.content.trim() && (
          <div className="w-full">
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg px-3 py-2 text-xs text-editor-text-secondary leading-relaxed break-words">
              {renderContent(message.content)}
            </div>
          </div>
        )}

        {/* Edit Operations */}
        {message.finalEdits && message.finalEdits.length > 0 && renderEditOperations(message.finalEdits)}
        
        {/* Agent Actions - Show what the agent is doing */}
        {message.hasVideoPreview && message.videoPreview && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs text-editor-text-tertiary">
              <Circle className="w-1.5 h-1.5 fill-blue-500 text-blue-500" />
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

  // User message - full width bubble with text wrapping
  return (
    <div className="mb-3">
      <div className="w-full user-message-bubble">
        <div className="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg">
          <div className="text-xs whitespace-pre-wrap leading-relaxed text-left text-slate-200 break-words">
            {renderContent(message.content)}
          </div>
        </div>
      </div>
      <div className="text-xs text-editor-text-muted mt-1 text-left text-[10px] user-message-timestamp">
        {formatTime(message.timestamp)}
      </div>
    </div>
  );
}