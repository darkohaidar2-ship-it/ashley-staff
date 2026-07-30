
"use client"

import { useState, useMemo, useEffect } from "react"
import withAuth from "@/hooks/withAuth";
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { format, formatISO } from "date-fns"
import { cn } from "@/lib/utils"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Plus, User, Calendar as CalendarIcon, Cake, Mail, Phone, Search, Printer, FileDown, ArrowLeft } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import Link from "next/link"
import { useToast } from "@/hooks/use-toast"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useAppContext } from "@/context/app-provider"
import type { Employee } from "@/lib/types"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useTranslation } from "@/hooks/use-translation"
import { EmployeeDashboardPrintView } from "@/components/employees/EmployeeDashboardPrintView";
import { useRouter } from "next/navigation";
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
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>{t('add_new_employee')}</DialogTitle>
                    
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 pt-4 max-h-[80vh] overflow-y-auto p-1 pr-4">
                    <div className="space-y-2"><Label htmlFor="name">{t('employee_name')}</Label><Input id="name" value={name} onChange={e => setName(e.target.value)} required placeholder="e.g. John Doe" /></div>
                    <div className="space-y-2 relative">
                        <Label htmlFor="kurdishName">{t('kurdish_name')} ({t('notes_optional')})</Label>
                        <Input id="kurdishName" value={kurdishName} onChange={e => setKurdishName(e.target.value)} dir="rtl" placeholder="بۆ نموونە، جۆن دۆ"/>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2"><Label htmlFor="employeeId">{t('employee_id_optional')}</Label><Input id="employeeId" value={uniqueId} onChange={e => setUniqueId(e.target.value)} placeholder="e.g. 10234" /></div>
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
                        <div className="space-y-2"><Label>{t('email_optional')}</Label><div className="relative"><Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"/><Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="employee@example.com" className="pl-10" /></div></div>
                        <div className="space-y-2"><Label>{t('phone_optional')}</Label><div className="relative"><Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"/><Input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="0000-000-000" className="pl-10"/></div></div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2"><Label>{t('start_date_optional')}</Label><Popover><PopoverTrigger asChild><Button variant={"outline"} className={cn("w-full justify-start text-left",!employmentStartDate && "text-muted-foreground")}><CalendarIcon className="mr-2 h-4 w-4" />{employmentStartDate ? format(employmentStartDate, "PPP") : <span>{t('pick_a_date')}</span>}</Button></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={employmentStartDate} onSelect={setEmploymentStartDate} captionLayout="dropdown" fromYear={1990} toYear={2040} initialFocus/></PopoverContent></Popover></div>
                        <div className="space-y-2"><Label>{t('dob_optional')}</Label><Popover><PopoverTrigger asChild><Button variant={"outline"} className={cn("w-full justify-start text-left",!dateOfBirth && "text-muted-foreground")}><Cake className="mr-2 h-4 w-4" />{dateOfBirth ? format(dateOfBirth, "PPP") : <span>{t('pick_a_date')}</span>}</Button></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={dateOfBirth} onSelect={setDateOfBirth} captionLayout="dropdown" fromYear={1950} toYear={new Date().getFullYear()} initialFocus/></PopoverContent></Popover></div>
                    </div>
                    <DialogFooter className="pt-4"><DialogClose asChild><Button type="button" variant="secondary">{t('cancel')}</Button></DialogClose><Button type="submit">{t('add_employee')}</Button></DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}

