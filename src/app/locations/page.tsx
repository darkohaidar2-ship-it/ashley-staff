
'use client';

import { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, Plus, Trash2, Warehouse, MapPin, Loader2, Wand2, Map, Search, Calendar, PenTool, PlusCircle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format, parseISO } from 'date-fns';
import { useAppContext } from '@/context/app-provider';
import type { Item, StorageLocation, ExcelFile } from '@/lib/types';
import { useTranslation } from '@/hooks/use-translation';
import { cn, WAREHOUSE_COLORS } from '@/lib/utils';

type SearchResult = Item & {
    locationName: string;
    fileName: string;
    excelFileDate: string;
    warehouseType: string | null;
};

type SectionBuilder = { id: string; name: string; zoneType: 'Letters' | 'Numbers'; zoneCount: number };
type FloorBuilder = { id: string; name: string; sections: SectionBuilder[] };

export default function LocationsPage() {
  const { t } = useTranslation();
  const { locations, setLocations, items: allItems, excelFiles } = useAppContext();
  const { toast } = useToast();

  const [isLoading, setIsLoading] = useState(true);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const [isGenerating, setIsGenerating] = useState(false);
  const [open, setOpen] = useState(false);
  // Universal Builder state
  const [builderName, setBuilderName] = useState('');
  const [builderFloors, setBuilderFloors] = useState<FloorBuilder[]>([
    { id: crypto.randomUUID(), name: '1', sections: [{ id: crypto.randomUUID(), name: 'S1', zoneType: 'Letters', zoneCount: 4 }] }
  ]);
  
  // Edit state
  const [editingLocation, setEditingLocation] = useState<StorageLocation | null>(null);
  const [editLocName, setEditLocName] = useState('');
  
  // Filter states
  const [filterWarehouse, setFilterWarehouse] = useState('All');

  useEffect(() => {
    if (locations && allItems && excelFiles) {
        setIsLoading(false);
    }
  },[locations, allItems, excelFiles]);

  const getLocationInfo = (locationId?: string) => {
    if (!locationId) return { name: 'N/A', warehouseType: null };
    const location = locations?.find(loc => loc.id === locationId);
    return {
        name: location?.name || t('n_a'),
        warehouseType: location?.warehouseType || null
    };
  }
  
  const getFileInfo = (fileId: string) => {
    return excelFiles?.find(file => file.id === fileId);
  }

  const handleSearch = () => {
    if (!searchQuery.trim()) {
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
          fileName: fileInfo?.storageName || t('unknown_file'),
          excelFileDate: fileInfo?.date || new Date().toISOString(),
          warehouseType: locationInfo.warehouseType,
        };
      });

    setSearchResults(results);
    setIsSearching(false);
    if(results.length === 0) {
        toast({
            title: t('no_results'),
            description: t('no_results_desc', {query: searchQuery})
        })
    }
  };


  const resetForm = () => {
    setBuilderName('');
    setBuilderFloors([
      { id: crypto.randomUUID(), name: '1', sections: [{ id: crypto.randomUUID(), name: 'S1', zoneType: 'Letters', zoneCount: 4 }] }
    ]);
    setOpen(false);
  };
  
  const addFloor = () => setBuilderFloors([...builderFloors, { id: crypto.randomUUID(), name: '', sections: [{ id: crypto.randomUUID(), name: 'S1', zoneType: 'Letters', zoneCount: 4 }] }]);
  const removeFloor = (id: string) => setBuilderFloors(builderFloors.filter(f => f.id !== id));
  const updateFloor = (id: string, name: string) => setBuilderFloors(builderFloors.map(f => f.id === id ? { ...f, name } : f));
  const addSection = (floorId: string) => setBuilderFloors(builderFloors.map(f => f.id === floorId ? { ...f, sections: [...f.sections, { id: crypto.randomUUID(), name: '', zoneType: 'Letters', zoneCount: 4 }] } : f));
  const removeSection = (floorId: string, sectionId: string) => setBuilderFloors(builderFloors.map(f => f.id === floorId ? { ...f, sections: f.sections.filter(s => s.id !== sectionId) } : f));
  const updateSection = (floorId: string, sectionId: string, field: string, value: any) => setBuilderFloors(builderFloors.map(f => f.id === floorId ? { ...f, sections: f.sections.map(s => s.id === sectionId ? { ...s, [field]: value } : s) } : f));

  const generatedCodes = useMemo(() => {
    const codes: string[] = [];
    if (!builderName.trim()) return codes;
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    
    builderFloors.forEach(floor => {
        if (!floor.name.trim()) return;
        floor.sections.forEach(section => {
            if (!section.name.trim()) return;
            const count = section.zoneCount || 1;
            for (let i = 0; i < count; i++) {
                const zoneIdentifier = section.zoneType === 'Letters' ? letters[i % 26] : (i + 1).toString();
                codes.push(`${builderName.trim()}-${floor.name.trim()}-${section.name.trim()}-${zoneIdentifier}`);
            }
        });
    });
    return codes;
  }, [builderName, builderFloors]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (generatedCodes.length === 0 || !builderName.trim()) {
      toast({
        variant: "destructive",
        title: t('incomplete_code'),
        description: t('incomplete_code_desc'),
      });
      return;
    }
    
    const existingNames = new Set(locations?.map(l => l.name) || []);
    const duplicates = generatedCodes.filter(code => existingNames.has(code));
    
    if (duplicates.length > 0) {
        toast({ variant: "destructive", title: t('duplicate_code'), description: `Some codes already exist: ${duplicates.join(', ')}` });
        return;
    }

    const newLocs = generatedCodes.map(code => ({
        id: crypto.randomUUID(),
        name: code,
        warehouseType: builderName.trim()
    }));

    setLocations([...(locations || []), ...newLocs]);
    
    toast({
      title: t('success'),
      description: `Generated ${newLocs.length} new zones successfully!`,
    });
    resetForm();
  };
  
  const handleGenerateAll = async () => {
    setIsGenerating(true);
    setLocations(prevLocations => {
      const existingNames = new Set(prevLocations.map(l => l.name));
      let newLocations: StorageLocation[] = [];
  
      // Hawana Simplified Structure
      const hawanaSubs = ['1', '2', '3', 'C'];
      const hawanaFloors = ['1', '2'];
      const hawanaSides = ['R', 'L'];
      
      hawanaSubs.forEach(sub => {
          hawanaFloors.forEach(floor => {
              hawanaSides.forEach(side => {
                  for (let s = 1; s <= 4; s++) {
                      const code = `H${sub}-${floor}${side}-${s}`;
                      if (!existingNames.has(code)) newLocations.push({ id: crypto.randomUUID(), name: code, warehouseType: 'Huana' });
                  }
              });
          });
      });

      // Ashley Simplified Structure (Floor 3)
      for (let c = 1; c <= 6; c++) {
          for (let s = 1; s <= 4; s++) {
              const code = `A3-C${c}-${s}`;
              if (!existingNames.has(code)) newLocations.push({ id: crypto.randomUUID(), name: code, warehouseType: 'Ashley' });
          }
      }
      
      // Ashley Simplified Structure (Floor 3 - Office Area)
      const officeSides = ['R', 'M', 'L'];
      officeSides.forEach(side => {
          for (let s = 1; s <= 4; s++) {
              const code = `A3-O${side}${s}`;
              if (!existingNames.has(code)) newLocations.push({ id: crypto.randomUUID(), name: code, warehouseType: 'Ashley' });
          }
      });

      // Ashley Simplified Structure (Floor 4)
      for (let s = 1; s <= 16; s++) {
          const code = `A4-${s}`;
          if (!existingNames.has(code)) newLocations.push({ id: crypto.randomUUID(), name: code, warehouseType: 'Ashley' });
      }
  
      if (newLocations.length === 0) {
        toast({ title: t('no_new_locations'), description: t('all_locations_exist_desc') });
        return prevLocations;
      }
  
      toast({ title: t('success'), description: t('locations_added_success', {count: newLocations.length}) });
      return [...prevLocations, ...newLocations];
    });
    setIsGenerating(false);
  };


  const handleDelete = (locationId: string) => {
    setLocations(locations.filter(loc => loc.id !== locationId));
    toast({
      title: t('location_deleted'),
      description: t('location_deleted_desc'),
    });
  };

  const handleDeleteAll = async () => {
    if (!locations || locations.length === 0) return;
    setLocations([]);
    toast({
        title: t('all_locations_deleted'),
        description: t('all_locations_deleted_desc'),
    });
  };

  const uniqueWarehouses = useMemo(() => {
     if (!locations) return [];
     const types = new Set(locations.map(l => l.warehouseType).filter(Boolean) as string[]);
     return Array.from(types).sort();
  }, [locations]);

  const pastFloors = useMemo(() => {
     if (!locations) return [];
     const floors = new Set(locations.map(l => l.name.split('-')[1]).filter(Boolean));
     return Array.from(floors).sort();
  }, [locations]);

  const pastSections = useMemo(() => {
     if (!locations) return [];
     const sections = new Set(locations.map(l => l.name.split('-')[2]).filter(Boolean));
     return Array.from(sections).sort();
  }, [locations]);

  const handleEditLocation = (e: React.FormEvent) => {
      e.preventDefault();
      if (!editingLocation || !editLocName.trim()) return;
      
      const newLocations = locations.map(l => l.id === editingLocation.id ? { ...l, name: editLocName.trim() } : l);
      setLocations(newLocations);
      setEditingLocation(null);
      toast({ title: t('success'), description: 'Location updated successfully!' });
  };

  const groupedLocations = useMemo(() => {
    if (!locations) return {};
    
    let filtered = locations;
    if (filterWarehouse !== 'All') {
      filtered = filtered.filter(l => l.warehouseType === filterWarehouse);
    }

    const grouped: Record<string, typeof locations> = {};
    filtered.forEach(loc => {
        const type = loc.warehouseType || 'Unknown';
        if (!grouped[type]) grouped[type] = [];
        grouped[type].push(loc);
    });

    Object.keys(grouped).forEach(k => {
        grouped[k].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
    });

    return grouped;
  }, [locations, filterWarehouse]);

  const isRTL = t('dir') === 'rtl';

  return (
    <div className={cn("h-screen bg-background text-foreground flex flex-col", isRTL ? "font-kurmanji" : "font-sans")} dir={isRTL ? "rtl" : "ltr"}>
      <Dialog open={open} onOpenChange={(isOpen) => { setOpen(isOpen); if (!isOpen) resetForm(); }}>
        <header className="p-4 md:p-8 flex items-center justify-between gap-4 flex-wrap border-b">
          <div className="flex items-center gap-4">
            <Button variant="outline" size="icon" asChild>
              <Link href="/items">
                <ArrowLeft />
              </Link>
            </Button>
            <h1 className="text-2xl md:text-3xl">{t('manage_locations')}</h1>
          </div>
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <Button onClick={handleGenerateAll} variant="outline" disabled={isGenerating}>
                {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Wand2 className="mr-2 h-4 w-4"/>}
                {t('generate_all')}
            </Button>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" /> {t('add_location')}
              </Button>
            </DialogTrigger>
             <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" disabled={isGenerating || !locations || locations.length === 0}>
                  <Trash2 className="mr-2 h-4 w-4" /> {t('remove_all')}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{t('are_you_sure')}</AlertDialogTitle>
                  <AlertDialogDescription>
                    {t('confirm_delete_all_locations', {count: locations?.length || 0})}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDeleteAll}>{t('delete_all')}</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </header>

        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('add_new_location')}</DialogTitle>
            <DialogDescription>
                کۆگاکە هەڵبژێرە و وردەکارییەکان پڕ بکەرەوە بۆ دروستکردنی کۆدی شوێنی تایبەت.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 pt-4 max-h-[70vh] overflow-y-auto px-1">
             <div className="space-y-2 p-4 border rounded-md bg-muted/50">
                 <Label>ناوی کۆگا / باڵەخانە</Label>
                 <Input value={builderName} onChange={(e) => setBuilderName(e.target.value)} placeholder="بۆ نموونە: کۆگای ١، باڵەخانەی سەرەکی" className="font-bold" list="past-warehouses" />
                 <datalist id="past-warehouses">
                     {uniqueWarehouses.map(w => <option key={w} value={w} />)}
                 </datalist>
             </div>

             <div className="space-y-4">
                 {builderFloors.map((floor, fIndex) => (
                     <div key={floor.id} className="p-4 border rounded-md border-blue-200/50 bg-blue-50/30 dark:bg-blue-900/10 space-y-4 relative">
                         {builderFloors.length > 1 && (
                             <Button type="button" variant="ghost" size="icon" className="absolute top-2 right-2 h-6 w-6 text-red-500 hover:text-red-700" onClick={() => removeFloor(floor.id)}>
                                 <X className="w-4 h-4" />
                             </Button>
                         )}
                         <div className="space-y-2 pr-8">
                             <Label>ناوی نهۆم / ناوچە</Label>
                             <Input value={floor.name} onChange={(e) => updateFloor(floor.id, e.target.value)} placeholder="بۆ نموونە: ١، نهۆمی ٢" list="past-floors" />
                             <datalist id="past-floors">
                                 {pastFloors.map(f => <option key={f} value={f} />)}
                             </datalist>
                         </div>
                         <div className="space-y-3 pl-4 border-l-2 border-blue-200 dark:border-blue-800">
                             {floor.sections.map((section, sIndex) => (
                                 <div key={section.id} className="grid grid-cols-12 gap-2 items-end relative bg-white/50 dark:bg-black/20 p-2 rounded">
                                     <div className="col-span-4 space-y-1">
                                         <Label className="text-xs">ناوی بەش</Label>
                                         <Input value={section.name} onChange={(e) => updateSection(floor.id, section.id, 'name', e.target.value)} placeholder="e.g. S1" className="h-8" list="past-sections" />
                                         <datalist id="past-sections">
                                             {pastSections.map(s => <option key={s} value={s} />)}
                                         </datalist>
                                     </div>
                                     <div className="col-span-3 space-y-1">
                                         <Label className="text-xs">فۆرمات</Label>
                                         <Select onValueChange={(v) => updateSection(floor.id, section.id, 'zoneType', v)} value={section.zoneType}>
                                             <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                                             <SelectContent>
                                                 <SelectItem value="Letters">A, B, C</SelectItem>
                                                 <SelectItem value="Numbers">1, 2, 3</SelectItem>
                                             </SelectContent>
                                         </Select>
                                     </div>
                                     <div className="col-span-3 space-y-1">
                                         <Label className="text-xs">ناوچەکان</Label>
                                         <Input type="number" min="1" max="50" value={section.zoneCount} onChange={(e) => updateSection(floor.id, section.id, 'zoneCount', parseInt(e.target.value) || 1)} className="h-8" />
                                     </div>
                                     <div className="col-span-2 flex justify-end">
                                         {floor.sections.length > 1 && (
                                             <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-red-500" onClick={() => removeSection(floor.id, section.id)}>
                                                 <Trash2 className="w-3 h-3" />
                                             </Button>
                                         )}
                                     </div>
                                 </div>
                             ))}
                             <Button type="button" variant="outline" size="sm" className="text-xs" onClick={() => addSection(floor.id)}>
                                 <PlusCircle className="w-3 h-3 mr-1" /> زیادکردنی بەش
                             </Button>
                         </div>
                     </div>
                 ))}
             </div>
             
             <Button type="button" variant="secondary" className="w-full border-dashed" onClick={addFloor}>
                 <PlusCircle className="w-4 h-4 mr-2" /> زیادکردنی نهۆم/ناوچەیەکی تر
             </Button>

            {generatedCodes.length > 0 && (
              <div className="space-y-2 p-3 border rounded-md bg-green-50 dark:bg-green-900/20 max-h-40 overflow-y-auto">
                <Label className="text-sm text-green-700 dark:text-green-300">پێشبینی ({generatedCodes.length} شوێن)</Label>
                <div className="grid grid-cols-2 gap-2 mt-2">
                    {generatedCodes.map(code => (
                        <p key={code} className="font-mono text-xs text-green-800 dark:text-green-200 bg-green-100/50 dark:bg-green-800/30 px-2 py-1 rounded">{code}</p>
                    ))}
                </div>
              </div>
            )}

            <DialogFooter className="pt-4 border-t mt-4 sticky bottom-0 bg-background pb-2">
              <DialogClose asChild><Button type="button" variant="secondary">{t('cancel')}</Button></DialogClose>
              <Button type="submit" disabled={generatedCodes.length === 0}>دروستکردنی {generatedCodes.length} شوێن</Button>
            </DialogFooter>
          </form>
        </DialogContent>

      <main className="flex-1 overflow-y-auto p-4 md:p-8">
          <Card className="mb-8">
            <CardHeader>
                <CardTitle>{t('search_item_by_model')}</CardTitle>
                
            </CardHeader>
            <CardContent>
                <div className="flex w-full max-w-sm items-center space-x-2">
                    <Input 
                        type="text" 
                        placeholder={t('search_by_model_placeholder')} 
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    />
                    <Button onClick={handleSearch} disabled={isSearching || isLoading}>
                        {isSearching ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
                        {t('search')}
                    </Button>
                </div>
                {searchResults.length > 0 && (
                    <div className="mt-6 overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>{t('model')}</TableHead>
                                    <TableHead>{t('file_name')}</TableHead>
                                    <TableHead>{t('quantity')}</TableHead>
                                    <TableHead>{t('location')}</TableHead>
                                    <TableHead>{t('file_date')}</TableHead>
                                    <TableHead>{t('map')}</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {searchResults.map((item) => (
                                    <TableRow key={item.id}>
                                        <TableCell>
                                          <Link href={`/archive/${item.fileId}#${item.id}`} className="hover:underline text-primary">
                                            {item.model}
                                          </Link>
                                        </TableCell>
                                        <TableCell>
                                          <Link href={`/archive/${item.fileId}`} className="hover:underline text-muted-foreground">
                                            {item.fileName}
                                          </Link>
                                        </TableCell>
                                        <TableCell>{item.quantity}</TableCell>
                                        <TableCell>{item.locationName}</TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <Calendar className="w-4 h-4 text-muted-foreground" />
                                                {format(parseISO(item.excelFileDate), 'PPP')}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            {item.locationIds?.[0] && item.warehouseType && (
                                                <Button variant="outline" size="sm" asChild>
                                                    <Link href={`/${item.warehouseType.toLowerCase()}-map#${item.locationIds?.[0]}`}>{t('view_on_map')}</Link>
                                                </Button>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                )}
            </CardContent>
          </Card>
          <Card className="mb-8">
            <CardHeader>
                <CardTitle>{t('filters')}</CardTitle>
                
            </CardHeader>
            <CardContent className="flex flex-wrap items-center gap-4">
                  <Select value={filterWarehouse} onValueChange={setFilterWarehouse}>
                    <SelectTrigger className="w-[180px]"><SelectValue placeholder={t('select_warehouse')} /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="All">{t('all_warehouses')}</SelectItem>
                        {uniqueWarehouses.map(w => (
                           <SelectItem key={w} value={w}>
                               {t('language') === 'ku' ? (w === 'Ashley' ? 'کۆگایی سەرەکی ئاشڵی' : w === 'Huana' || w === 'Hawana' ? 'کۆگایی هوانە' : w) : w}
                           </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </CardContent>
          </Card>

        {isLoading ? (
            <div className="grid md:grid-cols-2 gap-8">
              {[...Array(2)].map((_, i) => (
                <Card key={i} className="animate-pulse">
                  <CardHeader><div className="h-7 w-40 rounded bg-muted"></div></CardHeader>
                  <CardContent className="space-y-2">
                    <div className="h-10 w-full rounded bg-muted"></div>
                    <div className="h-10 w-full rounded bg-muted"></div>
                  </CardContent>
                </Card>
              ))}
            </div>
        ) : (
          <div className="space-y-8">
            {Object.entries(groupedLocations).map(([warehouseName, locs]) => (
                <Card key={warehouseName} className="mb-8 border-primary/20">
                    <CardHeader className="bg-primary/5">
                      <CardTitle className="flex items-center gap-2">
                        <Warehouse className="text-primary"/> 
                        {t('language') === 'ku' ? (warehouseName === 'Ashley' ? 'کۆگایی سەرەکی ئاشڵی' : warehouseName === 'Huana' || warehouseName === 'Hawana' ? 'کۆگایی هوانە' : warehouseName) : warehouseName}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6">
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-x-4 gap-y-2">
                          {locs.map((loc: StorageLocation) => (
                            <div key={loc.id} className={`py-2 px-3 rounded-lg bg-primary/10 border border-primary/20 flex justify-between items-center group hover:bg-primary/20 transition-colors`}>
                               <div className="font-mono flex items-center gap-2 text-sm font-bold text-primary/80">
                                  <MapPin className="w-4 h-4 text-primary/60"/>{loc.name}
                                </div>
                               <div className="flex gap-1">
                                   <Button variant="ghost" size="icon" onClick={() => { setEditingLocation(loc); setEditLocName(loc.name); }} className="text-primary hover:text-blue-500 h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                                      <PenTool className="h-4 w-4"/>
                                   </Button>
                                   <AlertDialog>
                                      <AlertDialogTrigger asChild>
                                        <Button variant="ghost" size="icon" className="text-primary hover:text-destructive h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                                          <Trash2 className="h-4 h-4"/>
                                        </Button>
                                      </AlertDialogTrigger>
                                      <AlertDialogContent>
                                        <AlertDialogHeader>
                                          <AlertDialogTitle>{t('delete_location', {locationName: loc.name})}</AlertDialogTitle>
                                          <AlertDialogDescription>{t('cannot_be_undone')}</AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                          <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
                                          <AlertDialogAction onClick={() => handleDelete(loc.id)}>{t('delete')}</AlertDialogAction>
                                        </AlertDialogFooter>
                                      </AlertDialogContent>
                                    </AlertDialog>
                                </div>
                            </div>
                          ))}
                        </div>
                    </CardContent>
                </Card>
            ))}

            {/* Edit Location Dialog */}
            <Dialog open={!!editingLocation} onOpenChange={(o) => !o && setEditingLocation(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>دەستکاریکردنی کۆدی شوێن</DialogTitle>
                        <DialogDescription>تەواوی کۆدەکە بۆ ئەم ناوچەیە نوێ بکەرەوە.</DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleEditLocation} className="space-y-4 pt-4">
                        <div className="space-y-2">
                            <Label>کۆدی شوێن</Label>
                            <Input value={editLocName} onChange={(e) => setEditLocName(e.target.value)} placeholder="e.g. A-1-S1-A" />
                        </div>
                        <DialogFooter>
                            <DialogClose asChild><Button type="button" variant="secondary">{t('cancel')}</Button></DialogClose>
                            <Button type="submit" disabled={!editLocName.trim()}>پاشەکەوتکردنی گۆڕانکارییەکان</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {Object.keys(groupedLocations).length === 0 && !isLoading && (
                 <div className="text-center py-16 border-2 border-dashed rounded-lg">
                    <MapPin className="mx-auto h-12 w-12 text-muted-foreground" />
                    <h3 className="mt-4 text-lg">{t('no_locations_match_filters')}</h3>
                </div>
            )}
            
            {locations && locations.length === 0 && !isLoading && (
              <Dialog open={open} onOpenChange={setOpen}>
                  <div className="text-center py-16 border-2 border-dashed rounded-lg">
                    <Warehouse className="mx-auto h-12 w-12 text-muted-foreground" />
                    <h3 className="mt-4 text-lg">{t('no_locations_found')}</h3>
                    
                    <div className="mt-6 flex justify-center gap-4">
                      <Button onClick={handleGenerateAll} variant="outline" disabled={isGenerating}>
                        {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Wand2 className="mr-2 h-4 w-4"/>}
                        {t('generate_all')}
                      </Button>
                      <DialogTrigger asChild>
                        <Button>
                          <Plus className="mr-2 h-4 w-4" /> {t('add_manually')}
                        </Button>
                      </DialogTrigger>
                    </div>
                  </div>
                </Dialog>
            )}
          </div>
        )}
        </main>
      </Dialog>
    </div>
  );
}
