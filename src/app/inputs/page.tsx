'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowDownCircle, ArrowUpCircle, Package, Plus, Trash2, Printer, Calendar, DollarSign, User, Tag } from 'lucide-react';
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

function InputsPage() {
  const { t, language } = useTranslation();
  const { employees, expenses, setExpenses, withdrawals, setWithdrawals } = useAppContext();
  const isRTL = language === 'ku';

  const [activeTab, setActiveTab] = useState<'expenses' | 'loads' | 'deductions'>('expenses');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedEmpId, setSelectedEmpId] = useState('');
  const [form, setForm] = useState({ amount: '', description: '', note: '' });

  const loadRate = 10000; // Default load rate 10,000 IQD

  const recordsList = useMemo(() => {
    if (activeTab === 'expenses') {
      return expenses.map((e: any) => ({ ...e, recordType: 'expenses' }));
    } else if (activeTab === 'deductions') {
      return withdrawals.map((w: any) => ({ ...w, recordType: 'deductions' }));
    } else {
      return expenses.filter((e: any) => e.category === 'Load' || e.type === 'Load').map((e: any) => ({ ...e, recordType: 'loads' }));
    }
  }, [activeTab, expenses, withdrawals]);

  const filteredRecords = useMemo(() => {
    return recordsList.filter((r: any) => r.date === selectedDate || !selectedDate);
  }, [recordsList, selectedDate]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmpId && activeTab !== 'expenses') {
      return alert(isRTL ? 'تکایە کارمەند دیاری بکە' : 'Please select employee');
    }

    const emp = employees.find((e) => e.id === selectedEmpId);
    const empName = emp ? (emp.name || emp.kurdishName) : (isRTL ? 'گشتی' : 'General');
    const amountNum = activeTab === 'loads' ? loadRate : parseFloat(form.amount || '0');

    if (amountNum <= 0) {
      return alert(isRTL ? 'تکایە بڕی پارەی دروست بنووسە' : 'Please enter a valid amount');
    }

    const newRecord = {
      id: Date.now().toString(),
      employeeId: emp?.id || '',
      employeeName: empName,
      date: selectedDate,
      amount: amountNum,
      category: activeTab === 'loads' ? 'Load' : activeTab,
      description: form.description || form.note,
      note: form.note,
      createdAt: new Date().toISOString(),
    };

    if (activeTab === 'deductions') {
      setWithdrawals((prev: any) => [newRecord, ...prev]);
    } else {
      setExpenses((prev: any) => [newRecord, ...prev]);
    }

    setForm({ amount: '', description: '', note: '' });
  };

  const handleDelete = (id: string) => {
    if (confirm(isRTL ? 'ئایا دڵنیایت لە سڕینەوە؟' : 'Are you sure you want to delete?')) {
      if (activeTab === 'deductions') {
        setWithdrawals((prev: any) => prev.filter((r: any) => r.id !== id));
      } else {
        setExpenses((prev: any) => prev.filter((r: any) => r.id !== id));
      }
    }
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
          <div className="p-3 bg-gradient-to-tr from-indigo-500 to-purple-500 rounded-2xl text-white shadow-lg shadow-indigo-500/20">
            <Package className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              {isRTL ? 'داغڵکردنی زانیارییەکان (Inputs)' : 'Data Inputs Center'}
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">
              {isRTL ? 'تۆمارکردنی خەرجی، بارکردن (Loads) و داشکاندن/ڕاکێشان' : 'Register Expenses, Loads, and Deductions'}
            </p>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex bg-slate-100 dark:bg-slate-800/80 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-700">
          <button
            onClick={() => setActiveTab('expenses')}
            className={cn(
              'px-4 py-2 rounded-xl text-sm font-bold transition-all duration-200 flex items-center gap-2',
              activeTab === 'expenses'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            )}
          >
            <DollarSign className="h-4 w-4" />
            {isRTL ? 'خەرجییەکان' : 'Expenses'}
          </button>
          <button
            onClick={() => setActiveTab('loads')}
            className={cn(
              'px-4 py-2 rounded-xl text-sm font-bold transition-all duration-200 flex items-center gap-2',
              activeTab === 'loads'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            )}
          >
            <Package className="h-4 w-4" />
            {isRTL ? 'بارکردن (Loads)' : 'Loads'}
          </button>
          <button
            onClick={() => setActiveTab('deductions')}
            className={cn(
              'px-4 py-2 rounded-xl text-sm font-bold transition-all duration-200 flex items-center gap-2',
              activeTab === 'deductions'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            )}
          >
            <ArrowDownCircle className="h-4 w-4" />
            {isRTL ? 'داشکاندن / ڕاکێشان' : 'Deductions'}
          </button>
        </div>
      </div>

      {/* Grid Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form Card */}
        <Card className="lg:col-span-1 border-slate-200/80 dark:border-slate-800 shadow-lg rounded-3xl bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl no-print">
          <CardHeader>
            <CardTitle className="text-lg font-bold">
              {activeTab === 'expenses' && (isRTL ? 'تۆمارکردنی خەرجی' : 'Add Expense')}
              {activeTab === 'loads' && (isRTL ? 'تۆمارکردنی بارکردن' : 'Add Load')}
              {activeTab === 'deductions' && (isRTL ? 'تۆمارکردنی داشکاندن/ڕاکێشان' : 'Add Deduction')}
            </CardTitle>
            <CardDescription>
              {isRTL ? 'زانیارییە پێویستەکان داغڵ بکە' : 'Fill in the required information'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-600 dark:text-slate-400">{isRTL ? 'بەروار' : 'Date'}</label>
                <Input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="rounded-2xl border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-950/50"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-600 dark:text-slate-400">{isRTL ? 'کارمەند' : 'Employee'}</label>
                <Select value={selectedEmpId} onValueChange={setSelectedEmpId}>
                  <SelectTrigger className="rounded-2xl border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-950/50">
                    <SelectValue placeholder={isRTL ? 'کارمەند دیاری بکە (ئارەزوومەندانه)' : 'Select Employee...'} />
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

              {activeTab !== 'loads' && (
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-400">{isRTL ? 'بڕی پارە (IQD)' : 'Amount (IQD)'}</label>
                  <Input
                    type="number"
                    placeholder="مثلاً: 25000"
                    value={form.amount}
                    onChange={(e) => setForm({ ...form, amount: e.target.value })}
                    className="rounded-2xl border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-950/50 font-bold"
                  />
                </div>
              )}

              {activeTab === 'loads' && (
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-400">{isRTL ? 'جۆری بار (Load Type)' : 'Load Type'}</label>
                  <Input
                    type="text"
                    placeholder={isRTL ? 'مثلاً: باری کانتینەر / بەشی ژوور' : 'Container / Room Load'}
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    className="rounded-2xl border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-950/50"
                  />
                </div>
              )}

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-600 dark:text-slate-400">{isRTL ? 'تێبینی' : 'Note'}</label>
                <Input
                  type="text"
                  placeholder={isRTL ? 'تێبینی بنووسە...' : 'Write note...'}
                  value={form.note}
                  onChange={(e) => setForm({ ...form, note: e.target.value })}
                  className="rounded-2xl border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-950/50"
                />
              </div>

              <Button
                type="submit"
                className="w-full rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-bold py-6 shadow-lg shadow-indigo-600/25"
              >
                <Plus className="h-5 w-5 mr-2" />
                {isRTL ? 'پاشەکەوتکردن' : 'Save Entry'}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Table List Card */}
        <Card className="lg:col-span-2 border-slate-200/80 dark:border-slate-800 shadow-lg rounded-3xl bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <Tag className="h-5 w-5 text-indigo-500" />
                <span>{isRTL ? `لیستی (${activeTab})` : `List of ${activeTab}`}</span>
              </CardTitle>
              <CardDescription>
                {isRTL ? `سەرجەم تۆمارەکان بۆ بەرواری (${selectedDate})` : `All records for ${selectedDate}`}
              </CardDescription>
            </div>
            <Badge variant="outline" className="rounded-xl text-indigo-600 border-indigo-300 bg-indigo-50 dark:bg-indigo-950/40">
              {filteredRecords.length} {isRTL ? 'تۆمار' : 'Items'}
            </Badge>
          </CardHeader>
          <CardContent>
            {filteredRecords.length === 0 ? (
              <div className="text-center py-12 text-slate-400 space-y-3">
                <Package className="h-12 w-12 mx-auto opacity-30" />
                <p className="font-medium">{isRTL ? 'هیچ داتایەک نەدۆزرایەوە' : 'No records found'}</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-slate-100 dark:border-slate-800">
                      <TableHead>{isRTL ? 'بەروار' : 'Date'}</TableHead>
                      <TableHead>{isRTL ? 'ناوی کارمەند' : 'Employee'}</TableHead>
                      <TableHead>{isRTL ? 'بڕی پارە (IQD)' : 'Amount'}</TableHead>
                      <TableHead>{isRTL ? 'تێبینی/وەسف' : 'Details'}</TableHead>
                      <TableHead className="no-print text-right">{isRTL ? 'کردارەکان' : 'Actions'}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRecords.map((r: any) => (
                      <TableRow key={r.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 border-slate-100 dark:border-slate-800">
                        <TableCell className="text-sm font-medium">{r.date}</TableCell>
                        <TableCell className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                          <User className="h-4 w-4 text-indigo-500" />
                          {r.employeeName || r.employeeId || 'گشتی'}
                        </TableCell>
                        <TableCell className="font-extrabold text-emerald-600 dark:text-emerald-400">
                          {Number(r.amount || 0).toLocaleString()} IQD
                        </TableCell>
                        <TableCell className="text-slate-500 text-sm">{r.description || r.note || '-'}</TableCell>
                        <TableCell className="no-print text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(r.id)}
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
    </div>
  );
}

export default withAuth(InputsPage);
