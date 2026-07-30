
'use client';
import { Employee, AppSettings } from '@/lib/types';
import { format, parseISO } from 'date-fns';
import { useTranslation } from '@/hooks/use-translation';
import { ReportWrapper } from '@/components/reports/ReportWrapper';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { User } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export const EmployeeDashboardPrintView = ({ employees, settings }: { employees: Employee[], settings: AppSettings }) => {
    const { t, language } = useTranslation();

    return (
        <ReportWrapper title={t('employees_list')}>
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead className="text-right">وێنە</TableHead>
                        <TableHead className="text-right">ناو</TableHead>
                        <TableHead className="text-right">ناسنامە (ID)</TableHead>
                        <TableHead className="text-right">دەسەڵات / ڕۆڵ</TableHead>
                        <TableHead className="text-right">تەلەفۆن</TableHead>
                        <TableHead className="text-right">بەرواری دەستبەکاربوون</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {employees.map(employee => {
                        const displayName = language === 'ku' && employee.kurdishName ? employee.kurdishName : employee.name;
                        const safeEmploymentStartDate = employee.employmentStartDate && !isNaN(parseISO(employee.employmentStartDate).getTime()) ? parseISO(employee.employmentStartDate) : null;
                        
                        return (
                            <TableRow key={employee.id}>
                                <TableCell>
                                    <Avatar className="w-10 h-10 rounded-md">
                                        <AvatarImage src={employee.photoUrl || undefined} />
                                        <AvatarFallback><User className="w-6 h-6" /></AvatarFallback>
                                    </Avatar>
                                </TableCell>
                                <TableCell dir={language === 'ku' ? 'rtl' : 'ltr'}>{displayName}</TableCell>
                                <TableCell>{employee.employeeId || 'N/A'}</TableCell>
                                <TableCell>{employee.role || 'N/A'}</TableCell>
                                <TableCell>{employee.phone || 'N/A'}</TableCell>
                                <TableCell>{safeEmploymentStartDate ? format(safeEmploymentStartDate, 'PPP') : 'N/A'}</TableCell>
                            </TableRow>
                        );
                    })}
                </TableBody>
            </Table>
        </ReportWrapper>
    );
};
