'use client';

import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from '@/hooks/use-translation';
import { useAuth } from '@/hooks/use-auth';
import { useAppContext } from '@/context/app-provider';
import { cn } from '@/lib/utils';
import { Edit3, Palette, RotateCcw, Check } from 'lucide-react';

interface EditableTextProps extends React.HTMLAttributes<HTMLSpanElement> {
  keyName: string;
  variables?: Record<string, any>;
  as?: 'span' | 'h1' | 'h2' | 'h3' | 'h4' | 'p' | 'div';
}

const COLOR_PRESETS = [
  { name: 'Cyan', class: 'text-cyan-500', hex: '#06b6d4' },
  { name: 'Purple', class: 'text-purple-500', hex: '#a855f7' },
  { name: 'Emerald', class: 'text-emerald-500', hex: '#10b981' },
  { name: 'Amber', class: 'text-amber-500', hex: '#f59e0b' },
  { name: 'Pink', class: 'text-pink-500', hex: '#ec4899' },
  { name: 'Blue', class: 'text-blue-500', hex: '#3b82f6' },
];

export function EditableText({ keyName, variables, as: Component = 'span', className, ...props }: EditableTextProps) {
  const { t, language, translations, setTranslations } = useTranslation();
  const { settings, setSettings } = useAppContext();
  const { hasPermission } = useAuth();
  
  const [isEditing, setIsEditing] = useState(false);
  const [value, setValue] = useState('');
  const [showMenu, setShowMenu] = useState(false);
  const [menuPos, setMenuPos] = useState({ x: 0, y: 0 });
  const [isMounted, setIsMounted] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const isAdmin = hasPermission('admin:all');
  const translatedText = t(keyName, variables);

  const activeColor = settings?.customColors?.[keyName] || '';

  useEffect(() => {
    setIsMounted(true);
    return () => setIsMounted(false);
  }, []);

  useEffect(() => {
    if (isEditing) {
      setValue(translatedText);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isEditing, translatedText]);

  // Handle click outside to close menu
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    };
    if (showMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showMenu]);

  const handleSave = () => {
    setIsEditing(false);
    if (value.trim() && value !== translatedText) {
      const currentLangTranslations = translations[language] || {};
      setTranslations(language, {
        ...currentLangTranslations,
        [keyName]: value.trim(),
      });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      setIsEditing(false);
    }
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    if (!isAdmin) return;
    e.preventDefault();
    setMenuPos({ x: e.clientX, y: e.clientY });
    setShowMenu(true);
  };

  const selectColor = (colorClass: string) => {
    setShowMenu(false);
    if (settings) {
      const updatedColors = { ...(settings.customColors || {}), [keyName]: colorClass };
      setSettings({ ...settings, customColors: updatedColors });
    }
  };

  const handleReset = () => {
    setShowMenu(false);
    if (settings) {
      const updatedColors = { ...(settings.customColors || {}) };
      delete updatedColors[keyName];
      setSettings({ ...settings, customColors: updatedColors });
    }
  };

  if (isEditing && isAdmin) {
    return (
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={handleSave}
        onKeyDown={handleKeyDown}
        className={cn(
          "bg-white/10 dark:bg-black/20 border border-primary/45 rounded px-1.5 py-0.5 text-foreground focus:outline-none focus:ring-1 focus:ring-primary w-full max-w-[220px] text-xs font-semibold inline-block",
          className
        )}
      />
    );
  }

  return (
    <>
      <Component
        onContextMenu={handleContextMenu}
        onDoubleClick={() => isAdmin && setIsEditing(true)}
        className={cn(
          className,
          activeColor,
          isAdmin && "cursor-pointer hover:bg-primary/5 hover:text-primary transition-all rounded px-0.5 border border-dashed border-transparent hover:border-primary/20",
          isAdmin && isEditing && "opacity-0"
        )}
        title={isAdmin ? "کلیکی ڕاست بکە بۆ بژاردەکان / دووجار کلیک بکە بۆ دەستکاریکردنی دەق" : undefined}
        {...props}
      >
        {translatedText}
      </Component>

      {/* Right-click Context Menu Portal */}
      {isMounted && showMenu && isAdmin && createPortal(
        <div
          ref={menuRef}
          style={{ top: menuPos.y, left: menuPos.x }}
          className="fixed z-[10000] w-48 bg-card/90 backdrop-blur-xl border border-border/80 rounded-xl p-1.5 shadow-xl animate-in fade-in zoom-in-95 duration-100 flex flex-col gap-1 text-right"
          dir="rtl"
        >
          {/* Edit Text option */}
          <button
            onClick={() => { setShowMenu(false); setIsEditing(true); }}
            className="flex items-center justify-between w-full px-2.5 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-all text-right"
          >
            <span>دەستکاریکردنی دەق</span>
            <Edit3 className="w-3.5 h-3.5 text-primary" />
          </button>

          <div className="h-px bg-border/60 my-0.5" />

          {/* Color Presets */}
          <div className="px-2.5 py-1 text-[9px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
            <Palette className="w-3 h-3 text-primary" />
            <span>گۆڕینی ڕەنگ</span>
          </div>

          <div className="grid grid-cols-6 gap-1 px-1.5 py-1">
            {COLOR_PRESETS.map((color) => (
              <button
                key={color.name}
                onClick={() => selectColor(color.class)}
                className="w-6 h-6 rounded-md border border-border/40 flex items-center justify-center transition-all hover:scale-110 active:scale-95"
                style={{ backgroundColor: color.hex }}
                title={color.name}
              >
                {activeColor === color.class && <Check className="w-3 h-3 text-white drop-shadow" />}
              </button>
            ))}
          </div>

          <div className="h-px bg-border/60 my-0.5" />

          {/* Reset option */}
          <button
            onClick={handleReset}
            className="flex items-center justify-between w-full px-2.5 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider text-destructive hover:bg-destructive/10 transition-all text-right"
          >
            <span>گێڕانەوەی سەرەتایی</span>
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>,
        document.body
      )}
    </>
  );
}
