
'use client';

import React, { createContext, useContext, ReactNode, useMemo, useEffect, useState, useCallback } from 'react';
import { useCollection, useMemoFirebase, collection, doc } from '@/firebase';
import { useFirestore, useUser, useDoc } from '@/firebase';
import { supabase } from '@/lib/supabase';
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
import { setDocumentNonBlocking, deleteDocumentNonBlocking, updateDocumentNonBlocking } from '@/firebase';
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

function useFirestoreCollection<T extends {id: string}>(collectionName: string, initialFallback: T[]) {
    const db = useFirestore();
    
    const collectionRef = useMemoFirebase(() => {
        if (!db) return null;
        return collection(db, collectionName);
    }, [db, collectionName]);
    
    const { data, isLoading } = useCollection<T>(collectionRef);

    const [localData, setLocalData] = useState<T[]>(() => {
        if (typeof window !== 'undefined') {
            const cached = localStorage.getItem(`ashley_local_${collectionName}`);
            return cached ? JSON.parse(cached) : initialFallback;
        }
        return initialFallback;
    });

     useEffect(() => {
        if (data && data.length > 0) {
            setLocalData(data);
            localStorage.setItem(`ashley_local_${collectionName}`, JSON.stringify(data));
        }
    }, [data, collectionName]);
    
    const setter = useCallback((newDataOrFn: React.SetStateAction<T[]>) => {
        const currentData = localData || [];
        const newData = typeof newDataOrFn === 'function' ? (newDataOrFn as (prevState: T[]) => T[])(currentData) : newDataOrFn;

        setLocalData(newData);
        localStorage.setItem(`ashley_local_${collectionName}`, JSON.stringify(newData));

        if (!collectionRef) return;

        const currentDataMap = new Map(currentData.map(item => [item.id, item]));
        const newDataMap = new Map(newData.map(item => [item.id, item]));

        for (const id of currentDataMap.keys()) {
            if (!newDataMap.has(id)) {
                deleteDocumentNonBlocking(doc(collectionRef, id));
            }
        }
        
        for (const [id, item] of newDataMap.entries()) {
            const existingItem = currentDataMap.get(id);
            if (!existingItem) {
                setDocumentNonBlocking(doc(collectionRef, id), item, { merge: false });
            } else if (JSON.stringify(existingItem) !== JSON.stringify(item)) {
                updateDocumentNonBlocking(doc(collectionRef, id), item);
            }
        }
    }, [collectionRef, localData, collectionName]);
    
    return [localData || [], setter, isLoading] as const;
}

