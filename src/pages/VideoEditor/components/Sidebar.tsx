import { useState, useCallback, useRef, useEffect } from "react";
import { 
  X,
  Plus,
  History,
  MoreHorizontal,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import { Chat } from "./Chat";
import { aiAgent } from "../../../lib/aiAgent";
import type { Range, ChatSession, ChatMessage, AgentContext } from "../../../types";

interface SidebarProps {
  previewUrl: string;
  acceptedCuts: Range[];
  previewCuts: Range[];
  onExecuteCommand: (command: string) => void;
  onAcceptPlan: () => void;
  onRejectPlan: () => void;
  agentContext?: AgentContext;
}

export function Sidebar({
  previewUrl,
  acceptedCuts,
  previewCuts,
  onExecuteCommand,
  onAcceptPlan,
  onRejectPlan,
  agentContext,
}: SidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  
  // Scroll management for chat tabs
  const tabsContainerRef = useRef<HTMLDivElement>(null);
  const [showLeftFade, setShowLeftFade] = useState(false);
  const [showRightFade, setShowRightFade] = useState(false);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  
  // Chat management state
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([
    {
      id: "default-chat",
      name: "Chat",
      messages: [
        {
          id: "welcome",
          type: "assistant",
          content: "I'm your video editing assistant. I can help you edit videos by removing silence, cutting segments, and more.\n\nTry commands like:\n• `remove silence > 2` - Remove silent parts longer than 2 seconds\n• `tighten silence > 2 leave 150ms` - Shorten long silences to 150ms\n• `cut 12.5 - 14.0` - Cut a specific time range\n• `detect silence` - Find all silent parts\n\nLoad a video file first, then ask me to edit it.",
          timestamp: new Date(),
        }
      ],
      createdAt: new Date(),
      lastActivity: new Date(),
    }
  ]);
  const [activeChatId, setActiveChatId] = useState("default-chat");

  // Create a new chat session
  const createNewChat = useCallback(() => {
    const newChatId = `chat-${Date.now()}`;
    const newChat: ChatSession = {
      id: newChatId,
      name: `Chat ${chatSessions.length + 1}`, // Simple naming for now, can be changed by AI later
      messages: [
        {
          id: "welcome",
          type: "assistant",
          content: "Hello! I'm your video editing assistant. How can I help you today?",
          timestamp: new Date(),
        }
      ],
      createdAt: new Date(),
      lastActivity: new Date(),
    };
    
    setChatSessions(prev => [...prev, newChat]);
    // Automatically select the new chat
    setActiveChatId(newChatId);
  }, [chatSessions.length]);

  // Close a chat session (but keep at least one chat open)
  const closeChat = useCallback((chatIdToClose: string) => {
    if (chatSessions.length <= 1) return; // Don't close the last chat
    
    const remainingChats = chatSessions.filter(chat => chat.id !== chatIdToClose);
    setChatSessions(remainingChats);
    
    // If we're closing the active chat, automatically select the best remaining chat
    if (activeChatId === chatIdToClose) {
      // Prefer the first chat (usually the default), or the most recent one
      const defaultChat = remainingChats.find(chat => chat.id === "default-chat");
      const selectedChat = defaultChat || remainingChats[0];
      setActiveChatId(selectedChat.id);
    }
  }, [chatSessions, activeChatId]);

  // Update messages for a specific chat
  const updateChatMessages = useCallback((chatId: string, messages: ChatMessage[]) => {
    setChatSessions(prev => prev.map(chat => {
      if (chat.id === chatId) {
        // Auto-update chat name based on first user message if it's still the default name
        let updatedChat = { ...chat, messages, lastActivity: new Date() };
        
        // If this is the first user message and the chat has a default name, update it
        const userMessages = Array.isArray(messages) ? messages.filter(msg => msg.type === "user") : [];
        if (userMessages.length === 1 && chat.name.startsWith("Chat ")) {
          const firstMessage = userMessages[0].content;
          
          // Generate AI-powered chat name
          aiAgent.generateChatName(firstMessage).then(aiName => {
            setChatSessions(prevSessions => prevSessions.map(session => 
              session.id === chatId ? { ...session, name: aiName } : session
            ));
          }).catch(error => {
            console.warn('Failed to generate AI chat name:', error);
            // Fallback to simple truncation
            const shortName = firstMessage.length > 20 
              ? firstMessage.substring(0, 20) + "..." 
              : firstMessage;
            setChatSessions(prevSessions => prevSessions.map(session => 
              session.id === chatId ? { ...session, name: shortName } : session
            ));
          });
        }
        
        return updatedChat;
      }
      return chat;
    }));
  }, []);

  // Get the active chat
  const activeChat = chatSessions.find(chat => chat.id === activeChatId) || chatSessions[0];

  // Auto-select the most recent chat if current active chat doesn't exist
  useEffect(() => {
    const currentActiveChat = chatSessions.find(chat => chat.id === activeChatId);
    if (!currentActiveChat && chatSessions.length > 0) {
      // If the active chat doesn't exist, select the most recent one
      const mostRecentChat = chatSessions.reduce((latest, current) => 
        current.lastActivity > latest.lastActivity ? current : latest
      );
      setActiveChatId(mostRecentChat.id);
    }
  }, [chatSessions, activeChatId]);

  // Check scroll position and update fade states
  const checkScrollPosition = useCallback(() => {
    const container = tabsContainerRef.current;
    if (!container) return;

    const { scrollLeft, scrollWidth, clientWidth } = container;
    const canScrollLeft = scrollLeft > 0;
    const canScrollRight = scrollLeft < scrollWidth - clientWidth - 1; // -1 for rounding errors
    const hasOverflow = scrollWidth > clientWidth;

    setCanScrollLeft(canScrollLeft);
    setCanScrollRight(canScrollRight);
    
    // Show left fade when there's content scrolled out of view on the left
    // Show right fade when there's content scrolled out of view on the right
    setShowLeftFade(hasOverflow && canScrollLeft);
    setShowRightFade(hasOverflow && canScrollRight);
  }, []);

  // Scroll functions - Allow scrolling beyond fade areas
  const scrollLeft = useCallback(() => {
    const container = tabsContainerRef.current;
    if (container) {
      // Scroll by a larger amount to go beyond the fade area
      container.scrollBy({ left: -300, behavior: 'smooth' });
    }
  }, []);

  const scrollRight = useCallback(() => {
    const container = tabsContainerRef.current;
    if (container) {
      // Scroll by a larger amount to go beyond the fade area
      container.scrollBy({ left: 300, behavior: 'smooth' });
    }
  }, []);

  // Update scroll position when chats change or component mounts
  useEffect(() => {
    checkScrollPosition();
    const container = tabsContainerRef.current;
    if (container) {
      container.addEventListener('scroll', checkScrollPosition);
      return () => container.removeEventListener('scroll', checkScrollPosition);
    }
  }, [checkScrollPosition, chatSessions.length]);

  return (
    <div className={`${isCollapsed ? 'w-12' : 'w-full'} bg-transparent flex flex-col transition-all duration-300 h-full min-h-0 overflow-hidden relative z-10`}>
      {!isCollapsed ? (
        <>
          {/* Header - Single Row with Tabs and Buttons */}
          <div className="border-b border-editor-border-tertiary bg-editor-bg-glass-secondary backdrop-blur-xl px-3 sm:px-4 py-px flex items-center gap-2 relative min-w-0">
            <div className="absolute inset-0 bg-gradient-to-br from-white/3 to-transparent opacity-100 pointer-events-none"></div>
              {/* Left Scroll Button */}
              <div className={`transition-all duration-200 flex-shrink-0 relative z-10 ${canScrollLeft ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
                <button
                  onClick={scrollLeft}
                  className="group w-6 h-6 flex items-center justify-center text-editor-text-tertiary hover:text-editor-text-primary bg-editor-bg-glass-tertiary backdrop-blur-xl border border-editor-border-tertiary hover:bg-editor-interactive-hover hover:border-editor-border-secondary transition-all duration-300 rounded-lg focus:outline-none shadow-[0_2px_8px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.1)] relative overflow-hidden"
                  title="Scroll left"
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-lg"></div>
                  <ChevronLeft className="w-3 h-3 relative z-10" />
                </button>
              </div>
              
              {/* Chat Tabs Container with Fade Effects */}
              <div className="flex-1 relative min-w-0 z-10">
                {/* Left Fade - Overlay that masks content scrolled out of view */}
                <div className={`absolute left-0 top-0 bottom-0 w-4 bg-gradient-to-r from-editor-bg-glass-secondary via-editor-bg-glass-secondary/80 to-transparent z-20 pointer-events-none transition-opacity duration-300 ${showLeftFade ? 'opacity-100' : 'opacity-0'}`} />
                
                {/* Right Fade - Overlay that masks content scrolled out of view */}
                <div className={`absolute right-0 top-0 bottom-0 w-4 bg-gradient-to-l from-editor-bg-glass-secondary via-editor-bg-glass-secondary/80 to-transparent z-20 pointer-events-none transition-opacity duration-300 ${showRightFade ? 'opacity-100' : 'opacity-0'}`} />
                
                {/* Tabs */}
                <div 
                  ref={tabsContainerRef}
                  className="flex items-center gap-1 overflow-x-auto hide-scrollbar px-4"
                >
                  {chatSessions.map((chat) => (
                    <button
                      key={chat.id}
                      onClick={() => setActiveChatId(chat.id)}
                      className={`group flex items-center gap-1.5 px-3 py-2 text-xs rounded-xl whitespace-nowrap transition-all duration-200 flex-shrink-0 focus:outline-none relative overflow-hidden ${
                        chat.id === activeChatId
                          ? "text-editor-text-primary bg-editor-interactive-active border border-editor-border-secondary shadow-[0_4px_12px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.2)]"
                          : "text-editor-text-tertiary hover:text-editor-text-primary bg-editor-bg-glass-tertiary backdrop-blur-xl border border-editor-border-tertiary hover:bg-editor-interactive-hover hover:border-editor-border-secondary hover:scale-105 shadow-[0_2px_8px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.1)]"
                      }`}
                      title={chat.name}
                    >
                      <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200 rounded-xl"></div>
                      <span className="flex-1 text-left relative z-10">
                        {chat.name}
                      </span>
                      {chatSessions.length > 1 && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            closeChat(chat.id);
                          }}
                          className="group/close w-4 h-4 flex items-center justify-center text-editor-text-muted hover:text-editor-text-primary bg-editor-bg-glass-secondary backdrop-blur-xl border border-editor-border-tertiary hover:bg-editor-interactive-hover hover:border-editor-border-secondary transition-all duration-200 rounded-lg focus:outline-none shadow-[0_1px_4px_rgba(0,0,0,0.1),inset_0_1px_0_rgba(255,255,255,0.1)] relative overflow-hidden"
                          title="Close chat"
                        >
                          <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover/close:opacity-100 transition-opacity duration-200 rounded-lg"></div>
                          <X className="w-2.5 h-2.5 relative z-10" />
                        </button>
                      )}
                    </button>
                  ))}
                </div>
              </div>
              
              {/* Right Scroll Button */}
              <div className={`transition-all duration-200 flex-shrink-0 relative z-10 ${canScrollRight ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
                <button
                  onClick={scrollRight}
                  className="group w-6 h-6 flex items-center justify-center text-editor-text-tertiary hover:text-editor-text-primary bg-editor-bg-glass-tertiary backdrop-blur-xl border border-editor-border-tertiary hover:bg-editor-interactive-hover hover:border-editor-border-secondary transition-all duration-300 rounded-lg focus:outline-none shadow-[0_2px_8px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.1)] relative overflow-hidden"
                  title="Scroll right"
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-lg"></div>
                  <ChevronRight className="w-3 h-3 relative z-10" />
                </button>
              </div>
              
              {/* Action Buttons - Fixed width to prevent overflow */}
              <div className="flex items-center gap-1 flex-shrink-0 w-24 relative z-10">
                <button
                  onClick={createNewChat}
                  className="group w-6 h-6 flex items-center justify-center text-editor-text-tertiary hover:text-editor-text-primary bg-editor-bg-glass-tertiary backdrop-blur-xl border border-editor-border-tertiary hover:bg-editor-interactive-hover hover:border-editor-border-secondary transition-all duration-300 rounded-lg focus:outline-none shadow-[0_2px_8px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.1)] relative overflow-hidden"
                  title="New Chat"
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-lg"></div>
                  <Plus className="w-3 h-3 relative z-10" />
                </button>
                <button className="group w-6 h-6 flex items-center justify-center text-editor-text-tertiary hover:text-editor-text-primary bg-editor-bg-glass-tertiary backdrop-blur-xl border border-editor-border-tertiary hover:bg-editor-interactive-hover hover:border-editor-border-secondary transition-all duration-300 rounded-lg focus:outline-none shadow-[0_2px_8px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.1)] relative overflow-hidden" title="History">
                  <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-lg"></div>
                  <History className="w-3 h-3 relative z-10" />
                </button>
                <button className="group w-6 h-6 flex items-center justify-center text-editor-text-tertiary hover:text-editor-text-primary bg-editor-bg-glass-tertiary backdrop-blur-xl border border-editor-border-tertiary hover:bg-editor-interactive-hover hover:border-editor-border-secondary transition-all duration-300 rounded-lg focus:outline-none shadow-[0_2px_8px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.1)] relative overflow-hidden" title="More Options">
                  <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-lg"></div>
                  <MoreHorizontal className="w-3 h-3 relative z-10" />
                </button>
                <button className="group w-6 h-6 flex items-center justify-center text-editor-text-tertiary hover:text-editor-text-primary bg-editor-bg-glass-tertiary backdrop-blur-xl border border-editor-border-tertiary hover:bg-editor-interactive-hover hover:border-editor-border-secondary transition-all duration-300 rounded-lg focus:outline-none shadow-[0_2px_8px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.1)] relative overflow-hidden" title="Close">
                  <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-lg"></div>
                  <X className="w-3 h-3 relative z-10" />
                </button>
              </div>
          </div>
          
          {/* Chat Content */}
          <div className="flex-1 overflow-hidden flex flex-col bg-editor-bg-canvas relative z-10 min-h-0">
            <Chat
              chatId={activeChat.id}
              messages={activeChat.messages}
              onUpdateMessages={(messages) => updateChatMessages(activeChat.id, messages)}
              onExecuteCommand={onExecuteCommand}
              previewCuts={previewCuts}
              acceptedCuts={acceptedCuts}
              previewUrl={previewUrl}
              onAcceptPlan={onAcceptPlan}
              onRejectPlan={onRejectPlan}
              agentContext={agentContext}
            />
          </div>
        </>
      ) : (
        <div className="flex items-center justify-center h-full">
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-700 transition-colors rounded-lg border-0 p-0"
            title="Expand sidebar"
          >
            <X className="w-4 h-4 flex-shrink-0" />
          </button>
        </div>
      )}
    </div>
  );
}
