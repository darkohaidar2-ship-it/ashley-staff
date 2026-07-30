
'use client';

import { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, Plus, Trash2, Edit, Save, X, Settings, Receipt, Printer, FileDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { format, parseISO } from 'date-fns';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { useAppContext } from '@/context/app-provider';
import type { SoldItemsList, SoldItemsListItem, ItemCategory } from '@/lib/types';
import { useTranslation } from '@/hooks/use-translation';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogClose, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger, AlertDialogDescription, AlertDialogFooter } from "@/components/ui/alert-dialog";
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import withAuth from '@/hooks/withAuth';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import * as XLSX from 'xlsx';

const initialNewItem: Omit<SoldItemsListItem, 'id'> = {
  name: '',
  quantity: 1,
  notes: '',
  categoryId: '',
};

function CategoryManagerDialog({ open, onOpenChange }: { open: boolean, onOpenChange: (open: boolean) => void }) {
  const { t } = useTranslation();
  const { itemCategories, setItemCategories } = useAppContext();
  const [newCategoryName, setNewCategoryName] = useState('');

  const handleAddCategory = () => {
    if (newCategoryName.trim()) {
      setItemCategories(prev => [...prev, { id: crypto.randomUUID(), name: newCategoryName.trim() }]);
      setNewCategoryName('');
    }
  };

  const handleDeleteCategory = (id: string) => {
    setItemCategories(prev => prev.filter(cat => cat.id !== id));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('manage_categories')}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="flex gap-2">
            <Input value={newCategoryName} onChange={e => setNewCategoryName(e.target.value)} placeholder={t('new_category_name')} />
            <Button onClick={handleAddCategory}>{t('add')}</Button>
          </div>
          <div className="max-h-60 overflow-y-auto space-y-2 border p-2 rounded-md">
            {itemCategories.length > 0 ? itemCategories.map(cat => (
              <div key={cat.id} className="flex justify-between items-center group p-2 hover:bg-muted rounded-md">
                <span>{cat.name}</span>
                <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100" onClick={() => handleDeleteCategory(cat.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            )) : <p className="text-sm text-center text-muted-foreground p-4">{t('no_categories_yet')}</p>}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

const SoldItemsCheckPage = () => {
    const { t } = useTranslation();
    const { soldItemsLists, setSoldItemsLists, itemCategories, setItemCategories, isLoading } = useAppContext();
    const { toast } = useToast();

    const [selectedList, setSelectedList] = useState<SoldItemsList | null>(null);
    const [isListDialogOpen, setIsListDialogOpen] = useState(false);
    const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false);
    const [editingList, setEditingList] = useState<SoldItemsList | null>(null);
    const [editingItem, setEditingItem] = useState<SoldItemsListItem | null>(null);
    
    const [newListName, setNewListName] = useState('');
    const [newListDate, setNewListDate] = useState<Date | undefined>(new Date());
    
    const [newItem, setNewItem] = useState(initialNewItem);

    const sortedLists = useMemo(() => {
        if (!soldItemsLists) return [];
        return [...soldItemsLists].sort((a, b) => parseISO(b.date).getTime() - parseISO(a.date).getTime());
    }, [soldItemsLists]);
    
    useEffect(() => {
        if (selectedList) {
            const currentListState = soldItemsLists.find(l => l.id === selectedList.id);
            if (currentListState) {
                setSelectedList(currentListState);
            } else {
                setSelectedList(sortedLists[0] || null);
            }
        } else if (sortedLists.length > 0) {
            setSelectedList(sortedLists[0]);
        }
    }, [soldItemsLists, selectedList, sortedLists]);
    
    const handleSelectList = (list: SoldItemsList) => {
        setSelectedList(list);
    };

    const handleSaveList = () => {
        if (editingList) {
            setSoldItemsLists(prev => prev.map(l => l.id === editingList.id ? { ...l, name: newListName || l.name, date: newListDate?.toISOString() || l.date } : l));
            toast({ title: t('list_updated'), description: t('list_updated_desc', { listName: newListName }) });
        } else {
            const newList: SoldItemsList = {
                id: crypto.randomUUID(),
                name: newListName,
                date: newListDate?.toISOString() || new Date().toISOString(),
                items: [],
            };
            setSoldItemsLists(prev => [...prev, newList]);
            toast({ title: t('list_created'), description: t('list_created_desc', { listName: newListName }) });
        }
        setIsListDialogOpen(false);
        setNewListName('');
        setNewListDate(new Date());
        setEditingList(null);
    };

    const handleDeleteList = (listId: string) => {
        setSoldItemsLists(prev => prev.filter(l => l.id !== listId));
        if (selectedList?.id === listId) {
            setSelectedList(null);
        }
        toast({ title: t('list_deleted'), description: t('list_deleted_desc') });
    };
  
    const handleAddNewItem = () => {
        if (!selectedList || !newItem.name.trim() || !newItem.categoryId) {
          toast({ variant: 'destructive', title: t('missing_information'), description: 'Please provide an item name and select a category.' });
          return;
        };
        const itemToAdd: SoldItemsListItem = {
            id: crypto.randomUUID(),
            name: newItem.name,
            quantity: newItem.quantity,
            notes: newItem.notes,
            categoryId: newItem.categoryId,
        };
        const updatedItems = [...selectedList.items, itemToAdd];
        setSoldItemsLists(prev => prev.map(l => l.id === selectedList.id ? { ...l, items: updatedItems } : l));
        setNewItem(initialNewItem);
    };

    const handleUpdateItem = () => {
        if (!selectedList || !editingItem) return;
        const updatedItems = selectedList.items.map(item => item.id === editingItem.id ? editingItem : item);
        setSoldItemsLists(prev => prev.map(l => l.id === selectedList.id ? { ...l, items: updatedItems } : l));
        setEditingItem(null);
    };

    const handleDeleteItem = (itemId: string) => {
        if (!selectedList) return;
        const updatedItems = selectedList.items.filter(item => item.id !== itemId);
        setSoldItemsLists(prev => prev.map(l => l.id === selectedList.id ? { ...l, items: updatedItems } : l));
    };

    const handlePrint = () => {
        window.print();
    };

    const handleExportExcel = () => {
        if (!selectedList || selectedList.items.length === 0) return;
        const dataToExport = selectedList.items.map(item => ({
            [t('item_name')]: item.name,
            [t('category')]: itemCategories.find(c => c.id === item.categoryId)?.name || 'N/A',
            [t('quantity')]: item.quantity,
            [t('notes')]: item.notes || 'N/A',
        }));
        const worksheet = XLSX.utils.json_to_sheet(dataToExport);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, selectedList.name);
        XLSX.writeFile(workbook, `${selectedList.name}.xlsx`);
    };

    return (
        <div className="min-h-screen bg-background text-foreground p-4 md:p-8">
             <CategoryManagerDialog open={isCategoryDialogOpen} onOpenChange={setIsCategoryDialogOpen} />
             <Dialog open={isListDialogOpen} onOpenChange={setIsListDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editingList ? t('edit_list_name') : t('create_new_list')}</DialogTitle>
                        
                    </DialogHeader>
                    <div className="py-4 space-y-4">
                        <div>
                            <Label htmlFor="list-name">{t('list_name')}</Label>
                            <Input id="list-name" value={newListName} onChange={e => setNewListName(e.target.value)} dir="rtl" />
                        </div>
                         <div>
                            <Label>{t('date')}</Label>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button variant="outline" className="w-full justify-start text-left font-normal">
                                        {newListDate ? format(newListDate, 'PPP') : <span>{t('pick_a_date')}</span>}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={newListDate} onSelect={setNewListDate} initialFocus /></PopoverContent>
                            </Popover>
                        </div>
                    </div>
                    <DialogFooter><DialogClose asChild><Button variant="outline">{t('cancel')}</Button></DialogClose><Button onClick={handleSaveList}>{t('save')}</Button></DialogFooter>
                </DialogContent>
            </Dialog>

            <header className="flex items-center justify-between gap-4 mb-8">
                <div className="flex items-center gap-4">
                    <Button variant="outline" size="icon" asChild>
                        <Link href="/items"><ArrowLeft /></Link>
                    </Button>
                    <h1 className="text-2xl md:text-3xl font-bold">{t('waiting_lists')}</h1>
                </div>
                 <div className="flex items-center gap-2">
                    <Button variant="outline" onClick={() => setIsCategoryDialogOpen(true)}>
                        <Settings className="mr-2 h-4 w-4" /> {t('manage_categories')}
                    </Button>
                    <Button onClick={() => { setEditingList(null); setNewListName(''); setNewListDate(new Date()); setIsListDialogOpen(true); }}>
                        <Plus className="mr-2 h-4 w-4" /> {t('create_new_list')}
                    </Button>
                </div>
            </header>
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 h-full">
                <div className="lg:col-span-1">
                <Card>
                    <CardHeader><CardTitle>{t('all_lists')}</CardTitle></CardHeader>
                    <CardContent className="max-h-[60vh] overflow-y-auto">
                    {isLoading ? <div className="text-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div></div> : (
                        <div className="space-y-2">
                        {sortedLists.map(list => (
                            <div key={list.id} onClick={() => handleSelectList(list)} className={`p-3 rounded-lg cursor-pointer border ${selectedList?.id === list.id ? 'bg-primary/10 border-primary' : 'hover:bg-muted'}`}>
                            <div className="flex justify-between items-center">
                                <p className="font-semibold">{list.name}</p>
                                <div className="flex items-center">
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); setEditingList(list); setNewListName(list.name); setNewListDate(parseISO(list.date)); setIsListDialogOpen(true); }}><Edit className="h-4 w-4" /></Button>
                                <AlertDialog>
                                    <AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => e.stopPropagation()}><Trash2 className="h-4 w-4 text-destructive" /></Button></AlertDialogTrigger>
                                    <AlertDialogContent>
                                    <AlertDialogHeader><AlertDialogTitle>{t('are_you_sure')}</AlertDialogTitle><AlertDialogDescription>{t('confirm_delete_list', {listName: list.name})}</AlertDialogDescription></AlertDialogHeader>
                                    <AlertDialogFooter><AlertDialogCancel>{t('cancel')}</AlertDialogCancel><AlertDialogAction onClick={() => handleDeleteList(list.id)}>{t('delete')}</AlertDialogAction></AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                                </div>
                            </div>
                            <p className="text-sm text-muted-foreground">{format(parseISO(list.date), 'PPP')}</p>
                            </div>
                        ))}
                        {sortedLists.length === 0 && <p className="text-center text-muted-foreground py-8">{t('no_lists_created')}</p>}
                        </div>
                    )}
                    </CardContent>
                </Card>
                </div>

                <div className="lg:col-span-2">
                    <Card>
                        <CardHeader>
                            {selectedList ? (
                            <div className="flex justify-between items-center">
                                <div><CardTitle>{selectedList.name}</CardTitle><CardDescription>{t('items_in_list_count', {count: selectedList.items.length})}</CardDescription></div>
                                <div className="flex items-center gap-2 print:hidden">
                                  <Button variant="outline" size="icon" onClick={handlePrint} disabled={!selectedList || selectedList.items.length === 0}><Printer className="h-4 w-4"/></Button>
                                  <Button variant="outline" size="icon" onClick={handleExportExcel} disabled={!selectedList || selectedList.items.length === 0}><FileDown className="h-4 w-4"/></Button>
                                </div>
                            </div>
                            ) : <CardTitle>{t('select_a_list')}</CardTitle>}
                        </CardHeader>
                        <CardContent>
                        {selectedList ? (
                            <div className="overflow-x-auto">
                                <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead>{t('item_name')}</TableHead>
                                    <TableHead>{t('category')}</TableHead>
                                    <TableHead className="w-24">{t('quantity')}</TableHead>
                                    <TableHead>{t('notes')}</TableHead>
                                    <TableHead className="text-right w-28 print:hidden">{t('actions')}</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {selectedList.items.map(item => (
                                    editingItem?.id === item.id ? (
                                        <TableRow key={item.id}>
                                        <TableCell><Input value={editingItem.name} onChange={(e) => setEditingItem({...editingItem, name: e.target.value})} dir="rtl" /></TableCell>
                                        <TableCell>
                                            <Select value={editingItem.categoryId} onValueChange={val => setEditingItem({...editingItem, categoryId: val})}>
                                                <SelectTrigger><SelectValue /></SelectTrigger>
                                                <SelectContent>{itemCategories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                                            </Select>
                                        </TableCell>
                                        <TableCell><Input type="number" value={editingItem.quantity} onChange={(e) => setEditingItem({...editingItem, quantity: parseInt(e.target.value) || 1})} /></TableCell>
                                        <TableCell><Textarea value={editingItem.notes} onChange={(e) => setEditingItem({...editingItem, notes: e.target.value})} dir="rtl"/></TableCell>
                                        <TableCell className="text-right print:hidden">
                                            <div className="flex gap-1 justify-end">
                                                <Button size="icon" className="h-8 w-8" onClick={handleUpdateItem}><Save className="h-4 w-4"/></Button>
                                                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setEditingItem(null)}><X className="h-4 w-4"/></Button>
                                            </div>
                                        </TableCell>
                                        </TableRow>
                                    ) : (
                                    <TableRow key={item.id}>
                                        <TableCell dir="rtl">{item.name}</TableCell>
                                        <TableCell>{itemCategories.find(c => c.id === item.categoryId)?.name || 'N/A'}</TableCell>
                                        <TableCell>{item.quantity}</TableCell>
                                        <TableCell dir="rtl">{item.notes || t('na')}</TableCell>
                                        <TableCell className="text-right print:hidden">
                                            <Button variant="ghost" size="icon" onClick={() => setEditingItem(JSON.parse(JSON.stringify(item)))}><Edit className="w-4 h-4"/></Button>
                                            <Button variant="ghost" size="icon" onClick={() => handleDeleteItem(item.id)}><Trash2 className="w-4 h-4 text-destructive"/></Button>
                                        </TableCell>
                                    </TableRow>
                                    )
                                    ))}
                                </TableBody>
                                <TableFooter className="print:hidden">
                                    <TableRow>
                                        <TableCell><Input value={newItem.name} onChange={e => setNewItem({...newItem, name: e.target.value})} placeholder={t('item_name')} dir="rtl" /></TableCell>
                                        <TableCell>
                                            <Select value={newItem.categoryId} onValueChange={val => setNewItem({...newItem, categoryId: val})}>
                                                <SelectTrigger><SelectValue placeholder={t('select_categories')} /></SelectTrigger>
                                                <SelectContent>{itemCategories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                                            </Select>
                                        </TableCell>
                                        <TableCell><Input type="number" value={newItem.quantity} onChange={e => setNewItem({...newItem, quantity: parseInt(e.target.value) || 1})} /></TableCell>
                                        <TableCell><Textarea value={newItem.notes} onChange={e => setNewItem({...newItem, notes: e.target.value})} placeholder={t('notes_optional')} dir="rtl" /></TableCell>
                                        <TableCell className="text-right"><Button size="sm" onClick={handleAddNewItem}><Plus className="h-4 w-4 mr-2" />{t('add')}</Button></TableCell>
                                    </TableRow>
                                </TableFooter>
                                </Table>
                                {selectedList.items.length === 0 && <p className="text-center text-muted-foreground py-8">{t('no_items_in_this_list')}</p>}
                            </div>
                        ) : <p className="text-center text-muted-foreground py-16">{t('select_list_to_view_items')}</p>}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
};

export default withAuth(SoldItemsCheckPage);
