
'use client';
import { Employee, Expense, Overtime, Bonus, CashWithdrawal, AppSettings } from '@/lib/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { format, parseISO } from 'date-fns';
import { useTranslation } from '@/hooks/use-translation';
import { ReportWrapper } from '@/components/reports/ReportWrapper';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { User } from 'lucide-react';

const formatCurrency = (amount: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'IQD', maximumFractionDigits: 0 }).format(amount);

const FinancialTablePdf = ({ title, data, total }: { title: string, data: any[], total: number }) => {
    const { t } = useTranslation();
    if (data.length === 0) return null;
    return (
        <div className="mb-6 break-inside-avoid">
            <h3 className="text-lg font-medium mb-2 pb-1 border-b-2">{title}</h3>
            <Table className="pdf-table text-xs">
                <TableHeader><TableRow><TableHead>{t('date')}</TableHead><TableHead>{t('notes')}</TableHead><TableHead className="text-right">{t('amount')}</TableHead></TableRow></TableHeader>
                <TableBody>
                    {data.map((item: any) => (
                        <TableRow key={item.id}>
                            <TableCell className="py-1">{item.date && !isNaN(parseISO(item.date).getTime()) ? format(parseISO(item.date), 'dd/MM/yyyy') : 'Invalid Date'}</TableCell>
                            <TableCell className="text-gray-600 py-1">{item.notes || 'N/A'}</TableCell>
                            <TableCell className="text-right py-1">{formatCurrency(item.amount || item.totalAmount)}</TableCell>
                        </TableRow>
                    ))}
                </TableBody>
                <TableFooter><TableRow><TableCell colSpan={2} className="text-right font-medium">{t('total')}</TableCell><TableCell className="text-right font-medium">{formatCurrency(total)}</TableCell></TableRow></TableFooter>
            </Table>
        </div>
    );
};

const OvertimeTablePdf = ({ title, data, total }: { title: string, data: Overtime[], total: number }) => {
    const { t } = useTranslation();
    if (data.length === 0) return null;
    return (
        <div className="mb-6 break-inside-avoid">
            <h3 className="text-lg font-medium mb-2 pb-1 border-b-2">{title}</h3>
            <Table className="pdf-table text-xs">
                <TableHeader><TableRow>
                    <TableHead>{t('date')}</TableHead>
                    <TableHead>{t('overtime_hours')}</TableHead>
                    <TableHead>{t('notes')}</TableHead>
                    <TableHead className="text-right">{t('amount')}</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                    {data.map((item) => (
                        <TableRow key={item.id}>
                            <TableCell className="py-1">{item.date && !isNaN(parseISO(item.date).getTime()) ? format(parseISO(item.date), 'dd/MM/yyyy') : 'Invalid Date'}</TableCell>
                            <TableCell className="py-1">{item.hours.toFixed(2)}</TableCell>
                            <TableCell className="text-gray-600 py-1">{item.notes || 'N/A'}</TableCell>
                            <TableCell className="text-right py-1">{formatCurrency(item.totalAmount)}</TableCell>
                        </TableRow>
                    ))}
                </TableBody>
                <TableFooter><TableRow>
                    <TableCell colSpan={3} className="text-right font-medium">{t('total')}</TableCell>
                    <TableCell className="text-right font-medium">{formatCurrency(total)}</TableCell>
                </TableRow></TableFooter>
            </Table>
        </div>
    );
};

export const EmployeeReportPdf = ({ 
    employee, 
    settings,
    expenses,
    overtime,
    bonuses,
    withdrawals
}: { 
    employee: Employee, 
    settings: AppSettings,
    expenses: { items: Expense[], total: number },
    overtime: { items: Overtime[], total: number },
    bonuses: { items: Bonus[], total: number },
    withdrawals: { items: CashWithdrawal[], total: number }
}) => {
    const { t, language } = useTranslation();
    const displayName = language === 'ku' && employee.kurdishName ? employee.kurdishName : employee.name;
    const reportDate = new Date();

    return (
       <ReportWrapper
            title={`${t('employee_report')}: ${employee.name}`}
            date={reportDate}
       >
            <div dir={language === 'ku' ? 'rtl' : 'ltr'} style={{ fontFamily: settings.customFont ? 'CustomAppFont' : 'inherit' }}>
                <div className="flex items-start gap-6 p-4 rounded-lg bg-gray-50 border break-inside-avoid mb-8">
                    <Avatar className="w-28 h-28 border-4 border-white shadow-md">
                        <AvatarImage src={employee.photoUrl || undefined} alt={employee.name} />
                        <AvatarFallback><User /></AvatarFallback>
                    </Avatar>
                     <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm flex-1">
                        <div>
                            <p className="text-xs text-gray-500">{t('name')}</p>
                            <p className="text-lg font-bold">{displayName}</p>
                        </div>
                        <div>
                            <p className="text-xs text-gray-500">{t('role_optional')}</p>
                            <p className="font-bold">{employee.role || 'Employee'}</p>
                        </div>
                        <div>
                            <p className="text-xs text-gray-500">{t('id_colon')}</p>
                            <p className="font-bold">{employee.employeeId || 'N/A'}</p>
                        </div>
                         <div>
                            <p className="text-xs text-gray-500">{t('joined_date')}</p>
                            <p className="font-bold">{employee.employmentStartDate && !isNaN(parseISO(employee.employmentStartDate).getTime()) ? format(parseISO(employee.employmentStartDate), 'dd/MM/yyyy') : 'N/A'}</p>
                        </div>
                    </div>
                </div>
            
                <div className="mt-8">
                    <FinancialTablePdf title={t('expenses')} data={expenses.items} total={expenses.total} />
                    <OvertimeTablePdf title={t('overtime')} data={overtime.items} total={overtime.total} />
                    <FinancialTablePdf title={t('bonuses')} data={bonuses.items} total={bonuses.total} />
                    <FinancialTablePdf title={t('cash_withdrawals')} data={withdrawals.items} total={withdrawals.total} />
                </div>
            </div>
       </ReportWrapper>
    );
};
