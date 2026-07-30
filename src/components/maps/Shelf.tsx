'use client';
import { cn } from '@/lib/utils';
import type { StorageLocation, Item } from '@/lib/types';
import { useTranslation } from '@/hooks/use-translation';

export const Shelf = ({
  loc,
  items,
  onClick,
  isHighlighted,
}: {
  loc: StorageLocation;
  items: Item[];
  onClick: (loc: StorageLocation) => void;
  isHighlighted: boolean;
}) => {
  const { t } = useTranslation();
  const itemCount = items.length;
  const isOccupied = itemCount > 0;
  const locationCode = loc.name.split('-').pop();

  return (
    <button
      id={loc.id}
      title={`${loc.name}: ${itemCount} ${t('items_lowercase')}`}
      onClick={() => onClick(loc)}
      className={cn(
        'relative w-full h-12 rounded-lg border-2 transition-all group focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-background focus:ring-primary flex items-center justify-between px-2',
        isOccupied
          ? 'bg-primary/10 border-primary/50 text-primary-foreground'
          : 'bg-background/30 border-border hover:border-primary/50',
        isHighlighted &&
          'ring-2 ring-green-500 border-green-500 bg-green-100 dark:bg-green-900'
      )}
    >
      <span className="font-mono font-bold text-sm text-foreground group-hover:text-primary">
        {loc.name.split('-').slice(-2).join('-')}
      </span>
      <div className="flex items-center gap-1">
          {isOccupied && <span className="text-xs font-bold bg-primary text-primary-foreground px-1.5 py-0.5 rounded-full">{itemCount}</span>}
          {isOccupied && <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />}
      </div>
    </button>
  );
};
