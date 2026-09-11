'use client';

import React, { createContext, useContext, ReactNode, useMemo, useEffect, useState, useCallback } from 'react';
import { 
    supabase, 
    fetchEmployees, 
    saveEmployees, 
    fetchOvertime, 
    saveOvertime, 
    fetchExpenses, 
    saveExpenses, 
    fetchBonuses, 
    saveBonuses, 
    fetchWithdrawals, 
    saveWithdrawals, 
    fetchSalarySettings, 
    saveSalarySettings 
} from '@/lib/supabase';
import { 
    Employee, 
    ExcelFile, 
    Item, 
    StorageLocation, 
    Expense, 
    ExpenseReport,
    Overtime,
    Bonus,
    CashWithdrawal,
    SoldItemsList,
    ItemCategory,
    Transfer,
    ItemForTransfer,
    OrderRequest,
    MarketingFeedback,
    EvaluationQuestion,
    User,
    Role,
    ActivityLog,
    AppSettings,
    WarehouseMap,
    AttendanceRecord,
} from '@/lib/types';
import { initialData, initialSettings } from './initial-data';
import { format } from 'date-fns';

export type ViewMode = 'list' | 'app-icon' | 'small' | 'large';

interface AppState {
    employees: Employee[];
    setEmployees: React.Dispatch<React.SetStateAction<Employee[]>>;
    attendanceLogs: AttendanceRecord[];
    setAttendanceLogs: React.Dispatch<React.SetStateAction<AttendanceRecord[]>>;
    excelFiles: ExcelFile[];
    setExcelFiles: React.Dispatch<React.SetStateAction<ExcelFile[]>>;
    items: Item[];
    setItems: React.Dispatch<React.SetStateAction<Item[]>>;
    locations: StorageLocation[];
    setLocations: React.Dispatch<React.SetStateAction<StorageLocation[]>>;
    expenses: Expense[];
    setExpenses: React.Dispatch<React.SetStateAction<Expense[]>>;
    expenseReports: ExpenseReport[];
    setExpenseReports: React.Dispatch<React.SetStateAction<ExpenseReport[]>>;
    overtime: Overtime[];
    setOvertime: React.Dispatch<React.SetStateAction<Overtime[]>>;
    bonuses: Bonus[];
    setBonuses: React.Dispatch<React.SetStateAction<Bonus[]>>;
    withdrawals: CashWithdrawal[];
    setWithdrawals: React.Dispatch<React.SetStateAction<CashWithdrawal[]>>;
    itemCategories: ItemCategory[];
    setItemCategories: React.Dispatch<React.SetStateAction<ItemCategory[]>>;
    transfers: Transfer[];
    setTransfers: React.Dispatch<React.SetStateAction<Transfer[]>>;
    transferItems: ItemForTransfer[];
    setTransferItems: React.Dispatch<React.SetStateAction<ItemForTransfer[]>>;
    orderRequests: OrderRequest[];
    setOrderRequests: React.Dispatch<React.SetStateAction<OrderRequest[]>>;
    marketingFeedbacks: MarketingFeedback[];
    setMarketingFeedbacks: React.Dispatch<React.SetStateAction<MarketingFeedback[]>>;
    evaluationQuestions: EvaluationQuestion[];
    setEvaluationQuestions: React.Dispatch<React.SetStateAction<EvaluationQuestion[]>>;
    users: User[];
    setUsers: React.Dispatch<React.SetStateAction<User[]>>;
    roles: Role[];
    setRoles: React.Dispatch<React.SetStateAction<Role[]>>;
    soldItemsLists: SoldItemsList[];
    setSoldItemsLists: React.Dispatch<React.SetStateAction<SoldItemsList[]>>;
    activityLogs: ActivityLog[];
    setActivityLogs: React.Dispatch<React.SetStateAction<ActivityLog[]>>;
    warehouseMaps: WarehouseMap[];
    setWarehouseMaps: React.Dispatch<React.SetStateAction<WarehouseMap[]>>;
    settings: AppSettings;
    setSettings: (value: React.SetStateAction<AppSettings>) => Promise<void>;
    isLoading: boolean;
    viewMode: ViewMode;
    setViewMode: (mode: ViewMode) => void;
    dashboardScale: number;
    setDashboardScale: (scale: number) => void;
    exportStateAsJson: () => void;
}

