'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  UserRole,
  ROLE_OPTIONS,
  WORKFLOW_ACTIONS,
  WorkflowConfiguration,
  fetchWorkflowConfiguration,
  saveWorkflowConfiguration,
  getDefaultEmployeeRoles,
  getDefaultTaskAssignments,
  resolveEmployeeRole,
  getDynamicEmployeeTelegramKeyboard,
} from '@/lib/workflow/workflow-service';
import { ASHLEY_OFFICIAL_EMPLOYEES } from '@/lib/ashley-employees';
import { 
  Save, 
  RefreshCw, 
  Trash2, 
  X, 
  Search, 
  Users, 
  CheckCircle2, 
  Sparkles, 
  Check, 
  Palmtree, 
  Megaphone, 
  UserX, 
  CalendarOff, 
  Clock, 
  Smartphone, 
  Maximize2,
  Minimize2,
  Filter,
  Activity,
  Building2,
  Truck,
  ArrowRightLeft,
  GripVertical,
  Plus,
  Eye,
  CheckCheck,
  Send,
  SlidersHorizontal,
  Info,
  FileText,
  User,
  Calendar,
  MapPin,
  Cpu,
  Bot,
  Zap,
  Receipt,
  Wallet,
  BellOff,
} from 'lucide-react';
import { TelegramBotSimulatorModal } from '@/components/admin/TelegramBotSimulatorModal';

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Palmtree,
  CheckCircle2,
  Megaphone,
  UserX,
  CalendarOff,
  ClockAlert: Clock,
  Clock,
  Smartphone,
  Activity,
  Building2,
  Truck,
  FileText,
  User,
  Calendar,
  MapPin,
  Cpu,
  Zap,
  Receipt,
  Wallet,
};

// Map each task to its exact Telegram reply keyboard button label
const TELEGRAM_BUTTON_LABELS: Record<string, string> = {
  self_checkin: '🟢 تۆمارکردنی هاتن / 🔴 دەرچوون',
  today_status: '📊 دۆخی دەوامی ئەمڕۆم',
  monthly_report: '📅 دۆخی دەوامی ئەم مانگەم',
  view_profile: '👤 پرۆفایلی من',
  work_locations: 'ℹ️ شوێنەکانی دەوام',
  request_leave: '🏖️ داواکردنی مۆڵەت',
  leave_approval: '🏖️ داواکارییەکانی مۆڵەت',
  broadcast_msg: '📢 ناردنی ئاگاداری گشتی',
  mark_absence: '❌ تۆمارکردنی غیاب',
  set_holiday: '🌴 دیاریکردنی پشوو',
  device_management: '📱 بەستنەوەی ئامێرەکان',
  view_attendance: '📋 لیستی ئامادەبووانی ئەمڕۆ',
  warehouse_attendance: '📦 ئامادەبووانی کۆگا',
  transport_attendance: '🚚 ستافی نقڵ و گواستنەوە',
  system_diagnostics: '🔍 پشکنینی سیستەم',
  late_alerts: '⏰ ئاگاداری دواکەوتنی دەوام (نۆتیفیکەیشن)',
  quick_checkin_no_gps: '⚡ تۆمارکردنی خێرا (بەبێ GPS)',
  request_expense: '💸 داواکردنی مەسروفات',
  approve_expense: '💰 پەسەندکردنی مەسروفات',
};

