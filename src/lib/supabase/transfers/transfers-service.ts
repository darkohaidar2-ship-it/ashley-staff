import { fetchSupabaseJson, saveSupabaseJson } from '@/lib/supabase/client';
import type { Transfer, ItemForTransfer, OrderRequest } from '@/lib/types';
import { initialData } from '@/context/initial-data';

export const TRANSFERS_KEY = 'ashley_transfers';
export const TRANSFER_ITEMS_KEY = 'ashley_transfer_items';
export const ORDER_REQUESTS_KEY = 'ashley_order_requests';

// ===================== TRANSFERS =====================
export async function fetchTransfers(): Promise<Transfer[]> {
  try {
    const list = await fetchSupabaseJson<Transfer[]>(TRANSFERS_KEY, []);
    if (list && list.length > 0) return list;
    const fallback = initialData.transfers || [];
    if (fallback.length > 0) {
      await saveTransfers(fallback);
      return fallback;
    }
    return [];
  } catch (err) {
    console.error('[TransfersService] Error fetching transfers:', err);
    return initialData.transfers || [];
  }
}

export async function saveTransfers(records: Transfer[]): Promise<boolean> {
  return await saveSupabaseJson<Transfer[]>(
    TRANSFERS_KEY,
    'Ashley City & Inter-branch Transfers',
    records
  );
}

// ===================== TRANSFER ITEMS =====================
export async function fetchTransferItems(): Promise<ItemForTransfer[]> {
  try {
    const list = await fetchSupabaseJson<ItemForTransfer[]>(TRANSFER_ITEMS_KEY, []);
    if (list && list.length > 0) return list;
    const fallback = initialData.transferItems || [];
    if (fallback.length > 0) {
      await saveTransferItems(fallback);
      return fallback;
    }
    return [];
  } catch (err) {
    console.error('[TransfersService] Error fetching transfer items:', err);
    return initialData.transferItems || [];
  }
}

export async function saveTransferItems(records: ItemForTransfer[]): Promise<boolean> {
  return await saveSupabaseJson<ItemForTransfer[]>(
    TRANSFER_ITEMS_KEY,
    'Ashley Transit Transfer Items',
    records
  );
}

// ===================== ORDER REQUESTS =====================
export async function fetchOrderRequests(): Promise<OrderRequest[]> {
  try {
    const list = await fetchSupabaseJson<OrderRequest[]>(ORDER_REQUESTS_KEY, []);
    if (list && list.length > 0) return list;
    const fallback = initialData.orderRequests || [];
    if (fallback.length > 0) {
      await saveOrderRequests(fallback);
      return fallback;
    }
    return [];
  } catch (err) {
    console.error('[TransfersService] Error fetching order requests:', err);
    return initialData.orderRequests || [];
  }
}

export async function saveOrderRequests(records: OrderRequest[]): Promise<boolean> {
  return await saveSupabaseJson<OrderRequest[]>(
    ORDER_REQUESTS_KEY,
    'Ashley Supply Order Requests',
    records
  );
}
