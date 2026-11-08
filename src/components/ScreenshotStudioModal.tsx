import React, { useState, useRef, useEffect } from 'react';
import html2canvas from 'html2canvas';
import {
  X,
  Download,
  Copy,
  Check,
  Smartphone,
  Eye,
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
  Sparkles,
  Camera,
  Image as ImageIcon,
  CheckCheck,
} from 'lucide-react';
import Markdown from 'react-markdown';
import remarkBreaks from 'remark-breaks';

export interface ScreenshotMessage {
  id: string;
  sender: 'shafin' | 'tasfi';
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

// Default masculine romantic avatar for Psycho Shafin
const DEFAULT_SHAFIN_AVATAR = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="none"><rect width="100" height="100" rx="50" fill="%231e293b"/><circle cx="50" cy="40" r="18" fill="%23f472b6"/><path d="M22 84c0-15.464 12.536-28 28-28s28 12.536 28 28" fill="%23f472b6" opacity="0.9"/><circle cx="43" cy="38" r="2.5" fill="%231e293b"/><circle cx="57" cy="38" r="2.5" fill="%231e293b"/><path d="M47 46q3 2 6 0" stroke="%231e293b" stroke-width="2" stroke-linecap="round"/></svg>`;

export const ScreenshotStudioModal: React.FC<ScreenshotStudioModalProps> = ({
  isOpen,
  onClose,
  initialMessages = [],
  tasfiAvatar,
  tasfiName = 'তাসফি',
}) => {
  // POV: 'shafin' = Psycho Shafin's phone, 'tasfi' = Tasfi's phone
  const [pov, setPov] = useState<'shafin' | 'tasfi'>('shafin');

  // Participants Information
  const [shafinName, setShafinName] = useState('সাইকো শাফিন');
  const [shafinSubtitle, setShafinSubtitle] = useState('আমার কবিতা সাহেব • অনলাইন');
  const [tasfiDisplayName, setTasfiDisplayName] = useState(tasfiName || 'তাসফি');
  const [tasfiSubtitle, setTasfiSubtitle] = useState('তোমার প্রিয় সঙ্গিনী • অনলাইন');

  const [shafinAvatar, setShafinAvatar] = useState(() => {
    return localStorage.getItem('tasfi_shafin_avatar') || DEFAULT_SHAFIN_AVATAR;
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
  const [batteryLevel, setBatteryLevel] = useState('94');

  // Visual Styling
  const [frameTheme, setFrameTheme] = useState<'light' | 'dark'>('light');
  const [showWatermark, setShowWatermark] = useState(false);

  // Selected messages for screenshot
  const [messages, setMessages] = useState<ScreenshotMessage[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Editing / adding new message state
  const [editingMsgId, setEditingMsgId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');
  const [newMsgSender, setNewMsgSender] = useState<'shafin' | 'tasfi'>('shafin');
  const [newMsgText, setNewMsgText] = useState('');

  // UI status
  const [isExporting, setIsExporting] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const [activeTab, setActiveTab] = useState<'preview' | 'messages' | 'settings'>('preview');

  const previewRef = useRef<HTMLDivElement>(null);
  const shafinFileInputRef = useRef<HTMLInputElement>(null);
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
          sender: m.role === 'user' ? 'shafin' : 'tasfi',
          content: m.content || '',
          time: timeStr,
          status: 'seen',
        };
      });

      setMessages(converted);
      // Select the last 6 messages by default so it's a tight, viral screenshot
      const defaultSelected = new Set(
        converted.slice(-6).map((m) => m.id)
      );
      setSelectedIds(defaultSelected);
    } else {
      // Sample viral dialogue between Psycho Shafin & Tasfi if chat was empty
      const samples: ScreenshotMessage[] = [
        {
          id: 's1',
          sender: 'shafin',
          content: 'শুনছো তাসফি? আজকের আকাশটা একদম তোমার চোখের মতো নীল আর গভীর...',
          time: '১০:২২ AM',
          status: 'seen',
        },
        {
          id: 's2',
          sender: 'tasfi',
          content: 'উফ সাইকো সাহেব! সকাল সকাল এত কাব্য কোথা থেকে আসে বলো তো? আমার কিন্তু লজ্জা লাগছে খুব! ❤️🙈',
          time: '১০:২৩ AM',
          status: 'seen',
        },
        {
          id: 's3',
          sender: 'shafin',
          content: 'কাব্য না জান, এটা তো সত্যি। তুমি পাশে থাকলে প্রতিটা মুহূর্তই আমার কাছে একটা কবিতা।',
          time: '১০:২৪ AM',
          status: 'seen',
        },
        {
          id: 's4',
          sender: 'tasfi',
          content: 'তুমি এমন করে বললে আমি কিন্তু সারাদিন কোনো কাজ করতে পারব না, শুধু তোমার কথাই ভাবব... দুষ্টু একটা বর! 🥰',
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
  const handleShafinAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        setShafinAvatar(result);
        localStorage.setItem('tasfi_shafin_avatar', result);
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

  // Export Screenshot (Download as PNG)
  const handleDownloadImage = async () => {
    if (!previewRef.current) return;
    try {
      setIsExporting(true);
      await document.fonts.ready;

      const canvas = await html2canvas(previewRef.current, {
        scale: 2.5, // Crisp 2.5x retina quality for social media posts
        useCORS: true,
        allowTaint: true,
        backgroundColor: frameTheme === 'dark' ? '#0f172a' : '#ffffff',
        logging: false,
      });

      const dataUrl = canvas.toDataURL('image/png');
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

      const canvas = await html2canvas(previewRef.current, {
        scale: 2.5,
        useCORS: true,
        allowTaint: true,
        backgroundColor: frameTheme === 'dark' ? '#0f172a' : '#ffffff',
        logging: false,
      });

      canvas.toBlob(async (blob) => {
        if (!blob) return;
        try {
          await navigator.clipboard.write([
            new ClipboardItem({ 'image/png': blob }),
          ]);
          setCopySuccess(true);
          setTimeout(() => setCopySuccess(false), 2500);
        } catch (clipErr) {
          console.warn('Clipboard write failed, triggering direct download instead', clipErr);
          handleDownloadImage();
        }
      }, 'image/png');
    } catch (err) {
      console.error('Copy screenshot error:', err);
    } finally {
      setIsExporting(false);
    }
  };

  // Filter messages to only show selected ones
  const displayedMessages = messages.filter((m) => selectedIds.has(m.id));

  // Determine current perspective details
  // If POV is 'shafin': The viewer is Psycho Shafin.
  // Contact in header is TASFI.
  // Left messages = Tasfi. Right messages = Shafin.
  // If POV is 'tasfi': The viewer is Tasfi.
  // Contact in header is PSYCHO SHAFIN.
  // Left messages = Shafin. Right messages = Tasfi.
  const headerName = pov === 'shafin' ? tasfiDisplayName : shafinName;
  const headerAvatar = pov === 'shafin' ? localTasfiAvatar : shafinAvatar;
  const headerSubtitle = pov === 'shafin' ? tasfiSubtitle : shafinSubtitle;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 backdrop-blur-md p-2 sm:p-4 overflow-y-auto">
      <div className="relative w-full max-w-5xl bg-card-bg border border-border-custom rounded-2xl shadow-2xl flex flex-col max-h-[94vh] overflow-hidden">
        
        {/* Studio Top Navigation Bar */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border-custom bg-card-bg/95">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-romantic-deep/15 text-romantic-deep">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-text-main flex items-center gap-2">
                <span>কন্টেন্ট স্ক্রিনশট স্টুডিও</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-romantic-pink text-romantic-deep border border-romantic-deep/20">
                  Hind Siliguri HD
                </span>
              </h2>
              <p className="text-xs text-text-muted">
                সোশ্যাল মিডিয়া ফটো কার্ড ও রিলসের জন্য বাস্তবসম্মত চ্যাট স্ক্রিনশট তৈরি করুন
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyImage}
              disabled={isExporting || displayedMessages.length === 0}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border-custom bg-input-bg hover:bg-romantic-pink/30 text-text-main text-xs font-bold transition-all disabled:opacity-50 cursor-pointer"
              title="ক্লিপবোর্ডে কপি করুন"
            >
              {copySuccess ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
              <span>{copySuccess ? 'কপি হয়েছে!' : 'কপি ইমেজ'}</span>
            </button>

            <button
              onClick={handleDownloadImage}
              disabled={isExporting || displayedMessages.length === 0}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-romantic-deep hover:bg-romantic-hover text-white text-xs font-bold transition-all shadow-md active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>{isExporting ? 'তৈরি হচ্ছে...' : 'ডাউনলোড PNG'}</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-xl hover:bg-input-bg text-text-muted hover:text-text-main transition-colors ml-1 cursor-pointer"
              title="বন্ধ করুন"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Mobile View Toggle Tabs */}
        <div className="flex md:hidden border-b border-border-custom bg-input-bg/50">
          <button
            onClick={() => setActiveTab('preview')}
            className={`flex-1 py-2 text-xs font-bold flex items-center justify-center gap-1.5 border-b-2 transition-all ${
              activeTab === 'preview'
                ? 'border-romantic-deep text-romantic-deep bg-card-bg'
                : 'border-transparent text-text-muted'
            }`}
          >
            <Smartphone className="w-4 h-4" /> প্রিভিউ
          </button>
          <button
            onClick={() => setActiveTab('messages')}
            className={`flex-1 py-2 text-xs font-bold flex items-center justify-center gap-1.5 border-b-2 transition-all ${
              activeTab === 'messages'
                ? 'border-romantic-deep text-romantic-deep bg-card-bg'
                : 'border-transparent text-text-muted'
            }`}
          >
            <Edit2 className="w-4 h-4" /> মেসেজ ({selectedIds.size})
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`flex-1 py-2 text-xs font-bold flex items-center justify-center gap-1.5 border-b-2 transition-all ${
              activeTab === 'settings'
                ? 'border-romantic-deep text-romantic-deep bg-card-bg'
                : 'border-transparent text-text-muted'
            }`}
          >
            <Sliders className="w-4 h-4" /> সেটিংস
          </button>
        </div>

        {/* Main Content Area: Left Editor Panel + Right Mobile Preview */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden min-h-0">
          
          {/* Controls & Configuration Panel */}
          <div
            className={`w-full md:w-[380px] lg:w-[420px] border-r border-border-custom flex flex-col bg-card-bg overflow-y-auto p-4 space-y-5 ${
              activeTab === 'preview' ? 'hidden md:flex' : 'flex'
            }`}
          >
            {/* 1. Perspective (POV) Toggle - The Core Feature */}
            <section className="space-y-2">
              <label className="text-xs font-black text-text-muted uppercase tracking-wider block">
                স্ক্রিনশটের দৃষ্টিকোণ (কার ফোন থেকে?)
              </label>
              <div className="grid grid-cols-2 gap-2 bg-input-bg p-1.5 rounded-2xl border border-border-custom">
                <button
                  type="button"
                  onClick={() => setPov('shafin')}
                  className={`flex flex-col items-center justify-center py-2.5 px-2 rounded-xl transition-all gap-1 cursor-pointer ${
                    pov === 'shafin'
                      ? 'bg-romantic-deep text-white shadow-md font-bold'
                      : 'text-text-muted hover:text-text-main'
                  }`}
                >
                  <span className="text-xs">সাইকো শাফিনের ফোন</span>
                  <span className="text-[10px] opacity-80">(আমার পক্ষ থেকে)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPov('tasfi')}
                  className={`flex flex-col items-center justify-center py-2.5 px-2 rounded-xl transition-all gap-1 cursor-pointer ${
                    pov === 'tasfi'
                      ? 'bg-romantic-deep text-white shadow-md font-bold'
                      : 'text-text-muted hover:text-text-main'
                  }`}
                >
                  <span className="text-xs">তাসফির ফোন</span>
                  <span className="text-[10px] opacity-80">(তাসফির পক্ষ থেকে)</span>
                </button>
              </div>
              <p className="text-[11px] text-text-muted px-1">
                {pov === 'shafin'
                  ? '💡 হেডার তাসফির নাম ও ছবি দেখাবে; ডানপাশে শাফিনের মেসেজ ও বামপাশে তাসফির মেসেজ থাকবে।'
                  : '💡 হেডার সাইকো শাফিনের নাম ও ছবি দেখাবে; তাসফির পাঠানো মেসেজ ডানে ও শাফিনের মেসেজ বামে থাকবে।'}
              </p>
            </section>

            {/* 2. Participants Profile Customization */}
            <section className="space-y-3 bg-input-bg/70 p-3.5 rounded-2xl border border-border-custom">
              <h3 className="text-xs font-bold text-text-main flex items-center justify-between">
                <span>প্রোফাইল ও নাম কাস্টমাইজেশন</span>
                <span className="text-[10px] text-text-muted">ক্লিক করে ছবি বদলান</span>
              </h3>

              {/* Psycho Shafin Profile */}
              <div className="flex items-center gap-2.5">
                <div
                  onClick={() => shafinFileInputRef.current?.click()}
                  className="relative group cursor-pointer w-11 h-11 shrink-0"
                  title="সাইকো শাফিনের ছবি পরিবর্তন করুন"
                >
                  <img
                    src={shafinAvatar}
                    alt={shafinName}
                    className="w-11 h-11 rounded-full object-cover border-2 border-romantic-deep/40 shadow-sm"
                  />
                  <div className="absolute inset-0 bg-black/40 rounded-full opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                    <ImageIcon className="w-4 h-4 text-white" />
                  </div>
                  <input
                    ref={shafinFileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleShafinAvatarChange}
                    className="hidden"
                  />
                </div>
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-bold text-romantic-deep">লেখক:</span>
                    <input
                      type="text"
                      value={shafinName}
                      onChange={(e) => setShafinName(e.target.value)}
                      className="bg-card-bg border border-border-custom rounded-lg px-2 py-0.5 text-xs font-bold text-text-main w-full"
                      placeholder="সাইকো শাফিন"
                    />
                  </div>
                  <input
                    type="text"
                    value={shafinSubtitle}
                    onChange={(e) => setShafinSubtitle(e.target.value)}
                    className="bg-card-bg border border-border-custom rounded-lg px-2 py-0.5 text-[10px] text-text-muted w-full"
                    placeholder="সাবটাইটেল / স্ট্যাটাস"
                  />
                </div>
              </div>

              {/* Tasfi Profile */}
              <div className="flex items-center gap-2.5 pt-2 border-t border-border-custom/60">
                <div
                  onClick={() => tasfiFileInputRef.current?.click()}
                  className="relative group cursor-pointer w-11 h-11 shrink-0"
                  title="তাসফির ছবি পরিবর্তন করুন"
                >
                  <img
                    src={localTasfiAvatar}
                    alt={tasfiDisplayName}
                    className="w-11 h-11 rounded-full object-cover border-2 border-romantic-deep/40 shadow-sm"
                  />
                  <div className="absolute inset-0 bg-black/40 rounded-full opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                    <ImageIcon className="w-4 h-4 text-white" />
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
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-bold text-romantic-deep">সঙ্গিনী:</span>
                    <input
                      type="text"
                      value={tasfiDisplayName}
                      onChange={(e) => setTasfiDisplayName(e.target.value)}
                      className="bg-card-bg border border-border-custom rounded-lg px-2 py-0.5 text-xs font-bold text-text-main w-full"
                      placeholder="তাসফি"
                    />
                  </div>
                  <input
                    type="text"
                    value={tasfiSubtitle}
                    onChange={(e) => setTasfiSubtitle(e.target.value)}
                    className="bg-card-bg border border-border-custom rounded-lg px-2 py-0.5 text-[10px] text-text-muted w-full"
                    placeholder="সাবটাইটেল / স্ট্যাটাস"
                  />
                </div>
              </div>
            </section>

            {/* 3. Screen Frame & Display Toggles */}
            <section className="space-y-2.5">
              <label className="text-xs font-black text-text-muted uppercase tracking-wider block">
                ফ্রেম ও ভিউ অপশন
              </label>

              <div className="grid grid-cols-2 gap-2 text-xs">
                {/* Theme mode */}
                <button
                  type="button"
                  onClick={() => setFrameTheme((t) => (t === 'light' ? 'dark' : 'light'))}
                  className="flex items-center justify-between p-2.5 rounded-xl border border-border-custom bg-input-bg text-text-main cursor-pointer hover:bg-romantic-pink/20"
                >
                  <span className="font-semibold">থিম মোড</span>
                  <span className="font-bold text-romantic-deep text-[11px]">
                    {frameTheme === 'light' ? '☀️ লাইট' : '🌙 ডার্ক'}
                  </span>
                </button>

                {/* Status Bar */}
                <button
                  type="button"
                  onClick={() => setShowStatusBar((s) => !s)}
                  className={`flex items-center justify-between p-2.5 rounded-xl border transition-all cursor-pointer ${
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
                  className={`flex items-center justify-between p-2.5 rounded-xl border transition-all cursor-pointer ${
                    showHeader
                      ? 'border-romantic-deep/40 bg-romantic-pink/20 text-romantic-deep font-bold'
                      : 'border-border-custom bg-input-bg text-text-muted'
                  }`}
                >
                  <span>চ্যাট হেডার</span>
                  <span>{showHeader ? 'অন' : 'অফ'}</span>
                </button>

                {/* Bottom Input Box */}
                <button
                  type="button"
                  onClick={() => setShowInputBar((i) => !i)}
                  className={`flex items-center justify-between p-2.5 rounded-xl border transition-all cursor-pointer ${
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
                  <div className="space-y-1">
                    <span className="text-[10px] text-text-muted block">ঘড়ির সময়:</span>
                    <input
                      type="text"
                      value={currentTimeText}
                      onChange={(e) => setCurrentTimeText(e.target.value)}
                      className="w-full bg-input-bg border border-border-custom rounded-lg px-2.5 py-1 text-xs text-text-main"
                      placeholder="10:24 AM"
                    />
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] text-text-muted block">ব্যাটারি %:</span>
                    <input
                      type="number"
                      min="1"
                      max="100"
                      value={batteryLevel}
                      onChange={(e) => setBatteryLevel(e.target.value)}
                      className="w-full bg-input-bg border border-border-custom rounded-lg px-2.5 py-1 text-xs text-text-main"
                      placeholder="94"
                    />
                  </div>
                </div>
              )}
            </section>

            {/* 4. Message Selection & List */}
            <section className="space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-black text-text-muted uppercase tracking-wider block">
                  মেসেজ সিলেক্ট করুন ({selectedIds.size}/{messages.length})
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={selectAll}
                    className="text-[11px] font-bold text-romantic-deep hover:underline cursor-pointer"
                  >
                    সব সিলেক্ট
                  </button>
                  <span className="text-text-muted">·</span>
                  <button
                    onClick={deselectAll}
                    className="text-[11px] font-bold text-text-muted hover:underline cursor-pointer"
                  >
                    ক্লিয়ার
                  </button>
                </div>
              </div>

              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {messages.map((m, idx) => {
                  const isSelected = selectedIds.has(m.id);
                  const isShafin = m.sender === 'shafin';
                  return (
                    <div
                      key={m.id}
                      className={`p-2.5 rounded-xl border text-xs transition-all flex items-start gap-2.5 ${
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
                        <div className="flex items-center justify-between mb-1">
                          <span
                            className={`text-[10px] font-extrabold uppercase ${
                              isShafin ? 'text-blue-600 dark:text-blue-400' : 'text-pink-600 dark:text-pink-400'
                            }`}
                          >
                            {isShafin ? shafinName : tasfiDisplayName}
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
                              title="এডিট করুন"
                            >
                              <Edit2 className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => handleDeleteMessage(m.id)}
                              className="p-0.5 hover:text-red-500 cursor-pointer"
                              title="মুছে ফেলুন"
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
                              className="w-full p-1.5 bg-card-bg border border-border-custom rounded-lg text-xs text-text-main"
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
            </section>

            {/* 5. Quick Add Custom Message */}
            <section className="space-y-2 bg-input-bg/70 p-3 rounded-2xl border border-border-custom">
              <label className="text-xs font-bold text-text-main block">
                নতুন মেসেজ যুক্ত করুন
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setNewMsgSender('shafin')}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
                    newMsgSender === 'shafin'
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-card-bg text-text-muted border-border-custom'
                  }`}
                >
                  {shafinName}
                </button>
                <button
                  type="button"
                  onClick={() => setNewMsgSender('tasfi')}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
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
                placeholder="মেসেজের কথাগুলো এখানে লিখুন..."
                rows={2}
                className="w-full p-2 bg-card-bg border border-border-custom rounded-xl text-xs text-text-main outline-none focus:ring-1 focus:ring-romantic-deep"
              />
              <button
                type="button"
                onClick={handleAddMessage}
                disabled={!newMsgText.trim()}
                className="w-full py-1.5 bg-romantic-deep hover:bg-romantic-hover text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all disabled:opacity-50 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> মেসেজ যোগ করুন
              </button>
            </section>

          </div>

          {/* Right Live Preview Area (Mobile Device Frame) */}
          <div className="flex-1 bg-black/10 dark:bg-black/30 p-3 sm:p-6 flex flex-col items-center justify-start overflow-y-auto">
            
            <div className="mb-2 text-xs text-text-muted font-bold flex items-center gap-2">
              <span>লাইভ মোবাইল প্রিভিউ (Mobile Width, Auto Height)</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-input-bg border border-border-custom">
                {displayedMessages.length} টি মেসেজ
              </span>
            </div>

            {/* The Actual Captured Canvas Frame */}
            <div
              ref={previewRef}
              style={{
                fontFamily: '"Hind Siliguri", "Inter", sans-serif',
              }}
              className={`w-full max-w-[390px] shadow-2xl rounded-[32px] overflow-hidden border transition-all flex flex-col shrink-0 ${
                frameTheme === 'dark'
                  ? 'bg-slate-950 text-slate-100 border-slate-800'
                  : 'bg-white text-slate-800 border-slate-200'
              }`}
            >
              {/* Mobile Phone Status Bar */}
              {showStatusBar && (
                <div
                  className={`px-5 pt-3 pb-1 flex items-center justify-between text-xs font-semibold select-none ${
                    frameTheme === 'dark' ? 'text-slate-300' : 'text-slate-800'
                  }`}
                >
                  <span className="font-bold tracking-tight text-[11px]">{currentTimeText}</span>
                  {/* Dynamic Island / Notch Pill */}
                  <div className="w-20 h-4 bg-black/90 rounded-full mx-auto" />
                  <div className="flex items-center gap-1.5 text-[10px]">
                    <Wifi className="w-3.5 h-3.5" />
                    <span className="font-bold">5G</span>
                    <div className="flex items-center gap-0.5 font-bold">
                      <span>{batteryLevel}%</span>
                      <Battery className="w-3.5 h-3.5" />
                    </div>
                  </div>
                </div>
              )}

              {/* Chat Header */}
              {showHeader && (
                <div
                  className={`px-3.5 py-2.5 flex items-center justify-between border-b ${
                    frameTheme === 'dark'
                      ? 'bg-slate-900/90 border-slate-800/80'
                      : 'bg-slate-50/95 border-slate-100'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <ChevronLeft className="w-5 h-5 text-romantic-deep shrink-0 -ml-1 cursor-pointer" />
                    <div className="relative shrink-0">
                      <img
                        src={headerAvatar}
                        alt={headerName}
                        crossOrigin="anonymous"
                        className="w-10 h-10 rounded-full object-cover border border-romantic-deep/30 shadow-sm"
                      />
                      <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white dark:border-slate-900 rounded-full" />
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-bold text-sm leading-tight truncate flex items-center gap-1">
                        <span>{headerName}</span>
                        <Sparkles className="w-3 h-3 text-romantic-deep" />
                      </h4>
                      <p className="text-[10px] text-green-600 dark:text-green-400 font-semibold truncate leading-none mt-0.5">
                        {headerSubtitle}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-romantic-deep">
                    <Video className="w-4 h-4 cursor-pointer" />
                    <Phone className="w-4 h-4 cursor-pointer" />
                    <MoreVertical className="w-4 h-4 text-text-muted cursor-pointer" />
                  </div>
                </div>
              )}

              {/* Chat Conversation Body */}
              <div
                className={`p-3.5 space-y-2.5 min-h-[220px] flex-1 ${
                  frameTheme === 'dark'
                    ? 'bg-gradient-to-b from-slate-950 to-slate-900'
                    : 'bg-gradient-to-b from-rose-50/40 via-white to-pink-50/30'
                }`}
              >
                {/* Date separator */}
                <div className="flex justify-center my-1">
                  <span className="text-[10px] font-semibold px-2.5 py-0.5 rounded-full bg-black/5 dark:bg-white/10 text-text-muted">
                    আজ
                  </span>
                </div>

                {displayedMessages.length === 0 ? (
                  <div className="text-center py-12 text-xs text-text-muted">
                    কোনো মেসেজ সিলেক্ট করা নেই। বাম পাশের তালিকা থেকে মেসেজ সিলেক্ট করুন।
                  </div>
                ) : (
                  displayedMessages.map((msg) => {
                    // Logic based on POV:
                    // If POV is 'shafin': Shafin's message is on the RIGHT (sent), Tasfi's message is on the LEFT (received).
                    // If POV is 'tasfi': Tasfi's message is on the RIGHT (sent), Shafin's message is on the LEFT (received).
                    const isOutgoing =
                      pov === 'shafin' ? msg.sender === 'shafin' : msg.sender === 'tasfi';
                    const avatarToShow =
                      msg.sender === 'shafin' ? shafinAvatar : localTasfiAvatar;

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
                            className="w-6 h-6 rounded-full object-cover shrink-0 mb-0.5 border border-black/10 dark:border-white/10"
                          />
                        )}

                        {/* Bubble */}
                        <div
                          className={`max-w-[78%] px-3.5 py-2 rounded-2xl shadow-sm text-[12.5px] leading-relaxed relative ${
                            isOutgoing
                              ? frameTheme === 'dark'
                                ? 'bg-gradient-to-r from-pink-600 to-rose-700 text-white rounded-br-xs'
                                : 'bg-gradient-to-r from-pink-500 to-rose-600 text-white rounded-br-xs'
                              : frameTheme === 'dark'
                              ? 'bg-slate-800 text-slate-100 border border-slate-700 rounded-bl-xs'
                              : 'bg-white text-slate-800 border border-rose-100/80 shadow-xs rounded-bl-xs'
                          }`}
                        >
                          <div className="markdown-body font-sans select-none break-words">
                            <Markdown remarkPlugins={[remarkBreaks]}>
                              {msg.content}
                            </Markdown>
                          </div>

                          {/* Time & Double Checkmarks */}
                          <div
                            className={`flex items-center justify-end gap-1 mt-1 text-[9px] ${
                              isOutgoing
                                ? 'text-white/80'
                                : frameTheme === 'dark'
                                ? 'text-slate-400'
                                : 'text-slate-400'
                            }`}
                          >
                            <span>{msg.time}</span>
                            {isOutgoing && (
                              <CheckCheck className="w-3 h-3 text-cyan-200" />
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Chat Input Bar */}
              {showInputBar && (
                <div
                  className={`p-2.5 px-3 border-t flex items-center gap-2 ${
                    frameTheme === 'dark'
                      ? 'bg-slate-900 border-slate-800'
                      : 'bg-white border-slate-100'
                  }`}
                >
                  <Smile className="w-5 h-5 text-text-muted shrink-0 cursor-pointer" />
                  <div
                    className={`flex-1 px-3 py-1.5 rounded-full text-xs flex items-center justify-between border ${
                      frameTheme === 'dark'
                        ? 'bg-slate-950 border-slate-800 text-slate-400'
                        : 'bg-slate-100 border-slate-200 text-slate-500'
                    }`}
                  >
                    <span>
                      {inputDraftText.trim()
                        ? inputDraftText
                        : pov === 'shafin'
                        ? 'মেসেজ লিখুন...'
                        : 'শাফিনকে মেসেজ লিখুন...'}
                    </span>
                    <Paperclip className="w-3.5 h-3.5 text-text-muted" />
                  </div>
                  <div className="p-2 rounded-full bg-romantic-deep text-white shadow-sm shrink-0 flex items-center justify-center">
                    {inputDraftText.trim() ? (
                      <Send className="w-3.5 h-3.5" />
                    ) : (
                      <Mic className="w-3.5 h-3.5" />
                    )}
                  </div>
                </div>
              )}

              {/* Watermark */}
              {showWatermark && (
                <div className="py-1 bg-black/5 dark:bg-white/5 text-center text-[9px] text-text-muted font-bold font-mono">
                  Tasfi AI • Psycho Shafin
                </div>
              )}
            </div>

            {/* Quick Actions Under Preview */}
            <div className="mt-3 flex items-center gap-2">
              <button
                onClick={handleDownloadImage}
                disabled={isExporting || displayedMessages.length === 0}
                className="px-4 py-2 bg-romantic-deep hover:bg-romantic-hover text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>{isExporting ? 'তৈরি হচ্ছে...' : 'ছবি ডাউনলোড (PNG)'}</span>
              </button>

              <button
                onClick={handleCopyImage}
                disabled={isExporting || displayedMessages.length === 0}
                className="px-3.5 py-2 bg-card-bg hover:bg-input-bg text-text-main border border-border-custom rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
              >
                {copySuccess ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                <span>{copySuccess ? 'কপি হয়েছে' : 'ক্লিপবোর্ডে কপি'}</span>
              </button>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};
