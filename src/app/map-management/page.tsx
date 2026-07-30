'use client';

import { useState } from 'react';
import Link from 'next/link';
import { 
    ArrowLeft, 
    Plus, 
    Trash2, 
    Edit2, 
    Warehouse, 
    LayoutGrid, 
    Rows, 
    Box, 
    PlusCircle,
    Save,
    ChevronRight,
    Search,
    RefreshCw,
    Info,
    ArrowUpRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { 
    Dialog, 
    DialogContent, 
    DialogHeader, 
    DialogTitle, 
    DialogFooter, 
    DialogTrigger,
    DialogClose
} from '@/components/ui/dialog';
import { 
    Select, 
    SelectContent, 
    SelectItem, 
    SelectTrigger, 
    SelectValue 
} from '@/components/ui/select';
import { useAppContext } from '@/context/app-provider';
import { useTranslation } from '@/hooks/use-translation';
import { WarehouseMap, MapHall, MapFloor, MapZone, StorageLocation, Item } from '@/lib/types';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

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

export default function MapManagementPage() {
    const { t, language } = useTranslation();
    const { warehouseMaps, setWarehouseMaps, locations, items } = useAppContext();
    const { toast } = useToast();
    const [activeWarehouseId, setActiveWarehouseId] = useState<string>(warehouseMaps?.[0]?.id || '');
    const isRTL = language === 'ku';
    
    // UI State
    const [isEditing, setIsEditing] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    const activeWarehouse = warehouseMaps?.find(wm => wm.id === activeWarehouseId);

    const handleBack = () => {
        window.history.back();
    };

    const syncFromLocations = () => {
        if (!locations || locations.length === 0) {
            toast({ 
                title: isRTL ? "هیچ شوێنێک نەدۆزرایەوە" : "No Locations Found", 
                description: isRTL ? "تکایە سەرەتا شوێنەکانی کۆگا زیاد بکە لە بەڕێوەبەری شوێنەکان." : "Please add storage locations in the Locations manager first." 
            });
            return;
        }

        const newMaps: WarehouseMap[] = [];

        // Helper to get item count for a location name
        const getCountForCode = (code: string) => {
            return items?.filter(item => {
                const loc = locations.find(l => l.id === item.locationIds?.[0]);
                return loc?.name === code;
            }).length || 0;
        };

        // Group locations by their warehouseType
        const groupedLocs: Record<string, StorageLocation[]> = {};
        locations.forEach(l => {
            const type = l.warehouseType || l.name.split('-')[0] || 'Unknown';
            if (!groupedLocs[type]) groupedLocs[type] = [];
            groupedLocs[type].push(l);
        });

        Object.entries(groupedLocs).forEach(([wType, locs]) => {
            const wmMap: WarehouseMap = { id: `sys-${wType}`, name: wType, halls: [] };
            
            // Group by First Part (Root Level: e.g. H1, A3, A4)
            const rootLevels = Array.from(new Set(locs.map(l => l.name.split('-')[0]))).sort();
            
            rootLevels.forEach(root => {
                const hall: MapHall = { id: `hall-${wType}-${root}`, name: `Level: ${root}`, floors: [] };
                
                const rootLocs = locs.filter(l => l.name.split('-')[0] === root);
                
                // Group by Second Part (Area: e.g. 1R, C2. If length is 2, it's just a Zone, so group under Main Area)
                const areas = Array.from(new Set(rootLocs.map(l => {
                    const parts = l.name.split('-');
                    return parts.length === 2 ? 'Main Area' : (parts[1] || 'Main Area');
                }))).sort();
                
                areas.forEach(area => {
                    const floorMap: MapFloor = { id: `floor-${wType}-${root}-${area}`, name: `Area: ${area}`, zones: [] };
                    
                    const areaLocs = rootLocs.filter(l => {
                        const parts = l.name.split('-');
                        const a = parts.length === 2 ? 'Main Area' : (parts[1] || 'Main Area');
                        return a === area;
                    });
                    
                    areaLocs.forEach(loc => {
                        const parts = loc.name.split('-');
                        floorMap.zones.push({
                            id: loc.id,
                            name: parts.length === 2 ? parts[1] : (parts[2] || loc.name),
                            type: 'Zone',
                            itemCount: getCountForCode(loc.name),
                            color: '#3b82f6'
                        });
                    });
                    hall.floors.push(floorMap);
                });
                wmMap.halls.push(hall);
            });
            newMaps.push(wmMap);
        });

        setWarehouseMaps(newMaps);
        if (newMaps.length > 0) setActiveWarehouseId(newMaps[0].id);
        toast({ 
            title: isRTL ? "هاوکاتکردن تەواو بوو" : "Sync Complete", 
            description: isRTL ? "پێکهاتەی نەخشەکە دروستکرا لە کۆدەکانی شوێنی سیستەمەکەوە." : "Map hierarchy generated from system location codes." 
        });
    };

    const addWarehouse = () => {
        const name = prompt('Enter Warehouse Name:');
        if (!name) return;
        const newWm: WarehouseMap = {
            id: crypto.randomUUID(),
            name,
            halls: []
        };
        setWarehouseMaps([...(warehouseMaps || []), newWm]);
        setActiveWarehouseId(newWm.id);
    };

    const addHall = (wmId: string) => {
        const name = prompt('Enter Hall Name:');
        if (!name) return;
        setWarehouseMaps(prev => prev.map(wm => {
            if (wm.id === wmId) {
                return {
                    ...wm,
                    halls: [...wm.halls, { id: crypto.randomUUID(), name, floors: [] }]
                };
            }
            return wm;
        }));
    };

    const addFloor = (hallId: string) => {
        const name = prompt('Enter Floor/Section Name:');
        if (!name) return;
        setWarehouseMaps(prev => prev.map(wm => ({
            ...wm,
            halls: wm.halls.map(hall => {
                if (hall.id === hallId) {
                    return {
                        ...hall,
                        floors: [...hall.floors, { id: crypto.randomUUID(), name, zones: [] }]
                    };
                }
                return hall;
            })
        })));
    };

    const addZone = (floorId: string) => {
        const name = prompt('Enter Zone/Rack Name:');
        if (!name) return;
        setWarehouseMaps(prev => prev.map(wm => ({
            ...wm,
            halls: wm.halls.map(hall => ({
                ...hall,
                floors: hall.floors.map(floor => {
                    if (floor.id === floorId) {
                        return {
                            ...floor,
                            zones: [...floor.zones, { 
                                id: crypto.randomUUID(), 
                                name, 
                                type: 'Zone', 
                                itemCount: 0, 
                                color: '#3b82f6' 
                            }]
                        };
                    }
                    return floor;
                })
            }))
        })));
    };

    const deleteItem = (type: 'warehouse' | 'hall' | 'floor' | 'zone', id: string) => {
        if (!confirm(`Are you sure you want to delete this ${type}?`)) return;
        
        if (type === 'warehouse') {
            setWarehouseMaps(prev => prev.filter(wm => wm.id !== id));
            if (activeWarehouseId === id) setActiveWarehouseId(warehouseMaps?.[0]?.id || '');
        } else {
            setWarehouseMaps(prev => prev.map(wm => ({
                ...wm,
                halls: type === 'hall' 
                    ? wm.halls.filter(h => h.id !== id)
                    : wm.halls.map(hall => ({
                        ...hall,
                        floors: type === 'floor'
                            ? hall.floors.filter(f => f.id !== id)
                            : hall.floors.map(floor => ({
                                ...floor,
                                zones: floor.zones.filter(z => z.id !== id)
                            }))
                    }))
            })));
        }
    };

    return (
        <div className="min-h-screen bg-[#f8fafc] dark:bg-[#020617] text-foreground p-4 md:p-8">
            <header className="max-w-7xl mx-auto mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={handleBack} className="rounded-full hover:bg-white dark:hover:bg-white/5 shadow-sm border border-black/5 dark:border-white/5">
                        <ArrowLeft className="w-4 h-4" />
                    </Button>
                    <div>
                        <h1 className="text-2xl font-black tracking-tight uppercase">{isRTL ? "بەڕێوەبردنی نەخشەکان" : "Map Management"}</h1>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{isRTL ? "سەرپەرشتیاری کۆگای تەلارسازی" : "Architectural Warehouse Orchestrator"}</p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <div className="relative group">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
                        <Input 
                            placeholder={isRTL ? "گەڕان لە نەخشە..." : "SEARCH MAP..."} 
                            className="h-9 pl-9 w-48 text-[10px] font-black uppercase tracking-widest bg-white/50 dark:bg-black/20 border-black/5 dark:border-white/5 rounded-full"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    <Button onClick={() => setIsEditing(!isEditing)} variant={isEditing ? "default" : "outline"} className={cn("h-9 rounded-full px-5 text-[10px] font-black uppercase tracking-widest", isEditing ? "bg-emerald-500 hover:bg-emerald-600 border-none" : "")}>
                        {isEditing ? <><Save className="w-3.5 h-3.5 mr-2"/> {isRTL ? 'تەواوکردنی دیزاین' : 'Finish Design'}</> : <><Edit2 className="w-3.5 h-3.5 mr-2"/> {isRTL ? 'دەستکاریکردنی نەخشە' : 'Edit Layout'}</>}
                    </Button>
                    <Button onClick={syncFromLocations} variant="outline" className="h-9 rounded-full px-5 text-[10px] font-black uppercase tracking-widest border-primary/30 text-primary">
                        <RefreshCw className="w-3.5 h-3.5 mr-2" /> {isRTL ? 'هاوکاتکردنی خودکاری شوێنەکان' : 'Auto-Sync Locations'}
                    </Button>
                    <Button onClick={addWarehouse} className="h-9 rounded-full px-5 text-[10px] font-black uppercase tracking-widest shadow-lg shadow-primary/20">
                        <Plus className="w-3.5 h-3.5 mr-2" /> {isRTL ? 'گرێی نوێ' : 'New Node'}
                    </Button>
                </div>
            </header>

            <div className="max-w-7xl mx-auto mb-6 bg-blue-500/10 border border-blue-500/20 rounded-2xl p-4 flex items-center gap-4 animate-in fade-in slide-in-from-top-4">
                <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-500 flex-shrink-0">
                    <Info className="w-5 h-5" />
                </div>
                <div>
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-blue-600 dark:text-blue-400">{isRTL ? 'ئامۆژگاری' : 'Pro Tip'}</h4>
                    <p className="text-xs font-bold text-muted-foreground leading-tight">{isRTL ? 'تایبەتمەندی "هاوکاتکردنی خودکار" بەکاربهێنە بۆ دروستکردنی نەخشەی بینراو بە شێوەیەکی خێرا لە کۆدی شوێنەکانەوە.' : 'Use "Auto-Sync" to immediately generate a visual map structure from your existing system location codes.'}</p>
                </div>
            </div>

            <main className="max-w-7xl mx-auto">
                {(!warehouseMaps || warehouseMaps.length === 0) ? (
                    <Card className="border-dashed border-2 bg-transparent">
                        <CardContent className="flex flex-col items-center justify-center py-20 grayscale opacity-40">
                            <Warehouse className="w-16 h-16 mb-4" />
                            <p className="font-black uppercase tracking-[0.2em]">{isRTL ? 'هیچ کۆگایەک دەستنیشان نەکراوە' : 'No Warehouses Defined'}</p>
                            <Button variant="link" onClick={addWarehouse} className="mt-2 text-primary font-bold">{isRTL ? 'یەکەم نەخشەی کۆگای خۆت دروست بکە' : 'Create your first map node'}</Button>
                        </CardContent>
                    </Card>
                ) : (
                    <Tabs value={activeWarehouseId} onValueChange={setActiveWarehouseId} className="space-y-8">
                        <div className="flex items-center gap-4 overflow-x-auto pb-2 scrollbar-none">
                            <TabsList className="bg-transparent border-none gap-2">
                                {warehouseMaps.map(wm => (
                                    <TabsTrigger 
                                        key={wm.id} 
                                        value={wm.id}
                                        className={cn(
                                            "h-10 px-6 rounded-full text-[10px] font-black uppercase tracking-widest transition-all",
                                            "data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-xl",
                                            "bg-white dark:bg-white/5 border border-black/5 dark:border-white/5"
                                        )}
                                    >
                                        <Warehouse className="w-3.5 h-3.5 mr-2" />
                                        {translateDynamicName(wm.name)}
                                        {isEditing && (
                                            <Trash2 
                                                className="w-3.5 h-3.5 ml-3 hover:text-destructive transition-colors" 
                                                onClick={(e) => { e.stopPropagation(); deleteItem('warehouse', wm.id); }}
                                            />
                                        )}
                                    </TabsTrigger>
                                ))}
                            </TabsList>
                        </div>

                        {warehouseMaps.map(wm => (
                             <TabsContent key={wm.id} value={wm.id} className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                                <div className="space-y-12">
                                    {wm.halls.map(hall => (
                                        <section key={hall.id} className="space-y-6">
                                            <div className="flex items-center justify-between border-b border-black/5 dark:border-white/5 pb-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center text-white shadow-lg">
                                                        <LayoutGrid className="w-5 h-5" />
                                                    </div>
                                                    <div>
                                                        <h2 className="text-xl font-black uppercase tracking-tight">{translateDynamicName(hall.name)}</h2>
                                                        <p className="text-[9px] font-bold uppercase tracking-widest text-[#3b82f6]">
                                                            &lt; {isRTL ? 'ناسنامەی هۆڵ' : 'Hall Identifier'} / {hall.floors.length} {isRTL ? 'قات' : 'Floors'} &gt;
                                                        </p>
                                                    </div>
                                                </div>
                                                {isEditing && (
                                                    <div className="flex items-center gap-2">
                                                        <Button variant="ghost" size="sm" onClick={() => addFloor(hall.id)} className="text-[9px] font-black uppercase tracking-widest bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20">
                                                            <PlusCircle className="w-3 h-3 mr-1.5" /> {isRTL ? 'زیادکردنی قات' : 'Add Floor'}
                                                        </Button>
                                                        <Button variant="ghost" size="sm" onClick={() => deleteItem('hall', hall.id)} className="text-[9px] font-black uppercase tracking-widest bg-destructive/10 text-destructive hover:bg-destructive/20">
                                                            <Trash2 className="w-3 h-3 mr-1.5" /> {isRTL ? 'سڕینەوەی هۆڵ' : 'Remove Hall'}
                                                        </Button>
                                                    </div>
                                                )}
                                            </div>

                                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                                {hall.floors.map(floor => (
                                                    <div key={floor.id} className="bg-white/40 dark:bg-black/20 backdrop-blur-sm rounded-3xl border border-black/5 dark:border-white/5 p-6 shadow-sm">
                                                        <div className="flex items-center justify-between mb-6">
                                                            <div className="flex items-center gap-3">
                                                                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                                                                    <Rows className="w-4 h-4" />
                                                                </div>
                                                                <h3 className="text-sm font-black uppercase tracking-widest">{translateDynamicName(floor.name)}</h3>
                                                            </div>
                                                            {isEditing && (
                                                                <div className="flex items-center gap-1">
                                                                    <Button variant="ghost" size="icon" onClick={() => addZone(floor.id)} className="h-7 w-7 text-emerald-500">
                                                                        <PlusCircle className="w-4 h-4" />
                                                                    </Button>
                                                                    <Button variant="ghost" size="icon" onClick={() => deleteItem('floor', floor.id)} className="h-7 w-7 text-destructive">
                                                                        <Trash2 className="w-4 h-4" />
                                                                    </Button>
                                                                </div>
                                                            )}
                                                        </div>

                                                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                                            {floor.zones.map(zone => (
                                                                <div 
                                                                    key={zone.id} 
                                                                    className="group relative h-24 rounded-2xl p-3 flex flex-col justify-between transition-all hover:scale-[1.03] hover:shadow-xl cursor-default border border-black/5 dark:border-white/5 overflow-hidden"
                                                                    style={{ background: `${zone.color}15`, borderLeft: `2px solid ${zone.color}` }}
                                                                >
                                                                     <div className="flex justify-between items-start">
                                                                        <Box className="w-3.5 h-3.5" style={{ color: zone.color }} />
                                                                        <div className="flex items-center gap-1">
                                                                            <Badge variant="outline" className="text-[8px] font-black border-none px-0 opacity-40">{isRTL ? 'عدد' : 'ITEM'}: {zone.itemCount}</Badge>
                                                                            <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: zone.itemCount > 0 ? '#10b981' : '#64748b' }} />
                                                                        </div>
                                                                    </div>
                                                                    <div>
                                                                        <p className="text-[10px] font-black uppercase leading-tight truncate">{zone.name}</p>
                                                                        <p className="text-[8px] font-bold uppercase tracking-[0.05em] opacity-40">
                                                                            {zone.type === 'Zone' ? t('zone') : (zone.type === 'Rack' || zone.type === 'Bin') ? t('rack') : zone.type}
                                                                        </p>
                                                                    </div>
                                                                    
                                                                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                                                                        <Button variant="ghost" size="icon" className="h-5 w-5 rounded-md bg-white/80 dark:bg-black/50 backdrop-blur-sm shadow-sm" asChild>
                                                                            <Link href={`/locations`}>
                                                                                <ArrowUpRight className="w-2.5 h-2.5" />
                                                                            </Link>
                                                                        </Button>
                                                                    </div>

                                                                    {isEditing && (
                                                                        <div className="absolute inset-0 bg-black/60 flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-[2px]">
                                                                            <Button variant="ghost" size="icon" onClick={() => deleteItem('zone', zone.id)} className="h-8 w-8 text-white bg-destructive hover:bg-destructive/80 border-none">
                                                                                <Trash2 className="w-4 h-4" />
                                                                            </Button>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </section>
                                    ))}

                                    {/* Direct Hall Zones */}
                                    {wm.halls.some(h => h.zones && h.zones.length > 0) && (
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                            {wm.halls.map(hall => hall.zones?.map(zone => (
                                                 <div 
                                                 key={zone.id} 
                                                 className="group relative h-24 rounded-2xl p-3 flex flex-col justify-between transition-all hover:scale-[1.03] hover:shadow-xl cursor-default border border-black/5 dark:border-white/5 overflow-hidden"
                                                 style={{ background: `${zone.color}15`, borderLeft: `4px solid ${zone.color}` }}
                                             >
                                                  <div className="flex justify-between items-start">
                                                     <Box className="w-3.5 h-3.5" style={{ color: zone.color }} />
                                                     <Badge variant="outline" className="text-[8px] font-black border-none px-0 opacity-40">#{zone.itemCount}</Badge>
                                                 </div>
                                                 <div>
                                                     <p className="text-[10px] font-black uppercase leading-tight truncate">{zone.name}</p>
                                                     <p className="text-[8px] font-bold uppercase tracking-[0.05em] opacity-40">
                                                         {zone.type === 'Zone' ? t('zone') : (zone.type === 'Rack' || zone.type === 'Bin') ? t('rack') : zone.type}
                                                     </p>
                                                 </div>
                                             </div>
                                            )))}
                                        </div>
                                    )}

                                    <div className="flex justify-center pt-8">
                                        <Button 
                                            variant="outline" 
                                            onClick={() => addHall(wm.id)}
                                            className="h-16 px-10 border-dashed border-2 rounded-3xl text-[11px] font-black uppercase tracking-[0.2em] opacity-40 hover:opacity-100 transition-all hover:bg-white dark:hover:bg-white/5"
                                        >
                                            <PlusCircle className="w-5 h-5 mr-3" /> {isRTL ? 'دروستکردنی هۆڵی نوێ' : 'Initialize New Hall'}
                                        </Button>
                                    </div>
                                </div>
                             </TabsContent>
                        ))}
                    </Tabs>
                )}
            </main>
        </div>
    );
}