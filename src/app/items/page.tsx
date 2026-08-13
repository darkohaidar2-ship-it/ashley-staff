
'use client';

import Link from 'next/link';
import {
  MapPin,
  FilePlus,
  Upload,
  Archive,
  Search as SearchIcon,
  Loader2,
  Calendar,
  ArrowLeft,
  FileSearch,
  Box,
  Warehouse,
  LayoutGrid,
  TrendingUp,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/hooks/use-translation';
import { useAuth } from '@/hooks/use-auth';
import withAuth from '@/hooks/withAuth';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useState, useMemo, useEffect } from 'react';
import { useAppContext } from '@/context/app-provider';
import type { Item, StorageLocation, ExcelFile } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { format, parseISO } from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { cn, WAREHOUSE_COLORS } from '@/lib/utils';
import { VisualWarehouseMap } from '@/components/maps/VisualWarehouseMap';

type SearchResult = Item & {
  locationName: string;
  fileName: string;
  excelFileDate: string;
  warehouseType: 'Ashley' | 'Huana' | null;
};

function ItemsPage() {
  const { t, language } = useTranslation();
  const { hasPermission } = useAuth();
  const { locations, items: allItems, excelFiles, warehouseMaps, viewMode } = useAppContext();
  const { toast } = useToast();

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // State for highlighting on map
  const [highlightedLocationId, setHighlightedLocationId] = useState<
    string | null
  >(null);

  // State for dialog when clicking a shelf
  const [selectedLocation, setSelectedLocation] =
    useState<StorageLocation | null>(null);
  const [itemsInLocation, setItemsInLocation] = useState<Item[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const menuItems = [
    {
      title: t('manage_locations'),
      icon: MapPin,
      href: '/locations',
      permission: 'page:items:locations',
      color: 'bg-blue-500',
    },
    {
      title: t('warehouse_map'),
      icon: LayoutGrid,
      href: '/map-management',
      permission: 'page:items:locations',
      color: 'bg-indigo-500',
    },
    {
      title: t('new_file'),
      icon: FilePlus,
      href: '/new-file',
      permission: 'page:items:new',
      color: 'bg-green-500',
    },
    {
      title: t('import'),
      icon: Upload,
      href: '/import',
      permission: 'page:items:import',
      color: 'bg-orange-500',
    },
    {
      title: t('excel_archive'),
      icon: Archive,
      href: '/archive',
      permission: 'page:items:archive',
      color: 'bg-purple-500',
    },
  ].filter(item => hasPermission(item.permission));

  const itemsByLocationId = useMemo(() => {
    if (!allItems) return new Map<string, Item[]>();
    return allItems.reduce((acc, item) => {
      if (item.locationIds?.[0]) {
        if (!acc.has(item.locationIds?.[0])) acc.set(item.locationIds?.[0], []);
        acc.get(item.locationIds?.[0])!.push(item);
      }
      return acc;
    }, new Map<string, Item[]>());
  }, [allItems]);

  const getLocationInfo = (locationId?: string) => {
    if (!locationId || !locations) return { name: t('n_a'), warehouseType: null };
    const location = locations.find(loc => loc.id === locationId);
    return {
      name: location?.name || t('n_a'),
      warehouseType: location?.warehouseType || null,
    };
  };

  const getFileInfo = (fileId: string) => {
    if (!excelFiles) return undefined;
    return excelFiles.find(file => file.id === fileId);
  };

  const handleSectionClick = (locationId: string) => {
    const location = locations?.find(l => l.id === locationId);
    if (location) {
        setSelectedLocation(location);
        setItemsInLocation(itemsByLocationId.get(location.id) || []);
        setIsDialogOpen(true);
    }
  };

  const handleSearch = () => {
    setHighlightedLocationId(null);
    if (!searchQuery.trim() || !allItems) {
      setSearchResults([]);
      return;
    }
    setIsSearching(true);

    const queryLower = searchQuery.toLowerCase();
    const results = allItems
      .filter(item => item.model.toLowerCase().includes(queryLower))
      .map(item => {
        const fileInfo = getFileInfo(item.fileId);
        const locationInfo = getLocationInfo(item.locationIds?.[0]);
        return {
          ...item,
          locationName: locationInfo.name,
          fileName: fileInfo?.storageName || t('unknown_archive'),
          excelFileDate: fileInfo?.date || new Date().toISOString(),
          warehouseType: locationInfo.warehouseType as SearchResult['warehouseType'],
        };
      });

    setSearchResults(results);
    setIsSearching(false);

    if (results.length > 0) {
      const firstResult = results[0];
      const locId = firstResult.locationIds?.[0] || (firstResult as any).locationId;
      if (locId) {
        setHighlightedLocationId(locId);
        setTimeout(() => {
          const element = document.getElementById(locId);
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 100);
      }
    } else {
      toast({
        title: t('no_results'),
        description: `${t('no_items_found')}: ${searchQuery}`,
      });
    }
  };

  const isRTL = language === 'ku';

  return (
    <div className="font-sans space-y-6" dir={isRTL ? "rtl" : "ltr"}>
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg rounded-2xl border-black/5 dark:border-white/5 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-3xl shadow-2xl overflow-hidden p-0">
          <DialogHeader className="p-6 pb-4 bg-primary/5 border-b border-black/5 dark:border-white/5">
            <DialogTitle className={cn("text-base font-black tracking-tighter uppercase flex items-center gap-3", isRTL ? "flex-row-reverse" : "flex-row")}>
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-white shadow-md">
                <Box className="w-4 h-4" />
              </div>
              {t('items_location_in').replace('{name}', selectedLocation?.name || '')}
            </DialogTitle>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto px-6 py-4 scrollbar-none">
            {itemsInLocation.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow className="border-black/5 dark:border-white/5">
                    <TableHead className={cn("text-[10px] font-black uppercase text-muted-foreground tracking-widest py-2", isRTL ? "text-right" : "text-left")}>{t('model')}</TableHead>
                    <TableHead className={cn("text-[10px] font-black uppercase text-muted-foreground tracking-widest py-2", isRTL ? "text-left" : "text-right")}>{t('quantity')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {itemsInLocation.map(item => (
                    <TableRow key={item.id} className="group border-black/5 dark:border-white/5 hover:bg-primary/5 transition-colors">
                      <TableCell className={cn("font-bold text-xs py-2", isRTL ? "text-right" : "text-left")}>{item.model}</TableCell>
                      <TableCell className={cn("font-black text-primary text-sm py-2", isRTL ? "text-left" : "text-right")}>{item.quantity}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="flex flex-col items-center justify-center p-8 opacity-40">
                <Box className="w-8 h-8 mb-2 text-muted-foreground" />
                <p className="font-bold text-xs tracking-widest uppercase">{t('no_items_here')}</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Main Content Area */}
      <div className="space-y-6 w-full">
            <div className="flex items-center justify-between gap-4 mb-2">
              <Button variant="outline" size="sm" asChild className="gap-2 font-bold text-xs rounded-xl border-slate-300">
                <Link href="/admin">
                  <ArrowLeft className="w-4 h-4" />
                  <span>گەڕانەوە بۆ ڕووکاری سەرەکی ئەدمین (Return to Admin Hub)</span>
                </Link>
              </Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-4">
                <div className="win-card p-6 !min-h-0">
                    <div className="flex items-center justify-between mb-4">
                        <div className="p-3 bg-primary/10 rounded-2xl">
                            <Box className="w-6 h-6 text-primary" />
                        </div>
                        <TrendingUp className="w-4 h-4 text-emerald-500" />
                    </div>
                    <p className="text-[10px] font-medium text-slate-400 uppercase tracking-[0.2em]">{t('total_items_count')}</p>
                    <p className="text-3xl font-normal text-black dark:text-white mt-1">{allItems?.length || 0}</p>
                </div>
                <div className="win-card p-6 !min-h-0">
                    <div className="flex items-center justify-between mb-4">
                        <div className="p-3 bg-blue-500/10 rounded-2xl">
                            <MapPin className="w-6 h-6 text-blue-500" />
                        </div>
                        <div className="w-2 h-2 rounded-full bg-blue-500" />
                    </div>
                    <p className="text-[10px] font-medium text-slate-400 uppercase tracking-[0.2em]">{t('occupied_locations')}</p>
                    <p className="text-3xl font-normal text-black dark:text-white mt-1">{itemsByLocationId.size}</p>
                </div>
                <div className="md:col-span-2 win-card p-6 !min-h-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent border-primary/20">
                    <div className="flex items-center gap-4 h-full">
                        <div className="p-4 bg-primary text-white rounded-2xl shadow-lg">
                           <ShieldCheck className="w-8 h-8" />
                        </div>
                        <div>
                           <p className="text-base font-normal text-black dark:text-white uppercase tracking-tighter">سیستمی زانیاری نێکسیوس</p>
                           <p className="text-[11px] font-medium text-slate-400 uppercase tracking-widest opacity-60">پرۆتۆکۆلی هاوکاتکردنی داتای ئۆتۆماتیکی v4.0</p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="win-card p-8 bg-white/40 dark:bg-white/5 !min-h-0">
                  <div className={cn("flex w-full items-center bg-white dark:bg-zinc-900/50 p-2 rounded-[1.5rem] border border-black/5 dark:border-white/5 shadow-inner group transition-all focus-within:ring-2 focus-within:ring-primary/20", isRTL ? "space-x-reverse" : "")}>
                    <div className="px-5 opacity-30 group-focus-within:opacity-100 transition-opacity">
                        <SearchIcon className="w-5 h-5" />
                    </div>
                    <Input
                      type="text"
                      placeholder={t('search_model_placeholder')}
                      className={cn("border-none bg-transparent h-14 text-sm font-black tracking-[0.1em] focus-visible:ring-0 placeholder:text-muted-foreground/30 px-2", isRTL ? "text-right" : "text-left")}
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleSearch()}
                    />
                    <Button onClick={handleSearch} disabled={isSearching} className="h-14 px-12 rounded-[1.2rem] font-black uppercase text-[11px] tracking-widest shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all">
                      {isSearching ? (
                        <Loader2 className={cn("h-4 w-4 animate-spin", isRTL ? "ml-2" : "mr-2")} />
                      ) : (
                        t('execute_search')
                      )}
                    </Button>
                  </div>

                  {searchResults.length > 0 && (
                    <div className="mt-10 overflow-hidden rounded-[2rem] border border-black/5 dark:border-white/5 bg-white/50 dark:bg-black/20 shadow-xl animate-in fade-in slide-in-from-bottom-5 duration-700">
                      <Table>
                        <TableHeader className="bg-primary/5">
                          <TableRow className="border-black/5 dark:border-white/5">
                            <TableHead className={cn("text-[10px] font-black uppercase px-8 tracking-widest text-muted-foreground", isRTL ? "text-right" : "text-left")}>{t('model')}</TableHead>
                            <TableHead className={cn("text-[10px] font-black uppercase tracking-widest text-muted-foreground", isRTL ? "text-right" : "text-left")}>{t('file_name')}</TableHead>
                            <TableHead className={cn("text-[10px] font-black uppercase tracking-widest text-muted-foreground", isRTL ? "text-right" : "text-left")}>بڕی وردبینراو</TableHead>
                            <TableHead className={cn("text-[10px] font-black uppercase tracking-widest text-muted-foreground", isRTL ? "text-right" : "text-left")}>دۆخی کۆگا</TableHead>
                            <TableHead className={cn("text-[10px] font-black uppercase tracking-widest text-muted-foreground", isRTL ? "text-right" : "text-left")}>{t('condition')}</TableHead>
                            <TableHead className={cn("text-[10px] font-black uppercase tracking-widest text-muted-foreground", isRTL ? "text-right" : "text-left")}>{t('location')}</TableHead>
                            <TableHead className={cn("text-[10px] font-black uppercase tracking-widest text-muted-foreground", isRTL ? "text-right" : "text-left")}>تێبینی وردبینی</TableHead>
                            <TableHead className={cn("text-[10px] font-black uppercase px-4 tracking-widest text-muted-foreground", isRTL ? "text-left" : "text-right")}>{t('date')}</TableHead>
                          </TableRow>
                        </TableHeader>
                         <TableBody>
                           {searchResults.map((item, idx) => {
                             const cellPadding = "py-2 px-4";
                             
                             const getLocationColor = (locName: string, whType: string | null) => {
                                if (whType === 'Huana') {
                                    if (locName.includes('-1-')) return 'bg-emerald-100 text-emerald-700 border-emerald-200';
                                    if (locName.includes('-2-')) return 'bg-teal-100 text-teal-700 border-teal-200';
                                    return 'bg-blue-100 text-blue-700 border-blue-200';
                                }
                                if (whType === 'Ashley') {
                                    if (locName.includes('A-4')) return 'bg-purple-100 text-purple-700 border-purple-200';
                                    if (locName.includes('A-3')) return 'bg-indigo-100 text-indigo-700 border-indigo-200';
                                    return 'bg-violet-100 text-violet-700 border-violet-200';
                                }
                                return 'bg-slate-100 text-slate-700 border-slate-200';
                             };

                             const getStatusColor = (status?: string) => {
                                switch (status) {
                                    case 'Correct': return 'bg-emerald-50 text-emerald-600 border-emerald-100';
                                    case 'Less': return 'bg-rose-50 text-rose-600 border-rose-100';
                                    case 'More': return 'bg-blue-50 text-blue-600 border-blue-100';
                                    case 'Qty Changed': return 'bg-purple-50 text-purple-600 border-purple-100';
                                    default: return 'bg-slate-50 text-slate-400 border-slate-100';
                                }
                             };

                             const getConditionColor = (cond?: string) => {
                                switch (cond) {
                                    case 'Packaged': return 'bg-emerald-500 text-white';
                                    case 'Wrapped': return 'bg-amber-400 text-amber-950';
                                    case 'Damaged': return 'bg-red-500 text-white';
                                    case 'Need Wrapped': return 'bg-purple-500 text-white';
                                    default: return 'bg-emerald-500 text-white';
                                }
                             };

                             const locationIds = item.locationIds || (item.locationIds?.[0] ? [item.locationIds?.[0]] : []);

                             return (
                               <TableRow key={item.id} className="transition-all border-black/5 dark:border-white/5 group hover:bg-primary/5">
                                 <TableCell className={cn(cellPadding, "px-8", isRTL ? "text-right" : "text-left")}>
                                   <Link
                                     href={`/archive/${item.fileId}#${item.id}`}
                                     className="text-primary font-medium hover:underline tracking-tight"
                                   >
                                     {item.model}
                                   </Link>
                                 </TableCell>
                                 <TableCell className={cn(cellPadding, isRTL ? "text-right" : "text-left")}>
                                   <Link
                                     href={`/archive/${item.fileId}`}
                                     className="text-[10px] font-medium text-muted-foreground/60 hover:text-primary transition-colors uppercase tracking-widest"
                                   >
                                     {item.fileName}
                                   </Link>
                                 </TableCell>
                                 <TableCell className={cn(cellPadding, isRTL ? "text-right" : "text-left")}>
                                    <div className="flex flex-col">
                                        <span className="text-sm font-medium text-black dark:text-white">{item.newQty ?? item.quantity}</span>
                                        <span className="text-[9px] font-medium text-slate-300 uppercase tracking-tighter">سەرەکی: {item.quantity}</span>
                                    </div>
                                 </TableCell>
                                 <TableCell className={cn(cellPadding, isRTL ? "text-right" : "text-left")}>
                                    <div className={cn("inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium uppercase border", getStatusColor(item.storageStatus))}>
                                        {item.storageStatus || 'N/A'}
                                    </div>
                                 </TableCell>
                                 <TableCell className={cn(cellPadding, isRTL ? "text-right" : "text-left")}>
                                    <div className={cn("inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium uppercase", getConditionColor(item.modelCondition))}>
                                        {item.modelCondition || 'Packaged'}
                                    </div>
                                 </TableCell>
                                 <TableCell className={cn(cellPadding, isRTL ? "text-right" : "text-left")}>
                                    <div className="flex flex-wrap gap-2">
                                        {locationIds.length > 0 ? locationIds.map(locId => {
                                            const loc = locations.find(l => l.id === locId);
                                            const locName = loc?.name || 'N/A';
                                            const whType = loc?.warehouseType || null;
                                            return (
                                                <div key={locId} className={cn(
                                                    "inline-flex items-center gap-2 px-2 py-0.5 rounded text-[9px] font-medium border tracking-tighter shadow-none",
                                                    getLocationColor(locName, whType)
                                                )}>
                                                    <MapPin className="w-2.5 h-2.5 opacity-60" />
                                                    {locName}
                                                </div>
                                            );
                                        }) : <span className="text-[9px] opacity-20 uppercase">N/A</span>}
                                    </div>
                                 </TableCell>
                                 <TableCell className={cn(cellPadding, "font-medium text-[11px] text-muted-foreground italic", isRTL ? "text-right" : "text-left")}>
                                    {item.entryNote || <span className="opacity-10">—</span>}
                                 </TableCell>
                                 <TableCell className={cn(cellPadding, "px-8", isRTL ? "text-left" : "text-right")}>
                                   <div className={cn("flex items-center gap-2 text-[10px] font-medium text-muted-foreground/60 uppercase tracking-widest", isRTL ? "justify-end md:justify-start" : "justify-start md:justify-end")}>
                                     <Calendar className="w-3 h-3" />
                                     {format(parseISO(item.excelFileDate), 'MMM d, yyyy')}
                                   </div>
                                 </TableCell>
                               </TableRow>
                             )
                           })}
                        </TableBody>
                      </Table>
                    </div>
                  )}
            </div>

            <div className="space-y-8 pb-20">
                <div className="flex items-center gap-5 px-4">
                     <div className="w-14 h-14 rounded-[1.5rem] bg-indigo-600 flex items-center justify-center text-white shadow-2xl shadow-indigo-600/30 ring-8 ring-indigo-500/5">
                        <Warehouse className="w-7 h-7" />
                     </div>
                     <div>
                        <h2 className="text-3xl font-normal uppercase tracking-tighter text-black dark:text-white">{t('warehouse_map')}</h2>
                        <p className="text-[11px] font-medium text-slate-400 uppercase tracking-widest">{t('click_sector_details')}</p>
                    </div>
                </div>
                
                <div className="win-card !p-0 overflow-hidden bg-white/40 dark:bg-white/5 border-black/5 group">
                    <div className="p-10">
                        <VisualWarehouseMap 
                            warehouseMaps={warehouseMaps || []} 
                            onSectionClick={handleSectionClick}
                            highlightId={highlightedLocationId}
                            stacked={true}
                        />
                    </div>
                    {/* Decorative Bottom Bar */}
                    <div className="h-2 w-full bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 opacity-20" />
                </div>
            </div>
      </div>
    </div>
  );
}

const ShieldCheck = ({ className }: { className?: string }) => (
    <svg 
        xmlns="http://www.w3.org/2000/svg" 
        width="24" height="24" 
        viewBox="0 0 24 24" 
        fill="none" 
        stroke="currentColor" 
        strokeWidth="2" 
        strokeLinecap="round" 
        strokeLinejoin="round" 
        className={className}
    >
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
        <path d="m9 12 2 2 4-4" />
    </svg>
);

export default withAuth(ItemsPage);
