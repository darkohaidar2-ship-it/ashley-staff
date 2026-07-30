'use client';

import { useState, useEffect, useRef } from 'react';
import { 
  Bot, X, Send, Command, Sparkles, Terminal as TerminalIcon, 
  Zap, Activity, Cpu, ShieldCheck, Database, Globe 
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAppContext } from '@/context/app-provider';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export function AntigravityTerminal() {
  const { excelFiles, employees, orderRequests, locations } = useAppContext();
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: 'SPECTRAL ENGINE v4.0 ONLINE. ALL NODES SYNCHRONIZED. READY FOR INSTRUCTION.' }
  ]);
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsTyping(true);

    // Contextual System Brain
    setTimeout(() => {
      let response = "COMMAND LOGGED. ANALYZING DATA STREAMS...";
      
      const cmd = userMessage.toLowerCase();
      if (cmd.includes('stat') || cmd.includes('count')) {
          response = `SYSTEM DIAGNOSTICS: ${excelFiles.length} ARCHIVES LOADED. ${employees.length} PERSONNEL ACTIVE. ${orderRequests.length} TRANSACTIONS PENDING. ${locations.length} ZONES MAPPED.`;
      } else if (cmd.includes('time') || cmd.includes('date')) {
          response = `TEMPORAL SYNC: ${new Date().toLocaleTimeString()} | LATENCY: 0.001ms.`;
      } else if (cmd.includes('ui') || cmd.includes('code')) {
          response = "UI OPTIMIZATION PROTOCOL INITIATED. COMMUNICATING WITH CORE ARCHITECT FOR LIVE DEPLOYMENT.";
      } else {
          response = "DATA RECEIVED. OPTIMIZING SYSTEM PARAMETERS FOR MAXIMUM EFFICIENCY.";
      }

      setMessages(prev => [...prev, { role: 'assistant', content: response }]);
      setIsTyping(false);
    }, 1200);
  };

  return (
    <>
      {/* High-Tech Pulse Trigger */}
      <div className="fixed bottom-6 right-6 z-[100] print:hidden">
        <button 
            onClick={() => setIsOpen(true)}
            className={cn(
            "relative w-14 h-14 rounded-full bg-black border border-primary/40 flex items-center justify-center transition-all duration-700",
            isOpen ? "scale-0 rotate-180 opacity-0" : "scale-100 rotate-0 opacity-100 hover:scale-110"
            )}
        >
            <div className="absolute inset-0 rounded-full border border-primary/20 animate-ping opacity-20" />
            <div className="absolute inset-[-4px] rounded-full border border-primary/10 animate-pulse" />
            <Activity className="w-5 h-5 text-primary" />
            <div className="absolute top-0 right-0 w-2 h-2 bg-emerald-500 rounded-full border-2 border-black" />
        </button>
      </div>

      {/* Spectral Monolith Drawer */}
      <div 
        className={cn(
          "fixed bottom-6 right-6 w-[450px] h-[650px] bg-zinc-950/95 backdrop-blur-3xl border border-white/5 rounded-[2rem] flex flex-col z-[100] transition-all duration-700 origin-bottom-right shadow-[0_0_100px_rgba(0,0,0,1)] overflow-hidden",
          isOpen ? "translate-y-0 scale-100 opacity-100" : "translate-y-12 scale-90 opacity-0 pointer-events-none"
        )}
      >
        {/* Animated Scanning Overlay */}
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent animate-scan" />
        
        {/* Header: System Metrics Area */}
        <div className="p-8 border-b border-white/5 space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                        <Zap className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex flex-col">
                        <span className="text-[10px] font-black uppercase tracking-[0.4em] text-primary">Antigravity</span>
                        <span className="text-[8px] font-bold uppercase tracking-[0.2em] text-white/30">Intelligence Node 01</span>
                    </div>
                </div>
                <button onClick={() => setIsOpen(false)} className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors">
                    <X className="w-3.5 h-3.5 text-white/50" />
                </button>
            </div>

            <div className="grid grid-cols-3 gap-2">
                {[
                    { label: 'CPU', value: '1.2%', icon: Cpu },
                    { label: 'NET', value: '0.0ms', icon: Globe },
                    { label: 'SEC', value: 'ENC', icon: ShieldCheck }
                ].map((stat, i) => (
                    <div key={i} className="bg-white/[0.02] border border-white/5 p-3 rounded-2xl flex items-center gap-3">
                        <stat.icon className="w-3 h-3 text-primary/60" />
                        <div className="flex flex-col">
                            <span className="text-[7px] font-black text-white/20 uppercase tracking-widest">{stat.label}</span>
                            <span className="text-[9px] font-black text-white/80 tabular-nums">{stat.value}</span>
                        </div>
                    </div>
                ))}
            </div>
        </div>

        {/* Content: Terminal Stream */}
        <div 
          ref={scrollRef}
          className="flex-1 overflow-y-auto p-8 space-y-6 scrollbar-none mask-fade-top"
        >
          {messages.map((m, i) => (
            <div key={i} className={cn(
              "flex flex-col gap-3 group",
              m.role === 'user' ? "items-start" : "items-start"
            )}>
              <div className="flex items-center gap-2">
                <div className={cn("w-1 h-1 rounded-full", m.role === 'user' ? "bg-white/40" : "bg-primary")} />
                <span className="text-[8px] font-black uppercase tracking-widest text-white/20">
                    {m.role === 'user' ? 'Input' : 'Spectral'}
                </span>
              </div>
              <div className={cn(
                "text-[12px] font-bold leading-relaxed tracking-wide font-mono",
                m.role === 'user' ? "text-white/40 italic" : "text-white/90"
              )}>
                {m.content}
              </div>
            </div>
          ))}
          {isTyping && (
            <div className="flex gap-2 items-center text-[10px] font-black text-primary animate-pulse tracking-widest">
               <Database className="w-3 h-3" /> ANALYZING...
            </div>
          )}
        </div>

        {/* Input: Command Grid */}
        <div className="p-8 border-t border-white/5 bg-zinc-950/20">
          <div className="relative group">
            <Input 
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Enter System Command"
              className="bg-transparent border-0 border-b border-white/10 text-[12px] font-bold h-12 px-0 focus-visible:ring-0 rounded-none placeholder:text-white/10 placeholder:uppercase"
            />
            <div className="absolute top-0 right-0 h-full flex items-center">
                <div className="text-[8px] font-black text-primary/40 flex items-center gap-2">
                    <Command className="w-3 h-3" /> ENTER
                </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
