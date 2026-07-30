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