function EmployeesPage() {
  const { t, language } = useTranslation();
  const { employees, setEmployees, isLoading, settings, viewMode } = useAppContext();
  const [isAddDialogOpen, setAddDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const { toast } = useToast();
  const router = useRouter();

  const filteredEmployees = useMemo(() => {
    if (!employees) return [];
    
    const sortEmployees = (a: Employee, b: Employee) => {
        if (a.employeeId === '01') return -1;
        if (b.employeeId === '01') return 1;
        const idA = a.employeeId ? parseInt(a.employeeId, 10) : Infinity;
        const idB = b.employeeId ? parseInt(b.employeeId, 10) : Infinity;
        if (idA !== idB) return idA - idB;
        return a.name.localeCompare(b.name);
    };

    return employees.filter(emp =>
        emp.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        emp.kurdishName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        emp.employeeId?.toLowerCase().includes(searchQuery.toLowerCase())
    ).sort(sortEmployees);
  }, [employees, searchQuery]);

  const addEmployee = (employeeData: Omit<Employee, 'id'>) => {
    const newEmployee: Employee = { id: crypto.randomUUID(), ...employeeData };
    setEmployees([...(employees || []), newEmployee]);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExportExcel = () => {
    if (filteredEmployees.length === 0) { toast({ title: t('no_data_to_export'), description: t('no_employees_to_export_desc') }); return; }
    const dataToExport = filteredEmployees.map(emp => ({
      [t('employee_name')]: emp.name,
      [t('kurdish_name')]: emp.kurdishName || '',
      [t('id_colon')]: emp.employeeId || '',
      [t('role_optional')]: emp.role || '',
      [t('email_optional')]: emp.email || '',
      [t('phone_optional')]: emp.phone || '',
    }));
    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, t('employees_list'));
    XLSX.writeFile(workbook, `${t('employees_dashboard')}.xlsx`);
  };

  return (
    <>
      <div className="hidden print:block">
          <EmployeeDashboardPrintView employees={filteredEmployees} settings={settings} />
      </div>
      
      <div className="print:hidden w-full font-sans" dir={language === 'ku' ? "rtl" : "ltr"}>
          <AddEmployeeDialog open={isAddDialogOpen} onOpenChange={setAddDialogOpen} addEmployee={addEmployee} />
          
          <div className="space-y-6 w-full">
              <Card className="border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm rounded-xl">
                <CardHeader className="py-3 px-4 border-b border-slate-100 dark:border-zinc-800/80">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                        <div className="flex-1">
                            <CardTitle className="text-xs font-black uppercase text-slate-400 tracking-wider">{t('employees_list')}</CardTitle>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                                <Input placeholder={t('search_name_or_id')} className="pl-9 h-8 text-xs max-w-xs" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                            </div>
                            <Button onClick={() => setAddDialogOpen(true)} size="sm" className="h-8 text-xs font-bold px-3">
                                <Plus className="mr-1.5 h-3.5 w-3.5" /> {t('add_employee')}
                            </Button>
                            <Button variant="outline" size="icon" className="h-8 w-8" onClick={handlePrint}><Printer className="h-3.5 w-3.5" /></Button>
                            <Button variant="outline" size="icon" className="h-8 w-8" onClick={handleExportExcel}><FileDown className="h-3.5 w-3.5" /></Button>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="border rounded-lg overflow-hidden">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>{t('photo')}</TableHead>
                                    <TableHead>{t('name')}</TableHead>
                                    <TableHead>{t('id')}</TableHead>
                                    <TableHead>{t('role')}</TableHead>
                                    <TableHead>{t('phone')}</TableHead>
                                    <TableHead>{t('status')}</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    [...Array(5)].map((_, i) => (
                                        <TableRow key={i}>
                                            <TableCell><Skeleton className="h-10 w-10 rounded-full" /></TableCell>
                                            <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                                            <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                                            <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                                            <TableCell><Skeleton className="h-5 w-28" /></TableCell>
                                            <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                                        </TableRow>
                                    ))
                                ) : filteredEmployees.length > 0 ? (
                                    filteredEmployees.map(emp => {
                                      const displayName = language === 'ku' && emp.kurdishName ? emp.kurdishName : emp.name;
                                      const cellPadding = "py-2 px-4";
                                      const avatarSize = "h-8 w-8";
                                      
                                      return (
                                        <TableRow key={emp.id} onClick={() => router.push(`/employees/${emp.id}`)} className="cursor-pointer hover:bg-accent/50 group transition-all">
                                            <TableCell className={cellPadding}>
                                                <Avatar className={cn(avatarSize, "transition-all")}>
                                                    <AvatarImage src={emp.photoUrl || ''} alt={emp.name} />
                                                    <AvatarFallback>{emp.name.charAt(0)}</AvatarFallback>
                                                </Avatar>
                                            </TableCell>
                                            <TableCell className={cn(cellPadding, "font-bold", viewMode === 'large' ? "text-lg" : "text-sm")}>{displayName}</TableCell>
                                            <TableCell className={cn(cellPadding, viewMode === 'large' ? "text-lg" : "text-sm")}>{emp.employeeId || t('n_a')}</TableCell>
                                            <TableCell className={cn(cellPadding, viewMode === 'large' ? "text-lg" : "text-sm")}>{t(emp.role || 'n_a')}</TableCell>
                                            <TableCell className={cn(cellPadding, viewMode === 'large' ? "text-lg" : "text-sm")}>{emp.phone || t('n_a')}</TableCell>
                                            <TableCell className={cn(cellPadding, viewMode === 'large' ? "text-lg" : "text-sm")}>{emp.isActive ? t('active') : t('inactive')}</TableCell>
                                        </TableRow>
                                      )
                                    })
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={6} className="h-24 text-center">
                                            {t('no_employees_found')}
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
              </Card>
          </div>
      </div>
    </>
  )
}

export default withAuth(EmployeesPage);
