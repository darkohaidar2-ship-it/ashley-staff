
"use client"

import { useState, useMemo, useEffect, useRef } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import withAuth from "@/hooks/withAuth";
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { format, parseISO } from "date-fns"
import { cn } from "@/lib/utils"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { ArrowLeft, Edit, Trash2, Save, X, Upload, Mail, Phone, Cake, Calendar as CalendarIcon, DollarSign, Clock, Gift, Banknote, FileDown, Printer, UserX, User, Loader2 } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'
import { useToast } from "@/hooks/use-toast"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { useAppContext } from "@/context/app-provider"
import type { Employee, Expense, Overtime, Bonus, CashWithdrawal } from "@/lib/types"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useTranslation } from "@/hooks/use-translation"
import { useStorage } from "@/firebase";
import { ref as storageRef, uploadString, getDownloadURL } from 'firebase/storage';
import { EmployeeReportPdf } from "@/components/employees/EmployeeReportPdf";
import { EmployeeActivityChart } from "@/components/employees/EmployeeActivityChart";
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const employeeRoles: Exclude<Employee['role'], null | undefined>[] = [
    'Super Manager', 
    'Manager', 
    'IT', 
    'Employee Supervisor', 
    'Transport Supervisor', 
    'Employee', 
    'Marketing'
];

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'IQD',
    maximumFractionDigits: 0,
  }).format(amount);
};

const safeDate = (dateValue: string | undefined | null): Date | null => {
  if (!dateValue) return null;
  try {
    const parsed = parseISO(dateValue);
    return isNaN(parsed.getTime()) ? null : parsed;
  } catch {
    return null;
  }
};

