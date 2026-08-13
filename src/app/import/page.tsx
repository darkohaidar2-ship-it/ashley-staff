'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Loader2, File, CheckCircle, Save, Calendar, Link as LinkIcon, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { format, formatISO } from 'date-fns';
import * as XLSX from 'xlsx';
import { cn } from '@/lib/utils';
import { useAppContext } from '@/context/app-provider';
import type { Item } from '@/lib/types';

type ImportedItem = {
  model: string;
  quantity: number;
  notes?: string;
};

const sources = [
  { value: "Showroom", label: "شۆڕوم (Showroom)" },
  { value: "Ashley Store", label: "کۆگای ئاشلی (Ashley Store)" },
  { value: "Huana Store", label: "کۆگای هوئانا (Huana Store)" }
];

const classifications = [
  { value: "Bedroom", label: "ژووری خەوتن (Bedroom)" },
  { value: "Dining Room", label: "ژووری نانخواردن (Dining Room)" },
  { value: "Living Room", label: "ژووری دانیشتن (Living Room)" },
  { value: "Kitchen", label: "مەتبەخ (Kitchen)" },
  { value: "Office", label: "نووسینگە (Office)" },
  { value: "Outdoor", label: "دەرەوە (Outdoor)" },
  { value: "Hallway", label: "ڕاڕەو (Hallway)" },
  { value: "Warehouse", label: "کۆگا (Warehouse)" },
  { value: "Others", label: "وانی تر (Others)" }
];

