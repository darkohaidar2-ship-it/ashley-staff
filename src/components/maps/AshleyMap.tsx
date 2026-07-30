'use client';

import { useMemo } from 'react';
import type { Item, StorageLocation } from '@/lib/types';
import { useTranslation } from '@/hooks/use-translation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Shelf } from './Shelf';
import { cn } from '@/lib/utils';

export function AshleyMap({
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

  const ashleyLocations = useMemo(
    () => locations.filter(l => l.warehouseType === 'Ashley'),
    [locations]
  );

  const { floor4, floor3area1Units, floor3office } = useMemo(() => {
    const floor4 = ashleyLocations
      .filter(l => l.name.startsWith('A-4-'))
      .sort((a, b) => {
        const numA = parseInt(a.name.split('-')[2]);
        const numB = parseInt(b.name.split('-')[2]);
        return numA - numB;
      });

    const floor3area1Units: Record<string, StorageLocation[]> = {};
    ashleyLocations
      .filter(l => l.name.startsWith('A-3-1-'))
      .forEach(loc => {
        const parts = loc.name.split('-');
        if (parts.length !== 5) return;
        const unit = parts[3];
        if (!floor3area1Units[unit]) floor3area1Units[unit] = [];
        floor3area1Units[unit].push(loc);
      });

    Object.values(floor3area1Units).forEach(unitSections =>
      unitSections.sort((a, b) => {
        const numA = parseInt(a.name.split('-')[4]);
        const numB = parseInt(b.name.split('-')[4]);
        return numA - numB;
      })
    );

    const floor3office = ashleyLocations
      .filter(l => l.name.startsWith('A-3-O-'))
      .sort((a, b) => a.name.localeCompare(b.name));

    return { floor4, floor3area1Units, floor3office };
  }, [ashleyLocations]);

  const floor4Left = useMemo(() => floor4.slice(8, 16), [floor4]); // 9-16
  const floor4Right = useMemo(() => floor4.slice(0, 8).reverse(), [floor4]); // 8-1

  const sortedOffice = useMemo(() => {
    const order = ['LF', 'MF', 'RF', 'LB', 'MB', 'RB'];
    return [...floor3office].sort((a, b) => {
      const codeA = a.name.split('-').pop() || '';
      const codeB = a.name.split('-').pop() || '';
      return order.indexOf(codeA) - order.indexOf(codeB);
    });
  }, [floor3office]);

  return (
    <div className="space-y-6">
      <Card className="bg-[hsl(var(--ashley-floor4-bg))]">
        <CardHeader>
          <CardTitle>{t('floor_4')}</CardTitle>
        </CardHeader>
        <CardContent className="p-4 md:p-8 flex justify-center rounded-xl">
          <div className="grid grid-cols-2 gap-4 w-full max-w-sm">
            <div className="flex flex-col gap-2">
              {floor4Left.map(loc => (
                <Shelf
                  key={loc.id}
                  loc={loc}
                  items={itemsByLocationId.get(loc.id) || []}
                  onClick={onSectionClick}
                  isHighlighted={highlightId === loc.id}
                />
              ))}
            </div>
            <div className="flex flex-col gap-2">
              {floor4Right.map(loc => (
                <Shelf
                  key={loc.id}
                  loc={loc}
                  items={itemsByLocationId.get(loc.id) || []}
                  onClick={onSectionClick}
                  isHighlighted={highlightId === loc.id}
                />
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('floor_3')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="p-4 rounded-lg bg-[hsl(var(--ashley-floor3-area1-bg))]">
            <h3 className="text-lg font-semibold text-center mb-4">
              {t('area_1')}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {['6', '5', '4', '3', '2', '1'].map(unitKey => {
                const unitLocations = floor3area1Units[unitKey] || [];
                if (unitLocations.length === 0) return null;
                return (
                  <div
                    key={unitKey}
                    className="p-4 rounded-lg bg-background/50 border"
                  >
                    <h4 className="font-bold text-center mb-4">
                      {t('language') === 'ku' ? `یەکەی ${unitKey === '1' ? '١' : unitKey === '2' ? '٢' : unitKey === '3' ? '٣' : unitKey === '4' ? '٤' : unitKey === '5' ? '٥' : unitKey === '6' ? '٦' : unitKey}` : `Unit ${unitKey}`}
                    </h4>
                    <div className="grid grid-cols-2 gap-2">
                      {unitLocations.map(loc => (
                        <Shelf
                          key={loc.id}
                          loc={loc}
                          items={itemsByLocationId.get(loc.id) || []}
                          onClick={onSectionClick}
                          isHighlighted={highlightId === loc.id}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          
          <div className="p-4 rounded-lg bg-[hsl(var(--ashley-floor3-office-bg))]">
            <h3 className="text-lg font-semibold text-center mb-4">
              {t('area_2_office')}
            </h3>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 max-w-xl mx-auto">
              {sortedOffice.map(loc => (
                <Shelf
                  key={loc.id}
                  loc={loc}
                  items={itemsByLocationId.get(loc.id) || []}
                  onClick={onSectionClick}
                  isHighlighted={highlightId === loc.id}
                />
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
