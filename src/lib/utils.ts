import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const WAREHOUSE_COLORS = {
  Huana: {
    bg: 'bg-[#d9f99d]', // Light Green-Yellow
    hover: 'hover:bg-[#bef264]',
    border: 'border-[#bef264]',
    text: 'text-[#365314]',
    hex: '#d9f99d',
    lightHex: '#f7fee7' // Extremely light version for backgrounds
  },
  Ashley: {
    bg: 'bg-[#ffedd5]', // Shared with original design but tailored
    hover: 'hover:bg-[#fed7aa]',
    border: 'border-[#fed7aa]',
    text: 'text-[#7c2d12]',
    hex: '#ffedd5',
    lightHex: '#fff7ed' // Extremely light version for backgrounds
  }
} as const;

export const safeStorage = {
  getItem: (key: string): string | null => {
    try {
      if (typeof window === 'undefined') return null;
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  setItem: (key: string, value: string): boolean => {
    try {
      if (typeof window === 'undefined') return false;
      localStorage.setItem(key, value);
      return true;
    } catch {
      return false;
    }
  },
  removeItem: (key: string): boolean => {
    try {
      if (typeof window === 'undefined') return false;
      localStorage.removeItem(key);
      return true;
    } catch {
      return false;
    }
  }
};

