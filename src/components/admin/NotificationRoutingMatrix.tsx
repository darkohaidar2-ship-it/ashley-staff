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
} from 'lucide-react';

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
};

// Map each task to its exact Telegram reply keyboard button label
const TELEGRAM_BUTTON_LABELS: Record<string, string> = {
  request_leave: '🏖️ داواکردنی مۆڵەت',
  leave_approval: '🏖️ داواکارییەکانی مۆڵەت',
  broadcast_msg: '📢 ناردنی ئاگاداری گشتی',
  mark_absence: '❌ تۆمارکردنی غیاب',
  set_holiday: '🌴 دیاریکردنی پشوو',
  device_management: '📱 بەستنەوەی ئامێرەکان',
  view_attendance: '📋 لیستی ئامادەبووانی ئەمڕۆ',
  warehouse_attendance: '📦 ئامادەبووانی کۆگا',
  transport_attendance: '🚚 ستافی نقڵ و گواستنەوە',
  late_alerts: '⏰ ئاگاداری دواکەوتنی دەوام (نۆتیفیکەیشن)',
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

  // Column 2 (Left): Task search
  const [taskSearch, setTaskSearch] = useState('');

  // Telegram Simulator Modal
  const [simulatorOpen, setSimulatorOpen] = useState(false);
  const [simulatorEmpId, setSimulatorEmpId] = useState<string>('emp-02');
  const [simulatorKeyboard, setSimulatorKeyboard] = useState<any>(null);

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

  // Update simulator keyboard when previewing an employee
  useEffect(() => {
    async function updateSim() {
      if (simulatorOpen && simulatorEmpId) {
        const kb = await getDynamicEmployeeTelegramKeyboard(simulatorEmpId);
        setSimulatorKeyboard(kb);
      }
    }
    updateSim();
  }, [simulatorOpen, simulatorEmpId, taskAssignments]);

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

  // Filter tasks
  const filteredTasks = useMemo(() => {
    if (!taskSearch.trim()) return WORKFLOW_ACTIONS;
    const q = taskSearch.toLowerCase().trim();
    return WORKFLOW_ACTIONS.filter(
      t => t.title.toLowerCase().includes(q) || t.description.toLowerCase().includes(q) || t.id.includes(q)
    );
  }, [taskSearch]);

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
    <div className={`flex flex-col bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-white/10 overflow-hidden shadow-xl transition-all duration-300 ${isFullscreen ? 'fixed inset-0 z-50 rounded-none' : 'w-full'}`} dir="rtl">
      
      {/* 1. TOP HEADER & TOOLBAR */}
      <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-white/10 p-4 sm:px-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-blue-500 flex items-center justify-center shadow-md shadow-indigo-500/20 text-white">
              <ArrowRightLeft className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                ماتریسی دەسەڵات و دوگمەکانی تەلەگرام
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 font-bold">
                  سیستەمی نوێی ٢ ستوون
                </span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                کارمەندان ڕابکێشە بۆ سەر هەر ئەرکێک تاوەکو ڕاستەوخۆ لە بۆتی تەلەگرام ئەو دوگمەیە ببینن.
              </p>
            </div>
          </div>
        </div>

        {/* Global Action Buttons */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-end">
          {/* Simulator Preview Button */}
          <button
            onClick={() => setSimulatorOpen(true)}
            className="flex items-center gap-2 px-3 py-2 text-xs font-bold rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-white/10 transition-all shadow-xs"
            title="پشکنینی شێوازی تەلەگرام لای کارمەند"
          >
            <Smartphone className="w-4 h-4 text-indigo-500" />
            <span>پشکنینی بۆتی تەلەگرام</span>
          </button>

          {/* Refresh Button */}
          <button
            onClick={() => loadConfig(true)}
            disabled={loading}
            className="p-2 text-xs font-bold rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-white/10 transition-all shadow-xs"
            title="نوێکردنەوە لە سوپابەیس"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-indigo-500' : ''}`} />
          </button>

          {/* Reset Defaults Button */}
          <button
            onClick={handleResetToDefaults}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 hover:bg-rose-100 border border-rose-200 dark:border-rose-900/50 transition-all shadow-xs"
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
            className="p-2 rounded-xl text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-white bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-white/10 transition-all"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Success banner */}
      {saveSuccess && (
        <div className="bg-emerald-50 dark:bg-emerald-950/80 border-b border-emerald-200 dark:border-emerald-800/80 px-6 py-2.5 flex items-center justify-between animate-in fade-in">
          <div className="flex items-center gap-2 text-xs font-bold text-emerald-800 dark:text-emerald-200">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
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
              <Users className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              <h3 className="text-base font-black text-slate-900 dark:text-white">
                کارمەندان ({filteredEmployees.length} لە ٢١)
              </h3>
            </div>
            <span className="text-xs text-slate-500">
              {selectedEmployeeIds.length > 0 ? (
                <span className="font-bold text-indigo-600 dark:text-indigo-400">
                  {selectedEmployeeIds.length} کارمەند هەڵبژێردراوە
                </span>
              ) : (
                'ڕایبکێشە بۆ سەر ئەرکەکان'
              )}
            </span>
          </div>

          {/* Department Filter Tabs */}
          <div className="flex flex-wrap gap-1.5 p-1 bg-slate-200/70 dark:bg-slate-800/60 rounded-xl">
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
                    ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
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
              className="w-full pl-8 pr-9 py-2 text-xs rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
          <div className="p-2.5 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/50 flex flex-wrap items-center justify-between gap-2">
            <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-700 dark:text-slate-300">
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
                  className="px-2 py-1 text-xs rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 font-bold"
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
                  className="px-2.5 py-1 text-xs font-bold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-1 shadow-xs"
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
                      ? 'bg-indigo-50/90 dark:bg-indigo-950/70 border-indigo-400 dark:border-indigo-600 shadow-md ring-1 ring-indigo-500'
                      : 'bg-white dark:bg-slate-900/90 border-slate-200/80 dark:border-white/5 hover:border-indigo-300 dark:hover:border-indigo-800 shadow-xs'
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
                    <div className="w-9 h-9 rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-white/10 shrink-0 flex items-center justify-center font-bold text-xs text-indigo-600">
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
                      <div className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-1.5">
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
                        ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-white/10'
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
          <div className="h-full w-px bg-gradient-to-b from-transparent via-indigo-300 dark:via-indigo-500/50 to-transparent relative">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 p-2.5 rounded-full bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-800 shadow-md text-indigo-600 dark:text-indigo-400 z-10 flex items-center justify-center">
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
              <Sparkles className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              <h3 className="text-base font-black text-slate-900 dark:text-white">
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
              className="w-full pl-8 pr-9 py-2 text-xs rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
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
                      ? 'bg-indigo-50/90 dark:bg-indigo-950/80 border-indigo-500 ring-2 ring-indigo-500 shadow-lg scale-[1.01]'
                      : 'bg-white dark:bg-slate-900 border-slate-200/80 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20 shadow-xs'
                  }`}
                >
                  {/* Task Card Header */}
                  <div className="flex items-start justify-between gap-3 mb-2.5">
                    <div className="flex items-start gap-3">
                      <div 
                        className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-xs text-white"
                        style={{ backgroundColor: task.color || '#007AFF' }}
                      >
                        <IconComp className="w-5 h-5" />
                      </div>

                      <div>
                        <h4 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                          {task.title}
                        </h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1">
                          {task.description}
                        </p>

                        {/* Telegram Button Badge */}
                        <div className="flex items-center gap-1.5 mt-1.5">
                          <span className="text-[10px] text-slate-400">دوگمەی تەلەگرام:</span>
                          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-indigo-700 dark:text-indigo-300 border border-slate-200 dark:border-white/10 flex items-center gap-1">
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
                          ? 'bg-indigo-50 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800'
                          : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-900/50'
                      }`}>
                        {assignedEmpIds.length > 0 ? `${assignedEmpIds.length} کارمەند دەیبینن` : '🔕 لە کەس دەرناکەوێت'}
                      </span>
                    </div>
                  </div>

                  {/* Drop Zone / Assigned Employees Container */}
                  <div className="mt-3 pt-3 border-t border-slate-100 dark:border-white/5">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-slate-600 dark:text-slate-400">
                        کارمەندە ڕێپێدراوەکان بۆ ئەم ئەرکە:
                      </span>

                      {/* Quick Utility Buttons */}
                      <div className="flex items-center gap-2">
                        {selectedEmployeeIds.length > 0 && (
                          <button
                            onClick={() => assignEmployeesToTask(task.id, selectedEmployeeIds)}
                            className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-1 shadow-xs"
                          >
                            <Plus className="w-3 h-3" />
                            <span>زیادکردنی ({selectedEmployeeIds.length}) هەڵبژێردراو</span>
                          </button>
                        )}
                        <button
                          onClick={() => assignAllToTask(task.id)}
                          className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-600 dark:text-slate-300 transition-colors"
                        >
                          + هەمووان
                        </button>
                        {assignedEmpIds.length > 0 && (
                          <button
                            onClick={() => clearTask(task.id)}
                            className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-rose-50 dark:bg-rose-950/30 hover:bg-rose-100 text-rose-600 dark:text-rose-400 transition-colors"
                          >
                            سڕینەوەی هەموو
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Chips list of assigned employees */}
                    {assignedEmpIds.length === 0 ? (
                      <div className="p-3 rounded-xl border border-dashed border-slate-200 dark:border-white/10 text-center text-xs text-slate-400 dark:text-slate-500">
                        🔕 هیچ کارمەندێک بۆ ئەم ئەرکە دیاری نەکراوە — ئەم دوگمەیە لە تەلەگرامی هیچ کەسێکدا دەرناکەوێت.
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
                              className="inline-flex items-center gap-1.5 pl-1.5 pr-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800/90 border border-slate-200 dark:border-white/10 text-xs font-bold text-slate-800 dark:text-slate-200 shadow-2xs group"
                            >
                              <div className="w-4 h-4 rounded-full overflow-hidden bg-slate-200 dark:bg-slate-700 shrink-0 text-[8px] flex items-center justify-center font-mono">
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
                                className="w-3.5 h-3.5 rounded-full hover:bg-rose-200 dark:hover:bg-rose-900/60 text-slate-400 hover:text-rose-600 flex items-center justify-center transition-colors mr-0.5"
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
      {/* 3. TELEGRAM BOT SIMULATOR PREVIEW MODAL                   */}
      {/* ========================================================= */}
      {simulatorOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-white/10 shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95">
            
            {/* Modal Header */}
            <div className="p-4 sm:px-6 border-b border-slate-200 dark:border-white/10 flex items-center justify-between bg-slate-50 dark:bg-slate-950">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white">
                  <Smartphone className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white">
                    پشکنینی دوگمەکانی تەلەگرام (Simulator)
                  </h3>
                  <p className="text-xs text-slate-500">
                    هەر کارمەندێک هەڵبژێرە تا بزانیت کاتێ دەچێتە تەلەگرام کام دوگمانە دەبینێت.
                  </p>
                </div>
              </div>

              <button
                onClick={() => setSimulatorOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-4">
              {/* Employee selector */}
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1.5">
                  کارمەند هەڵبژێرە بۆ پشکنینی دوگمەکانی:
                </label>
                <select
                  value={simulatorEmpId}
                  onChange={(e) => setSimulatorEmpId(e.target.value)}
                  className="w-full p-2.5 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/10 font-bold focus:ring-2 focus:ring-indigo-500"
                >
                  {ASHLEY_OFFICIAL_EMPLOYEES.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name} ({emp.employeeId}) — {emp.role}
                    </option>
                  ))}
                </select>
              </div>

              {/* Telegram Phone Mockup */}
              <div className="p-4 rounded-2xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-white/10 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-white/10">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-xs font-black text-slate-800 dark:text-slate-200">
                      Telegram Attendance Bot
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400">Ashley ERP Live</span>
                </div>

                <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 text-xs leading-relaxed text-slate-800 dark:text-slate-200">
                  سڵاو <b>{getEmp(simulatorEmpId)?.name}</b>، بەخێربێیت بۆ بۆتی فەرمیی دەوامی ئاشڵی. ئەمەش ئەو دوگمانەیە کە بەپێی ماتریسی نوێ لەسەر شاشەی مۆبایلەکەت دەردەکەون:
                </div>

                {/* Keyboard Grid Mockup */}
                <div className="space-y-1.5 pt-2">
                  <div className="text-[11px] font-bold text-slate-500 mb-1">
                    دوگمەکانی خوارەوەی چاتی تەلەگرام (Reply Keyboard):
                  </div>

                  {simulatorKeyboard?.keyboard && simulatorKeyboard.keyboard.length > 0 ? (
                    simulatorKeyboard.keyboard.map((row: any[], rowIdx: number) => (
                      <div key={rowIdx} className="grid grid-cols-2 gap-1.5">
                        {row.map((btn: any, btnIdx: number) => (
                          <div
                            key={btnIdx}
                            className={`p-2.5 rounded-xl text-center text-xs font-bold shadow-xs border transition-all ${
                              btn.text.includes('هاتن')
                                ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-300'
                                : btn.text.includes('دەرچوون')
                                ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-300'
                                : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 border-slate-200 dark:border-white/10'
                            }`}
                          >
                            {btn.text}
                          </div>
                        ))}
                      </div>
                    ))
                  ) : (
                    <div className="p-4 text-center text-xs text-slate-400">
                      هیچ دوگمەیەک بۆ ئەم کارمەندە دەستنیشان نەکراوە.
                    </div>
                  )}
                </div>
              </div>

              {/* Status explanation */}
              <div className="p-3 rounded-xl bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/40 text-xs text-indigo-900 dark:text-indigo-200 flex items-start gap-2">
                <Info className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
                <div>
                  ئەم کارمەندە تەنها ئەو دوگمانە دەبینێت کە بە فەرمی لە ستوونی ڕاستەوە بۆ سەر ئەرکەکان ڕاکێشراون. ئەگەر بۆ هەر ئەرکێک ڕانەکێشرابێت، ئەو دوگمەیە لە تەلەگرام دەشاردرێتەوە و بۆی دەرناکەوێت.
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-200 dark:border-white/10 flex justify-end bg-slate-50 dark:bg-slate-950">
              <button
                onClick={() => setSimulatorOpen(false)}
                className="px-5 py-2 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white"
              >
                تەواو (داخستن)
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