const AppContext = createContext<AppState | undefined>(undefined);

/**
 * Hook for Supabase-backed persistent collections (Zero-latency localStorage cache + Cloud Sync)
 */
function useSupabaseCollection<T extends { id?: string }>(
    key: string,
    fetchFn: () => Promise<T[]>,
    saveFn: (data: T[]) => Promise<boolean>,
    initialFallback: T[]
) {
    const [localData, setLocalData] = useState<T[]>(() => {
        if (typeof window !== 'undefined') {
            const cached = localStorage.getItem(`ashley_sb_${key}`) || localStorage.getItem(`ashley_local_${key}`);
            if (cached) {
                try {
                    const parsed = JSON.parse(cached);
                    if (Array.isArray(parsed) && parsed.length > 0) return parsed;
                } catch {}
            }
        }
        return initialFallback;
    });

    const [isLoading, setIsLoading] = useState(true);

    // Initial fetch from Supabase
    useEffect(() => {
        let mounted = true;
        fetchFn()
            .then((data) => {
                if (!mounted) return;
                if (Array.isArray(data) && data.length > 0) {
                    setLocalData(data);
                    if (typeof window !== 'undefined') {
                        localStorage.setItem(`ashley_sb_${key}`, JSON.stringify(data));
                        localStorage.setItem(`ashley_local_${key}`, JSON.stringify(data));
                    }
                }
            })
            .catch((err) => {
                console.warn(`[Supabase] Error loading ${key}:`, err);
            })
            .finally(() => {
                if (mounted) setIsLoading(false);
            });

        return () => {
            mounted = false;
        };
    }, [key, fetchFn]);

    // Remote sync event listener (dispatched by Supabase Realtime WebSocket)
    useEffect(() => {
        const handleRemoteSync = (e: Event) => {
            const custom = e as CustomEvent<T[]>;
            if (custom.detail && Array.isArray(custom.detail)) {
                setLocalData(custom.detail);
                if (typeof window !== 'undefined') {
                    localStorage.setItem(`ashley_sb_${key}`, JSON.stringify(custom.detail));
                    localStorage.setItem(`ashley_local_${key}`, JSON.stringify(custom.detail));
                }
            }
        };
        window.addEventListener(`ashley_sb_sync_${key}`, handleRemoteSync);
        return () => {
            window.removeEventListener(`ashley_sb_sync_${key}`, handleRemoteSync);
        };
    }, [key]);

    // Optimistic local update + async Supabase save
    const setter = useCallback((newDataOrFn: React.SetStateAction<T[]>) => {
        setLocalData((prev) => {
            const current = prev || [];
            const next = typeof newDataOrFn === 'function' 
                ? (newDataOrFn as (p: T[]) => T[])(current) 
                : newDataOrFn;

            if (typeof window !== 'undefined') {
                localStorage.setItem(`ashley_sb_${key}`, JSON.stringify(next));
                localStorage.setItem(`ashley_local_${key}`, JSON.stringify(next));
            }

            // Asynchronously save to Supabase
            saveFn(next).catch((err) => {
                console.error(`[Supabase] Error saving ${key}:`, err);
            });

            return next;
        });
    }, [key, saveFn]);

    return [localData, setter, isLoading] as const;
}

/**
 * Lightweight local storage hook for auxiliary legacy ERP tables
 */
function useSimpleLocalState<T>(key: string, initialFallback: T[]) {
    const [data, setData] = useState<T[]>(() => {
        if (typeof window !== 'undefined') {
            const cached = localStorage.getItem(`ashley_local_${key}`);
            if (cached) {
                try {
                    return JSON.parse(cached);
                } catch {}
            }
        }
        return initialFallback;
    });

    const setter = useCallback((newDataOrFn: React.SetStateAction<T[]>) => {
        setData((prev) => {
            const next = typeof newDataOrFn === 'function' 
                ? (newDataOrFn as (p: T[]) => T[])(prev) 
                : newDataOrFn;
            if (typeof window !== 'undefined') {
                localStorage.setItem(`ashley_local_${key}`, JSON.stringify(next));
            }
            return next;
        });
    }, [key]);

    return [data, setter, false] as const;
}

