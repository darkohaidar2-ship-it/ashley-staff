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
  CornerDownLeft
} from 'lucide-react';
import { ASHLEY_OFFICIAL_EMPLOYEES } from '@/lib/ashley-employees';

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
                  تاقیگەی تێست بۆتی تەلەگرام
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-500/20 text-sky-300 border border-sky-500/30">
                  Simulator Live
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
                            className="px-3 py-1.5 rounded-lg bg-sky-600/30 hover:bg-sky-600/50 active:scale-95 text-sky-200 border border-sky-500/40 text-[11px] font-bold transition-all text-center cursor-pointer truncate"
                          >
                            {btn.text}
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
                  {row.map((btn, bIdx) => (
                    <button
                      key={bIdx}
                      onClick={() => handleSendCommand(btn.text)}
                      className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-200 border border-slate-700 text-xs font-bold transition-all text-center cursor-pointer shadow-xs truncate"
                      title={btn.text}
                    >
                      {btn.text}
                    </button>
                  ))}
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
