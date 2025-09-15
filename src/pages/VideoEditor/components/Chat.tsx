import React, { useState, useRef, useEffect } from "react";
import { Send } from "lucide-react";
import { ChatMessage } from "./ChatMessage";
import type { ChatMessage as ChatMessageType, Range } from "../../../types";

interface ChatProps {
  chatId: string;
  messages: ChatMessageType[];
  onUpdateMessages: (messages: ChatMessageType[]) => void;
  onExecuteCommand: (command: string) => void;
  previewCuts: Range[];
  acceptedCuts: Range[];
  previewUrl: string;
  onAcceptPlan: () => void;
  onRejectPlan: () => void;
}

export function Chat({
  chatId,
  messages,
  onUpdateMessages,
  onExecuteCommand,
  previewCuts,
  acceptedCuts,
  previewUrl,
  onAcceptPlan,
  onRejectPlan,
}: ChatProps) {
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [activePromptId, setActivePromptId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const messageRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // Check if this is a new chat (only has welcome message)
  const isNewChat = messages.length === 1 && messages[0].type === "assistant";

  // Get the active prompt content
  const activePrompt = activePromptId ? messages.find(m => m.id === activePromptId) : null;

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    // Only auto-scroll if there's no video preview in the last message
    const lastMessage = messages[messages.length - 1];
    const hasVideoPreview = lastMessage?.hasVideoPreview && lastMessage?.videoPreview;
    
    if (!hasVideoPreview) {
      scrollToBottom();
    }
  }, [messages]);

  // Track scroll position to determine active prompt
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const containerRect = container.getBoundingClientRect();
      const containerTop = containerRect.top;
      
      // Threshold: header only shows when bubble is mostly scrolled past
      const threshold = 60; // pixels past the top of container
      
      // Find the user message that should trigger the sticky header
      let currentPromptId: string | null = null;
      
      messageRefs.current.forEach((element, messageId) => {
        const message = messages.find(m => m.id === messageId);
        if (message && message.type === "user") {
          const elementRect = element.getBoundingClientRect();
          const elementTop = elementRect.top;
          const elementBottom = elementRect.bottom;
          
          // Only show header if the user message has scrolled significantly past the top
          // The bottom of the message should be well past the container top
          if (elementBottom < containerTop + threshold) {
            // Make sure we're not showing a header for a message that's still mostly visible
            const messageHeight = elementBottom - elementTop;
            const scrolledPast = containerTop + threshold - elementBottom;
            
            // Only show if we've scrolled past at least 30% of the message height
            if (scrolledPast > messageHeight * 0.3) {
              currentPromptId = messageId;
            }
          }
        }
      });
      
      setActivePromptId(currentPromptId);
    };

    container.addEventListener('scroll', handleScroll);
    // Don't run initial check - let it be triggered by actual scrolling
    
    return () => container.removeEventListener('scroll', handleScroll);
  }, [messages]);



  const handleSendMessage = async () => {
    if (!inputValue.trim() || isLoading) return;

    const userMessage: ChatMessageType = {
      id: Date.now().toString(),
      type: "user",
      content: inputValue.trim(),
      timestamp: new Date(),
    };

    const updatedMessages = [...messages, userMessage];
    onUpdateMessages(updatedMessages);
    const command = inputValue.trim();
    setInputValue("");
    setIsLoading(true);

    // Execute the command immediately
    onExecuteCommand(command);

    // Simulate AI processing and response
    setTimeout(() => {
      let responseContent = "";
      let hasPreview = false;

      // Check if this looks like a command
      const isCommand = command.includes("remove") || command.includes("tighten") || 
                       command.includes("cut") || command.includes("detect") || 
                       command.includes("silence");

      if (isCommand) {
        responseContent = `Executing: \`${command}\`\n\n`;
        
        if (previewCuts.length > 0) {
          responseContent += `Found ${previewCuts.length} segment(s) to modify. The agent has analyzed the video and prepared the changes. Watch the preview to see what will be changed.`;
          hasPreview = true;
        } else {
          responseContent += "No matching segments found. The command completed but didn't identify any content to modify.";
        }
      } else {
        responseContent = `I can help you with video editing commands. Here are some examples:\n\n`;
        responseContent += "• `remove silence > 2` - Remove silent parts longer than 2 seconds\n";
        responseContent += "• `tighten silence > 2 leave 150ms` - Shorten long silences to 150ms\n";
        responseContent += "• `cut 12.5 - 14.0` - Cut a specific time range\n";
        responseContent += "• `detect silence` - Find all silent parts in the video\n\n";
        responseContent += "Try one of these commands to get started.";
      }

      const assistantMessage: ChatMessageType = {
        id: (Date.now() + 1).toString(),
        type: "assistant",
        content: responseContent,
        timestamp: new Date(),
        hasVideoPreview: hasPreview && previewCuts.length > 0,
        videoPreview: hasPreview && previewCuts.length > 0 ? {
          src: previewUrl,
          cuts: [...acceptedCuts, ...previewCuts],
          label: "Proposed Changes (Accepted + New)"
        } : undefined,
        actions: hasPreview && previewCuts.length > 0 ? [
          {
            type: "accept",
            label: "Accept Changes",
            onClick: onAcceptPlan,
          },
          {
            type: "reject", 
            label: "Reject Changes",
            onClick: onRejectPlan,
          }
        ] : undefined
      };

      onUpdateMessages([...updatedMessages, assistantMessage]);
      setIsLoading(false);
    }, 1500);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
    // Don't prevent default for other keys like space
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    console.log('Input change:', e.target.value);
    const cursorPosition = e.target.selectionStart;
    setInputValue(e.target.value);
    
    // Auto-resize textarea
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
      inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 120)}px`;
    }
    
    // Ensure focus is maintained after state update and preserve cursor position
    setTimeout(() => {
      if (inputRef.current && document.activeElement !== inputRef.current) {
        console.log('Restoring focus after input change');
        inputRef.current.focus();
        // Restore cursor position
        if (cursorPosition !== null) {
          inputRef.current.setSelectionRange(cursorPosition, cursorPosition);
        }
      }
    }, 0);
  };

  // Input component
  const InputArea = () => (
    <div 
      className="p-2 sm:p-3 lg:p-4 flex gap-2"
      onClick={(e) => {
        // Only focus if clicking on the container itself, not on child elements
        if (e.target === e.currentTarget && inputRef.current) {
          inputRef.current.focus();
        }
      }}
    >
      <textarea
        key="chat-textarea" // Stable key to prevent recreation
        ref={inputRef}
        value={inputValue}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        onFocus={(e) => {
          e.stopPropagation();
          console.log('Textarea focused');
        }}
        onBlur={(e) => {
          e.stopPropagation();
          console.log('Textarea blurred - relatedTarget:', e.relatedTarget);
        }}
        placeholder="Type a command..."
        className="flex-1 px-3 py-2 text-sm bg-editor-bg-secondary border border-editor-border-secondary rounded text-editor-text-secondary placeholder-editor-text-muted focus:outline-none focus:border-editor-border-primary resize-none min-h-[40px] max-h-[120px]"
        rows={1}
        disabled={isLoading}
        autoFocus={false}
      />
      <button
        onClick={(e) => {
          e.stopPropagation();
          handleSendMessage();
        }}
        disabled={!inputValue.trim() || isLoading}
        className="px-3 py-2 bg-editor-status-info hover:bg-blue-700 disabled:bg-editor-bg-tertiary text-white rounded transition-colors flex items-center justify-center"
      >
        {isLoading ? "..." : <Send className="w-4 h-4" />}
      </button>
    </div>
  );

  return (
    <div className="flex flex-col h-full min-h-0 chat-container">
      {/* Input at top for new chats */}
      {isNewChat && <InputArea />}
      
      {/* Sticky Header - Fixed height to prevent layout shift */}
      <div className="sticky top-0 z-10 bg-gradient-to-b from-transparent to-slate-900 backdrop-blur-sm px-3 py-2 flex items-center transition-all duration-200" style={{ height: activePrompt ? '64px' : '0px', opacity: activePrompt ? 1 : 0, pointerEvents: activePrompt ? 'auto' : 'none', overflow: 'hidden' }}>
        {activePrompt && (
          <div className="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg w-full">
            <div className="text-xs whitespace-pre-wrap leading-relaxed text-left text-slate-200 break-words line-clamp-2">
              {activePrompt.content}
            </div>
          </div>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-2 sm:p-3 lg:p-4 space-y-4 relative" ref={messagesContainerRef}>
        {messages.map((message) => (
          <div
            key={message.id}
            ref={(el) => {
              if (el) {
                messageRefs.current.set(message.id, el);
              } else {
                messageRefs.current.delete(message.id);
              }
            }}
            className="transition-opacity duration-300 opacity-100"
          >
            <ChatMessage message={message} />
          </div>
        ))}
        
        {isLoading && (
          <div className="flex items-center gap-2 text-editor-text-tertiary">
            <div className="flex gap-1">
              <div className="w-1 h-1 bg-blue-500 rounded-full animate-bounce"></div>
              <div className="w-1 h-1 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: "0.1s" }}></div>
              <div className="w-1 h-1 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: "0.2s" }}></div>
            </div>
            <span className="text-xs">Agent is processing...</span>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input at bottom for existing chats */}
      {!isNewChat && <InputArea />}
    </div>
  );
}
