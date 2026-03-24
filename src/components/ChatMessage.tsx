import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import Markdown from 'react-markdown';
import { motion, AnimatePresence, useMotionValue, useTransform } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Heart, Smile, ThumbsUp, Reply, MoreHorizontal, Volume2, VolumeX, Loader2, Trash2, Edit3, X, Check, Clock, Copy } from 'lucide-react';
import { geminiService } from '../services/geminiService';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface ChatMessageProps {
  id: string;
  role: 'user' | 'model';
  content: string;
  timestamp: Date;
  reactions?: string[];
  expiresAt?: Date;
  replyTo?: {
    id: string;
    content: string;
    role: 'user' | 'model';
  };
  mood?: string;
  onReact?: (id: string, emoji: string) => void;
  onReply?: (id: string) => void;
  onDelete?: (id: string) => void;
  onEdit?: (id: string, newContent: string) => void;
}

const EMOJIS = ['❤️', '😂', '👍', '😮', '🙏'];

export const ChatMessage: React.FC<ChatMessageProps> = ({ 
  id, 
  role, 
  content, 
  timestamp, 
  reactions = [], 
  expiresAt,
  replyTo,
  mood = 'normal',
  onReact,
  onReply,
  onDelete,
  onEdit
}) => {
  const isUser = role === 'user';
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(content);
  
  // Swipe to Reply State
  const dragX = useMotionValue(0);
  const replyIconOpacity = useTransform(dragX, [0, 60], [0, 1]);
  const replyIconScale = useTransform(dragX, [0, 60], [0.5, 1.2]);
  const replyIconX = useTransform(dragX, [0, 60], [-20, 0]);

  // TTS State
  const [isPlaying, setIsPlaying] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const touchStartPos = useRef<{ x: number, y: number } | null>(null);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const handleToggleVoice = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isPlaying) {
      audioRef.current?.pause();
      setIsPlaying(false);
      return;
    }

    if (audioRef.current) {
      audioRef.current.play();
      setIsPlaying(true);
      return;
    }

    setIsBuffering(true);
    try {
      const audioUrl = await geminiService.generateVoice(content, role, mood);
      if (audioUrl) {
        const audio = new Audio(audioUrl);
        audioRef.current = audio;
        audio.onended = () => setIsPlaying(false);
        audio.play();
        setIsPlaying(true);
      }
    } catch (error) {
      console.error("Voice playback error:", error);
    } finally {
      setIsBuffering(false);
    }
  };

  const handleLongPressStart = (e: React.MouseEvent | React.TouchEvent) => {
    if ('touches' in e) {
      touchStartPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
    longPressTimer.current = setTimeout(() => {
      setIsMenuOpen(true);
      if (window.navigator.vibrate) {
        window.navigator.vibrate(50);
      }
    }, 500); 
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStartPos.current) return;
    const dx = Math.abs(e.touches[0].clientX - touchStartPos.current.x);
    const dy = Math.abs(e.touches[0].clientY - touchStartPos.current.y);
    if (dx > 10 || dy > 10) {
      handleLongPressEnd();
    }
  };

  const handleLongPressEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
    }
    touchStartPos.current = null;
  };

  const handleSaveEdit = () => {
    if (editValue.trim() && editValue !== content) {
      onEdit?.(id, editValue);
    }
    setIsEditing(false);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setIsMenuOpen(false);
  };

  const handleDragEnd = (_: any, info: any) => {
    if (info.offset.x > 80) {
      onReply?.(id);
      if (window.navigator.vibrate) {
        window.navigator.vibrate(30);
      }
    }
    dragX.set(0);
  };

  const scrollToOriginal = (messageId: string) => {
    const element = document.getElementById(`msg-${messageId}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      element.classList.add('highlight-message');
      setTimeout(() => {
        element.classList.remove('highlight-message');
      }, 2000);
    }
  };

  const menuContent = (
    <AnimatePresence>
      {isMenuOpen && (
        <div key="message-menu-container" className="fixed inset-0 z-[99999] flex items-end justify-center sm:p-4">
          <motion.div
            key="message-menu-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsMenuOpen(false)}
            className="absolute inset-0 bg-black/60 backdrop-blur-[2px]"
          />
          <motion.div
            key="message-menu-content"
            initial={{ y: "100%", opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0 }}
            className="relative w-full sm:max-w-sm bg-card-bg rounded-t-[2.5rem] sm:rounded-[2.5rem] shadow-2xl overflow-hidden border-t border-x sm:border border-border-custom pb-10 sm:pb-0"
          >
            {/* Reactions Bar */}
            <div className="p-6 border-b border-border-custom flex justify-around items-center bg-romantic-pink/5">
              {EMOJIS.map(emoji => (
                <button
                  key={emoji}
                  onClick={() => {
                    onReact?.(id, emoji);
                    setIsMenuOpen(false);
                  }}
                  className="text-3xl hover:scale-125 transition-transform p-2 active:scale-90"
                >
                  {emoji}
                </button>
              ))}
            </div>

            {/* Actions List */}
            <div className="p-3">
              <button
                onClick={() => {
                  onReply?.(id);
                  setIsMenuOpen(false);
                }}
                className="w-full flex items-center gap-4 px-5 py-4 hover:bg-romantic-pink/10 rounded-2xl transition-colors text-text-main"
              >
                <Reply className="w-5 h-5 text-blue-500" />
                <span className="font-semibold">রিপ্লাই</span>
              </button>
              
              <button
                onClick={handleCopy}
                className="w-full flex items-center gap-4 px-5 py-4 hover:bg-romantic-pink/10 rounded-2xl transition-colors text-text-main"
              >
                <Copy className="w-5 h-5 text-indigo-500" />
                <span className="font-semibold">কপি করুন</span>
              </button>

              {isUser && (
                <button
                  onClick={() => {
                    setIsEditing(true);
                    setIsMenuOpen(false);
                  }}
                  className="w-full flex items-center gap-4 px-5 py-4 hover:bg-romantic-pink/10 rounded-2xl transition-colors text-text-main"
                >
                  <Edit3 className="w-5 h-5 text-emerald-500" />
                  <span className="font-semibold">এডিট</span>
                </button>
              )}

              <button
                onClick={() => {
                  onDelete?.(id);
                  setIsMenuOpen(false);
                }}
                className="w-full flex items-center gap-4 px-5 py-4 hover:bg-red-50 rounded-2xl transition-colors text-red-500"
              >
                <Trash2 className="w-5 h-5" />
                <span className="font-semibold">ডিলিট</span>
              </button>
            </div>

            <div className="p-5 pt-0">
              <button
                onClick={() => setIsMenuOpen(false)}
                className="w-full py-4 bg-input-bg text-text-muted rounded-2xl font-bold text-sm shadow-inner"
              >
                বাতিল
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );

  return (
    <>
      <div 
        id={`msg-${id}`}
        className={cn(
          "flex w-full mb-5 group relative transition-colors duration-500 rounded-2xl",
          isUser ? "justify-end" : "justify-start"
        )}
      >
        {/* Swipe Reply Indicator (Left side) */}
        <motion.div 
          style={{ opacity: replyIconOpacity, scale: replyIconScale, x: replyIconX }}
          className="absolute left-4 top-1/2 -translate-y-1/2 p-2 text-romantic-deep pointer-events-none z-0"
        >
          <Reply className="w-6 h-6" />
        </motion.div>

        <motion.div
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={{ left: 0, right: 0.5 }}
          onDragEnd={handleDragEnd}
          style={{ x: dragX }}
          initial={{ opacity: 0, y: 10, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          onMouseDown={handleLongPressStart}
          onMouseUp={handleLongPressEnd}
          onMouseLeave={handleLongPressEnd}
          onTouchStart={handleLongPressStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleLongPressEnd}
          className={cn(
            "flex flex-col max-w-[85%] md:max-w-[70%] cursor-grab active:cursor-grabbing z-10",
            isUser ? "items-end" : "items-start"
          )}
        >
          {/* Reply Context */}
          {replyTo && (
            <button 
              onClick={() => scrollToOriginal(replyTo.id)}
              className={cn(
                "text-[10px] mb-1 px-3 py-1 bg-black/5 rounded-t-lg border-l-2 border-romantic-deep max-w-full truncate opacity-70 text-left hover:bg-black/10 transition-colors",
                isUser ? "mr-2" : "ml-2"
              )}
            >
              <span className="font-bold">{replyTo.role === 'user' ? 'তুমি' : 'তাসফি'}:</span> {replyTo.content}
            </button>
          )}

          <div
            className={cn(
              "relative px-5 py-3.5 rounded-2xl shadow-sm transition-all duration-200",
              isUser 
                ? "bg-romantic-deep text-white rounded-tr-none shadow-romantic-deep/10" 
                : "bg-card-bg text-text-main rounded-tl-none border border-border-custom shadow-black/5",
              isMenuOpen && "scale-[0.98] opacity-80"
            )}
          >
            {isEditing ? (
              <div className="flex flex-col gap-2 min-w-[200px]">
                <textarea
                  autoFocus
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  className="w-full bg-transparent border-none outline-none text-sm resize-none"
                  rows={3}
                />
                <div className="flex justify-end gap-2">
                  <button onClick={() => setIsEditing(false)} className="p-1 hover:bg-white/20 rounded">
                    <X className="w-4 h-4" />
                  </button>
                  <button onClick={handleSaveEdit} className="p-1 hover:bg-white/20 rounded">
                    <Check className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="markdown-body text-sm md:text-base leading-relaxed">
                <Markdown>{content}</Markdown>
              </div>
            )}
            
            <div 
              className={cn(
                "text-[10px] mt-1 opacity-60 flex items-center justify-between gap-4",
                isUser ? "text-white/80" : "text-text-muted"
              )}
            >
              <div className="flex items-center gap-1">
                <span>{timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                {expiresAt && <Clock className="w-2.5 h-2.5" />}
              </div>
              
              <button 
                onClick={handleToggleVoice}
                disabled={isBuffering}
                className={cn(
                  "p-1 rounded-full transition-all active:scale-90",
                  isUser ? "hover:bg-white/20" : "hover:bg-romantic-pink/20",
                  isPlaying && "text-romantic-deep"
                )}
              >
                {isBuffering ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : isPlaying ? (
                  <VolumeX className="w-3 h-3" />
                ) : (
                  <Volume2 className="w-3 h-3" />
                )}
              </button>
            </div>

            {/* Reactions Display */}
            {reactions.length > 0 && (
              <div className={cn(
                "absolute -bottom-3 flex flex-wrap gap-1",
                isUser ? "right-0" : "left-0"
              )}>
                {Array.from(new Set(reactions)).map((emoji) => (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    key={emoji}
                    className="bg-white dark:bg-slate-800 rounded-full px-1.5 py-0.5 text-xs shadow-sm border border-border-custom flex items-center gap-1"
                  >
                    <span>{emoji}</span>
                    <span className="text-[10px] font-bold opacity-70">
                      {reactions.filter(r => r === emoji).length}
                    </span>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      </div>

      {/* Messenger-style Bottom Sheet Menu */}
      {createPortal(menuContent, document.body)}
    </>
  );
};
