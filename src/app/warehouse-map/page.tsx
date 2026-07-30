'use client';

import { useState, useMemo } from 'react';
import { 
    Warehouse, 
    LayoutGrid, 
    Rows, 
    Box, 
    Search,
    Info,
    ArrowUpRight,
    Maximize2,
    Filter,
    Package
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
    Dialog, 
    DialogContent, 
    DialogHeader, 
    DialogTitle, 
    DialogTrigger,
} from '@/components/ui/dialog';
import { useAppContext } from '@/context/app-provider';
import { useTranslation } from '@/hooks/use-translation';
import { WarehouseMap, MapHall, MapFloor, MapZone, StorageLocation, Item } from '@/lib/types';
import { cn } from '@/lib/utils';

const translateDynamicName = (name: string) => {
    if (!name) return name;
    const nameLower = name.toLowerCase();
    if (nameLower.includes('ashley')) return 'کۆگایی ئاشڵی';
    if (nameLower.includes('huana')) return 'کۆگایی هوانە';
    
    // Halls / levels
    if (nameLower.includes('level: h1') || name === 'H1') return 'کۆگای ١ هوانە';
    if (nameLower.includes('level: h2') || name === 'H2') return 'کۆگای ٢ هوانە';
    if (nameLower.includes('level: h3') || name === 'H3') return 'کۆگای ٣ هوانە';
    if (nameLower.includes('level: k1') || name === 'K1') return 'کۆگای ٤ هوانە';
    
    // Floors
    if (nameLower.includes('floor 1') || nameLower.includes('level 1') || nameLower.includes('area: 1') || nameLower === '1' || nameLower === 'f-1') return 'قاتی ١';
    if (nameLower.includes('floor 2') || nameLower.includes('level 2') || nameLower.includes('area: 2') || nameLower === '2' || nameLower === 'f-2') return 'قاتی ٢';
    if (nameLower.includes('floor 3') || nameLower.includes('level 3') || nameLower.includes('area: 3') || nameLower === '3' || nameLower === 'f-3') return 'قاتی ٣';
    if (nameLower.includes('floor 4') || nameLower.includes('level 4') || nameLower.includes('area: 4') || nameLower === '4' || nameLower === 'f-4') return 'قاتی ٤';
    
    // Fallback parsing for other numbers
    if (nameLower.startsWith('floor ') || nameLower.startsWith('level ') || nameLower.startsWith('area: ')) {
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

export default function WarehouseMapView() {
    const { t } = useTranslation();
    const { warehouseMaps, locations, items } = useAppContext();
    const [activeWarehouseId, setActiveWarehouseId] = useState<string>(warehouseMaps?.[0]?.id || '');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedZone, setSelectedZone] = useState<MapZone | null>(null);

    const activeWarehouse = warehouseMaps?.find(wm => wm.id === activeWarehouseId);

    // Get items in a specific location by name
    const getItemsForLocationCode = (code: string) => {
        return items?.filter(item => {
            const loc = locations.find(l => l.id === item.locationIds?.[0]);
            return loc?.name === code;
        }) || [];
    };

    // Filtered zones for search
    const isZoneVisible = (zone: MapZone, hallName: string, floorName: string) => {
        if (!searchQuery) return true;
        const q = searchQuery.toLowerCase();
        return zone.name.toLowerCase().includes(q) || 
               hallName.toLowerCase().includes(q) || 
               floorName.toLowerCase().includes(q) ||
               zone.type.toLowerCase().includes(q);
    };

    return (
        <div className="min-h-screen bg-background text-foreground p-0 overflow-x-hidden">
            {/* Ultra-Wide Header */}
            <header className="w-full bg-card/50 backdrop-blur-xl border-b border-border px-8 py-6 flex flex-col md:flex-row items-center justify-between gap-6 sticky top-0 z-50">
                <div className="flex items-center gap-6">
                    <div className="w-14 h-14 rounded-2xl bg-primary flex items-center justify-center text-primary-foreground shadow-lg">
                        <Maximize2 className="w-7 h-7" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-black tracking-tighter uppercase text-foreground">تەماشاکردنی ژیری کۆگا</h1>
                        <p className="text-[10px] font-black uppercase tracking-[0.4em] text-primary">نیشاندانی ژێرخانی کۆگاکان بە ڕوونی بەرز</p>
                    </div>
                </div>

                <div className="flex items-center gap-4 bg-secondary/50 p-2 rounded-xl border border-border">
                    <div className="relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input 
                            placeholder="بۆ مۆدێل، زۆن، یان خانە بگەڕێ..." 
                            className="h-12 pl-12 w-80 text-[10px] font-black uppercase tracking-widest bg-background border-border rounded-lg hover:border-primary/50 transition-all focus:ring-2 ring-primary/20"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    <Button variant="ghost" size="icon" className="h-12 w-12 rounded-lg hover:bg-accent transition-colors">
                        <Filter className="w-5 h-5" />
                    </Button>
                </div>
            </header>

            <main className="w-full px-8 py-10">
                {(!warehouseMaps || warehouseMaps.length === 0) ? (
                    <div className="flex flex-col items-center justify-center py-40 opacity-20">
                        <Warehouse className="w-32 h-32 mb-6" />
                        <h2 className="text-2xl font-black uppercase tracking-[0.5em]">هیچ نەخشەیەکی گشتی کۆگا نەدۆزرایەوە</h2>
                    </div>
                ) : (
                    <Tabs value={activeWarehouseId} onValueChange={setActiveWarehouseId} className="space-y-12">
                        <div className="flex justify-center">
                            <TabsList className="bg-transparent border-none gap-8 h-auto pb-4">
                                {warehouseMaps.map(wm => (
                                    <TabsTrigger 
                                        key={wm.id} 
                                        value={wm.id}
                                        className={cn(
                                            "relative px-4 py-2 text-[11px] font-black uppercase tracking-widest transition-all duration-300",
                                            "data-[state=active]:text-primary hover:text-foreground text-muted-foreground"
                                        )}
                                    >
                                        <Warehouse className="w-4 h-4 mr-3" />
                                        {translateDynamicName(wm.name)}
                                    </TabsTrigger>
                                ))}
                            </TabsList>
                        </div>

                        {warehouseMaps.map(wm => (
                            <TabsContent key={wm.id} value={wm.id} className="animate-in fade-in zoom-in-95 duration-700 outline-none">
                                <div className="space-y-20">
                                    {wm.halls.map(hall => (
                                        <section key={hall.id} className="space-y-10 group/hall">
                                            <div className="flex items-center gap-6">
                                                <div className="h-px flex-1 bg-gradient-to-r from-transparent via-border to-transparent" />
                                                <div className="text-center space-y-2">
                                                    <h2 className="text-4xl font-black uppercase tracking-tighter text-foreground group-hover/hall:text-primary transition-colors">{translateDynamicName(hall.name)}</h2>
                                                    <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 font-black tracking-[0.3em] uppercase px-4 py-1 text-[9px]">سیستەمی ناوەندی باڵەخانە</Badge>
                                                </div>
                                                <div className="h-px flex-1 bg-gradient-to-r from-transparent via-border to-transparent" />
                                            </div>

                                            <div className="grid grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3 gap-10">
                                                {hall.floors.map(floor => (
                                                    <div key={floor.id} className="bg-card rounded-[1.5rem] border border-border p-10 hover:border-primary/20 transition-all duration-500 hover:shadow-xl">
                                                        <div className="flex items-center justify-between mb-8">
                                                            <div className="flex items-center gap-4">
                                                                <div className="w-12 h-12 rounded-xl bg-accent flex items-center justify-center text-muted-foreground border border-border">
                                                                    <Rows className="w-6 h-6" />
                                                                </div>
                                                                <div>
                                                                    <h3 className="text-lg font-black uppercase tracking-widest text-foreground leading-none mb-2">{translateDynamicName(floor.name)}</h3>
                                                                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">پۆلێنکردنی پێکهاتەیی</p>
                                                                </div>
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                <div className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.8)]" />
                                                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{floor.zones.length} {t('zone')}</span>
                                                            </div>
                                                        </div>

                                                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                                            {floor.zones.filter(z => isZoneVisible(z, hall.name, floor.name)).map(zone => {
                                                                const zoneItems = getItemsForLocationCode(zone.name);
                                                                return (
                                                                    <Dialog key={zone.id}>
                                                                        <DialogTrigger asChild>
                                                                            <button 
                                                                                className="group/zone relative h-32 rounded-3xl p-5 flex flex-col justify-between transition-all duration-300 hover:translate-y-[-4px] hover:shadow-2xl border border-white/5 overflow-hidden text-left"
                                                                                style={{ 
                                                                                    background: zoneItems.length > 0 ? `${zone.color}20` : 'rgba(255,255,255,0.02)',
                                                                                    borderLeft: `3px solid ${zone.color}`
                                                                                }}
                                                                            >
                                                                                <div className="flex justify-between items-start relative z-10">
                                                                                    <Box className="w-5 h-5 transition-transform group-hover/zone:scale-110" style={{ color: zone.color }} />
                                                                                    <div className="flex items-center gap-2">
                                                                                        <span className="text-[10px] font-black uppercase opacity-40">#{zoneItems.length}</span>
                                                                                        <div className={cn("w-2 h-2 rounded-full", zoneItems.length > 0 ? "bg-emerald-500 animate-pulse shadow-[0_0_8px_#10b981]" : "bg-slate-700")} />
                                                                                    </div>
                                                                                </div>
                                                                                <div className="relative z-10">
                                                                                    <p className="text-[11px] font-black uppercase leading-tight truncate text-white mb-1">{zone.name}</p>
                                                                                    <p className="text-[8px] font-black uppercase tracking-widest opacity-30">
                                                                                        {zone.type === 'Zone' ? t('zone') : (zone.type === 'Rack' || zone.type === 'Bin') ? t('rack') : zone.type}
                                                                                    </p>
                                                                                </div>

                                                                                {/* Visual Decoration */}
                                                                                <div className="absolute -bottom-4 -right-4 w-12 h-12 bg-white/5 rounded-full blur-2xl group-hover/zone:bg-white/10 transition-colors" />
                                                                            </button>
                                                                        </DialogTrigger>
                                                                        <DialogContent className="bg-slate-900 border-white/10 text-white max-w-2xl rounded-[2rem]">
                                                                            <DialogHeader>
                                                                                <DialogTitle className="flex items-center gap-4 text-2xl font-black uppercase tracking-tighter">
                                                                                    <div className="p-3 rounded-xl bg-white/5 text-blue-400">
                                                                                        <LayoutGrid className="w-6 h-6" />
                                                                                    </div>
                                                                                    <div>
                                                                                        {zone.name}
                                                                                        <p className="text-[10px] font-bold text-slate-500 tracking-widest mt-1 uppercase">{translateDynamicName(hall.name)} / {translateDynamicName(floor.name)}</p>
                                                                                    </div>
                                                                                </DialogTitle>
                                                                            </DialogHeader>
                                                                            
                                                                            <div className="mt-8 space-y-6">
                                                                                <div className="grid grid-cols-2 gap-4">
                                                                                    <div className="bg-black/20 p-4 rounded-2xl border border-white/5 text-center">
                                                                                        <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">کۆی گشتی توانای کۆگا</p>
                                                                                        <p className="text-xl font-black">بێ سنوور</p>
                                                                                    </div>
                                                                                    <div className="bg-blue-500/10 p-4 rounded-2xl border border-blue-500/20 text-center">
                                                                                        <p className="text-[9px] font-black text-blue-400 uppercase tracking-widest mb-1">کاڵا کۆگاکراوەکان</p>
                                                                                        <p className="text-xl font-black text-blue-400">{zoneItems.length}</p>
                                                                                    </div>
                                                                                </div>

                                                                                <div className="space-y-3">
                                                                                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 px-2 flex items-center gap-2">
                                                                                        <Package className="w-3 h-3" /> شیکردنەوەی کاڵاکان
                                                                                    </p>
                                                                                    <div className="bg-black/40 border border-white/5 rounded-2xl overflow-hidden">
                                                                                        {zoneItems.length === 0 ? (
                                                                                            <div className="p-10 text-center opacity-30 text-[10px] font-black uppercase tracking-widest">
                                                                                                ئەم خانەیە لە ئێستادا بەتاڵە
                                                                                            </div>
                                                                                        ) : (
                                                                                            <div className="divide-y divide-white/5">
                                                                                                {zoneItems.map(item => (
                                                                                                    <div key={item.id} className="p-4 flex items-center justify-between hover:bg-white/5 transition-colors group">
                                                                                                        <div className="flex items-center gap-3">
                                                                                                            <div className="w-2 h-2 rounded-full bg-blue-500" />
                                                                                                            <span className="font-bold text-sm tracking-tight">{item.model}</span>
                                                                                                        </div>
                                                                                                        <Badge className="bg-white/5 text-white border-white/10 px-3">{t('qty')}: {item.quantity}</Badge>
                                                                                                    </div>
                                                                                                ))}
                                                                                            </div>
                                                                                        )}
                                                                                    </div>
                                                                                </div>
                                                                            </div>
                                                                        </DialogContent>
                                                                    </Dialog>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </section>
                                    ))}
                                </div>
                            </TabsContent>
                        ))}
                    </Tabs>
                )}
            </main>
        </div>
    );
}
