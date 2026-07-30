
'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Truck, ArrowLeft, Inbox, ClipboardList, FileText, ListChecks } from 'lucide-react';
import Image from 'next/image';
import { useAppContext } from '@/context/app-provider';
import { useTranslation } from '@/hooks/use-translation';
import { Badge } from '@/components/ui/badge';
import { cn, WAREHOUSE_COLORS } from '../../lib/utils';
import { format, parseISO } from 'date-fns';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function PublicTransmitPage() {
  const { t, language } = useTranslation();
  const { settings, transferItems, transfers } = useAppContext();
  const [activeCity, setActiveCity] = useState<string | null>(null);

  const stagedItems = useMemo(() => {
    if (!activeCity) return [];
    return transferItems.filter(item => !item.transferId && item.destination === activeCity);
  }, [transferItems, activeCity]);

  const cityTransfers = useMemo(() => {
    if (!activeCity) return [];
    return transfers
      .filter(t => t.destinationCity === activeCity)
      .sort((a, b) => parseISO(b.transferDate).getTime() - parseISO(a.transferDate).getTime());
  }, [transfers, activeCity]);



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
            <h1 className="text-[12px] font-bold uppercase tracking-wider text-slate-900">{t('ashley_staff')} | {t('transmission_hub')}</h1>
          </div>
          <Link href="/login">
            <Button variant="ghost" size="sm" className="text-[10px] font-bold uppercase tracking-widest text-slate-600 hover:text-slate-900">
              <ArrowLeft className={cn("mr-2 w-3.5 h-3.5", language === 'ku' ? "rotate-180" : "")} /> {t('back')}
            </Button>
          </Link>
        </div>
      </header>

      <main className="relative z-10 flex-1 w-full max-w-6xl mx-auto p-4 md:p-8">
        <div className="bg-white/80 backdrop-blur-xl border-2 border-white/60 rounded-2xl shadow-2xl overflow-hidden min-h-[70vh] flex flex-col animate-in fade-in zoom-in-95 duration-500">
          {!activeCity ? (
            <div className="p-8 space-y-8 flex-1 flex flex-col justify-center">
              <div className="text-center space-y-2">
                <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-amber-600">{t('regional_node_selection')}</h2>
                <div className="h-0.5 w-12 bg-amber-500/40 mx-auto rounded-full" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full">
                {["erbil", "baghdad", "diwan", "dohuk"].map((cityKey) => (
                  <Button 
                    key={cityKey} 
                    variant="outline" 
                    className="h-24 bg-white/50 border-2 border-white/60 hover:border-primary/40 hover:bg-white flex flex-col items-center justify-center gap-1 text-sm font-bold uppercase tracking-tight text-slate-900 shadow-sm transition-all hover:scale-[1.02]"
                    onClick={() => setActiveCity(t(cityKey))}
                  >
                    {t(cityKey)}
                    <span className="text-[10px] font-medium opacity-40">{t('access_lists')}</span>
                  </Button>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex flex-col h-full">
              <header className="p-6 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-amber-500/10 rounded-lg border border-amber-500/20">
                    <Truck className="w-5 h-5 text-amber-600" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold uppercase tracking-widest text-slate-900">{activeCity} {t('terminal')}</h2>
                    <p className="text-[10px] text-slate-500 font-bold uppercase">{t('logistics_oversight')}</p>
                  </div>
                </div>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="text-[10px] font-bold uppercase tracking-widest text-slate-600"
                  onClick={() => setActiveCity(null)}
                >
                  <ArrowLeft className={cn("mr-2 w-3.5 h-3.5", language === 'ku' ? "rotate-180" : "")} /> {t('switch_city')}
                </Button>
              </header>
              
              <div className="flex-1">
                <Tabs defaultValue="staged" className="w-full">
                  <div className="px-6 pt-4">
                    <TabsList className="bg-slate-100/50 p-1 border border-slate-200 h-10 w-full max-w-md">
                      <TabsTrigger value="staged" className="text-[10px] font-bold uppercase flex-1">
                        <ClipboardList className="w-3.5 h-3.5 mr-2" /> {t('staged_cargo')} ({stagedItems.length})
                      </TabsTrigger>
                      <TabsTrigger value="history" className="text-[10px] font-bold uppercase flex-1">
                        <FileText className="w-3.5 h-3.5 mr-2" /> {t('slip_archive')} ({cityTransfers.length})
                      </TabsTrigger>
                    </TabsList>
                  </div>

                  <TabsContent value="staged" className="m-0 p-0 animate-in fade-in duration-300">
                    <div className="overflow-auto">
                      <Table>
                        <TableHeader className="bg-slate-100/50 sticky top-0 z-10 border-b border-slate-200">
                          <TableRow>
                            <TableHead className="w-[60px] text-[10px] uppercase font-bold text-slate-900 text-center">{t('audit_a')}</TableHead>
                            <TableHead className="w-[60px] text-[10px] uppercase font-bold text-slate-900 text-center">{t('audit_b')}</TableHead>
                            <TableHead className={cn("text-[10px] uppercase font-bold text-slate-900", language==='ku'?"text-right":"text-left")}>{t('model_name')}</TableHead>
                            <TableHead className="w-[80px] text-[10px] uppercase font-bold text-slate-900 text-center">{t('qty')}</TableHead>
                            <TableHead className={cn("w-[140px] text-[10px] uppercase font-bold text-slate-900", language==='ku'?"text-right":"text-left")}>{t('ref_invoice')}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                           {stagedItems.length > 0 ? (
                             stagedItems.map((item) => {
                               const loc = useAppContext().locations.find(l => l.id === item.storage?.[0]);
                               const rowColor = loc?.warehouseType === 'Huana' 
                                 ? `${WAREHOUSE_COLORS.Huana.bg}/30 ${WAREHOUSE_COLORS.Huana.hover}/40` 
                                 : loc?.warehouseType === 'Ashley' 
                                 ? `${WAREHOUSE_COLORS.Ashley.bg}/50 ${WAREHOUSE_COLORS.Ashley.hover}/60` 
                                 : 'hover:bg-slate-50';

                               return (
                                 <TableRow key={item.id} className={cn("transition-colors border-slate-100 h-14", rowColor)}>
                                   <TableCell className="text-center">
                                     <Checkbox className="border-slate-300 data-[state=checked]:bg-amber-500" />
                                   </TableCell>
                                   <TableCell className="text-center">
                                     <Checkbox className="border-slate-300 data-[state=checked]:bg-emerald-500" />
                                   </TableCell>
                                   <TableCell className="font-bold text-[12px] text-slate-900">{item.model}</TableCell>
                                   <TableCell className="text-center font-bold text-[12px] text-primary">{item.quantity}</TableCell>
                                   <TableCell className="text-[11px] text-slate-500 font-bold uppercase">
                                     {item.invoiceNo ? `#${item.invoiceNo}` : <span className="opacity-30">{language === 'ku' ? 'چاوەڕوانکراو' : 'PENDING'}</span>}
                                   </TableCell>
                                 </TableRow>
                               );
                             })
                           ) : (
                            <TableRow>
                              <TableCell colSpan={5} className="h-80 text-center">
                                <div className="flex flex-col items-center justify-center space-y-4 opacity-20">
                                  <Inbox className="w-14 h-14 text-slate-900" />
                                  <p className="text-[11px] font-bold uppercase tracking-widest text-slate-900">{t('no_staged_cargo_found')} {activeCity}</p>
                                </div>
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </TabsContent>

                  <TabsContent value="history" className="m-0 p-0 animate-in fade-in duration-300">
                    <div className="overflow-auto">
                      <Table>
                        <TableHeader className="bg-slate-100/50 sticky top-0 z-10 border-b border-slate-200">
                          <TableRow>
                            <TableHead className={cn("w-[120px] text-[10px] uppercase font-bold text-slate-900", language==='ku'?"text-right":"text-left")}>{t('transfer_date')}</TableHead>
                            <TableHead className={cn("text-[10px] uppercase font-bold text-slate-900", language==='ku'?"text-right":"text-left")}>{t('cargo_identification')}</TableHead>
                            <TableHead className="w-[100px] text-[10px] uppercase font-bold text-slate-900 text-center">{t('cluster_count')}</TableHead>
                            <TableHead className={cn("w-[140px] text-[10px] uppercase font-bold text-slate-900", language==='ku'?"text-right":"text-left")}>{t('invoice_serial')}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {cityTransfers.length > 0 ? (
                            cityTransfers.map((transfer) => (
                              <TableRow key={transfer.id} className="hover:bg-slate-50 transition-colors border-slate-100 h-14">
                                <TableCell className="text-[11px] font-bold text-slate-500">
                                  {format(parseISO(transfer.transferDate), 'dd/MM/yyyy')}
                                </TableCell>
                                <TableCell className="font-bold text-[12px] text-slate-900">
                                  {transfer.cargoName}
                                </TableCell>
                                <TableCell className="text-center">
                                  <Badge variant="outline" className="text-[10px] font-bold">{transfer.itemIds.length}</Badge>
                                </TableCell>
                                <TableCell className="text-right text-[11px] font-mono font-bold text-primary">
                                  #{transfer.invoiceNumber.toString().padStart(6, '0')}
                                </TableCell>
                              </TableRow>
                            ))
                          ) : (
                            <TableRow>
                              <TableCell colSpan={4} className="h-80 text-center">
                                <div className="flex flex-col items-center justify-center space-y-4 opacity-20">
                                  <ListChecks className="w-14 h-14 text-slate-900" />
                                  <p className="text-[11px] font-bold uppercase tracking-widest text-slate-900">{t('no_completed_slips_found')} {activeCity}</p>
                                </div>
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </TabsContent>
                </Tabs>
              </div>
            </div>
          )}
        </div>
      </main>

      <footer className="relative z-10 py-8 text-center border-t border-slate-200 bg-white/40 backdrop-blur-sm mt-auto">
        <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-slate-500">
          {t('logistics_node_footer')}
        </p>
      </footer>
    </div>
  );
}
