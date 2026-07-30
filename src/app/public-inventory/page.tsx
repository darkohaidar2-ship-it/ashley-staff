
'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search, ArrowLeft, MapPin, Box, FileText, Info } from 'lucide-react';
import Image from 'next/image';
import { useAppContext } from '@/context/app-provider';
import { useTranslation } from '@/hooks/use-translation';
import { Badge } from '@/components/ui/badge';
import { cn, WAREHOUSE_COLORS } from '../../lib/utils';

export default function PublicInventoryPage() {
  const { t, language } = useTranslation();
  const { settings, items, locations, transferItems } = useAppContext();
  const [searchQuery, setSearchQuery] = useState('');

  const inventoryResults = useMemo(() => {
    if (!searchQuery.trim() || searchQuery.length < 2) return [];
    const query = searchQuery.toLowerCase();
    
    return items.filter(item => 
      item.model.toLowerCase().includes(query)
    ).map(item => {
      const loc = locations.find(l => l.id === item.locationIds?.[0]);
      // Check if this item model is linked to any staged or transferred item
      const transferRef = transferItems.find(ti => ti.model.toLowerCase() === item.model.toLowerCase());
      
      return {
        ...item,
        locationName: loc?.name || 'N/A',
        invoiceRef: transferRef?.invoiceNo || null
      };
    });
  }, [searchQuery, items, locations, transferItems]);



  return (
    <div className={cn("relative min-h-screen w-full flex flex-col bg-slate-100 overflow-x-hidden", language === 'ku' ? "font-kurmanji" : "font-sans")} dir={language === 'ku' ? "rtl" : "ltr"}>
      {/* Background Layer */}
      <div className="fixed inset-0 z-0 bg-slate-100 dark:bg-zinc-950 pointer-events-none" />

      <header className="sticky top-0 z-50 w-full bg-white/80 backdrop-blur-xl border-b-2 border-white/60 shadow-md">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {settings.appLogo && (
              <div className="relative w-8 h-8 bg-white rounded p-1 border border-slate-200">
                <Image src={settings.appLogo} alt="Logo" fill className="object-contain" unoptimized />
              </div>
            )}
            <h1 className="text-[12px] font-bold uppercase tracking-wider text-slate-900">{t('ashley_staff')} | {t('inventory_audit')}</h1>
          </div>
          <Link href="/login">
            <Button variant="ghost" size="sm" className="text-[10px] font-bold uppercase tracking-widest text-slate-600 hover:text-slate-900">
              <ArrowLeft className={cn("mr-2 w-3.5 h-3.5", language === 'ku' ? "rotate-180" : "")} /> {t('back')}
            </Button>
          </Link>
        </div>
      </header>

      <main className="relative z-10 flex-1 w-full max-w-5xl mx-auto p-4 md:p-8">
        <div className="bg-white/80 backdrop-blur-xl border-2 border-white/60 rounded-2xl shadow-2xl overflow-hidden min-h-[70vh] flex flex-col animate-in fade-in zoom-in-95 duration-500">
          <div className="p-8 space-y-10 flex-1 flex flex-col">
            
            <div className="text-center space-y-2">
              <div className="p-3 bg-emerald-500/10 rounded-full w-fit mx-auto border border-emerald-500/20 mb-4">
                <Box className="w-6 h-6 text-emerald-600" />
              </div>
              <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-emerald-600">{t('global_audit_terminal')}</h2>
              <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">{t('real_time_sync')}</p>
            </div>

            <div className="relative group max-w-2xl mx-auto w-full">
              <Search className={cn("absolute top-1/2 -translate-y-1/2 w-6 h-6 text-slate-400 group-focus-within:text-primary transition-all", language === 'ku' ? "right-5" : "left-5")} />
              <Input 
                placeholder={t('enter_model_name_placeholder')} 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={cn("h-20 bg-white/50 border-2 border-white/60 focus:border-primary/50 text-[16px] font-bold uppercase tracking-widest rounded-2xl shadow-sm transition-all text-slate-900 placeholder:text-slate-300", language === 'ku' ? "pr-16 text-right" : "pl-16 text-left")}
                autoFocus
              />
            </div>

            <div className="border-2 border-white/60 rounded-2xl bg-white/30 overflow-hidden flex-1 shadow-inner min-h-[400px]">
              <Table>
                <TableHeader className="bg-slate-100/50 sticky top-0 z-10 border-b border-slate-200">
                  <TableRow>
                    <TableHead className={cn("text-[10px] uppercase font-bold text-slate-900 h-12", language === 'ku' ? "text-right" : "")}>{t('model_identity')}</TableHead>
                    <TableHead className={cn("text-[10px] uppercase font-bold text-slate-900 h-12", language === 'ku' ? "text-right" : "")}>{t('warehouse_position')}</TableHead>
                    <TableHead className={cn("w-[140px] text-[10px] uppercase font-bold text-slate-900 h-12", language === 'ku' ? "text-right" : "")}>{t('ref_invoice')}</TableHead>
                    <TableHead className="w-[100px] text-[10px] uppercase font-bold text-slate-900 text-center h-12">{t('cluster_qty')}</TableHead>
                  </TableRow>
                </TableHeader>
                        <TableBody>
                   {inventoryResults.length > 0 ? (
                     inventoryResults.map((item) => {
                       const loc = locations?.find(l => l.id === item.locationIds?.[0]);
                       const rowColor = loc?.warehouseType === 'Huana' 
                        ? `${WAREHOUSE_COLORS.Huana.bg}/30 ${WAREHOUSE_COLORS.Huana.hover}/40` 
                        : loc?.warehouseType === 'Ashley' 
                        ? `${WAREHOUSE_COLORS.Ashley.bg}/50 ${WAREHOUSE_COLORS.Ashley.hover}/60` 
                        : 'hover:bg-slate-50';
                       
                       return (
                        <TableRow key={item.id} className={cn("transition-colors border-slate-100 h-16", rowColor)}>
                          <TableCell className="font-bold text-[13px] text-slate-900">{item.model}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <MapPin className="w-3.5 h-3.5 text-primary opacity-60" />
                              <span className="text-[12px] font-bold text-slate-700">{item.locationName}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            {item.invoiceRef ? (
                              <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700 text-[9px] font-black uppercase">
                                <FileText className="mr-1 w-2.5 h-3" /> {item.invoiceRef}
                              </Badge>
                            ) : (
                              <span className="text-[10px] font-medium opacity-20">{t('no_slip_found')}</span>
                            )}
                          </TableCell>
                          <TableCell className="text-center font-black text-[14px] text-primary">{item.quantity}</TableCell>
                        </TableRow>
                       );
                     })
                   ) : (
                    <TableRow>
                      <TableCell colSpan={4} className="h-[400px] text-center">
                        <div className="flex flex-col items-center justify-center space-y-4 opacity-20">
                          <Search className="w-16 h-16 text-slate-900" />
                          <div className="space-y-1">
                            <p className="text-[11px] font-bold uppercase tracking-widest text-slate-900">{t('awaiting_signal')}</p>
                            <p className="text-[9px] uppercase font-medium">{t('enter_chars_to_audit')}</p>
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>
      </main>

      <footer className="relative z-10 py-8 text-center border-t border-slate-200 bg-white/40 backdrop-blur-sm mt-auto">
        <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-slate-500">
          {t('inventory_audit_footer')}
        </p>
      </footer>
    </div>
  );
}