export function AppProvider({ children }: { children: ReactNode }) {
    // 1. Core Target Domain 1: Employees Directory (Supabase Powered)
    const [employees, setEmployees, isEmployeesLoading] = useSupabaseCollection<Employee>(
        'employees', 
        fetchEmployees, 
        saveEmployees, 
        initialData.employees
    );

    // 2. Core Target Domain 2: Overtime Management (Supabase Powered)
    const [overtime, setOvertime, isOvertimeLoading] = useSupabaseCollection<Overtime>(
        'overtime', 
        fetchOvertime, 
        saveOvertime, 
        initialData.overtime
    );

    // 3. Core Target Domain 3: Expenses, Bonuses & Cash Withdrawals (Supabase Powered)
    const [expenses, setExpenses, isExpensesLoading] = useSupabaseCollection<Expense>(
        'expenses', 
        fetchExpenses, 
        saveExpenses, 
        initialData.expenses
    );
    const [bonuses, setBonuses, isBonusesLoading] = useSupabaseCollection<Bonus>(
        'bonuses', 
        fetchBonuses, 
        saveBonuses, 
        initialData.bonuses
    );
    const [withdrawals, setWithdrawals, isWithdrawalsLoading] = useSupabaseCollection<CashWithdrawal>(
        'withdrawals', 
        fetchWithdrawals, 
        saveWithdrawals, 
        initialData.withdrawals
    );

    // 4. Attendance Live Logs State
    const [attendanceLogs, setAttendanceLogs] = useState<AttendanceRecord[]>(() => {
        if (typeof window !== 'undefined') {
            const cached = localStorage.getItem('ashley_sb_attendanceLogs') || localStorage.getItem('ashley_local_attendanceLogs');
            if (cached) {
                try {
                    return JSON.parse(cached);
                } catch {}
            }
        }
        return (initialData as any).attendanceLogs || [];
    });

    // Auxiliary Collections (Lightweight client-side fallback)
    const [excelFiles, setExcelFiles] = useSimpleLocalState<ExcelFile>('excelFiles', initialData.excelFiles);
    const [rawItems, setRawItems] = useSimpleLocalState<Item>('items', initialData.items);
    const [locations, setLocations] = useSimpleLocalState<StorageLocation>('locations', initialData.locations);
    const [expenseReports, setExpenseReports] = useSimpleLocalState<ExpenseReport>('expenseReports', initialData.expenseReports);
    const [itemCategories, setItemCategories] = useSimpleLocalState<ItemCategory>('itemCategories', initialData.itemCategories);
    const [transfers, setTransfers] = useSimpleLocalState<Transfer>('transfers', initialData.transfers);
    const [transferItems, setTransferItems] = useSimpleLocalState<ItemForTransfer>('transferItems', initialData.transferItems);
    const [orderRequests, setOrderRequests] = useSimpleLocalState<OrderRequest>('orderRequests', initialData.orderRequests);
    const [marketingFeedbacks, setMarketingFeedbacks] = useSimpleLocalState<MarketingFeedback>('marketingFeedbacks', initialData.marketingFeedbacks);
    const [evaluationQuestions, setEvaluationQuestions] = useSimpleLocalState<EvaluationQuestion>('evaluationQuestions', initialData.evaluationQuestions);
    const [users, setUsers] = useSimpleLocalState<User>('users', initialData.users);
    const [roles, setRoles] = useSimpleLocalState<Role>('roles', initialData.roles);
    const [soldItemsLists, setSoldItemsLists] = useSimpleLocalState<SoldItemsList>('soldItemsLists', initialData.soldItemsLists);
    const [activityLogs, setActivityLogs] = useSimpleLocalState<ActivityLog>('activityLogs', initialData.activityLogs);
    const [warehouseMaps, setWarehouseMaps] = useSimpleLocalState<WarehouseMap>('warehouseMaps', initialData.warehouseMaps);

    // Global Real-Time Supabase Sync Hub (Single Source of Truth)
    useEffect(() => {
        // Clean legacy local storage artifacts
        if (typeof window !== 'undefined') {
            try {
                localStorage.removeItem('ashley_live_checkins');
                Object.keys(localStorage).forEach((k) => {
                    if (
                        k.startsWith('ashley_admin_notes_') ||
                        k.startsWith('ashley_ot_notes_') ||
                        k.startsWith('ashley_deleted_attendance_') ||
                        k.startsWith('ashley_time_override_') ||
                        k.startsWith('ashley_seed_')
                    ) {
                        localStorage.removeItem(k);
                    }
                });
            } catch {}
        }

        let isFetching = false;
        const syncSupabaseAttendance = () => {
            if (isFetching) return;
            if (typeof document !== 'undefined' && document.hidden) return;
            isFetching = true;
            fetch(`/api/attendance/logs?t=${Date.now()}`, { cache: 'no-store' })
                .then((res) => res.json())
                .then((supabaseLogs) => {
                    if (Array.isArray(supabaseLogs)) {
                        setAttendanceLogs(supabaseLogs);
                        if (typeof window !== 'undefined') {
                            localStorage.setItem('ashley_sb_attendanceLogs', JSON.stringify(supabaseLogs));
                            localStorage.setItem('ashley_local_attendanceLogs', JSON.stringify(supabaseLogs));
                        }
                    }
                })
                .catch((err) => console.warn('[Attendance] Realtime sync notice:', err))
                .finally(() => {
                    isFetching = false;
                });
        };

        // Initial Attendance Fetch
        syncSupabaseAttendance();

        // Supabase Realtime WebSocket Subscription (<0.5s push updates)
        const channel = supabase
            .channel('ashley_nexus_realtime_hub')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'attendance' },
                () => syncSupabaseAttendance()
            )
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'attendance_logs' },
                () => syncAttendanceImmediate()
            )
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'warehouses' },
                (payload: any) => {
                    const row = payload?.new;
                    if (!row?.id || !row?.qr_code) return;
                    try {
                        const parsed = JSON.parse(row.qr_code);
                        const eventMap: Record<string, string> = {
                            ashley_employees: 'employees',
                            ashley_overtime: 'overtime',
                            ashley_expenses: 'expenses',
                            ashley_bonuses: 'bonuses',
                            ashley_withdrawals: 'withdrawals',
                        };
                        const targetKey = eventMap[row.id];
                        if (targetKey) {
                            window.dispatchEvent(new CustomEvent(`ashley_sb_sync_${targetKey}`, { detail: parsed }));
                        } else if (row.id === 'ashley_salary_settings') {
                            setLocalSettings((prev) => ({ ...prev, salarySettings: parsed }));
                        }
                    } catch (e) {
                        console.warn('[Realtime] Parse error for warehouse record:', row.id, e);
                    }
                }
            )
            .subscribe();

        function syncAttendanceImmediate() {
            syncSupabaseAttendance();
        }

        const handleVisibilityChange = () => {
            if (typeof document !== 'undefined' && !document.hidden) {
                syncSupabaseAttendance();
            }
        };

        window.addEventListener('ashley_attendance_updated', syncSupabaseAttendance);
        window.addEventListener('storage', syncSupabaseAttendance);
        document.addEventListener('visibilitychange', handleVisibilityChange);

        const interval = setInterval(syncSupabaseAttendance, 45000);

        return () => {
            supabase.removeChannel(channel);
            clearInterval(interval);
            window.removeEventListener('ashley_attendance_updated', syncSupabaseAttendance);
            window.removeEventListener('storage', syncSupabaseAttendance);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, []);

    // Item Location tracking helper
    const items = rawItems;
    const setItems = useCallback((newDataOrFn: React.SetStateAction<Item[]>) => {
        setRawItems(prevItems => {
            const nextItems = typeof newDataOrFn === 'function' 
                ? (newDataOrFn as (prev: Item[]) => Item[])(prevItems) 
                : newDataOrFn;
            
            const prevItemsMap = new Map((prevItems || []).map(item => [item.id, item]));
            
            return nextItems.map(item => {
                const prevItem = prevItemsMap.get(item.id);
                if (!prevItem) return item;
                
                const prevLocIds = prevItem.locationIds || [];
                const nextLocIds = item.locationIds || [];
                
                const prevLocIdsSorted = [...prevLocIds].sort().join(',');
                const nextLocIdsSorted = [...nextLocIds].sort().join(',');
                
                if (prevLocIdsSorted !== nextLocIdsSorted) {
                    if (prevLocIds.length > 0) {
                        const oldLocNames = prevLocIds
                            .map(locId => locations?.find(l => l.id === locId)?.name)
                            .filter(Boolean)
                            .join(', ');
                        
                        if (oldLocNames) {
                            const newHistoryEntry = {
                                locationNames: oldLocNames,
                                updatedAt: new Date().toISOString()
                            };
                            
                            const prevHistory = prevItem.locationHistory || [];
                            const isDuplicate = prevHistory.length > 0 && 
                                prevHistory[prevHistory.length - 1].locationNames === oldLocNames;
                                
                            const locationHistory = isDuplicate 
                                ? prevHistory 
                                : [...prevHistory, newHistoryEntry];
                                
                            return {
                                ...item,
                                locationHistory
                            };
                        }
                    }
                }
                
                if (prevItem.locationHistory && !item.locationHistory) {
                    return {
                        ...item,
                        locationHistory: prevItem.locationHistory
                    };
                }
                
                return item;
            });
        });
    }, [setRawItems, locations]);

    // ViewMode & Scale Settings
    const [viewMode, setViewMode] = useState<ViewMode>(() => {
        if (typeof window !== 'undefined') {
            const cached = localStorage.getItem('ashley_view_mode');
            if (cached === 'standard' || cached === 'compact' || cached === 'extra-large') {
                return 'small';
            }
            return (cached as ViewMode) || 'small';
        }
        return 'small';
    });

    useEffect(() => {
        if (typeof window !== 'undefined') {
            localStorage.setItem('ashley_view_mode', viewMode);
        }
    }, [viewMode]);

    const [dashboardScale, setDashboardScale] = useState<number>(() => {
        if (typeof window !== 'undefined') {
            const cached = localStorage.getItem('ashley_dashboard_scale');
            return cached ? parseInt(cached, 10) : 100;
        }
        return 100;
    });

    useEffect(() => {
        if (typeof window !== 'undefined') {
            localStorage.setItem('ashley_dashboard_scale', dashboardScale.toString());
        }
    }, [dashboardScale]);

    // System Settings (Salary Settings backed by Supabase)
    const [settings, setLocalSettings] = useState<AppSettings>(() => {
        if (typeof window !== 'undefined') {
            const cached = localStorage.getItem('ashley_terminal_settings');
            return cached ? JSON.parse(cached) : initialSettings;
        }
        return initialSettings;
    });

    // Fetch latest salary settings from Supabase on mount
    useEffect(() => {
        fetchSalarySettings()
            .then((sbSalarySettings) => {
                if (sbSalarySettings) {
                    setLocalSettings((prev) => ({
                        ...prev,
                        salarySettings: {
                            ...prev.salarySettings,
                            ...sbSalarySettings,
                        },
                    }));
                }
            })
            .catch(() => {});
    }, []);

    const setSettings = useCallback(async (value: React.SetStateAction<AppSettings>) => {
        setLocalSettings((prev) => {
            const newSettings = typeof value === 'function' ? value(prev) : value;
            if (typeof window !== 'undefined') {
                localStorage.setItem('ashley_terminal_settings', JSON.stringify(newSettings));
            }
            if (newSettings.salarySettings) {
                saveSalarySettings(newSettings.salarySettings).catch(() => {});
            }
            return newSettings;
        });
    }, []);

    const exportStateAsJson = useCallback(() => {
        const data = {
            employees, excelFiles, items, locations, expenses, expenseReports, 
            overtime, bonuses, withdrawals, itemCategories, transfers, 
            transferItems, orderRequests, marketingFeedbacks, 
            evaluationQuestions, users, roles, soldItemsLists, activityLogs, settings
        };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Ashley_Nexus_Backup_${format(new Date(), 'yyyy-MM-dd_HHmm')}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, [employees, excelFiles, items, locations, expenses, expenseReports, overtime, bonuses, withdrawals, itemCategories, transfers, transferItems, orderRequests, marketingFeedbacks, evaluationQuestions, users, roles, soldItemsLists, activityLogs, settings]);

    const isLoading = isEmployeesLoading || isOvertimeLoading || isExpensesLoading || isBonusesLoading || isWithdrawalsLoading;

    const value = useMemo<AppState>(() => ({
        employees, setEmployees, attendanceLogs, setAttendanceLogs, excelFiles, setExcelFiles, items, setItems,
        locations, setLocations, expenses, setExpenses, expenseReports, setExpenseReports,
        overtime, setOvertime, bonuses, setBonuses, withdrawals, setWithdrawals,
        itemCategories, setItemCategories, transfers, setTransfers, transferItems, setTransferItems,
        orderRequests, setOrderRequests, marketingFeedbacks, setMarketingFeedbacks,
        evaluationQuestions, setEvaluationQuestions, users, setUsers, roles, setRoles,
        soldItemsLists, setSoldItemsLists, activityLogs, setActivityLogs,
        warehouseMaps, setWarehouseMaps,
        settings, setSettings, isLoading, viewMode, setViewMode, dashboardScale, setDashboardScale, exportStateAsJson
    }), [employees, setEmployees, attendanceLogs, setAttendanceLogs, excelFiles, setExcelFiles, items, setItems, locations, setLocations, expenses, setExpenses, expenseReports, setExpenseReports, overtime, setOvertime, bonuses, setBonuses, withdrawals, setWithdrawals, itemCategories, setItemCategories, transfers, setTransfers, transferItems, setTransferItems, orderRequests, setOrderRequests, marketingFeedbacks, setMarketingFeedbacks, evaluationQuestions, setEvaluationQuestions, users, setUsers, roles, setRoles, soldItemsLists, setSoldItemsLists, activityLogs, setActivityLogs, warehouseMaps, setWarehouseMaps, settings, setSettings, isLoading, viewMode, setViewMode, dashboardScale, setDashboardScale, exportStateAsJson]);

    return (
        <AppContext.Provider value={value}>
            {children}
        </AppContext.Provider>
    );
}

