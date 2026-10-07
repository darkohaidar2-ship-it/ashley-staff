'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  Bot, 
  Send, 
  RotateCcw, 
  Trash2, 
  X, 
  User, 
  Check, 
  CheckCheck, 
  Sparkles, 
  ShieldCheck, 
  ShieldAlert,
  Smartphone,
  FileText,
  CornerDownLeft,
  LogIn,
  LogOut,
  Clock,
  Palmtree,
  Receipt,
  Bell,
  Zap,
  MessageSquare
} from 'lucide-react';
import { ASHLEY_OFFICIAL_EMPLOYEES } from '@/lib/ashley-employees';

function getTelegramButtonTheme(label: string) {
  const l = (label || '').toLowerCase();
  if (l.includes('هاتن') || l.includes('check in') || l.includes('دەوام')) {
    return {
      bg: 'bg-gradient-to-r from-emerald-500 via-emerald-600 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white',
      border: 'border-emerald-300/40 ring-1 ring-emerald-400/30',
      text: 'text-white font-black',
      shadow: 'shadow-md shadow-emerald-500/30',
      icon: LogIn,
      iconColor: 'text-white',
    };
  }
  if (l.includes('دەرچوون') || l.includes('check out') || l.includes('ڕۆیشتن')) {
    return {
      bg: 'bg-gradient-to-r from-rose-500 via-rose-600 to-red-600 hover:from-rose-600 hover:to-red-700 text-white',
      border: 'border-rose-300/40 ring-1 ring-rose-400/30',
      text: 'text-white font-black',
      shadow: 'shadow-md shadow-rose-500/30',
      icon: LogOut,
      iconColor: 'text-white',
    };
  }
  if (l.includes('دۆخی دەوامی ئەمڕۆ') || l.includes('ئەمڕۆ')) {
    return {
      bg: 'bg-gradient-to-r from-sky-500 via-sky-600 to-blue-600 hover:from-sky-600 hover:to-blue-700 text-white',
      border: 'border-sky-300/40 ring-1 ring-sky-400/30',
      text: 'text-white font-black',
      shadow: 'shadow-md shadow-sky-500/30',
      icon: Clock,
      iconColor: 'text-white',
    };
  }
  if (l.includes('ئەم مانگەم') || l.includes('ڕاپۆرت') || l.includes('pdf')) {
    return {
      bg: 'bg-gradient-to-r from-indigo-500 via-indigo-600 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white',
      border: 'border-indigo-300/40 ring-1 ring-indigo-400/30',
      text: 'text-white font-black',
      shadow: 'shadow-md shadow-indigo-500/30',
      icon: FileText,
      iconColor: 'text-white',
    };
  }
  if (l.includes('پرۆفایل') || l.includes('profile')) {
    return {
      bg: 'bg-gradient-to-r from-purple-500 via-violet-600 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 text-white',
      border: 'border-purple-300/40 ring-1 ring-purple-400/30',
      text: 'text-white font-black',
      shadow: 'shadow-md shadow-purple-500/30',
      icon: User,
      iconColor: 'text-white',
    };
  }
  if (l.includes('شوێن') || l.includes('locations')) {
    return {
      bg: 'bg-gradient-to-r from-slate-600 via-slate-700 to-slate-800 hover:from-slate-700 hover:to-slate-900 text-white',
      border: 'border-slate-400/40 ring-1 ring-slate-500/30',
      text: 'text-white font-black',
      shadow: 'shadow-md shadow-slate-600/30',
      icon: Sparkles,
      iconColor: 'text-white',
    };
  }
  if (l.includes('مۆڵەت') || l.includes('leave') || l.includes('پشوو')) {
    return {
      bg: 'bg-gradient-to-r from-amber-500 via-amber-600 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white',
      border: 'border-amber-300/40 ring-1 ring-amber-400/30',
      text: 'text-white font-black',
      shadow: 'shadow-md shadow-amber-500/30',
      icon: Palmtree,
      iconColor: 'text-white',
    };
  }
  if (l.includes('مەسروفات') || l.includes('خەرجی') || l.includes('پارە') || l.includes('expense')) {
    return {
      bg: 'bg-gradient-to-r from-teal-500 via-emerald-600 to-teal-700 hover:from-teal-600 hover:to-teal-800 text-white',
      border: 'border-teal-300/40 ring-1 ring-teal-400/30',
      text: 'text-white font-black',
      shadow: 'shadow-md shadow-teal-500/30',
      icon: Receipt,
      iconColor: 'text-white',
    };
  }
  if (l.includes('ئاگاداری') || l.includes('broadcast')) {
    return {
      bg: 'bg-gradient-to-r from-fuchsia-600 via-pink-600 to-rose-600 hover:from-fuchsia-700 hover:to-pink-700 text-white',
      border: 'border-pink-300/40 ring-1 ring-pink-400/30',
      text: 'text-white font-black',
      shadow: 'shadow-md shadow-fuchsia-500/30',
      icon: Bell,
      iconColor: 'text-white',
    };
  }
  if (l.includes('غیاب') || l.includes('absence')) {
    return {
      bg: 'bg-gradient-to-r from-red-600 via-rose-700 to-red-800 hover:from-red-700 hover:to-rose-900 text-white',
      border: 'border-red-400/40 ring-1 ring-red-500/30',
      text: 'text-white font-black',
      shadow: 'shadow-md shadow-red-600/30',
      icon: X,
      iconColor: 'text-white',
    };
  }
  if (l.includes('خێرا') || l.includes('gps')) {
    return {
      bg: 'bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 hover:from-amber-500 hover:to-yellow-500 text-slate-950',
      border: 'border-amber-300 ring-1 ring-amber-400',
      text: 'text-slate-950 font-black',
      shadow: 'shadow-md shadow-amber-500/30',
      icon: Zap,
      iconColor: 'text-slate-950',
    };
  }
  return {
    bg: 'bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-700 hover:to-indigo-700 text-white',
    border: 'border-blue-400/40 ring-1 ring-blue-500/30',
    text: 'text-white font-black',
    shadow: 'shadow-md shadow-blue-600/30',
    icon: Sparkles,
    iconColor: 'text-white',
  };
}