export function AppProvider({ children }: { children: ReactNode }) {
    const { isUserLoading } = useUser();
    const db = useFirestore();

    const [employees, setEmployees, isEmployeesLoading] = useFirestoreCollection<Employee>('employees', initialData.employees);
    const [attendanceLogs, setAttendanceLogs, isAttLoading] = useFirestoreCollection<AttendanceRecord>('attendanceLogs', (initialData as any).attendanceLogs || []);
    const [excelFiles, setExcelFiles, isExcelFilesLoading] = useFirestoreCollection<ExcelFile>('excelFiles', initialData.excelFiles);
    const [rawItems, setRawItems, isItemsLoading] = useFirestoreCollection<Item>('items', initialData.items);
    const [locations, setLocations, isLocationsLoading] = useFirestoreCollection<StorageLocation>('locations', initialData.locations);

    // Global Real-Time Supabase Attendance Sync (Single source of truth from Supabase)
    useEffect(() => {
      const syncSupabaseAttendance = () => {
        fetch('/api/attendance/logs')
          .then((res) => res.json())
          .then((supabaseLogs) => {
            if (Array.isArray(supabaseLogs)) {
              setAttendanceLogs(supabaseLogs);
              if (typeof window !== 'undefined') {
                localStorage.setItem('ashley_local_attendanceLogs', JSON.stringify(supabaseLogs));
              }
            }
          })
          .catch((err) => console.error('Supabase real-time sync error:', err));
      };

      // Initial Fetch
      syncSupabaseAttendance();

      // Supabase Realtime WebSocket Subscription (Instant <0.5s push updates)
      const channel = supabase
        .channel('realtime_attendance_sync')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'attendance' },
          (payload) => {
            console.log('Realtime Supabase WebSocket check-in received:', payload);
            syncSupabaseAttendance();
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'attendance_logs' },
          (payload) => {
            console.log('Realtime Supabase logs change received:', payload);
            syncSupabaseAttendance();
          }
        )
        .subscribe();

      // Fallback polling interval (every 8s)
      const interval = setInterval(syncSupabaseAttendance, 8000);

      return () => {
        supabase.removeChannel(channel);
        clearInterval(interval);
      };
    }, [setAttendanceLogs]);

    const items = rawItems;
    const setItems = useCallback((newDataOrFn: React.SetStateAction<Item[]>) => {
        setRawItems(prevItems => {
            const nextItems = typeof newDataOrFn === 'function' 
                ? (newDataOrFn as (prev: Item[]) => Item[])(prevItems) 
                : newDataOrFn;
            
            const prevItemsMap = new Map((prevItems || []).map(item => [item.id, item]));
            
            return nextItems.map(item => {
                const prevItem = prevItemsMap.get(item.id);
                if (!prevItem) {
                    return item;
                }
                
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
    const [expenses, setExpenses, isExpensesLoading] = useFirestoreCollection<Expense>('expenses', initialData.expenses);
    const [expenseReports, setExpenseReports, isExpenseReportsLoading] = useFirestoreCollection<ExpenseReport>('expenseReports', initialData.expenseReports);
    const [overtime, setOvertime, isOvertimeLoading] = useFirestoreCollection<Overtime>('overtime', initialData.overtime);
    const [bonuses, setBonuses, isBonusesLoading] = useFirestoreCollection<Bonus>('bonuses', initialData.bonuses);
    const [withdrawals, setWithdrawals, isWithdrawalsLoading] = useFirestoreCollection<CashWithdrawal>('withdrawals', initialData.withdrawals);
    const [itemCategories, setItemCategories, isItemCategoriesLoading] = useFirestoreCollection<ItemCategory>('itemCategories', initialData.itemCategories);
    const [transfers, setTransfers, isTransfersLoading] = useFirestoreCollection<Transfer>('transfers', initialData.transfers);
    const [transferItems, setTransferItems, isTransferItemsLoading] = useFirestoreCollection<ItemForTransfer>('transferItems', initialData.transferItems);
    const [orderRequests, setOrderRequests, isOrderRequestsLoading] = useFirestoreCollection<OrderRequest>('orderRequests', initialData.orderRequests);
    const [marketingFeedbacks, setMarketingFeedbacks, isMarketingFeedbacksLoading] = useFirestoreCollection<MarketingFeedback>('marketingFeedbacks', initialData.marketingFeedbacks);
    const [evaluationQuestions, setEvaluationQuestions, isEvaluationQuestionsLoading] = useFirestoreCollection<EvaluationQuestion>('evaluationQuestions', initialData.evaluationQuestions);
    const [users, setUsers, isUsersLoading] = useFirestoreCollection<User>('users', initialData.users);
    const [roles, setRoles, isRolesLoading] = useFirestoreCollection<Role>('roles', initialData.roles);
    const [soldItemsLists, setSoldItemsLists, isSoldItemsListsLoading] = useFirestoreCollection<SoldItemsList>('soldItemsLists', initialData.soldItemsLists);
    const [activityLogs, setActivityLogs, isActivityLogsLoading] = useFirestoreCollection<ActivityLog>('activityLogs', initialData.activityLogs);
    const [warehouseMaps, setWarehouseMaps, isWarehouseMapsLoading] = useFirestoreCollection<WarehouseMap>('warehouseMaps', initialData.warehouseMaps);
    
    const settingsDocRef = useMemoFirebase(() => db ? doc(db, 'settings', 'main') : null, [db]);
    const { data: firestoreSettings, isLoading: isSettingsLoading } = useDoc<AppSettings>(settingsDocRef);

    // One-time Win12 settings reset
    useEffect(() => {
        if (typeof window === 'undefined') return;
        const resetKey = 'ashley_win12_reset_v4';
        const hasReset = localStorage.getItem(resetKey);
        if (!hasReset) {
            localStorage.removeItem('ashley_terminal_settings');
            localStorage.removeItem('ashley_view_mode');
            localStorage.removeItem('ashley_dashboard_scale');
            
            if (settingsDocRef) {
                const cleanedSettings = {
                    ...initialSettings,
                    language: 'ku', // Force Kurdish
                    theme: 'light', // Light default
                    customColors: {},
                    sidebar: {
                        fontSize: 12,
                        textTransform: 'none',
                        activeTabBackground: '',
                        activeTabTextColor: '',
                        activeTabBorder: '',
                    },
                    dashboard: {
                        fontSize: 12,
                        cardRadius: 12,
                        titleColor: '220 82% 55%',
                        textColor: '224 71.4% 4.1%',
                        accentColor: '220 13% 91%',
                        textTransform: 'none',
                        activeCardBackground: '',
                        activeCardBorder: '',
                        buttonColor: '',
                        buttonTextColor: '',
                    }
                };
                setDocumentNonBlocking(settingsDocRef, cleanedSettings, { merge: false });
            }
            
            localStorage.setItem(resetKey, 'true');
        }
    }, [settingsDocRef]);
    
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
        localStorage.setItem('ashley_view_mode', viewMode);
    }, [viewMode]);

    const [dashboardScale, setDashboardScale] = useState<number>(() => {
        if (typeof window !== 'undefined') {
            const cached = localStorage.getItem('ashley_dashboard_scale');
            return cached ? parseInt(cached, 10) : 100;
        }
        return 100;
    });

    useEffect(() => {
        localStorage.setItem('ashley_dashboard_scale', dashboardScale.toString());
    }, [dashboardScale]);
    
    const [settings, setLocalSettings] = useState<AppSettings>(() => {
        if (typeof window !== 'undefined') {
            const cached = localStorage.getItem('ashley_terminal_settings');
            return cached ? JSON.parse(cached) : initialSettings;
        }
        return initialSettings;
    });
    
    useEffect(() => {
        if (firestoreSettings) {
            const mergedSettings: AppSettings = {
                ...initialSettings,
                ...firestoreSettings,
                pdfSettings: {
                    ...initialSettings.pdfSettings,
                    ...(firestoreSettings.pdfSettings || {}),
                },
                lightThemeColors: { ...initialSettings.lightThemeColors, ...(firestoreSettings.lightThemeColors || {}) },
                darkThemeColors: { ...initialSettings.darkThemeColors, ...(firestoreSettings.darkThemeColors || {}) },
                salarySettings: { ...initialSettings.salarySettings, ...(firestoreSettings.salarySettings || {}) },
                sidebar: { ...initialSettings.sidebar, ...(firestoreSettings.sidebar || {}) },
                dashboard: { ...initialSettings.dashboard, ...(firestoreSettings.dashboard || {}) },
                translations: {
                    en: { ...initialSettings.translations.en, ...(firestoreSettings.translations?.en || {}) },
                    ku: { ...initialSettings.translations.ku, ...(firestoreSettings.translations?.ku || {}) },
                },
            };
            setLocalSettings(mergedSettings);
            localStorage.setItem('ashley_terminal_settings', JSON.stringify(mergedSettings));
        }
    }, [firestoreSettings]);



    const setSettings = useCallback(async (value: React.SetStateAction<AppSettings>) => {
        const newSettings = value instanceof Function ? value(settings) : value;
        setLocalSettings(newSettings); 
        localStorage.setItem('ashley_terminal_settings', JSON.stringify(newSettings));
        if (settingsDocRef) {
            setDocumentNonBlocking(settingsDocRef, JSON.parse(JSON.stringify(newSettings)), { merge: true });
        }
    }, [settingsDocRef, settings]);

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
    
    const isLoading = isUserLoading || isSettingsLoading;

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


