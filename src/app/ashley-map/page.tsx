
'use client';

import { useState, useMemo, useEffect, Fragment } from 'react';
import Link from 'next/link';
import { ArrowLeft, Box, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn, WAREHOUSE_COLORS } from '@/lib/utils';
import { useAppContext } from '@/context/app-provider';
import type { Item, StorageLocation } from '@/lib/types';
import { useTranslation } from '@/hooks/use-translation';


const Shelf = ({ loc, items, onClick, isHighlighted }: { loc: StorageLocation, items: Item[], onClick: (loc: StorageLocation) => void, isHighlighted: boolean }) => {
    const {t} = useTranslation();
    const itemCount = items.length;
    const isOccupied = itemCount > 0;
    const locationCode = loc.name.split('-').pop();
    
    return (
        <button 
            id={loc.id}
            title={`${loc.name}: ${itemCount} ${t('items_lowercase')}`}
            onClick={() => onClick(loc)}
            className={cn(
                "relative w-full h-12 rounded-lg border-2 transition-all group focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-background focus:ring-primary",
                isOccupied 
                    ? 'border-primary/50 text-primary-foreground' 
                    : 'bg-background/30 border-border hover:border-primary/50',
                isHighlighted && "ring-2 border-primary"
            )}
            style={{ 
                backgroundColor: isOccupied ? WAREHOUSE_COLORS.Ashley.hex : undefined 
            }}
        >
            <span className="font-mono font-bold text-sm text-foreground group-hover:text-primary">{locationCode}</span>
            {isOccupied && <div className="absolute top-1 right-1 h-2 w-2 rounded-full bg-primary animate-pulse" />}
        </button>
    );
};

