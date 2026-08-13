'use client';

import { useMemo, useState, useEffect } from 'react';
import Link from 'next/link';
import {
  FileText, Calendar as CalendarIcon, User, Building, Clock,
  FileDown, Printer, Globe, FolderPlus, FilePlus2, Search,
  FileSpreadsheet, ChevronRight, LayoutGrid, List, ArrowLeft,
  Folder, FolderOpen, Sparkles, TrendingUp, Archive, Filter
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { format, parseISO } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useAppContext } from '@/context/app-provider';
import type { Employee, ExcelFile } from '@/lib/types';
import { useTranslation } from '@/hooks/use-translation';
import * as XLSX from 'xlsx';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

export default function ArchivePage() {
  const { excelFiles, employees } = useAppContext();
  const [isLoading, setIsLoading] = useState(true);
  const { t, language } = useTranslation();
  const { toast } = useToast();

  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [isFolderDialogOpen, setIsFolderDialogOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  useEffect(() => {
    if (excelFiles && employees) setIsLoading(false);
  }, [excelFiles, employees]);

  const getEmployeeName = (id: string) =>
    employees?.find(e => e.id === id)?.name || t('unknown');

  const groupedFiles = useMemo(() => {
    if (!excelFiles) return {};
    const groups: Record<string, ExcelFile[]> = {};
    excelFiles.forEach(file => {
      const folder = file.classification || 'Unclassified';
      if (!groups[folder]) groups[folder] = [];
      groups[folder].push(file);
    });
    Object.keys(groups).forEach(key => {
      groups[key].sort((a, b) => {
        const dateA = a.date ? parseISO(a.date).getTime() : 0;
        const dateB = b.date ? parseISO(b.date).getTime() : 0;
        return dateB - dateA;
      });
    });
    return groups;
  }, [excelFiles]);

  const folders = Object.keys(groupedFiles).sort();

  const filteredFiles = useMemo(() => {
    const source = selectedFolder ? groupedFiles[selectedFolder] || [] : excelFiles || [];
    if (!searchQuery) return source;
    return source.filter(f => f.storageName?.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [excelFiles, groupedFiles, selectedFolder, searchQuery]);

  const handleExportAll = () => {
    if (!excelFiles || excelFiles.length === 0) { toast({ title: t('no_data_to_export') }); return; }
    const dataToExport = excelFiles.map(file => ({
      [t('file_name')]: file.storageName,
      [t('category')]: file.categoryName,
      [t('classification')]: file.classification || 'Other',
      [t('storekeeper')]: getEmployeeName(file.storekeeperId),
      [t('source')]: file.source,
      [t('date')]: file.date ? format(parseISO(file.date), 'yyyy-MM-dd') : t('n_a'),
      [t('type')]: file.type,
    }));
    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, t('excel_archive'));
    XLSX.writeFile(workbook, `Excel_Archive_Summary_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
  };

  const isRTL = language === 'ku';

  // Folder accent colors cycling
  const folderColors = [
    { dot: 'bg-blue-500', border: 'border-blue-500/20', hover: 'hover:border-blue-500/50 hover:bg-blue-500/5', text: 'text-blue-500', badge: 'bg-blue-500/10 text-blue-600' },
    { dot: 'bg-emerald-500', border: 'border-emerald-500/20', hover: 'hover:border-emerald-500/50 hover:bg-emerald-500/5', text: 'text-emerald-500', badge: 'bg-emerald-500/10 text-emerald-600' },
    { dot: 'bg-violet-500', border: 'border-violet-500/20', hover: 'hover:border-violet-500/50 hover:bg-violet-500/5', text: 'text-violet-500', badge: 'bg-violet-500/10 text-violet-600' },
    { dot: 'bg-amber-500', border: 'border-amber-500/20', hover: 'hover:border-amber-500/50 hover:bg-amber-500/5', text: 'text-amber-500', badge: 'bg-amber-500/10 text-amber-600' },
    { dot: 'bg-rose-500', border: 'border-rose-500/20', hover: 'hover:border-rose-500/50 hover:bg-rose-500/5', text: 'text-rose-500', badge: 'bg-rose-500/10 text-rose-600' },
    { dot: 'bg-cyan-500', border: 'border-cyan-500/20', hover: 'hover:border-cyan-500/50 hover:bg-cyan-500/5', text: 'text-cyan-500', badge: 'bg-cyan-500/10 text-cyan-600' },
  ];

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-8 space-y-6">
        <Skeleton className="h-14 w-80 rounded-2xl" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-32 rounded-2xl" />)}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn("min-h-screen bg-background text-foreground", isRTL ? "font-kurmanji" : "font-sans")}
      dir={isRTL ? "rtl" : "ltr"}
    >
      {/* ── TOP HEADER BAR ── */}
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl border-b border-border/50 print:hidden">
        <div className="max-w-[1600px] mx-auto px-6 py-3 flex items-center justify-between gap-4">
          {/* Left: breadcrumb */}
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" asChild className="h-8 w-8 rounded-xl hover:bg-primary/10">
              <Link href="/admin"><ArrowLeft className="w-4 h-4" /></Link>
            </Button>
            <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
              <Archive className="w-3.5 h-3.5 text-primary" />
              <span className="text-primary">{isRTL ? 'ئەرشیفی ئێکسڵ' : 'Excel Archive'}</span>
              {selectedFolder && (
                <>
                  <ChevronRight className="w-3 h-3" />
                  <button onClick={() => setSelectedFolder(null)} className="hover:text-primary transition-colors">{selectedFolder}</button>
                </>
              )}
            </div>
          </div>

          {/* Right: actions */}
          <div className="flex items-center gap-2">
            {/* Search */}
            <div className="relative hidden md:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder={isRTL ? "گەڕان بۆ فایلەکان..." : "Search files..."}
                className="h-8 pl-9 pr-4 w-56 rounded-xl border-border/50 bg-muted/40 text-xs placeholder:text-muted-foreground/60 focus-visible:ring-primary/20"
              />
            </div>

            {/* View toggle */}
            <div className="flex items-center bg-muted/40 rounded-xl p-1 border border-border/50">
              <button
                onClick={() => setViewMode('grid')}
                className={cn("p-1.5 rounded-lg transition-all", viewMode === 'grid' ? "bg-primary text-white shadow-sm" : "text-muted-foreground hover:text-foreground")}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={cn("p-1.5 rounded-lg transition-all", viewMode === 'list' ? "bg-primary text-white shadow-sm" : "text-muted-foreground hover:text-foreground")}
              >
                <List className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="w-px h-5 bg-border" />

            {/* New Folder */}
            <Dialog open={isFolderDialogOpen} onOpenChange={setIsFolderDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="icon" className="h-8 w-8 rounded-xl border-border/50 hover:border-primary/50 hover:text-primary">
                  <FolderPlus className="w-3.5 h-3.5" />
                </Button>
              </DialogTrigger>
              <DialogContent className="rounded-3xl border-border/50 shadow-2xl">
                <DialogHeader>
                  <DialogTitle className="text-xs font-black uppercase tracking-widest text-primary">{isRTL ? 'بوخچەی نوێ' : 'New Folder'}</DialogTitle>
                  <DialogDescription className="sr-only">Create a new classification folder</DialogDescription>
                </DialogHeader>
                <div className="py-4">
                  <Input
                    value={newFolderName}
                    onChange={e => setNewFolderName(e.target.value)}
                    placeholder={isRTL ? "ناوی بوخچە..." : "Folder name..."}
                    className="rounded-xl border-border/50 focus-visible:ring-primary/20"
                    onKeyDown={e => {
                      if (e.key === 'Enter' && newFolderName) {
                        setSelectedFolder(newFolderName);
                        setIsFolderDialogOpen(false);
                        setNewFolderName('');
                      }
                    }}
                  />
                </div>
                <DialogFooter>
                  <Button
                    onClick={() => {
                      if (newFolderName) {
                        setSelectedFolder(newFolderName);
                        setIsFolderDialogOpen(false);
                        setNewFolderName('');
                      }
                    }}
                    className="rounded-xl font-black text-xs uppercase tracking-widest"
                  >
                    {isRTL ? 'دروستکردن' : 'Create'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* Add File */}
            <Button variant="outline" size="icon" asChild className="h-8 w-8 rounded-xl border-primary/30 text-primary hover:bg-primary hover:text-white transition-all">
              <Link href="/new-file"><FilePlus2 className="w-3.5 h-3.5" /></Link>
            </Button>

            <Button onClick={handleExportAll} variant="ghost" size="icon" className="h-8 w-8 rounded-xl hover:text-primary">
              <FileDown className="h-4 w-4" />
            </Button>
            <Button onClick={() => window.print()} variant="ghost" size="icon" className="h-8 w-8 rounded-xl hover:text-primary">
              <Printer className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto px-6 py-8 space-y-10">

        {/* ── STAT CARDS ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: isRTL ? 'کۆی فایلەکان' : 'Total Files', value: excelFiles?.length || 0, icon: FileSpreadsheet, color: 'text-blue-500', bg: 'bg-blue-500/10' },
            { label: isRTL ? 'بوخچەکان' : 'Folders', value: folders.length, icon: Folder, color: 'text-violet-500', bg: 'bg-violet-500/10' },
            { label: isRTL ? 'ئەم مانگە' : 'This Month', value: excelFiles?.filter(f => f.date && format(parseISO(f.date), 'yyyy-MM') === format(new Date(), 'yyyy-MM')).length || 0, icon: TrendingUp, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
            { label: isRTL ? 'سەرچاوەکان' : 'Sources', value: new Set(excelFiles?.map(f => f.source)).size || 0, icon: Building, color: 'text-amber-500', bg: 'bg-amber-500/10' },
          ].map((stat, i) => (
            <div key={i} className="win-card p-5 flex items-center gap-4 group">
              <div className={cn("w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0", stat.bg)}>
                <stat.icon className={cn("w-5 h-5", stat.color)} />
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{stat.label}</p>
                <p className="text-2xl font-black text-foreground leading-none mt-0.5">{stat.value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* ── FOLDER CLUSTERS ── */}
        {!selectedFolder && (
          <section className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-1 h-3 bg-primary rounded-full" />
              <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground">{isRTL ? 'بوخچەکان' : 'Folders'}</h2>
            </div>
            <div className="flex items-center gap-3 overflow-x-auto pb-2 scrollbar-none">
              {folders.map((folder, i) => {
                const color = folderColors[i % folderColors.length];
                return (
                  <button
                    key={folder}
                    onClick={() => setSelectedFolder(folder)}
                    className={cn(
                      "group flex-shrink-0 flex items-center gap-3 px-4 py-3 rounded-2xl border bg-card transition-all duration-200",
                      color.border, color.hover
                    )}
                  >
                    <div className={cn("w-8 h-8 rounded-xl flex items-center justify-center", color.badge)}>
                      <Folder className={cn("w-4 h-4", color.text)} />
                    </div>
                    <div className="text-left">
                      <p className={cn("text-[10px] font-black uppercase tracking-widest leading-none", color.text)}>{folder === 'Unclassified' ? (isRTL ? 'پۆلێن نەکراو' : 'Unclassified') : folder}</p>
                      <p className="text-[9px] text-muted-foreground mt-0.5">{groupedFiles[folder].length} {isRTL ? 'فایل' : 'files'}</p>
                    </div>
                    <ChevronRight className={cn("w-3 h-3 ml-1 opacity-0 group-hover:opacity-100 transition-opacity", color.text)} />
                  </button>
                );
              })}
              <button
                onClick={() => setIsFolderDialogOpen(true)}
                className="flex-shrink-0 flex items-center gap-2 px-4 py-3 rounded-2xl border border-dashed border-border/60 hover:border-primary/40 hover:bg-primary/5 transition-all duration-200"
              >
                <FolderPlus className="w-4 h-4 text-muted-foreground" />
                <span className="text-[10px] font-bold text-muted-foreground">{isRTL ? 'بوخچەی نوێ' : 'New Folder'}</span>
              </button>
            </div>
          </section>
        )}

        {/* ── FILES GALLERY ── */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-1 h-3 bg-primary/50 rounded-full" />
              <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground">
                {selectedFolder ? (selectedFolder === 'Unclassified' ? (isRTL ? 'پۆلێن نەکراو' : 'Unclassified') : selectedFolder) : (isRTL ? 'هەموو ئەرشیفەکان' : 'All Archives')}
                <span className="ml-2 text-primary">({filteredFiles.length})</span>
              </h2>
            </div>
            {selectedFolder && (
              <button
                onClick={() => setSelectedFolder(null)}
                className="text-[10px] font-bold text-muted-foreground hover:text-primary transition-colors uppercase tracking-widest flex items-center gap-1"
              >
                <ArrowLeft className="w-3 h-3" /> {isRTL ? 'گەڕانەوە' : 'Back'}
              </button>
            )}
          </div>

          {filteredFiles.length === 0 ? (
            <div className="py-24 flex flex-col items-center gap-4 text-center">
              <div className="w-16 h-16 rounded-3xl bg-primary/10 flex items-center justify-center">
                <FileSpreadsheet className="w-7 h-7 text-primary" />
              </div>
              <p className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">{isRTL ? 'هیچ فایلێک نەدۆزرایەوە' : 'No files found'}</p>
              <Button asChild className="rounded-xl text-xs font-black uppercase tracking-widest">
                <Link href="/new-file"><FilePlus2 className="w-3.5 h-3.5 mr-2" /> {isRTL ? 'زیادکردنی یەکەم فایل' : 'Add First File'}</Link>
              </Button>
            </div>
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {filteredFiles.map((file, i) => (
                <ExcelFileCard key={file.id} file={file} getEmployeeName={getEmployeeName} index={i} />
              ))}
            </div>
          ) : (
            <div className="win-card overflow-hidden divide-y divide-border/50">
              {filteredFiles.map((file) => (
                <Link
                  key={file.id}
                  href={`/archive/${file.id}`}
                  className="flex items-center gap-4 px-5 py-3.5 hover:bg-primary/5 transition-colors group"
                >
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
                    {file.type === 'google-sheet'
                      ? <Globe className="w-4 h-4 text-emerald-500" />
                      : <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold truncate group-hover:text-primary transition-colors">{file.storageName}</p>
                    <p className="text-[10px] text-muted-foreground">{file.source} · {file.classification === 'Unclassified' || !file.classification ? (isRTL ? 'پۆلێن نەکراو' : 'Unclassified') : file.classification}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-[10px] font-bold text-primary">{file.date ? format(parseISO(file.date), 'MMM d') : '—'}</p>
                    <p className="text-[9px] text-muted-foreground">{file.date ? format(parseISO(file.date), 'yyyy') : ''}</p>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </Link>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

/* ── Excel File Card Component ── */
function ExcelFileCard({ file, getEmployeeName, index }: { file: ExcelFile; getEmployeeName: (id: string) => string; index: number }) {
  const { language } = useTranslation();
  const isRTL = language === 'ku';
  const isGSheet = file.type === 'google-sheet';

  // Excel-style green accent for spreadsheet files
  const accentColors = [
    'from-emerald-500/20 to-green-500/5 border-emerald-500/20',
    'from-blue-500/20 to-indigo-500/5 border-blue-500/20',
    'from-violet-500/20 to-purple-500/5 border-violet-500/20',
    'from-amber-500/20 to-yellow-500/5 border-amber-500/20',
  ];
  const accent = accentColors[index % accentColors.length];

  return (
    <Link href={`/archive/${file.id}`} className="block group">
      <div className={cn(
        "relative rounded-2xl border bg-gradient-to-br overflow-hidden transition-all duration-300 hover:shadow-lg hover:shadow-primary/10 hover:-translate-y-0.5 cursor-pointer h-full",
        accent
      )}>
        {/* Excel-style top bar */}
        <div className="h-1.5 w-full bg-gradient-to-r from-emerald-500 to-green-400 opacity-80" />

        <div className="p-4 space-y-3">
          {/* Icon + Type */}
          <div className="flex items-start justify-between">
            <div className={cn(
              "w-10 h-10 rounded-xl flex items-center justify-center",
              isGSheet ? "bg-blue-500/10" : "bg-emerald-500/10"
            )}>
              {isGSheet
                ? <Globe className="w-5 h-5 text-blue-500" />
                : <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
              }
            </div>
            <span className="text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-white/60 dark:bg-black/20 text-muted-foreground border border-border/30">
              {isGSheet ? 'G-SHEET' : 'EXCEL'}
            </span>
          </div>

          {/* File Name */}
          <div>
            <p className="text-sm font-black leading-tight tracking-tight group-hover:text-primary transition-colors line-clamp-2">
              {file.storageName}
            </p>
            {file.categoryName && (
              <p className="text-[9px] text-muted-foreground mt-1 uppercase tracking-widest truncate">{file.categoryName}</p>
            )}
          </div>

          {/* Metadata footer */}
          <div className="pt-2 border-t border-border/30 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-4 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="w-2.5 h-2.5 text-primary" />
              </div>
              <span className="text-[9px] font-bold text-muted-foreground truncate max-w-[70px]">
                {getEmployeeName(file.storekeeperId)}
              </span>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-black text-primary leading-none">
                {file.date ? format(parseISO(file.date), 'MMM d') : '—'}
              </p>
              {file.classification && (
                <p className="text-[8px] text-muted-foreground uppercase tracking-widest mt-0.5">{file.classification === 'Unclassified' ? (isRTL ? 'پۆلێن نەکراو' : 'Unclassified') : file.classification}</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}