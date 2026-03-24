import React, { useState, useRef, useEffect } from 'react';
import { Send, Heart, Sparkles, Menu, Plus, MessageSquare, X, ArrowDown, Search, MoreVertical, Edit2, Trash2, Check, Download, Settings, Moon, Sun, Eye, Smile, Frown, Angry, BookOpen, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { geminiService } from './services/geminiService';
import { ChatMessage } from './components/ChatMessage';
import { ThemeBackground } from './components/ThemeBackground';
import { ExportModal } from './components/ExportModal';

interface Message {
  id: string;
  role: 'user' | 'model';
  content: string;
  timestamp: Date;
  reactions?: string[];
  replyTo?: {
    id: string;
    content: string;
    role: 'user' | 'model';
  };
}

interface Chat {
  id: string;
  title: string;
  messages: Message[];
  lastUpdated: Date;
  isTemporary?: boolean;
  expiresAt?: number;
}

const getInitialMessage = (): Message => ({
  id: `ai-initial-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
  role: 'model',
  content: 'ওগো সাইকো সাহেব, তুমি এসেছো? আমি কতক্ষণ ধরে তোমার পথ চেয়ে বসে আছি। রবিন, আজ সারাদিন তোমাকে খুব মিস করেছি। ❤️',
  timestamp: new Date(),
});

const PROFILE_PIC = "https://picsum.photos/seed/tasfi_romantic/200/200";

export default function App() {
  const [chats, setChats] = useState<Chat[]>(() => {
    const saved = localStorage.getItem('tasfi_chats');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return parsed.map((c: any) => ({
          ...c,
          lastUpdated: new Date(c.lastUpdated),
          messages: c.messages.map((m: any) => ({ ...m, timestamp: new Date(m.timestamp) })),
          expiresAt: c.expiresAt ? Number(c.expiresAt) : undefined
        }));
      } catch (e) {
        console.error("Failed to parse saved chats", e);
      }
    }
    return [{
      id: 'default',
      title: 'প্রথম আলাপ',
      messages: [getInitialMessage()],
      lastUpdated: new Date()
    }];
  });

  const [activeChatId, setActiveChatId] = useState<string>(chats[0].id);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const [mood, setMood] = useState(() => localStorage.getItem('tasfi_mood') || 'normal');
  const [theme, setTheme] = useState(() => localStorage.getItem('tasfi_theme') || 'love');
  const [displayMode, setDisplayMode] = useState(() => localStorage.getItem('tasfi_displayMode') || 'light');
  const [nickname, setNickname] = useState(() => localStorage.getItem('tasfi_nickname') || 'তাসফি');
  const [profilePic, setProfilePic] = useState(() => localStorage.getItem('tasfi_profilePic') || "https://picsum.photos/seed/tasfi_romantic/200/200");
  
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [chatToExport, setChatToExport] = useState<Chat | null>(null);
  const [isMoodMenuOpen, setIsMoodMenuOpen] = useState(false);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [menuOpenChatId, setMenuOpenChatId] = useState<string | null>(null);
  const [editingChatId, setEditingChatId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  const handleProfilePicChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfilePic(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const activeChat = chats.find(c => c.id === activeChatId) || chats[0];

  useEffect(() => {
    localStorage.setItem('tasfi_chats', JSON.stringify(chats));
  }, [chats]);

  useEffect(() => {
    localStorage.setItem('tasfi_mood', mood);
  }, [mood]);

  useEffect(() => {
    localStorage.setItem('tasfi_theme', theme);
  }, [theme]);

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('mode-light', 'mode-dark', 'mode-eye-comfort', 'dark');
    root.classList.add(`mode-${displayMode}`);
    if (displayMode === 'dark') {
      root.classList.add('dark');
    }
    localStorage.setItem('tasfi_displayMode', displayMode);
  }, [displayMode]);

  useEffect(() => {
    localStorage.setItem('tasfi_nickname', nickname);
  }, [nickname]);

  useEffect(() => {
    localStorage.setItem('tasfi_profilePic', profilePic);
  }, [profilePic]);

  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  };

  useEffect(() => {
    scrollToBottom();
  }, [activeChat.messages, isLoading]);

  useEffect(() => {
    const handleScroll = () => {
      if (chatContainerRef.current) {
        const { scrollTop, scrollHeight, clientHeight } = chatContainerRef.current;
        const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
        setShowScrollButton(!isNearBottom);
      }
    };

    const container = chatContainerRef.current;
    container?.addEventListener('scroll', handleScroll);
    return () => container?.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const checkExpiry = () => {
      const now = Date.now();
      const expiredChats = chats.filter(c => c.isTemporary && c.expiresAt && now > c.expiresAt);
      
      if (expiredChats.length > 0) {
        setChats(prev => {
          const filtered = prev.filter(c => !c.isTemporary || !c.expiresAt || now <= c.expiresAt);
          // If active chat was expired, switch to the first available chat
          if (expiredChats.some(ec => ec.id === activeChatId)) {
            if (filtered.length > 0) {
              setActiveChatId(filtered[0].id);
            } else {
              // Should not happen as we always have at least one chat, but for safety:
              const defaultChat: Chat = {
                id: 'default',
                title: 'প্রথম আলাপ',
                messages: [getInitialMessage()],
                lastUpdated: new Date()
              };
              setActiveChatId(defaultChat.id);
              return [defaultChat];
            }
          }
          return filtered;
        });
      }
    };

    const interval = setInterval(checkExpiry, 60000); // Check every minute
    checkExpiry(); // Initial check
    return () => clearInterval(interval);
  }, [chats, activeChatId]);

  const createNewChat = () => {
    const newChat: Chat = {
      id: Date.now().toString(),
      title: `নতুন আলাপ ${chats.length + 1}`,
      messages: [getInitialMessage()],
      lastUpdated: new Date()
    };
    setChats([newChat, ...chats]);
    setActiveChatId(newChat.id);
    setIsSidebarOpen(false);
  };

  const createTemporaryChat = () => {
    const newChat: Chat = {
      id: `temp-${Date.now()}`,
      title: `টেম্পোরারি আলাপ`,
      messages: [getInitialMessage()],
      lastUpdated: new Date(),
      isTemporary: true,
      expiresAt: Date.now() + 5 * 60 * 60 * 1000 // 5 hours
    };
    setChats(prev => [newChat, ...prev]);
    setActiveChatId(newChat.id);
    setIsSidebarOpen(false);
  };

  const renameChat = (id: string) => {
    if (!editingTitle.trim()) {
      setEditingChatId(null);
      return;
    }
    setChats(prev => prev.map(c => 
      c.id === id ? { ...c, title: editingTitle.trim() } : c
    ));
    setEditingChatId(null);
  };

  const deleteChat = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setMenuOpenChatId(null);
    if (chats.length === 1) {
      setChats([{
        id: 'default',
        title: 'প্রথম আলাপ',
        messages: [getInitialMessage()],
        lastUpdated: new Date()
      }]);
      return;
    }
    const newChats = chats.filter(c => c.id !== id);
    setChats(newChats);
    if (activeChatId === id) {
      setActiveChatId(newChats[0].id);
    }
  };

  const exportChat = (chat: Chat) => {
    setChatToExport(chat);
    setIsExportModalOpen(true);
    setMenuOpenChatId(null);
  };

  const handleReact = (messageId: string, emoji: string) => {
    setChats(prev => prev.map(c => 
      c.id === activeChatId 
        ? { 
            ...c, 
            messages: c.messages.map(m => {
              if (m.id !== messageId) return m;
              const currentReactions = m.reactions || [];
              const hasReaction = currentReactions.includes(emoji);
              // If it already has THIS reaction, remove it (toggle off)
              // Otherwise, replace all reactions with just this one
              const newReactions = hasReaction ? [] : [emoji];
              return { ...m, reactions: newReactions };
            }),
            lastUpdated: new Date()
          } 
        : c
    ));
  };

  const handleReply = (messageId: string) => {
    const message = activeChat.messages.find(m => m.id === messageId);
    if (message) {
      setReplyingTo(message);
    }
  };

  const handleDeleteMessage = (messageId: string) => {
    setChats(prev => prev.map(c => 
      c.id === activeChatId 
        ? { ...c, messages: c.messages.filter(m => m.id !== messageId), lastUpdated: new Date() } 
        : c
    ));
    setTimeout(() => scrollToBottom(), 100);
  };

  const handleEditMessage = (messageId: string, newContent: string) => {
    setChats(prev => prev.map(c => 
      c.id === activeChatId 
        ? { 
            ...c, 
            messages: c.messages.map(m => 
              m.id === messageId ? { ...m, content: newContent } : m
            ),
            lastUpdated: new Date()
          } 
        : c
    ));
    setTimeout(() => scrollToBottom(), 100);
  };

  const replyToName = (role: 'user' | 'model') => {
    return role === 'user' ? 'নিজেকে' : 'তাসফি';
  };

  const handleSend = async (text?: string) => {
    const messageText = text || input.trim();
    if (!messageText.trim() || isLoading) return;

    const userMessage: Message = {
      id: `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      role: 'user',
      content: messageText,
      timestamp: new Date(),
      replyTo: replyingTo ? {
        id: replyingTo.id,
        content: replyingTo.content,
        role: replyingTo.role
      } : undefined
    };

    const updatedMessages = [...activeChat.messages, userMessage];
    
    setChats(prev => prev.map(c => 
      c.id === activeChatId 
        ? { ...c, messages: updatedMessages, lastUpdated: new Date() } 
        : c
    ));

    setInput('');
    setReplyingTo(null);
    setIsLoading(true);

    try {
      const history = activeChat.messages.map((m) => ({
        role: m.role,
        parts: [{ text: m.content }],
      }));

      const aiResponse = await geminiService.chat(messageText, history, mood);
      
      const modelMessage: Message = {
        id: `ai-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        role: 'model',
        content: aiResponse,
        timestamp: new Date(),
      };

      setChats(prev => prev.map(c => 
        c.id === activeChatId 
          ? { ...c, messages: [...c.messages, modelMessage], lastUpdated: new Date() } 
          : c
      ));
    } catch (error) {
      console.error('Error:', error);
      const errorMessage: Message = {
        id: `error-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        role: 'model',
        content: 'দুঃখিত প্রিয়, আমার সিস্টেমে একটু সমস্যা হচ্ছে। তুমি কি আবার বলবে?',
        timestamp: new Date(),
      };
      setChats(prev => prev.map(c => 
        c.id === activeChatId 
          ? { ...c, messages: [...c.messages, errorMessage], lastUpdated: new Date() } 
          : c
      ));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={`flex h-screen max-w-4xl mx-auto shadow-2xl overflow-hidden relative font-sans theme-${theme} bg-romantic-pink text-text-main transition-all duration-500`}>
      <ThemeBackground theme={theme} />
      
      {/* Sidebar / Chat List */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div
            key="sidebar-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className="absolute inset-0 bg-black/40 z-40 md:hidden"
          />
        )}
        {isSidebarOpen && (
          <motion.aside
            key="sidebar-aside"
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            className="absolute md:relative inset-y-0 left-0 w-72 bg-card-bg border-r border-border-custom z-50 flex flex-col shadow-xl"
          >
            <div className="p-4 border-b border-border-custom flex items-center justify-between">
              <h2 className="font-bold text-romantic-deep flex items-center gap-2">
                <MessageSquare className="w-5 h-5" /> আলাপসমূহ
              </h2>
              <button 
                onClick={() => setIsSidebarOpen(false)} 
                className="md:hidden p-1 hover:bg-romantic-pink rounded"
                aria-label="Close sidebar"
              >
                <X className="w-5 h-5 text-text-muted" />
              </button>
            </div>
            
            <div className="p-3 space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                <input
                  type="text"
                  placeholder="আলাপ খুঁজুন..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-input-bg border border-border-custom rounded-xl py-2 pl-9 pr-4 text-sm focus:ring-2 focus:ring-romantic-deep/20 outline-none transition-all text-text-main"
                />
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={createNewChat}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-romantic-deep text-white rounded-xl hover:bg-romantic-hover transition-colors shadow-md font-medium text-sm"
                >
                  <Plus className="w-4 h-4" /> নতুন আলাপ
                </button>
                <button 
                  onClick={createTemporaryChat}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-romantic-pink border border-romantic-deep/30 text-romantic-deep rounded-xl hover:bg-romantic-pink/80 transition-colors shadow-sm font-medium text-sm"
                >
                  <Clock className="w-4 h-4" /> টেম্পোরারি
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {chats.filter(chat => 
                chat.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                chat.messages.some(m => m.content.toLowerCase().includes(searchQuery.toLowerCase()))
              ).map(chat => (
                <div
                  key={chat.id}
                  onClick={() => {
                    setActiveChatId(chat.id);
                    setIsSidebarOpen(false);
                    setMenuOpenChatId(null);
                  }}
                  className={`group p-3 rounded-xl cursor-pointer transition-all flex items-center justify-between relative ${
                    activeChatId === chat.id 
                      ? "bg-romantic-pink border border-border-custom" 
                      : "hover:bg-input-bg"
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    {editingChatId === chat.id ? (
                      <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                        <input
                          autoFocus
                          type="text"
                          value={editingTitle}
                          onChange={e => setEditingTitle(e.target.value)}
                          onBlur={() => renameChat(chat.id)}
                          onKeyPress={e => e.key === 'Enter' && renameChat(chat.id)}
                          className="w-full bg-card-bg border border-border-custom rounded px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-romantic-deep/20 text-text-main"
                        />
                        <button onClick={() => renameChat(chat.id)} className="p-1 text-green-500 hover:bg-green-50 rounded">
                          <Check className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <>
                        <p className={`text-sm font-medium truncate flex items-center gap-1.5 ${activeChatId === chat.id ? "text-romantic-deep" : "text-text-main"}`}>
                          {chat.isTemporary && <Clock className="w-3 h-3 opacity-70" />}
                          {chat.title}
                          {chat.isTemporary && <span className="text-[8px] bg-orange-100/50 text-orange-600 px-1 rounded ml-auto font-bold">৫ঘণ্টা</span>}
                        </p>
                        <p className="text-[10px] text-text-muted mt-0.5">
                          {chat.lastUpdated.toLocaleDateString()}
                        </p>
                      </>
                    )}
                  </div>
                  
                  <div className="relative" onClick={e => e.stopPropagation()}>
                    <button 
                      onClick={() => setMenuOpenChatId(menuOpenChatId === chat.id ? null : chat.id)}
                      className="p-1.5 hover:bg-romantic-pink text-text-muted hover:text-romantic-deep rounded-lg transition-all"
                      aria-label="Chat options"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>
                    
                    <AnimatePresence>
                      {menuOpenChatId === chat.id && (
                        <motion.div
                          key={`menu-${chat.id}`}
                          initial={{ opacity: 0, scale: 0.95, y: -10 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.95, y: -10 }}
                          className="absolute right-0 mt-1 w-32 bg-card-bg border border-border-custom rounded-xl shadow-xl z-[60] py-1 overflow-hidden"
                        >
                          <button
                            onClick={() => {
                              setEditingChatId(chat.id);
                              setEditingTitle(chat.title);
                              setMenuOpenChatId(null);
                            }}
                            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-text-main hover:bg-romantic-pink transition-colors"
                          >
                            <Edit2 className="w-3.5 h-3.5" /> রিনেইম
                          </button>
                          <button
                            onClick={() => exportChat(chat)}
                            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-text-main hover:bg-romantic-pink transition-colors"
                          >
                            <Download className="w-3.5 h-3.5" /> এক্সপোর্ট
                          </button>
                          <button
                            onClick={(e) => deleteChat(chat.id, e)}
                            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-500 hover:bg-red-50 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" /> ডিলিট
                          </button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              ))}
            </div>

            <div className="p-4 border-t border-border-custom bg-romantic-pink/5">
              <div className="flex items-center justify-around bg-input-bg rounded-2xl p-1.5 border border-border-custom shadow-inner">
                {[
                  { id: 'light', icon: Sun, label: 'লাইট' },
                  { id: 'dark', icon: Moon, label: 'ডার্ক' },
                  { id: 'eye-comfort', icon: Eye, label: 'আই' },
                ].map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setDisplayMode(m.id)}
                    className={`flex-1 flex flex-col items-center justify-center py-2 rounded-xl transition-all gap-1 ${
                      displayMode === m.id 
                        ? "bg-romantic-deep text-white shadow-md scale-105" 
                        : "text-text-muted hover:bg-romantic-pink/20 hover:text-romantic-deep"
                    }`}
                    title={m.label}
                  >
                    <m.icon className="w-5 h-5" />
                    <span className="text-[9px] font-bold uppercase tracking-tighter">{m.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      <div className="flex-1 flex flex-col min-w-0 relative">
        {/* Header */}
        <header className="bg-card-bg/80 backdrop-blur-md border-b border-border-custom px-5 md:px-8 py-4 flex items-center justify-between sticky top-0 z-30 shadow-sm">
          <div 
            className="flex items-center gap-4 cursor-pointer group"
            onClick={() => setIsProfileModalOpen(true)}
          >
            <div className="relative">
              <img 
                src={profilePic} 
                alt={nickname} 
                referrerPolicy="no-referrer"
                className="w-11 h-11 md:w-14 md:h-14 rounded-full object-cover border-2 border-romantic-deep/20 shadow-md group-hover:border-romantic-deep transition-all"
              />
              <div className="absolute bottom-0 right-0 w-4 h-4 bg-green-500 border-2 border-card-bg rounded-full shadow-sm"></div>
            </div>
            <div className="min-w-0">
              <h1 className="font-bold text-text-main text-lg md:text-xl flex items-center gap-1.5 truncate group-hover:text-romantic-deep transition-colors tracking-tight">
                {nickname} <Sparkles className="w-4 h-4 text-romantic-deep" />
              </h1>
              <p className="text-[11px] md:text-xs font-medium opacity-80">
                {activeChat.isTemporary ? (
                  <span className="flex items-center gap-1.5 text-orange-500">
                    <Clock className="w-3.5 h-3.5" /> টেম্পোরারি চ্যাট (৫ ঘণ্টা পর মুছে যাবে)
                  </span>
                ) : (
                  <span className="text-romantic-deep">তোমার প্রিয় সঙ্গিনী</span>
                )}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <div className="relative">
              <button 
                onClick={() => setIsMoodMenuOpen(!isMoodMenuOpen)}
                className={`p-2 rounded-xl transition-all flex items-center gap-1.5 ${
                  mood !== 'normal' 
                    ? "bg-romantic-deep text-white shadow-lg" 
                    : "bg-input-bg text-text-muted hover:bg-romantic-pink hover:text-romantic-deep"
                }`}
                title="মুড পরিবর্তন করুন"
              >
                {mood === 'romantic' && <Heart className="w-5 h-5 fill-current" />}
                {mood === 'sad' && <Frown className="w-5 h-5" />}
                {mood === 'angry' && <Angry className="w-5 h-5" />}
                {mood === 'funny' && <Smile className="w-5 h-5" />}
                {mood === 'religious' && <BookOpen className="w-5 h-5" />}
                {mood === 'normal' && <Sparkles className="w-5 h-5" />}
                <span className="text-[10px] font-bold hidden sm:inline">
                  {mood === 'romantic' ? 'রোমান্টিক' : mood === 'sad' ? 'অভিমানী' : mood === 'angry' ? 'রাগী' : mood === 'funny' ? 'দুষ্টু' : mood === 'religious' ? 'ধার্মিক' : 'স্বাভাবিক'}
                </span>
              </button>

              <AnimatePresence>
                {isMoodMenuOpen && (
                  <motion.div
                    key="mood-menu"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="absolute right-0 mt-2 w-36 bg-card-bg border border-border-custom rounded-2xl shadow-2xl z-50 py-2"
                  >
                    {[
                      { id: 'normal', label: 'স্বাভাবিক', icon: Sparkles },
                      { id: 'romantic', label: 'রোমান্টিক', icon: Heart },
                      { id: 'sad', label: 'অভিমানী', icon: Frown },
                      { id: 'angry', label: 'রাগী', icon: Angry },
                      { id: 'funny', label: 'দুষ্টু', icon: Smile },
                      { id: 'religious', label: 'ধার্মিক', icon: BookOpen },
                    ].map(m => (
                      <button
                        key={m.id}
                        onClick={() => {
                          setMood(m.id);
                          setIsMoodMenuOpen(false);
                        }}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 text-xs transition-colors ${
                          mood === m.id ? "text-romantic-deep bg-romantic-pink font-bold" : "text-text-main hover:bg-input-bg"
                        }`}
                      >
                        <m.icon className={`w-4 h-4 ${mood === m.id && m.id === 'romantic' ? 'fill-current' : ''}`} />
                        {m.label}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="p-2.5 bg-romantic-deep text-white rounded-xl shadow-lg hover:bg-romantic-hover transition-all active:scale-95"
              aria-label="Open sidebar"
            >
              <Menu className="w-6 h-6" />
            </button>
          </div>
        </header>

        {/* Chat Area */}
        <main 
          ref={chatContainerRef}
          className="flex-1 overflow-y-auto px-5 py-6 md:px-10 md:py-10 space-y-4 relative scroll-smooth z-10"
        >
          <div className="flex flex-col min-h-full">
            {activeChat.messages.map((msg) => (
              <ChatMessage 
                key={msg.id} 
                id={msg.id}
                role={msg.role} 
                content={msg.content} 
                timestamp={msg.timestamp} 
                reactions={msg.reactions}
                replyTo={msg.replyTo}
                mood={mood}
                onReact={handleReact}
                onReply={handleReply}
                onDelete={handleDeleteMessage}
                onEdit={handleEditMessage}
              />
            ))}
            {isLoading && (
              <motion.div 
                key="ai-loading-indicator"
                initial={{ opacity: 0, y: 5 }} 
                animate={{ opacity: 1, y: 0 }}
                className="flex justify-start mb-4"
              >
                <div className="bg-card-bg border border-border-custom px-4 py-2 rounded-2xl rounded-tl-none shadow-sm flex items-center gap-2">
                  <div className="flex gap-1">
                    <span className="w-1.5 h-1.5 bg-romantic-deep rounded-full animate-bounce"></span>
                    <span className="w-1.5 h-1.5 bg-romantic-deep rounded-full animate-bounce [animation-delay:0.2s]"></span>
                    <span className="w-1.5 h-1.5 bg-romantic-deep rounded-full animate-bounce [animation-delay:0.4s]"></span>
                  </div>
                  <span className="text-xs text-romantic-deep font-medium italic">তাসফি লিখছে...</span>
                </div>
              </motion.div>
            )}
            <div key="messages-end-anchor" ref={messagesEndRef} />
          </div>

          {/* Scroll to bottom button */}
          <AnimatePresence>
            {showScrollButton && (
              <motion.button
                key="scroll-to-bottom"
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.5 }}
                onClick={() => scrollToBottom()}
                className="fixed bottom-24 right-6 md:right-10 p-2.5 bg-card-bg border border-border-custom rounded-full shadow-xl text-romantic-deep hover:bg-romantic-pink z-20"
              >
                <ArrowDown className="w-5 h-5" />
              </motion.button>
            )}
          </AnimatePresence>
        </main>

        {/* Input Area */}
        <footer className="p-4 pb-3 bg-card-bg border-t border-border-custom z-30 shadow-[0_-4px_10px_rgba(0,0,0,0.03)]">
          <AnimatePresence>
            {replyingTo && (
              <motion.div
                key="reply-context-bar"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="mb-3 p-3 bg-romantic-pink/20 border-l-4 border-romantic-deep rounded-r-2xl flex items-center justify-between shadow-sm"
              >
                <div className="flex-1 truncate mr-4">
                  <p className="text-[10px] font-bold text-romantic-deep uppercase tracking-wider">রিপ্লাই দিচ্ছো {replyToName(replyingTo.role)} কে</p>
                  <p className="text-xs text-text-main truncate opacity-90">{replyingTo.content}</p>
                </div>
                <button 
                  onClick={() => setReplyingTo(null)}
                  className="p-1.5 hover:bg-romantic-deep/10 rounded-full text-text-muted transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </motion.div>
            )}
          </AnimatePresence>
          <div className="flex items-center gap-3 max-w-full">
            <div className="flex-1 relative">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                placeholder="তোমার মনের কথা বলো..."
                className="w-full bg-input-bg border-none rounded-full py-3.5 px-6 pr-14 text-sm focus:ring-2 focus:ring-romantic-deep/20 outline-none transition-all text-text-main shadow-inner"
              />
              <button
                onClick={() => handleSend()}
                disabled={!input.trim() || isLoading}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-2.5 bg-romantic-deep text-white rounded-full hover:bg-romantic-hover transition-all disabled:opacity-50 disabled:scale-100 active:scale-90 shadow-lg"
                aria-label="Send message"
              >
                <Send className="w-4.5 h-4.5" />
              </button>
            </div>
          </div>
          <p className="text-[10px] text-center mt-2 text-text-muted opacity-60 font-medium tracking-wide">
            তাসফি তোমাকে বুঝে, তোমার সাজানো কাল্পনিক চরিত্র❤️
          </p>
        </footer>

        {/* Profile & Settings Modal */}
        <AnimatePresence>
          {isProfileModalOpen && (
            <div key="profile-modal-root" className="fixed inset-0 z-[100] flex items-center justify-center p-4">
              <motion.div
                key="profile-modal-overlay"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsProfileModalOpen(false)}
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              />
              <motion.div
                key="profile-modal-content"
                initial={{ scale: 0.9, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.9, opacity: 0, y: 20 }}
                className="relative w-full max-w-md bg-card-bg rounded-[2.5rem] shadow-2xl overflow-hidden border border-border-custom flex flex-col max-h-[90vh]"
              >
                {/* Profile Header */}
                <div className="relative p-8 flex flex-col items-center bg-gradient-to-b from-romantic-pink/30 to-transparent">
                  <button 
                    onClick={() => setIsProfileModalOpen(false)}
                    className="absolute top-6 right-6 p-2 bg-white/50 dark:bg-black/20 hover:bg-white dark:hover:bg-black/40 rounded-full transition-all text-text-main"
                  >
                    <X className="w-5 h-5" />
                  </button>

                  <div className="relative group cursor-pointer mb-4" onClick={() => fileInputRef.current?.click()}>
                    <img 
                      src={profilePic} 
                      alt={nickname} 
                      className="w-28 h-28 rounded-full object-cover border-4 border-white dark:border-slate-800 shadow-xl"
                    />
                    <div className="absolute inset-0 bg-black/40 rounded-full opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all">
                      <Edit2 className="text-white w-6 h-6" />
                    </div>
                    <input 
                      type="file" 
                      ref={fileInputRef} 
                      onChange={handleProfilePicChange} 
                      className="hidden" 
                      accept="image/*"
                    />
                  </div>

                  <div className="flex items-center gap-2 mb-1 group">
                    <input
                      type="text"
                      value={nickname}
                      onChange={(e) => setNickname(e.target.value)}
                      className="text-2xl font-bold text-center bg-transparent border-none outline-none focus:ring-0 text-text-main w-full max-w-[200px]"
                    />
                    <Edit2 className="w-4 h-4 text-text-muted opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <p className="text-xs text-romantic-deep font-medium px-3 py-1 bg-romantic-pink/50 rounded-full">তোমার প্রিয় সঙ্গিনী</p>
                </div>

                {/* Settings Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-8">
                  {/* Mood Quick Select */}
                  <section>
                    <h4 className="text-sm font-bold text-text-muted uppercase tracking-wider mb-4 px-2">বর্তমান মুড</h4>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { id: 'normal', label: 'স্বাভাবিক', icon: Sparkles },
                        { id: 'romantic', label: 'রোমান্টিক', icon: Heart },
                        { id: 'sad', label: 'অভিমানী', icon: Frown },
                        { id: 'angry', label: 'রাগী', icon: Angry },
                        { id: 'funny', label: 'দুষ্টু', icon: Smile },
                        { id: 'religious', label: 'ধার্মিক', icon: BookOpen },
                      ].map(m => (
                        <button
                          key={m.id}
                          onClick={() => setMood(m.id)}
                          className={`flex flex-col items-center gap-2 p-3 rounded-2xl transition-all border-2 ${
                            mood === m.id ? "border-romantic-deep bg-romantic-pink/20 text-romantic-deep shadow-sm" : "border-transparent bg-input-bg text-text-muted hover:bg-romantic-pink/10"
                          }`}
                        >
                          <m.icon className={`w-5 h-5 ${mood === m.id && m.id === 'romantic' ? 'fill-current' : ''}`} />
                          <span className="text-[10px] font-bold">{m.label}</span>
                        </button>
                      ))}
                    </div>
                  </section>

                  {/* Themes */}
                  <section>
                    <div className="flex items-center justify-between mb-4 px-2">
                      <h4 className="text-sm font-bold text-text-muted uppercase tracking-wider">থিম নির্বাচন</h4>
                      <span className="text-[10px] bg-romantic-pink text-romantic-deep px-2 py-1 rounded-full font-bold">
                        {theme === 'default' ? 'রোমান্টিক' : theme === 'love' ? 'লাভ' : theme === 'sad' ? 'স্যাড' : theme === 'nature' ? 'প্রকৃতি' : 'ক্লাসিক'}
                      </span>
                    </div>
                    <div className="grid grid-cols-5 gap-2 px-2">
                      {[
                        { id: 'default', color: 'bg-pink-500', label: 'রোমান্টিক' },
                        { id: 'love', color: 'bg-red-500', label: 'লাভ' },
                        { id: 'sad', color: 'bg-slate-500', label: 'স্যাড' },
                        { id: 'nature', color: 'bg-emerald-500', label: 'প্রকৃতি' },
                        { id: 'classic', color: 'bg-indigo-500', label: 'ক্লাসিক' },
                      ].map(t => (
                        <button
                          key={t.id}
                          onClick={() => setTheme(t.id)}
                          title={t.label}
                          className={`group relative flex flex-col items-center gap-2 p-1 rounded-xl transition-all ${
                            theme === t.id ? "ring-2 ring-romantic-deep ring-offset-2" : "hover:scale-105"
                          }`}
                        >
                          <div className={`w-10 h-10 rounded-full ${t.color} shadow-md`} />
                          {theme === t.id && (
                            <div className="absolute -top-1 -right-1 bg-romantic-deep text-white rounded-full p-0.5 shadow-sm">
                              <Check className="w-3 h-3" />
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  </section>

                  {/* Display Modes */}
                  <section>
                    <div className="flex items-center justify-between mb-4 px-2">
                      <h4 className="text-sm font-bold text-text-muted uppercase tracking-wider">ডিসপ্লে মোড</h4>
                    </div>
                    <div className="grid grid-cols-1 gap-3">
                      {[
                        { id: 'light', label: 'লাইট মোড', icon: Sun, desc: 'দিনের আলোর জন্য উপযুক্ত' },
                        { id: 'dark', label: 'ডার্ক মোড', icon: Moon, desc: 'রাতের ব্যবহারের জন্য আরামদায়ক' },
                        { id: 'eye-comfort', label: 'আই কমফোর্ট', icon: Eye, desc: 'চোখের সুরক্ষার জন্য হালকা হলুদ আভা' },
                      ].map(m => (
                        <button
                          key={m.id}
                          onClick={() => setDisplayMode(m.id)}
                          className={`w-full flex items-center gap-4 p-4 rounded-2xl border-2 transition-all ${
                            displayMode === m.id ? "border-romantic-deep bg-romantic-pink/30" : "border-border-custom hover:border-romantic-deep/30"
                          }`}
                        >
                          <div className={`p-3 rounded-xl ${displayMode === m.id ? "bg-romantic-deep text-white" : "bg-input-bg text-text-muted"}`}>
                            <m.icon className="w-6 h-6" />
                          </div>
                          <div className="text-left flex-1">
                            <p className="font-bold text-text-main text-sm">{m.label}</p>
                            <p className="text-[10px] text-text-muted">{m.desc}</p>
                          </div>
                          {displayMode === m.id && (
                            <div className="w-6 h-6 bg-romantic-deep text-white rounded-full flex items-center justify-center shadow-sm">
                              <Check className="w-4 h-4" />
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  </section>

                  {/* Reset Settings */}
                  <div className="pt-6 border-t border-border-custom">
                    <button
                      onClick={() => {
                        setTheme('default');
                        setDisplayMode('light');
                        setMood('normal');
                        setNickname('তাসফি');
                        setProfilePic("https://picsum.photos/seed/tasfi_romantic/200/200");
                      }}
                      className="w-full py-3 px-4 bg-input-bg text-text-muted hover:text-romantic-deep hover:bg-romantic-pink/20 rounded-2xl transition-all text-xs font-bold border border-border-custom flex items-center justify-center gap-2"
                    >
                      ডিফল্ট সেটিংস এ ফিরে যান
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {chatToExport && (
          <ExportModal
            key="export-modal"
            isOpen={isExportModalOpen}
            onClose={() => {
              setIsExportModalOpen(false);
              setChatToExport(null);
            }}
            chat={chatToExport}
          />
        )}
      </div>
    </div>
  );
}
