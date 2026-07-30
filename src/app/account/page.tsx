
'use client';

import withAuth from '@/hooks/withAuth';
import { useState, useEffect, useRef, useMemo } from 'react';
import {
  UserCircle,
  Edit,
  Save,
  X,
  KeyRound,
  Upload,
  Mail,
  Phone,
  Building,
  DollarSign,
  Clock,
  Gift,
  Banknote,
  Calendar as CalendarIcon,
  Loader2,
  Printer,
} from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { useAuth } from '@/hooks/use-auth';
import { useAppContext } from '@/context/app-provider';
import type {
  Employee,
  Expense,
  Overtime,
  Bonus,
  CashWithdrawal,
} from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from '@/hooks/use-translation';
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
  TableFooter as ShadcnTableFooter,
} from '@/components/ui/table';
import { format, parseISO, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';
import { ReportWrapper } from '@/components/reports/ReportWrapper';

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'IQD',
    maximumFractionDigits: 0,
  }).format(amount);
};

const FinancialDetailTable = ({
  title,
  data,
  total,
}: {
  title: string;
  data: any[];
  total: number;
}) => {
  const { t } = useTranslation();
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="max-h-60 overflow-y-auto">
        {data.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableCell>{t('date')}</TableCell>
                <TableCell>{t('notes')}</TableCell>
                <TableCell className="text-right">{t('amount')}</TableCell>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map(item => (
                <TableRow key={item.id}>
                  <TableCell>
                    {item.date && !isNaN(parseISO(item.date).getTime())
                      ? format(parseISO(item.date), 'PP')
                      : 'Invalid Date'}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {item.notes || 'N/A'}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(item.amount || item.totalAmount)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <p className="text-sm text-center text-muted-foreground py-4">
            {t('no_records_found')}
          </p>
        )}
      </CardContent>
      {data.length > 0 && (
        <CardFooter className="justify-end gap-2 bg-muted/50 text-sm">
          <span className="text-muted-foreground">{t('total_colon')}</span>
          <span className="font-medium text-primary">
            {formatCurrency(total)}
          </span>
        </CardFooter>
      )}
    </Card>
  );
};

const OvertimeDetailTable = ({
  title,
  data,
  total,
}: {
  title: string;
  data: Overtime[];
  total: number;
}) => {
  const { t } = useTranslation();
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="max-h-60 overflow-y-auto">
        {data.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableCell>{t('date')}</TableCell>
                <TableCell>{t('overtime_hours')}</TableCell>
                <TableCell>{t('notes')}</TableCell>
                <TableCell className="text-right">{t('amount')}</TableCell>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map(item => (
                <TableRow key={item.id}>
                  <TableCell>
                    {item.date && !isNaN(parseISO(item.date).getTime())
                      ? format(parseISO(item.date), 'PP')
                      : 'Invalid Date'}
                  </TableCell>
                  <TableCell>{item.hours.toFixed(2)}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {item.notes || 'N/A'}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(item.totalAmount)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <p className="text-sm text-center text-muted-foreground py-4">
            {t('no_records_found')}
          </p>
        )}
      </CardContent>
      {data.length > 0 && (
        <CardFooter className="justify-end gap-2 bg-muted/50 text-sm">
          <span className="text-muted-foreground">{t('total_colon')}</span>
          <span className="font-medium text-primary">
            {formatCurrency(total)}
          </span>
        </CardFooter>
      )}
    </Card>
  );
};

