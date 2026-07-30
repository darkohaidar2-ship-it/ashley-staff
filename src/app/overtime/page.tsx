'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { ArrowLeft, Clock, Calendar, Lock, Unlock, Printer, Plus, Trash2, CheckCircle2, User, FileText, BarChart2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useTranslation } from '@/hooks/use-translation';
import withAuth from '@/hooks/withAuth';
import { useAppContext } from '@/context/app-provider';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

function OvertimePage() {
  const { t, language } = useTranslation();
  const { employees, overtime, setOvertime, settings } = useAppContext();
  const isRTL = language === 'ku';

  const [viewMode, setViewMode] = useState<'daily' | 'monthly'>('daily');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [selectedEmpId, setSelectedEmpId] = useState('');
  const [form, setForm] = useState({ hours: '', note: '' });
  const [lockedDays, setLockedDays] = useState<Record<string, boolean>>({});

  const overtimeRate = 5000; // Default 5,000 IQD/hr

  const dailyRecords = useMemo(() => {
    return overtime.filter((r) => r.date === selectedDate);
  }, [overtime, selectedDate]);

  const monthlyRecords = useMemo(() => {
    return overtime.filter((r) => r.date && r.date.startsWith(selectedMonth));
  }, [overtime, selectedMonth]);

  const monthlySummary = useMemo(() => {
    const summary: Record<string, { employeeName: string; totalHours: number; totalPay: number; count: number }> = {};
    monthlyRecords.forEach((r: any) => {
      const name = r.employeeName || r.employeeId || 'نادیار';
      if (!summary[name]) {
        summary[name] = { employeeName: name, totalHours: 0, totalPay: 0, count: 0 };
      }
      summary[name].totalHours += Number(r.hours || 0);
      summary[name].totalPay += Number(r.totalAmount || r.pay || 0) || (Number(r.hours || 0) * overtimeRate);
      summary[name].count += 1;
    });
    return Object.values(summary);
  }, [monthlyRecords]);

  const isDayLocked = lockedDays[selectedDate] || false;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isDayLocked) return alert(isRTL ? 'ئەم ڕۆژە قفڵ کراوە!' : 'This date is locked!');
    if (!selectedEmpId || !form.hours) return alert(isRTL ? 'تکایە کارمەند و ژمارەی کاتژمێر پڕبکەرەوە' : 'Please select employee and hours');

    const emp = employees.find((e) => e.id === selectedEmpId);
    if (!emp) return;

    const hoursNum = parseFloat(form.hours);
    const newRecord = {
      id: Date.now().toString(),
      employeeId: emp.id,
      employeeName: emp.name || emp.kurdishName || 'کارمەند',
      date: selectedDate,
      hours: hoursNum,
      rate: overtimeRate,
      totalAmount: hoursNum * overtimeRate,
      note: form.note,
      createdAt: new Date().toISOString(),
    };

    setOvertime((prev: any) => [newRecord, ...prev]);
    setForm({ hours: '', note: '' });
  };

  const handleDelete = (id: string) => {
    if (isDayLocked) return alert(isRTL ? 'ئەم ڕۆژە قفڵ کراوە!' : 'This date is locked!');
    if (confirm(isRTL ? 'ئایا دڵنیایت لە سڕینەوەی ئەم تۆمارە؟' : 'Are you sure you want to delete this record?')) {
      setOvertime((prev: any) => prev.filter((r: any) => r.id !== id));
    }
  };

  const toggleLockDay = () => {
    setLockedDays((prev) => ({
      ...prev,
      [selectedDate]: !prev[selectedDate],
    }));
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl p-6 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xl no-print">
        <div className="flex items-center gap-3">
          <Link href="/ashley-expenses">
            <Button variant="ghost" size="icon" className="rounded-full hover:bg-slate-100 dark:hover:bg-slate-800">
              <ArrowLeft className={cn("h-5 w-5", isRTL && "rotate-180")} />
            </Button>
          </Link>
          <div className="p-3 bg-gradient-to-tr from-amber-500 to-orange-500 rounded-2xl text-white shadow-lg shadow-orange-500/20">
            <Clock className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              {isRTL ? 'تۆماری سەعاتی زیاده (Overtime)' : 'Overtime Management'}
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">
              {isRTL ? 'تۆمارکردن و بەڕێوەبردنی کاتژمێری زیاده‌ی کارمەندان' : 'Track and manage employee overtime hours'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex bg-slate-100 dark:bg-slate-800/80 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-700">
            <button
              onClick={() => setViewMode('daily')}
              className={cn(
                'px-4 py-2 rounded-xl text-sm font-bold transition-all duration-200',
                viewMode === 'daily'
                  ? 'bg-amber-500 text-white shadow-md shadow-amber-500/30'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              )}
            >
              {isRTL ? 'تۆماری ڕۆژانە' : 'Daily Record'}
            </button>
            <button
              onClick={() => setViewMode('monthly')}
              className={cn(
                'px-4 py-2 rounded-xl text-sm font-bold transition-all duration-200',
                viewMode === 'monthly'
                  ? 'bg-amber-500 text-white shadow-md shadow-amber-500/30'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              )}
            >
              {isRTL ? 'پوختەی مانگانە' : 'Monthly Summary'}
            </button>
          </div>

          <Button onClick={handlePrint} variant="outline" className="rounded-2xl gap-2 border-slate-300 dark:border-slate-700">
            <Printer className="h-4 w-4" />
            {isRTL ? 'چاپکردن' : 'Print'}
          </Button>
        </div>
      </div>

      {/* Main Content Area */}
      {viewMode === 'daily' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Add Record Form */}
          <Card className="lg:col-span-1 border-slate-200/80 dark:border-slate-800 shadow-lg rounded-3xl bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl no-print">
            <CardHeader>
              <CardTitle className="flex items-center justify-between text-lg font-bold">
                <span>{isRTL ? 'زیادکردنی تۆماری نوێ' : 'Add Overtime Record'}</span>
                <Button
                  size="sm"
                  variant={isDayLocked ? 'destructive' : 'secondary'}
                  onClick={toggleLockDay}
                  className="rounded-xl gap-1 text-xs"
                >
                  {isDayLocked ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5" />}
                  {isDayLocked ? (isRTL ? 'قفڵ کراوە' : 'Locked') : (isRTL ? 'کراوەیەوە' : 'Unlocked')}
                </Button>
              </CardTitle>
              <CardDescription>
                {isRTL ? 'دیاری کردنی بەروار، کارمەند و ژمارەی کاتژمێر' : 'Select date, employee and overtime hours'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-400">
                    {isRTL ? 'بەرواری ڕۆژ' : 'Date'}
                  </label>
                  <Input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="rounded-2xl border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-950/50"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-400">
                    {isRTL ? 'هەڵبژاردنی کارمەند' : 'Select Employee'}
                  </label>
                  <Select value={selectedEmpId} onValueChange={setSelectedEmpId}>
                    <SelectTrigger className="rounded-2xl border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-950/50">
                      <SelectValue placeholder={isRTL ? 'کارمەند دیاری بکە...' : 'Select Employee...'} />
                    </SelectTrigger>
                    <SelectContent>
                      {employees.map((emp) => (
                        <SelectItem key={emp.id} value={emp.id}>
                          {emp.name || emp.kurdishName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-400">
                    {isRTL ? 'ژمارەی کاتژمێر (Hours)' : 'Overtime Hours'}
                  </label>
                  <Input
                    type="number"
                    step="0.5"
                    placeholder="مثلاً: 2.5"
                    value={form.hours}
                    onChange={(e) => setForm({ ...form, hours: e.target.value })}
                    disabled={isDayLocked}
                    className="rounded-2xl border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-950/50 font-bold"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-400">
                    {isRTL ? 'تێبینی (ئارەزوومەندانه)' : 'Note (Optional)'}
                  </label>
                  <Input
                    type="text"
                    placeholder={isRTL ? 'نووسینی تێبینی...' : 'Enter note...'}
                    value={form.note}
                    onChange={(e) => setForm({ ...form, note: e.target.value })}
                    disabled={isDayLocked}
                    className="rounded-2xl border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-950/50"
                  />
                </div>

                <Button
                  type="submit"
                  disabled={isDayLocked}
                  className="w-full rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold py-6 shadow-lg shadow-orange-500/25"
                >
                  <Plus className="h-5 w-5 mr-2" />
                  {isRTL ? 'تۆمارکردنی کاتژمێری زیاده' : 'Add Overtime Record'}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Daily Table List */}
          <Card className="lg:col-span-2 border-slate-200/80 dark:border-slate-800 shadow-lg rounded-3xl bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg font-bold flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-amber-500" />
                  <span>{isRTL ? `تۆمارەکانی ڕۆژی (${selectedDate})` : `Records for ${selectedDate}`}</span>
                </CardTitle>
                <CardDescription>
                  {isRTL ? `سەرجەم کاتژمێرە تۆمارکراوەکانی ئەم ڕۆژە` : 'All registered overtime hours for this date'}
                </CardDescription>
              </div>
              <Badge variant="outline" className="rounded-xl text-amber-600 border-amber-300 bg-amber-50 dark:bg-amber-950/40">
                {dailyRecords.length} {isRTL ? 'تۆمار' : 'Records'}
              </Badge>
            </CardHeader>
            <CardContent>
              {dailyRecords.length === 0 ? (
                <div className="text-center py-12 text-slate-400 space-y-3">
                  <Clock className="h-12 w-12 mx-auto opacity-30" />
                  <p className="font-medium">{isRTL ? 'هیچ تۆمارێک بۆ ئەم ڕۆژە نەدۆزرایەوە' : 'No records found for this date'}</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-slate-100 dark:border-slate-800">
                        <TableHead>{isRTL ? 'ناوی کارمەند' : 'Employee'}</TableHead>
                        <TableHead>{isRTL ? 'کاتژمێر' : 'Hours'}</TableHead>
                        <TableHead>{isRTL ? 'موعادەل (IQD)' : 'Pay Amount'}</TableHead>
                        <TableHead>{isRTL ? 'تێبینی' : 'Note'}</TableHead>
                        <TableHead className="no-print text-right">{isRTL ? 'کردارەکان' : 'Actions'}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {dailyRecords.map((r: any) => (
                        <TableRow key={r.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 border-slate-100 dark:border-slate-800">
                          <TableCell className="font-bold text-slate-900 dark:text-white">{r.employeeName}</TableCell>
                          <TableCell className="font-extrabold text-amber-600 dark:text-amber-400">{r.hours} کاتژمێر</TableCell>
                          <TableCell className="font-bold text-emerald-600 dark:text-emerald-400">
                            {((r.totalAmount || r.pay || r.hours * overtimeRate)).toLocaleString()} IQD
                          </TableCell>
                          <TableCell className="text-slate-500 text-sm">{r.note || '-'}</TableCell>
                          <TableCell className="no-print text-right">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDelete(r.id)}
                              disabled={isDayLocked}
                              className="text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      ) : (
        /* Monthly Summary Mode */
        <Card className="border-slate-200/80 dark:border-slate-800 shadow-lg rounded-3xl bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl">
          <CardHeader className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <BarChart2 className="h-5 w-5 text-amber-500" />
                <span>{isRTL ? 'پوختەی کۆی کاتژمێرەکان و شایستەی دارایی مانگانە' : 'Monthly Overtime Summary'}</span>
              </CardTitle>
              <CardDescription>
                {isRTL ? 'کۆکراوەی سەرجەم کاتژمێر و بڕی پارەی کاتژمێری زیاده' : 'Total monthly hours and payout per employee'}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs font-bold text-slate-600 dark:text-slate-400">{isRTL ? 'مانگ:' : 'Month:'}</label>
              <Input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="rounded-2xl border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-950/50 w-auto"
              />
            </div>
          </CardHeader>
          <CardContent>
            {monthlySummary.length === 0 ? (
              <div className="text-center py-12 text-slate-400 space-y-3">
                <FileText className="h-12 w-12 mx-auto opacity-30" />
                <p className="font-medium">{isRTL ? 'هیچ داتایەک بۆ ئەم مانگە بوونی نییە' : 'No overtime data for this month'}</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-slate-100 dark:border-slate-800">
                      <TableHead>{isRTL ? 'ناوی کارمەند' : 'Employee Name'}</TableHead>
                      <TableHead>{isRTL ? 'ژمارەی جارەکان' : 'Entries Count'}</TableHead>
                      <TableHead>{isRTL ? 'کۆی کاتژمێرەکان' : 'Total Hours'}</TableHead>
                      <TableHead>{isRTL ? 'کۆی شایستەی دارایی (IQD)' : 'Total Overtime Payout'}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {monthlySummary.map((item, idx) => (
                      <TableRow key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 border-slate-100 dark:border-slate-800">
                        <TableCell className="font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                          <User className="h-4 w-4 text-amber-500" />
                          {item.employeeName}
                        </TableCell>
                        <TableCell>{item.count} جار</TableCell>
                        <TableCell className="font-bold text-amber-600 dark:text-amber-400">{item.totalHours} کاتژمێر</TableCell>
                        <TableCell className="font-black text-emerald-600 dark:text-emerald-400 text-base">
                          {item.totalPay.toLocaleString()} IQD
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default withAuth(OvertimePage);
