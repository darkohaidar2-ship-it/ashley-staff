'use client';

import { useState, useMemo, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Plus, Trash2, Save, Loader2, Calendar as CalendarIcon, Printer, X, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { useToast } from '@/hooks/use-toast';
import { format, formatISO } from 'date-fns';
import { cn } from '@/lib/utils';
import { AlertDialog, AlertDialogAction, AlertDialogContent, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { useAppContext } from '@/context/app-provider';
import type { NewItem } from '@/lib/types';
import { useTranslation } from '@/hooks/use-translation';

const sources = [{ value: "Showroom", label: "شۆڕوم (Showroom)" }, { value: "Ashley Store", label: "کۆگای ئاشلی (Ashley Store)" }, { value: "Huana Store", label: "کۆگای هوئانا (Huana Store)" }];

function NewFileContent() {
  const { t, language } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const { employees, locations, setExcelFiles, setItems: setAllItems, isLoading: isAppLoading } = useAppContext();

  const [isSaving, setIsSaving] = useState(false);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

  // Form State
  const [storageName, setStorageName] = useState('');
  const [categoryName, setCategoryName] = useState('');
  const [storekeeperId, setStorekeeperId] = useState('');
  const [source, setSource] = useState('');
  const [date, setDate] = useState<Date | undefined>(undefined);
  const [items, setItems] = useState<NewItem[]>([]);
  const [classification, setClassification] = useState('');

  useEffect(() => {
    if (!isAppLoading) {
      if (!date) setDate(new Date());
      
      const classFromUrl = searchParams.get('classification');
      if (classFromUrl) {
          const decoded = decodeURIComponent(classFromUrl);
          if (classification !== decoded) {
              setClassification(decoded);
          }
      }
    }
  }, [isAppLoading, searchParams, classification, date]);
  
  // Filter states
  const [filterHuanaWarehouse, setFilterHuanaWarehouse] = useState('All');
  const [filterHuanaFloor, setFilterHuanaFloor] = useState('All');
  const [filterAshleyFloor, setFilterAshleyFloor] = useState('All');
  const [filterAshleyArea, setFilterAshleyArea] = useState('All');

  const addNewItem = () => {
    setItems(prev => [...prev, { tempId: Date.now(), model: '', quantity: 1, notes: '', placementNote: '', locationIds: [] }]);
  };
  
  const handleItemChange = (index: number, field: keyof NewItem, value: any) => {
    const newItems = [...items];
    (newItems[index] as any)[field] = value;
    setItems(newItems);
  };

  const removeItem = (tempId: number) => {
    setItems(prev => prev.filter(item => item.tempId !== tempId));
  };
  
  const handleSave = async () => {
      if (!storageName || !categoryName || !storekeeperId || !source || !date || items.length === 0) {
        toast({ variant: 'destructive', title: 'زانیاری کەمە', description: 'تکایە هەموو خانەکان پڕبکەرەوە و لانیکەم یەک کاڵا زیادبکە.' });
        return;
      }
      setIsSaving(true);
      
      const fileId = crypto.randomUUID();

      const fileData = {
        id: fileId,
        storekeeperId,
        storageName,
        categoryName,
        classification,
        date: formatISO(date),
        source,
        type: 'new' as const
      };
      
      const newItems = items.map(item => {
          const { tempId, ...itemData } = item;
          return { ...itemData, id: crypto.randomUUID(), fileId: fileId };
      });

      setExcelFiles(prev => [...prev, fileData]);
      setAllItems(prev => [...prev, ...newItems]);

      toast({ title: t('import_success'), description: `File "${storageName}" and its items have been saved.` });
      router.push('/archive');
      setIsSaving(false);
  };

  const handlePrint = () => {
    window.print();
  };
  
  const getWarehouseTypeFromSource = (source?: string) => {
      if (source === 'Ashley Store') return 'Ashley';
      if (source === 'Huana Store') return 'Huana';
      return null;
  }
  const warehouseType = getWarehouseTypeFromSource(source);

  if (isAppLoading || !date) {
    return <div className="flex justify-center items-center h-screen"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  const isRTL = language === 'ku';

  return (
    <div className={cn("min-h-screen bg-[#fbfbfb] dark:bg-zinc-950 p-4 md:p-8", isRTL ? "font-kurmanji" : "font-sans")} dir={isRTL ? "rtl" : "ltr"}>
      <header className="max-w-[1600px] mx-auto flex items-center justify-between gap-4 mb-12 print:hidden">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild className="h-8 w-8">
            <Link href="/admin">
              <ArrowLeft className="w-4 h-4" />
            </Link>
          </Button>
          <div className="flex items-center gap-2">
            <div className="w-1 h-4 bg-primary rounded-full" />
          </div>
        </div>
        <div className="flex items-center gap-2">
            <Button onClick={handlePrint} variant="ghost" size="icon" disabled={items.length === 0} className="h-8 w-8">
                <Printer className="h-4 w-4"/>
            </Button>
            <Button onClick={handleSave} disabled={isSaving} className="btn-text-glow px-4 py-2 text-[10px] font-black uppercase tracking-widest text-primary bg-transparent hover:bg-transparent shadow-none h-auto">
                {isSaving ? <Loader2 className="animate-spin h-4 w-4"/> : 'پاشەکەوتکردن'}
            </Button>
        </div>
      </header>

      <div className="max-w-[1600px] mx-auto grid grid-cols-1 lg:grid-cols-4 gap-8">
        <div className="lg:col-span-1 space-y-6">
            <Card className="win-card bg-card border border-border rounded-xl mt-12">
                <CardHeader className="py-3 px-6 border-b border-border">
                    <Save className="w-4 h-4 text-primary" />
                </CardHeader>
                <CardContent className="space-y-6 p-6">
                    <div className="space-y-4">
                        <Input value={storageName} onChange={(e) => setStorageName(e.target.value)} placeholder="ناونیشانی جەرد (فایل)" className="h-10 border-0 border-b border-border rounded-none bg-transparent px-0 text-sm" />
                        <Input value={categoryName} onChange={(e) => setCategoryName(e.target.value)} placeholder="پرۆژە / پۆلێن" className="h-10 border-0 border-b border-border rounded-none bg-transparent px-0 text-sm" />
                        <Select onValueChange={setStorekeeperId} value={storekeeperId}>
                            <SelectTrigger className="h-10 border-0 border-b border-border rounded-none bg-transparent px-0 text-sm"><SelectValue placeholder="کۆگادار / بەکارهێنەر" /></SelectTrigger>
                            <SelectContent className="rounded-lg shadow-xl">
                            {
                                employees?.map(emp => <SelectItem key={emp.id} value={emp.id}>{emp.name}</SelectItem>)
                            }
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <Label className="text-[10px] font-medium uppercase tracking-widest opacity-40">{t('source_location')}</Label>
                        <Select onValueChange={setSource} value={source}>
                            <SelectTrigger className="h-11 rounded-xl border-black/5 bg-slate-50/30 font-medium"><SelectValue placeholder={t('select_a_source')} /></SelectTrigger>
                            <SelectContent className="rounded-xl border-black/5 shadow-2xl">
                            {sources.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <Label className="text-[10px] font-medium uppercase tracking-widest opacity-40">{t('date')}</Label>
                        <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                            <PopoverTrigger asChild>
                            <Button variant="outline" className={cn("h-11 w-full justify-start text-left font-medium rounded-xl border-black/5 bg-slate-50/30", !date && "text-muted-foreground")}>
                                <CalendarIcon className="mr-2 h-4 w-4 opacity-40" />
                                {date ? format(date, 'PPP') : <span>{t('pick_a_date')}</span>}
                            </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0 rounded-2xl border-black/5 shadow-2xl">
                                <Calendar 
                                    mode="single" 
                                    selected={date} 
                                    onSelect={(d) => {
                                        if (d) setDate(d);
                                        setIsCalendarOpen(false);
                                    }} 
                                    initialFocus 
                                    captionLayout="dropdown" fromYear={2020} toYear={2040} 
                                />
                            </PopoverContent>
                        </Popover>
                    </div>

                    <div className="space-y-2">
                        <Label className="text-[10px] font-medium uppercase tracking-widest opacity-40">پۆلێنکردن / فۆڵدەر</Label>
                        <Select onValueChange={setClassification} value={classification}>
                            <SelectTrigger className="h-11 rounded-xl border-black/5 bg-slate-50/30 font-medium">
                                <SelectValue placeholder="پۆلێنکردن هەڵبژێرە" />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl border-black/5 shadow-2xl">
                                <SelectItem value="Bedroom">ژووری خەوتن (Bedroom)</SelectItem>
                                <SelectItem value="Dining Room">ژووری نانخواردن (Dining Room)</SelectItem>
                                <SelectItem value="Living Room">ژووری دانیشتن (Living Room)</SelectItem>
                                <SelectItem value="Kitchen">مەتبەخ (Kitchen)</SelectItem>
                                <SelectItem value="Office">نووسینگە (Office)</SelectItem>
                                <SelectItem value="Outdoor">دەرەوە (Outdoor)</SelectItem>
                                <SelectItem value="Hallway">ڕاڕەو (Hallway)</SelectItem>
                                <SelectItem value="Warehouse">کۆگا (Warehouse)</SelectItem>
                                <SelectItem value="Others">وانی تر (Others)</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </CardContent>
            </Card>
        </div>

        <div className="lg:col-span-3">
            <Card className="win-card bg-card border border-border rounded-xl mt-12">
                <CardHeader className="py-3 px-6 border-b border-border flex items-center justify-between">
                    <div className="w-8 h-px bg-primary/20" />
                    <Button variant="ghost" size="icon" onClick={addNewItem} className="h-8 w-8 hover:text-primary">
                        <Plus className="h-4 w-4"/>
                    </Button>
                </CardHeader>
                <CardContent className="p-0">
                     <div className="overflow-x-auto">
                        <Table>
                            <TableHeader className="bg-slate-50/30">
                                <TableRow className="border-black/5">
                                    <TableHead className="px-8 py-5 text-[10px] font-medium uppercase tracking-widest text-slate-400">{t('model')}</TableHead>
                                    <TableHead className="w-[120px] text-[10px] font-medium uppercase tracking-widest text-slate-400">{t('quantity')}</TableHead>
                                    <TableHead className="w-[200px] text-[10px] font-medium uppercase tracking-widest text-slate-400">{t('location')}</TableHead>
                                    <TableHead className="text-[10px] font-medium uppercase tracking-widest text-slate-400">تێبینی شوێن (ڕەفە)</TableHead>
                                    <TableHead className="text-[10px] font-medium uppercase tracking-widest text-slate-400">{t('notes')}</TableHead>
                                    <TableHead className="w-[80px]"></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {items.length > 0 ? items.map((item, index) => {
                                    const locationsSelected = item.locationIds || [];

                                    return (
                                        <TableRow key={item.tempId} className="border-black/5 hover:bg-slate-50/50 group transition-colors">
                                            <TableCell className="px-8 py-4">
                                                <Input value={item.model} onChange={e => handleItemChange(index, 'model', e.target.value)} placeholder="مۆدێلی کاڵا" className="h-10 rounded-xl border-black/5 bg-white font-medium" />
                                            </TableCell>
                                            <TableCell>
                                                <Input type="number" value={item.quantity} onChange={e => handleItemChange(index, 'quantity', e.target.valueAsNumber)} min="1" className="h-10 rounded-xl border-black/5 bg-white font-medium" />
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex flex-col gap-2">
                                                    <AlertDialog>
                                                        <AlertDialogTrigger asChild>
                                                            <Button variant="outline" className="h-10 w-full rounded-xl border-black/5 bg-white text-[10px] font-medium uppercase shadow-none flex items-center justify-between px-3" disabled={!warehouseType}>
                                                                <span className="truncate">{locationsSelected.length > 0 ? `${locationsSelected.length} دیاریکراو` : "هەڵبژێرە"}</span>
                                                                <MapPin className="w-3 h-3 opacity-40 shadow-none" />
                                                            </Button>
                                                        </AlertDialogTrigger>
                                                        <AlertDialogContent className="rounded-[2.5rem] border-black/5 shadow-2xl max-w-sm p-8">
                                                            <AlertDialogHeader>
                                                                <AlertDialogTitle className="text-xl font-normal tracking-tight text-black">هەڵبژاردنی چەند شوێنێک</AlertDialogTitle>
                                                            </AlertDialogHeader>
                                                            <AlertDialogFooter className="mt-8">
                                                                <AlertDialogAction className="rounded-2xl h-12 w-full text-[11px] font-medium uppercase tracking-widest shadow-xl">تەواوکردنی هەڵبژاردن</AlertDialogAction>
                                                            </AlertDialogFooter>
                                                        </AlertDialogContent>
                                                    </AlertDialog>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <Input value={item.placementNote ?? ''} onChange={e => handleItemChange(index, 'placementNote', e.target.value)} placeholder="بۆ نموونە: ڕەفەی B" className="h-10 rounded-xl border-black/5 bg-white font-medium" />
                                            </TableCell>
                                            <TableCell>
                                                <Textarea value={item.notes} onChange={e => handleItemChange(index, 'notes', e.target.value)} placeholder={t('notes_optional')} className="min-h-[40px] h-10 rounded-xl border-black/5 bg-white font-medium py-2 resize-none"/>
                                            </TableCell>
                                            <TableCell className="px-8">
                                                <Button variant="ghost" size="icon" onClick={() => removeItem(item.tempId)} className="h-10 w-10 rounded-xl hover:bg-red-50 text-red-500 transition-colors">
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    );
                                }) : (
                                    <TableRow>
                                        <TableCell colSpan={6} className="text-center h-48 py-10">
                                            <div className="flex flex-col items-center justify-center opacity-30">
                                                <Plus className="w-10 h-10 mb-4" />
                                                <p className="font-medium uppercase tracking-widest text-xs">{t('no_expense_items_added')}</p>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
      </div>
    </div>
  );
}

export default function NewFilePage() {
  return (
    <Suspense fallback={
      <div className="flex justify-center items-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    }>
      <NewFileContent />
    </Suspense>
  );
}