export default function NotificationRoutingMatrix() {
  // State
  const [employeeRoles, setEmployeeRoles] = useState<Record<string, UserRole>>({});
  const [taskAssignments, setTaskAssignments] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Fullscreen state
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Column 1 (Right): Employee Selection & Search
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState<'all' | 'sales' | 'warehouse' | 'transport' | 'admin'>('all');
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>([]);
  const [batchTargetTask, setBatchTargetTask] = useState<string>('request_leave');

  // Drag and drop state
  const [draggedEmployeeIds, setDraggedEmployeeIds] = useState<string[]>([]);
  const [dragOverTaskId, setDragOverTaskId] = useState<string | null>(null);

  // Column 2 (Left): Task search & category filter
  const [taskSearch, setTaskSearch] = useState('');
  const [taskCategoryFilter, setTaskCategoryFilter] = useState<'all' | 'attendance' | 'leave' | 'admin'>('all');

  // Telegram Simulator Modal
  const [simulatorOpen, setSimulatorOpen] = useState(false);
  const [simulatorEmpId, setSimulatorEmpId] = useState<string>('emp-02');

  // 1. Load configuration from Supabase on mount
  const loadConfig = useCallback(async (force = false) => {
    setLoading(true);
    try {
      const config = await fetchWorkflowConfiguration(force);
      setEmployeeRoles(config.employeeRoles || getDefaultEmployeeRoles());
      setTaskAssignments(config.taskAssignments || getDefaultTaskAssignments());
    } catch (err) {
      console.error('Failed to load workflow configuration:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  // Save changes to Supabase
  const handleSave = async () => {
    setSaving(true);
    setSaveSuccess(false);
    try {
      const updatedConfig: WorkflowConfiguration = {
        employeeRoles,
        taskAssignments,
        connections: [], // populated automatically in saveWorkflowConfiguration
      };
      const ok = await saveWorkflowConfiguration(updatedConfig);
      if (ok) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3500);
      }
    } catch (err) {
      console.error('Error saving:', err);
    } finally {
      setSaving(false);
    }
  };

  // Reset to default configuration
  const handleResetToDefaults = () => {
    if (confirm('ئایا دڵنیایت لە گەڕاندنەوەی سەرجەم ئەرکەکان بۆ باری بنەڕەتی؟')) {
      setTaskAssignments(getDefaultTaskAssignments());
    }
  };

  // Filter employees
  const filteredEmployees = useMemo(() => {
    return ASHLEY_OFFICIAL_EMPLOYEES.filter((emp) => {
      const query = employeeSearch.toLowerCase().trim();
      const matchesSearch = 
        !query ||
        emp.name.toLowerCase().includes(query) ||
        (emp.fullName3Part && emp.fullName3Part.toLowerCase().includes(query)) ||
        emp.id.toLowerCase().includes(query) ||
        (emp.employeeId && emp.employeeId.includes(query)) ||
        (emp.phone && emp.phone.includes(query));

      if (!matchesSearch) return false;

      const role = (emp.role || '').toLowerCase();
      const name = emp.name.toLowerCase();

      if (departmentFilter === 'sales') {
        return role.includes('فرۆشیار') || role.includes('sales') || name.includes('فرۆشیار');
      }
      if (departmentFilter === 'warehouse') {
        return role.includes('کۆگا') || role.includes('warehouse') || name.includes('کامەران') || name.includes('شادیار');
      }
      if (departmentFilter === 'transport') {
        return role.includes('نقڵ') || role.includes('transport') || name.includes('هەڤاڵ');
      }
      if (departmentFilter === 'admin') {
        return role.includes('manager') || role.includes('بەڕێوەبەر') || role.includes('ئیدارە') || role.includes('کاشێر') || name.includes('دارکۆ') || name.includes('وەلید');
      }

      return true;
    });
  }, [employeeSearch, departmentFilter]);

  // Filter tasks with category tabs and search
  const filteredTasks = useMemo(() => {
    return WORKFLOW_ACTIONS.filter((t) => {
      if (taskCategoryFilter === 'attendance') {
        const isAtt = ['self_checkin', 'today_status', 'monthly_report', 'view_profile', 'work_locations'].includes(t.id);
        if (!isAtt) return false;
      } else if (taskCategoryFilter === 'leave') {
        const isLeave = ['request_leave', 'leave_approval', 'mark_absence', 'set_holiday'].includes(t.id);
        if (!isLeave) return false;
      } else if (taskCategoryFilter === 'admin') {
        const isAdmin = ['broadcast_msg', 'device_management', 'view_attendance', 'warehouse_attendance', 'transport_attendance', 'system_diagnostics', 'late_alerts'].includes(t.id);
        if (!isAdmin) return false;
      }

      if (!taskSearch.trim()) return true;
      const q = taskSearch.toLowerCase().trim();
      return (
        t.title.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        t.id.includes(q) ||
        (TELEGRAM_BUTTON_LABELS[t.id] && TELEGRAM_BUTTON_LABELS[t.id].toLowerCase().includes(q))
      );
    });
  }, [taskSearch, taskCategoryFilter]);

  // Toggle single employee selection
  const toggleEmployeeSelect = (empId: string) => {
    setSelectedEmployeeIds(prev =>
      prev.includes(empId) ? prev.filter(id => id !== empId) : [...prev, empId]
    );
  };

  // Toggle select all
  const toggleSelectAll = () => {
    if (selectedEmployeeIds.length === filteredEmployees.length) {
      setSelectedEmployeeIds([]);
    } else {
      setSelectedEmployeeIds(filteredEmployees.map(e => e.id));
    }
  };

  // Assign multiple employees to a task
  const assignEmployeesToTask = (taskId: string, empIds: string[]) => {
    if (empIds.length === 0) return;
    setTaskAssignments(prev => {
      const existing = prev[taskId] || [];
      const updated = Array.from(new Set([...existing, ...empIds]));
      return { ...prev, [taskId]: updated };
    });
  };

  // Remove single employee from a task
  const removeEmployeeFromTask = (taskId: string, empId: string) => {
    setTaskAssignments(prev => {
      const existing = prev[taskId] || [];
      return { ...prev, [taskId]: existing.filter(id => id !== empId) };
    });
  };

  // Assign all employees to a task
  const assignAllToTask = (taskId: string) => {
    const allIds = ASHLEY_OFFICIAL_EMPLOYEES.map(e => e.id);
    setTaskAssignments(prev => ({
      ...prev,
      [taskId]: allIds,
    }));
  };

  // Clear all employees from a task
  const clearTask = (taskId: string) => {
    setTaskAssignments(prev => ({
      ...prev,
      [taskId]: [],
    }));
  };

  // Drag handlers
  const handleDragStart = (empId: string, e: React.DragEvent) => {
    // If the dragged item is already in selection, drag all selected; otherwise drag only this one
    const idsToDrag = selectedEmployeeIds.includes(empId) && selectedEmployeeIds.length > 0
      ? selectedEmployeeIds
      : [empId];
    setDraggedEmployeeIds(idsToDrag);
    e.dataTransfer.setData('text/plain', JSON.stringify(idsToDrag));
    e.dataTransfer.effectAllowed = 'copyMove';
  };

  const handleDropOnTask = (taskId: string, e: React.DragEvent) => {
    e.preventDefault();
    setDragOverTaskId(null);
    let idsToAdd: string[] = [];
    try {
      const raw = e.dataTransfer.getData('text/plain');
      if (raw) idsToAdd = JSON.parse(raw);
    } catch {
      idsToAdd = draggedEmployeeIds;
    }
    if (!idsToAdd || idsToAdd.length === 0) idsToAdd = draggedEmployeeIds;
    if (idsToAdd.length > 0) {
      assignEmployeesToTask(taskId, idsToAdd);
    }
    setDraggedEmployeeIds([]);
  };

  // Count how many tasks an employee is assigned to
  const getEmployeeTaskCount = (empId: string) => {
    let count = 0;
    Object.values(taskAssignments).forEach(ids => {
      if (Array.isArray(ids) && ids.includes(empId)) count++;
    });
    return count;
  };

  // Helper to get employee info by id
  const getEmp = (id: string) => {
    return ASHLEY_OFFICIAL_EMPLOYEES.find(e => e.id === id || e.employeeId === id);
  };

  return (
    <div className={`flex flex-col bg-[#f8fafc] rounded-2xl border border-slate-200 overflow-hidden shadow-sm transition-all duration-300 ${isFullscreen ? 'fixed inset-0 z-50 rounded-none' : 'w-full'}`} dir="rtl">
      
      {/* 1. TOP HEADER & TOOLBAR */}
      <div className="bg-white/95 backdrop-blur-md border-b border-slate-200 p-4 sm:px-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-blue-500 flex items-center justify-center shadow-md shadow-indigo-500/20 text-white">
              <ArrowRightLeft className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
                <span>دەسەڵاتەکانی تەلەگرام</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                دیاریکردنی ئەرک و دوگمەکانی کارمەندان لە بۆتی تەلەگرام
              </p>
            </div>
          </div>
        </div>

        {/* Global Action Buttons */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-end">
          {/* Simulator Preview Button */}
          <button
            onClick={() => setSimulatorOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl bg-sky-600 hover:bg-sky-700 text-white shadow-sm active:scale-95 transition-all cursor-pointer"
            title="تاقیکردنەوەی ڕاستەوخۆی بۆتی تەلەگرام"
          >
            <Bot className="w-4 h-4 text-sky-100" />
            <span>تاقیکردنەوە</span>
          </button>

          {/* Refresh Button */}
          <button
            onClick={() => loadConfig(true)}
            disabled={loading}
            className="p-2 text-xs font-bold rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200 transition-all shadow-xs"
            title="نوێکردنەوە لە سوپابەیس"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-indigo-500' : ''}`} />
          </button>

          {/* Reset Defaults Button */}
          <button
            onClick={handleResetToDefaults}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 transition-all shadow-xs"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>باری سەرەتایی</span>
          </button>

          {/* Save Button */}
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2 text-xs font-black rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white shadow-md shadow-indigo-600/20 active:scale-95 transition-all"
          >
            {saving ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : saveSuccess ? (
              <Check className="w-4 h-4 text-emerald-300" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            <span>{saving ? 'پاشەکەوت دەکرێت...' : saveSuccess ? 'پاشەکەوت کرا!' : 'پاشەکەوتکردنی گۆڕانکاری'}</span>
          </button>

          {/* Fullscreen Toggle */}
          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-2 rounded-xl text-slate-500 hover:text-slate-700 bg-slate-100 border border-slate-200 transition-all"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Success banner */}
      {saveSuccess && (
        <div className="bg-emerald-50 border-b border-emerald-200 px-6 py-2.5 flex items-center justify-between animate-in fade-in">
          <div className="flex items-center gap-2 text-xs font-bold text-emerald-800">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>دەسەڵاتە نوێیەکان لە سوپابەیس پاشەکەوت کران و ڕاستەوخۆ بەسەر بۆتی تەلەگرامدا جێبەجێ کران.</span>
          </div>
          <span className="text-[10px] text-emerald-600 font-mono">Live In Sync</span>
        </div>
      )}

      {/* 2. MAIN TWO-COLUMN WORKSPACE */}
      <div className="p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-0 relative">
        
        {/* ========================================================= */}
        {/* RIGHT COLUMN: EMPLOYEES (کارمەندەکان)                     */}
        {/* ========================================================= */}
        <div className="lg:col-span-5 flex flex-col pl-0 lg:pl-4 space-y-4">
          
          {/* Column Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-indigo-600" />
              <h3 className="text-base font-black text-slate-900">
                کارمەندان ({filteredEmployees.length} لە ٢١)
              </h3>
            </div>
            <span className="text-xs text-slate-500">
              {selectedEmployeeIds.length > 0 ? (
                <span className="font-bold text-indigo-600">
                  {selectedEmployeeIds.length} کارمەند هەڵبژێردراوە
                </span>
              ) : (
                'ڕایبکێشە بۆ سەر ئەرکەکان'
              )}
            </span>
          </div>

          {/* Department Filter Tabs */}
          <div className="flex flex-wrap gap-1.5 p-1 bg-slate-100 rounded-xl border border-slate-200/60">
            {[
              { id: 'all', label: 'هەمووان' },
              { id: 'admin', label: 'ئیدارە' },
              { id: 'sales', label: 'فرۆشتن' },
              { id: 'warehouse', label: 'کۆگا' },
              { id: 'transport', label: 'نقڵ' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setDepartmentFilter(tab.id as any)}
                className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                  departmentFilter === tab.id
                    ? 'bg-white text-indigo-600 shadow-2xs font-black'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Search Box */}
          <div className="relative">
            <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={employeeSearch}
              onChange={(e) => setEmployeeSearch(e.target.value)}
              placeholder="گەڕان بەپێی ناوی کارمەند، کۆد، مۆبایل..."
              className="w-full pl-8 pr-9 py-2 text-xs rounded-xl bg-white border border-slate-200/90 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 shadow-2xs"
            />
            {employeeSearch && (
              <button 
                onClick={() => setEmployeeSearch('')}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Multi-Selection Control Bar */}
          <div className="p-2.5 rounded-xl bg-indigo-50/70 border border-indigo-100 flex flex-wrap items-center justify-between gap-2 shadow-2xs">
            <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-700">
              <input
                type="checkbox"
                checked={selectedEmployeeIds.length > 0 && selectedEmployeeIds.length === filteredEmployees.length}
                onChange={toggleSelectAll}
                className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
              />
              <span>دەستنیشانکردنی هەمووان ({filteredEmployees.length})</span>
            </label>

            {selectedEmployeeIds.length > 0 && (
              <div className="flex items-center gap-2">
                <select
                  value={batchTargetTask}
                  onChange={(e) => setBatchTargetTask(e.target.value)}
                  className="px-2 py-1 text-xs rounded-lg bg-white border border-slate-200 font-bold text-slate-800 shadow-2xs"
                >
                  {WORKFLOW_ACTIONS.map(act => (
                    <option key={act.id} value={act.id}>{act.title}</option>
                  ))}
                </select>
                <button
                  onClick={() => {
                    assignEmployeesToTask(batchTargetTask, selectedEmployeeIds);
                    setSelectedEmployeeIds([]);
                  }}
                  className="px-2.5 py-1 text-xs font-bold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-1 shadow-xs transition-all active:scale-95"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>زیادکردن ({selectedEmployeeIds.length})</span>
                </button>
              </div>
            )}
          </div>

          {/* Scrollable Employee Cards List */}
          <div className="space-y-2 max-h-[calc(100vh-280px)] overflow-y-auto pr-1">
            {filteredEmployees.map((emp) => {
              const isSelected = selectedEmployeeIds.includes(emp.id);
              const taskCount = getEmployeeTaskCount(emp.id);
              const role = resolveEmployeeRole(emp.id, emp.name, employeeRoles);
              const roleObj = ROLE_OPTIONS.find(r => r.id === role);

              return (
                <div
                  key={emp.id}
                  draggable={true}
                  onDragStart={(e) => handleDragStart(emp.id, e)}
                  onClick={() => toggleEmployeeSelect(emp.id)}
                  className={`p-3 rounded-xl border transition-all cursor-grab active:cursor-grabbing flex items-center justify-between gap-3 select-none ${
                    isSelected
                      ? 'bg-indigo-50/90 border-indigo-400 shadow-sm ring-1 ring-indigo-500'
                      : 'bg-white border-slate-200/90 hover:border-indigo-300 shadow-2xs'
                  }`}
                >
                  {/* Left: Checkbox + Grip + Avatar + Info */}
                  <div className="flex items-center gap-2.5">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={(e) => {
                        e.stopPropagation();
                        toggleEmployeeSelect(emp.id);
                      }}
                      className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
                    />

                    <GripVertical className="w-4 h-4 text-slate-400 hover:text-slate-600 shrink-0" />

                    {/* Avatar */}
                    <div className="w-9 h-9 rounded-xl overflow-hidden bg-slate-100 border border-slate-200 shrink-0 flex items-center justify-center font-bold text-xs text-indigo-600 shadow-2xs">
                      {emp.photoUrl ? (
                        <img 
                          src={emp.photoUrl} 
                          alt={emp.name} 
                          className="w-full h-full object-cover" 
                          onError={(e) => {
                            (e.currentTarget as HTMLElement).style.display = 'none';
                          }}
                        />
                      ) : (
                        emp.name.charAt(0)
                      )}
                    </div>

                    <div>
                      <div className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                        <span>{emp.name}</span>
                        <span className="text-[10px] text-slate-400 font-mono">({emp.employeeId})</span>
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span 
                          className="text-[9px] font-bold px-1.5 py-0.2 rounded-md"
                          style={{
                            backgroundColor: `${roleObj?.color || '#64748B'}15`,
                            color: roleObj?.color || '#64748B',
                          }}
                        >
                          {roleObj?.badge || emp.role}
                        </span>
                        {emp.phone && (
                          <span className="text-[9px] text-slate-400 font-mono dir-ltr">{emp.phone}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right: Assigned Tasks Counter badge */}
                  <div className="shrink-0 text-left">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                      taskCount > 0 
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200/80'
                        : 'bg-slate-100 text-slate-500 border-slate-200'
                    }`}>
                      {taskCount} ئەرک
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ========================================================= */}
        {/* CENTER DIVIDER LINE (هێڵی لە نێوان دا بێت)                 */}
        {/* ========================================================= */}
        <div className="hidden lg:flex lg:col-span-1 items-center justify-center relative">
          <div className="h-full w-px bg-gradient-to-b from-transparent via-indigo-300 to-transparent relative">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 p-2.5 rounded-full bg-white border border-indigo-200 shadow-xs text-indigo-600 z-10 flex items-center justify-center">
              <ArrowRightLeft className="w-4 h-4" />
            </div>
          </div>
        </div>

        {/* ========================================================= */}
        {/* LEFT COLUMN: TASKS & TELEGRAM BUTTONS (ئەرکەکان)         */}
        {/* ========================================================= */}
        <div className="lg:col-span-6 flex flex-col pr-0 lg:pr-4 space-y-4 mt-6 lg:mt-0">
          
          {/* Column Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-indigo-600" />
              <h3 className="text-base font-black text-slate-900">
                ئەرکەکان و دوگمەکانی تەلەگرام ({filteredTasks.length})
              </h3>
            </div>
            <span className="text-xs text-slate-500">
              {draggedEmployeeIds.length > 0 ? (
                <span className="text-indigo-600 font-bold animate-pulse">
                  لێرە بەری بدە بۆ زیادکردن!
                </span>
              ) : (
                'کارمەندان لێرە بەردە تا دوگمەکە ببینن'
              )}
            </span>
          </div>

          {/* Task Search Box */}
          <div className="relative">
            <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={taskSearch}
              onChange={(e) => setTaskSearch(e.target.value)}
              placeholder="گەڕان لەناو ئەرک و دوگمەکانی تەلەگرام..."
              className="w-full pl-8 pr-9 py-2 text-xs rounded-xl bg-white border border-slate-200/90 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 shadow-2xs"
            />
          </div>

          {/* Task Category Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
            <button
              onClick={() => setTaskCategoryFilter('all')}
              className={`px-3 py-1 rounded-lg font-bold transition-all shrink-0 ${
                taskCategoryFilter === 'all'
                  ? 'bg-indigo-600 text-white shadow-2xs'
                  : 'bg-white text-slate-600 border border-slate-200/80 hover:border-indigo-300'
              }`}
            >
              هەموو دوگمەکان ({WORKFLOW_ACTIONS.length})
            </button>
            <button
              onClick={() => setTaskCategoryFilter('attendance')}
              className={`px-3 py-1 rounded-lg font-bold transition-all shrink-0 ${
                taskCategoryFilter === 'attendance'
                  ? 'bg-emerald-600 text-white shadow-2xs'
                  : 'bg-white text-slate-600 border border-slate-200/80 hover:border-emerald-300'
              }`}
            >
              دەوام و دۆخ (٥)
            </button>
            <button
              onClick={() => setTaskCategoryFilter('leave')}
              className={`px-3 py-1 rounded-lg font-bold transition-all shrink-0 ${
                taskCategoryFilter === 'leave'
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'bg-white text-slate-600 border border-slate-200/80 hover:border-blue-300'
              }`}
            >
              مۆڵەت و پشوو (٤)
            </button>
            <button
              onClick={() => setTaskCategoryFilter('admin')}
              className={`px-3 py-1 rounded-lg font-bold transition-all shrink-0 ${
                taskCategoryFilter === 'admin'
                  ? 'bg-purple-600 text-white shadow-2xs'
                  : 'bg-white text-slate-600 border border-slate-200/80 hover:border-purple-300'
              }`}
            >
              ئیدارە و کۆگا (٧)
            </button>
          </div>

          {/* Scrollable Tasks List with Drop Zones */}
          <div className="space-y-3 max-h-[calc(100vh-280px)] overflow-y-auto pr-1">
            {filteredTasks.map((task) => {
              const assignedEmpIds = taskAssignments[task.id] || [];
              const IconComp = ICON_MAP[task.iconName] || Palmtree;
              const isDragOver = dragOverTaskId === task.id;
              const buttonText = TELEGRAM_BUTTON_LABELS[task.id] || task.title;

              return (
                <div
                  key={task.id}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOverTaskId(task.id);
                  }}
                  onDragLeave={() => setDragOverTaskId(null)}
                  onDrop={(e) => handleDropOnTask(task.id, e)}
                  className={`p-4 rounded-2xl border transition-all duration-200 relative ${
                    isDragOver
                      ? 'bg-indigo-50/90 border-indigo-500 ring-2 ring-indigo-500 shadow-md scale-[1.01]'
                      : 'bg-white border-slate-200/90 hover:border-slate-300 shadow-2xs'
                  }`}
                >
                  {/* Task Card Header */}
                  <div className="flex items-start justify-between gap-3 mb-2.5">
                    <div className="flex items-start gap-3">
                      <div 
                        className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-2xs text-white"
                        style={{ backgroundColor: task.color || '#007AFF' }}
                      >
                        <IconComp className="w-5 h-5" />
                      </div>

                      <div>
                        <h4 className="text-sm font-black text-slate-900 flex items-center gap-2">
                          {task.title}
                        </h4>
                        <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">
                          {task.description}
                        </p>

                        {/* Telegram Button Badge */}
                        <div className="flex items-center gap-1.5 mt-1.5">
                          <span className="text-[10px] text-slate-400">دوگمەی تەلەگرام:</span>
                          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-slate-100 text-indigo-700 border border-slate-200 flex items-center gap-1">
                            <Send className="w-2.5 h-2.5 text-indigo-500" />
                            {buttonText}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Right: Counter badge */}
                    <div className="shrink-0 text-left">
                      <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full border ${
                        assignedEmpIds.length > 0
                          ? 'bg-indigo-50 text-indigo-700 border-indigo-200/80'
                          : 'bg-rose-50 text-rose-700 border-rose-200/80 flex items-center gap-1'
                      }`}>
                        {assignedEmpIds.length > 0 ? (
                          `${assignedEmpIds.length} کارمەند دەیبینن`
                        ) : (
                          <>
                            <BellOff className="w-3 h-3 text-rose-500" />
                            <span>لە کەس دەرناکەوێت</span>
                          </>
                        )}
                      </span>
                    </div>
                  </div>

                  {/* Drop Zone / Assigned Employees Container */}
                  <div className="mt-3 pt-3 border-t border-slate-100">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-slate-600">
                        کارمەندە ڕێپێدراوەکان بۆ ئەم ئەرکە:
                      </span>

                      {/* Quick Utility Buttons */}
                      <div className="flex items-center gap-2">
                        {selectedEmployeeIds.length > 0 && (
                          <button
                            onClick={() => assignEmployeesToTask(task.id, selectedEmployeeIds)}
                            className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-1 shadow-2xs active:scale-95 transition-all"
                          >
                            <Plus className="w-3 h-3" />
                            <span>زیادکردنی ({selectedEmployeeIds.length}) هەڵبژێردراو</span>
                          </button>
                        )}
                        <button
                          onClick={() => assignAllToTask(task.id)}
                          className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-slate-100 hover:bg-slate-200 text-slate-600 border border-slate-200 transition-colors"
                        >
                          + هەمووان
                        </button>
                        {assignedEmpIds.length > 0 && (
                          <button
                            onClick={() => clearTask(task.id)}
                            className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 transition-colors"
                          >
                            سڕینەوەی هەموو
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Chips list of assigned employees */}
                    {assignedEmpIds.length === 0 ? (
                      <div className="p-3 rounded-xl border border-dashed border-slate-200 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
                        <BellOff className="w-4 h-4 text-slate-400" />
                        <span>هیچ کارمەندێک بۆ ئەم ئەرکە دیاری نەکراوە — ئەم دوگمەیە لە تەلەگرامی هیچ کەسێکدا دەرناکەوێت.</span>
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto p-1">
                        {assignedEmpIds.map(empId => {
                          const emp = getEmp(empId);
                          const name = emp?.name || empId;
                          const role = resolveEmployeeRole(empId, name, employeeRoles);
                          const roleObj = ROLE_OPTIONS.find(r => r.id === role);

                          return (
                            <div
                              key={empId}
                              className="inline-flex items-center gap-1.5 pl-1.5 pr-2 py-1 rounded-lg bg-slate-100 border border-slate-200/80 text-xs font-bold text-slate-800 shadow-2xs group"
                            >
                              <div className="w-4 h-4 rounded-full overflow-hidden bg-slate-200 shrink-0 text-[8px] flex items-center justify-center font-mono">
                                {emp?.photoUrl ? (
                                  <img 
                                    src={emp.photoUrl} 
                                    alt={name} 
                                    className="w-full h-full object-cover" 
                                    onError={(e) => { (e.currentTarget as HTMLElement).style.display = 'none'; }}
                                  />
                                ) : (
                                  name.charAt(0)
                                )}
                              </div>
                              <span className="text-[11px] truncate max-w-[120px]">{name}</span>
                              <span 
                                className="text-[9px] px-1 rounded-sm"
                                style={{
                                  backgroundColor: `${roleObj?.color || '#64748B'}20`,
                                  color: roleObj?.color || '#64748B'
                                }}
                              >
                                {roleObj?.badge || 'کارمەند'}
                              </span>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  removeEmployeeFromTask(task.id, empId);
                                }}
                                className="w-3.5 h-3.5 rounded-full hover:bg-rose-200 text-slate-400 hover:text-rose-600 flex items-center justify-center transition-colors mr-0.5 cursor-pointer"
                                title="لابردن لەم ئەرکە"
                              >
                                <X className="w-2.5 h-2.5" />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>

      {/* ========================================================= */}
      {/* 3. INTERACTIVE TELEGRAM BOT SIMULATOR MODAL               */}
      {/* ========================================================= */}
      <TelegramBotSimulatorModal
        isOpen={simulatorOpen}
        onClose={() => setSimulatorOpen(false)}
        defaultEmployeeId={selectedEmployeeIds[0] || simulatorEmpId || 'emp-01'}
      />

    </div>
  );
}
