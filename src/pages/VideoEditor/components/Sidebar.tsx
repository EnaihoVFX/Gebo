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
import type { Range, ChatSession, ChatMessage } from "../../../types";

interface SidebarProps {
  debug: string;
  filePath: string;
  previewUrl: string;
  probe: any;
  peaks: number[];
  acceptedCuts: Range[];
  previewCuts: Range[];
  onExecuteCommand: (command: string) => void;
  onAcceptPlan: () => void;
  onRejectPlan: () => void;
}

export function Sidebar({
  debug,
  filePath,
  previewUrl,
  probe,
  peaks,
  acceptedCuts,
  previewCuts,
  onExecuteCommand,
  onAcceptPlan,
  onRejectPlan,
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
        const userMessages = messages.filter(msg => msg.type === "user");
        if (userMessages.length === 1 && chat.name.startsWith("Chat ")) {
          const firstMessage = userMessages[0].content;
          // Create a short name from the first few words of the message
          const shortName = firstMessage.length > 20 
            ? firstMessage.substring(0, 20) + "..." 
            : firstMessage;
          updatedChat.name = shortName;
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
    
    // Always show fades when there's overflow, regardless of scroll position
    setShowLeftFade(hasOverflow);
    setShowRightFade(hasOverflow);
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
    <div className={`${isCollapsed ? 'w-12' : 'w-full'} bg-slate-800 rounded-lg flex flex-col transition-all duration-300 h-full min-h-0 overflow-hidden`}>
      {!isCollapsed ? (
        <>
          {/* Header - Single Row with Tabs and Buttons */}
          <div className="border-b border-slate-700 bg-slate-800 px-3 sm:px-4 py-1 sm:py-1.5 flex items-center gap-2 relative min-w-0">
              {/* Left Scroll Button */}
              <div className={`transition-all duration-200 flex-shrink-0 ${canScrollLeft ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
                <button
                  onClick={scrollLeft}
                  className="w-6 h-6 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-700 transition-colors rounded focus:outline-none"
                  title="Scroll left"
                >
                  <ChevronLeft className="w-3 h-3" />
                </button>
              </div>
              
              {/* Chat Tabs Container with Fade Effects */}
              <div className="flex-1 relative min-w-0">
                {/* Left Fade - Always visible when there's overflow */}
                <div className={`absolute left-0 top-0 bottom-0 w-6 bg-gradient-to-r from-slate-800 via-slate-800/80 to-transparent z-10 pointer-events-none transition-opacity duration-300 ${showLeftFade ? 'opacity-100' : 'opacity-0'}`} />
                
                {/* Right Fade - Always visible when there's overflow */}
                <div className={`absolute right-0 top-0 bottom-0 w-6 bg-gradient-to-l from-slate-800 via-slate-800/80 to-transparent z-10 pointer-events-none transition-opacity duration-300 ${showRightFade ? 'opacity-100' : 'opacity-0'}`} />
                
                {/* Tabs */}
                <div 
                  ref={tabsContainerRef}
                  className="flex items-center gap-1 overflow-x-auto hide-scrollbar px-6"
                >
                  {chatSessions.map((chat) => (
                    <button
                      key={chat.id}
                      onClick={() => setActiveChatId(chat.id)}
                      className={`flex items-center gap-1 px-2 py-1 text-xs rounded whitespace-nowrap transition-all duration-200 flex-shrink-0 focus:outline-none ${
                        chat.id === activeChatId
                          ? "bg-slate-600 text-white"
                          : "text-slate-300 hover:text-white bg-transparent"
                      }`}
                      title={chat.name}
                    >
                      <span className="flex-1 text-left">
                        {chat.name}
                      </span>
                      {chatSessions.length > 1 && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            closeChat(chat.id);
                          }}
                          className="w-3 h-3 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-500 rounded transition-colors focus:outline-none"
                          title="Close chat"
                        >
                          <X className="w-2 h-2" />
                        </button>
                      )}
                    </button>
                  ))}
                </div>
              </div>
              
              {/* Right Scroll Button */}
              <div className={`transition-all duration-200 flex-shrink-0 ${canScrollRight ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
                <button
                  onClick={scrollRight}
                  className="w-6 h-6 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-700 transition-colors rounded focus:outline-none"
                  title="Scroll right"
                >
                  <ChevronRight className="w-3 h-3" />
                </button>
              </div>
              
              {/* Action Buttons - Fixed width to prevent overflow */}
              <div className="flex items-center gap-1 flex-shrink-0 w-24">
                <button
                  onClick={createNewChat}
                  className="w-6 h-6 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-700 transition-colors rounded focus:outline-none"
                  title="New Chat"
                >
                  <Plus className="w-3 h-3" />
                </button>
                <button className="w-6 h-6 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-700 transition-colors rounded focus:outline-none" title="History">
                  <History className="w-3 h-3" />
                </button>
                <button className="w-6 h-6 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-700 transition-colors rounded focus:outline-none" title="More Options">
                  <MoreHorizontal className="w-3 h-3" />
                </button>
                <button className="w-6 h-6 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-700 transition-colors rounded focus:outline-none" title="Close">
                  <X className="w-3 h-3" />
                </button>
              </div>
          </div>
          
          {/* Chat Content */}
          <div className="flex-1 overflow-hidden flex flex-col bg-slate-900 pt-0.5">
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
