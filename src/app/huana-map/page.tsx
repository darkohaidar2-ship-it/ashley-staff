
'use client';

import { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, Box, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn, WAREHOUSE_COLORS } from '@/lib/utils';
import { useAppContext } from '@/context/app-provider';
import type { Item, StorageLocation } from '@/lib/types';
import { useTranslation } from '@/hooks/use-translation';

const Section = ({ id, code, items, onClick, isHighlighted }: { id: string, code: string; items: Item[]; onClick: () => void, isHighlighted?: boolean }) => {
    const {t} = useTranslation();
    const itemCount = items.length;
    const isOccupied = itemCount > 0;
    
    return (
        <button 
            id={id}
            title={`${code}: ${itemCount} ${t('items_lowercase')}`}
            onClick={onClick}
            className={cn(
                "relative w-full h-12 rounded-lg border-2 transition-all group focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-background focus:ring-primary flex items-center justify-between px-2",
                isOccupied 
                    ? 'border-primary/50 text-primary-foreground' 
                    : 'bg-background/30 border-border hover:border-primary/50',
                isHighlighted && "ring-2 border-primary ring-offset-1 bg-primary/20",
                isOccupied && "bg-huana-light"
            )}
            style={{ 
                backgroundColor: isOccupied ? WAREHOUSE_COLORS.Huana.hex : undefined 
            }}
        >
            <span className="font-mono font-bold text-sm text-foreground group-hover:text-primary">{code}</span>
            <div className="flex items-center gap-1">
                {isOccupied && <span className="text-xs font-bold bg-primary text-primary-foreground px-1.5 py-0.5 rounded-full">{itemCount}</span>}
                {isOccupied && <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />}
            </div>
        </button>
    );
};

const WarehouseDisplay = ({ name, floors, onSectionClick, itemsByLocationId, highlightId }: { name: string; floors: { floor1: StorageLocation[], floor2: StorageLocation[] }, onSectionClick: (loc: StorageLocation) => void, itemsByLocationId: Map<string, Item[]>, highlightId: string }) => {
    const {t} = useTranslation();
    
    const renderSections = (sections: StorageLocation[]) => {
        const getSection = (suffix: string) => sections.find(s => s.name.endsWith(`-${suffix}`));
        
        const sectionGrid = [
            ['L-4', 'L-3', 'L-2', 'L-1'],
            ['R-1', 'R-2', 'R-3', 'R-4']
        ];

        return (
            <div className="grid grid-cols-4 gap-1">
                {sectionGrid.flat().map(suffix => {
                    const section = getSection(suffix);
                    if (!section) return <div key={suffix} className="h-12 w-full rounded-lg bg-muted/30" />;
                    return <Section key={section.id} id={section.id} code={suffix} items={itemsByLocationId.get(section.id) || []} onClick={() => onSectionClick(section)} isHighlighted={highlightId === section.id} />;
                })}
            </div>
        );
    };

    return (
        <div className="p-3 bg-card rounded-xl border-2 space-y-2">
            <h3 className="text-center font-bold text-lg">
                {name === 'H1' ? 'کۆگای ١ هوانە' : name === 'H2' ? 'کۆگای ٢ هوانە' : name === 'H3' ? 'کۆگای ٣ هوانە' : name === 'K1' ? 'کۆگای ٤ هوانە' : name}
            </h3>
            <div className="space-y-3">
                <div>
                    <p className="text-xs text-center text-muted-foreground mb-1">
                        {t('language') === 'ku' ? 'قاتی ١' : `${t('floor')} 1`}
                    </p>
                    {renderSections(floors.floor1)}
                </div>
                <div>
                    <p className="text-xs text-center text-muted-foreground mb-1">
                        {t('language') === 'ku' ? 'قاتی ٢' : `${t('floor')} 2`}
                    </p>
                    {renderSections(floors.floor2)}
                </div>
            </div>
        </div>
    );
};

export default function HuanaMapPage() {
  const { t } = useTranslation();
  const { locations, items: allItems } = useAppContext();
  const [highlightId, setHighlightId] = useState('');

  const [selectedLocation, setSelectedLocation] = useState<StorageLocation | null>(null);
  const [itemsInLocation, setItemsInLocation] = useState<Item[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const huanaLocations = useMemo(() => locations.filter(l => l.warehouseType === 'Huana'), [locations]);

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
  }, [huanaLocations]);


  const handleSectionClick = (location: StorageLocation) => {
    setSelectedLocation(location);
    setIsDialogOpen(true);
    const foundItems = allItems.filter(item => item.locationIds?.[0] === location.id);
    setItemsInLocation(foundItems);
  };

  const { hWarehouses, kWarehouse } = useMemo(() => {
    const createWarehouse = () => ({
        floor1: [] as StorageLocation[],
        floor2: [] as StorageLocation[],
    });

    const hWarehouses: Record<string, {floor1: StorageLocation[], floor2: StorageLocation[]}> = {
        h1: createWarehouse(),
        h2: createWarehouse(),
        h3: createWarehouse(),
    };
    const kWarehouse = { k1: createWarehouse() };

    if (!huanaLocations) return { hWarehouses, kWarehouse };

    for (const loc of huanaLocations) {
        const parts = loc.name.split('-');
        if (parts.length < 4) continue;

        const warehouseCode = parts[0];
        const floorNum = parts[1];
        
        if (warehouseCode === 'H1' || warehouseCode === 'H2' || warehouseCode === 'H3') {
            const warehouseKey = warehouseCode.toLowerCase();
            if (hWarehouses[warehouseKey]) {
                if (floorNum === '1') {
                    hWarehouses[warehouseKey].floor1.push(loc);
                } else if (floorNum === '2') {
                    hWarehouses[warehouseKey].floor2.push(loc);
                }
            }
        } else if (warehouseCode === 'K1') {
             if (floorNum === '1') {
                kWarehouse.k1.floor1.push(loc);
            } else if (floorNum === '2') {
                kWarehouse.k1.floor2.push(loc);
            }
        }
    }
    return { hWarehouses, kWarehouse };
  }, [huanaLocations]);
  
  const itemsByLocationId = useMemo(() => {
    if (!allItems) return new Map<string, Item[]>();
    return allItems.reduce((acc, item) => {
        if(item.locationIds?.[0]) {
            if(!acc.has(item.locationIds?.[0])) acc.set(item.locationIds?.[0], []);
            acc.get(item.locationIds?.[0])!.push(item);
        }
        return acc;
    }, new Map<string, Item[]>());
  }, [allItems])

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
          <h1 className="text-2xl md:text-3xl">{t('huana_warehouse_map')}</h1>
        </header>
        <main className="relative max-w-7xl mx-auto">
          {isLoading ? (
            <div className="flex justify-center items-center h-96"><Loader2 className="h-10 w-10 animate-spin" /></div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                <WarehouseDisplay name="H1" floors={hWarehouses.h1} onSectionClick={handleSectionClick} itemsByLocationId={itemsByLocationId} highlightId={highlightId} />
                <WarehouseDisplay name="H2" floors={hWarehouses.h2} onSectionClick={handleSectionClick} itemsByLocationId={itemsByLocationId} highlightId={highlightId} />
                <WarehouseDisplay name="H3" floors={hWarehouses.h3} onSectionClick={handleSectionClick} itemsByLocationId={itemsByLocationId} highlightId={highlightId} />
                 <WarehouseDisplay name="K1" floors={kWarehouse.k1} onSectionClick={handleSectionClick} itemsByLocationId={itemsByLocationId} highlightId={highlightId} />
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