export function useAppContext() {
    const context = useContext(AppContext);
    if (context === undefined) {
        return {
            employees: [], setEmployees: () => {},
            attendanceLogs: [], setAttendanceLogs: () => {},
            excelFiles: [], setExcelFiles: () => {},
            items: [], setItems: () => {},
            locations: [], setLocations: () => {},
            expenses: [], setExpenses: () => {},
            expenseReports: [], setExpenseReports: () => {},
            overtime: [], setOvertime: () => {},
            bonuses: [], setBonuses: () => {},
            withdrawals: [], setWithdrawals: () => {},
            itemCategories: [], setItemCategories: () => {},
            transfers: [], setTransfers: () => {},
            transferItems: [], setTransferItems: () => {},
            orderRequests: [], setOrderRequests: () => {},
            marketingFeedbacks: [], setMarketingFeedbacks: () => {},
            evaluationQuestions: [], setEvaluationQuestions: () => {},
            users: [], setUsers: () => {},
            roles: [], setRoles: () => {},
            soldItemsLists: [], setSoldItemsLists: () => {},
            activityLogs: [], setActivityLogs: () => {},
            warehouseMaps: [], setWarehouseMaps: () => {},
            settings: initialSettings, setSettings: () => {},
            isLoading: false,
            viewMode: 'desktop', setViewMode: () => {},
            dashboardScale: 1, setDashboardScale: () => {},
            exportStateAsJson: () => {}
        } as unknown as AppState;
    }
    return context;
}