const PageContent = ({
  employeeDetails,
  isEditing,
  photoUrl,
  email,
  phone,
  currentPassword,
  newPassword,
  confirmPassword,
  selectedDate,
  monthlyFinancials,
  isCalendarOpen,
  photoUploadRef,
  setIsEditing,
  setPhotoUrl,
  setEmail,
  setPhone,
  setCurrentPassword,
  setNewPassword,
  setConfirmPassword,
  setSelectedDate,
  setIsCalendarOpen,
  handleSaveChanges,
  handleChangePassword,
  handleSaveAll,
  handleEditToggle,
  handlePhotoUpload,
}: any) => {
  const { t } = useTranslation();

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <div className="lg:col-span-1 space-y-8">
        <Card>
          <CardHeader className="items-center text-center">
            <div className="relative">
              <Avatar className="w-32 h-32 mb-4 border-4 border-primary/20">
                <AvatarImage src={photoUrl} alt={employeeDetails.name} />
                <AvatarFallback>
                  {employeeDetails.name.charAt(0)}
                </AvatarFallback>
              </Avatar>
              {isEditing && (
                <Button
                  size="icon"
                  variant="outline"
                  className="absolute -bottom-0 right-0 rounded-full h-10 w-10"
                  onClick={() => photoUploadRef.current?.click()}
                >
                  <Upload className="w-5 h-5" />
                  <input
                    ref={photoUploadRef}
                    type="file"
                    onChange={handlePhotoUpload}
                    accept="image/*"
                    className="hidden"
                  />
                </Button>
              )}
            </div>
            <CardTitle className="text-2xl">{employeeDetails.name}</CardTitle>
            <CardDescription>
              {employeeDetails.role || 'کارمەند'}
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-3">
            <p className="flex items-center gap-2">
              <Mail className="w-4 h-4" />{' '}
              {isEditing ? (
                <Input
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="ناونیشانی ئیمەیڵ"
                />
              ) : (
                employeeDetails.email || t('no_email')
              )}
            </p>
            <p className="flex items-center gap-2">
              <Phone className="w-4 h-4" />{' '}
              {isEditing ? (
                <Input
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="ژمارەی مۆبایل"
                />
              ) : (
                employeeDetails.phone || t('no_phone')
              )}
            </p>
          </CardContent>

          {isEditing && (
            <>
              <Separator />
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <KeyRound /> گۆڕینی وشەی تێپەڕ
                </CardTitle>
                <CardDescription>
                  بۆ پاراستنی ئاسایش، دەبێت وشەی تێپەڕی ئێستات بنووسیت بۆ دانانی وشەیەکی نوێ.
                </CardDescription>
              </CardHeader>
              <form onSubmit={handleChangePassword}>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="current-password">وشەی تێپەڕی ئێستا</Label>
                    <Input
                      id="current-password"
                      type="password"
                      value={currentPassword}
                      onChange={e => setCurrentPassword(e.target.value)}
                      required={!!newPassword}
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="new-password">وشەی تێپەڕی نوێ</Label>
                      <Input
                        id="new-password"
                        type="password"
                        value={newPassword}
                        onChange={e => setNewPassword(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="confirm-password">
                        پشتڕاستکردنەوەی وشەی تێپەڕی نوێ
                      </Label>
                      <Input
                        id="confirm-password"
                        type="password"
                        value={confirmPassword}
                        onChange={e => setConfirmPassword(e.target.value)}
                      />
                    </div>
                  </div>
                </CardContent>
              </form>
            </>
          )}

          <CardFooter>
            {isEditing ? (
              <div className="flex w-full gap-2">
                <Button onClick={handleSaveAll} className="flex-1">
                  <Save className="mr-2 h-4 w-4" /> پاشەکەوتکردنی هەموو
                </Button>
                <Button variant="ghost" onClick={handleEditToggle}>
                  <X className="mr-2 h-4 w-4" /> هەڵوەشاندنەوە
                </Button>
              </div>
            ) : (
              <Button
                variant="outline"
                onClick={handleEditToggle}
                className="w-full"
              >
                <Edit className="mr-2 h-4 w-4" /> دەستکاری پڕۆفایل
              </Button>
            )}
          </CardFooter>
        </Card>
      </div>
      <div className="lg:col-span-2 space-y-8">
        <Card>
          <CardHeader>
            <CardTitle>{t('general')}</CardTitle>
            <CardDescription>
              بەڕێوەبردنی زانیارییە گشتییەکانی هەژمارەکەت.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">ناو</Label>
              <Input id="name" value={employeeDetails.name} disabled />
              <p className="text-xs text-muted-foreground">
                ناوت تەنها لەلایەن بەڕێوەبەرەوە (ئەدمین) دەتوانرێت بگۆڕدرێت.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="kurdishName">ناوی کوردی</Label>
              <Input
                id="kurdishName"
                value={employeeDetails.kurdishName || ''}
                dir="rtl"
                disabled
              />
            </div>
          </CardContent>
        </Card>
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl">
              {t('this_month_activity_summary', {
                month: format(selectedDate, 'MMMM yyyy'),
              })}
            </h2>
            <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant={'outline'}
                  className={cn(
                    'w-[240px] justify-start text-left font-normal',
                    !selectedDate && 'text-muted-foreground'
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {selectedDate ? (
                    format(selectedDate, 'MMMM yyyy')
                  ) : (
                    <span>{t('pick_a_month')}</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={date => {
                    if (date) {
                      setSelectedDate(date);
                      setIsCalendarOpen(false);
                    }
                  }}
                  initialFocus
                  captionLayout="dropdown"
                  fromYear={2020}
                  toYear={new Date().getFullYear()}
                />
              </PopoverContent>
            </Popover>
          </div>
          <FinancialDetailTable
            title={t('expenses')}
            data={monthlyFinancials.selected.expenses.items}
            total={monthlyFinancials.selected.expenses.total}
          />
          <OvertimeDetailTable
            title={t('overtime')}
            data={monthlyFinancials.selected.overtime.items as Overtime[]}
            total={monthlyFinancials.selected.overtime.total}
          />
          <FinancialDetailTable
            title={t('bonuses')}
            data={monthlyFinancials.selected.bonuses.items}
            total={monthlyFinancials.selected.bonuses.total}
          />
          <FinancialDetailTable
            title={t('cash_withdrawals')}
            data={monthlyFinancials.selected.withdrawals.items}
            total={monthlyFinancials.selected.withdrawals.total}
          />
        </div>
      </div>
    </div>
  );
};

function AccountPage() {
  const { t, language } = useTranslation();
  const { toast } = useToast();
  const { user, login } = useAuth();
  const {
    employees,
    setEmployees,
    expenses,
    overtime,
    bonuses,
    withdrawals,
    settings,
    isLoading,
  } = useAppContext();

  const [isEditing, setIsEditing] = useState(false);
  const [employeeDetails, setEmployeeDetails] = useState<Employee | null>(
    null
  );
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

  useEffect(() => {
    setSelectedDate(new Date());
  }, []);

  // Form State
  const [photoUrl, setPhotoUrl] = useState<string | undefined>(undefined);
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');

  // Password State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const photoUploadRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (user && employees) {
      const emp = employees.find(e => {
        const potentialUsername = `${e.name.split(' ')[0]}${e.employeeId || ''}`;
        return potentialUsername === user.username;
      });
      setEmployeeDetails(emp || null);
    }
  }, [user, employees]);

  useEffect(() => {
    if (employeeDetails) {
      setPhotoUrl(employeeDetails.photoUrl || undefined);
      setEmail(employeeDetails.email || '');
      setPhone(employeeDetails.phone || '');
    }
  }, [employeeDetails]);

  const monthlyFinancials = useMemo(() => {
    if (!employeeDetails || !selectedDate) return null;

    const empId = employeeDetails.id;
    const selectedMonthStart = startOfMonth(selectedDate);
    const selectedMonthEnd = endOfMonth(selectedDate);

    const filterAndSum = (
      data: (Expense | Overtime | Bonus | CashWithdrawal)[],
      start: Date,
      end: Date
    ) => {
      const filtered = data.filter(d => {
        if (!d.date) return false;
        try {
          const recordDate = parseISO(d.date);
          return (
            d.employeeId === empId &&
            isWithinInterval(recordDate, { start, end })
          );
        } catch {
          return false;
        }
      });
      const total = filtered.reduce(
        (sum, item) =>
          sum +
          (('amount' in item && typeof item.amount === 'number')
            ? item.amount
            : ('totalAmount' in item && typeof item.totalAmount === 'number')
              ? item.totalAmount
              : 0),
        0
      );
      return { items: filtered, total };
    };

    return {
      selected: {
        expenses: filterAndSum(expenses, selectedMonthStart, selectedMonthEnd),
        overtime: filterAndSum(overtime, selectedMonthStart, selectedMonthEnd),
        bonuses: filterAndSum(bonuses, selectedMonthStart, selectedMonthEnd),
        withdrawals: filterAndSum(
          withdrawals,
          selectedMonthStart,
          selectedMonthEnd
        ),
      },
    };
  }, [employeeDetails, expenses, overtime, bonuses, withdrawals, selectedDate]);

  const handleEditToggle = () => {
    if (isEditing && employeeDetails) {
      // Reset fields to original state on cancel
      setPhotoUrl(employeeDetails.photoUrl || undefined);
      setEmail(employeeDetails.email || '');
      setPhone(employeeDetails.phone || '');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    }
    setIsEditing(!isEditing);
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = event => {
        const result = event.target?.result as string;
        setPhotoUrl(result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveChanges = () => {
    if (!employeeDetails) return;

    const updatedEmployee: Employee = {
      ...employeeDetails,
      photoUrl: photoUrl || null,
      email: email,
      phone: phone,
    };

    setEmployees(
      employees.map(emp =>
        emp.id === employeeDetails.id ? updatedEmployee : emp
      )
    );
    toast({
      title: 'پڕۆفایل نوێکرایەوە',
      description: 'زانیارییەکانی پڕۆفایلەکەت پاشەکەوت کران.',
    });
    setIsEditing(false);
  };

  const handleChangePassword = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!user || !employeeDetails) return;

    if (!currentPassword || !newPassword || !confirmPassword) {
      toast({
        variant: 'destructive',
        title: 'خانە ونبووەکان',
        description: 'تکایە هەموو خانەکانی وشەی تێپەڕ بنووسە بۆ گۆڕانکاری.',
      });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({
        variant: 'destructive',
        title: 'وشەکان وەک یەک نین',
        description: 'وشەی تێپەڕی نوێ و پشتڕاستکردنەوەکەی وەک یەک نین.',
      });
      return;
    }
    if (newPassword.length < 6) {
      toast({
        variant: 'destructive',
        title: 'وشەی تێپەڕ کورتە',
        description: 'پێویستە وشەی تێپەڕی نوێ لانی کەم ٦ پیت بێت.',
      });
      return;
    }

    const isCurrentPasswordCorrect = await login(user.username, currentPassword);

    if (!isCurrentPasswordCorrect) {
      toast({
        variant: 'destructive',
        title: 'وشەی تێپەڕی هەڵە',
        description: 'ئەو وشەی تێپەڕەی ئێستا کە نووسیوتە هەڵەیە.',
      });
      return;
    }

    const updatedEmployeeWithNewPass: Employee = {
      ...employeeDetails,
      password: newPassword,
    };
    setEmployees(
      employees.map(emp =>
        emp.id === employeeDetails!.id ? updatedEmployeeWithNewPass : emp
      )
    );

    await login(user.username, newPassword);

    toast({
      title: 'وشەی تێپەڕ گۆڕدرا',
      description: 'وشەی تێپەڕەکەت بە سەرکەوتوویی نوێکرایەوە.',
    });
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
  };

  const handleSaveAll = () => {
    handleSaveChanges(); // Saves profile details first
    if (newPassword) {
      // Only try to change password if a new one is entered
      handleChangePassword();
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (isLoading || !employeeDetails || !monthlyFinancials || !selectedDate) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }
  
  return (
    <>
      <div className="hidden print:block">
          <ReportWrapper>
            <PageContent 
              employeeDetails={employeeDetails}
              isEditing={isEditing}
              photoUrl={photoUrl}
              email={email}
              phone={phone}
              currentPassword={currentPassword}
              newPassword={newPassword}
              confirmPassword={confirmPassword}
              selectedDate={selectedDate}
              monthlyFinancials={monthlyFinancials}
              isCalendarOpen={isCalendarOpen}
              photoUploadRef={photoUploadRef}
              setIsEditing={setIsEditing}
              setPhotoUrl={setPhotoUrl}
              setEmail={setEmail}
              setPhone={setPhone}
              setCurrentPassword={setCurrentPassword}
              setNewPassword={setNewPassword}
              setConfirmPassword={setConfirmPassword}
              setSelectedDate={setSelectedDate}
              setIsCalendarOpen={setIsCalendarOpen}
              handleSaveChanges={handleSaveChanges}
              handleChangePassword={handleChangePassword}
              handleSaveAll={handleSaveAll}
              handleEditToggle={handleEditToggle}
              handlePhotoUpload={handlePhotoUpload}
            />
          </ReportWrapper>
      </div>

      <div className="min-h-screen bg-background text-foreground print:hidden">
        <main className="w-full p-4 md:p-8">
          <div className="flex justify-end gap-2 mb-4">
            <Button variant="outline" size="icon" onClick={handlePrint}>
              <Printer className="h-4 w-4" />
            </Button>
          </div>
          <PageContent 
            employeeDetails={employeeDetails}
            isEditing={isEditing}
            photoUrl={photoUrl}
            email={email}
            phone={phone}
            currentPassword={currentPassword}
            newPassword={newPassword}
            confirmPassword={confirmPassword}
            selectedDate={selectedDate}
            monthlyFinancials={monthlyFinancials}
            isCalendarOpen={isCalendarOpen}
            photoUploadRef={photoUploadRef}
            setIsEditing={setIsEditing}
            setPhotoUrl={setPhotoUrl}
            setEmail={setEmail}
            setPhone={setPhone}
            setCurrentPassword={setCurrentPassword}
            setNewPassword={setNewPassword}
            setConfirmPassword={setConfirmPassword}
            setSelectedDate={setSelectedDate}
            setIsCalendarOpen={setIsCalendarOpen}
            handleSaveChanges={handleSaveChanges}
            handleChangePassword={handleChangePassword}
            handleSaveAll={handleSaveAll}
            handleEditToggle={handleEditToggle}
            handlePhotoUpload={handlePhotoUpload}
          />
        </main>
      </div>
    </>
  );
}

export default withAuth(AccountPage);
