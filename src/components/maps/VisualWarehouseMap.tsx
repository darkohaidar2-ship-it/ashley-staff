'use client';

import React from 'react';
import { 
    Warehouse, 
    LayoutGrid, 
    Rows, 
    Box, 
    BadgeInfo 
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { cn, WAREHOUSE_COLORS } from '@/lib/utils';
import { WarehouseMap, MapHall, MapFloor, MapZone } from '@/lib/types';
import { useTranslation } from '@/hooks/use-translation';

interface VisualWarehouseMapProps {
    warehouseMaps: WarehouseMap[];
    onSectionClick?: (locationId: string) => void;
    highlightId?: string | null;
    historyLocationIds?: string[];
    futureLocationIds?: string[];
    className?: string;
    stacked?: boolean;
}

const translateDynamicName = (name: string) => {
    if (!name) return name;
    const nameLower = name.toLowerCase();
    if (nameLower.includes('ashley')) return 'کۆگایی سەرەکی ئاشڵی';
    if (nameLower.includes('huana')) return 'کۆگایی هوانە';
    
    // Halls / levels
    if (nameLower.includes('level: h1') || name === 'H1') return 'کۆگای ١ هوانە';
    if (nameLower.includes('level: h2') || name === 'H2') return 'کۆگای ٢ هوانە';
    if (nameLower.includes('level: h3') || name === 'H3') return 'کۆگای ٣ هوانە';
    if (nameLower.includes('level: k1') || name === 'K1') return 'کۆگای ٤ هوانە';
    if (nameLower.includes('level: a3') || name === 'A3') return 'قاتی ٣ ئاشڵی';
    if (nameLower.includes('level: a4') || name === 'A4') return 'قاتی ٤ ئاشڵی';
    
    // General Level: mapping
    if (nameLower.startsWith('level:')) {
        const val = name.substring(6).trim();
        if (val === 'H1') return 'کۆگای ١ هوانە';
        if (val === 'H2') return 'کۆگای ٢ هوانە';
        if (val === 'H3') return 'کۆگای ٣ هوانە';
        if (val === 'K1') return 'کۆگای ٤ هوانە';
        if (val === 'A3') return 'قاتی ٣ ئاشڵی';
        if (val === 'A4') return 'قاتی ٤ ئاشڵی';
        return val;
    }
    
    // Area mapping
    if (nameLower.startsWith('area:')) {
        const val = name.substring(5).trim();
        if (val.startsWith('C')) {
            return `ناوچەی C${val.substring(1)}`;
        }
        if (val.startsWith('O')) {
            return `ئۆفیس ${val.substring(1)}`;
        }
        return `زۆنی ${val}`;
    }
    
    // Floors
    if (nameLower.includes('floor 1') || nameLower.includes('level 1') || nameLower.includes('area: 1') || nameLower === '1' || nameLower === 'f-1') return 'قاتی ١';
    if (nameLower.includes('floor 2') || nameLower.includes('level 2') || nameLower.includes('area: 2') || nameLower === '2' || nameLower === 'f-2') return 'قاتی ٢';
    if (nameLower.includes('floor 3') || nameLower.includes('level 3') || nameLower.includes('area: 3') || nameLower === '3' || nameLower === 'f-3') return 'قاتی ٣';
    if (nameLower.includes('floor 4') || nameLower.includes('level 4') || nameLower.includes('area: 4') || nameLower === '4' || nameLower === 'f-4') return 'قاتی ٤';
    
    // Fallback parsing for other numbers
    if (nameLower.startsWith('floor ') || nameLower.startsWith('level ')) {
        const num = name.split(' ').pop();
        if (num && !isNaN(Number(num))) {
            return `قاتی ${num}`;
        }
    }
    
    if (nameLower === 'showroom hall') return 'هۆڵی نمایشگا';
    if (nameLower === 'storage complex') return 'کۆمەڵگەی کۆگا';
    if (nameLower === 'first floor') return 'قاتی یەکەم';
    if (nameLower === 'ground floor') return 'قاتی زەوی';
    
    return name;
};

export function VisualWarehouseMap({ 
    warehouseMaps, 
    onSectionClick, 
    highlightId,
    historyLocationIds = [],
    futureLocationIds = [],
    className,
    stacked = false
}: VisualWarehouseMapProps) {
    const { t, language } = useTranslation();
    const [activeWarehouseId, setActiveWarehouseId] = React.useState<string>(warehouseMaps?.[0]?.id || '');

    React.useEffect(() => {
        if (warehouseMaps?.length > 0 && !activeWarehouseId) {
            setActiveWarehouseId(warehouseMaps[0].id);
        }
    }, [warehouseMaps, activeWarehouseId]);

    const isRTL = language === 'ku';

    if (!warehouseMaps || warehouseMaps.length === 0) {
        return (
            <div className={cn("flex flex-col items-center justify-center py-20 grayscale opacity-40 border-2 border-dashed rounded-3xl", isRTL ? "font-kurmanji" : "font-sans")} dir={isRTL ? "rtl" : "ltr"}>
                <Warehouse className="w-16 h-16 mb-4" />
                <p className="font-black uppercase tracking-widest text-sm">{t('no_map_data')}</p>
                <p className="text-[10px] font-bold uppercase mt-1">{t('sync_maps_desc')}</p>
            </div>
        );
    }

    const renderWarehouse = (wm: WarehouseMap) => (
        <div key={wm.id} className="space-y-10" dir={isRTL ? "rtl" : "ltr"}>
            {stacked && (
                <div className="flex items-center gap-3 mb-6">
                    <Warehouse className="w-6 h-6 text-primary" />
                    <h2 className="text-2xl font-black">{translateDynamicName(wm.name)}</h2>
                </div>
            )}
            {wm.halls.map(hall => (
                <section key={hall.id} className="space-y-6">
                    <div className="flex items-center gap-3 border-b border-black/5 dark:border-white/5 pb-4">
                        <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center text-white shadow-lg">
                            <LayoutGrid className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="text-xl font-black">{translateDynamicName(hall.name)}</h2>
                            <p className="text-[10px] font-bold text-primary/70">{hall.floors.length} {t('floor')}</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        {hall.floors.map(floor => (
                            <div key={floor.id} className="bg-white/40 dark:bg-black/20 backdrop-blur-sm rounded-3xl border border-black/5 dark:border-white/5 p-6 shadow-sm">
                                <div className="flex items-center gap-3 mb-6">
                                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                                        <Rows className="w-4 h-4" />
                                    </div>
                                    <h3 className="text-sm font-black uppercase tracking-widest">{translateDynamicName(floor.name)}</h3>
                                </div>

                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                    {floor.zones.map(zone => {
                                        const isHighlighted = highlightId === zone.id;
                                        const historyIndex = historyLocationIds.indexOf(zone.id);
                                        const isHistory = historyIndex !== -1;
                                        const isFuture = futureLocationIds.includes(zone.id);
                                        
                                        // Determine colors
                                        let bgColor = isHighlighted ? `${zone.color}40` : `${zone.color}15`;
                                        let borderColor = `3px solid ${zone.color}`;
                                        let iconColor = zone.color;

                                        if (wm.warehouseType && wm.warehouseType in WAREHOUSE_COLORS) {
                                            const theme = WAREHOUSE_COLORS[wm.warehouseType as keyof typeof WAREHOUSE_COLORS];
                                            bgColor = isHighlighted ? theme.hex : theme.lightHex;
                                            borderColor = `2px solid ${theme.hex}`;
                                            iconColor = theme.hex;
                                        }

                                        return (
                                            <div 
                                                key={zone.id} 
                                                id={zone.id}
                                                onClick={() => onSectionClick?.(zone.id)}
                                                className={cn(
                                                    "group relative h-24 rounded-2xl p-3 flex flex-col justify-between transition-all cursor-pointer border overflow-hidden",
                                                    isHighlighted ? "scale-105 shadow-2xl z-10 ring-2 ring-primary ring-offset-2 dark:ring-offset-black" : "hover:scale-[1.03] hover:shadow-xl",
                                                    isFuture ? "border-dashed border-2 border-sky-500 animate-pulse bg-sky-500/10" : "border-black/5 dark:border-white/5"
                                                )}
                                                style={{ 
                                                    background: isFuture ? undefined : bgColor, 
                                                    [isRTL ? 'borderRight' : 'borderLeft']: isFuture ? undefined : borderColor
                                                }}
                                            >
                                                {/* History Number Badge */}
                                                {isHistory && (
                                                    <div className={cn(
                                                        "absolute top-2 w-5 h-5 rounded-full bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-900 flex items-center justify-center text-[10px] font-black shadow-md z-10",
                                                        isRTL ? "left-2" : "right-2"
                                                    )}>
                                                        {historyIndex + 1}
                                                    </div>
                                                )}

                                                {/* Future Indicator */}
                                                {isFuture && (
                                                    <div className={cn(
                                                        "absolute top-2 px-2 py-0.5 rounded-full bg-sky-500 text-white flex items-center justify-center text-[8px] font-black uppercase tracking-widest shadow-md z-10",
                                                        isRTL ? "left-2" : "right-2"
                                                    )}>
                                                        {t('next')}
                                                    </div>
                                                )}

                                                <div className="flex justify-between items-start">
                                                    <Box className="w-3.5 h-3.5" style={{ color: iconColor }} />
                                                    <div className="flex items-center gap-1">
                                                        <Badge variant="outline" className="text-[8px] font-black border-none px-0 opacity-60">{t('qty')}: {zone.itemCount}</Badge>
                                                        <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: zone.itemCount > 0 ? '#10b981' : '#64748b' }} />
                                                    </div>
                                                </div>
                                                <div className={isRTL ? "text-right" : "text-left"}>
                                                    <p className="text-[10px] font-black uppercase leading-tight truncate">{zone.name}</p>
                                                    <p className="text-[8px] font-bold opacity-40">
                                                        {zone.type === 'Zone' ? t('zone') : (zone.type === 'Rack' || zone.type === 'Bin') ? t('rack') : zone.type}
                                                    </p>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            ))}
        </div>
    );

    if (stacked) {
        return (
            <div className={cn("space-y-20", className)} dir={isRTL ? "rtl" : "ltr"}>
                {warehouseMaps.map(renderWarehouse)}
            </div>
        );
    }

    return (
        <div className={cn("space-y-6", className)} dir={isRTL ? "rtl" : "ltr"}>
            <Tabs value={activeWarehouseId} onValueChange={setActiveWarehouseId} className="space-y-8">
                <div className="flex items-center gap-4 overflow-x-auto pb-2 scrollbar-none">
                    <TabsList className="bg-transparent border-none gap-2">
                        {warehouseMaps.map(wm => (
                            <TabsTrigger 
                                key={wm.id} 
                                // Resolves active styling correctly
                                value={wm.id}
                                className={cn(
                                    "h-10 px-6 rounded-full text-[10px] font-black uppercase tracking-widest transition-all",
                                    "data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-xl",
                                    "bg-white/50 dark:bg-white/5 border border-black/5 dark:border-white/5 backdrop-blur-sm shadow-sm"
                                )}
                            >
                                <Warehouse className={cn("w-3.5 h-3.5", isRTL ? "ml-2" : "mr-2")} />
                                {translateDynamicName(wm.name)}
                            </TabsTrigger>
                        ))}
                    </TabsList>
                </div>

                {warehouseMaps.map(wm => (
                    <TabsContent key={wm.id} value={wm.id} className="animate-in fade-in slide-in-from-bottom-4 duration-500 mt-0 outline-none">
                        {renderWarehouse(wm)}
                    </TabsContent>
                ))}
            </Tabs>
        </div>
    );
}

