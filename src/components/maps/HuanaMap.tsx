'use client';
import { useMemo } from 'react';
import type { Item, StorageLocation } from '@/lib/types';
import { useTranslation } from '@/hooks/use-translation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Shelf } from './Shelf';
import { cn } from '@/lib/utils';

const getWarehouseBgColor = (warehouseName: string) => {
    switch (warehouseName) {
        case 'H1': return 'bg-[hsl(var(--huana-h1-bg))]';
        case 'H2': return 'bg-[hsl(var(--huana-h2-bg))]';
        case 'H3': return 'bg-[hsl(var(--huana-h3-bg))]';
        case 'K1': return 'bg-[hsl(var(--huana-k-bg))]';
        default: return 'bg-card';
    }
};

const WarehouseDisplay = ({
  name,
  floors,
  onSectionClick,
  itemsByLocationId,
  highlightId,
}: {
  name: string;
  floors: { floor1: StorageLocation[]; floor2: StorageLocation[] };
  onSectionClick: (loc: StorageLocation) => void;
  itemsByLocationId: Map<string, Item[]>;
  highlightId?: string | null;
}) => {
  const { t } = useTranslation();

  const renderSections = (sections: StorageLocation[]) => {
    const getSection = (suffix: string) => sections.find(s => s.name.endsWith(`-${suffix}`));
    const sectionGrid = [
      ['L-4', 'L-3', 'L-2', 'L-1'],
      ['R-1', 'R-2', 'R-3', 'R-4'],
    ];

    return (
      <div className="grid grid-cols-4 gap-1">
        {sectionGrid.flat().map(suffix => {
          const section = getSection(suffix);
          if (!section)
            return <div key={suffix} className="h-12 w-full rounded-lg bg-muted/30" />;
          return (
            <Shelf
              key={section.id}
              loc={section}
              items={itemsByLocationId.get(section.id) || []}
              onClick={onSectionClick}
              isHighlighted={highlightId === section.id}
            />
          );
        })}
      </div>
    );
  };

  return (
    <div className={cn("p-3 rounded-xl border-2 space-y-2", getWarehouseBgColor(name))}>
      <h3 className="text-center font-bold text-lg">
        {t('language') === 'ku'
          ? (name === 'H1' ? 'کۆگای ١ هوانە' : name === 'H2' ? 'کۆگای ٢ هوانە' : name === 'H3' ? 'کۆگای ٣ هوانە' : name === 'K1' ? 'کۆگای ٤ هوانە' : name)
          : name}
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

export function HuanaMap({
  locations,
  itemsByLocationId,
  onSectionClick,
  highlightId,
}: {
  locations: StorageLocation[];
  itemsByLocationId: Map<string, Item[]>;
  onSectionClick: (loc: StorageLocation) => void;
  highlightId?: string | null;
}) {
  const { t } = useTranslation();

  const huanaLocations = useMemo(
    () => locations.filter(l => l.warehouseType === 'Huana'),
    [locations]
  );

  const { hWarehouses, kWarehouse } = useMemo(() => {
    const createWarehouse = () => ({
      floor1: [] as StorageLocation[],
      floor2: [] as StorageLocation[],
    });

    const hWarehouses: Record<
      string,
      { floor1: StorageLocation[]; floor2: StorageLocation[] }
    > = {
      h1: createWarehouse(),
      h2: createWarehouse(),
      h3: createWarehouse(),
    };
    const kWarehouse = { k1: createWarehouse() };

    if (!huanaLocations) return { hWarehouses, kWarehouse };

    for (const loc of huanaLocations) {
      const parts = loc.name.split('-');
      if (parts.length < 4) continue;

      const warehouseCode = parts[0]; // e.g., 'H1', 'H2', 'H3', 'K1'
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

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <WarehouseDisplay
        name="H1"
        floors={hWarehouses.h1}
        onSectionClick={onSectionClick}
        itemsByLocationId={itemsByLocationId}
        highlightId={highlightId}
      />
      <WarehouseDisplay
        name="H2"
        floors={hWarehouses.h2}
        onSectionClick={onSectionClick}
        itemsByLocationId={itemsByLocationId}
        highlightId={highlightId}
      />
      <WarehouseDisplay
        name="H3"
        floors={hWarehouses.h3}
        onSectionClick={onSectionClick}
        itemsByLocationId={itemsByLocationId}
        highlightId={highlightId}
      />
      <WarehouseDisplay
        name="K1"
        floors={kWarehouse.k1}
        onSectionClick={onSectionClick}
        itemsByLocationId={itemsByLocationId}
        highlightId={highlightId}
      />
    </div>
  );
}
