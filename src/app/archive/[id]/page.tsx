'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { BarChart, Bar, XAxis, YAxis, Tooltip, Cell, ResponsiveContainer, PieChart, Pie, Legend, Sector } from 'recharts';
import { ArrowLeft, User, Calendar as CalendarIcon, Building, FileText, MapPin, Edit, Trash2, Save, X, ArrowUpDown, ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Search, Upload, Printer, FileType, Clock, Loader2, Target, FilePlus2, FileSpreadsheet, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { format, parseISO } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { cn, WAREHOUSE_COLORS } from '@/lib/utils';
import { useAppContext } from '@/context/app-provider';
import type { ExcelFile, Item, Employee, StorageLocation, ActivityLog } from '@/lib/types';
import { useTranslation } from '@/hooks/use-translation';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import * as XLSX from 'xlsx';
import { useAuth } from '@/hooks/use-auth';


type SortableKeys = keyof Item;

const PaginationControls = ({ currentPage, totalPages, onPageChange }: { currentPage: number, totalPages: number, onPageChange: (page: number) => void }) => {
  const handlePrevious = () => onPageChange(currentPage - 1);
  const handleNext = () => onPageChange(currentPage + 1);

  const pageNumbers = [];
  const maxPagesToShow = 5;
  let startPage, endPage;

  if (totalPages <= maxPagesToShow) {
    startPage = 1;
    endPage = totalPages;
  } else {
    if (currentPage <= Math.ceil(maxPagesToShow / 2)) {
      startPage = 1;
      endPage = maxPagesToShow;
    } else if (currentPage + Math.floor(maxPagesToShow / 2) >= totalPages) {
      startPage = totalPages - maxPagesToShow + 1;
      endPage = totalPages;
    } else {
      startPage = currentPage - Math.floor(maxPagesToShow / 2);
      endPage = currentPage + Math.floor(maxPagesToShow / 2);
    }
  }

  for (let i = startPage; i <= endPage; i++) {
    pageNumbers.push(i);
  }

  return (
    <div className="flex items-center justify-center space-x-2 my-4">
      <Button variant="outline" size="icon" onClick={handlePrevious} disabled={currentPage === 1}>
        <ChevronLeft className="h-4 w-4" />
      </Button>
      {startPage > 1 && (
         <>
          <Button variant="ghost" size="icon" onClick={() => onPageChange(1)}>1</Button>
          {startPage > 2 && <span className='text-muted-foreground'>...</span>}
         </>
      )}
      {pageNumbers.map(number => (
        <Button key={number} variant={currentPage === number ? "default" : "outline"} size="icon" onClick={() => onPageChange(number)}>
          {number}
        </Button>
      ))}
      {endPage < totalPages && (
        <>
          {endPage < totalPages -1 && <span className='text-muted-foreground'>...</span>}
          <Button variant="ghost" size="icon" onClick={() => onPageChange(totalPages)}>{totalPages}</Button>
        </>
      )}
      <Button variant="outline" size="icon" onClick={handleNext} disabled={currentPage === totalPages}>
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
};

const InventoryDashboard = ({ items }: { items: Item[] }) => {
    const { t } = useTranslation();

    const stats = useMemo(() => {
        const data = {
            Correct: 0,
            Less: 0,
            More: 0,
            'Qty Changed': 0,
            Pending: 0,
            TotalQty: 0,
            Damaged: 0,
            Wrapped: 0,
        };
        
        items.forEach(item => {
            data.TotalQty += item.quantity || 0;
            if (!item.storageStatus) {
                data.Pending++;
            } else {
                data[item.storageStatus as keyof typeof data]++;
            }
            if (item.modelCondition === 'Damaged') data.Damaged++;
            if (item.modelCondition === 'Wrapped') data.Wrapped++;
        });

        return data;
    }, [items]);

    const isRTL = true; // Lock translations to Kurdish as system standard

    const pieData = [
        { name: isRTL ? 'دروست' : 'Correct', value: stats.Correct, fill: '#10b981' },
        { name: isRTL ? 'کەمتر' : 'Less', value: stats.Less, fill: '#ef4444' },
        { name: isRTL ? 'زیاتر' : 'More', value: stats.More, fill: '#3b82f6' },
        { name: isRTL ? 'چاوەڕوانکراو' : 'Pending', value: stats.Pending, fill: '#94a3b8' },
    ].filter(d => d.value > 0);

    const conditionData = [
        { name: isRTL ? 'پێچراوە' : 'Packaged', value: stats.Correct, fill: '#10b981' },
        { name: isRTL ? 'پێچراوە' : 'Wrapped', value: stats.Wrapped, fill: '#fbbf24' },
        { name: isRTL ? 'زیانپێکەوتوو' : 'Damaged', value: stats.Damaged, fill: '#f43f5e' },
    ].filter(d => d.value > 0);

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Status Breakdown (Pie Chart) */}
            <Card className="rounded-[2rem] border-black/5 shadow-sm bg-white dark:bg-zinc-900 overflow-hidden">
                <CardHeader className="pb-2">
                    <CardTitle className="text-xs font-black uppercase tracking-widest text-slate-400">{isRTL ? 'دۆخی کاڵا' : 'Status'}</CardTitle>
                </CardHeader>
                <CardContent className="h-[200px] relative">
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                data={pieData}
                                cx="50%"
                                cy="50%"
                                innerRadius={50}
                                outerRadius={65}
                                paddingAngle={5}
                                dataKey="value"
                                stroke="none"
                             >
                                {pieData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.fill} className="hover:opacity-80 transition-opacity cursor-pointer" />
                                ))}
                            </Pie>
                            <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 30px rgba(0,0,0,0.1)' }} />
                        </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none mt-6">
                        <span className="text-2xl font-black text-black leading-none">{items.length}</span>
                        <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-1">{isRTL ? 'مۆدێلەکان' : 'Models'}</span>
                    </div>
                </CardContent>
            </Card>

            {/* Condition Breakdown */}
            <Card className="rounded-[2rem] border-black/5 shadow-sm bg-white dark:bg-zinc-900 overflow-hidden">
                <CardHeader className="pb-2">
                    <CardTitle className="text-xs font-black uppercase tracking-widest text-slate-400">{isRTL ? 'بارودۆخ' : 'Condition'}</CardTitle>
                </CardHeader>
                <CardContent className="h-[200px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                data={conditionData}
                                cx="50%"
                                cy="50%"
                                innerRadius={50}
                                outerRadius={65}
                                paddingAngle={5}
                                dataKey="value"
                                stroke="none"
                            >
                                {conditionData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.fill} />
                                ))}
                            </Pie>
                            <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 30px rgba(0,0,0,0.1)' }} />
                        </PieChart>
                    </ResponsiveContainer>
                </CardContent>
            </Card>

            {/* Quantity Metrics (Bar Chart) */}
            <Card className="rounded-[2rem] border-black/5 shadow-sm bg-white dark:bg-zinc-900 overflow-hidden lg:col-span-2">
                <CardHeader className="pb-2 flex flex-row items-center justify-between">
                    <div>
                        <CardTitle className="text-xs font-black uppercase tracking-widest text-slate-400">{isRTL ? 'یەکەکانی جەرد' : 'Inventory Units'}</CardTitle>
                    </div>
                    <div className="text-right">
                        <p className="text-[8px] font-black uppercase tracking-widest text-slate-400">{isRTL ? 'کۆی گشتی یەکەکان' : 'Total Units'}</p>
                        <p className="text-lg font-black text-emerald-600">{stats.TotalQty}</p>
                    </div>
                </CardHeader>
                <CardContent className="h-[200px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={[
                            { name: isRTL ? 'دروست' : 'Correct', val: stats.Correct, fill: '#10b981' },
                            { name: isRTL ? 'کەمتر' : 'Less', val: stats.Less, fill: '#ef4444' },
                            { name: isRTL ? 'زیاتر' : 'More', val: stats.More, fill: '#3b82f6' },
                            { name: isRTL ? 'گۆڕدراو' : 'Changed', val: stats['Qty Changed'], fill: '#a855f7' },
                        ]}>
                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 700, fill: '#94a3b8' }} />
                            <YAxis hide />
                            <Tooltip cursor={{ fill: 'rgba(0,0,0,0.02)' }} contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 30px rgba(0,0,0,0.1)' }} />
                            <Bar dataKey="val" radius={[6, 6, 0, 0]} barSize={30}>
                                {[stats.Correct, stats.Less, stats.More, stats['Qty Changed']].map((v, i) => (
                                    <Cell key={`cell-${i}`} fill={['#10b981', '#ef4444', '#3b82f6', '#a855f7'][i]} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </CardContent>
            </Card>
        </div>
    );
};


export default function FileDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { t, language } = useTranslation();
  const { toast } = useToast();
  const { user } = useAuth();
  const fileId = params.id as string;
  const { 
    excelFiles, setExcelFiles, 
    items, setItems: setAllItems, 
    employees, 
    locations,
    settings,
    setActivityLogs
  } = useAppContext();

  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editableItems, setEditableItems] = useState<Item[]>([]);
  const [editableFile, setEditableFile] = useState<Partial<ExcelFile>>({});
  const [originalQuantities, setOriginalQuantities] = useState<Record<string, number>>({});
  const [sortConfig, setSortConfig] = useState<{ key: SortableKeys; direction: 'ascending' | 'descending' } | null>({ key: 'model', direction: 'ascending' });
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 40;

  // Filter states for table
  const [filterLocationGroup, setFilterLocationGroup] = useState<string>('All');
  const [locationSearchModal, setLocationSearchModal] = useState('');

  const { appLogo: logoSrc, customFont } = settings;
  
  const [isFocusMode, setIsFocusMode] = useState(false);
  
  const updateFileInputRef = useRef<HTMLInputElement>(null);
  
  const file = useMemo(() => excelFiles.find(f => f.id === fileId), [excelFiles, fileId]);
  const fileItems = useMemo(() => items.filter(i => i.fileId === fileId), [items, fileId]);

  useEffect(() => {
    if (file) {
      setEditableFile(JSON.parse(JSON.stringify(file))); 
      setEditableItems(JSON.parse(JSON.stringify(fileItems.map(item => ({...item, updateStatus: ''})))));
      setIsLoading(false);
    } else if (excelFiles.length > 0){
        setIsLoading(false);
    }
  }, [file, fileItems, excelFiles]);
  

  useEffect(() => {
    if (isEditing) {
        setEditableItems(current => current.map(item => ({ ...item, updateStatus: '' })));
        const qtyMap: Record<string, number> = {};
        fileItems?.forEach(item => { qtyMap[item.id] = item.quantity; });
        setOriginalQuantities(qtyMap);
    } else {
        setOriginalQuantities({});
        if(file) setEditableFile(JSON.parse(JSON.stringify(file)));
    }
  }, [isEditing, fileItems, file]);

  const sortedItems = useMemo(() => {
    let itemsToProcess = isEditing ? editableItems : (fileItems || []);
    
    if (searchQuery) {
      itemsToProcess = itemsToProcess.filter(item => 
        item.model.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    if (filterLocationGroup !== 'All') {
      itemsToProcess = itemsToProcess.filter(item => {
        const itemLocs = item.locationIds || [];
        if (itemLocs.length === 0) return false;
        
        return itemLocs.some(locId => {
          const loc = locations?.find(l => l.id === locId);
          if (!loc) return false;
          
          if (loc.warehouseType !== defaultWarehouseType) return false;
          
          const parts = loc.name.split('-');
          const g = defaultWarehouseType === 'Huana' 
            ? `Warehouse ${parts[1]} - Floor ${parts[2]}` 
            : `Floor ${parts[1]}${parts[2] === 'O' ? ' (Office)' : ` (Area ${parts[2]})`}`;
            
          return g === filterLocationGroup;
        });
      });
    }

    let sortableItems = [...itemsToProcess];
    if (sortConfig !== null) {
      sortableItems.sort((a, b) => {
        if (sortConfig.key === 'locationIds') {
             const getLocStr = (i: Item) => {
                 const ids = i.locationIds || ((i as any).locationId ? [(i as any).locationId] : []);
                 return ids.length > 0 ? (locations?.find(l => l.id === ids[0])?.name || '') : '';
             };
            const locA = getLocStr(a);
            const locB = getLocStr(b);
            if (locA < locB) return sortConfig.direction === 'ascending' ? -1 : 1;
            if (locA > locB) return sortConfig.direction === 'ascending' ? 1 : -1;
            return 0;
        }

        const aValue = a[sortConfig.key];
        const bValue = b[sortConfig.key];

        if (aValue === undefined || aValue === null) return 1;
        if (bValue === undefined || bValue === null) return -1;
        
        if (aValue < bValue) {
          return sortConfig.direction === 'ascending' ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortConfig.direction === 'ascending' ? 1 : -1;
        }
        return 0;
      });
    }
    return sortableItems;
  }, [isEditing, editableItems, fileItems, sortConfig, searchQuery]);

  const paginatedItems = useMemo(() => {
      return sortedItems.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  }, [sortedItems, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(sortedItems.length / itemsPerPage);

  const requestSort = (key: SortableKeys) => {
    let direction: 'ascending' | 'descending' = 'ascending';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };
  
  const getSortIcon = (key: SortableKeys) => {
    if (!sortConfig || sortConfig.key !== key) {
      return <ArrowUpDown className="w-3 h-3 ml-1 opacity-20" />;
    }
    if (sortConfig.direction === 'ascending') {
      return <ArrowUp className="w-3 h-3 ml-1" />;
    }
    return <ArrowDown className="w-3 h-3 ml-1" />;
  };

  const handleItemChange = (itemId: string, field: keyof Item, value: any) => {
    setEditableItems(currentItems =>
      currentItems.map(item =>
        item.id === itemId ? { ...item, [field]: value } : item
      )
    );
  };
  
  const handleSave = async () => {
    if (!fileId || !file) return;

    setExcelFiles(excelFiles.map(f => f.id === fileId ? { ...f, ...editableFile, classification: editableFile.classification } as ExcelFile : f));
    
    const originalItemIds = new Set(fileItems.map(i => i.id));
    const finalItemIds = new Set<string>();

    const updatedItems: Item[] = [];
    const newItems: Item[] = [];

    editableItems.forEach(item => {
        finalItemIds.add(item.id);
        const { updateStatus, ...itemData } = item;
        if (updateStatus === 'NEW') {
            const newItem = {...itemData, id: crypto.randomUUID(), fileId};
            newItems.push(newItem as Item);
        } else if (originalItemIds.has(item.id)) {
            updatedItems.push(itemData as Item);
        }
    });

    const deletedItemIds = Array.from(originalItemIds).filter(id => !finalItemIds.has(id));

    setAllItems(prevAllItems => [
      ...prevAllItems.filter(item => item.fileId !== fileId),
      ...prevAllItems.filter(item => fileId === item.fileId && !deletedItemIds.includes(item.id))
                     .map(oldItem => updatedItems.find(upd => upd.id === oldItem.id) || oldItem),
      ...newItems
    ]);

    toast({ title: "Success", description: "All changes have been saved." });
    setIsEditing(false);

    if(user) {
        const log: ActivityLog = { id: crypto.randomUUID(), userId: user.id, username: user.username, action: 'update', entity: 'Excel File', entityId: file.id, description: `Updated items in file: ${file.storageName}`, timestamp: new Date().toISOString() };
        setActivityLogs(prev => [...prev, log]);
    }
  };


  const handleDeleteFile = () => {
    if(!file) return;
    setExcelFiles(excelFiles.filter(f => f.id !== fileId));
    setAllItems(items.filter(i => i.fileId !== fileId));
    toast({ title: "File Deleted", description: `The Excel file has been removed.` });
    
    if (user) {
        const log: ActivityLog = { id: crypto.randomUUID(), userId: user.id, username: user.username, action: 'delete', entity: 'Excel File', entityId: file.id, description: `Deleted file: ${file.storageName}`, timestamp: new Date().toISOString() };
        setActivityLogs(prev => [...prev, log]);
    }

    router.push('/archive');
  }
  
  const handleFileUpdate = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const newFile = event.target.files?.[0];
    if (!newFile) return;

    try {
      const data = await newFile.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const importedItemsRaw = XLSX.utils.sheet_to_json(worksheet, { defval: "" }) as any[];

      const importedItems = new Map<string, { model: string, quantity: number }>();
      importedItemsRaw.forEach(row => {
          const model = String(row.Model || row.model || '').trim();
          if (model) {
            importedItems.set(model, {
                model,
                quantity: Number(row.Quantity || row.quantity || row.Qty || row.qty || 0),
            });
          }
      });
      
      const currentItems = editableItems || [];
      const updatedItems: Item[] = [];
      const existingModelsInNewFile = new Set<string>();

      currentItems.forEach(item => {
          const newItemData = importedItems.get(item.model);
          if (newItemData) {
              if (item.quantity !== newItemData.quantity) {
                  updatedItems.push({ ...item, quantity: newItemData.quantity, updateStatus: 'UPDATED' });
              } else {
                  updatedItems.push(item);
              }
              existingModelsInNewFile.add(item.model);
          }
      });
      
      importedItems.forEach((newItemData, model) => {
        if (!existingModelsInNewFile.has(model)) {
            updatedItems.push({
                id: `new_${Date.now()}_${model}`, 
                fileId: fileId,
                model: newItemData.model,
                quantity: newItemData.quantity,
                 notes: '',
                 storageStatus: '',
                 modelCondition: '',
                 locationIds: [],
                 updateStatus: 'NEW'
            });
        }
      });
      
      setEditableItems(updatedItems);
      toast({ title: "File Ready for Review", description: "Review the changes and click 'Save Changes' to confirm." });

    } catch (error) {
      console.error("Error processing update file:", error);
      toast({ variant: "destructive", title: "File Error", description: "Could not process the uploaded file." });
    } finally {
        if(updateFileInputRef.current) updateFileInputRef.current.value = "";
    }
  };


  const getEmployeeName = (id: string) => employees?.find(e => e.id === id)?.name || '...';
  const getLocationName = (id?: string) => locations?.find(l => l.id === id)?.name || '...';
  
  const getWarehouseTypeFromSource = (source?: string) => {
      if (source === 'Ashley Store') return 'Ashley';
      if (source === 'Huana Store') return 'Huana';
      return null;
  }
  const defaultWarehouseType = getWarehouseTypeFromSource(file?.source);
  
  const availableGroups = useMemo(() => {
     if (!locations) return [];
     return Array.from(new Set(locations.filter(l => l.warehouseType === defaultWarehouseType).map(l => {
         const parts = l.name.split('-');
         if (parts.length === 2) return `Level ${parts[0]}`;
         if (parts.length > 2) return `Level ${parts[0]} - Area ${parts[1]}`;
         return 'Other';
     })));
  }, [locations, defaultWarehouseType]);
  



  const getLocationColor = (id?: string) => {
    if (!id) return 'bg-slate-100 text-slate-400';
    const loc = locations?.find(l => l.id === id);
    if (!loc) return 'bg-slate-100 text-slate-400';
    
    // Custom colors per warehouse type/floor
    if (loc.warehouseType === 'Huana') {
        if (loc.name.includes('-1-')) return 'bg-emerald-100 text-emerald-700 border-emerald-200';
        if (loc.name.includes('-2-')) return 'bg-teal-100 text-teal-700 border-teal-200';
        return 'bg-blue-100 text-blue-700 border-blue-200';
    }
    if (loc.warehouseType === 'Ashley') {
        if (loc.name.includes('A-4')) return 'bg-purple-100 text-purple-700 border-purple-200';
        if (loc.name.includes('A-3')) return 'bg-indigo-100 text-indigo-700 border-indigo-200';
        return 'bg-violet-100 text-violet-700 border-violet-200';
    }
    return 'bg-slate-100 text-slate-700 border-slate-200';
  };

  const getRowClass = (item: Item) => {
    if (isEditing) {
        switch (item.updateStatus) {
            case 'NEW': return 'bg-emerald-50/50';
            case 'UPDATED': return 'bg-blue-50/50';
            default: return '';
        }
    }
    return '';
  };
  
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  const handlePrint = () => {
    window.print();
  };

  if (isLoading) {
    return <div className="p-20 flex justify-center"><Loader2 className="w-10 h-10 animate-spin text-primary" /></div>;
  }

  if (!file) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen text-center p-8">
        <FileText className="w-20 h-20 text-muted-foreground mb-6 opacity-20" />
        <h2 className="text-2xl font-bold tracking-tighter uppercase mb-6">{t('file_not_found')}</h2>
        <Button asChild variant="ghost" className="font-black uppercase tracking-widest text-[10px]">
          <Link href="/archive">
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t('back_to_archive')}
          </Link>
        </Button>
      </div>
    );
  }

  const isRTL = language === 'ku';
  const isImported = file.type === 'imported' || file.type === 'google-sheet';

  return (
    <div className={cn('bg-[#fbfbfb] dark:bg-zinc-950 min-h-screen pb-20', isRTL ? "font-kurmanji" : "font-sans")} dir={isRTL ? "rtl" : "ltr"}>
      <input type="file" ref={updateFileInputRef} onChange={handleFileUpdate} className="hidden" accept=".xlsx,.xls" />
      
      {/* STICKY HEADER */}
      {!isFocusMode && (
        <header className="sticky top-0 z-50 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl border-b border-black/5 p-4 print:hidden">
        <div className="max-w-[1600px] mx-auto flex items-center justify-between gap-4">
            <div className='flex items-center gap-6'>
                <Button variant="ghost" size="icon" asChild className="rounded-full hover:bg-black/5 transition-all">
                    <Link href="/archive">
                        <ArrowLeft className="w-5 h-5 text-black" />
                    </Link>
                </Button>
                <div>
                    <h1 className="text-base font-normal tracking-[0.2em] uppercase text-slate-400 leading-none mb-1">{t('file_details')}</h1>
                    <div className="flex items-center gap-2">
                        <h2 className="text-xl font-normal tracking-tighter uppercase text-black">{file.storageName}</h2>
                        <Badge variant="outline" className="text-[9px] font-normal tracking-widest uppercase py-0 px-2 rounded-full border-black/10 text-black">{file.type}</Badge>
                    </div>
                </div>
            </div>
            <div className='flex items-center gap-2'>
                <Button 
                    variant={isFocusMode ? "default" : "outline"}
                    onClick={() => setIsFocusMode(!isFocusMode)}
                    className={cn("text-[10px] font-medium uppercase tracking-widest h-9 px-6 rounded-xl transition-all", isFocusMode ? "bg-black text-white" : "border-black/5 text-black")}
                >
                    <Target className="mr-2 h-3.5 w-3.5" />
                    دۆخی سەرنجدان
                </Button>
                {isEditing ? (
                    <>
                    <Button variant="outline" onClick={() => updateFileInputRef.current?.click()} className="text-[10px] font-black uppercase tracking-widest h-9 px-6 rounded-xl border-black/5">
                        <Upload className="mr-2 h-3.5 w-3.5" /> {t('update_with_new_file')}
                    </Button>
                    <Button onClick={handleSave} className="text-[10px] font-black uppercase tracking-widest h-9 px-8 rounded-xl shadow-xl shadow-primary/20">
                        <Save className="mr-2 h-3.5 w-3.5"/> {t('save_changes')}
                    </Button>
                    <Button variant="ghost" onClick={() => setIsEditing(false)} className="text-[10px] font-black uppercase tracking-widest h-9 px-6 rounded-xl hover:bg-red-50 hover:text-red-600 transition-colors">
                        <X className="mr-2 h-3.5 w-3.5"/> {t('cancel')}
                    </Button>
                    </>
                ) : (
                    <>
                    <Button variant="outline" asChild className="text-[10px] font-black uppercase tracking-widest h-9 px-6 rounded-xl border-black/5">
                        <Link href={`/pdf/archive/${file.id}`} target="_blank">
                            <FileType className="mr-2 h-3.5 w-3.5" /> PDF
                        </Link>
                    </Button>
                    <Button onClick={() => setIsEditing(true)} className="text-[10px] font-black uppercase tracking-widest h-9 px-8 rounded-xl">
                        <Edit className="mr-2 h-3.5 w-3.5"/>{t('edit')}
                    </Button>
                    <Button variant="outline" size="icon" onClick={handlePrint} className="h-9 w-9 border-black/5 rounded-xl"><Printer className="h-4 w-4" /></Button>
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button variant="outline" size="icon" className="h-9 w-9 rounded-xl border-black/5 text-red-500 hover:bg-red-50 hover:text-red-600">
                                <Trash2 className="w-4 h-4" />
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="rounded-[2rem]">
                            <AlertDialogHeader>
                                <AlertDialogTitle className="font-black uppercase tracking-tighter">دڵنیابوون لە سڕینەوە</AlertDialogTitle>
                                <AlertDialogDescription>
                                    دڵنیایت دەتەوێت بسڕیتەوە <span className="font-bold text-slate-900">"{file.storageName}"</span>? ئەم کردارە ناگەڕێنرێتەوە.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel className="rounded-xl font-black uppercase text-[10px] tracking-widest">پاشگەزبوونەوە</AlertDialogCancel>
                                <AlertDialogAction onClick={handleDeleteFile} className="rounded-xl font-black uppercase text-[10px] tracking-widest bg-red-500 hover:bg-red-600 shadow-xl shadow-red-500/20">سڕینەوەی فایل</AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                    </>
                )}
            </div>
        </div>
      </header>
      )}

      {isFocusMode && (
          <div className="fixed top-4 right-4 z-[100] print:hidden">
                <Button 
                    variant="default"
                    onClick={() => setIsFocusMode(false)}
                    className="text-[10px] font-medium uppercase tracking-widest h-9 px-6 rounded-xl bg-black text-white shadow-xl"
                >
                    <X className="mr-2 h-3.5 w-3.5" />
                    چوونەدەرەوە لە دۆخی سەرنجدان
                </Button>
          </div>
      )}

      <main className={cn("mx-auto px-4 lg:px-10", isFocusMode ? "max-w-full pt-4" : "max-w-[1600px] pt-10")}>
        
        {/* TOP INFORMATION BANNER */}
        {!isFocusMode && (
          <section className="animate-in fade-in slide-in-from-top-4 duration-700">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="bg-white dark:bg-zinc-900 p-8 rounded-[2.5rem] border border-black/5 shadow-sm">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">کۆنتێکستی کۆگا</p>
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-primary/5 flex items-center justify-center text-primary">
                            <Building className="w-6 h-6" />
                        </div>
                        <div className="flex-1">
                            {isEditing ? (
                                <Select value={editableFile.source || ''} onValueChange={v => setEditableFile(prev => ({...prev, source: v}))}>
                                    <SelectTrigger className="h-8 text-[11px] font-black uppercase tracking-widest border-none p-0 focus:ring-0 shadow-none bg-transparent">
                                        <SelectValue placeholder="کۆنتێکست" />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-2xl border-black/5">
                                        <SelectItem value="Ashley Store">کۆگای ئاشلی (Ashley Store)</SelectItem>
                                        <SelectItem value="Huana Store">کۆگای هوئانا (Huana Store)</SelectItem>
                                        <SelectItem value="Showroom">شۆڕوم (Showroom)</SelectItem>
                                    </SelectContent>
                                </Select>
                            ) : (
                                <p className="text-xl font-normal tracking-tighter uppercase text-black">{file.source}</p>
                            )}
                            {isEditing ? (
                                <Input value={editableFile.categoryName || ''} onChange={e => setEditableFile(prev => ({...prev, categoryName: e.target.value}))} className="h-6 text-[10px] bg-transparent border-none p-0 focus-visible:ring-0" />
                            ) : (
                                <p className="text-[11px] font-bold text-muted-foreground uppercase opacity-60">{file.categoryName}</p>
                            )}
                        </div>
                    </div>
                </div>

                <div className="bg-white dark:bg-zinc-900 p-8 rounded-[2.5rem] border border-black/5 shadow-sm">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">کارمەندی بەرپرس</p>
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-indigo-500/5 flex items-center justify-center text-indigo-500">
                            <User className="w-6 h-6" />
                        </div>
                        <div className="flex-1">
                            {isEditing ? (
                                <Select value={editableFile.storekeeperId || ''} onValueChange={v => setEditableFile(prev => ({...prev, storekeeperId: v}))}>
                                    <SelectTrigger className="h-8 text-[11px] font-black uppercase tracking-widest border-none p-0 focus:ring-0 shadow-none bg-transparent">
                                        <SelectValue placeholder="بەکارهێنەر" />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-2xl border-black/5">
                                        {employees?.map(emp => <SelectItem key={emp.id} value={emp.id}>{emp.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            ) : (
                                <p className="text-xl font-normal tracking-tighter uppercase text-black">{getEmployeeName(file.storekeeperId)}</p>
                            )}
                            <p className="text-[11px] font-bold text-muted-foreground uppercase opacity-60">کۆگادار</p>
                        </div>
                    </div>
                </div>

                <div className="bg-white dark:bg-zinc-900 p-8 rounded-[2.5rem] border border-black/5 shadow-sm">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">بەرواری تۆمارکردن</p>
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-emerald-500/5 flex items-center justify-center text-emerald-500">
                            <Clock className="w-6 h-6" />
                        </div>
                        <div className="flex-1">
                            {isEditing ? (
                                <Input type="date" value={editableFile.date ? format(parseISO(editableFile.date), 'yyyy-MM-dd') : ''} onChange={e => setEditableFile(prev => ({...prev, date: e.target.value}))} className="h-8 text-[11px] bg-transparent border-none p-0 focus-visible:ring-0" />
                            ) : (
                                <p className="text-xl font-normal tracking-tighter uppercase text-black">{file.date ? format(parseISO(file.date), 'MMM d, yyyy') : 'بێ بەروار'}</p>
                            )}
                            <p className="text-[11px] font-bold text-muted-foreground uppercase opacity-60">مۆری کاتی ئەرشیف</p>
                        </div>
                    </div>
                </div>

                <div className="bg-white dark:bg-zinc-900 p-8 rounded-[2.5rem] border border-black/5 shadow-sm">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">پۆلێنکردنی لاوەکی</p>
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-primary flex items-center justify-center text-white shadow-lg shadow-primary/20">
                            <FilePlus2 className="w-6 h-6" />
                        </div>
                        <div className="flex-1">
                            {isEditing ? (
                                 <Select value={editableFile.classification || ''} onValueChange={v => setEditableFile(prev => ({...prev, classification: v}))}>
                                    <SelectTrigger className="h-8 text-[11px] font-black uppercase tracking-widest border-none p-0 focus:ring-0 shadow-none bg-transparent">
                                        <SelectValue placeholder="پۆلێن دیاری بکە" />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-2xl border-black/5">
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
                            ) : (
                                <p className="text-xl font-black tracking-tighter uppercase">{file.classification || 'Other'}</p>
                            )}
                            <p className="text-[11px] font-bold text-muted-foreground uppercase opacity-60">فۆڵدەری دانان</p>
                        </div>
                    </div>
                </div>
            </div>
          </section>
        )}

        {/* INVENTORY INSIGHTS DASHBOARD */}
        {!isFocusMode && (
          <section className="animate-in fade-in slide-in-from-bottom-4 duration-700">
             <InventoryDashboard items={fileItems} />
          </section>
        )}

        {/* DATA ENTRY SPREADSHEET (BELOW) */}
        <section className="bg-white dark:bg-zinc-900 border border-slate-200/60 shadow-xl shadow-black/[0.02] overflow-hidden animate-in fade-in slide-in-from-bottom-8 duration-1000 mt-8 rounded-xl">
            <div className="p-4 border-b border-slate-200/60 flex flex-col md:flex-row items-center justify-between gap-4 bg-slate-50/50">
                {!isFocusMode && (
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-emerald-500/10 rounded-lg">
                        <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
                    </div>
                    <div>
                        <h3 className="text-sm font-bold text-slate-800">{t('items_count', { count: sortedItems.length })}</h3>
                        <p className="text-[10px] font-medium text-slate-500 uppercase tracking-widest">پەڕەی زانیارییەکانی کۆگا</p>
                    </div>
                </div>
                )}
                
                <div className={cn("flex items-center gap-3 w-full", isFocusMode ? "justify-between" : "md:w-auto")}>
                    {isFocusMode && (
                        <div className="flex items-center gap-2 bg-white rounded-lg p-1 mr-2 border border-slate-200 shadow-sm flex-1">
                             <div className="px-3 py-1 bg-slate-50 rounded-md border border-slate-100 flex items-center gap-2">
                                <Filter className="w-3 h-3 text-emerald-500" />
                                <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Location Filter:</span>
                             </div>
                             
                             <Select value={filterLocationGroup} onValueChange={setFilterLocationGroup}>
                                <SelectTrigger className="h-7 text-[10px] font-bold uppercase tracking-widest border-none bg-transparent w-full shadow-none focus:ring-0">
                                    <SelectValue placeholder="هەموو شوێنەکان" />
                                </SelectTrigger>
                                <SelectContent className="rounded-xl border-black/5">
                                    <SelectItem value="All" className="text-[10px] font-bold uppercase">هەموو شوێنەکان</SelectItem>
                                    {availableGroups.map(g => (
                                        <SelectItem key={g} value={g} className="text-[10px] font-bold uppercase">{g}</SelectItem>
                                    ))}
                                </SelectContent>
                             </Select>
                        </div>
                    )}
                    <div className="relative flex-1 md:min-w-[300px]">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                        <Input 
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="فلتەرکردنی ڕیزەکان..."
                            className="h-8 pl-9 rounded-md border-slate-200/60 bg-white text-xs placeholder:text-slate-400 focus-visible:ring-emerald-500/20 w-full"
                        />
                    </div>
                    {isEditing && (
                        <Button variant="outline" onClick={() => {
                            const model = prompt("Enter new model name:");
                            if(model) {
                                setEditableItems(prev => [{
                                    id: `new_${Date.now()}`,
                                    fileId,
                                    model,
                                    quantity: 0,
                                    notes: '',
                                    storageStatus: '',
                                    modelCondition: '',
                                    locationIds: [],
                                    updateStatus: 'NEW'
                                }, ...prev]);
                            }
                        }} className="h-8 px-4 rounded-md text-xs font-medium border-slate-200/60 hover:text-emerald-600 hover:border-emerald-200">
                            + زیادکردنی ڕیز
                        </Button>
                    )}
                </div>
            </div>

            <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">
                <table className="w-full border-collapse text-left text-sm whitespace-nowrap">
                    <thead>
                        <tr className="bg-slate-50 border-b border-slate-200/60 select-none">
                            <th className="w-10 border-r border-slate-200/60 bg-slate-100/50"></th>
                            <th onClick={() => requestSort('model')} className="cursor-pointer font-medium text-slate-600 px-3 py-2 border-r border-slate-200/60 hover:bg-slate-100 transition-colors w-[200px]">
                                <div className="flex items-center justify-between text-[11px] uppercase tracking-wider">{t('model')} {getSortIcon('model')}</div>
                            </th>
                            <th onClick={() => requestSort('quantity')} className="cursor-pointer font-medium text-slate-600 px-3 py-2 border-r border-slate-200/60 hover:bg-slate-100 transition-colors w-[100px]">
                                <div className="flex items-center justify-between text-[11px] uppercase tracking-wider">بڕی سەرەکی {getSortIcon('quantity')}</div>
                            </th>
                            <th onClick={() => requestSort('storageStatus')} className="cursor-pointer font-medium text-slate-600 px-3 py-2 border-r border-slate-200/60 hover:bg-slate-100 transition-colors w-[150px]">
                                <div className="flex items-center justify-between text-[11px] uppercase tracking-wider">{t('storage_status')} {getSortIcon('storageStatus')}</div>
                            </th>
                            <th className="font-medium text-slate-600 px-3 py-2 border-r border-slate-200/60 w-[100px]">
                                <div className="flex items-center justify-between text-[11px] uppercase tracking-wider">بڕی نوێ</div>
                            </th>
                            <th onClick={() => requestSort('modelCondition')} className="cursor-pointer font-medium text-slate-600 px-3 py-2 border-r border-slate-200/60 hover:bg-slate-100 transition-colors w-[150px]">
                                <div className="flex items-center justify-between text-[11px] uppercase tracking-wider">{t('condition')} {getSortIcon('modelCondition')}</div>
                            </th>
                            <th className="font-medium text-slate-600 px-3 py-2 border-r border-slate-200/60 w-[100px]">
                                <div className="flex items-center justify-between text-[11px] uppercase tracking-wider">بڕی بەپێی دۆخ</div>
                            </th>
                            <th onClick={() => requestSort('locationIds')} className="cursor-pointer font-medium text-slate-600 px-3 py-2 border-r border-slate-200/60 hover:bg-slate-100 transition-colors min-w-[200px]">
                                <div className="flex items-center justify-between text-[11px] uppercase tracking-wider">{t('location')} {getSortIcon('locationIds')}</div>
                            </th>
                            <th className="font-medium text-slate-600 px-3 py-2 border-r border-slate-200/60 min-w-[150px]">
                                <div className="flex items-center justify-between text-[11px] uppercase tracking-wider">تێبینی</div>
                            </th>
                            <th className="font-medium text-slate-600 px-3 py-2 min-w-[200px]">
                                <div className="flex items-center justify-between text-[11px] uppercase tracking-wider">تێبینی تۆمار</div>
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {paginatedItems.map((item, index) => {
                            const getStatusColor = (status?: string) => {
                                switch (status) {
                                    case 'Correct': return 'bg-emerald-50 text-emerald-600 border-emerald-200 shadow-sm';
                                    case 'Less': return 'bg-rose-50 text-rose-600 border-rose-200 shadow-sm';
                                    case 'More': return 'bg-blue-50 text-blue-600 border-blue-200 shadow-sm';
                                    case 'Qty Changed': return 'bg-purple-50 text-purple-600 border-purple-200 shadow-sm';
                                    default: return 'bg-slate-50 text-slate-400 border-slate-200 shadow-sm';
                                }
                            };

                            const getConditionColor = (cond?: string) => {
                                switch (cond) {
                                    case 'Packaged': return 'bg-emerald-50 text-emerald-600 border-emerald-200 shadow-sm';
                                    case 'Wrapped': return 'bg-amber-50 text-amber-600 border-amber-200 shadow-sm';
                                    case 'Damaged': return 'bg-rose-50 text-rose-600 border-rose-200 shadow-sm';
                                    case 'Need Wrapped': return 'bg-purple-50 text-purple-600 border-purple-200 shadow-sm';
                                    default: return 'bg-slate-50 text-slate-400 border-slate-200 shadow-sm';
                                }
                            };

                            const isNewQtyLocked = item.storageStatus === 'Correct' || item.storageStatus === 'Qty Changed';
                            const isCondQtyLocked = item.modelCondition === 'Packaged' || !item.modelCondition;
                            const locationsSelected = item.locationIds || ((item as any).locationId ? [(item as any).locationId] : []);
                            
                            const rowNum = (currentPage - 1) * itemsPerPage + index + 1;

                            return (
                                <tr key={item.id} className={cn("group border-b border-slate-200/60 hover:bg-slate-50/50 transition-none", getRowClass(item))}>
                                    <td className="w-10 border-r border-slate-200/60 bg-slate-50/80 text-center text-xs font-medium text-slate-400 select-none">
                                        {rowNum}
                                    </td>
                                    <td className="border-r border-slate-200/60 p-0 relative bg-slate-50/30">
                                        <div className="px-3 py-1.5 flex items-center gap-2 h-full min-h-[36px]">
                                            {isEditing && item.updateStatus !== 'NEW' && <Lock className="w-3 h-3 text-slate-400 flex-shrink-0" />}
                                            {isEditing && item.updateStatus === 'NEW' ? (
                                                <Input 
                                                    value={item.model} 
                                                    onChange={e => handleItemChange(item.id, 'model', e.target.value)}
                                                    className="h-full min-h-[36px] w-full border-none rounded-none bg-transparent px-0 py-0 text-xs font-medium text-slate-900 focus-visible:ring-1 focus-visible:ring-emerald-500"
                                                />
                                            ) : (
                                                <span className="text-xs font-medium text-slate-900 truncate">{item.model}</span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="border-r border-slate-200/60 p-0 bg-slate-50/30">
                                        <div className="px-3 py-1.5 flex items-center gap-2 h-full min-h-[36px]">
                                            {isEditing && item.updateStatus !== 'NEW' && <Lock className="w-3 h-3 text-slate-400 flex-shrink-0" />}
                                            {isEditing && item.updateStatus === 'NEW' ? (
                                                <Input 
                                                    type="number"
                                                    value={item.quantity} 
                                                    onChange={e => handleItemChange(item.id, 'quantity', e.target.valueAsNumber)}
                                                    className="h-full min-h-[36px] w-full border-none rounded-none bg-transparent px-0 py-0 text-xs font-medium text-slate-700 focus-visible:ring-1 focus-visible:ring-emerald-500"
                                                />
                                            ) : (
                                                <span className="text-xs font-medium text-slate-700">{item.quantity}</span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="border-r border-slate-200/60 p-0">
                                        {isEditing ? (
                                            <Select value={item.storageStatus || ''} onValueChange={v => {
                                                const status = v === 'none' ? '' : v as any;
                                                const updates: Partial<Item> = { storageStatus: status };
                                                if (status === 'Correct') updates.newQty = item.quantity;
                                                handleItemChange(item.id, 'storageStatus', status);
                                                if (updates.newQty !== undefined) handleItemChange(item.id, 'newQty', updates.newQty);
                                            }}>
                                                <SelectTrigger className={cn("h-full min-h-[36px] w-full border-none rounded-none px-3 py-1.5 text-[11px] font-bold uppercase tracking-widest focus:ring-1 focus:ring-emerald-500 focus:bg-emerald-50/30 shadow-none", getStatusColor(item.storageStatus))}>
                                                    <SelectValue placeholder="Status" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="none">---</SelectItem>
                                                    <SelectItem value="Correct">دروستە (Correct)</SelectItem>
                                                    <SelectItem value="Less">کەمتر (Less)</SelectItem>
                                                    <SelectItem value="More">زیاتر (More)</SelectItem>
                                                    <SelectItem value="Qty Changed">بڕ گۆڕدرا (Qty Changed)</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        ) : (
                                            <div className="px-3 py-1.5 flex items-center h-full">
                                                <div className={cn("inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-widest border", getStatusColor(item.storageStatus))}>
                                                    {item.storageStatus || 'PENDING'}
                                                </div>
                                            </div>
                                        )}
                                    </td>
                                    <td className="border-r border-slate-200/60 p-0 bg-emerald-50/10">
                                        {isEditing ? (
                                            <Input 
                                                type="number" 
                                                disabled={isNewQtyLocked}
                                                value={item.newQty ?? ''} 
                                                onChange={e => handleItemChange(item.id, 'newQty', e.target.valueAsNumber)} 
                                                className={cn(
                                                    "h-full min-h-[36px] w-full border-none rounded-none px-3 py-1.5 text-xs font-bold focus-visible:ring-1 focus-visible:ring-emerald-500 focus-visible:bg-emerald-50/30",
                                                    isNewQtyLocked ? "bg-slate-100/50 text-slate-400 cursor-not-allowed" : "bg-transparent text-emerald-700"
                                                )} 
                                            />
                                        ) : (
                                            <div className="px-3 py-1.5 text-xs font-bold text-emerald-700">{item.newQty ?? item.quantity}</div>
                                        )}
                                    </td>
                                    <td className="border-r border-slate-200/60 p-0">
                                        {isEditing ? (
                                            <Select value={item.modelCondition || 'Packaged'} onValueChange={v => {
                                                const cond = v === 'none' ? '' : v as any;
                                                handleItemChange(item.id, 'modelCondition', cond);
                                                if (cond === 'Packaged') handleItemChange(item.id, 'conditionQty', undefined);
                                            }}>
                                                <SelectTrigger className={cn("h-full min-h-[36px] w-full border-none rounded-none px-3 py-1.5 text-[11px] font-bold uppercase tracking-widest focus:ring-1 focus:ring-emerald-500 focus:bg-emerald-50/30 shadow-none", getConditionColor(item.modelCondition || 'Packaged'))}>
                                                    <SelectValue placeholder="Condition" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="Packaged">پێچراوی تەواو (Packaged)</SelectItem>
                                                    <SelectItem value="Wrapped">پێچراو (Wrapped)</SelectItem>
                                                    <SelectItem value="Damaged">تێکچوو (Damaged)</SelectItem>
                                                    <SelectItem value="Need Wrapped">پێویستی بە پێچانەوەیە (Need Wrapped)</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        ) : (
                                            <div className="px-3 py-1.5 flex items-center h-full">
                                                <div className={cn("inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-widest border", getConditionColor(item.modelCondition || 'Packaged'))}>
                                                    {item.modelCondition || 'Packaged'}
                                                </div>
                                            </div>
                                        )}
                                    </td>
                                    <td className="border-r border-slate-200/60 p-0">
                                        {isEditing ? (
                                            <Input 
                                                type="number" 
                                                disabled={isCondQtyLocked}
                                                value={item.conditionQty ?? ''} 
                                                onChange={e => handleItemChange(item.id, 'conditionQty', e.target.valueAsNumber)} 
                                                className={cn(
                                                    "h-full min-h-[36px] w-full border-none rounded-none px-3 py-1.5 text-xs font-medium focus-visible:ring-1 focus-visible:ring-emerald-500 focus-visible:bg-emerald-50/30",
                                                    isCondQtyLocked ? "bg-slate-100/50 text-slate-400 cursor-not-allowed" : "bg-transparent text-slate-900"
                                                )} 
                                            />
                                        ) : (
                                            <div className="px-3 py-1.5 text-xs font-medium text-slate-600">{item.conditionQty ?? '—'}</div>
                                        )}
                                    </td>
                                    <td className="border-r border-slate-200/60 p-0 relative">
                                        {isEditing ? (
                                            <AlertDialog>
                                                <AlertDialogTrigger asChild>
                                                    <Button variant="ghost" className="h-full min-h-[36px] w-full border-none rounded-none bg-transparent px-3 py-1.5 text-xs font-medium text-slate-700 justify-start hover:bg-emerald-50/30 focus-visible:ring-1 focus-visible:ring-emerald-500">
                                                        <span className="truncate">{locationsSelected.length > 0 ? `${locationsSelected.length} Selected` : 'Select...'}</span>
                                                    </Button>
                                                </AlertDialogTrigger>
                                                <AlertDialogContent className="rounded-xl border-slate-200 max-w-md p-6">
                                                    <AlertDialogHeader>
                                                        <AlertDialogTitle className="text-lg">دیاریکردنی شوێن</AlertDialogTitle>
                                                        <AlertDialogDescription className="text-xs">بەڕێوەبردنی ناوچەکان بۆ {item.model}</AlertDialogDescription>
                                                    </AlertDialogHeader>
                                                    <div className="mt-4">
                                                        <div className="relative mb-4">
                                                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                                                            <Input 
                                                                placeholder="Search zones..."
                                                                value={locationSearchModal}
                                                                onChange={e => setLocationSearchModal(e.target.value)}
                                                                className="h-8 pl-9 rounded-md border-slate-200 text-xs"
                                                            />
                                                        </div>
                                                        <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 scrollbar-thin">
                                                            {locations && Array.from(new Set(locations.filter(l => l.warehouseType === defaultWarehouseType).map(l => {
                                                            const parts = l.name.split('-');
                                                            if (parts.length === 2) return `Level ${parts[0]}`;
                                                            if (parts.length > 2) return `Level ${parts[0]} - Area ${parts[1]}`;
                                                            return 'Other';
                                                        }))).map(groupName => {
                                                            const groupLocations = locations.filter(l => {
                                                                const parts = l.name.split('-');
                                                                const g = parts.length === 2 ? `Level ${parts[0]}` : (parts.length > 2 ? `Level ${parts[0]} - Area ${parts[1]}` : 'Other');
                                                                return l.warehouseType === defaultWarehouseType && g === groupName && (!locationSearchModal || l.name.toLowerCase().includes(locationSearchModal.toLowerCase()));
                                                            });
                                                            
                                                            if (groupLocations.length === 0) return null;
                                                            
                                                            return (
                                                                <div key={groupName} className="space-y-2">
                                                                    <h4 className="text-xs font-bold text-slate-500 sticky top-0 bg-white py-1 z-10">{groupName}</h4>
                                                                    <div className="grid grid-cols-1 gap-1">
                                                                        {groupLocations.map(loc => (
                                                                            <div key={loc.id} className={cn("flex items-center gap-3 p-2 rounded-md border cursor-pointer hover:bg-slate-50", locationsSelected.includes(loc.id) ? "bg-emerald-50 border-emerald-200" : "border-slate-100")} onClick={() => {
                                                                                const current = [...locationsSelected];
                                                                                const index = current.indexOf(loc.id);
                                                                                if (index > -1) current.splice(index, 1);
                                                                                else current.push(loc.id);
                                                                                handleItemChange(item.id, 'locationIds', current);
                                                                            }}>
                                                                                <div className={cn("w-4 h-4 rounded-sm border flex items-center justify-center", locationsSelected.includes(loc.id) ? "bg-emerald-500 border-emerald-500" : "border-slate-300")}>
                                                                                    {locationsSelected.includes(loc.id) && <X className="w-3 h-3 text-white" />}
                                                                                </div>
                                                                                <span className="text-xs font-medium text-slate-700">{loc.name}</span>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                        </div>
                                                    </div>
                                                    <AlertDialogFooter className="mt-6">
                                                        <AlertDialogAction className="rounded-md">تەواو</AlertDialogAction>
                                                    </AlertDialogFooter>
                                                </AlertDialogContent>
                                            </AlertDialog>
                                        ) : (
                                            <div className="px-3 py-1.5 flex flex-wrap gap-1 items-center h-full">
                                                {locationsSelected.length > 0 ? locationsSelected.map(locId => (
                                                    <span key={locId} className="px-1.5 py-0.5 bg-slate-100/80 text-slate-600 rounded text-[10px] font-bold border border-slate-200/80 shadow-sm flex items-center gap-1">
                                                        <MapPin className="w-2.5 h-2.5 opacity-60" />
                                                        {getLocationName(locId)}
                                                    </span>
                                                )) : <span className="text-[10px] text-slate-400 italic">هیچ</span>}
                                            </div>
                                        )}
                                    </td>
                                    <td className="border-r border-slate-200/60 p-0">
                                        <div className="px-3 py-1.5 text-xs font-medium text-slate-500 truncate max-w-[150px] flex items-center gap-2" title={item.notes}>
                                            <Lock className="w-3 h-3 text-slate-300 flex-shrink-0" />
                                            {item.notes || <span className="opacity-30">—</span>}
                                        </div>
                                    </td>
                                    <td className="p-0">
                                        {isEditing ? (
                                            <Input 
                                                value={item.entryNote ?? ''} 
                                                onChange={e => handleItemChange(item.id, 'entryNote', e.target.value)} 
                                                placeholder="..."
                                                className="h-full min-h-[36px] w-full border-none rounded-none bg-transparent px-3 py-1.5 text-xs font-medium text-slate-700 focus-visible:ring-1 focus-visible:ring-emerald-500 focus-visible:bg-emerald-50/30"
                                            />
                                        ) : (
                                            <div className="px-3 py-1.5 text-xs text-slate-500 truncate max-w-[200px]" title={item.entryNote}>
                                                {item.entryNote || <span className="opacity-30">—</span>}
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </section>
            
            <div className="mt-12 flex flex-col md:flex-row items-center justify-between gap-8 pt-10 border-t border-slate-50">
                <div className="flex items-center gap-4 text-[10px] font-medium uppercase tracking-[0.2em] text-slate-300">
                    <div className="p-3 bg-slate-50 rounded-2xl shadow-inner"><ShieldCheck className="w-5 h-5" /></div>
                    <div>
                        <p className="text-slate-900 opacity-80">Encryption: AES-256 Protocol Active</p>
                        <p className="opacity-40">System Integrity: Nominal</p>
                    </div>
                </div>
                <PaginationControls 
                    currentPage={currentPage}
                    totalPages={totalPages}
                    onPageChange={setCurrentPage}
                />
            </div>
        </main>
    </div>
  );
}

const Table2 = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M9 3H5a2 2 0 0 0-2 2v4a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2z" /><path d="M19 3h-4a2 2 0 0 0-2 2v4a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2z" /><path d="M9 13H5a2 2 0 0 0-2 2v4a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2v-4a2 2 0 0 0-2-2z" /><path d="M19 13h-4a2 2 0 0 0-2 2v4a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2v-4a2 2 0 0 0-2-2z" /></svg>;
const Lock = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><rect width="18" height="11" x="3" y="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>;
const Box = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" /><path d="m3.3 7 8.7 5 8.7-5" /><path d="M12 22V12" /></svg>;
const ShieldCheck = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" /><path d="m9 12 2 2 4-4" /></svg>;