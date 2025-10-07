import { useState, useRef, useEffect } from "react";
import { Check, X, Circle, Play, Scissors, Plus, Trash2, SlidersHorizontal, Type, Music } from "lucide-react";
import { Player } from "./Player";
import type { ChatMessage as ChatMessageType, ThinkingStep, EditOperation } from "../../../types";

interface ChatMessageProps {
  message: ChatMessageType;
  onUploadMedia?: () => Promise<any>;
  onAcceptPlan?: () => void;
  onRejectPlan?: () => void;
}

export function ChatMessage({ message, onUploadMedia, onAcceptPlan, onRejectPlan }: ChatMessageProps) {
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
    // Simple markdown-like rendering for code blocks, inline code, and bold text
    // First split by code blocks (backticks)
    const parts = content.split(/(`[^`]+`)/g);
    
    return parts.map((part, index) => {
      // If it's a code block, render it
      if (part.startsWith('`') && part.endsWith('`')) {
        return (
          <code key={index} className="bg-editor-bg-glass-tertiary backdrop-blur-xl px-2 py-1 rounded-lg text-xs font-mono text-editor-status-info border border-editor-border-tertiary shadow-[0_1px_4px_rgba(0,0,0,0.1)]">
            {part.slice(1, -1)}
          </code>
        );
      }
      
      // Otherwise, look for bold text (**text**)
      const boldParts = part.split(/(\*\*[^*]+\*\*)/g);
      return boldParts.map((boldPart, boldIndex) => {
        if (boldPart.startsWith('**') && boldPart.endsWith('**')) {
          return (
            <strong key={`${index}-${boldIndex}`} className="font-semibold text-editor-text-primary">
              {boldPart.slice(2, -2)}
            </strong>
          );
        }
        return <span key={`${index}-${boldIndex}`}>{boldPart}</span>;
      });
    });
  };

  const renderThinkingSteps = (steps: ThinkingStep[]) => {
    if (!steps || steps.length === 0) return null;

    // Get the latest thinking step content
    const latestStep = steps[steps.length - 1];
    const thinkingContent = latestStep?.details || latestStep?.description || latestStep?.title || "Thinking...";

    return (
      <div className="mb-4 p-3 bg-editor-bg-glass-secondary backdrop-blur-xl border border-editor-border-secondary rounded-lg shadow-[0_2px_8px_rgba(0,0,0,0.15),inset_0_1px_0_rgba(255,255,255,0.1)] relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none"></div>
        <div className="flex items-center gap-2 mb-2 relative z-10">
          <div className="flex gap-1">
            <div className="w-1.5 h-1.5 bg-editor-text-muted rounded-full animate-pulse"></div>
            <div className="w-1.5 h-1.5 bg-editor-text-muted rounded-full animate-pulse" style={{ animationDelay: "0.2s" }}></div>
            <div className="w-1.5 h-1.5 bg-editor-text-muted rounded-full animate-pulse" style={{ animationDelay: "0.4s" }}></div>
          </div>
          <span className="text-xs text-editor-text-muted font-medium">Thinking</span>
        </div>
        <div className="text-sm text-editor-text-muted leading-relaxed relative z-10 opacity-70">
          {thinkingContent}
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
          return <Scissors className="w-4 h-4 text-editor-status-error" />;
        case 'merge':
          return <Plus className="w-4 h-4 text-editor-status-success" />;
        case 'add_transition':
          return <SlidersHorizontal className="w-4 h-4 text-purple-400" />;
        case 'add_effect':
          return <SlidersHorizontal className="w-4 h-4 text-editor-status-warning" />;
        case 'add_text':
          return <Type className="w-4 h-4 text-editor-status-info" />;
        case 'adjust_audio':
          return <Music className="w-4 h-4 text-teal-400" />;
        default:
          return <Trash2 className="w-4 h-4 text-editor-text-muted" />;
      }
    };

    return (
      <div className="mt-5 p-4 bg-editor-bg-glass-secondary backdrop-blur-xl rounded-xl border border-editor-border-secondary shadow-[0_4px_16px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.1)] relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none"></div>
        <h4 className="text-sm font-semibold text-editor-text-primary mb-4 flex items-center gap-2 relative z-10">
          <Scissors className="w-4 h-4 text-editor-status-warning" />
          Proposed Edit Operations
        </h4>
        <div className="space-y-3 relative z-10">
          {edits.map((edit) => (
            <div key={edit.id} className="flex items-start gap-3 bg-editor-bg-glass-tertiary backdrop-blur-xl p-3 rounded-lg border border-editor-border-tertiary shadow-[0_2px_8px_rgba(0,0,0,0.1)] relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-white/3 to-transparent pointer-events-none"></div>
              <div className="flex-shrink-0 mt-0.5 relative z-10">
                {getIcon(edit.type)}
              </div>
              <div className="flex-1 relative z-10">
                <p className="text-sm font-medium text-editor-text-primary">
                  {edit.description}
                </p>
                {edit.timeRange && (
                  <p className="text-xs text-editor-text-secondary mt-1">
                    Time: {edit.timeRange.start.toFixed(2)}s - {edit.timeRange.end.toFixed(2)}s
                  </p>
                )}
                {edit.targetClipId && (
                  <p className="text-xs text-editor-text-secondary mt-1">
                    Target Clip: {edit.targetClipId}
                  </p>
                )}
                {edit.targetTrackId && (
                  <p className="text-xs text-editor-text-secondary mt-1">
                    Target Track: {edit.targetTrackId}
                  </p>
                )}
                {Object.keys(edit.parameters).length > 0 && (
                  <p className="text-xs text-editor-text-muted italic mt-1">
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
      <div className="flex gap-3 mt-4">
        {message.actions.map((action, index) => {
          // Determine the actual onClick handler based on action type
          const handleClick = () => {
            // Try the action's onClick first (for legacy support)
            if (action.onClick && typeof action.onClick === 'function') {
              action.onClick();
              return;
            }
            
            // Otherwise, map action types to handlers
            switch (action.type) {
              case 'accept':
                if (onAcceptPlan) onAcceptPlan();
                break;
              case 'reject':
                if (onRejectPlan) onRejectPlan();
                break;
              case 'upload_media':
              case 'upload_video':
                if (onUploadMedia) {
                  onUploadMedia().catch(error => {
                    console.error("Failed to upload media:", error);
                  });
                }
                break;
              case 'confirm_proceed':
                // For confirm_proceed, we don't need a handler - user should type their response in chat
                console.log('User should respond yes/no in chat for confirmation');
                break;
              case 'custom':
                // Check if the label suggests an upload action
                if (action.label.toLowerCase().includes('upload') && onUploadMedia) {
                  onUploadMedia().catch(error => {
                    console.error("Failed to upload media:", error);
                  });
                }
                break;
              default:
                console.warn(`Unknown action type: ${action.type}`);
            }
          };

          return (
            <button
              key={index}
              onClick={handleClick}
              className={`group px-4 py-2.5 text-sm rounded-xl transition-all duration-200 border flex items-center gap-2 font-medium shadow-[0_2px_8px_rgba(0,0,0,0.15),inset_0_1px_0_rgba(255,255,255,0.1)] relative overflow-hidden backdrop-blur-xl ${
                action.type === "accept"
                  ? "bg-editor-status-success/10 border-editor-status-success/20 text-editor-status-success hover:bg-editor-status-success/20 hover:border-editor-status-success/30 hover:scale-105"
                  : action.type === "reject"
                  ? "bg-editor-status-error/10 border-editor-status-error/20 text-editor-status-error hover:bg-editor-status-error/20 hover:border-editor-status-error/30 hover:scale-105"
                  : "bg-editor-bg-glass-secondary border-editor-border-secondary text-editor-text-secondary hover:bg-editor-interactive-hover hover:border-editor-border-accent hover:scale-105"
              }`}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200 rounded-xl"></div>
              {action.type === "accept" ? (
                <Check className="w-4 h-4 relative z-10" />
              ) : action.type === "reject" ? (
                <X className="w-4 h-4 relative z-10" />
              ) : null}
              <span className="relative z-10">{action.label}</span>
            </button>
          );
        })}
      </div>
    );
  };

  const renderVideoPreview = () => {
    if (!message.hasVideoPreview || !message.videoPreview) return null;

    return (
      <div className="mt-5 space-y-4">
        {/* Video Preview - Embedded directly in message */}
        <div className="border-2 border-editor-border-accent rounded-xl overflow-hidden bg-editor-bg-glass-primary backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.15)] relative">
          <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none"></div>
          <div className="p-3 bg-editor-bg-glass-secondary backdrop-blur-xl border-b border-editor-border-tertiary relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-white/8 to-transparent pointer-events-none"></div>
            <div className="flex items-center gap-3 relative z-10">
              <Circle className="w-2 h-2 fill-editor-status-success text-editor-status-success animate-pulse" />
              <span className="text-sm text-editor-text-primary font-medium">
                Preview: {message.videoPreview.label}
              </span>
              <span className="text-sm text-editor-text-secondary">
                ({message.videoPreview.cuts.length} changes)
              </span>
              <div className="ml-auto flex items-center gap-2 text-sm text-editor-text-tertiary">
                <Play className="w-3 h-3 text-editor-status-info animate-pulse" />
                <span>Auto-playing</span>
              </div>
            </div>
          </div>
          
          <div className="p-4 relative z-10">
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
          <div className="bg-editor-bg-glass-secondary backdrop-blur-xl border border-editor-border-secondary rounded-xl p-4 shadow-[0_2px_8px_rgba(0,0,0,0.15),inset_0_1px_0_rgba(255,255,255,0.1)] relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none"></div>
            <div className="text-sm text-editor-text-primary mb-3 font-medium relative z-10">
              Changes Preview:
            </div>
            <div className="space-y-2 relative z-10">
              {message.videoPreview.cuts.slice(0, 3).map((cut, index) => (
                <div key={index} className="text-sm text-editor-text-secondary flex items-center gap-3">
                  <Circle className="w-1.5 h-1.5 fill-editor-status-error text-editor-status-error flex-shrink-0" />
                  <span>Remove {cut.start.toFixed(2)}s - {cut.end.toFixed(2)}s</span>
                </div>
              ))}
              {message.videoPreview.cuts.length > 3 && (
                <div className="text-sm text-editor-text-muted italic">
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
    const isThinking = message.status === "thinking" || (message.thinkingSteps && message.thinkingSteps.length > 0 && !message.content);
    const hasContent = message.content && message.content.trim();
    
    return (
      <div className="space-y-3">
        {/* Thinking Steps - Show only when thinking and no content yet */}
        {isThinking && !hasContent && message.thinkingSteps && message.thinkingSteps.length > 0 && renderThinkingSteps(message.thinkingSteps)}

        {/* AI Response - Show when there's content */}
        {hasContent && (
          <div className="w-full">
            <div className="bg-editor-bg-glass-secondary backdrop-blur-xl border border-editor-border-secondary rounded-xl px-4 py-3 text-sm text-editor-text-primary leading-relaxed break-words shadow-[0_4px_16px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.1)] relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none"></div>
              <div className="relative z-10">
                {renderContent(message.content)}
              </div>
            </div>
          </div>
        )}

        {/* Edit Operations */}
        {message.finalEdits && message.finalEdits.length > 0 && renderEditOperations(message.finalEdits)}
        
        {/* Agent Actions - Show what the agent is doing */}
        {message.hasVideoPreview && message.videoPreview && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs text-editor-text-tertiary">
              <Circle className="w-1.5 h-1.5 fill-editor-status-info text-editor-status-info" />
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
    <div className="mb-4">
      <div className="w-full user-message-bubble">
        <div className="px-4 py-3 bg-editor-bg-glass-secondary backdrop-blur-xl border border-editor-border-secondary rounded-xl shadow-[0_4px_16px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.1)] relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none"></div>
          <div className="text-sm whitespace-pre-wrap leading-relaxed text-left text-editor-text-primary break-words relative z-10">
            {renderContent(message.content)}
          </div>
        </div>
      </div>
      <div className="text-xs text-editor-text-muted mt-2 text-left user-message-timestamp">
        {formatTime(message.timestamp)}
      </div>
    </div>
  );
}