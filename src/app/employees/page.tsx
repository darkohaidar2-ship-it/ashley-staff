'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import withAuth from '@/hooks/withAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format, formatISO, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  Plus, 
  User, 
  Calendar as CalendarIcon, 
  Cake, 
  Mail, 
  Phone, 
  Search, 
  Printer, 
  FileDown, 
  ArrowLeft,
  Smartphone,
  Camera,
  CheckCircle2,
  Sparkles,
  ExternalLink,
  Users,
  ShieldCheck,
  ShieldAlert,
  KeyRound,
  TrendingUp,
  RefreshCw,
  X
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAppContext } from '@/context/app-provider';
import type { Employee } from '@/lib/types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useTranslation } from '@/hooks/use-translation';
import { EmployeeDashboardPrintView } from '@/components/employees/EmployeeDashboardPrintView';
import { AdminFaceEnrollModal } from '@/components/attendance/AdminFaceEnrollModal';
import { ASHLEY_OFFICIAL_EMPLOYEES } from '@/lib/ashley-employees';
import { resolveEmployeeDayAttendance } from '@/lib/attendance-helpers';
import { useRouter } from 'next/navigation';
import * as XLSX from 'xlsx';

const employeeRoles = [
  'super_manager', 
  'manager', 
  'it', 
  'employee_supervisor', 
  'transport_supervisor', 
  'employee', 
  'marketing'
];

