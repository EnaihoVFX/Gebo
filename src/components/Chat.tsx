import { useState, useRef, useEffect } from "react";
import { ChatMessage } from "./ChatMessage";
import type { ChatMessage as ChatMessageType, Range } from "../types";

interface ChatProps {
  onExecuteCommand: (command: string) => void;
  previewCuts: Range[];
  acceptedCuts: Range[];
  previewUrl: string;
  onAcceptPlan: () => void;
  onRejectPlan: () => void;
}

export function Chat({
  onExecuteCommand,
  previewCuts,
  acceptedCuts,
  previewUrl,
  onAcceptPlan,
  onRejectPlan,
}: ChatProps) {
  const [messages, setMessages] = useState<ChatMessageType[]>([
    {
      id: "welcome",
      type: "assistant",
      content: "I'm your video editing assistant. I can help you edit videos by removing silence, cutting segments, and more.\n\nTry commands like:\n• `remove silence > 2` - Remove silent parts longer than 2 seconds\n• `tighten silence > 2 leave 150ms` - Shorten long silences to 150ms\n• `cut 12.5 - 14.0` - Cut a specific time range\n• `detect silence` - Find all silent parts\n\nLoad a video file first, then ask me to edit it.",
      timestamp: new Date(),
    }
  ]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    // Only auto-scroll if there's no video preview in the last message
    const lastMessage = messages[messages.length - 1];
    const hasVideoPreview = lastMessage?.hasVideoPreview && lastMessage?.videoPreview;
    
    if (!hasVideoPreview) {
      scrollToBottom();
    } else {
      // Show scroll button when there's a video preview
      setShowScrollButton(true);
    }
  }, [messages]);

  // Handle scroll events to show/hide scroll button
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
      setShowScrollButton(!isNearBottom);
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isLoading) return;

    const userMessage: ChatMessageType = {
      id: Date.now().toString(),
      type: "user",
      content: inputValue.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
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

      setMessages(prev => [...prev, assistantMessage]);
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
    setInputValue(e.target.value);
    
    // Auto-resize textarea
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
      inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 120)}px`;
    }
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4 relative" ref={messagesContainerRef}>
        {messages.map((message) => (
          <ChatMessage key={message.id} message={message} />
        ))}
        
        {isLoading && (
          <div className="flex items-center gap-2 text-zinc-400">
            <div className="flex gap-1">
              <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce"></div>
              <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: "0.1s" }}></div>
              <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: "0.2s" }}></div>
            </div>
            <span className="text-sm">Agent is processing...</span>
          </div>
        )}
        
        <div ref={messagesEndRef} />
        
        {/* Scroll to bottom button */}
        {showScrollButton && (
          <button
            onClick={scrollToBottom}
            className="absolute bottom-4 right-4 p-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-full shadow-lg transition-colors"
            title="Scroll to bottom"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
          </button>
        )}
      </div>

      {/* Input Area */}
      <div className="p-3 border-t border-zinc-800 flex gap-2">
        <textarea
          ref={inputRef}
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => console.log('Textarea focused')}
          onBlur={() => console.log('Textarea blurred')}
          placeholder="Type a command..."
          className="flex-1 px-3 py-2 text-sm bg-zinc-800 border border-zinc-700 rounded text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-zinc-600 resize-none min-h-[40px] max-h-[120px]"
          rows={1}
          disabled={isLoading}
        />
        <button
          onClick={handleSendMessage}
          disabled={!inputValue.trim() || isLoading}
          className="px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-700 text-white rounded transition-colors"
        >
          {isLoading ? "..." : "→"}
        </button>
      </div>
    </div>
  );
}
