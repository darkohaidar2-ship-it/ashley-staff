'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { 
  UserRole,
  ROLE_OPTIONS,
  DESTINATION_ROLES,
  WORKFLOW_ACTIONS,
  AUTHORITIES_LIST,
  RECIPIENTS_LIST,
  AuthorityDefinition,
  RecipientDefinition,
  WireConnection,
  WorkflowConfiguration,
  fetchWorkflowConfiguration,
  saveWorkflowConfiguration,
  getDefaultEmployeeRoles,
  getDefaultConnections,
  resolveEmployeeRole,
} from '@/lib/workflow/workflow-service';
import { ASHLEY_OFFICIAL_EMPLOYEES } from '@/lib/ashley-employees';
import { 
  SlidersHorizontal, 
  Zap, 
  Send, 
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
  Eye,
  EyeOff,
  Filter,
  Layers,
  Activity,
  ChevronRight,
  ShieldCheck,
  UserCheck,
  Bell,
  Building2,
  Truck,
  Store,
  Briefcase,
  Code,
  Wrench
} from 'lucide-react';

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Palmtree,
  Megaphone,
  UserX,
  CalendarOff,
  ClockAlert: Clock,
  Smartphone,
  ShieldCheck,
  Building2,
  Truck,
  Store,
  Briefcase,
  Code,
  Wrench,
};

interface ActiveDrawingWire {
  fromType: 'authority' | 'task';
  fromId: string;
  fromName: string;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
}

