import React, { useState, useRef, useEffect } from 'react';
import { toPng, toBlob } from 'html-to-image';
import {
  X,
  Download,
  Copy,
  Check,
  Smartphone,
  Sliders,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Edit2,
  Phone,
  Video,
  MoreVertical,
  ChevronLeft,
  Smile,
  Paperclip,
  Mic,
  Send,
  Wifi,
  Battery,
  Camera,
  ImageIcon,
  CheckCheck,
  Menu,
  MessageSquare,
} from 'lucide-react';
import Markdown from 'react-markdown';
import remarkBreaks from 'remark-breaks';

export interface ScreenshotMessage {
  id: string;
  sender: 'saheb' | 'tasfi';
  content: string;
  time: string;
  status?: 'sent' | 'delivered' | 'seen';
}

interface ScreenshotStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeChatTitle?: string;
  initialMessages?: Array<{
    id: string;
    role: 'user' | 'model';
    content: string;
    timestamp?: Date | string | number;
  }>;
  tasfiAvatar: string;
  tasfiName?: string;
  onUpdateTasfiAvatar?: (newUrl: string) => void;
}

// Automatic profile picture for Psycho Saheb
const DEFAULT_SAHEB_AVATAR = '/psychosaheb.png';

export const ScreenshotStudioModal: React.FC<ScreenshotStudioModalProps> = ({
  isOpen,
  onClose,
  initialMessages = [],
  tasfiAvatar,
  tasfiName = 'তাসফি',
}) => {
  // POV: 'saheb' = Psycho Saheb's phone, 'tasfi' = Tasfi's phone
  const [pov, setPov] = useState<'saheb' | 'tasfi'>('saheb');

  // Participants Information - Defaults to "সাইকো সাহেব" & "তাসফি"
  const [sahebName, setSahebName] = useState('সাইকো সাহেব');
  const [sahebSubtitle, setSahebSubtitle] = useState('বাস্তববাদী লেখক!');
  const [tasfiDisplayName, setTasfiDisplayName] = useState(tasfiName || 'তাসফি');
  const [tasfiSubtitle, setTasfiSubtitle] = useState('তোমার প্রিয় সঙ্গিনী!');
  const [tasfiPersonaBadge, setTasfiPersonaBadge] = useState('❤️ প্রিয়তমা');

  const [sahebAvatar, setSahebAvatar] = useState(() => {
    return localStorage.getItem('tasfi_saheb_avatar') || DEFAULT_SAHEB_AVATAR;
  });
  const [localTasfiAvatar, setLocalTasfiAvatar] = useState(tasfiAvatar);

  // Status Bar & Phone Elements
  const [showStatusBar, setShowStatusBar] = useState(true);
  const [showHeader, setShowHeader] = useState(true);
  const [showInputBar, setShowInputBar] = useState(true);
  const [inputDraftText, setInputDraftText] = useState('');
  const [currentTimeText, setCurrentTimeText] = useState(() => {
    const d = new Date();
    let hours = d.getHours();
    const minutes = d.getMinutes().toString().padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    return `${hours}:${minutes} ${ampm}`;
  });
  const [batteryLevel, setBatteryLevel] = useState('95');

  // Visual Styling - Default dynamically matching app theme
  const [frameTheme, setFrameTheme] = useState<'light' | 'dark'>(() => {
    if (typeof document !== 'undefined') {
      return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
    }
    return 'dark';
  });

  // Selected messages for screenshot
  const [messages, setMessages] = useState<ScreenshotMessage[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Editing / adding new message state
  const [editingMsgId, setEditingMsgId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');
  const [newMsgSender, setNewMsgSender] = useState<'saheb' | 'tasfi'>('saheb');
  const [newMsgText, setNewMsgText] = useState('');

  // UI status
  const [isExporting, setIsExporting] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const [activeTab, setActiveTab] = useState<'preview' | 'messages' | 'settings'>('preview');

  const previewRef = useRef<HTMLDivElement>(null);
  const sahebFileInputRef = useRef<HTMLInputElement>(null);
  const tasfiFileInputRef = useRef<HTMLInputElement>(null);

  // Initialize messages from chat history when opened
  useEffect(() => {
    if (!isOpen) return;

    if (initialMessages && initialMessages.length > 0) {
      const converted: ScreenshotMessage[] = initialMessages.map((m, idx) => {
        let timeStr = '১০:২৪ AM';
        if (m.timestamp) {
          try {
            const d = new Date(m.timestamp);
            let hours = d.getHours();
            const minutes = d.getMinutes().toString().padStart(2, '0');
            const ampm = hours >= 12 ? 'PM' : 'AM';
            hours = hours % 12 || 12;
            timeStr = `${hours}:${minutes} ${ampm}`;
          } catch {
            timeStr = '১০:২৪ AM';
          }
        }
        return {
          id: m.id || `msg-${idx}-${Date.now()}`,
          sender: m.role === 'user' ? 'saheb' : 'tasfi',
          content: m.content || '',
          time: timeStr,
          status: 'seen',
        };
      });

      setMessages(converted);
      // Select the last 5 messages by default for a clean Messenger-like conversation
      const defaultSelected = new Set(
        converted.slice(-5).map((m) => m.id)
      );
      setSelectedIds(defaultSelected);
    } else {
      // Default dialogue between Psycho Saheb & Tasfi if chat was empty
      const samples: ScreenshotMessage[] = [
        {
          id: 's1',
          sender: 'saheb',
          content: 'শুনছো তাসফি? আজকের আকাশটা একদম তোমার চোখের মতো নীল...',
          time: '১০:২২ AM',
          status: 'seen',
        },
        {
          id: 's2',
          sender: 'tasfi',
          content: 'উফ সাইকো সাহেব! সকাল সকাল এত কাব্য কোথা থেকে আসে বলো তো? ❤️🙈',
          time: '১০:২৩ AM',
          status: 'seen',
        },
        {
          id: 's3',
          sender: 'saheb',
          content: 'কাব্য না জান, এটা তো সত্যি। তুমি পাশে থাকলে প্রতিটা মুহূর্তই কবিতা।',
          time: '১০:২৪ AM',
          status: 'seen',
        },
        {
          id: 's4',
          sender: 'tasfi',
          content: 'তুমি এমন করে বললে আমি কিন্তু সারাদিন শুধু তোমার কথাই ভাবব... দুষ্টু একটা বর! 🥰',
          time: '১০:২৫ AM',
          status: 'seen',
        },
      ];
      setMessages(samples);
      setSelectedIds(new Set(samples.map((s) => s.id)));
    }
  }, [isOpen, initialMessages]);

  useEffect(() => {
    setLocalTasfiAvatar(tasfiAvatar);
  }, [tasfiAvatar]);

  if (!isOpen) return null;

  // Handlers for Avatar Uploads
  const handleSahebAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        setSahebAvatar(result);
        localStorage.setItem('tasfi_saheb_avatar', result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleTasfiAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        setLocalTasfiAvatar(result);
      };
      reader.readAsDataURL(file);
    }
  };

  // Selection toggle
  const toggleSelectMessage = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const selectAll = () => {
    setSelectedIds(new Set(messages.map((m) => m.id)));
  };

  const deselectAll = () => {
    setSelectedIds(new Set());
  };

  // Add new message
  const handleAddMessage = () => {
    if (!newMsgText.trim()) return;
    const newMsg: ScreenshotMessage = {
      id: `custom-${Date.now()}`,
      sender: newMsgSender,
      content: newMsgText.trim(),
      time: currentTimeText,
      status: 'seen',
    };
    setMessages((prev) => [...prev, newMsg]);
    setSelectedIds((prev) => new Set(prev).add(newMsg.id));
    setNewMsgText('');
  };

  // Delete message
  const handleDeleteMessage = (id: string) => {
    setMessages((prev) => prev.filter((m) => m.id !== id));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  // Move message
  const moveMessage = (idx: number, direction: 'up' | 'down') => {
    if (direction === 'up' && idx === 0) return;
    if (direction === 'down' && idx === messages.length - 1) return;
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    const updated = [...messages];
    const temp = updated[idx];
    updated[idx] = updated[targetIdx];
    updated[targetIdx] = temp;
    setMessages(updated);
  };

  // Save edited message
  const handleSaveEdit = (id: string) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === id ? { ...m, content: editingText } : m))
    );
    setEditingMsgId(null);
    setEditingText('');
  };

  // Export Screenshot (Download as PNG via html-to-image)
  const handleDownloadImage = async () => {
    if (!previewRef.current) return;
    try {
      setIsExporting(true);
      await document.fonts.ready;

      const dataUrl = await toPng(previewRef.current, {
        cacheBust: true,
        pixelRatio: 2.5,
        backgroundColor: frameTheme === 'dark' ? '#0f172a' : '#ffffff',
      });

      const link = document.createElement('a');
      link.download = `tasfi_screenshot_${pov}_${Date.now()}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Screenshot download error:', err);
    } finally {
      setIsExporting(false);
    }
  };

  // Copy Screenshot directly to Clipboard
  const handleCopyImage = async () => {
    if (!previewRef.current) return;
    try {
      setIsExporting(true);
      await document.fonts.ready;

      const blob = await toBlob(previewRef.current, {
        cacheBust: true,
        pixelRatio: 2.5,
        backgroundColor: frameTheme === 'dark' ? '#0f172a' : '#ffffff',
      });

      if (blob) {
        try {
          await navigator.clipboard.write([
            new ClipboardItem({ 'image/png': blob }),
          ]);
          setCopySuccess(true);
          setTimeout(() => setCopySuccess(false), 2500);
        } catch (clipErr) {
          console.warn('Clipboard write failed, downloading image instead', clipErr);
          await handleDownloadImage();
        }
      }
    } catch (err) {
      console.error('Copy screenshot error:', err);
    } finally {
      setIsExporting(false);
    }
  };

  // Filter messages to only show selected ones
  const displayedMessages = messages.filter((m) => selectedIds.has(m.id));

  // Determine current perspective details
  // If POV is 'saheb': The viewer is Psycho Saheb. Header shows TASFI.
  // Left messages = Tasfi. Right messages = Psycho Saheb.
  // If POV is 'tasfi': The viewer is Tasfi. Header shows PSYCHO SAHEB.
  // Left messages = Psycho Saheb. Right messages = Tasfi.
  const headerName = pov === 'saheb' ? tasfiDisplayName : sahebName;
  const headerAvatar = pov === 'saheb' ? localTasfiAvatar : sahebAvatar;
  const headerSubtitle = pov === 'saheb' ? tasfiSubtitle : sahebSubtitle;

  return (
    <div className="fixed inset-0 z-[100] flex flex-col w-screen h-screen bg-card-bg text-text-main overflow-hidden">
      
      {/* Full-Width Studio Top Navigation Bar */}
      <header className="shrink-0 flex items-center justify-between px-3 sm:px-6 py-2.5 border-b border-border-custom bg-card-bg/95 backdrop-blur-md z-20">
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={onClose}
            className="p-1.5 sm:p-2 rounded-xl hover:bg-input-bg text-text-muted hover:text-text-main transition-colors cursor-pointer flex items-center gap-1"
            title="ফিরে যান"
            aria-label="ফিরে যান"
          >
            <ChevronLeft className="w-5 h-5 text-romantic-deep" />
            <span className="hidden sm:inline text-xs font-bold text-text-main">ফিরে যান</span>
          </button>
          <div className="h-4 w-px bg-border-custom hidden sm:block" />
          <div className="flex items-center gap-2">
            <Camera className="w-4.5 h-4.5 text-romantic-deep" />
            <h2 className="text-sm sm:text-base font-bold text-text-main tracking-tight">
              স্ক্রিনশট স্টুডিও
            </h2>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleCopyImage}
            disabled={isExporting || displayedMessages.length === 0}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border-custom bg-input-bg hover:bg-romantic-pink/30 text-text-main text-xs font-semibold transition-all disabled:opacity-50 cursor-pointer shadow-xs"
          >
            {copySuccess ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copySuccess ? 'কপি হয়েছে' : 'কপি ইমেজ'}</span>
          </button>

          <button
            onClick={handleDownloadImage}
            disabled={isExporting || displayedMessages.length === 0}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-romantic-deep hover:bg-romantic-hover text-white text-xs font-bold transition-all shadow-xs active:scale-95 disabled:opacity-50 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{isExporting ? 'ডাউনলোড হচ্ছে...' : 'ডাউনলোড PNG'}</span>
          </button>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-input-bg text-text-muted hover:text-text-main transition-colors cursor-pointer"
            title="বন্ধ করুন"
            aria-label="বন্ধ করুন"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Mobile View Toggle Tabs (3 Responsive Tabs: Preview / Messages / Settings) */}
      <div className="flex md:hidden border-b border-border-custom bg-input-bg/70 shrink-0">
          <button
            onClick={() => setActiveTab('preview')}
            className={`flex-1 py-2.5 text-xs font-bold flex items-center justify-center gap-1.5 border-b-2 transition-all cursor-pointer ${
              activeTab === 'preview'
                ? 'border-romantic-deep text-romantic-deep bg-card-bg'
                : 'border-transparent text-text-muted hover:text-text-main'
            }`}
          >
            <Smartphone className="w-4 h-4" />
            <span>প্রিভিউ</span>
          </button>
          <button
            onClick={() => setActiveTab('messages')}
            className={`flex-1 py-2.5 text-xs font-bold flex items-center justify-center gap-1.5 border-b-2 transition-all cursor-pointer ${
              activeTab === 'messages'
                ? 'border-romantic-deep text-romantic-deep bg-card-bg'
                : 'border-transparent text-text-muted hover:text-text-main'
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            <span>মেসেজ ({selectedIds.size})</span>
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`flex-1 py-2.5 text-xs font-bold flex items-center justify-center gap-1.5 border-b-2 transition-all cursor-pointer ${
              activeTab === 'settings'
                ? 'border-romantic-deep text-romantic-deep bg-card-bg'
                : 'border-transparent text-text-muted hover:text-text-main'
            }`}
          >
            <Sliders className="w-4 h-4" />
            <span>সেটিংস</span>
          </button>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden min-h-0">
          
          {/* Controls & Configuration Panel (Desktop Side Panel / Mobile Tab View) */}
          <div
            className={`w-full md:w-[370px] lg:w-[410px] border-r border-border-custom flex flex-col bg-card-bg overflow-y-auto p-3.5 sm:p-4 space-y-3.5 shrink-0 ${
              activeTab === 'preview' ? 'hidden md:flex' : 'flex'
            }`}
          >
            {/* Desktop Tabs Header (মেসেজ / সেটিংস) */}
            <div className="hidden md:flex bg-input-bg p-1 rounded-xl border border-border-custom shrink-0 mb-1">
              <button
                type="button"
                onClick={() => setActiveTab('messages')}
                className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  activeTab !== 'settings'
                    ? 'bg-romantic-deep text-white shadow-xs'
                    : 'text-text-muted hover:text-text-main'
                }`}
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>মেসেজ ({selectedIds.size})</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('settings')}
                className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  activeTab === 'settings'
                    ? 'bg-romantic-deep text-white shadow-xs'
                    : 'text-text-muted hover:text-text-main'
                }`}
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>সেটিংস</span>
              </button>
            </div>

            {/* TAB 1: SETTINGS TAB (Only active when Settings is selected) */}
            {activeTab === 'settings' ? (
              <div className="space-y-4 animate-fade-in">
                {/* 1. Perspective (POV) Toggle */}
                <div className="space-y-1.5">
                  <span className="text-[11px] font-bold text-text-muted block">
                    কার দৃষ্টিকোণ থেকে স্ক্রিনশট?
                  </span>
                  <div className="grid grid-cols-2 gap-2 bg-input-bg p-1 rounded-xl border border-border-custom">
                    <button
                      type="button"
                      onClick={() => setPov('saheb')}
                      className={`py-2 px-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        pov === 'saheb'
                          ? 'bg-romantic-deep text-white shadow-xs'
                          : 'text-text-muted hover:text-text-main'
                      }`}
                    >
                      সাইকো সাহেব
                    </button>

                    <button
                      type="button"
                      onClick={() => setPov('tasfi')}
                      className={`py-2 px-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        pov === 'tasfi'
                          ? 'bg-romantic-deep text-white shadow-xs'
                          : 'text-text-muted hover:text-text-main'
                      }`}
                    >
                      তাসফি
                    </button>
                  </div>
                </div>

                {/* 2. Participants Profile Settings */}
                <div className="space-y-2.5 bg-input-bg/70 p-3 rounded-xl border border-border-custom">
                  {/* Psycho Saheb Profile */}
                  <div className="flex items-center gap-2.5">
                    <div
                      onClick={() => sahebFileInputRef.current?.click()}
                      className="relative group cursor-pointer w-10 h-10 shrink-0"
                      title="সাইকো সাহেবের ছবি পরিবর্তন করুন"
                    >
                      <img
                        src={sahebAvatar}
                        alt={sahebName}
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          if (!target.src.includes('profile.png')) {
                            target.src = '/profile.png';
                          }
                        }}
                        className="w-10 h-10 rounded-full object-cover border border-border-custom shadow-xs"
                      />
                      <div className="absolute inset-0 bg-black/40 rounded-full opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                        <ImageIcon className="w-3.5 h-3.5 text-white" />
                      </div>
                      <input
                        ref={sahebFileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleSahebAvatarChange}
                        className="hidden"
                      />
                    </div>
                    <div className="flex-1 min-w-0 space-y-1">
                      <input
                        type="text"
                        value={sahebName}
                        onChange={(e) => setSahebName(e.target.value)}
                        className="bg-card-bg border border-border-custom rounded-md px-2 py-0.5 text-xs font-bold text-text-main w-full"
                        placeholder="সাইকো সাহেব"
                      />
                      <input
                        type="text"
                        value={sahebSubtitle}
                        onChange={(e) => setSahebSubtitle(e.target.value)}
                        className="bg-card-bg border border-border-custom rounded-md px-2 py-0.5 text-[10px] text-emerald-500 font-semibold w-full"
                        placeholder="বাস্তববাদী লেখক!"
                      />
                    </div>
                  </div>

                  {/* Tasfi Profile */}
                  <div className="flex items-center gap-2.5 pt-2 border-t border-border-custom/50">
                    <div
                      onClick={() => tasfiFileInputRef.current?.click()}
                      className="relative group cursor-pointer w-10 h-10 shrink-0"
                      title="তাসফির ছবি পরিবর্তন করুন"
                    >
                      <img
                        src={localTasfiAvatar}
                        alt={tasfiDisplayName}
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          if (!target.src.includes('icon.png')) {
                            target.src = '/icon.png';
                          }
                        }}
                        className="w-10 h-10 rounded-full object-cover border border-border-custom shadow-xs"
                      />
                      <div className="absolute inset-0 bg-black/40 rounded-full opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                        <ImageIcon className="w-3.5 h-3.5 text-white" />
                      </div>
                      <input
                        ref={tasfiFileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleTasfiAvatarChange}
                        className="hidden"
                      />
                    </div>
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex gap-1.5">
                        <input
                          type="text"
                          value={tasfiDisplayName}
                          onChange={(e) => setTasfiDisplayName(e.target.value)}
                          className="bg-card-bg border border-border-custom rounded-md px-2 py-0.5 text-xs font-bold text-text-main flex-1"
                          placeholder="তাসফি"
                        />
                        <select
                          value={tasfiPersonaBadge}
                          onChange={(e) => setTasfiPersonaBadge(e.target.value)}
                          className="bg-card-bg border border-border-custom rounded-md px-1.5 py-0.5 text-[10px] font-bold text-[#d91b5c] outline-none"
                          title="পারসোনা ব্যাজ"
                        >
                          <option value="❤️ প্রিয়তমা">❤️ প্রিয়তমা</option>
                          <option value="💎 অর্ধাঙ্গিনী">💎 অর্ধাঙ্গিনী</option>
                          <option value="😎 বেষ্টি">😎 বেষ্টি</option>
                          <option value="😊 বান্ধবী">😊 বান্ধবী</option>
                          <option value="😶 অপরিচিতা">😶 অপরিচিতা</option>
                          <option value="📖 ধার্মিক">📖 ধার্মিক</option>
                          <option value="🔥 লিমিটলেস">🔥 লিমিটলেস</option>
                        </select>
                      </div>
                      <input
                        type="text"
                        value={tasfiSubtitle}
                        onChange={(e) => setTasfiSubtitle(e.target.value)}
                        className="bg-card-bg border border-border-custom rounded-md px-2 py-0.5 text-[10px] text-emerald-500 font-semibold w-full"
                        placeholder="তোমার প্রিয় সঙ্গিনী!"
                      />
                    </div>
                  </div>
                </div>

                {/* 3. Screen Frame & Display Toggles */}
                <div className="space-y-2">
                  <span className="text-[11px] font-bold text-text-muted block">
                    ফ্রেম অপশন
                  </span>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {/* Theme mode */}
                    <button
                      type="button"
                      onClick={() => setFrameTheme((t) => (t === 'light' ? 'dark' : 'light'))}
                      className="flex items-center justify-between p-2 rounded-lg border border-border-custom bg-input-bg text-text-main cursor-pointer"
                    >
                      <span>থিম</span>
                      <span className="font-semibold text-romantic-deep text-[11px]">
                        {frameTheme === 'light' ? 'লাইট' : 'ডার্ক'}
                      </span>
                    </button>

                    {/* Status Bar */}
                    <button
                      type="button"
                      onClick={() => setShowStatusBar((s) => !s)}
                      className={`flex items-center justify-between p-2 rounded-lg border transition-all cursor-pointer ${
                        showStatusBar
                          ? 'border-romantic-deep/40 bg-romantic-pink/20 text-romantic-deep font-bold'
                          : 'border-border-custom bg-input-bg text-text-muted'
                      }`}
                    >
                      <span>স্ট্যাটাস বার</span>
                      <span>{showStatusBar ? 'অন' : 'অফ'}</span>
                    </button>

                    {/* Header */}
                    <button
                      type="button"
                      onClick={() => setShowHeader((h) => !h)}
                      className={`flex items-center justify-between p-2 rounded-lg border transition-all cursor-pointer ${
                        showHeader
                          ? 'border-romantic-deep/40 bg-romantic-pink/20 text-romantic-deep font-bold'
                          : 'border-border-custom bg-input-bg text-text-muted'
                      }`}
                    >
                      <span>হেডার</span>
                      <span>{showHeader ? 'অন' : 'অফ'}</span>
                    </button>

                    {/* Bottom Input Box */}
                    <button
                      type="button"
                      onClick={() => setShowInputBar((i) => !i)}
                      className={`flex items-center justify-between p-2 rounded-lg border transition-all cursor-pointer ${
                        showInputBar
                          ? 'border-romantic-deep/40 bg-romantic-pink/20 text-romantic-deep font-bold'
                          : 'border-border-custom bg-input-bg text-text-muted'
                      }`}
                    >
                      <span>ইনপুট বার</span>
                      <span>{showInputBar ? 'অন' : 'অফ'}</span>
                    </button>
                  </div>

                  {/* Time & Battery Adjustment */}
                  {showStatusBar && (
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <input
                        type="text"
                        value={currentTimeText}
                        onChange={(e) => setCurrentTimeText(e.target.value)}
                        className="w-full bg-input-bg border border-border-custom rounded-md px-2 py-1 text-xs text-text-main"
                        placeholder="10:24 AM"
                      />
                      <input
                        type="number"
                        min="1"
                        max="100"
                        value={batteryLevel}
                        onChange={(e) => setBatteryLevel(e.target.value)}
                        className="w-full bg-input-bg border border-border-custom rounded-md px-2 py-1 text-xs text-text-main"
                        placeholder="ব্যাটারি %"
                      />
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* TAB 2: MESSAGES TAB (Message selection & Quick Add Only) */
              <div className="space-y-4 animate-fade-in">
                {/* Message Selection & List */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-text-muted">
                      মেসেজ নির্বাচন ({selectedIds.size}/{messages.length})
                    </span>
                    <div className="flex gap-2 text-[11px]">
                      <button
                        onClick={selectAll}
                        className="font-bold text-romantic-deep hover:underline cursor-pointer"
                      >
                        সব
                      </button>
                      <span className="text-text-muted">/</span>
                      <button
                        onClick={deselectAll}
                        className="font-bold text-text-muted hover:underline cursor-pointer"
                      >
                        ক্লিয়ার
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1.5 max-h-[380px] overflow-y-auto pr-1">
                    {messages.map((m, idx) => {
                      const isSelected = selectedIds.has(m.id);
                      const isSaheb = m.sender === 'saheb';
                      return (
                        <div
                          key={m.id}
                          className={`p-2 rounded-lg border text-xs transition-all flex items-start gap-2 ${
                            isSelected
                              ? 'border-romantic-deep/40 bg-romantic-pink/15'
                              : 'border-border-custom bg-input-bg/40 opacity-70'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelectMessage(m.id)}
                            className="mt-0.5 accent-romantic-deep cursor-pointer"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-0.5">
                              <span
                                className={`text-[10px] font-bold ${
                                  isSaheb ? 'text-blue-600 dark:text-blue-400' : 'text-pink-600 dark:text-pink-400'
                                }`}
                              >
                                {isSaheb ? sahebName : tasfiDisplayName}
                              </span>
                              <div className="flex items-center gap-1 opacity-80">
                                <button
                                  onClick={() => moveMessage(idx, 'up')}
                                  disabled={idx === 0}
                                  className="p-0.5 hover:text-romantic-deep disabled:opacity-20 cursor-pointer"
                                  title="উপরে নিন"
                                >
                                  <ArrowUp className="w-3 h-3" />
                                </button>
                                <button
                                  onClick={() => moveMessage(idx, 'down')}
                                  disabled={idx === messages.length - 1}
                                  className="p-0.5 hover:text-romantic-deep disabled:opacity-20 cursor-pointer"
                                  title="নিচে নিন"
                                >
                                  <ArrowDown className="w-3 h-3" />
                                </button>
                                <button
                                  onClick={() => {
                                    setEditingMsgId(m.id);
                                    setEditingText(m.content);
                                  }}
                                  className="p-0.5 hover:text-romantic-deep cursor-pointer"
                                  title="এডিট"
                                >
                                  <Edit2 className="w-3 h-3" />
                                </button>
                                <button
                                  onClick={() => handleDeleteMessage(m.id)}
                                  className="p-0.5 hover:text-red-500 cursor-pointer"
                                  title="ডিলিট"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            </div>

                            {editingMsgId === m.id ? (
                              <div className="space-y-1.5 mt-1">
                                <textarea
                                  value={editingText}
                                  onChange={(e) => setEditingText(e.target.value)}
                                  rows={2}
                                  className="w-full p-1.5 bg-card-bg border border-border-custom rounded-md text-xs text-text-main"
                                />
                                <div className="flex justify-end gap-1.5">
                                  <button
                                    onClick={() => setEditingMsgId(null)}
                                    className="px-2 py-0.5 text-[10px] rounded border border-border-custom cursor-pointer"
                                  >
                                    বাতিল
                                  </button>
                                  <button
                                    onClick={() => handleSaveEdit(m.id)}
                                    className="px-2 py-0.5 text-[10px] rounded bg-romantic-deep text-white font-bold cursor-pointer"
                                  >
                                    সেভ
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <p className="line-clamp-2 text-text-main font-sans text-[11px] leading-tight">
                                {m.content}
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Quick Add Message */}
                <div className="space-y-1.5 bg-input-bg/70 p-2.5 rounded-xl border border-border-custom">
                  <span className="text-[10px] font-bold text-text-muted block">নতুন মেসেজ যোগ করুন</span>
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => setNewMsgSender('saheb')}
                      className={`flex-1 py-1 text-xs font-bold rounded-md border transition-all cursor-pointer ${
                        newMsgSender === 'saheb'
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-card-bg text-text-muted border-border-custom'
                      }`}
                    >
                      {sahebName}
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewMsgSender('tasfi')}
                      className={`flex-1 py-1 text-xs font-bold rounded-md border transition-all cursor-pointer ${
                        newMsgSender === 'tasfi'
                          ? 'bg-romantic-deep text-white border-romantic-deep'
                          : 'bg-card-bg text-text-muted border-border-custom'
                      }`}
                    >
                      {tasfiDisplayName}
                    </button>
                  </div>
                  <textarea
                    value={newMsgText}
                    onChange={(e) => setNewMsgText(e.target.value)}
                    placeholder="মেসেজ লিখুন..."
                    rows={2}
                    className="w-full p-1.5 bg-card-bg border border-border-custom rounded-md text-xs text-text-main outline-none focus:ring-1 focus:ring-romantic-deep"
                  />
                  <button
                    type="button"
                    onClick={handleAddMessage}
                    disabled={!newMsgText.trim()}
                    className="w-full py-1.5 bg-romantic-deep hover:bg-romantic-hover text-white text-xs font-bold rounded-md flex items-center justify-center gap-1 transition-all disabled:opacity-50 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" /> যোগ করুন
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Right Live Preview Area */}
          <div className={`flex-1 bg-black/10 dark:bg-black/30 p-2 sm:p-5 flex-col items-center justify-start overflow-y-auto ${activeTab === 'preview' ? 'flex' : 'hidden md:flex'}`}>
            
            {/* The Captured Canvas Frame (Messenger Style with Clean Compact 14px Radius) */}
            <div
              ref={previewRef}
              style={{
                fontFamily: '"Hind Siliguri", "Inter", sans-serif',
              }}
              className={`w-full max-w-[380px] shadow-xl rounded-[14px] overflow-hidden border transition-all flex flex-col shrink-0 ${
                frameTheme === 'dark'
                  ? 'bg-slate-950 text-slate-100 border-slate-800'
                  : 'bg-white text-slate-900 border-slate-200'
              }`}
            >
              {/* Status Bar */}
              {showStatusBar && (
                <div
                  className={`px-4 pt-2.5 pb-1 flex items-center justify-between text-xs font-semibold select-none ${
                    frameTheme === 'dark' ? 'text-slate-300' : 'text-slate-800'
                  }`}
                >
                  <span className="font-bold text-[11px]">{currentTimeText}</span>
                  <div className={`w-16 h-3.5 rounded-full mx-auto ${frameTheme === 'dark' ? 'bg-black/85' : 'bg-slate-800/85'}`} />
                  <div className="flex items-center gap-1.5 text-[10px]">
                    <Wifi className="w-3 h-3" />
                    <span className="font-bold">5G</span>
                    <div className="flex items-center gap-0.5 font-bold">
                      <span>{batteryLevel}%</span>
                      <Battery className="w-3 h-3" />
                    </div>
                  </div>
                </div>
              )}

              {/* Chat Header (Theme-Based, Zero Conflict) */}
              {showHeader && (
                <div
                  className={`px-3 py-2.5 flex items-center justify-between border-b ${
                    frameTheme === 'dark'
                      ? 'bg-[#121824] border-slate-800/80 text-white'
                      : 'bg-white border-slate-200 text-slate-900'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1 mr-2">
                    <ChevronLeft className="w-5 h-5 text-rose-500 shrink-0 -ml-1 cursor-pointer" />
                    
                    {/* Clean Avatar */}
                    <div className="relative shrink-0">
                      <img
                        src={headerAvatar}
                        alt={headerName}
                        crossOrigin="anonymous"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          if (!target.src.includes('profile.png') && !target.src.includes('icon.png')) {
                            target.src = '/profile.png';
                          }
                        }}
                        className={`w-9.5 h-9.5 rounded-full object-cover relative z-10 border shadow-xs ${
                          frameTheme === 'dark' ? 'border-slate-700/60' : 'border-slate-200'
                        }`}
                      />
                      {/* Online dot with white center */}
                      <span className={`absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 border-2 ${
                        frameTheme === 'dark' ? 'border-[#121824]' : 'border-white'
                      } rounded-full z-20 flex items-center justify-center`}>
                        <span className="w-0.5 h-0.5 bg-white rounded-full"></span>
                      </span>
                    </div>

                    <div className="min-w-0 leading-tight flex-1">
                      {/* Name + Persona Badge for Tasfi (No Emoji on Chat UI, smaller font) */}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h4 className="font-bold text-[12.5px] tracking-tight truncate">
                          {headerName}
                        </h4>
                        {pov === 'saheb' && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-[#d91b5c] text-white text-[8.5px] font-bold rounded-full shadow-xs shrink-0">
                            {tasfiPersonaBadge.replace(/^[\p{Emoji}\s]+/gu, '').trim() || 'প্রিয়তমা'}
                            <span className="text-[6px] opacity-80">▼</span>
                          </span>
                        )}
                      </div>

                      {/* Tagline in emerald green */}
                      <p className={`text-[9.5px] font-medium truncate mt-0.5 ${
                        frameTheme === 'dark' ? 'text-emerald-400' : 'text-emerald-600'
                      }`}>
                        {headerSubtitle}
                      </p>
                    </div>
                  </div>

                  {/* Circular Buttons (Camera, Phone, Menu) matching theme */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center shadow-xs transition-colors ${
                      frameTheme === 'dark'
                        ? 'bg-[#1c2434] border border-slate-700/40 text-[#f43f5e]'
                        : 'bg-rose-50 border border-rose-200 text-[#f43f5e]'
                    }`}>
                      <Camera className="w-3.5 h-3.5" strokeWidth={2.2} />
                    </div>
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center shadow-xs transition-colors ${
                      frameTheme === 'dark'
                        ? 'bg-[#1c2434] border border-slate-700/40 text-[#f43f5e]'
                        : 'bg-rose-50 border border-rose-200 text-[#f43f5e]'
                    }`}>
                      <Phone className="w-3.5 h-3.5" strokeWidth={2.2} />
                    </div>
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center shadow-xs transition-colors ${
                      frameTheme === 'dark'
                        ? 'bg-[#1c2434] border border-slate-700/40 text-[#f43f5e]'
                        : 'bg-rose-50 border border-rose-200 text-[#f43f5e]'
                    }`}>
                      <Menu className="w-3.5 h-3.5" strokeWidth={2.2} />
                    </div>
                  </div>
                </div>
              )}

              {/* Compact Messenger Chat Conversation Body */}
              <div
                className={`p-2.5 sm:p-3 space-y-1.5 min-h-[50px] flex-1 ${
                  frameTheme === 'dark'
                    ? 'bg-slate-950'
                    : 'bg-[#f8f9fa]'
                }`}
              >
                {displayedMessages.length === 0 ? (
                  <div className="text-center py-6 text-xs text-text-muted">
                    কোনো মেসেজ সিলেক্ট করা নেই।
                  </div>
                ) : (
                  displayedMessages.map((msg) => {
                    const isOutgoing =
                      pov === 'saheb' ? msg.sender === 'saheb' : msg.sender === 'tasfi';
                    const avatarToShow =
                      msg.sender === 'saheb' ? sahebAvatar : localTasfiAvatar;

                    return (
                      <div
                        key={msg.id}
                        className={`flex items-end gap-1.5 ${
                          isOutgoing ? 'justify-end' : 'justify-start'
                        }`}
                      >
                        {/* Avatar for incoming messages on the left */}
                        {!isOutgoing && (
                          <img
                            src={avatarToShow}
                            alt=""
                            crossOrigin="anonymous"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              if (!target.src.includes('profile.png') && !target.src.includes('icon.png')) {
                                target.src = '/profile.png';
                              }
                            }}
                            className="w-5 h-5 rounded-full object-cover shrink-0 mb-0.5 border border-black/10 dark:border-white/10"
                          />
                        )}

                        {/* Compact Messenger Bubble */}
                        <div
                          className={`max-w-[78%] px-2.5 pt-1.5 pb-0.5 rounded-[12px] text-[13px] leading-[1.28] relative select-none break-words ${
                            isOutgoing
                              ? frameTheme === 'dark'
                                ? 'bg-rose-600 text-white rounded-br-[3px]'
                                : 'bg-rose-500 text-white rounded-br-[3px]'
                              : frameTheme === 'dark'
                              ? 'bg-slate-800 text-slate-100 rounded-bl-[3px]'
                              : 'bg-white text-slate-900 border border-slate-200/80 shadow-2xs rounded-bl-[3px]'
                          }`}
                        >
                          <div className="markdown-body font-sans select-none break-words text-[13px] leading-[1.28] [&>p]:m-0 [&>p]:p-0">
                            <Markdown remarkPlugins={[remarkBreaks]}>
                              {msg.content}
                            </Markdown>
                          </div>

                          {/* Time & Double Checkmarks (Tightly grouped) */}
                          <div
                            className={`flex items-center justify-end gap-1 mt-0 text-[8.5px] leading-none pb-0.5 ${
                              isOutgoing
                                ? 'text-white/80'
                                : frameTheme === 'dark'
                                ? 'text-slate-400'
                                : 'text-slate-400'
                            }`}
                          >
                            <span>{msg.time}</span>
                            {isOutgoing && (
                              <CheckCheck className="w-2.5 h-2.5 text-cyan-200" />
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Chat Input Bar & Disclaimer (Directly under input box, matching main app) */}
              {showInputBar && (
                <div
                  className={`px-3 pt-2 pb-1.5 border-t flex flex-col ${
                    frameTheme === 'dark'
                      ? 'bg-slate-900 border-slate-800'
                      : 'bg-white border-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Smile className="w-4 h-4 text-text-muted shrink-0 cursor-pointer" />
                    <div
                      className={`flex-1 px-3 py-1.5 rounded-full text-xs flex items-center justify-between border ${
                        frameTheme === 'dark'
                          ? 'bg-slate-950 border-slate-800 text-slate-300'
                          : 'bg-slate-100 border-slate-200 text-slate-700'
                      }`}
                    >
                      <span className="truncate">
                        {inputDraftText.trim()
                          ? inputDraftText
                          : 'মেসেজ লিখুন...'}
                      </span>
                      <Paperclip className="w-3.5 h-3.5 text-text-muted shrink-0 ml-1" />
                    </div>
                    <div className="p-1.5 rounded-full bg-romantic-deep text-white shadow-xs shrink-0 flex items-center justify-center">
                      {inputDraftText.trim() ? (
                        <Send className="w-3.5 h-3.5" />
                      ) : (
                        <Mic className="w-3.5 h-3.5" />
                      )}
                    </div>
                  </div>

                  {/* Disclaimer directly inside input section right below input box (matching main chat design) */}
                  <p className="w-full text-center px-2 mt-1 mb-0 text-[8.5px] sm:text-[9px] font-medium tracking-wide text-rose-500 select-none leading-none opacity-85">
                    তাসফি তোমাকে বুঝে, তোমার সাজানো কাল্পনিক চরিত্র❤️
                  </p>
                </div>
              )}
            </div>

            {/* Quick Export Actions */}
            <div className="mt-3 flex items-center gap-2">
              <button
                onClick={handleDownloadImage}
                disabled={isExporting || displayedMessages.length === 0}
                className="px-4 py-1.5 bg-romantic-deep hover:bg-romantic-hover text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{isExporting ? 'তৈরি হচ্ছে...' : 'ডাউনলোড PNG'}</span>
              </button>

              <button
                onClick={handleCopyImage}
                disabled={isExporting || displayedMessages.length === 0}
                className="px-3.5 py-1.5 bg-card-bg hover:bg-input-bg text-text-main border border-border-custom rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
              >
                {copySuccess ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copySuccess ? 'কপি হয়েছে' : 'কপি ইমেজ'}</span>
              </button>
            </div>
          </div>

        </div>

      </div>
    );
  };
