'use client';

import React from 'react';
import { Lock } from 'lucide-react';

interface MobileLogoutModalProps {
  isOpen: boolean;
  logoutPin: string;
  logoutError: string | null;
  onPinChange: (pin: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onClose: () => void;
}

export function MobileLogoutModal({
  isOpen,
  logoutPin,
  logoutError,
  onPinChange,
  onSubmit,
  onClose,
}: MobileLogoutModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 p-5 rounded-3xl max-w-xs w-full space-y-4 text-center shadow-2xl">
        <div className="w-11 h-11 rounded-full bg-rose-100 text-rose-600 mx-auto flex items-center justify-center">
          <Lock className="w-5 h-5" />
        </div>
        <h4 className="text-sm font-black text-slate-900">دەرچوون لە هەژمار</h4>

        <form onSubmit={onSubmit} className="space-y-3">
          <input
            type="password"
            value={logoutPin}
            onChange={(e) => onPinChange(e.target.value)}
            placeholder="کۆدی نهێنی"
            autoFocus
            className="w-full bg-white border-2 border-slate-300 text-slate-900 text-center font-mono text-base font-bold p-2.5 rounded-xl focus:border-rose-500 focus:outline-none"
          />
          {logoutError && <p className="text-xs text-rose-600 font-bold">{logoutError}</p>}

          <div className="flex gap-2">
            <button
              type="submit"
              className="flex-1 bg-rose-600 hover:bg-rose-700 text-white font-black text-xs py-2.5 rounded-xl cursor-pointer"
            >
              دەرچوون
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs py-2.5 rounded-xl border border-slate-200 cursor-pointer"
            >
              داخستن
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