interface ChatMessage {
  id: string;
  sender: 'user' | 'bot';
  text: string;
  photoUrl?: string | null;
  documentName?: string | null;
  inlineKeyboard?: Array<Array<{ text: string; callback_data: string }>>;
  time: string;
  hasPermission?: boolean;
}

interface TelegramBotSimulatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultEmployeeId?: string;
}

export function TelegramBotSimulatorModal({
  isOpen,
  onClose,
  defaultEmployeeId = 'emp-01',
}: TelegramBotSimulatorModalProps) {
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>(defaultEmployeeId);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [keyboardRows, setKeyboardRows] = useState<Array<Array<{ text: string }>>>([]);
  const [inputText, setInputText] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const chatScrollRef = useRef<HTMLDivElement>(null);

  const selectedEmployee = ASHLEY_OFFICIAL_EMPLOYEES.find(e => e.id === selectedEmployeeId) || ASHLEY_OFFICIAL_EMPLOYEES[0];

  const getTimeNow = () => {
    const d = new Date();
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  };

  // Run a command or text in the simulator
  const handleSendCommand = async (textToSend: string, callbackData?: string) => {
    if (!textToSend && !callbackData) return;
    if (isLoading) return;

    const time = getTimeNow();
    if (textToSend) {
      setMessages(prev => [
        ...prev,
        {
          id: `msg-${Date.now()}-${Math.random()}`,
          sender: 'user',
          text: textToSend,
          time,
        }
      ]);
      setInputText('');
    }

    setIsLoading(true);

    try {
      const res = await fetch('/api/telegram/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeId: selectedEmployeeId,
          text: textToSend,
          callbackData,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.reply) {
          setMessages(prev => [
            ...prev,
            {
              id: `msg-${Date.now()}-${Math.random()}`,
              sender: 'bot',
              text: data.reply,
              photoUrl: data.photoUrl,
              documentName: data.documentName,
              inlineKeyboard: data.inlineKeyboard,
              time: getTimeNow(),
              hasPermission: data.hasPermission,
            }
          ]);
        }
        if (data.keyboard && Array.isArray(data.keyboard.keyboard)) {
          setKeyboardRows(data.keyboard.keyboard);
        }
      }
    } catch (err) {
      setMessages(prev => [
        ...prev,
        {
          id: `msg-${Date.now()}`,
          sender: 'bot',
          text: '❌ کێشەیەک ڕوویدا لە پەیوەندی لەگەڵ سێرڤەری تێست.',
          time: getTimeNow(),
          hasPermission: false,
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  // Reset or initialize when selected employee changes
  useEffect(() => {
    if (isOpen) {
      setMessages([]);
      handleSendCommand('/start');
    }
  }, [selectedEmployeeId, isOpen]);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in font-sans dir-rtl" dir="rtl">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-700/80 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Top Header */}
        <div className="px-5 py-3.5 bg-slate-800/90 border-b border-slate-700/80 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-sky-500 to-blue-600 text-white flex items-center justify-center shadow-lg shadow-sky-500/20">
              <Bot className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-black text-white">
                  تاقیگەی بۆتی تەلەگرام
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-500/20 text-sky-300 border border-sky-500/30">
                  تەلەگرام
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                تاقیکردنەوەی دەسەڵاتەکان و بینینی دوگمەکانی بۆت وەک هەر کارمەندێک
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setMessages([]);
                handleSendCommand('/start');
              }}
              title="سەرلەنوێ دەستپێکردنەوە (/start)"
              className="p-2 rounded-xl bg-slate-700/60 hover:bg-slate-700 text-slate-300 hover:text-white transition-all cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            <button
              onClick={() => setMessages([])}
              title="سڕینەوەی نامەکان"
              className="p-2 rounded-xl bg-slate-700/60 hover:bg-slate-700 text-slate-300 hover:text-white transition-all cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/40 text-rose-300 transition-all cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Employee Switcher Bar */}
        <div className="p-3 bg-slate-800/40 border-b border-slate-700/60 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5 flex-1 min-w-[260px]">
            <span className="text-[11px] font-bold text-slate-400 shrink-0">
              👤 تاقیکردنەوە وەک:
            </span>
            <select
              value={selectedEmployeeId}
              onChange={(e) => setSelectedEmployeeId(e.target.value)}
              className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-xs font-bold text-white outline-none focus:border-sky-500 cursor-pointer"
            >
              {ASHLEY_OFFICIAL_EMPLOYEES.map((emp) => (
                <option key={emp.id} value={emp.id} className="bg-slate-900 text-white">
                  {emp.name} ({emp.id}) — {emp.role}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="px-2.5 py-1 rounded-lg bg-blue-950/60 text-blue-300 border border-blue-800 text-[11px] font-bold">
              {selectedEmployee.role}
            </span>
          </div>
        </div>

        {/* Telegram Chat Simulation Body */}
        <div 
          ref={chatScrollRef}
          className="flex-1 p-4 overflow-y-auto space-y-3 bg-[#0e1621] bg-radial from-slate-900/50 to-[#0e1621]"
          style={{ minHeight: '340px' }}
        >
          {messages.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-center p-8 text-slate-500 space-y-2">
              <Bot className="w-10 h-10 text-slate-600 animate-bounce" />
              <p className="text-xs font-bold text-slate-400">بۆتی تەلەگرام لە دۆخی ئامادەباشیدایە...</p>
              <p className="text-[11px] text-slate-600">یەکێک لە دوگمەکانی خوارەوە هەڵبژێرە یان فەرمانێک بنووسە.</p>
            </div>
          )}

          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
            >
              <div
                className={`max-w-[85%] sm:max-w-[78%] rounded-2xl px-4 py-3 text-xs leading-relaxed shadow-md ${
                  msg.sender === 'user'
                    ? 'bg-[#2b5278] text-white rounded-br-xs'
                    : 'bg-[#182533] text-slate-100 rounded-bl-xs border border-slate-700/50'
                }`}
              >
                {/* Photo Attachment Preview if available */}
                {msg.photoUrl && (
                  <div className="mb-2.5 rounded-xl overflow-hidden border border-white/10 max-h-48 bg-slate-950 flex items-center justify-center">
                    <img 
                      src={msg.photoUrl} 
                      alt="Telegram Attachment" 
                      className="w-full h-full object-cover max-h-48"
                    />
                  </div>
                )}

                {/* Document / PDF Badge if available */}
                {msg.documentName && (
                  <div className="mb-2.5 p-2.5 rounded-xl bg-slate-900/80 border border-sky-500/30 flex items-center gap-2.5 text-sky-300">
                    <FileText className="w-5 h-5 text-sky-400 shrink-0" />
                    <div className="flex-1 truncate">
                      <span className="font-bold text-[11px] block truncate">{msg.documentName}</span>
                      <span className="text-[10px] text-slate-400 block font-mono">Adobe PDF Document</span>
                    </div>
                  </div>
                )}

                {/* Message Body (HTML rendered for Telegram tags) */}
                <div 
                  className="space-y-1 font-sans break-words whitespace-pre-wrap"
                  dangerouslySetInnerHTML={{ __html: msg.text }}
                />

                {/* Inline Keyboard Buttons */}
                {msg.inlineKeyboard && msg.inlineKeyboard.length > 0 && (
                  <div className="mt-3 pt-2.5 border-t border-white/10 space-y-1.5">
                    {msg.inlineKeyboard.map((row, rIdx) => (
                      <div key={rIdx} className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                        {row.map((btn, bIdx) => (
                          <button
                            key={bIdx}
                            onClick={() => handleSendCommand('', btn.callback_data)}
                            className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-sky-600/30 to-blue-600/30 hover:from-sky-600/50 hover:to-blue-600/50 active:scale-95 text-sky-200 border border-sky-400/40 text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs truncate"
                          >
                            <Zap className="w-3.5 h-3.5 text-sky-300 shrink-0" />
                            <span className="truncate">{btn.text}</span>
                          </button>
                        ))}
                      </div>
                    ))}
                  </div>
                )}

                {/* Timestamp */}
                <div className="flex items-center justify-end gap-1 mt-1 text-[10px] text-slate-400">
                  <span>{msg.time}</span>
                  {msg.sender === 'user' && <CheckCheck className="w-3 h-3 text-sky-300" />}
                </div>
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex items-center gap-2 text-slate-400 text-xs py-1">
              <span className="w-2 h-2 rounded-full bg-sky-400 animate-ping" />
              <span>بۆت خەریکی نووسینە (typing...)...</span>
            </div>
          )}
        </div>

        {/* Interactive Dynamic Keyboard Area (Exact Telegram Buttons) */}
        <div className="p-3 bg-slate-950 border-t border-slate-800 space-y-2">
          <div className="flex items-center justify-between px-1">
            <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1">
              <Smartphone className="w-3.5 h-3.5 text-sky-400" />
              <span>دوگمە فەرمییەکانی ئەم کارمەندە لە تەلەگرام ({keyboardRows.flat().length}):</span>
            </span>
            <span className="text-[10px] text-slate-500">کلیک لە هەر دوگمەیەک بکە</span>
          </div>

          {/* Keyboard Grid */}
          <div className="space-y-1.5 max-h-36 overflow-y-auto p-1 bg-slate-900/60 rounded-2xl border border-slate-800">
            {keyboardRows.length === 0 ? (
              <div className="p-3 text-center text-xs text-slate-500">
                هیچ دوگمەیەک بۆ ئەم کارمەندە کارا نەکراوە.
              </div>
            ) : (
              keyboardRows.map((row, rIdx) => (
                <div 
                  key={rIdx} 
                  className={`grid gap-1.5 ${row.length === 1 ? 'grid-cols-1' : row.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}
                >
                  {row.map((btn, bIdx) => {
                    const theme = getTelegramButtonTheme(btn.text);
                    const BtnIcon = theme.icon;
                    return (
                      <button
                        key={bIdx}
                        onClick={() => handleSendCommand(btn.text)}
                        className={`group relative px-3 py-2.5 rounded-xl ${theme.bg} ${theme.text} border ${theme.border} text-xs font-bold transition-all duration-150 flex items-center justify-center gap-2 cursor-pointer shadow-sm ${theme.shadow} active:scale-[0.96] active:translate-y-0.5 select-none overflow-hidden`}
                        title={btn.text}
                      >
                        <BtnIcon className={`w-3.5 h-3.5 shrink-0 ${theme.iconColor} group-hover:scale-110 transition-transform`} />
                        <span className="truncate tracking-wide">{btn.text}</span>
                      </button>
                    );
                  })}
                </div>
              ))
            )}
          </div>

          {/* Custom Command / Text Input */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendCommand(inputText);
            }}
            className="flex items-center gap-2 pt-1"
          >
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="فەرمانێک بنووسە (وەک /start, /in, /leave)..."
              className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-4 py-2 text-xs text-white placeholder-slate-500 outline-none focus:border-sky-500 transition-all font-mono"
            />
            <button
              type="submit"
              disabled={!inputText.trim() || isLoading}
              className="px-4 py-2 bg-sky-600 hover:bg-sky-500 disabled:opacity-40 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer shrink-0"
            >
              <span>ناردن</span>
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>

      </div>
    </div>
  );
}
