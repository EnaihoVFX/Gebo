import React, { useState, useRef, useEffect } from "react";
import { Send } from "lucide-react";
import { ChatMessage } from "./ChatMessage";
import { aiAgent } from "../../../lib/aiAgent";
import type { ChatMessage as ChatMessageType, Range, AgentContext, StreamingToken, AgentResponse, ThinkingStep, EditOperation } from "../../../types";

interface ChatProps {
  chatId: string;
  messages?: ChatMessageType[];
  onUpdateMessages: (messages: ChatMessageType[]) => void;
  onExecuteCommand: (command: string) => void;
  previewCuts: Range[];
  acceptedCuts: Range[];
  previewUrl: string;
  onAcceptPlan: () => void;
  onRejectPlan: () => void;
  onApplyEditOperations?: (operations: EditOperation[]) => void;
  // AI Agent context
  agentContext?: AgentContext;
  onUploadMedia?: () => Promise<any>;
}

export function Chat({
  chatId, // Currently unused but part of interface for future features
  messages,
  onUpdateMessages,
  onExecuteCommand,
  previewCuts,
  acceptedCuts,
  previewUrl,
  onAcceptPlan,
  onRejectPlan,
  onApplyEditOperations,
  agentContext,
  onUploadMedia,
}: ChatProps) {
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [activePromptId, setActivePromptId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const messageRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const currentMessagesRef = useRef<ChatMessageType[]>(messages || []);

  // Suppress unused parameter warning - chatId is part of interface for future features
  void chatId;

  // Update the ref whenever messages change
  useEffect(() => {
    currentMessagesRef.current = Array.isArray(messages) ? messages : [];
  }, [messages]);

  // Check if this is a new chat (only has welcome message)
  const isNewChat = Array.isArray(messages) && messages.length === 1 && messages[0]?.type === "assistant";

  // Get the active prompt content
  const activePrompt = activePromptId && Array.isArray(messages) ? messages.find(m => m.id === activePromptId) : null;

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    // Only auto-scroll if there's no video preview in the last message
    if (Array.isArray(messages) && messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      const hasVideoPreview = lastMessage?.hasVideoPreview && lastMessage?.videoPreview;
      
      if (!hasVideoPreview) {
        scrollToBottom();
      }
    }
  }, [messages]);

  // Track scroll position to determine active prompt
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container || !Array.isArray(messages) || messages.length === 0) return;

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

    const updatedMessages = [...(Array.isArray(messages) ? messages : []), userMessage];
    onUpdateMessages(updatedMessages);
    const command = inputValue.trim();
    setInputValue("");
    setIsLoading(true);

    // Use AI agent if context is available, otherwise fall back to legacy behavior
    if (agentContext) {
      // Create streaming assistant message
      const assistantMessage: ChatMessageType = {
        id: (Date.now() + 1).toString(),
        type: "assistant",
        content: "",
        timestamp: new Date(),
        isStreaming: true,
        status: "thinking",
        thinkingSteps: [],
        finalEdits: [],
      };

      // Add the streaming message to the chat
      onUpdateMessages([...updatedMessages, assistantMessage]);

      // Enrich agent context with conversation history
      const enrichedContext = {
        ...agentContext,
        conversationHistory: Array.isArray(messages) ? messages : [],
      };

      try {
        await aiAgent.processMessage(
          command,
          enrichedContext,
          (token: StreamingToken) => {
            // Update the streaming message with new token data
            const currentMessages = currentMessagesRef.current;
            const messageIndex = currentMessages.findIndex((m: ChatMessageType) => m.id === assistantMessage.id);
            if (messageIndex === -1) return;

            const updatedMessages = [...currentMessages];
            const currentMessage = updatedMessages[messageIndex];

            switch (token.type) {
              case 'content':
                updatedMessages[messageIndex] = {
                  ...currentMessage,
                  content: token.data.content,
                  status: 'streaming'
                };
                break;
              case 'thinking':
                updatedMessages[messageIndex] = {
                  ...currentMessage,
                  thinkingSteps: currentMessage.thinkingSteps ? 
                    currentMessage.thinkingSteps.map((step: ThinkingStep) => 
                      step.id === token.data.id ? token.data : step
                    ).concat(
                      currentMessage.thinkingSteps.find((step: ThinkingStep) => step.id === token.data.id) ? 
                      [] : [token.data]
                    ) : [token.data]
                };
                break;
              case 'edit':
                updatedMessages[messageIndex] = {
                  ...currentMessage,
                  finalEdits: [...(currentMessage.finalEdits || []), token.data]
                };
                break;
              case 'preview':
                updatedMessages[messageIndex] = {
                  ...currentMessage,
                  hasVideoPreview: true,
                  videoPreview: token.data
                };
                break;
              case 'action':
                updatedMessages[messageIndex] = {
                  ...currentMessage,
                  actions: token.data
                };
                break;
              case 'complete':
                updatedMessages[messageIndex] = {
                  ...currentMessage,
                  ...token.data,
                  isStreaming: false,
                  status: 'completed'
                };
                break;
            }

            onUpdateMessages(updatedMessages);
          },
          (response: AgentResponse) => {
            // Handle completion
            setIsLoading(false);
            
            // Apply edit operations if available
            if (response.finalEdits.length > 0 && onApplyEditOperations) {
              onApplyEditOperations(response.finalEdits);
            }
          },
          async (error: Error) => {
            // Handle error
            console.error('AI Agent error:', error);
            setIsLoading(false);
            
            // Update message with error
            const currentMessages = currentMessagesRef.current;
            const messageIndex = currentMessages.findIndex((m: ChatMessageType) => m.id === assistantMessage.id);
            if (messageIndex === -1) return;

            const updatedMessages = [...currentMessages];
            // Handle error object safely - it might be a string or Error object
            const errorText = typeof error === 'string' ? error : (error?.message || String(error));
            let errorMessage = errorText;
            
            // Provide helpful error messages
            if (errorText.includes("No Gemini API key configured")) {
              errorMessage = "I need a Gemini API key to work properly. Please set your API key in the settings to enable AI-powered video editing.";
            } else if (errorText.includes("API request failed")) {
              errorMessage = "I'm having trouble connecting to the AI service. Please check your internet connection and API key.";
            } else if (errorText.includes("Agent is already processing")) {
              // Automatically reset the processing lock
              try {
                await aiAgent.resetProcessingLock();
                errorMessage = "The AI agent was stuck processing. I've reset it - please try your request again.";
              } catch (resetError) {
                console.error('Failed to reset AI agent:', resetError);
                errorMessage = "The AI agent is busy processing another request. Please wait a moment and try again.";
              }
            }
            
            updatedMessages[messageIndex] = {
              ...updatedMessages[messageIndex],
              content: errorMessage,
              isStreaming: false,
              status: 'error'
            };

            onUpdateMessages(updatedMessages);
          }
        );
      } catch (error) {
        console.error('Failed to process message with AI agent:', error);
        setIsLoading(false);
      }
    } else {
      // Fallback to legacy behavior
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
    }
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
      className="p-3 sm:p-4 lg:p-5 flex gap-3 bg-editor-bg-canvas border-t border-editor-border-tertiary"
      onClick={(e) => {
        // Only focus if clicking on the container itself, not on child elements
        if (e.target === e.currentTarget && inputRef.current) {
          inputRef.current.focus();
        }
      }}
    >
      <div className="flex-1 relative">
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
          className="w-full px-4 py-3 text-sm bg-editor-bg-glass-secondary backdrop-blur-xl border border-editor-border-secondary rounded-xl text-editor-text-primary placeholder-editor-text-muted focus:outline-none focus:border-editor-border-accent focus:ring-2 focus:ring-editor-border-accent/20 resize-none min-h-[48px] max-h-[120px] transition-all duration-200 shadow-[0_2px_8px_rgba(0,0,0,0.15),inset_0_1px_0_rgba(255,255,255,0.1)]"
          rows={1}
          disabled={isLoading}
          autoFocus={false}
        />
        <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent rounded-xl pointer-events-none opacity-0 focus-within:opacity-100 transition-opacity duration-200"></div>
      </div>
      <button
        onClick={(e) => {
          e.stopPropagation();
          handleSendMessage();
        }}
        disabled={!inputValue.trim() || isLoading}
        className="group px-4 py-3 bg-editor-bg-glass-secondary backdrop-blur-xl border border-editor-border-secondary text-editor-text-primary rounded-xl hover:bg-editor-interactive-hover hover:border-editor-border-accent disabled:bg-editor-interactive-disabled disabled:opacity-50 transition-all duration-200 hover:scale-105 flex items-center justify-center shadow-[0_4px_16px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.1)] relative overflow-hidden min-w-[48px]"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200 rounded-xl"></div>
        {isLoading ? (
          <div className="relative z-10 flex gap-1">
            <div className="w-1.5 h-1.5 bg-editor-text-primary rounded-full animate-bounce"></div>
            <div className="w-1.5 h-1.5 bg-editor-text-primary rounded-full animate-bounce" style={{ animationDelay: "0.1s" }}></div>
            <div className="w-1.5 h-1.5 bg-editor-text-primary rounded-full animate-bounce" style={{ animationDelay: "0.2s" }}></div>
          </div>
        ) : (
          <Send className="w-4 h-4 relative z-10" />
        )}
      </button>
    </div>
  );

  return (
    <div className="flex flex-col h-full min-h-0 max-h-full chat-container">
      {/* Input at top for new chats */}
      {isNewChat && <InputArea />}
      
      {/* Sticky Header - Fixed height to prevent layout shift */}
      {activePrompt && (
        <div className="sticky top-0 z-10 bg-editor-bg-glass-secondary backdrop-blur-xl px-4 py-3 flex items-center transition-all duration-200 flex-shrink-0">
          <div className="px-4 py-2.5 bg-editor-bg-glass-secondary backdrop-blur-xl border border-editor-border-secondary rounded-xl w-full shadow-[0_4px_20px_rgba(0,0,0,0.25),inset_0_1px_0_rgba(255,255,255,0.15)] relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-white/8 to-transparent pointer-events-none"></div>
            <div className="text-sm whitespace-pre-wrap leading-relaxed text-left text-editor-text-primary break-words line-clamp-2 relative z-10 font-medium">
              {activePrompt.content}
            </div>
          </div>
        </div>
      )}

      {/* Messages - Flex-1 to take remaining space */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-5 lg:p-6 space-y-5 relative bg-editor-bg-canvas min-h-0" ref={messagesContainerRef}>
        {Array.isArray(messages) && messages.length > 0 && messages.map((message) => (
          <div
            key={message.id}
            ref={(el) => {
              if (el) {
                messageRefs.current.set(message.id, el);
              } else {
                messageRefs.current.delete(message.id);
              }
            }}
            className="transition-all duration-300 opacity-100"
          >
            <ChatMessage 
              message={message} 
              onUploadMedia={onUploadMedia}
              onAcceptPlan={onAcceptPlan}
              onRejectPlan={onRejectPlan}
            />
          </div>
        ))}
        
        {/* Only show loading indicator for legacy (non-AI agent) mode */}
        {isLoading && !agentContext && (
          <div className="flex items-center justify-center gap-3 p-4 bg-editor-bg-glass-secondary backdrop-blur-xl border border-editor-border-tertiary rounded-xl shadow-[0_2px_8px_rgba(0,0,0,0.15),inset_0_1px_0_rgba(255,255,255,0.1)] relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none"></div>
            <div className="flex gap-1.5 relative z-10">
              <div className="w-2 h-2 bg-editor-status-info rounded-full animate-bounce"></div>
              <div className="w-2 h-2 bg-editor-status-info rounded-full animate-bounce" style={{ animationDelay: "0.1s" }}></div>
              <div className="w-2 h-2 bg-editor-status-info rounded-full animate-bounce" style={{ animationDelay: "0.2s" }}></div>
            </div>
            <span className="text-sm text-editor-text-secondary font-medium relative z-10">Processing...</span>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input at bottom for existing chats */}
      {!isNewChat && <InputArea />}
    </div>
  );
}