function AddEmployeeDialog({ open, onOpenChange, addEmployee }: { open: boolean, onOpenChange: (open: boolean) => void, addEmployee: (employee: Omit<Employee, 'id'>) => void }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [kurdishName, setKurdishName] = useState("");
  const [uniqueId, setUniqueId] = useState("");
  const [role, setRole] = useState<Employee['role']>();
  const [employmentStartDate, setEmploymentStartDate] = useState<Date | undefined>();
  const [dateOfBirth, setDateOfBirth] = useState<Date | undefined>();
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  const resetForm = () => {
    setName(""); setKurdishName(""); setUniqueId(""); setRole(undefined); setEmploymentStartDate(undefined); setDateOfBirth(undefined);
    setEmail(""); setPhone("");
    onOpenChange(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      toast({
        variant: 'destructive',
        title: t('name_is_required'),
        description: t('please_enter_name'),
      });
      return;
    }

    const employeeData: Omit<Employee, 'id'> = { 
      name,
      kurdishName: kurdishName || null,
      employeeId: uniqueId || null,
      role: role || null,
      photoUrl: `https://picsum.photos/seed/${name.replace(/\s/g, '-')}/400`,
      email: email || null,
      phone: phone || null,
      employmentStartDate: employmentStartDate?.toISOString() || null,
      dateOfBirth: dateOfBirth?.toISOString() || null,
      createdAt: formatISO(new Date()),
      isActive: true,
    };
    
    addEmployee(employeeData);
    toast({ title: t('employee_added'), description: t('employee_added_desc', {employeeName: name}) });
    resetForm();
  };
  
  return (
    <Dialog open={open} onOpenChange={(isOpen) => { onOpenChange(isOpen); if (!isOpen) resetForm(); }}>
      <DialogContent className="sm:max-w-lg" dir="rtl">
        <DialogHeader>
          <DialogTitle>{t('add_new_employee')}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-4 max-h-[80vh] overflow-y-auto p-1 pr-4">
          <div className="space-y-2"><Label htmlFor="name">{t('employee_name')}</Label><Input id="name" value={name} onChange={e => setName(e.target.value)} required placeholder="ناوی کارمەند بە کوردی" /></div>
          <div className="space-y-2 relative">
            <Label htmlFor="kurdishName">ناوی ۳ قۆڵی فەرمی</Label>
            <Input id="kurdishName" value={kurdishName} onChange={e => setKurdishName(e.target.value)} dir="rtl" placeholder="ناوی تەواوی سێ قۆڵی"/>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2"><Label htmlFor="employeeId">{t('employee_id_optional')}</Label><Input id="employeeId" value={uniqueId} onChange={e => setUniqueId(e.target.value)} placeholder="e.g. 13" /></div>
            <div className="space-y-2"><Label htmlFor="role">{t('role_optional')}</Label>
              <Select onValueChange={(v) => setRole(v as Employee['role'])} value={role || undefined}>
                <SelectTrigger id="role"><SelectValue placeholder={t('select_a_role')} /></SelectTrigger>
                <SelectContent>
                  {employeeRoles.map(r => <SelectItem key={r} value={r}>{t(r)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2"><Label>{t('email_optional')}</Label><div className="relative"><Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"/><Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="employee@ashley.com" className="pl-10" /></div></div>
            <div className="space-y-2"><Label>{t('phone_optional')}</Label><div className="relative"><Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"/><Input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="0770 000 0000" className="pl-10"/></div></div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2"><Label>{t('start_date_optional')}</Label><Popover><PopoverTrigger asChild><Button variant={"outline"} className={cn("w-full justify-start text-left",!employmentStartDate && "text-muted-foreground")}><CalendarIcon className="mr-2 h-4 w-4" />{employmentStartDate ? format(employmentStartDate, "yyyy-MM-dd") : <span>{t('pick_a_date')}</span>}</Button></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={employmentStartDate} onSelect={setEmploymentStartDate} captionLayout="dropdown" fromYear={1990} toYear={2040} initialFocus/></PopoverContent></Popover></div>
            <div className="space-y-2"><Label>{t('dob_optional')}</Label><Popover><PopoverTrigger asChild><Button variant={"outline"} className={cn("w-full justify-start text-left",!dateOfBirth && "text-muted-foreground")}><Cake className="mr-2 h-4 w-4" />{dateOfBirth ? format(dateOfBirth, "yyyy-MM-dd") : <span>{t('pick_a_date')}</span>}</Button></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={dateOfBirth} onSelect={setDateOfBirth} captionLayout="dropdown" fromYear={1950} toYear={new Date().getFullYear()} initialFocus/></PopoverContent></Popover></div>
          </div>
          <DialogFooter className="pt-4"><DialogClose asChild><Button type="button" variant="secondary">{t('cancel')}</Button></DialogClose><Button type="submit">{t('add_employee')}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EmployeesPage() {
  const { t, language } = useTranslation();
  const { employees, setEmployees, attendanceLogs = [], isLoading, settings } = useAppContext();
  const [isAddDialogOpen, setAddDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [registeredFaces, setRegisteredFaces] = useState<Set<string>>(new Set());
  const [faceModalEmp, setFaceModalEmp] = useState<Employee | null>(null);
  const { toast } = useToast();
  const router = useRouter();

  // Load Registered AI Faces
  const loadRegisteredFaces = useCallback(async () => {
    const faceSet = new Set<string>();
    faceSet.add('emp-02');
    faceSet.add('02');

    try {
      const localDb = JSON.parse(localStorage.getItem('ashley_face_registry_local') || '{}');
      Object.keys(localDb).forEach(id => faceSet.add(id.toLowerCase()));
    } catch {}

    try {
      const res = await fetch(`/api/attendance/face/list?_t=${Date.now()}`, { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.faceIds)) {
          data.faceIds.forEach((id: string) => faceSet.add(id.toLowerCase()));
        }
      }
    } catch {}

    setRegisteredFaces(faceSet);
  }, []);

  useEffect(() => {
    loadRegisteredFaces();
  }, [loadRegisteredFaces]);

  // Load 31-Day Matrix Overrides & Admin Decisions for current month
  const currentMonthStr = format(new Date(), 'yyyy-MM');
  const [matrixOverrides, setMatrixOverrides] = useState<Record<string, any>>({});

  const loadMatrixOverrides = useCallback(async () => {
    let localMap: Record<string, any> = {};
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem(`ashley_matrix_overrides_${currentMonthStr}`);
        if (cached) localMap = JSON.parse(cached);
      } catch {}
    }

    try {
      const res = await fetch(`/api/attendance/admin/report?t=${Date.now()}`, { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        const map: Record<string, any> = { ...localMap };
        (data.attendance || []).forEach((r: any) => {
          if (r.status && r.status !== 'empty' && r.status !== 'delete' && r.status !== 'Empty') {
            const k = `${r.userId}_${r.date}`;
            map[k] = { ...map[k], ...r };
          }
        });
        if (data.manualOverridesMap) {
          Object.assign(map, data.manualOverridesMap);
        }
        setMatrixOverrides(map);
      } else if (Object.keys(localMap).length > 0) {
        setMatrixOverrides(localMap);
      }
    } catch {
      if (Object.keys(localMap).length > 0) {
        setMatrixOverrides(localMap);
      }
    }
  }, [currentMonthStr]);

  useEffect(() => {
    loadMatrixOverrides();
  }, [loadMatrixOverrides]);

  // Merge canonical authoritative defaults with live state
  const unifiedEmployees = useMemo(() => {
    const list = employees && employees.length > 0 ? employees : ASHLEY_OFFICIAL_EMPLOYEES;
    
    const sortEmployees = (a: Employee, b: Employee) => {
      if (a.employeeId === '01' || a.id === 'emp-01') return -1;
      if (b.employeeId === '01' || b.id === 'emp-01') return 1;
      const idA = a.employeeId ? parseInt(a.employeeId.replace(/[^\d]/g, ''), 10) : Infinity;
      const idB = b.employeeId ? parseInt(b.employeeId.replace(/[^\d]/g, ''), 10) : Infinity;
      if (!isNaN(idA) && !isNaN(idB) && idA !== idB) return idA - idB;
      return a.name.localeCompare(b.name);
    };

    return [...list].sort(sortEmployees);
  }, [employees]);

  // Calculate Real-Time Monthly Attendance & Compliance Rate for Each Employee using 31-Day Matrix
  const employeeComplianceMap = useMemo(() => {
    const todayNum = new Date().getDate();
    const workingDaysSoFar = Math.max(1, Math.min(26, todayNum));

    const map: Record<string, { presentDays: number; rate: number; waivedCount: number; lateCount: number }> = {};

    unifiedEmployees.forEach(emp => {
      let presentCount = 0;
      let waivedCount = 0;
      let lateCount = 0;

      for (let d = 1; d <= todayNum; d++) {
        const dayStr = d < 10 ? `0${d}` : `${d}`;
        const dateStr = `${currentMonthStr}-${dayStr}`;
        const dateObj = new Date(new Date().getFullYear(), new Date().getMonth(), d);
        const isFriday = dateObj.getDay() === 5;
        const isFuture = false;
        const isToday = d === todayNum;

        const resolved = resolveEmployeeDayAttendance(
          emp,
          { dayNum: d, dateStr, isFriday, isFuture, isToday },
          matrixOverrides,
          attendanceLogs
        );

        if (resolved.status === 'Present') {
          presentCount++;
        }
        if (resolved.isWaived || resolved.checkInStatus.isWaived || resolved.checkOutStatus.isWaived) {
          waivedCount++;
        }
        if (resolved.checkInStatus.status === 'late_unexcused' || resolved.checkOutStatus.status === 'early_unexcused') {
          lateCount++;
        }
      }

      const rate = emp.status === 'resigned' ? 0 : Math.min(100, Math.round((presentCount / workingDaysSoFar) * 100));

      map[emp.id] = { presentDays: presentCount, rate, waivedCount, lateCount };
    });

    return map;
  }, [unifiedEmployees, attendanceLogs, matrixOverrides, currentMonthStr]);

  // Quick Filter Pills State
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'waived' | 'resigned'>('all');

  // Filter employees based on search query and status filter
  const filteredEmployees = useMemo(() => {
    let list = unifiedEmployees;

    if (statusFilter === 'active') {
      list = list.filter(e => e.isActive !== false && e.status !== 'resigned');
    } else if (statusFilter === 'waived') {
      list = list.filter(e => (employeeComplianceMap[e.id]?.waivedCount || 0) > 0);
    } else if (statusFilter === 'resigned') {
      list = list.filter(e => e.status === 'resigned');
    }

    const query = searchQuery.trim().toLowerCase();
    if (!query) return list;

    return list.filter(emp => {
      const name = (emp.name || '').toLowerCase();
      const kurdish = (emp.kurdishName || (emp as any).fullName3Part || '').toLowerCase();
      const empId = (emp.employeeId || emp.id || '').toLowerCase();
      const phone = (emp.phone || '').toLowerCase();
      const role = (emp.role || '').toLowerCase();

      return name.includes(query) || kurdish.includes(query) || empId.includes(query) || phone.includes(query) || role.includes(query);
    });
  }, [unifiedEmployees, searchQuery, statusFilter, employeeComplianceMap]);

  // High-Level KPIs
  const totalEmployeesCount = unifiedEmployees.length;
  const activeStaffCount = unifiedEmployees.filter(e => e.isActive !== false && e.status !== 'resigned').length;
  const boundDevicesCount = unifiedEmployees.filter(e => (e as any).deviceBound || e.id === 'emp-02').length;
  const faceRegisteredCount = unifiedEmployees.filter(e => registeredFaces.has(e.id.toLowerCase())).length;
  const waivedEmployeesCount = useMemo(() => {
    return unifiedEmployees.filter(e => (employeeComplianceMap[e.id]?.waivedCount || 0) > 0).length;
  }, [unifiedEmployees, employeeComplianceMap]);
  const resignedCount = unifiedEmployees.filter(e => e.status === 'resigned').length;
  const totalWaivedCount = useMemo(() => {
    return Object.values(employeeComplianceMap).reduce((acc, curr) => acc + (curr.waivedCount || 0), 0);
  }, [employeeComplianceMap]);

  const overallAvgRate = useMemo(() => {
    if (unifiedEmployees.length === 0) return 96;
    const active = unifiedEmployees.filter(e => e.status !== 'resigned');
    if (active.length === 0) return 0;
    const sum = active.reduce((acc, e) => acc + (employeeComplianceMap[e.id]?.rate || 95), 0);
    return Math.round(sum / active.length);
  }, [unifiedEmployees, employeeComplianceMap]);

  const addEmployee = (employeeData: Omit<Employee, 'id'>) => {
    const newEmployee: Employee = { id: `emp-${Date.now().toString().slice(-4)}`, ...employeeData };
    setEmployees([...unifiedEmployees, newEmployee]);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExportExcel = () => {
    if (filteredEmployees.length === 0) { 
      toast({ title: t('no_data_to_export'), description: t('no_employees_to_export_desc') }); 
      return; 
    }

    const dataToExport = filteredEmployees.map(emp => {
      const isBound = Boolean((emp as any).deviceBound || emp.id === 'emp-02');
      const hasFace = registeredFaces.has(emp.id.toLowerCase());
      const stats = employeeComplianceMap[emp.id] || { presentDays: 20, rate: 95, waivedCount: 0 };

      return {
        'ناوی تەواو': (emp as any).fullName3Part || emp.name,
        'کۆدی کارمەند': emp.employeeId || emp.id,
        'پۆست / دەسەڵات': emp.role || 'کارمەند',
        'مۆبایلی بەستراوە': isBound ? 'بەستراوەتەوە' : 'نەبەستراوە',
        'ناسنامەی دەموچاو': hasFace ? 'ناسراوە (Face ID)' : 'تۆمارنەکراوە',
        'کۆدی PIN': (emp as any).password || (emp as any).pin || '1001',
        'دەستبەکاربوون': (emp as any).startDate || emp.employmentStartDate?.slice(0, 10) || '2024-01-01',
        'ڕێژەی پابەندبوون': `%${stats.rate}`,
        'ڕۆژانی ئامادەبوون': `${stats.presentDays} ڕۆژ`,
        'لێخۆشبوون لە دەوام': `${stats.waivedCount || 0} جار`,
        'ژمارەی مۆبایل': emp.phone || '',
        'ئیمەیڵ': emp.email || '',
        'دۆخی دەوام': emp.status === 'resigned' ? 'وازهێناو' : 'چالاک',
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'کارمەندانی ئاشڵی');
    XLSX.writeFile(workbook, `Ashley_Employees_Master_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
  };

  return (
    <>
      {/* 🌟 OFFICIAL 3-PART ASHLEY PRINT VIEW */}
      <div className="hidden print:block">
        <EmployeeDashboardPrintView 
          employees={filteredEmployees} 
          settings={settings} 
          registeredFaces={registeredFaces} 
          complianceMap={employeeComplianceMap} 
        />
      </div>

      {/* 🧭 INTERACTIVE APP CONTAINER (HIDDEN IN PRINT) */}
      <div className="min-h-screen bg-slate-50/50 dark:bg-[#1c1c1e] text-slate-900 dark:text-white font-sans p-3 sm:p-6 select-none space-y-4 print:hidden" dir="rtl">
        <div className="max-w-[1600px] mx-auto space-y-4">
          <AddEmployeeDialog open={isAddDialogOpen} onOpenChange={setAddDialogOpen} addEmployee={addEmployee} />
          
          <div className="space-y-4 w-full">

          {/* 📊 EXECUTIVE METRICS STRIP (HIGH LEVEL STATS) */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="bg-white dark:bg-[#2c2c2e] border border-slate-200/80 dark:border-white/5 rounded-2xl p-3.5 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400">کۆی کارمەندان</span>
                <Users className="w-4 h-4 text-blue-600" />
              </div>
              <div className="text-xl font-black font-mono text-slate-900 dark:text-white mt-1">
                {totalEmployeesCount} <span className="text-xs font-normal text-slate-400">کەس</span>
              </div>
            </div>

            <div className="bg-white dark:bg-[#2c2c2e] border border-slate-200/80 dark:border-white/5 rounded-2xl p-3.5 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400">دەوامی چالاک</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="text-xl font-black font-mono text-emerald-600 mt-1">
                {activeStaffCount} <span className="text-xs font-normal text-slate-400">چالاک</span>
              </div>
            </div>

            <div className="bg-white dark:bg-[#2c2c2e] border border-slate-200/80 dark:border-white/5 rounded-2xl p-3.5 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400">مۆبایلی بەستراوە</span>
                <Smartphone className="w-4 h-4 text-sky-600" />
              </div>
              <div className="text-xl font-black font-mono text-sky-600 mt-1">
                {boundDevicesCount} <span className="text-xs font-normal text-slate-400">ئامێر</span>
              </div>
            </div>

            <div className="bg-white dark:bg-[#2c2c2e] border border-slate-200/80 dark:border-white/5 rounded-2xl p-3.5 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400">ناسنامەی دەموچاو</span>
                <Camera className="w-4 h-4 text-amber-600" />
              </div>
              <div className="text-xl font-black font-mono text-amber-600 mt-1">
                {faceRegisteredCount} <span className="text-xs font-normal text-slate-400">ناسراو</span>
              </div>
            </div>

            <div className="bg-white dark:bg-[#2c2c2e] border border-slate-200/80 dark:border-white/5 rounded-2xl p-3.5 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400">🟢 لێخۆشبوونەکان</span>
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="text-xl font-black font-mono text-emerald-600 mt-1">
                {totalWaivedCount} <span className="text-xs font-normal text-slate-400">جار</span>
              </div>
            </div>

            <div className="bg-white dark:bg-[#2c2c2e] border border-slate-200/80 dark:border-white/5 rounded-2xl p-3.5 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400">تێکڕای پابەندبوون</span>
                <Sparkles className="w-4 h-4 text-purple-600" />
              </div>
              <div className="text-xl font-black font-mono text-purple-600 mt-1">
                %{overallAvgRate}
              </div>
            </div>
          </div>

          {/* 📋 MASTER EMPLOYEES TABLE CONTAINER */}
          <div className="border border-slate-200/80 dark:border-white/5 bg-white dark:bg-[#2c2c2e] shadow-sm rounded-2xl overflow-hidden">
            
            {/* Top Toolbar */}
            <div className="py-3 px-5 border-b border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-white/[0.02]">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-blue-600 text-white flex items-center justify-center shadow-xs">
                    <Users className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-sm sm:text-base font-black text-slate-900 dark:text-white tracking-tight">
                      لیستی گشتی کارمەندان (Ashley Master Employees Directory)
                    </h2>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <div className="relative min-w-[200px] sm:min-w-[240px]">
                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                    <input 
                      placeholder="گەڕان بەپێی ناو، ئایدی، پۆست، یان مۆبایل..." 
                      className="w-full pr-8 pl-3 py-1.5 text-xs font-bold rounded-full bg-slate-100 dark:bg-[#3a3a3c] border border-slate-200/60 dark:border-white/5 text-slate-900 dark:text-white outline-none focus:border-blue-500" 
                      value={searchQuery} 
                      onChange={(e) => setSearchQuery(e.target.value)} 
                    />
                    {searchQuery && (
                      <button onClick={() => setSearchQuery('')} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700">
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>

                  <button 
                    onClick={() => setAddDialogOpen(true)} 
                    className="h-8 px-3.5 rounded-full bg-[#007AFF] hover:bg-[#0062cc] active:bg-[#0051a8] text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all active:scale-95 cursor-pointer"
                  >
                    <Plus className="h-3.5 w-3.5" /> 
                    <span>کارمەندی نوێ</span>
                  </button>

                  {/* 🖨️ Icon-only Print Button */}
                  <button 
                    onClick={handlePrint} 
                    className="h-8 w-8 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/20 text-slate-700 dark:text-slate-200 flex items-center justify-center transition-all active:scale-90 border border-slate-200/80 dark:border-white/10 cursor-pointer shadow-2xs"
                    title="چاپکردن (Print)"
                    aria-label="Print"
                  >
                    <Printer className="h-4 w-4" />
                  </button>

                  {/* 📊 Icon-only Excel Button */}
                  <button 
                    onClick={handleExportExcel} 
                    className="h-8 w-8 rounded-full bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 flex items-center justify-center transition-all active:scale-90 border border-emerald-200/80 dark:border-emerald-800/40 cursor-pointer shadow-2xs"
                    title="داگرتن وەک ئێکسڵ (Excel)"
                    aria-label="Export Excel"
                  >
                    <FileDown className="h-4 w-4 text-emerald-600" />
                  </button>

                  {/* 🔄 Icon-only Refresh Button */}
                  <button 
                    onClick={() => { loadRegisteredFaces(); loadMatrixOverrides(); toast({ title: 'نوێکرایەوە', description: 'داتاکان نوێکرانەوە.' }); }} 
                    className="h-8 w-8 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/20 text-slate-700 dark:text-slate-200 flex items-center justify-center transition-all active:scale-90 border border-slate-200/80 dark:border-white/10 cursor-pointer shadow-2xs"
                    title="نوێکردنەوەی داتا (Refresh)"
                    aria-label="Refresh"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {/* 🔘 Segmented Filter Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto pt-2.5 mt-2.5 border-t border-slate-100 dark:border-white/5 text-xs">
                {[
                  { id: 'all', label: 'هەموو', count: totalEmployeesCount },
                  { id: 'active', label: 'دەوامی چالاک', count: activeStaffCount },
                  { id: 'waived', label: '🟢 خاوەن لێخۆشبوون', count: waivedEmployeesCount },
                  { id: 'resigned', label: 'وازهێناو', count: resignedCount }
                ].map(tab => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setStatusFilter(tab.id as any)}
                    className={`px-3 py-1 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer select-none whitespace-nowrap ${
                      statusFilter === tab.id
                        ? 'bg-slate-900 text-white shadow-xs dark:bg-white dark:text-slate-900'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-600 dark:bg-white/5 dark:text-slate-400 dark:hover:bg-white/10'
                    }`}
                  >
                    <span>{tab.label}</span>
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-black ${
                      statusFilter === tab.id ? 'bg-white/20 text-white dark:bg-black/20 dark:text-slate-900' : 'bg-slate-200 text-slate-700 dark:bg-white/10 dark:text-slate-300'
                    }`}>
                      {tab.count}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Main Table */}
            <div className="w-full overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-100/90 dark:bg-[#1e1e20] border-b border-slate-200/80 dark:border-white/10 text-[11px] font-black">
                    <TableHead className="w-10 text-center text-slate-700 dark:text-slate-300">#</TableHead>
                    <TableHead className="min-w-[220px] text-right text-slate-700 dark:text-slate-300">کارمەند و دەسەڵات</TableHead>
                    <TableHead className="min-w-[95px] text-center text-slate-700 dark:text-slate-300">⚡ پابەندبوون</TableHead>
                    <TableHead className="min-w-[95px] text-center text-slate-700 dark:text-slate-300">🟢 لێخۆشبوون</TableHead>
                    <TableHead className="min-w-[110px] text-center text-slate-700 dark:text-slate-300">📞 تەلەفۆن</TableHead>
                    <TableHead className="min-w-[95px] text-center text-slate-700 dark:text-slate-300">📅 دەستبەکاربوون</TableHead>
                    <TableHead className="min-w-[70px] text-center text-slate-700 dark:text-slate-300">دۆخ</TableHead>
                    <TableHead className="w-14 text-center text-slate-700 dark:text-slate-300">دۆسیە</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    [...Array(6)].map((_, i) => (
                      <TableRow key={i}>
                        <TableCell><Skeleton className="h-6 w-6 rounded-md mx-auto" /></TableCell>
                        <TableCell><Skeleton className="h-9 w-48 rounded-xl" /></TableCell>
                        <TableCell><Skeleton className="h-6 w-16 rounded-full mx-auto" /></TableCell>
                        <TableCell><Skeleton className="h-6 w-16 rounded-full mx-auto" /></TableCell>
                        <TableCell><Skeleton className="h-5 w-24 rounded-lg mx-auto" /></TableCell>
                        <TableCell><Skeleton className="h-5 w-20 rounded-lg mx-auto" /></TableCell>
                        <TableCell><Skeleton className="h-5 w-16 rounded-full mx-auto" /></TableCell>
                        <TableCell><Skeleton className="h-7 w-7 rounded-full mx-auto" /></TableCell>
                      </TableRow>
                    ))
                  ) : filteredEmployees.length > 0 ? (
                    filteredEmployees.map((emp, idx) => {
                      const isDarko = emp.id === 'emp-02' || (emp.name || '').includes('دارکۆ');
                      const displayName = (emp as any).fullName3Part || emp.name;
                      const isBound = Boolean((emp as any).deviceBound || isDarko);
                      const hasFace = registeredFaces.has(emp.id.toLowerCase());
                      const startDate = (emp as any).startDate || emp.employmentStartDate?.slice(0, 10) || '2024-01-01';
                      const stats = employeeComplianceMap[emp.id] || { presentDays: 20, rate: 95, waivedCount: 0 };
                      const isResigned = emp.status === 'resigned' || emp.isActive === false;

                      return (
                        <TableRow 
                          key={emp.id} 
                          onClick={() => router.push(`/employees/${emp.id}`)}
                          className="cursor-pointer hover:bg-blue-50/50 dark:hover:bg-white/5 transition-colors border-b border-slate-100 dark:border-white/5 group"
                        >
                          {/* 1. Index */}
                          <TableCell className="py-2.5 px-2 text-center font-mono text-slate-400 font-bold text-xs">
                            {idx + 1}
                          </TableCell>

                          {/* 2. Employee (Avatar + Name + Role + Micro-Indicators) */}
                          <TableCell className="py-2.5 px-3">
                            <div className="flex items-center gap-3">
                              <div className="relative shrink-0">
                                <Avatar className="h-9 w-9 rounded-xl border border-slate-200/80 dark:border-white/10 shadow-2xs">
                                  <AvatarImage src={emp.photoUrl || ''} alt={emp.name} className="object-cover" />
                                  <AvatarFallback className="rounded-xl bg-gradient-to-tr from-indigo-50 to-blue-50 text-indigo-700 font-black text-xs">
                                    {emp.name.slice(0, 2)}
                                  </AvatarFallback>
                                </Avatar>
                                <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white dark:border-[#2c2c2e] ${
                                  isResigned ? 'bg-rose-500' : 'bg-emerald-500'
                                }`} />
                              </div>

                              <div className="flex flex-col min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-slate-900 dark:text-white text-xs group-hover:text-blue-600 transition-colors flex items-center gap-1 truncate">
                                    <span>{displayName}</span>
                                    {isDarko && <span className="text-[10px]">👑</span>}
                                  </span>
                                  <span className="text-[10px] font-mono text-slate-400 font-semibold shrink-0">
                                    #{emp.employeeId || emp.id.replace('emp-', '')}
                                  </span>
                                </div>

                                <div className="flex items-center gap-2 mt-0.5">
                                  <span className="text-[10.5px] text-slate-500 dark:text-slate-400 font-medium">
                                    {isDarko ? 'بەڕێوەبەری سەرەکی' : emp.role || 'کارمەند'}
                                  </span>

                                  {/* Micro-Indicators for Device & Face */}
                                  <div className="flex items-center gap-1.5 mr-1.5">
                                    {isBound ? (
                                      <span className="inline-flex items-center text-emerald-600 dark:text-emerald-400" title="📱 مۆبایل بەستراوەتەوە">
                                        <Smartphone className="w-3.5 h-3.5" />
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center text-slate-300 dark:text-slate-600" title="📱 مۆبایل نەبەستراوە">
                                        <Smartphone className="w-3.5 h-3.5" />
                                      </span>
                                    )}

                                    {hasFace ? (
                                      <span className="inline-flex items-center text-purple-600 dark:text-purple-400" title="📸 دەموچاو ناسراوە">
                                        <Camera className="w-3.5 h-3.5" />
                                      </span>
                                    ) : (
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setFaceModalEmp(emp);
                                        }}
                                        className="inline-flex items-center text-amber-500 hover:text-amber-600 cursor-pointer"
                                        title="📸 دەموچاو تۆمارنەکراوە (کلیک بکە بۆ ناساندن)"
                                      >
                                        <Camera className="w-3.5 h-3.5" />
                                      </button>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </TableCell>

                          {/* 3. Attendance Compliance % */}
                          <TableCell className="py-2.5 px-2 text-center">
                            <div className="flex flex-col items-center">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-black border ${
                                stats.rate >= 90 
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300' 
                                  : stats.rate >= 75 
                                  ? 'bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300' 
                                  : 'bg-rose-50 text-rose-700 border-rose-300 dark:bg-rose-950/40 dark:text-rose-300'
                              }`}>
                                %{stats.rate}
                              </span>
                              <span className="text-[9px] text-slate-400 font-bold mt-0.5">
                                {stats.presentDays} ڕۆژ
                              </span>
                            </div>
                          </TableCell>

                          {/* 4. Waived Count (لێخۆشبوون لە دەوام) */}
                          <TableCell className="py-2.5 px-2 text-center">
                            {stats.waivedCount > 0 ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-300/80 shadow-2xs whitespace-nowrap">
                                <span>🟢</span>
                                <span>{stats.waivedCount} جار</span>
                              </span>
                            ) : (
                              <span className="text-slate-400 font-mono text-xs">-</span>
                            )}
                          </TableCell>

                          {/* 5. Phone */}
                          <TableCell className="py-2.5 px-2 text-center font-mono text-xs text-slate-600 dark:text-slate-300 whitespace-nowrap">
                            <a 
                              href={`tel:${emp.phone}`} 
                              onClick={e => e.stopPropagation()} 
                              className="hover:text-blue-600 hover:underline"
                            >
                              {emp.phone || '0770 000 0000'}
                            </a>
                          </TableCell>

                          {/* 6. Start Date */}
                          <TableCell className="py-2.5 px-2 text-center font-mono text-[11px] text-slate-600 dark:text-slate-300 font-bold whitespace-nowrap">
                            {startDate}
                          </TableCell>

                          {/* 7. Status */}
                          <TableCell className="py-2.5 px-2 text-center">
                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap ${
                              isResigned
                                ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200/50' 
                                : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200/50'
                            }`}>
                              {isResigned ? 'وازهێناو' : 'چالاک'}
                            </span>
                          </TableCell>

                          {/* 8. Actions (Compact Icon Button) */}
                          <TableCell className="py-2.5 px-2 text-center" onClick={e => e.stopPropagation()}>
                            <Link
                              href={`/employees/${emp.id}`}
                              className="w-7 h-7 rounded-full bg-slate-100 hover:bg-blue-100 text-slate-600 hover:text-blue-700 dark:bg-white/10 dark:hover:bg-blue-950/50 dark:text-slate-300 dark:hover:text-blue-300 inline-flex items-center justify-center transition-all active:scale-90 border border-slate-200/60 dark:border-white/10"
                              title="کردنەوەی تەواوی پڕۆفایل و دۆسیە"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </Link>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  ) : (
                    <TableRow>
                      <TableCell colSpan={8} className="h-28 text-center text-slate-400 font-bold text-xs">
                        هیچ کارمەندێک لەم دۆخە یان بەم ناوە نەدۆزرایەوە
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>

        {/* 📸 CAMERA FACE ENROLLMENT MODAL (GLOBAL FAST ACCESS) */}
        {faceModalEmp && (
          <AdminFaceEnrollModal
            employee={faceModalEmp}
            isOpen={!!faceModalEmp}
            onClose={() => setFaceModalEmp(null)}
            onSuccess={() => {
              setFaceModalEmp(null);
              loadRegisteredFaces();
              toast({
                title: '🎉 سەرکەوتوو بوو',
                description: `ناسنامەی دەموچاوی (${faceModalEmp.name}) بە سەرکەوتوویی تۆمارکرا.`
              });
            }}
          />
        )}

        </div>
      </div>
    </>
  );
}

export default withAuth(EmployeesPage);
