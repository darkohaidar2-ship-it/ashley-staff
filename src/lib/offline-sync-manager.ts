/**
 * 🛰️ OFFLINE SYNC MANAGER FOR ASHLEY STAFF
 * Handles local offline storage & auto-syncing of Punches, Expenses, and Leaves
 * when internet connectivity is lost and restored.
 */

export interface OfflinePunchItem {
  id: string;
  employeeId: string;
  employeeName: string;
  punchType: 'check_in' | 'check_out';
  lat: number;
  lng: number;
  distanceMeters?: number;
  locationName?: string;
  offlineRecordedAt: string; // ISO string
  timeStr: string;
  dateStr: string;
}

export interface OfflineExpenseItem {
  id: string;
  employeeId: string;
  employeeName: string;
  amount: number;
  category: string;
  note?: string;
  receiptPhotoUrl?: string | null;
  offlineRecordedAt: string;
}

export interface OfflineLeaveItem {
  id: string;
  employeeId: string;
  employeeName: string;
  leaveType: 'hourly' | 'daily';
  targetDate: string;
  reason: string;
  notes?: string;
  offlineRecordedAt: string;
}

const STORAGE_KEYS = {
  PUNCHES: 'ashley_offline_punches_queue',
  EXPENSES: 'ashley_offline_expenses_queue',
  LEAVES: 'ashley_offline_leaves_queue',
};

// -------------------------------------------------------------
// 1. PUNCHES QUEUE
// -------------------------------------------------------------
export function getOfflinePunches(): OfflinePunchItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.PUNCHES);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.warn('[OfflineSync] Error reading punches queue:', e);
    return [];
  }
}

function notifyQueueChange(): void {
  if (typeof window !== 'undefined') {
    try {
      window.dispatchEvent(new CustomEvent('ashley_offline_changed'));
    } catch (e) {}
  }
}

export function queueOfflinePunch(item: OfflinePunchItem): void {
  if (typeof window === 'undefined') return;
  try {
    const existing = getOfflinePunches();
    // Prevent duplicate entries for same punchType within 5 minutes
    const isDup = existing.some(
      p => p.employeeId === item.employeeId && p.punchType === item.punchType && p.dateStr === item.dateStr
    );
    if (!isDup) {
      existing.push(item);
      localStorage.setItem(STORAGE_KEYS.PUNCHES, JSON.stringify(existing));
      notifyQueueChange();
    }
  } catch (e) {
    console.error('[OfflineSync] Error saving offline punch:', e);
  }
}

export function removeOfflinePunch(id: string): void {
  if (typeof window === 'undefined') return;
  try {
    const existing = getOfflinePunches().filter(p => p.id !== id);
    localStorage.setItem(STORAGE_KEYS.PUNCHES, JSON.stringify(existing));
    notifyQueueChange();
  } catch (e) {}
}

// -------------------------------------------------------------
// 2. EXPENSES QUEUE
// -------------------------------------------------------------
export function getOfflineExpenses(): OfflineExpenseItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.EXPENSES);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

export function queueOfflineExpense(item: OfflineExpenseItem): void {
  if (typeof window === 'undefined') return;
  try {
    const existing = getOfflineExpenses();
    existing.push(item);
    localStorage.setItem(STORAGE_KEYS.EXPENSES, JSON.stringify(existing));
    notifyQueueChange();
  } catch (e) {}
}

export function removeOfflineExpense(id: string): void {
  if (typeof window === 'undefined') return;
  try {
    const existing = getOfflineExpenses().filter(p => p.id !== id);
    localStorage.setItem(STORAGE_KEYS.EXPENSES, JSON.stringify(existing));
    notifyQueueChange();
  } catch (e) {}
}

// -------------------------------------------------------------
// 3. LEAVES QUEUE
// -------------------------------------------------------------
export function getOfflineLeaves(): OfflineLeaveItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.LEAVES);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

export function queueOfflineLeave(item: OfflineLeaveItem): void {
  if (typeof window === 'undefined') return;
  try {
    const existing = getOfflineLeaves();
    existing.push(item);
    localStorage.setItem(STORAGE_KEYS.LEAVES, JSON.stringify(existing));
    notifyQueueChange();
  } catch (e) {}
}

export function removeOfflineLeave(id: string): void {
  if (typeof window === 'undefined') return;
  try {
    const existing = getOfflineLeaves().filter(p => p.id !== id);
    localStorage.setItem(STORAGE_KEYS.LEAVES, JSON.stringify(existing));
    notifyQueueChange();
  } catch (e) {}
}

// -------------------------------------------------------------
// 4. PENDING COUNT
// -------------------------------------------------------------
export function getPendingOfflineCount(): number {
  return getOfflinePunches().length + getOfflineExpenses().length + getOfflineLeaves().length;
}

