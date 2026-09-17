import { fetchSupabaseJson, saveSupabaseJson } from '@/lib/supabase/client';
import type { Item, ExcelFile, StorageLocation, ItemCategory, WarehouseMap, SoldItemsList } from '@/lib/types';
import { initialData } from '@/context/initial-data';

export const ITEMS_KEY = 'ashley_items';
export const EXCEL_FILES_KEY = 'ashley_excel_files';
export const LOCATIONS_KEY = 'ashley_locations';
export const CATEGORIES_KEY = 'ashley_categories';
export const WAREHOUSE_MAPS_KEY = 'ashley_warehouse_maps';
export const SOLD_ITEMS_KEY = 'ashley_sold_items';

// ===================== ITEMS =====================
export async function fetchItems(): Promise<Item[]> {
  try {
    const list = await fetchSupabaseJson<Item[]>(ITEMS_KEY, []);
    if (list && list.length > 0) return list;
    const fallback = initialData.items || [];
    if (fallback.length > 0) {
      await saveItems(fallback);
      return fallback;
    }
    return [];
  } catch (err) {
    console.error('[InventoryService] Error fetching items:', err);
    return initialData.items || [];
  }
}

export async function saveItems(records: Item[]): Promise<boolean> {
  return await saveSupabaseJson<Item[]>(
    ITEMS_KEY,
    'Ashley Warehouse Inventory Items',
    records
  );
}

// ===================== EXCEL FILES =====================
export async function fetchExcelFiles(): Promise<ExcelFile[]> {
  try {
    const list = await fetchSupabaseJson<ExcelFile[]>(EXCEL_FILES_KEY, []);
    if (list && list.length > 0) return list;
    const fallback = initialData.excelFiles || [];
    if (fallback.length > 0) {
      await saveExcelFiles(fallback);
      return fallback;
    }
    return [];
  } catch (err) {
    console.error('[InventoryService] Error fetching excel files:', err);
    return initialData.excelFiles || [];
  }
}

export async function saveExcelFiles(records: ExcelFile[]): Promise<boolean> {
  return await saveSupabaseJson<ExcelFile[]>(
    EXCEL_FILES_KEY,
    'Ashley Uploaded Excel Files Registry',
    records
  );
}

// ===================== STORAGE LOCATIONS =====================
export async function fetchStorageLocations(): Promise<StorageLocation[]> {
  try {
    const list = await fetchSupabaseJson<StorageLocation[]>(LOCATIONS_KEY, []);
    if (list && list.length > 0) return list;
    const fallback = initialData.locations || [];
    if (fallback.length > 0) {
      await saveStorageLocations(fallback);
      return fallback;
    }
    return [];
  } catch (err) {
    console.error('[InventoryService] Error fetching locations:', err);
    return initialData.locations || [];
  }
}

export async function saveStorageLocations(records: StorageLocation[]): Promise<boolean> {
  return await saveSupabaseJson<StorageLocation[]>(
    LOCATIONS_KEY,
    'Ashley Warehouse Storage Locations & Racks',
    records
  );
}

// ===================== ITEM CATEGORIES =====================
export async function fetchItemCategories(): Promise<ItemCategory[]> {
  try {
    const list = await fetchSupabaseJson<ItemCategory[]>(CATEGORIES_KEY, []);
    if (list && list.length > 0) return list;
    const fallback = initialData.itemCategories || [];
    if (fallback.length > 0) {
      await saveItemCategories(fallback);
      return fallback;
    }
    return [];
  } catch (err) {
    console.error('[InventoryService] Error fetching categories:', err);
    return initialData.itemCategories || [];
  }
}

export async function saveItemCategories(records: ItemCategory[]): Promise<boolean> {
  return await saveSupabaseJson<ItemCategory[]>(
    CATEGORIES_KEY,
    'Ashley Item Categories',
    records
  );
}

// ===================== WAREHOUSE MAPS =====================
export async function fetchWarehouseMaps(): Promise<WarehouseMap[]> {
  try {
    const list = await fetchSupabaseJson<WarehouseMap[]>(WAREHOUSE_MAPS_KEY, []);
    if (list && list.length > 0) return list;
    const fallback = initialData.warehouseMaps || [];
    if (fallback.length > 0) {
      await saveWarehouseMaps(fallback);
      return fallback;
    }
    return [];
  } catch (err) {
    console.error('[InventoryService] Error fetching warehouse maps:', err);
    return initialData.warehouseMaps || [];
  }
}

export async function saveWarehouseMaps(records: WarehouseMap[]): Promise<boolean> {
  return await saveSupabaseJson<WarehouseMap[]>(
    WAREHOUSE_MAPS_KEY,
    'Ashley 2D/3D Warehouse Layout Maps',
    records
  );
}

// ===================== SOLD ITEMS LISTS =====================
export async function fetchSoldItemsLists(): Promise<SoldItemsList[]> {
  try {
    const list = await fetchSupabaseJson<SoldItemsList[]>(SOLD_ITEMS_KEY, []);
    if (list && list.length > 0) return list;
    const fallback = initialData.soldItemsLists || [];
    if (fallback.length > 0) {
      await saveSoldItemsLists(fallback);
      return fallback;
    }
    return [];
  } catch (err) {
    console.error('[InventoryService] Error fetching sold items:', err);
    return initialData.soldItemsLists || [];
  }
}

export async function saveSoldItemsLists(records: SoldItemsList[]): Promise<boolean> {
  return await saveSupabaseJson<SoldItemsList[]>(
    SOLD_ITEMS_KEY,
    'Ashley Sold Items Archive',
    records
  );
}