function EmployeeForm({
  employee,
  onSave,
  onCancel,
}: {
  employee: Employee;
  onSave: (updatedData: Partial<Employee>) => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const storage = useStorage();

  const [name, setName] = useState(employee.name);
  const [kurdishName, setKurdishName] = useState(employee.kurdishName || '');
  const [uniqueId, setUniqueId] = useState(employee.employeeId || '');
  const [role, setRole] = useState<Employee['role']>(employee.role);
  const [employmentStartDate, setEmploymentStartDate] = useState<Date | undefined>(safeDate(employee.employmentStartDate) || undefined);
  const [dateOfBirth, setDateOfBirth] = useState<Date | undefined>(safeDate(employee.dateOfBirth) || undefined);
  const [email, setEmail] = useState(employee.email || '');
  const [phone, setPhone] = useState(employee.phone || '');
  const [photoUrl, setPhotoUrl] = useState<string | undefined>(employee.photoUrl || undefined);
  const [notes, setNotes] = useState(employee.notes || '');

  const photoUploadRef = useRef<HTMLInputElement>(null);

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = event => {
      const localUrl = event.target?.result as string;
      if (localUrl) {
        setPhotoUrl(localUrl);
        const filePath = `employees/${employee.id}/photo.png`;
        const sRef = storageRef(storage, filePath);

        const uploadToast = toast({ title: 'Uploading...', description: 'Your new photo is being uploaded.' });
        uploadString(sRef, localUrl, 'data_url')
          .then(() => getDownloadURL(sRef))
          .then(downloadURL => {
            setPhotoUrl(downloadURL);
            uploadToast.update({ id: uploadToast.id, title: 'Upload Complete', description: 'Photo updated. Click Save to apply changes.' });
          })
          .catch(err => {
            console.error('Error uploading/getting URL', err);
            uploadToast.update({ id: uploadToast.id, variant: 'destructive', title: 'Upload Failed', description: 'Could not save the photo.' });
          });
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSave = () => {
    if (!name) {
      toast({ variant: 'destructive', title: 'Name is required' });
      return;
    }
    const updatedData: Partial<Employee> = {
      name,
      kurdishName: kurdishName || null,
      employeeId: uniqueId || null,
      role: role || null,
      employmentStartDate: employmentStartDate ? employmentStartDate.toISOString() : null,
      dateOfBirth: dateOfBirth ? dateOfBirth.toISOString() : null,
      email: email || null,
      phone: phone || null,
      photoUrl: photoUrl || null,
      notes: notes || null,
    };
    onSave(updatedData);
  };

  return (
    <>
      <Card className="border-0 shadow-none">
        <CardHeader className="flex-col md:flex-row gap-6 space-y-0 items-start">
          <div className="relative">
            <Avatar className="w-24 h-24 md:w-32 md:h-32 border-4 border-primary/20">
              <AvatarImage src={photoUrl || undefined} alt={name} />
              <AvatarFallback><User className="w-16 h-16" /></AvatarFallback>
            </Avatar>
            <Button size="icon" variant="outline" className="absolute -bottom-2 -right-2 rounded-full h-10 w-10" onClick={() => photoUploadRef.current?.click()}>
              <Upload className="w-5 h-5" />
              <input ref={photoUploadRef} type="file" onChange={handlePhotoUpload} accept="image/*" className="hidden" />
            </Button>
          </div>
          <div className="w-full">
            <div className='space-y-4'>
              <Input className="text-2xl h-12" value={name} onChange={e => setName(e.target.value)} placeholder={t('employee_name')} />
              <Input dir="rtl" className="text-2xl h-12" value={kurdishName} onChange={e => setKurdishName(e.target.value)} placeholder="ناو بە کوردی" />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input value={uniqueId} onChange={e => setUniqueId(e.target.value)} placeholder={t('employee_id_optional')} />
                 <Select value={role || undefined} onValueChange={(v) => setRole(v as Employee['role'])}>
                  <SelectTrigger><SelectValue placeholder={t('select_a_role')} /></SelectTrigger>
                  <SelectContent>{employeeRoles.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Popover><PopoverTrigger asChild><Button variant="outline" className={cn("justify-start text-left", !employmentStartDate && "text-muted-foreground")}><CalendarIcon className="mr-2 h-4 w-4" />{employmentStartDate ? `${t('start_date_optional')}: ${format(employmentStartDate, 'PPP')}` : <span>{t('pick_a_date')}</span>}</Button></PopoverTrigger><PopoverContent className="w-auto p-0"><Calendar mode="single" selected={employmentStartDate} onSelect={setEmploymentStartDate} initialFocus captionLayout="dropdown" fromYear={1990} toYear={2040} /></PopoverContent></Popover>
                <Popover><PopoverTrigger asChild><Button variant="outline" className={cn("justify-start text-left", !dateOfBirth && "text-muted-foreground")}><Cake className="mr-2 h-4 w-4" />{dateOfBirth ? `${t('dob_optional')}: ${format(dateOfBirth, 'PPP')}` : <span>{t('pick_a_date')}</span>}</Button></PopoverTrigger><PopoverContent className="w-auto p-0"><Calendar mode="single" selected={dateOfBirth} onSelect={setDateOfBirth} initialFocus captionLayout="dropdown" fromYear={1950} toYear={new Date().getFullYear()} /></PopoverContent></Popover>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="mt-6 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="space-y-2"><Label>{t('email_optional')}</Label><div className="relative"><Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="employee@example.com" className="pl-10" /></div></div>
            <div className="space-y-2"><Label>{t('phone_optional')}</Label><div className="relative"><Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="0000-000-000" className="pl-10" /></div></div>
          </div>
          <div className="space-y-2"><Label>{t('notes')}</Label><Textarea className="min-h-[120px]" value={notes} onChange={e => setNotes(e.target.value)} placeholder={t('notes_optional_long')} /></div>
        </CardContent>
      </Card>
      <CardFooter>
        <div className="flex w-full gap-2 justify-end">
            <Button onClick={handleSave}><Save className="mr-2 h-4 w-4"/> {t('save_changes')}</Button>
            <Button variant="ghost" onClick={onCancel}><X className="mr-2 h-4 w-4"/> {t('cancel')}</Button>
        </div>
      </CardFooter>
    </>
  );
}


function EmployeeDetailPage() {
  const { t, language } = useTranslation();
  const isRTL = language === 'ku';
  const params = useParams();
  const router = useRouter();
  const employeeId = params.id as string;

  const {
    employees, setEmployees,
    expenses, overtime, bonuses, withdrawals,
    isLoading: isAppLoading, settings
  } = useAppContext();
  
  const { toast } = useToast();
  
  const [isEditing, setIsEditing] = useState(false);
  
  const selectedEmployee = useMemo(() => employees?.find(e => e.id === employeeId), [employees, employeeId]);
  
  // --- Individual Employee Logic ---
  const { totalExpenses, sortedExpenses } = useMemo(() => {
    if (!employeeId) return { totalExpenses: 0, sortedExpenses: [] };
    const empExpenses = expenses.filter(e => e.employeeId === employeeId);
    const total = empExpenses.reduce((sum, exp) => sum + exp.amount, 0);
    const sorted = [...empExpenses].filter(e => e.date && !isNaN(parseISO(e.date).getTime())).sort((a,b) => parseISO(b.date).getTime() - parseISO(a.date).getTime());
    return { totalExpenses: total, sortedExpenses: sorted };
  }, [expenses, employeeId]);

  const { totalOvertimeAmount, totalOvertimeHours, sortedOvertime } = useMemo(() => {
    if (!employeeId) return { totalOvertimeAmount: 0, totalOvertimeHours: 0, sortedOvertime: [] };
    const empOvertime = overtime.filter(e => e.employeeId === employeeId);
    const totals = empOvertime.reduce((acc, ot) => { acc.totalAmount += ot.totalAmount; acc.totalHours += ot.hours; return acc; }, { totalAmount: 0, totalHours: 0 });
    const sorted = [...empOvertime].filter(o => o.date && !isNaN(parseISO(o.date).getTime())).sort((a, b) => parseISO(b.date).getTime() - parseISO(a.date).getTime());
    return { totalOvertimeAmount: totals.totalAmount, totalOvertimeHours: totals.totalHours, sortedOvertime: sorted };
  }, [overtime, employeeId]);

  const { totalBonuses, sortedBonuses } = useMemo(() => {
    if (!employeeId) return { totalBonuses: 0, sortedBonuses: [] };
    const empBonuses = bonuses.filter(b => b.employeeId === employeeId);
    const total = empBonuses.reduce((sum, b) => sum + b.totalAmount, 0);
    const sorted = [...empBonuses].filter(b => b.date && !isNaN(parseISO(b.date).getTime())).sort((a, b) => parseISO(b.date).getTime() - parseISO(a.date).getTime());
    return { totalBonuses: total, sortedBonuses: sorted };
  }, [bonuses, employeeId]);

  const { totalWithdrawals, sortedWithdrawals } = useMemo(() => {
    if (!employeeId) return { totalWithdrawals: 0, sortedWithdrawals: [] };
    const empWithdrawals = withdrawals.filter(w => w.employeeId === employeeId);
    const total = empWithdrawals.reduce((sum, w) => sum + w.amount, 0);
    const sorted = [...empWithdrawals].filter(w => w.date && !isNaN(parseISO(w.date).getTime())).sort((a, b) => parseISO(b.date).getTime() - parseISO(a.date).getTime());
    return { totalWithdrawals: total, sortedWithdrawals: sorted };
  }, [withdrawals, employeeId]);
  
  const handleUpdate = (updatedData: Partial<Employee>) => {
    if (!employeeId) return;
    setEmployees(employees.map(emp => emp.id === employeeId ? { ...emp, ...updatedData } : emp));
    toast({ title: t('save_changes'), description: t('employee_details_updated') });
    setIsEditing(false);
  };
  
  const handleDelete = () => {
    if(!employeeId) return;
    setEmployees(employees.filter(e => e.id !== employeeId));
    toast({ title: t('employee_deleted'), description: t('employee_deleted_desc', {employeeName: selectedEmployee?.name}) });
    router.push('/employees');
  };
  
  const handleToggleActiveStatus = () => {
    if (!selectedEmployee) return;
    const isRTL = language === 'ku';
    setEmployees(employees.map(e => e.id === selectedEmployee.id ? { ...e, isActive: !e.isActive } : e));
    toast({ 
      title: employeeIsActive ? (isRTL ? 'کارمەند ناچالاک کرایەوە' : 'Employee Deactivated') : (isRTL ? 'کارمەند کارا کرایەوە' : 'Employee Reactivated'), 
      description: isRTL ? `${selectedEmployee.name} بە سەرکەوتوویی ${employeeIsActive ? 'ناچالاک' : 'کارا'} کرایەوە.` : `${selectedEmployee.name} has been ${employeeIsActive ? 'deactivated' : 'reactivated'}.` 
    });
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExportExcelForDetail = () => {
    if (!selectedEmployee) return;

    const wb = XLSX.utils.book_new();

    const profileData = [
        { "Field": t('employee_name'), "Value": selectedEmployee.name }, { "Field": t('kurdish_name'), "Value": selectedEmployee.kurdishName || t('na') },
        { "Field": t('id_colon'), "Value": selectedEmployee.employeeId || t('na') }, { "Field": t('role_optional'), "Value": selectedEmployee.role || t('na') },
        { "Field": t('email_optional'), "Value": selectedEmployee.email || t('na') }, { "Field": t('phone_optional'), "Value": selectedEmployee.phone || t('na') },
        { "Field": t('joined_date'), "Value": selectedEmployee.employmentStartDate ? format(parseISO(selectedEmployee.employmentStartDate), 'yyyy-MM-dd') : t('na') },
        { "Field": t('dob'), "Value": selectedEmployee.dateOfBirth ? format(parseISO(selectedEmployee.dateOfBirth), 'yyyy-MM-dd') : t('na') },
    ];
    const wsProfile = XLSX.utils.json_to_sheet(profileData, { skipHeader: true });
    XLSX.utils.book_append_sheet(wb, wsProfile, "Profile");

    if (sortedExpenses.length > 0) { 
        const expensesData = sortedExpenses.map(e => ({ [t('date')]: format(parseISO(e.date), 'yyyy-MM-dd'), [t('amount')]: e.amount, [t('notes')]: e.notes || '' }));
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(expensesData), t('expenses')); 
    }

    if (sortedOvertime.length > 0) { 
        const overtimeData = sortedOvertime.map(o => ({ [t('date')]: format(parseISO(o.date), 'yyyy-MM-dd'), [t('overtime_hours')]: o.hours, [t('amount')]: o.totalAmount, [t('notes')]: o.notes || '' }));
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(overtimeData), t('overtime')); 
    }

    if (sortedBonuses.length > 0) { 
        const bonusesData = sortedBonuses.map(b => ({ [t('date')]: format(parseISO(b.date), 'yyyy-MM-dd'), [t('number_of_loads')]: b.loadCount, [t('amount')]: b.totalAmount, [t('notes')]: b.notes || '' }));
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(bonusesData), t('bonuses')); 
    }

    if (sortedWithdrawals.length > 0) { 
        const withdrawalsData = sortedWithdrawals.map(w => ({ [t('date')]: format(parseISO(w.date), 'yyyy-MM-dd'), [t('amount')]: w.amount, [t('notes')]: w.notes || '' }));
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(withdrawalsData), t('cash_withdrawals')); 
    }
    
    if (wb.SheetNames.length > 0) {
        XLSX.writeFile(wb, `${selectedEmployee.name}_Financials_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
    } else {
        toast({ title: t('no_data_to_export'), description: "This employee has no data to export." });
    }
  };

  const employeeIsActive = selectedEmployee?.isActive ?? true;

  if (isAppLoading) {
    return <div className="flex h-screen w-full items-center justify-center"><Loader2 className="h-16 w-16 animate-spin text-primary" /></div>;
  }

  if (!selectedEmployee) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center p-8 text-center">
        <User className="h-24 w-24 text-muted-foreground mb-4" />
        <h2 className="text-2xl">{t('employee_not_found')}</h2>
        
        <Button asChild>
          <Link href="/employees">
            <ArrowLeft className="mr-2 h-4 w-4" />
            {isRTL ? 'گەڕانەوە بۆ لیستی کارمەندان' : 'Back to Employee List'}
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <>
      <div className="hidden print:block">
           {selectedEmployee && (
                 <EmployeeReportPdf 
                    employee={selectedEmployee}
                    settings={settings}
                    expenses={{items: sortedExpenses, total: totalExpenses}}
                    overtime={{items: sortedOvertime, total: totalOvertimeAmount}}
                    bonuses={{items: sortedBonuses, total: totalBonuses}}
                    withdrawals={{items: sortedWithdrawals, total: totalWithdrawals}}
                />
            )}
      </div>
      
      <div className="min-h-screen bg-background text-foreground flex flex-col print:hidden">
            <header className="flex items-center justify-between gap-2 p-4 border-b bg-card">
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="icon" asChild>
                        <Link href="/employees"><ArrowLeft /></Link>
                    </Button>
                     <h1 className="text-xl font-semibold">{selectedEmployee.name}</h1>
                </div>
                <div className="flex-1 flex items-center justify-end gap-2 flex-wrap">
                    {!isEditing && (
                        <>
                            <Button onClick={() => setIsEditing(true)}><Edit className="mr-2 h-4 w-4"/> {t('edit')}</Button>
                            <Button variant="outline" size="icon" onClick={handlePrint}><Printer className="h-4 w-4" /></Button>
                            <Button variant="outline" size="icon" onClick={handleExportExcelForDetail}><FileDown className="h-4 w-4" /></Button>
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button variant="outline" className={cn(!employeeIsActive && "text-destructive border-destructive/50")}>
                                        <UserX className="mr-2 h-4 w-4"/> {employeeIsActive ? (isRTL ? 'ناچالاککردن' : 'Deactivate') : (isRTL ? 'کاراکردنەوە' : 'Reactivate')}
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>{isRTL ? `دڵنیایت لەوەی دەتەوێت ${selectedEmployee.name} ${employeeIsActive ? 'ناچالاک' : 'کارا'} بکەیتەوە؟` : `Are you sure you want to ${employeeIsActive ? 'deactivate' : 'reactivate'} ${selectedEmployee.name}?`}</AlertDialogTitle>
                                        <AlertDialogDescription>{isRTL ? 'کارمەندە ناچالاکەکان لە لیستی هەڵبژاردن بۆ تۆمارە نوێیەکان دەرناکەون.' : 'Deactivated employees will not appear in dropdown lists for new entries.'}</AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
                                        <AlertDialogAction onClick={handleToggleActiveStatus}>{employeeIsActive ? (isRTL ? 'ناچالاککردن' : 'Deactivate') : (isRTL ? 'کاراکردنەوە' : 'Reactivate')}</AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                            <AlertDialog>
                                <AlertDialogTrigger asChild><Button variant="destructive"><Trash2 className="mr-2 h-4 w-4"/> {t('delete')}</Button></AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>{t('are_you_sure_delete_employee')}</AlertDialogTitle>
                                        <AlertDialogDescription>{t('confirm_delete_employee_record', {employeeName: selectedEmployee.name})}</AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
                                        <AlertDialogAction onClick={handleDelete}>{t('continue')}</AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        </>
                    )}
                </div>
            </header>
            <main className="flex-1 overflow-y-auto p-4 md:p-6 w-full">
                 { isEditing ? (
                    <EmployeeForm employee={selectedEmployee} onSave={handleUpdate} onCancel={() => setIsEditing(false)} />
                 ) : (
                    <div className="space-y-6">
                        <Card className="border-0 shadow-none">
                            <CardHeader className="flex-col md:flex-row gap-6 space-y-0 items-start">
                                <Avatar className="w-24 h-24 md:w-32 md:h-32 border-4 border-primary/20">
                                    <AvatarImage src={selectedEmployee.photoUrl || undefined} alt={selectedEmployee.name} />
                                    <AvatarFallback><User className="w-16 h-16"/></AvatarFallback>
                                </Avatar>
                                <div className="w-full">
                                    <div className="flex items-start justify-between">
                                        <CardTitle className="text-3xl md:text-4xl" dir={language === 'ku' && selectedEmployee.kurdishName ? 'rtl': 'ltr'}>{language === 'ku' && selectedEmployee.kurdishName ? selectedEmployee.kurdishName : selectedEmployee.name}</CardTitle>
                                        {!employeeIsActive && <Badge variant="destructive" className="text-sm">{isRTL ? 'ناچالاک' : 'INACTIVE'}</Badge>}
                                    </div>
                                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-2">
                                        {selectedEmployee.role && <CardDescription className="text-lg md:text-xl flex items-center gap-2">{selectedEmployee.role}</CardDescription>}
                                    </div>
                                    <div className="mt-4 space-y-2 text-muted-foreground">
                                        {selectedEmployee.employeeId && <p className="flex items-center gap-2 font-mono">{t('id_colon')} {selectedEmployee.employeeId}</p>}
                                        {selectedEmployee.employmentStartDate && <p className="flex items-center gap-2"><CalendarIcon className="w-4 h-4"/> {t('started_on', {date: format(safeDate(selectedEmployee.employmentStartDate)!, 'MMMM d, yyyy')})}</p>}
                                        {selectedEmployee.dateOfBirth && <p className="flex items-center gap-2"><Cake className="w-4 h-4"/> {t('born_on', {date: format(safeDate(selectedEmployee.dateOfBirth)!, 'MMMM d, yyyy')})}</p>}
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="mt-6 space-y-6">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                    <div className="space-y-2"><Label>{t('email_optional')}</Label><p className="flex items-center gap-2"><Mail className="w-4 h-4 text-muted-foreground"/> {selectedEmployee.email || t('no_email')}</p></div>
                                    <div className="space-y-2"><Label>{t('phone_optional')}</Label><p className="flex items-center gap-2"><Phone className="w-4 h-4 text-muted-foreground"/> {selectedEmployee.phone || t('no_phone')}</p></div>
                                </div>
                                <div className="space-y-2"><Label>{t('notes')}</Label><p className="whitespace-pre-wrap text-muted-foreground">{selectedEmployee.notes || t('no_notes')}</p></div>
                            </CardContent>
                        </Card>

                        <EmployeeActivityChart activityData={{
                            expenses: sortedExpenses,
                            overtime: sortedOvertime,
                            bonuses: sortedBonuses,
                            withdrawals: sortedWithdrawals
                        }} />

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <Card><CardHeader><CardTitle className="flex items-center gap-2"><DollarSign className="w-5 h-5 text-blue-500"/> {t('expenses')}</CardTitle></CardHeader><CardContent>{sortedExpenses.length > 0 ? <Table><TableHeader><TableRow><TableHead>{t('date')}</TableHead><TableHead className="text-right">{t('amount')}</TableHead></TableRow></TableHeader><TableBody>{sortedExpenses.slice(0, 3).map(e => (<TableRow key={e.id}><TableCell>{format(parseISO(e.date), 'PP')}</TableCell><TableCell className="text-right">{formatCurrency(e.amount)}</TableCell></TableRow>))}</TableBody></Table> : <p className="text-sm text-center text-muted-foreground py-4">{t('no_expenses')}</p>}</CardContent>{sortedExpenses.length > 0 && <CardFooter className="justify-end gap-2 bg-muted/50 text-sm"><span className="text-muted-foreground">{t('total_colon')}</span><span className="text-blue-500">{formatCurrency(totalExpenses)}</span></CardFooter>}</Card>
                            <Card><CardHeader><div className="flex justify-between items-center"><CardTitle className="flex items-center gap-2"><Clock className="w-5 h-5 text-orange-500"/> {t('overtime')}</CardTitle><Badge variant="outline">{totalOvertimeHours.toFixed(2)} {t('hours_short')}</Badge></div></CardHeader><CardContent>{sortedOvertime.length > 0 ? <Table><TableHeader><TableRow><TableHead>{t('date')}</TableHead><TableHead className="text-right">{t('amount')}</TableHead></TableRow></TableHeader><TableBody>{sortedOvertime.slice(0, 3).map(o => (<TableRow key={o.id}><TableCell>{format(parseISO(o.date), 'PP')}</TableCell><TableCell className="text-right">{formatCurrency(o.totalAmount)}</TableCell></TableRow>))}</TableBody></Table> : <p className="text-sm text-center text-muted-foreground py-4">{t('no_overtime_this_month')}</p>}</CardContent>{sortedOvertime.length > 0 && <CardFooter className="justify-end gap-2 bg-muted/50 text-sm"><span className="text-muted-foreground">{t('months_total_colon')}</span><span className="text-orange-500">{formatCurrency(totalOvertimeAmount)}</span></CardFooter>}</Card>
                            <Card><CardHeader><CardTitle className="flex items-center gap-2"><Gift className="w-5 h-5 text-green-500"/> {t('bonuses')}</CardTitle></CardHeader><CardContent>{sortedBonuses.length > 0 ? <Table><TableHeader><TableRow><TableHead>{t('date')}</TableHead><TableHead className="text-right">{t('amount')}</TableHead></TableRow></TableHeader><TableBody>{sortedBonuses.slice(0, 3).map(b => (<TableRow key={b.id}><TableCell>{format(parseISO(b.date), 'PP')}</TableCell><TableCell className="text-right">{formatCurrency(b.totalAmount)}</TableCell></TableRow>))}</TableBody></Table> : <p className="text-sm text-center text-muted-foreground py-4">{t('no_bonuses')}</p>}</CardContent>{sortedBonuses.length > 0 && <CardFooter className="justify-end gap-2 bg-muted/50 text-sm"><span className="text-muted-foreground">{t('total_colon')}</span><span className="text-green-500">{formatCurrency(totalBonuses)}</span></CardFooter>}</Card>
                            <Card><CardHeader><CardTitle className="flex items-center gap-2"><Banknote className="w-5 h-5 text-rose-500"/> {t('cash_withdrawals')}</CardTitle></CardHeader><CardContent>{sortedWithdrawals.length > 0 ? <Table><TableHeader><TableRow><TableHead>{t('date')}</TableHead><TableHead className="text-right">{t('amount')}</TableHead></TableRow></TableHeader><TableBody>{sortedWithdrawals.slice(0, 3).map(w => (<TableRow key={w.id}><TableCell>{format(parseISO(w.date), 'PP')}</TableCell><TableCell className="text-right">{formatCurrency(w.amount)}</TableCell></TableRow>))}</TableBody></Table> : <p className="text-sm text-center text-muted-foreground py-4">{t('no_withdrawals')}</p>}</CardContent>{sortedWithdrawals.length > 0 && <CardFooter className="justify-end gap-2 bg-muted/50 text-sm"><span className="text-muted-foreground">{t('total_colon')}</span><span className="text-rose-500">{formatCurrency(totalWithdrawals)}</span></CardFooter>}</Card>
                        </div>
                    </div>
                 )}
            </main>
      </div>
    </>
  )
}

export default withAuth(EmployeeDetailPage);