export default function AshleyMapPage() {
  const { locations, items: allItems } = useAppContext();
  const [highlightId, setHighlightId] = useState('');
  const { t } = useTranslation();

  const [selectedLocation, setSelectedLocation] = useState<StorageLocation | null>(null);
  const [itemsInLocation, setItemsInLocation] = useState<Item[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const ashleyLocations = useMemo(() => locations.filter(l => l.warehouseType === 'Ashley'), [locations]);

  useEffect(() => {
    if (locations && allItems) {
      setIsLoading(false);
    }
  }, [locations, allItems]);
  
  useEffect(() => {
    if (typeof window !== 'undefined') {
        const hash = window.location.hash.substring(1);
        setHighlightId(hash);
        if (hash) {
            const element = document.getElementById(hash);
            if (element) {
                element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }
    }
  }, [ashleyLocations]);

  const handleSectionClick = (location: StorageLocation) => {
    setSelectedLocation(location);
    setIsDialogOpen(true);
    const foundItems = allItems.filter(item => item.locationIds?.[0] === location.id);
    setItemsInLocation(foundItems);
  };

  const { floor4, floor3area1Units, floor3office } = useMemo(() => {
    if (!ashleyLocations) return { floor4: [], floor3area1Units: {}, floor3office: [] };
    
    const floor4 = ashleyLocations
      .filter(l => l.name.startsWith('A-4-'))
      .sort((a,b) => {
        const numA = parseInt(a.name.split('-')[2]);
        const numB = parseInt(b.name.split('-')[2]);
        return numA - numB;
      });
    
    const floor3area1Units: Record<string, StorageLocation[]> = {};
    ashleyLocations.filter(l => l.name.startsWith('A-3-1-')).forEach(loc => {
      const parts = loc.name.split('-');
      if (parts.length !== 5) return;
      const unit = parts[3];
      if (!floor3area1Units[unit]) floor3area1Units[unit] = [];
      floor3area1Units[unit].push(loc);
    });

    Object.values(floor3area1Units).forEach(unitSections => 
      unitSections.sort((a,b) => {
          const numA = parseInt(a.name.split('-')[4]);
          const numB = parseInt(b.name.split('-')[4]);
          return numA - numB;
      })
    );
    
    const floor3office = ashleyLocations
      .filter(l => l.name.startsWith('A-3-O-'))
      .sort((a,b) => a.name.localeCompare(b.name));
    
    return { floor4, floor3area1Units, floor3office };
  }, [ashleyLocations]);

  const floor4Left = useMemo(() => floor4.slice(8, 16), [floor4]); // 9-16
  const floor4Right = useMemo(() => floor4.slice(0, 8).reverse(), [floor4]); // 8-1

  const itemsByLocationId = useMemo(() => {
    if (!allItems) return new Map<string, Item[]>();
    return allItems.reduce((acc, item) => {
        if(item.locationIds?.[0]) {
            if(!acc.has(item.locationIds?.[0])) acc.set(item.locationIds?.[0], []);
            acc.get(item.locationIds?.[0])!.push(item);
        }
        return acc;
    }, new Map<string, Item[]>());
  }, [allItems]);

  const sortedOffice = useMemo(() => {
    const order = ['LF', 'MF', 'RF', 'LB', 'MB', 'RB'];
    return [...floor3office].sort((a, b) => {
        const codeA = a.name.split('-').pop() || '';
        const codeB = b.name.split('-').pop() || '';
        return order.indexOf(codeA) - order.indexOf(codeB);
    });
  }, [floor3office]);

  return (
    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
      <div className="min-h-screen bg-muted/40 text-foreground p-4 md:p-8">
        <header className="flex items-center gap-4 mb-8">
          <Button variant="outline" size="icon" asChild>
            <Link href="/items">
              <ArrowLeft />
              <span className="sr-only">{t('back_to_dashboard')}</span>
            </Link>
          </Button>
          <h1 className="text-2xl md:text-3xl">{t('ashley_warehouse_map')}</h1>
        </header>
        <main className="space-y-8">
          {isLoading ? (
             <div className="space-y-6">
                {[...Array(2)].map((_, i) => (
                    <Card key={i} className="animate-pulse">
                        <CardHeader><Skeleton className="h-7 w-48" /></CardHeader>
                        <CardContent><Skeleton className="h-64 w-full" /></CardContent>
                    </Card>
                ))}
            </div>
          ) : ashleyLocations.length > 0 ? (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>{t('floor_4')}</CardTitle>
                </CardHeader>
                <CardContent className="p-4 md:p-8 flex justify-center rounded-xl">
                    <div className="grid grid-cols-2 gap-4 w-full max-w-sm">
                        <div className="flex flex-col gap-2">
                            {floor4Left.map(loc => (
                                <Shelf key={loc.id} loc={loc} items={itemsByLocationId.get(loc.id) || []} onClick={handleSectionClick} isHighlighted={highlightId === loc.id} />
                            ))}
                        </div>
                        <div className="flex flex-col gap-2">
                             {floor4Right.map(loc => (
                                <Shelf key={loc.id} loc={loc} items={itemsByLocationId.get(loc.id) || []} onClick={handleSectionClick} isHighlighted={highlightId === loc.id} />
                            ))}
                        </div>
                    </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                    <CardTitle>{t('floor_3')}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-12">
                    <div>
                        <h3 className="text-lg font-semibold text-center mb-4">{t('area_1')}</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                            {['6', '5', '4', '3', '2', '1'].map((unitKey) => {
                                const unitLocations = floor3area1Units[unitKey] || [];
                                if (unitLocations.length === 0) return null;
                                return (
                                    <div key={unitKey} className="p-4 rounded-lg bg-muted/30 border">
                                        <h4 className="font-bold text-center mb-4">
                                            {t('language') === 'ku' ? `یەکەی ${unitKey === '1' ? '١' : unitKey === '2' ? '٢' : unitKey === '3' ? '٣' : unitKey === '4' ? '٤' : unitKey === '5' ? '٥' : unitKey === '6' ? '٦' : unitKey}` : `Unit ${unitKey}`}
                                        </h4>
                                        <div className="grid grid-cols-2 gap-2">
                                            {unitLocations.map(loc => (
                                                <Shelf
                                                    key={loc.id}
                                                    loc={loc}
                                                    items={itemsByLocationId.get(loc.id) || []}
                                                    onClick={handleSectionClick}
                                                    isHighlighted={highlightId === loc.id}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                    
                    <hr className="my-8" />
                    
                    <div>
                        <h3 className="text-lg font-semibold text-center mb-4">{t('area_2_office')}</h3>
                        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 max-w-xl mx-auto p-4 rounded-lg bg-muted/30 border">
                            {sortedOffice.map(loc => (
                                <Shelf key={loc.id} loc={loc} items={itemsByLocationId.get(loc.id) || []} onClick={handleSectionClick} isHighlighted={highlightId === loc.id} />
                            ))}
                        </div>
                    </div>
                </CardContent>
              </Card>
            </>
          ) : (
             <div className="text-center py-16 border-2 border-dashed rounded-lg">
                <Box className="mx-auto h-12 w-12 text-muted-foreground" />
                <h3 className="mt-4 text-lg">{t('no_ashley_locations_found')}</h3>
                
                <Button asChild className="mt-4"><Link href="/locations">{t('manage_locations')}</Link></Button>
            </div>
           )}
        </main>
      </div>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('items_in_location', {locationName: selectedLocation?.name})}</DialogTitle>
          
        </DialogHeader>
        <div className="max-h-[60vh] overflow-y-auto">
          {itemsInLocation.length > 0 ? (
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>{t('model')}</TableHead>
                        <TableHead className="text-right">{t('quantity')}</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {itemsInLocation.map(item => (
                        <TableRow key={item.id}>
                            <TableCell>{item.model}</TableCell>
                            <TableCell className="text-right">{item.quantity}</TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
          ) : (
            <p className="text-center text-muted-foreground p-8">{t('no_items_in_this_location')}</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