export default function NotificationRoutingMatrix() {
  // State
  const [employeeRoles, setEmployeeRoles] = useState<Record<string, UserRole>>({});
  const [connections, setConnections] = useState<WireConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  
  // Navigation tabs:
  // 1. 'visual' -> 3-Column Wiring Matrix (دەسەڵاتەکان -> ئەرکەکان -> وەرگرانی ئاگاداری)
  // 2. 'roles' -> Dedicated Employee Role Management (کارمەندان و پلەکانیان)
  // 3. 'simulator' -> Telegram Notification Simulator
  const [activeTab, setActiveTab] = useState<'visual' | 'roles' | 'simulator'>('visual');

  // Fullscreen state
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Focus & Wire visibility mode
  const [focusOnlyMode, setFocusOnlyMode] = useState(false);
  const [hoveredItem, setHoveredItem] = useState<{ type: 'authority' | 'task' | 'recipient' | 'employee'; id: string } | null>(null);
  const [selectedItem, setSelectedItem] = useState<{ type: 'authority' | 'task' | 'recipient' | 'employee'; id: string } | null>(null);
  const [hoveredWireId, setHoveredWireId] = useState<string | null>(null);

  // Column 3 Sub-mode: 'groups' vs 'individual' employees
  const [recipientMode, setRecipientMode] = useState<'groups' | 'individuals'>('groups');
  const [recipientSearch, setRecipientSearch] = useState('');

  // Filters & Search for the dedicated employee roles tab
  const [rolesSearchQuery, setRolesSearchQuery] = useState('');
  const [rolesDepartmentFilter, setRolesDepartmentFilter] = useState<string>('all');

  // Interactive Wiring State
  const [drawingWire, setDrawingWire] = useState<ActiveDrawingWire | null>(null);

  // Simulator State
  const [simTask, setSimTask] = useState<string>('leave_approval');
  const [simEmployeeId, setSimEmployeeId] = useState<string>('emp-06');
  const [simDate, setSimDate] = useState<string>('2026-10-11');
  const [simNote, setSimNote] = useState<string>('سەردانی پزیشک و پشکنین');

  // Refs and Port Coordinates
  const containerRef = useRef<HTMLDivElement>(null);
  const [portCoords, setPortCoords] = useState<Record<string, { x: number; y: number }>>({});

  // 1. Load configuration from Supabase on mount
  useEffect(() => {
    async function load() {
      setLoading(true);
      const config = await fetchWorkflowConfiguration();
      setEmployeeRoles(config.employeeRoles || getDefaultEmployeeRoles());
      setConnections(config.connections || getDefaultConnections());
      setLoading(false);
    }
    load();
  }, []);

  // 2. Measure & update all port positions
  const updatePortCoordinates = useCallback(() => {
    if (!containerRef.current) return;
    const containerRect = containerRef.current.getBoundingClientRect();
    const newCoords: Record<string, { x: number; y: number }> = {};

    const measure = (portId: string) => {
      const el = document.getElementById(portId);
      if (el) {
        const r = el.getBoundingClientRect();
        newCoords[portId] = {
          x: r.left + r.width / 2 - containerRect.left,
          y: r.top + r.height / 2 - containerRect.top,
        };
      }
    };

    // Column 1: Authorities
    AUTHORITIES_LIST.forEach((auth) => {
      measure(`port-auth-out-${auth.id}`);
    });

    // Column 2: Tasks
    WORKFLOW_ACTIONS.forEach((act) => {
      measure(`port-task-in-${act.id}`);
      measure(`port-task-out-${act.id}`);
    });

    // Column 3: Recipients (Groups & Roles)
    RECIPIENTS_LIST.forEach((rec) => {
      measure(`port-rec-in-${rec.id}`);
    });

    // Column 3: Individual Employees
    ASHLEY_OFFICIAL_EMPLOYEES.forEach((emp) => {
      measure(`port-emp-in-${emp.id}`);
    });

    setPortCoords(newCoords);
  }, []);

  useEffect(() => {
    updatePortCoordinates();
    const handleResize = () => updatePortCoordinates();
    window.addEventListener('resize', handleResize);
    const timer = setTimeout(updatePortCoordinates, 300);
    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(timer);
    };
  }, [updatePortCoordinates, loading, activeTab, recipientMode, connections, isFullscreen]);

  // 3. Handle Role Assignment for Employees
  const handleRoleChange = (employeeId: string, newRole: UserRole) => {
    setEmployeeRoles((prev) => ({
      ...prev,
      [employeeId]: newRole,
    }));
  };

  // 4. Save entire configuration to Supabase
  const handleSave = async () => {
    setSaving(true);
    setSaveSuccess(false);
    const ok = await saveWorkflowConfiguration({
      employeeRoles,
      connections,
    });
    setSaving(false);
    if (ok) {
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
    } else {
      alert('❌ هەڵەیەک ڕوویدا لە کاتی هەڵگرتنی نەخشەی بەستەر لە بنکەدراوە.');
    }
  };

  // 5. Reset to defaults
  const handleResetDefaults = () => {
    if (!confirm('ئایا دڵنیایت لە گەڕاندنەوەی هێڵەکان و ڕۆڵەکان بۆ باری پێشنیارکراوی فەرمی کۆمپانیا؟')) return;
    setEmployeeRoles(getDefaultEmployeeRoles());
    setConnections(getDefaultConnections());
  };

  // 6. Clear all wire connections
  const handleClearConnections = () => {
    if (!confirm('ئایا دڵنیایت لە سڕینەوەی سەرجەم هێڵە دەستییەکان؟')) return;
    setConnections([]);
  };

  // 7. Delete a specific connection
  const handleRemoveConnection = (connId: string) => {
    setConnections((prev) => prev.filter((c) => c.id !== connId));
  };

  // 8. Start Drawing a Connection Wire
  const handleStartWire = (
    fromType: 'authority' | 'task', 
    fromId: string, 
    fromName: string, 
    portId: string,
    e: React.MouseEvent
  ) => {
    e.stopPropagation();
    const portPos = portCoords[portId];
    if (!containerRef.current) return;
    const containerRect = containerRef.current.getBoundingClientRect();
    const startX = portPos ? portPos.x : e.clientX - containerRect.left;
    const startY = portPos ? portPos.y : e.clientY - containerRect.top;

    setDrawingWire({
      fromType,
      fromId,
      fromName,
      startX,
      startY,
      currentX: startX,
      currentY: startY,
    });
  };

  // 9. Update live drawing wire position on mouse move
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!drawingWire || !containerRef.current) return;
    const containerRect = containerRef.current.getBoundingClientRect();
    setDrawingWire((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        currentX: e.clientX - containerRect.left,
        currentY: e.clientY - containerRect.top,
      };
    });
  };

  // 10. Complete a wire connection
  const handleCompleteWire = (
    toType: 'task' | 'recipient' | 'employee', 
    toId: string, 
    e: React.MouseEvent
  ) => {
    e.stopPropagation();
    if (!drawingWire) return;

    if (drawingWire.fromType === 'authority' && toType !== 'task') {
      alert('⚠️ تکایە دەسەڵاتی بڕیاردەر لە ستوونی یەکەمەوە ببەستەوە بە یەکێک لە ئەرکەکانی ستوونی دووەم.');
      setDrawingWire(null);
      return;
    }

    if (drawingWire.fromType === 'task' && toType !== 'recipient' && toType !== 'employee') {
      alert('⚠️ تکایە ئەرکی ستوونی دووەم ببەستەوە بە وەرگرانی ئاگاداری لە ستوونی سێیەم.');
      setDrawingWire(null);
      return;
    }

    const connId = `${drawingWire.fromId}__${toId}`;
    setConnections((prev) => {
      // Toggle if already exists
      if (prev.some((c) => c.id === connId)) {
        return prev.filter((c) => c.id !== connId);
      }
      return [
        ...prev,
        {
          id: connId,
          fromType: drawingWire.fromType,
          fromId: drawingWire.fromId,
          toType: toType as any,
          toId,
          createdAt: new Date().toISOString(),
        },
      ];
    });

    setDrawingWire(null);
  };

  // Cancel drawing wire if clicked elsewhere
  const handleContainerClick = () => {
    if (drawingWire) {
      setDrawingWire(null);
    }
    setSelectedItem(null);
  };

  // Filtered employees list for the dedicated roles tab
  const filteredEmployeesForRoles = useMemo(() => {
    return ASHLEY_OFFICIAL_EMPLOYEES.filter((emp) => {
      const q = rolesSearchQuery.toLowerCase().trim();
      const matchesSearch = 
        !q ||
        emp.name.toLowerCase().includes(q) ||
        emp.id.toLowerCase().includes(q) ||
        (emp.role && emp.role.toLowerCase().includes(q));

      const role = employeeRoles[emp.id] || resolveEmployeeRole(emp.id, emp.name, employeeRoles);
      const matchesDept = 
        rolesDepartmentFilter === 'all' ||
        (rolesDepartmentFilter === 'warehouse' && (role === 'warehouse_manager' || role === 'warehouse_staff' || emp.id === 'emp-06' || emp.id === 'emp-03')) ||
        (rolesDepartmentFilter === 'transport' && (role === 'transport_manager' || emp.id === 'emp-04' || emp.name.includes('هەڤاڵ') || emp.role?.toLowerCase().includes('transport'))) ||
        (rolesDepartmentFilter === 'admin' && (role === 'founder' || role === 'general_manager' || role === 'administration' || emp.id === 'emp-02' || emp.id === 'emp-13')) ||
        (rolesDepartmentFilter === 'sales' && (role === 'salesperson' || emp.role?.toLowerCase().includes('sales') || emp.role?.includes('فرۆشیار'))) ||
        (rolesDepartmentFilter === 'it' && (role === 'it_admin' || emp.id === 'it-admin' || emp.name.includes('ئایتی'))) ||
        (rolesDepartmentFilter === 'dev' && (role === 'developer' || emp.name.includes('دیڤلۆپەر') || emp.role?.toLowerCase().includes('developer')));

      return matchesSearch && matchesDept;
    });
  }, [rolesSearchQuery, rolesDepartmentFilter, employeeRoles]);

  // Filtered individual employees for Column 3
  const filteredRecipientsEmployees = useMemo(() => {
    const q = recipientSearch.toLowerCase().trim();
    if (!q) return ASHLEY_OFFICIAL_EMPLOYEES;
    return ASHLEY_OFFICIAL_EMPLOYEES.filter((emp) => 
      emp.name.toLowerCase().includes(q) || 
      emp.id.toLowerCase().includes(q)
    );
  }, [recipientSearch]);

  // Simulator recipients calculation
  const simulatedRecipients = useMemo(() => {
    const targetKeys = new Set<string>();
    connections.forEach((c) => {
      if (c.toId === simTask) targetKeys.add(c.fromId);
      if (c.fromId === simTask) targetKeys.add(c.toId);
    });

    targetKeys.add('founder');

    const list: Array<{ name: string; title: string; color: string; reason: string; type: string }> = [];

    // Authorities who have approval/action control
    AUTHORITIES_LIST.forEach((auth) => {
      if (targetKeys.has(auth.id) || auth.id === 'founder') {
        list.push({
          name: auth.name,
          title: auth.title,
          color: auth.color,
          reason: 'دەسەڵاتی پەسەندکردن و بڕیاردان لە تەلەگرام',
          type: 'دەسەڵاتی بڕیار',
        });
      }
    });

    // Groups & Audiences
    RECIPIENTS_LIST.forEach((rec) => {
      if (targetKeys.has(rec.id)) {
        list.push({
          name: rec.name,
          title: rec.title,
          color: rec.color,
          reason: 'وەرگرتنی ئاگاداری و نۆتیفیکەیشنی فەرمی',
          type: 'وەرگری ئاگاداری',
        });
      }
    });

    return list;
  }, [connections, simTask]);

  // Active highlighted target
  const activeFocus = hoveredItem || selectedItem;

  return (
    <div 
      className={`w-full transition-all duration-300 select-none flex flex-col ${
        isFullscreen 
          ? 'fixed inset-0 z-50 bg-[#f8fafc] dark:bg-[#121214] p-3 sm:p-4 h-screen overflow-hidden' 
          : 'h-[calc(100vh-65px)] min-h-[700px] space-y-3'
      }`}
      dir="rtl"
    >
      
      {/* ============================================================== */}
      {/* 1. TOP COMPACT CONTROLS & SUB-TABS BAR */}
      {/* ============================================================== */}
      <div className="bg-white/95 dark:bg-[#1c1c1e]/95 backdrop-blur-xl border border-slate-200/90 dark:border-white/10 rounded-2xl px-4 py-2.5 shadow-xs flex flex-wrap items-center justify-between gap-3 shrink-0">
        
        {/* Title & Badge */}
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#007AFF] via-[#AF52DE] to-[#34C759] flex items-center justify-center text-white shadow-xs shrink-0">
            <SlidersHorizontal className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xs sm:text-sm font-black text-slate-900 dark:text-white">
                نەخشەی ئاگادارییەکان و دەسەڵاتەکان
              </h1>
              <span className="px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/40 text-[#007AFF] text-[10px] font-bold">
                تەلەگرام & ERP
              </span>
            </div>
          </div>
        </div>

        {/* Sub-Tab Navigation (Separating Roles from Matrix) */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <div className="flex items-center bg-slate-100 dark:bg-white/10 p-0.5 rounded-xl text-[11px]">
            {/* Tab 1: Visual 3-Column Wiring */}
            <button
              type="button"
              onClick={() => setActiveTab('visual')}
              className={`px-3 py-1 rounded-lg font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'visual'
                  ? 'bg-white dark:bg-[#2c2c2e] text-[#007AFF] shadow-xs font-black'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Zap className="w-3 h-3" />
              <span>نەخشەی ئاگاداری (٣ ستوون)</span>
            </button>

            {/* Tab 2: Separate Dedicated Employee Roles List */}
            <button
              type="button"
              onClick={() => setActiveTab('roles')}
              className={`px-3 py-1 rounded-lg font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'roles'
                  ? 'bg-white dark:bg-[#2c2c2e] text-purple-600 dark:text-purple-400 shadow-xs font-black'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Users className="w-3 h-3" />
              <span>کارمەندان و پلەکانیان</span>
            </button>

            {/* Tab 3: Simulator */}
            <button
              type="button"
              onClick={() => setActiveTab('simulator')}
              className={`px-3 py-1 rounded-lg font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'simulator'
                  ? 'bg-white dark:bg-[#2c2c2e] text-emerald-600 dark:text-emerald-400 shadow-xs font-black'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Send className="w-3 h-3" />
              <span>تاقیکەرەوە</span>
            </button>
          </div>

          {/* Focus Wire Mode Toggle */}
          {activeTab === 'visual' && (
            <button
              type="button"
              onClick={() => setFocusOnlyMode(!focusOnlyMode)}
              className={`px-2.5 py-1 rounded-xl text-[11px] font-bold transition-all border flex items-center gap-1.5 cursor-pointer ${
                focusOnlyMode
                  ? 'bg-purple-50 dark:bg-purple-950/40 border-purple-300 dark:border-purple-800 text-purple-600 dark:text-purple-300'
                  : 'bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-400'
              }`}
              title="نیشاندانی هێڵەکان بە تەنها لە کاتی هەڵبژاردن"
            >
              {focusOnlyMode ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
              <span className="hidden sm:inline">{focusOnlyMode ? 'تەنها هێڵی چالاک' : 'هەموو هێڵەکان'}</span>
            </button>
          )}

          {/* Fullscreen Toggle */}
          <button
            type="button"
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-1.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 hover:bg-slate-100 dark:bg-white/5 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300 text-xs font-bold transition-all cursor-pointer flex items-center gap-1"
            title={isFullscreen ? 'دەرچوون لە فوول سکرین' : 'فوول سکرین'}
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>

        {/* Save & Reset Buttons */}
        <div className="flex items-center gap-1.5">
          {activeTab === 'visual' && (
            <button
              type="button"
              onClick={handleClearConnections}
              disabled={loading || saving}
              className="p-1.5 sm:px-2.5 sm:py-1 rounded-xl border border-red-200/80 dark:border-red-900/40 bg-red-50/50 hover:bg-red-100/70 text-red-600 dark:text-red-400 text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1"
              title="سڕینەوەی سەرجەم هێڵەکان"
            >
              <Trash2 className="w-3 h-3" />
              <span className="hidden md:inline">سڕینەوە</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleResetDefaults}
            disabled={loading || saving}
            className="p-1.5 sm:px-2.5 sm:py-1 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 hover:bg-slate-100 text-slate-700 dark:text-slate-300 text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1"
            title="گەڕاندنەوە بۆ باری بنەڕەتی"
          >
            <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden md:inline">بنەڕەتی</span>
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={loading || saving}
            className="px-3.5 py-1.5 rounded-xl bg-[#007AFF] hover:bg-blue-600 active:scale-95 text-white text-[11px] font-black shadow-xs transition-all cursor-pointer flex items-center gap-1.5"
          >
            {saving ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : saveSuccess ? (
              <Check className="w-3.5 h-3.5 text-emerald-300" />
            ) : (
              <Save className="w-3.5 h-3.5" />
            )}
            <span>{saveSuccess ? 'پاشەکەوت کرا!' : 'پاشەکەوتکردن'}</span>
          </button>
        </div>
      </div>

      {/* ============================================================== */}
      {/* TAB 1: 3-COLUMN VISUAL WIRING CANVAS */}
      {/* ستونی ١: دەسەڵاتەکان | ستونی ٢: ئەرکەکان | ستونی ٣: وەرگرانی ئاگاداری */}
      {/* ============================================================== */}
      {activeTab === 'visual' && (
        <div 
          ref={containerRef}
          onMouseMove={handleMouseMove}
          onClick={handleContainerClick}
          className="flex-1 relative bg-white/80 dark:bg-[#18181a]/80 backdrop-blur-md border border-slate-200/90 dark:border-white/10 rounded-2xl p-3 shadow-xs overflow-hidden flex flex-col"
          style={{
            backgroundImage: 'radial-gradient(rgba(148, 163, 184, 0.22) 1px, transparent 1px)',
            backgroundSize: '20px 20px',
          }}
        >

          {/* SVG WIRES OVERLAY */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none z-10">
            {/* Render established connections */}
            {connections.map((conn) => {
              // 1. Determine fromPort
              let fromPortId = '';
              if (conn.fromType === 'authority') {
                fromPortId = `port-auth-out-${conn.fromId}`;
              } else if (conn.fromType === 'task') {
                fromPortId = `port-task-out-${conn.fromId}`;
              } else {
                // legacy fallback
                fromPortId = `port-auth-out-${conn.fromId}`;
              }

              // 2. Determine toPort
              let toPortId = '';
              if (conn.toType === 'task') {
                toPortId = `port-task-in-${conn.toId}`;
              } else if (conn.toType === 'recipient' || conn.toType === 'role') {
                toPortId = `port-rec-in-${conn.toId}`;
              } else if (conn.toType === 'employee') {
                toPortId = `port-emp-in-${conn.toId}`;
              }

              const fromCoord = portCoords[fromPortId];
              const toCoord = portCoords[toPortId];

              if (!fromCoord || !toCoord) return null;

              // Cubic Bézier Curve
              const dx = (toCoord.x - fromCoord.x) / 2;
              const pathD = `M ${fromCoord.x} ${fromCoord.y} C ${fromCoord.x + dx} ${fromCoord.y}, ${toCoord.x - dx} ${toCoord.y}, ${toCoord.x} ${toCoord.y}`;

              // Determine relationship to active hovered/selected item
              let isRelated = true;
              if (activeFocus) {
                if (activeFocus.type === 'authority') {
                  isRelated = conn.fromId === activeFocus.id || (conn.fromType === 'task' && connections.some(c => c.fromId === activeFocus.id && c.toId === conn.fromId));
                } else if (activeFocus.type === 'task') {
                  isRelated = conn.fromId === activeFocus.id || conn.toId === activeFocus.id;
                } else if (activeFocus.type === 'recipient' || activeFocus.type === 'employee') {
                  isRelated = conn.toId === activeFocus.id || (conn.fromType === 'authority' && connections.some(c => c.toId === conn.toId && c.fromId === activeFocus.id));
                }
              } else if (focusOnlyMode) {
                isRelated = false;
              }

              if (focusOnlyMode && !isRelated && !activeFocus) {
                return null;
              }

              // Color determination
              let wireColor = '#007AFF';
              if (conn.fromType === 'authority') {
                const auth = AUTHORITIES_LIST.find((a) => a.id === conn.fromId);
                if (auth) wireColor = auth.color;
              } else {
                const actDef = WORKFLOW_ACTIONS.find((a) => a.id === conn.fromId);
                if (actDef) wireColor = actDef.color;
              }

              const isWireHovered = hoveredWireId === conn.id;
              const midX = (fromCoord.x + toCoord.x) / 2;
              const midY = (fromCoord.y + toCoord.y) / 2;

              return (
                <g 
                  key={conn.id}
                  className="transition-all duration-200"
                  onMouseEnter={() => setHoveredWireId(conn.id)}
                  onMouseLeave={() => setHoveredWireId(null)}
                >
                  {/* Invisible wide stroke for easy mouse hovering */}
                  <path
                    d={pathD}
                    fill="none"
                    stroke="transparent"
                    strokeWidth={16}
                    className="pointer-events-auto cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveConnection(conn.id);
                    }}
                  />

                  {/* Main delicate connection line */}
                  <path
                    d={pathD}
                    fill="none"
                    stroke={wireColor}
                    strokeWidth={isWireHovered || (isRelated && activeFocus) ? 2.5 : 1.3}
                    strokeOpacity={isWireHovered ? 1 : isRelated ? (activeFocus ? 0.95 : 0.5) : 0.08}
                  />

                  {/* Subtle dash animation when focused or hovered */}
                  {(isWireHovered || (isRelated && activeFocus)) && (
                    <path
                      d={pathD}
                      fill="none"
                      stroke="#ffffff"
                      strokeWidth={1.5}
                      strokeDasharray="4,6"
                      strokeOpacity={0.8}
                    />
                  )}

                  {/* Delete button only appears when line is hovered or related */}
                  {(isWireHovered || (isRelated && activeFocus)) && (
                    <foreignObject
                      x={midX - 9}
                      y={midY - 9}
                      width={18}
                      height={18}
                      className="pointer-events-auto overflow-visible"
                    >
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveConnection(conn.id);
                        }}
                        className="w-4.5 h-4.5 rounded-full bg-red-600 text-white hover:scale-125 flex items-center justify-center text-[9px] font-bold shadow-sm transition-all cursor-pointer border border-white/40"
                        title="سڕینەوەی ئەم هێڵە"
                      >
                        ✕
                      </button>
                    </foreignObject>
                  )}
                </g>
              );
            })}

            {/* In-progress drawing wire */}
            {drawingWire && (
              <g>
                {(() => {
                  const dx = (drawingWire.currentX - drawingWire.startX) / 2;
                  const pathD = `M ${drawingWire.startX} ${drawingWire.startY} C ${drawingWire.startX + dx} ${drawingWire.startY}, ${drawingWire.currentX - dx} ${drawingWire.currentY}, ${drawingWire.currentX} ${drawingWire.currentY}`;
                  return (
                    <>
                      <path
                        d={pathD}
                        fill="none"
                        stroke="#007AFF"
                        strokeWidth={2.5}
                        strokeDasharray="4,4"
                      />
                      <circle
                        cx={drawingWire.currentX}
                        cy={drawingWire.currentY}
                        r={4}
                        fill="#007AFF"
                        className="animate-ping"
                      />
                      <circle
                        cx={drawingWire.currentX}
                        cy={drawingWire.currentY}
                        r={3}
                        fill="#ffffff"
                      />
                    </>
                  );
                })()}
              </g>
            )}
          </svg>

          {/* 3-COLUMN RESPONSIVE GRID */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4 relative z-20 h-full overflow-hidden">
            
            {/* ------------------------------------------------------------ */}
            {/* COLUMN 1 (RIGHT in RTL): دەسەڵاتەکان کێ بێت (AUTHORITIES) */}
            {/* ------------------------------------------------------------ */}
            <div className="bg-white/60 dark:bg-[#1f1f22]/60 backdrop-blur-sm border border-slate-200/80 dark:border-white/5 rounded-2xl p-2.5 flex flex-col h-full overflow-hidden shadow-2xs">
              
              {/* Header */}
              <div className="pb-2 border-b border-slate-200/70 dark:border-white/5 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#007AFF]"></span>
                  <div>
                    <h2 className="text-xs font-black text-slate-900 dark:text-white">
                      ستوونی ١: دەسەڵاتەکان کێ بێت
                    </h2>
                    <p className="text-[10px] text-slate-400">
                      بڕیاردەر و پەسەندکەر لە تەلەگرام
                    </p>
                  </div>
                </div>
                <span className="text-[10px] font-mono text-slate-400 font-bold bg-slate-100 dark:bg-white/10 px-2 py-0.5 rounded-md">
                  {AUTHORITIES_LIST.length} دەسەڵات
                </span>
              </div>

              {/* Authorities Cards */}
              <div 
                className="flex-1 overflow-y-auto space-y-2 py-1.5 pr-0.5 pl-2 custom-scrollbar"
                onScroll={updatePortCoordinates}
              >
                {AUTHORITIES_LIST.map((auth) => {
                  const outCount = connections.filter(
                    (c) => (c.fromType === 'authority' || c.fromType === 'employee') && c.fromId === auth.id
                  ).length;

                  const isHovered = hoveredItem?.type === 'authority' && hoveredItem.id === auth.id;
                  const isSelected = selectedItem?.type === 'authority' && selectedItem.id === auth.id;
                  const isDrawingFromThis = drawingWire?.fromType === 'authority' && drawingWire?.fromId === auth.id;

                  return (
                    <div
                      key={auth.id}
                      onMouseEnter={() => setHoveredItem({ type: 'authority', id: auth.id })}
                      onMouseLeave={() => setHoveredItem(null)}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedItem(selectedItem?.id === auth.id ? null : { type: 'authority', id: auth.id });
                      }}
                      className={`p-2.5 rounded-xl border transition-all relative flex flex-col justify-between gap-1 cursor-pointer ${
                        isSelected || isHovered || isDrawingFromThis
                          ? 'bg-white dark:bg-[#2a2a2d] border-[#007AFF] shadow-xs'
                          : 'bg-white/80 dark:bg-[#242426]/80 border-slate-200/70 dark:border-white/5 hover:border-slate-300'
                      }`}
                      style={{
                        borderRightWidth: '3px',
                        borderRightColor: auth.color,
                      }}
                    >
                      {/* OUT-PORT ANCHOR (Micro Dot facing Col 2) */}
                      <button
                        type="button"
                        id={`port-auth-out-${auth.id}`}
                        onClick={(e) => handleStartWire('authority', auth.id, auth.name, `port-auth-out-${auth.id}`, e)}
                        className={`absolute -left-1.5 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full flex items-center justify-center cursor-pointer transition-all z-30 ${
                          isDrawingFromThis
                            ? 'bg-[#007AFF] text-white ring-2 ring-blue-500/40 scale-125'
                            : 'bg-white dark:bg-[#1c1c1e] border-2 border-[#007AFF] hover:scale-125 hover:bg-[#007AFF]'
                        }`}
                        title="بەستنەوە بە یەکێک لە ئەرکەکان بۆ پێدانی دەسەڵات"
                      />

                      <div className="flex items-center justify-between">
                        <span 
                          className="px-1.5 py-0.5 rounded text-[9px] font-black text-white shrink-0"
                          style={{ backgroundColor: auth.color }}
                        >
                          {auth.badge}
                        </span>
                        <span className="text-[9px] font-mono text-slate-400 font-bold">
                          {outCount} ئەرک بەستراوە
                        </span>
                      </div>

                      <div className="text-[11px] font-black text-slate-900 dark:text-white">
                        {auth.name}
                      </div>

                      <p className="text-[10px] text-slate-400 line-clamp-1">
                        {auth.description}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ------------------------------------------------------------ */}
            {/* COLUMN 2 (MIDDLE): ئەرکەکان (TASKS & ACTIONS) */}
            {/* ------------------------------------------------------------ */}
            <div className="bg-white/60 dark:bg-[#1f1f22]/60 backdrop-blur-sm border border-slate-200/80 dark:border-white/5 rounded-2xl p-2.5 flex flex-col h-full overflow-hidden shadow-2xs">
              
              <div className="pb-2 border-b border-slate-200/70 dark:border-white/5 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#AF52DE]"></span>
                  <div>
                    <h2 className="text-xs font-black text-slate-900 dark:text-white">
                      ستوونی ٢: ئەرکەکان
                    </h2>
                    <p className="text-[10px] text-slate-400">
                      مۆڵەت، ئاگاداری، غیاب، پشوو و ئامێر
                    </p>
                  </div>
                </div>
                <span className="text-[10px] font-mono text-slate-400 font-bold bg-slate-100 dark:bg-white/10 px-2 py-0.5 rounded-md">
                  {WORKFLOW_ACTIONS.length} ئەرک
                </span>
              </div>

              <div 
                className="flex-1 overflow-y-auto space-y-2 py-1.5 px-2 custom-scrollbar"
                onScroll={updatePortCoordinates}
              >
                {WORKFLOW_ACTIONS.map((action) => {
                  const IconComp = ICON_MAP[action.iconName] || Zap;

                  const inCount = connections.filter(
                    (c) => c.toType === 'task' && c.toId === action.id
                  ).length;

                  const outCount = connections.filter(
                    (c) => c.fromType === 'task' && c.fromId === action.id
                  ).length;

                  const isHovered = hoveredItem?.type === 'task' && hoveredItem.id === action.id;
                  const isSelected = selectedItem?.type === 'task' && selectedItem.id === action.id;
                  const isTargetHovered = drawingWire?.fromType === 'authority';
                  const isSourceActive = drawingWire?.fromType === 'task' && drawingWire?.fromId === action.id;

                  return (
                    <div
                      key={action.id}
                      onMouseEnter={() => setHoveredItem({ type: 'task', id: action.id })}
                      onMouseLeave={() => setHoveredItem(null)}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedItem(selectedItem?.id === action.id ? null : { type: 'task', id: action.id });
                      }}
                      className={`p-2.5 rounded-xl border transition-all relative flex flex-col justify-between gap-1.5 cursor-pointer ${
                        isSelected || isHovered || isSourceActive
                          ? 'bg-white dark:bg-[#2a2a2d] border-[#AF52DE] shadow-xs'
                          : 'bg-white/80 dark:bg-[#242426]/80 border-slate-200/70 dark:border-white/5 hover:border-slate-300'
                      }`}
                    >
                      {/* IN-PORT ANCHOR (Right - connects from Authorities) */}
                      <button
                        type="button"
                        id={`port-task-in-${action.id}`}
                        onClick={(e) => handleCompleteWire('task', action.id, e)}
                        className={`absolute -right-1.5 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full flex items-center justify-center cursor-pointer transition-all z-30 ${
                          isTargetHovered
                            ? 'bg-emerald-500 text-white ring-2 ring-emerald-500/40 scale-125 animate-pulse'
                            : 'bg-white dark:bg-[#1c1c1e] border-2 border-emerald-500 hover:scale-125 hover:bg-emerald-500'
                        }`}
                        title="بەستنەوە لە دەسەڵاتی ستوونی یەکەمەوە"
                      />

                      {/* OUT-PORT ANCHOR (Left - connects to Recipients) */}
                      <button
                        type="button"
                        id={`port-task-out-${action.id}`}
                        onClick={(e) => handleStartWire('task', action.id, action.title, `port-task-out-${action.id}`, e)}
                        className={`absolute -left-1.5 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full flex items-center justify-center cursor-pointer transition-all z-30 ${
                          isSourceActive
                            ? 'bg-[#AF52DE] text-white ring-2 ring-purple-500/40 scale-125'
                            : 'bg-white dark:bg-[#1c1c1e] border-2 border-[#AF52DE] hover:scale-125 hover:bg-[#AF52DE]'
                        }`}
                        title="بەستنەوە بە وەرگرانی ئاگاداری لە ستوونی سێیەم"
                      />

                      <div className="flex items-center gap-2">
                        <div 
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-white shrink-0 shadow-2xs"
                          style={{ backgroundColor: action.color }}
                        >
                          <IconComp className="w-3.5 h-3.5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="text-[11px] font-black text-slate-900 dark:text-white truncate">
                            {action.title}
                          </h3>
                          <p className="text-[10px] text-slate-400 truncate">
                            {action.description}
                          </p>
                        </div>
                      </div>

                      {/* Stats pill */}
                      <div className="flex items-center justify-between text-[9px] font-mono text-slate-400 pt-1 border-t border-slate-100 dark:border-white/5">
                        <span>⬅️ {inCount} دەسەڵات</span>
                        <span>➡️ {outCount} وەرگر</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ------------------------------------------------------------ */}
            {/* COLUMN 3 (LEFT in RTL): ئاگەدار کردنەوەکان بۆ کێ ئەچێ */}
            {/* ------------------------------------------------------------ */}
            <div className="bg-white/60 dark:bg-[#1f1f22]/60 backdrop-blur-sm border border-slate-200/80 dark:border-white/5 rounded-2xl p-2.5 flex flex-col h-full overflow-hidden shadow-2xs">
              
              {/* Header with Sub-tabs for Groups vs Individuals */}
              <div className="pb-2 border-b border-slate-200/70 dark:border-white/5 space-y-1.5 shrink-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#34C759]"></span>
                    <div>
                      <h2 className="text-xs font-black text-slate-900 dark:text-white">
                        ستوونی ٣: ئاگادارییەکان بۆ کێ دەچێت
                      </h2>
                      <p className="text-[10px] text-slate-400">
                        وەرگرانی نۆتیفیکەیشن و ڕاگەیاندن
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center bg-slate-100 dark:bg-white/10 p-0.5 rounded-lg text-[10px]">
                    <button
                      type="button"
                      onClick={() => setRecipientMode('groups')}
                      className={`px-2 py-0.5 rounded-md font-bold transition-all ${
                        recipientMode === 'groups'
                          ? 'bg-white dark:bg-[#2c2c2e] text-[#007AFF] shadow-2xs font-black'
                          : 'text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      بەشەکان
                    </button>
                    <button
                      type="button"
                      onClick={() => setRecipientMode('individuals')}
                      className={`px-2 py-0.5 rounded-md font-bold transition-all ${
                        recipientMode === 'individuals'
                          ? 'bg-white dark:bg-[#2c2c2e] text-[#007AFF] shadow-2xs font-black'
                          : 'text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      کارمەندان
                    </button>
                  </div>
                </div>

                {recipientMode === 'individuals' && (
                  <div className="relative">
                    <input
                      type="text"
                      value={recipientSearch}
                      onChange={(e) => setRecipientSearch(e.target.value)}
                      placeholder="گەڕان لە کارمەندان..."
                      className="w-full pr-6 pl-2 py-0.5 text-[11px] rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-[#2c2c2e] text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none"
                    />
                    <Search className="w-3 h-3 text-slate-400 absolute right-2 top-1.5" />
                  </div>
                )}
              </div>

              {/* Groups View */}
              {recipientMode === 'groups' ? (
                <div 
                  className="flex-1 overflow-y-auto space-y-2 py-1.5 pr-2 pl-0.5 custom-scrollbar"
                  onScroll={updatePortCoordinates}
                >
                  {RECIPIENTS_LIST.map((rec) => {
                    const inCount = connections.filter(
                      (c) => (c.toType === 'recipient' || c.toType === 'role') && c.toId === rec.id
                    ).length;

                    const isHovered = hoveredItem?.type === 'recipient' && hoveredItem.id === rec.id;
                    const isSelected = selectedItem?.type === 'recipient' && selectedItem.id === rec.id;
                    const isTargetHovered = drawingWire?.fromType === 'task';

                    return (
                      <div
                        key={rec.id}
                        onMouseEnter={() => setHoveredItem({ type: 'recipient', id: rec.id })}
                        onMouseLeave={() => setHoveredItem(null)}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedItem(selectedItem?.id === rec.id ? null : { type: 'recipient', id: rec.id });
                        }}
                        className={`p-2.5 rounded-xl border transition-all relative flex flex-col justify-between gap-1 cursor-pointer ${
                          isSelected || isHovered
                            ? 'bg-white dark:bg-[#2a2a2d] border-[#34C759] shadow-xs'
                            : 'bg-white/80 dark:bg-[#242426]/80 border-slate-200/70 dark:border-white/5 hover:border-slate-300'
                        }`}
                        style={{
                          borderLeftWidth: '3px',
                          borderLeftColor: rec.color,
                        }}
                      >
                        {/* IN-PORT ANCHOR (Right - connects from Task) */}
                        <button
                          type="button"
                          id={`port-rec-in-${rec.id}`}
                          onClick={(e) => handleCompleteWire('recipient', rec.id, e)}
                          className={`absolute -right-1.5 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full flex items-center justify-center cursor-pointer transition-all z-30 ${
                            isTargetHovered
                              ? 'bg-purple-500 text-white ring-2 ring-purple-500/40 scale-125 animate-pulse'
                              : 'bg-white dark:bg-[#1c1c1e] border-2 border-purple-500 hover:scale-125 hover:bg-purple-500'
                          }`}
                          title="بەستنەوە لە ئەرکەوە بۆ وەرگرتنی ئاگاداری"
                        />

                        <div className="flex items-center justify-between">
                          <span 
                            className="px-1.5 py-0.5 rounded text-[9px] font-bold text-white shrink-0"
                            style={{ backgroundColor: rec.color }}
                          >
                            {rec.badge}
                          </span>
                          <span className="text-[9px] font-mono text-slate-400 font-bold">
                            {inCount} ئەرک
                          </span>
                        </div>

                        <div className="text-[11px] font-black text-slate-900 dark:text-white">
                          {rec.name}
                        </div>

                        <p className="text-[10px] text-slate-400 line-clamp-1">
                          {rec.description}
                        </p>
                      </div>
                    );
                  })}
                </div>
              ) : (
                /* Individual Employees View */
                <div 
                  className="flex-1 overflow-y-auto space-y-1.5 py-1.5 pr-2 pl-0.5 custom-scrollbar"
                  onScroll={updatePortCoordinates}
                >
                  {filteredRecipientsEmployees.map((emp) => {
                    const role = employeeRoles[emp.id] || resolveEmployeeRole(emp.id, emp.name, employeeRoles);
                    const roleOption = ROLE_OPTIONS.find((r) => r.id === role) || ROLE_OPTIONS[10];

                    const inCount = connections.filter(
                      (c) => c.toType === 'employee' && c.toId === emp.id
                    ).length;

                    const isHovered = hoveredItem?.type === 'employee' && hoveredItem.id === emp.id;
                    const isSelected = selectedItem?.type === 'employee' && selectedItem.id === emp.id;
                    const isTargetHovered = drawingWire?.fromType === 'task';

                    return (
                      <div
                        key={emp.id}
                        onMouseEnter={() => setHoveredItem({ type: 'employee', id: emp.id })}
                        onMouseLeave={() => setHoveredItem(null)}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedItem(selectedItem?.id === emp.id ? null : { type: 'employee', id: emp.id });
                        }}
                        className={`px-2 py-1.5 rounded-xl border transition-all relative flex items-center justify-between gap-1.5 cursor-pointer ${
                          isSelected || isHovered
                            ? 'bg-white dark:bg-[#2a2a2d] border-[#34C759] shadow-xs'
                            : 'bg-white/80 dark:bg-[#242426]/80 border-slate-200/70 dark:border-white/5 hover:border-slate-300'
                        }`}
                        style={{
                          borderLeftWidth: '3px',
                          borderLeftColor: roleOption.color,
                        }}
                      >
                        {/* IN-PORT ANCHOR (Right) */}
                        <button
                          type="button"
                          id={`port-emp-in-${emp.id}`}
                          onClick={(e) => handleCompleteWire('employee', emp.id, e)}
                          className={`absolute -right-1.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full flex items-center justify-center cursor-pointer transition-all z-30 ${
                            isTargetHovered
                              ? 'bg-purple-500 text-white ring-2 ring-purple-500/40 scale-125 animate-pulse'
                              : 'bg-white dark:bg-[#1c1c1e] border-2 border-purple-500 hover:scale-125 hover:bg-purple-500'
                          }`}
                          title="بەستنەوە بەم کارمەندە"
                        />

                        <div className="flex items-center gap-1.5 min-w-0">
                          <div 
                            className="w-5 h-5 rounded-md flex items-center justify-center text-white text-[9px] font-bold shrink-0"
                            style={{ backgroundColor: roleOption.color }}
                          >
                            {emp.name.charAt(0)}
                          </div>
                          <div className="min-w-0 leading-tight">
                            <div className="text-[11px] font-bold text-slate-800 dark:text-slate-100 truncate">
                              {emp.name}
                            </div>
                            <div className="text-[9px] font-mono text-slate-400">
                              {emp.id}
                            </div>
                          </div>
                        </div>

                        {inCount > 0 && (
                          <span 
                            className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold text-white shrink-0"
                            style={{ backgroundColor: roleOption.color }}
                          >
                            {inCount}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 2: DEDICATED EMPLOYEE ROLES MANAGEMENT LIST */}
      {/* کارمەندان و پلەکانیان لە لیستێکی جیاواز و فراوان */}
      {/* ============================================================== */}
      {activeTab === 'roles' && (
        <div className="flex-1 bg-white/90 dark:bg-[#1c1c1e]/90 backdrop-blur-xl border border-slate-200/90 dark:border-white/10 rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col gap-4 overflow-hidden">
          
          {/* Header & Role Distribution Summary */}
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-200/80 dark:border-white/10 shrink-0">
            <div>
              <h2 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                <Users className="w-4 h-4 text-[#007AFF]" />
                بەڕێوەبردنی پلەی کارمەندان (ڕۆڵەکان)
              </h2>
              <p className="text-[11px] text-slate-400">
                دیاریکردنی پلە بۆ سەرجەم کارمەندانی کۆمپانیای ئاشڵی بە شێوەیەکی فەرمی
              </p>
            </div>

            {/* Quick role counts */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {ROLE_OPTIONS.slice(0, 7).map((ro) => {
                const count = ASHLEY_OFFICIAL_EMPLOYEES.filter(
                  (e) => (employeeRoles[e.id] || resolveEmployeeRole(e.id, e.name, employeeRoles)) === ro.id
                ).length;
                if (count === 0) return null;
                return (
                  <span
                    key={ro.id}
                    className="px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1 border border-slate-200/60 dark:border-white/5"
                    style={{ backgroundColor: `${ro.color}15`, color: ro.color }}
                  >
                    <span>{ro.badge}:</span>
                    <span className="font-mono font-black">{count}</span>
                  </span>
                );
              })}
            </div>
          </div>

          {/* Search & Filter Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-2.5 shrink-0">
            <div className="relative flex-1 min-w-[200px] max-w-md">
              <input
                type="text"
                value={rolesSearchQuery}
                onChange={(e) => setRolesSearchQuery(e.target.value)}
                placeholder="گەڕان بەپێی ناوی کارمەند، کۆد یان ڕۆڵ..."
                className="w-full pr-8 pl-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#2c2c2e] text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#007AFF]/20"
              />
              <Search className="w-4 h-4 text-slate-400 absolute right-2.5 top-2" />
            </div>

            {/* Department Filter Pills */}
            <div className="flex items-center gap-1 overflow-x-auto pb-1 max-w-full">
              {[
                { id: 'all', label: 'هەمووان' },
                { id: 'warehouse', label: 'کۆگا و کارگە' },
                { id: 'transport', label: 'بەشی نقڵ' },
                { id: 'admin', label: 'ئیدارە و بەڕێوەبردن' },
                { id: 'sales', label: 'فرۆشتن و پێشانگا' },
                { id: 'it', label: 'ئایتی' },
                { id: 'dev', label: 'دیڤلۆپەر' },
              ].map((df) => (
                <button
                  key={df.id}
                  type="button"
                  onClick={() => setRolesDepartmentFilter(df.id)}
                  className={`px-2.5 py-1 rounded-xl text-[11px] font-bold transition-all whitespace-nowrap cursor-pointer ${
                    rolesDepartmentFilter === df.id
                      ? 'bg-[#007AFF] text-white shadow-xs'
                      : 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                  }`}
                >
                  {df.label}
                </button>
              ))}
            </div>
          </div>

          {/* Employees List Grid */}
          <div className="flex-1 overflow-y-auto pr-1 pl-1 custom-scrollbar">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {filteredEmployeesForRoles.map((emp) => {
                const assignedRole = employeeRoles[emp.id] || resolveEmployeeRole(emp.id, emp.name, employeeRoles);
                const roleOption = ROLE_OPTIONS.find((r) => r.id === assignedRole) || ROLE_OPTIONS[10];

                return (
                  <div
                    key={emp.id}
                    className="p-3 rounded-2xl border border-slate-200/80 dark:border-white/10 bg-white/80 dark:bg-[#252528]/80 hover:shadow-xs transition-all flex flex-col justify-between gap-2.5"
                    style={{
                      borderRightWidth: '4px',
                      borderRightColor: roleOption.color,
                    }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div 
                          className="w-8 h-8 rounded-xl flex items-center justify-center text-white text-xs font-black shrink-0 shadow-2xs"
                          style={{ backgroundColor: roleOption.color }}
                        >
                          {emp.name.charAt(0)}
                        </div>

                        <div className="min-w-0">
                          <h3 className="text-xs font-black text-slate-900 dark:text-white truncate">
                            {emp.name}
                          </h3>
                          <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-mono">
                            <span>{emp.id}</span>
                            <span>•</span>
                            <span className="font-sans truncate">{emp.role || 'کارمەند'}</span>
                          </div>
                        </div>
                      </div>

                      <span
                        className="px-2 py-0.5 rounded-full text-[10px] font-black shrink-0"
                        style={{ backgroundColor: `${roleOption.color}20`, color: roleOption.color }}
                      >
                        {roleOption.badge}
                      </span>
                    </div>

                    {/* Role Selector */}
                    <div className="pt-2 border-t border-slate-100 dark:border-white/5 flex items-center justify-between gap-2">
                      <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 shrink-0">
                        دیاریکردنی پلە:
                      </label>
                      <select
                        value={assignedRole}
                        onChange={(e) => handleRoleChange(emp.id, e.target.value as UserRole)}
                        className="flex-1 text-[11px] font-bold py-1 px-2 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#1f1f22] text-slate-800 dark:text-slate-200 cursor-pointer focus:outline-none focus:ring-1 focus:ring-[#007AFF]"
                      >
                        {ROLE_OPTIONS.map((opt) => (
                          <option key={opt.id} value={opt.id}>
                            {opt.title} ({opt.badge})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 3: SIMULATOR TAB */}
      {/* ============================================================== */}
      {activeTab === 'simulator' && (
        <div className="flex-1 bg-white/90 dark:bg-[#1c1c1e]/90 backdrop-blur-xl border border-slate-200/90 dark:border-white/10 rounded-2xl p-5 shadow-xs space-y-4 overflow-y-auto">
          <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100 dark:border-white/10">
            <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-[#007AFF] flex items-center justify-center">
              <Send className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-black text-slate-900 dark:text-white">
                تاقیکەرەوەی ڕێڕەوی ئاگادارییەکان لە تەلەگرام
              </h2>
              <p className="text-[11px] text-slate-400">
                پێشبینیکردنی دەسەڵاتدارانی پەسەندکەر و ئەو کارمەندانەی لە تەلەگرام ئاگاداری وەردەگرن
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                جۆری ئەرک
              </label>
              <select
                value={simTask}
                onChange={(e) => setSimTask(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#2c2c2e] text-xs font-bold text-slate-800 dark:text-slate-200"
              >
                {WORKFLOW_ACTIONS.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.title}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                کارمەندی داواکار
              </label>
              <select
                value={simEmployeeId}
                onChange={(e) => setSimEmployeeId(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#2c2c2e] text-xs font-bold text-slate-800 dark:text-slate-200"
              >
                {ASHLEY_OFFICIAL_EMPLOYEES.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name} ({emp.id})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                بەرواری پەیوەندیدار
              </label>
              <input
                type="date"
                value={simDate}
                onChange={(e) => setSimDate(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#2c2c2e] text-xs font-bold text-slate-800 dark:text-slate-200"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                دەق یان تێبینی
              </label>
              <input
                type="text"
                value={simNote}
                onChange={(e) => setSimNote(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#2c2c2e] text-xs font-bold text-slate-800 dark:text-slate-200"
              />
            </div>
          </div>

          {/* Results Grid */}
          <div className="pt-3 border-t border-slate-100 dark:border-white/10">
            <h3 className="text-xs font-black text-slate-900 dark:text-white mb-2.5">
              ئەو کەس و بەشانەی لە تەلەگرام کاردانەوەیان بۆ دەڕوات ({simulatedRecipients.length}):
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {simulatedRecipients.map((rec, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50/70 dark:bg-white/5 space-y-1.5"
                  style={{ borderRightWidth: '4px', borderRightColor: rec.color }}
                >
                  <div className="flex items-center justify-between">
                    <span 
                      className="px-2 py-0.5 rounded text-[10px] font-bold text-white"
                      style={{ backgroundColor: rec.color }}
                    >
                      {rec.title}
                    </span>
                    <span className="text-[10px] font-mono text-slate-400 font-bold">
                      {rec.type}
                    </span>
                  </div>

                  <div className="text-xs font-black text-slate-900 dark:text-white">
                    {rec.name}
                  </div>

                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    {rec.reason}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