// -------------------------------------------------------------
// 5. MASTER AUTO-SYNC RUNNER
// -------------------------------------------------------------
export async function syncAllOfflineData(): Promise<{
  punchesSynced: number;
  expensesSynced: number;
  leavesSynced: number;
  totalSynced: number;
}> {
  if (typeof window === 'undefined' || !navigator.onLine) {
    return { punchesSynced: 0, expensesSynced: 0, leavesSynced: 0, totalSynced: 0 };
  }

  let punchesSynced = 0;
  let expensesSynced = 0;
  let leavesSynced = 0;

  // A. Sync Offline Punches
  const punches = getOfflinePunches();
  for (const p of punches) {
    try {
      const res = await fetch('/api/mobile/punch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeId: p.employeeId,
          employeeName: p.employeeName,
          punchType: p.punchType,
          lat: p.lat,
          lng: p.lng,
          offlineRecordedAt: p.offlineRecordedAt,
        }),
      });
      const data = await res.json();
      // If success or duplicate already accepted, clean from queue
      if (data.success || data.reason === 'ALREADY_CHECKED_IN' || data.reason === 'ALREADY_CHECKED_OUT') {
        removeOfflinePunch(p.id);
        punchesSynced++;
      }
    } catch (err) {
      console.warn('[OfflineSync] Punch sync network fail, will retry later:', err);
      break; // Stop further requests if network drops again
    }
  }

  // B. Sync Offline Expenses
  const expenses = getOfflineExpenses();
  for (const exp of expenses) {
    try {
      const res = await fetch('/api/mobile/expense', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeId: exp.employeeId,
          employeeName: exp.employeeName,
          amount: exp.amount,
          category: exp.category,
          note: exp.note,
          receiptPhotoUrl: exp.receiptPhotoUrl,
        }),
      });
      const data = await res.json();
      if (data.success) {
        removeOfflineExpense(exp.id);
        expensesSynced++;
      }
    } catch (err) {
      break;
    }
  }

  // C. Sync Offline Leaves
  const leaves = getOfflineLeaves();
  for (const l of leaves) {
    try {
      const res = await fetch('/api/mobile/leave', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeId: l.employeeId,
          employeeName: l.employeeName,
          leaveType: l.leaveType,
          targetDate: l.targetDate,
          reason: l.reason,
          notes: l.notes,
        }),
      });
      const data = await res.json();
      if (data.success) {
        removeOfflineLeave(l.id);
        leavesSynced++;
      }
    } catch (err) {
      break;
    }
  }

  return {
    punchesSynced,
    expensesSynced,
    leavesSynced,
    totalSynced: punchesSynced + expensesSynced + leavesSynced,
  };
}

// -------------------------------------------------------------
// 6. LOCALSTORAGE CACHE HELPERS (Offline Mode)
// -------------------------------------------------------------
const CACHE_KEYS = {
  TODAY: (empId: string) => `ashley_cache_today_${empId}`,
  STATS: (empId: string) => `ashley_cache_stats_${empId}`,
  SECTIONS: (empId: string) => `ashley_cache_sections_${empId}`,
  EXPENSES: (empId: string) => `ashley_cache_expenses_${empId}`,
  LEAVES: (empId: string) => `ashley_cache_leaves_${empId}`,
};

export function getCachedTodayInfo(empId: string): any | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(CACHE_KEYS.TODAY(empId));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setCachedTodayInfo(empId: string, data: any): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(CACHE_KEYS.TODAY(empId), JSON.stringify({
      ...data,
      _cachedAt: Date.now(),
    }));
  } catch {}
}

export function getCachedMonthStats(empId: string): any | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(CACHE_KEYS.STATS(empId));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setCachedMonthStats(empId: string, data: any): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(CACHE_KEYS.STATS(empId), JSON.stringify({
      ...data,
      _cachedAt: Date.now(),
    }));
  } catch {}
}

export function getCachedSpecialSections(empId: string): any {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(CACHE_KEYS.SECTIONS(empId));
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function setCachedSpecialSections(empId: string, data: any): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(CACHE_KEYS.SECTIONS(empId), JSON.stringify(data));
  } catch {}
}

export function getCachedExpenses(empId: string): any[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(CACHE_KEYS.EXPENSES(empId));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function setCachedExpenses(empId: string, items: any[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(CACHE_KEYS.EXPENSES(empId), JSON.stringify(items));
  } catch {}
}

export function getCachedLeaves(empId: string): any[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(CACHE_KEYS.LEAVES(empId));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function setCachedLeaves(empId: string, items: any[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(CACHE_KEYS.LEAVES(empId), JSON.stringify(items));
  } catch {}
}

// -------------------------------------------------------------
// 7. APPLE HAPTIC FEEDBACK (WWDC Design Foundation)
// -------------------------------------------------------------
export function triggerHaptic(type: 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error' = 'light'): void {
  if (typeof window === 'undefined' || !('vibrate' in navigator)) return;
  try {
    switch (type) {
      case 'light':
        navigator.vibrate(10);
        break;
      case 'medium':
        navigator.vibrate(18);
        break;
      case 'heavy':
        navigator.vibrate(30);
        break;
      case 'success':
        navigator.vibrate([15, 50, 25]);
        break;
      case 'warning':
        navigator.vibrate([25, 60, 25]);
        break;
      case 'error':
        navigator.vibrate([40, 50, 40, 50, 40]);
        break;
    }
  } catch {}
}