export default function ImportPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { employees, setExcelFiles, setItems } = useAppContext();

  const [isProcessing, setIsProcessing] = useState(false);
  const [activeTab, setActiveTab] = useState('local');

  // Common Form State
  const [storekeeperId, setStorekeeperId] = useState('');
  const [source, setSource] = useState('');
  const [categoryName, setCategoryName] = useState('');
  const [classification, setClassification] = useState('');
  const [date, setDate] = useState<Date | undefined>(undefined);

  // Local File State
  const [file, setFile] = useState<File | null>(null);

  // Google Sheet State
  const [googleSheetUrl, setGoogleSheetUrl] = useState('');

  useEffect(() => {
    setDate(new Date());
  }, []);
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.type !== 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' && selectedFile.type !== 'application/vnd.ms-excel') {
        toast({ variant: 'destructive', title: 'جۆری فایلی نادروست', description: 'تکایە فایلی XLSX یان XLS باربکە.' });
        return;
      }
      setFile(selectedFile);
    }
  };

  const handleSaveAndContinue = async () => {
    const isLocal = activeTab === 'local';
    
    if (isLocal && !file) {
        toast({ variant: 'destructive', title: 'فایل دیاری نەکراوە', description: 'تکایە فایلێکی ئێکسڵ هەڵبژێرە.' });
        return;
    }

    if (!isLocal && !googleSheetUrl) {
        toast({ variant: 'destructive', title: 'لینک دیاری نەکراوە', description: 'تکایە لینکی گووگڵ شیت بنووسە.' });
        return;
    }

    if (!storekeeperId || !source || !date || !categoryName) {
      toast({ variant: 'destructive', title: 'زانیاری کەمە', description: 'تکایە هەموو خانەکان پڕ بکەرەوە.' });
      return;
    }
    
    setIsProcessing(true);

    try {
      if (isLocal && file) {
          const data = await file.arrayBuffer();
          const workbook = XLSX.read(data, { type: 'buffer' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const json = XLSX.utils.sheet_to_json(worksheet, { defval: "" }) as any[];

          const parsedItems: ImportedItem[] = json
            .map(row => ({
              model: String(row.Model || row.model || ''),
              quantity: Number(row.Quantity || row.quantity || row.Qty || row.qty || 0),
              notes: String(row.Notes || row.notes || ''),
            }))
            .filter(item => item.model && item.quantity > 0);

          if (parsedItems.length === 0) {
            toast({ variant: 'destructive', title: 'هیچ داتایەک نەدۆزرایەوە', description: 'فایلی ئێکسڵەکە دیارە بەتاڵە یان بە شێوەیەکی دروست فۆرمات نەکراوە.' });
            setIsProcessing(false);
            return;
          }

          const fileId = crypto.randomUUID();
          
          const fileData = {
            id: fileId,
            storekeeperId,
            storageName: file.name,
            categoryName,
            classification,
            date: formatISO(date!),
            source,
            type: 'imported' as const
          };
          
          const newItems: Item[] = parsedItems.map(item => ({
            id: crypto.randomUUID(),
            fileId: fileId,
            ...item
          }));

          setExcelFiles(prev => [...prev, fileData]);
          setItems(prev => [...prev, ...newItems]);

          toast({ title: 'سەرکەوتوو بوو!', description: 'فایلەکە هاوردەکرا.' });
          router.push(`/archive/${fileId}`);
      } else {
          // Google Sheet Linking & Data Extraction
          const spreadsheetIdMatch = googleSheetUrl.match(/\/d\/([a-zA-Z0-9-_]+)/);
          if (!spreadsheetIdMatch) {
              toast({ variant: 'destructive', title: 'لینکی نادروست', description: 'نەتوانرا Spreadsheet ID لە لینکەکە دەربهێنرێت.' });
              setIsProcessing(false);
              return;
          }

          const spreadsheetId = spreadsheetIdMatch[1];
          // Construct the CSV export URL
          const csvUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv`;

          try {
              const response = await fetch(csvUrl);
              if (!response.ok) throw new Error('پەیوەندی بەستن بە داتاکان سەرنەکەوت. دڵنیابە لەوەی شیتەکە گشتییە (Anyone with link can view).');
              
              const csvText = await response.text();
              const workbook = XLSX.read(csvText, { type: 'string' });
              const sheetName = workbook.SheetNames[0];
              const worksheet = workbook.Sheets[sheetName];
              const json = XLSX.utils.sheet_to_json(worksheet, { defval: "" }) as any[];

              const parsedItems: ImportedItem[] = json
                .map(row => ({
                  model: String(row.Model || row.model || ''),
                  quantity: Number(row.Quantity || row.quantity || row.Qty || row.qty || 0),
                  notes: String(row.Notes || row.notes || ''),
                }))
                .filter(item => item.model && item.quantity > 0);

              if (parsedItems.length === 0) {
                 toast({ variant: 'destructive', title: 'پەڕەی بەتاڵ', description: 'بە سەرکەوتوویی پەیوەندی بەسترا بەڵام هیچ داتایەکی دروست نەدۆزرایەوە (ستوونی مۆدێل/دانە کەمە).' });
                 setIsProcessing(false);
                 return;
              }

              const fileId = crypto.randomUUID();
              
              const fileData = {
                id: fileId,
                storekeeperId,
                storageName: `G-Sheet: ${categoryName}`,
                categoryName,
                classification,
                date: formatISO(date!),
                source,
                type: 'google-sheet' as any,
                externalLink: googleSheetUrl
              };

              const newItems: Item[] = parsedItems.map(item => ({
                id: crypto.randomUUID(),
                fileId: fileId,
                ...item
              }));

              setExcelFiles(prev => [...prev, fileData]);
              setItems(prev => [...prev, ...newItems]);

              toast({ title: 'سەرکەوتوو بوو!', description: 'داتاکانی گووگڵ شیت هاوردەکرا و هاوکاتکرا.' });
              router.push(`/archive/${fileId}`);
          } catch (err: any) {
              toast({ variant: 'destructive', title: 'پەیوەندی سەرنەکەوت', description: err.message || 'دڵنیابە لەوەی شیتەکە گشتییە بۆ ئەوەی سیستەمەکە بتوانێت داتاکان بخوێنێتەوە.' });
              setIsProcessing(false);
          }
      }
      
    } catch (error) {
      console.error("Error saving record:", error);
      toast({ variant: 'destructive', title: 'هەڵە', description: 'نەتوانرا داتاکان پرۆسێس یان پاشەکەوت بکرێن.' });
      setIsProcessing(false);
    }
  };
  
  if (!date) {
    return <div className="flex justify-center items-center h-screen"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  return (
    <div className="min-h-screen bg-background text-foreground p-4 md:p-8" dir="rtl">
      <header className="flex items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" asChild>
            <Link href="/admin">
              <ArrowLeft className="rotate-180" />
              <span className="sr-only">گەڕانەوە</span>
            </Link>
          </Button>
          <h1 className="text-2xl md:text-3xl font-bold">هاوردەکردنی داتا</h1>
        </div>
      </header>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="max-w-2xl mx-auto space-y-6">
        <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="local">فایلی ئێکسڵی ناوخۆیی</TabsTrigger>
            <TabsTrigger value="google">لینکی گووگڵ شیتس</TabsTrigger>
        </TabsList>

        <Card>
            <CardHeader>
            <CardTitle>{activeTab === 'local' ? 'هاوردەکردنی ناوخۆیی' : 'هاوکاری و هاوکاتکردنی پەڕە'}</CardTitle>
            <CardDescription>
                {activeTab === 'local' 
                    ? 'فایلێکی ئێکسڵ (.xlsx) باربکە بۆ پشکنین و ناردنی ناوەڕۆکەکەی بۆ ئەرشیف.' 
                    : 'لینکێکی گووگڵ شیت ببەستەوە بۆ بەڕێوەبردنی داتا دەرەکییەکان لە ناو سیستەمەکەدا.'}
            </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
            
            <TabsContent value="local" className="mt-0 space-y-6">
                <div className="space-y-2">
                    <Label htmlFor="file-upload">فایلی ئێکسڵ (.xlsx, .xls)</Label>
                    <Input id="file-upload" type="file" onChange={handleFileChange} accept=".xlsx,.xls" />
                    {file && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground pt-2">
                        <File className="w-4 h-4" />
                        <span>{file.name}</span>
                        <CheckCircle className="w-4 h-4 text-green-500" />
                    </div>
                    )}
                </div>
            </TabsContent>

            <TabsContent value="google" className="mt-0 space-y-6">
                <div className="space-y-2">
                    <Label htmlFor="sheet-url">لینکی گشتی گووگڵ شیت</Label>
                    <div className="relative">
                        <Globe className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input 
                            id="sheet-url" 
                            className="pr-9"
                            placeholder="https://docs.google.com/spreadsheets/d/..."
                            value={googleSheetUrl}
                            onChange={(e) => setGoogleSheetUrl(e.target.value)}
                        />
                    </div>
                </div>
            </TabsContent>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t">
                <div className="space-y-2">
                    <Label htmlFor="storekeeper">بەرپرسی کۆگا / ئەنجامدەر (کارمەند)</Label>
                    <Select onValueChange={setStorekeeperId} value={storekeeperId}>
                        <SelectTrigger id="storekeeper">
                            <SelectValue placeholder="کارمەندێک هەڵبژێرە" />
                        </SelectTrigger>
                        <SelectContent>
                            {employees?.map(emp => (
                                <SelectItem key={emp.id} value={emp.id}>{emp.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-2">
                    <Label htmlFor="source">سەرچاوە / کۆگا</Label>
                    <Select onValueChange={setSource} value={source}>
                        <SelectTrigger id="source">
                            <SelectValue placeholder="سەرچاوەیەک هەڵبژێرە" />
                        </SelectTrigger>
                        <SelectContent>
                            {sources.map(s => (
                                <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                    <Label htmlFor="category-name">ناوی پرۆژە / پۆلێن</Label>
                    <Input id="category-name" value={categoryName} onChange={(e) => setCategoryName(e.target.value)} placeholder="بۆ نموونە: جەردی گشتی ٢٠٢٦" />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="classification">پۆلێنکردن / فۆڵدەر</Label>
                    <Select onValueChange={setClassification} value={classification}>
                        <SelectTrigger id="classification">
                            <SelectValue placeholder="هەڵبژێرە (بۆ نموونە: Bedroom)" />
                        </SelectTrigger>
                        <SelectContent>
                            {classifications.map(c => (
                                <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>
            
            <div className="space-y-2">
                <Label>بەرواری هاوکاتکردن</Label>
                <Popover>
                <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start text-right font-normal", !date && "text-muted-foreground")}>
                    <Calendar className="ml-2 h-4 w-4" />
                    {date ? format(date, 'PPP') : <span>بەروارێک هەڵبژێرە</span>}
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                    <CalendarComponent mode="single" selected={date} onSelect={setDate} initialFocus />
                </PopoverContent>
                </Popover>
            </div>
            
            <Button 
                onClick={handleSaveAndContinue} 
                disabled={isProcessing || (activeTab === 'local' ? !file : !googleSheetUrl) || !storekeeperId || !source || !date || !categoryName} 
                className="w-full h-12 text-lg font-bold"
            >
                {isProcessing ? <Loader2 className="animate-spin ml-2" /> : activeTab === 'local' ? <Save className="ml-2" /> : <LinkIcon className="ml-2" />}
                {activeTab === 'local' ? 'پشکنین و هاوردەکردنی فایل' : 'بەستنەوەی گووگڵ شیت'}
            </Button>
            </CardContent>
        </Card>
      </Tabs>
    </div>
  );
}
