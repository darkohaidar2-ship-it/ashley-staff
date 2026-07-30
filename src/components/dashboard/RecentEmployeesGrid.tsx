'use client';

import { useAppContext } from '@/context/app-provider';
import { useTranslation } from '@/hooks/use-translation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, User as UserIcon } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { EditableText } from '@/components/shared/editable-text';
import { cn } from '@/lib/utils';

export function RecentEmployeesGrid() {
  const { t } = useTranslation();
  const { employees, settings } = useAppContext();
  const customColor = settings?.customColors?.['team_members'] || '';

  const getCardStyle = () => {
    if (customColor.includes('cyan')) return 'border-cyan-500/30 shadow-[0_8px_30px_rgba(6,182,212,0.08)]';
    if (customColor.includes('purple')) return 'border-purple-500/30 shadow-[0_8px_30px_rgba(168,85,247,0.08)]';
    if (customColor.includes('emerald')) return 'border-emerald-500/30 shadow-[0_8px_30px_rgba(16,185,129,0.08)]';
    if (customColor.includes('amber')) return 'border-amber-500/30 shadow-[0_8px_30px_rgba(245,158,11,0.08)]';
    if (customColor.includes('pink')) return 'border-pink-500/30 shadow-[0_8px_30px_rgba(236,72,153,0.08)]';
    if (customColor.includes('blue')) return 'border-blue-500/30 shadow-[0_8px_30px_rgba(59,130,246,0.08)]';
    return 'border-border shadow-sm';
  };

  return (
    <Card id="recent-employees" className={cn("win-card relative group overflow-hidden bg-card border transition-all duration-700", getCardStyle())}>
      <CardHeader className="py-4 px-6 border-b border-border flex flex-row items-center justify-between">
        <CardTitle className="text-xs font-black uppercase tracking-[0.2em] flex items-center gap-2">
            <Users className={cn("w-4 h-4", customColor || "text-primary")} />
            <EditableText keyName="team_members" />
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6">
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-4">
            {employees.map((employee) => (
                <Link 
                  key={employee.id} 
                  href={`/employees/${employee.id}`}
                  className="flex flex-col items-center justify-center p-4 rounded-2xl bg-secondary/50 border border-border hover:bg-primary/10 hover:border-primary/30 transition-all duration-500 group/item cursor-pointer shadow-sm hover:shadow-md"
                >
                    <div className="relative w-14 h-14 mb-3 rounded-2xl overflow-hidden border border-border group-hover/item:border-primary transition-all duration-500 shadow-sm">
                        {employee.photoUrl ? (
                            <Image 
                                src={employee.photoUrl} 
                                alt={employee.name} 
                                fill 
                                className="object-cover transition-transform duration-700 group-hover/item:scale-110"
                            />
                        ) : (
                            <div className="w-full h-full bg-secondary flex items-center justify-center">
                                <UserIcon className="w-6 h-6 text-muted-foreground" />
                            </div>
                        )}
                    </div>
                    <p className="text-[10px] font-black text-foreground text-center truncate w-full group-hover/item:text-primary transition-all leading-tight uppercase tracking-widest">
                        {employee.name}
                    </p>
                    <p className="text-[8px] font-bold text-muted-foreground uppercase tracking-[0.2em] leading-none mt-1">
                        {employee.role || 'Member'}
                    </p>
                </Link>
            ))}
        </div>
      </CardContent>
    </Card>
  );
}
