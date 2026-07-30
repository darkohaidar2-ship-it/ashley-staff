
'use client';

import { useMemo } from 'react';
import { useAppContext } from '@/context/app-provider';
import { useTranslation } from '@/hooks/use-translation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Box, PackageCheck, Warehouse, Database } from 'lucide-react';
import { EditableText } from '@/components/shared/editable-text';
import { cn } from '@/lib/utils';

const COLORS = {
  'Correct': 'hsl(var(--chart-2))',
  'Less': 'hsl(var(--chart-4))',
  'More': 'hsl(var(--chart-1))',
  '': 'hsl(var(--muted))',
};
const STATUS_NAMES = {
  'Correct': 'Correct',
  'Less': 'Less',
  'More': 'More',
  '': 'Not Set'
};

type StatusKey = keyof typeof COLORS;

import { useRouter } from 'next/navigation';

export function StorageSummaryChart() {
  const { t } = useTranslation();
  const { locations, items, settings } = useAppContext();
  const router = useRouter();

  const customColor = settings?.customColors?.['storage_occupancy'] || '';

  const getCardStyle = () => {
    if (customColor.includes('cyan')) return 'border-cyan-500/30 shadow-[0_8px_30px_rgba(6,182,212,0.08)]';
    if (customColor.includes('purple')) return 'border-purple-500/30 shadow-[0_8px_30px_rgba(168,85,247,0.08)]';
    if (customColor.includes('emerald')) return 'border-emerald-500/30 shadow-[0_8px_30px_rgba(16,185,129,0.08)]';
    if (customColor.includes('amber')) return 'border-amber-500/30 shadow-[0_8px_30px_rgba(245,158,11,0.08)]';
    if (customColor.includes('pink')) return 'border-pink-500/30 shadow-[0_8px_30px_rgba(236,72,153,0.08)]';
    if (customColor.includes('blue')) return 'border-blue-500/30 shadow-[0_8px_30px_rgba(59,130,246,0.08)]';
    return 'border-border shadow-sm';
  };

  const chartData = useMemo(() => {
    if (!locations || !items) return [];
    
    const warehouseCounts: Record<string, number> = {};
    items.forEach(item => {
      const loc = locations.find(l => l.id === item.locationIds?.[0]);
      if (loc) {
        warehouseCounts[loc.name] = (warehouseCounts[loc.name] || 0) + item.quantity;
      }
    });

    return Object.entries(warehouseCounts).map(([name, value], index) => ({
      name,
      value,
      fill: `hsl(var(--chart-${(index % 5) + 1}))`
    }));
  }, [locations, items]);

  const hasData = chartData.length > 0;

  return (
    <Card id="storage-chart" className={cn("win-card relative group overflow-hidden bg-card border transition-all duration-700", getCardStyle())}>
      <CardHeader className="py-4 px-6 border-b border-border flex flex-row items-center justify-between">
        <CardTitle className="text-xs font-black uppercase tracking-[0.2em] flex items-center gap-2">
            <Warehouse className={cn("w-4 h-4", customColor || "text-primary")} />
            <EditableText keyName="storage_occupancy" />
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6">
          {hasData ? (
              <div className="w-full h-[var(--dashboard-chart-height,220px)] transition-all duration-500"> 
                  <ResponsiveContainer width="100%" height="100%">
                     <PieChart>
                         <defs>
                            <linearGradient id="pieGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#2E5BFF" stopOpacity={1}/>
                                <stop offset="100%" stopColor="#2E5BFF" stopOpacity={0.4}/>
                            </linearGradient>
                         </defs>
                         <Pie
                             data={chartData}
                             cx="50%"
                             cy="50%"
                             innerRadius="50%"
                             outerRadius="90%"
                             paddingAngle={4}
                             dataKey="value"
                             nameKey="name"
                             stroke="transparent"
                         >
                            {chartData.map((entry, index) => (
                                <Cell 
                                    key={`cell-${index}`} 
                                    fill={index === 0 ? 'url(#pieGradient)' : `rgba(46, 91, 255, ${0.8 - (index * 0.15)})`} 
                                    className="filter hover:brightness-125 transition-all duration-300"
                                />
                            ))}
                        </Pie>
                        <Tooltip
                            contentStyle={{
                              backgroundColor: 'rgba(10, 10, 12, 0.8)',
                              backdropFilter: 'blur(20px)',
                              border: '1px solid rgba(255,255,255,0.1)',
                              borderRadius: '12px',
                              padding: '12px',
                              boxShadow: '0 20px 40px rgba(0,0,0,0.5)'
                            }}
                            itemStyle={{ color: '#fff', fontWeight: '900', fontSize: '10px' }}
                        />
                    </PieChart>
                 </ResponsiveContainer>
              </div>
          ) : (
                <div className="flex flex-col items-center justify-center py-20 space-y-4">
                    <div className="w-16 h-16 rounded-3xl bg-secondary border border-border flex items-center justify-center neon-glow">
                        <Database className="w-8 h-8 text-primary" />
                    </div>
                    <p className="text-[11px] font-black text-muted-foreground uppercase tracking-[0.3em] text-center">
                        {t('no_storage_data_available')}
                    </p>
                </div>
          )}
      </CardContent>
    </Card>
  );
}
