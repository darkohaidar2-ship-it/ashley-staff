'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { 
  UserRole,
  ROLE_OPTIONS,
  DESTINATION_ROLES,
  WORKFLOW_ACTIONS,
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
  ChevronRight
} from 'lucide-react';

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Palmtree,
  Megaphone,
  UserX,
  CalendarOff,
  ClockAlert: Clock,
  Smartphone,
};

interface ActiveDrawingWire {
  fromType: 'employee' | 'task';
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
  const [activeTab, setActiveTab] = useState<'visual' | 'simulator'>('visual');

  // Fullscreen state
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Focus & Wire visibility mode
  const [focusOnlyMode, setFocusOnlyMode] = useState(false);
  const [hoveredItem, setHoveredItem] = useState<{ type: 'employee' | 'task' | 'role'; id: string } | null>(null);
  const [selectedItem, setSelectedItem] = useState<{ type: 'employee' | 'task' | 'role'; id: string } | null>(null);
  const [hoveredWireId, setHoveredWireId] = useState<string | null>(null);

  // Filters & Search for employees
  const [searchQuery, setSearchQuery] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState<string>('all');

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

    ASHLEY_OFFICIAL_EMPLOYEES.forEach((emp) => {
      measure(`port-emp-out-${emp.id}`);
    });

    WORKFLOW_ACTIONS.forEach((act) => {
      measure(`port-task-in-${act.id}`);
      measure(`port-task-out-${act.id}`);
    });

    DESTINATION_ROLES.forEach((role) => {
      measure(`port-role-in-${role.id}`);
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
  }, [updatePortCoordinates, loading, activeTab, searchQuery, departmentFilter, connections, isFullscreen]);

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
    fromType: 'employee' | 'task', 
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
    toType: 'task' | 'role', 
    toId: string, 
    e: React.MouseEvent
  ) => {
    e.stopPropagation();
    if (!drawingWire) return;

    if (drawingWire.fromType === 'employee' && toType !== 'task') {
      alert('⚠️ تکایە کارمەند ببەستەوە بە یەکێک لە ئەرکەکانی ناوەڕاست.');
      setDrawingWire(null);
      return;
    }
    if (drawingWire.fromType === 'task' && toType !== 'role') {
      alert('⚠️ تکایە ئەرک ببەستەوە بە یەکێک لە دەسەڵاتە بڕیاردەرەکانی لای چەپ.');
      setDrawingWire(null);
      return;
    }

    const connId = `${drawingWire.fromId}__${toId}`;
    setConnections((prev) => {
      if (prev.some((c) => c.id === connId)) {
        return prev.filter((c) => c.id !== connId);
      }
      return [
        ...prev,
        {
          id: connId,
          fromType: drawingWire.fromType,
          fromId: drawingWire.fromId,
          toType,
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

  // Filtered employees list
  const filteredEmployees = useMemo(() => {
    return ASHLEY_OFFICIAL_EMPLOYEES.filter((emp) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch = 
        !q ||
        emp.name.toLowerCase().includes(q) ||
        emp.id.toLowerCase().includes(q) ||
        (emp.role && emp.role.toLowerCase().includes(q));

      const role = employeeRoles[emp.id] || resolveEmployeeRole(emp.id, emp.name, employeeRoles);
      const matchesDept = 
        departmentFilter === 'all' ||
        (departmentFilter === 'warehouse' && (role === 'warehouse_manager' || role === 'warehouse_staff' || emp.id === 'emp-06' || emp.id === 'emp-03')) ||
        (departmentFilter === 'transport' && (role === 'transport_manager' || emp.id === 'emp-04' || emp.name.includes('هەڤاڵ') || emp.role?.toLowerCase().includes('transport'))) ||
        (departmentFilter === 'admin' && (role === 'founder' || role === 'general_manager' || role === 'administration' || emp.id === 'emp-02' || emp.id === 'emp-13')) ||
        (departmentFilter === 'sales' && (role === 'salesperson' || emp.role?.toLowerCase().includes('sales') || emp.role?.includes('فرۆشیار'))) ||
        (departmentFilter === 'it' && (role === 'it_admin' || emp.id === 'it-admin' || emp.name.includes('ئایتی'))) ||
        (departmentFilter === 'dev' && (role === 'developer' || emp.name.includes('دیڤلۆپەر') || emp.role?.toLowerCase().includes('developer')));

      return matchesSearch && matchesDept;
    });
  }, [searchQuery, departmentFilter, employeeRoles]);

  // Simulator recipients calculation
  const simulatedRecipients = useMemo(() => {
    const targetRoles = new Set<string>();
    connections
      .filter((c) => c.fromType === 'task' && c.fromId === simTask && c.toType === 'role')
      .forEach((c) => targetRoles.add(c.toId));

    targetRoles.add('founder');

    const recipients: Array<{ role: UserRole; name: string; title: string; color: string; reason: string }> = [];

    DESTINATION_ROLES.forEach((r) => {
      if (targetRoles.has(r.id)) {
        let reason = 'دەسەڵاتی بڕیاردان و ئاگاداری فەرمی لە تەلەگرام';
        if (r.id === 'warehouse_manager') reason = 'بەرپرسی کۆگا - وەرگرتنی داواکاری مۆڵەت و خستنە خشتە';
        else if (r.id === 'founder') reason = 'ئەدمین و دامەزرێنەر - سەرپەرشتی گشتی و پەسەندکردن';
        else if (r.id === 'general_manager') reason = 'بەڕێوەبەری گشتی - ئاگاداری ڕاستەوخۆ';
        else if (r.id === 'transport_manager') reason = 'بەڕێوەبەری نقڵ - سەرپەرشتی و پەسەندکردنی مۆڵەت و دەوامی نقڵ';
        else if (r.id === 'administration') reason = 'ئیدارە و سەرچاوە مرۆییەکان - ئاگاداری فەرمی و پشوو و تۆمارەکان';
        else if (r.id === 'developer') reason = 'دیڤلۆپەر - سەرپەرشتی تەکنیکی و سێرڤەر و کۆد';
        else if (r.id === 'it_admin') reason = 'بەشی ئایتی - بەستنەوەی ئامێر و سیستم';
        else if (r.id === 'salesperson') reason = 'فرۆشیار - ئاگاداری بەیاننامە و ڕێنماییەکانی فرۆشتن';

        recipients.push({
          role: r.id,
          name: r.name,
          title: r.title,
          color: r.color,
          reason,
        });
      }
    });

    return recipients;
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
      
      {/* 1. TOP COMPACT CONTROLS BAR */}
      <div className="bg-white/95 dark:bg-[#1c1c1e]/95 backdrop-blur-xl border border-slate-200/90 dark:border-white/10 rounded-2xl px-4 py-2.5 shadow-xs flex flex-wrap items-center justify-between gap-3 shrink-0">
        
        {/* Left/Start info */}
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#007AFF] to-[#AF52DE] flex items-center justify-center text-white shadow-xs shrink-0">
            <SlidersHorizontal className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xs sm:text-sm font-black text-slate-900 dark:text-white">
                بەڕێوەبردنی ئاگادارییەکان و دەسەڵاتەکان
              </h1>
              <span className="px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/40 text-[#007AFF] text-[10px] font-bold">
                تەلەگرام & ERP
              </span>
            </div>
          </div>
        </div>

        {/* Center / Action Toggles */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <div className="flex items-center bg-slate-100 dark:bg-white/10 p-0.5 rounded-xl text-[11px]">
            <button
              type="button"
              onClick={() => setActiveTab('visual')}
              className={`px-3 py-1 rounded-lg font-bold transition-all flex items-center gap-1 cursor-pointer ${
                activeTab === 'visual'
                  ? 'bg-white dark:bg-[#2c2c2e] text-[#007AFF] shadow-xs font-black'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              <Zap className="w-3 h-3" />
              <span>نەخشەی بەستەر</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('simulator')}
              className={`px-3 py-1 rounded-lg font-bold transition-all flex items-center gap-1 cursor-pointer ${
                activeTab === 'simulator'
                  ? 'bg-white dark:bg-[#2c2c2e] text-[#007AFF] shadow-xs font-black'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              <Send className="w-3 h-3" />
              <span>تاقیکەرەوە</span>
            </button>
          </div>

          {/* Focus Wire Mode Toggle */}
          <button
            type="button"
            onClick={() => setFocusOnlyMode(!focusOnlyMode)}
            className={`px-2.5 py-1 rounded-xl text-[11px] font-bold transition-all border flex items-center gap-1.5 cursor-pointer ${
              focusOnlyMode
                ? 'bg-purple-50 dark:bg-purple-950/40 border-purple-300 dark:border-purple-800 text-purple-600 dark:text-purple-300'
                : 'bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-400'
            }`}
            title="نیشاندانی هێڵەکان بە تەنها لە کاتی هەڵبژاردن یان ماوس لەسەردانان"
          >
            {focusOnlyMode ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
            <span className="hidden sm:inline">{focusOnlyMode ? 'تەنها هێڵی چالاک' : 'هەموو هێڵەکان (ورد)'}</span>
          </button>

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

        {/* Right / Save & Reset Buttons */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleClearConnections}
            disabled={loading || saving}
            className="p-1.5 sm:px-2.5 sm:py-1 rounded-xl border border-red-200/80 dark:border-red-900/40 bg-red-50/50 hover:bg-red-100/70 text-red-600 dark:text-red-400 text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1"
            title="سڕینەوەی هێڵەکان"
          >
            <Trash2 className="w-3 h-3" />
            <span className="hidden md:inline">سڕینەوە</span>
          </button>

          <button
            type="button"
            onClick={handleResetDefaults}
            disabled={loading || saving}
            className="p-1.5 sm:px-2.5 sm:py-1 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 hover:bg-slate-100 text-slate-700 dark:text-slate-300 text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1"
            title="باری بنەڕەتی"
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

      {/* 2. FULLSCREEN MAIN WORKSPACE CANVAS */}
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

          {/* ============================================================== */}
          {/* ULTRA-FINE REFINED SVG WIRES OVERLAY */}
          {/* ============================================================== */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none z-10">
            {/* Render established connections */}
            {connections.map((conn) => {
              const fromPortId = conn.fromType === 'employee' 
                ? `port-emp-out-${conn.fromId}` 
                : `port-task-out-${conn.fromId}`;
              
              const toPortId = conn.toType === 'task' 
                ? `port-task-in-${conn.toId}` 
                : `port-role-in-${conn.toId}`;

              const fromCoord = portCoords[fromPortId];
              const toCoord = portCoords[toPortId];

              if (!fromCoord || !toCoord) return null;

              // Cubic Bézier Curve
              const dx = (toCoord.x - fromCoord.x) / 2;
              const pathD = `M ${fromCoord.x} ${fromCoord.y} C ${fromCoord.x + dx} ${fromCoord.y}, ${toCoord.x - dx} ${toCoord.y}, ${toCoord.x} ${toCoord.y}`;

              // Determine relationship to active hovered/selected item
              let isRelated = true;
              if (activeFocus) {
                if (activeFocus.type === 'employee') {
                  isRelated = conn.fromId === activeFocus.id || (conn.fromType === 'task' && connections.some(c => c.fromId === activeFocus.id && c.toId === conn.fromId));
                } else if (activeFocus.type === 'task') {
                  isRelated = conn.fromId === activeFocus.id || conn.toId === activeFocus.id;
                } else if (activeFocus.type === 'role') {
                  isRelated = conn.toId === activeFocus.id || (conn.fromType === 'employee' && connections.some(c => c.toId === conn.toId && c.fromId === activeFocus.id));
                }
              } else if (focusOnlyMode) {
                isRelated = false;
              }

              // Hide or fade if not related in focus mode
              if (focusOnlyMode && !isRelated && !activeFocus) {
                return null;
              }

              // Color determination
              let wireColor = '#007AFF';
              if (conn.fromType === 'employee') {
                const role = employeeRoles[conn.fromId] || 'employee';
                const roleOpt = ROLE_OPTIONS.find((r) => r.id === role);
                if (roleOpt) wireColor = roleOpt.color;
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
                    strokeWidth={isWireHovered || (isRelated && activeFocus) ? 2.5 : 1.2}
                    strokeOpacity={isWireHovered ? 1 : isRelated ? (activeFocus ? 0.95 : 0.4) : 0.08}
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

          {/* ============================================================== */}
          {/* 3-COLUMN COMPACT RESPONSIVE GRID */}
          {/* ============================================================== */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4 relative z-20 h-full overflow-hidden">
            
            {/* ------------------------------------------------------------ */}
            {/* COLUMN 1 (RIGHT): هەموو کارمەندەکان (COMPACT & MICRO ROWS) */}
            {/* ------------------------------------------------------------ */}
            <div className="bg-white/60 dark:bg-[#1f1f22]/60 backdrop-blur-sm border border-slate-200/80 dark:border-white/5 rounded-2xl p-2.5 flex flex-col h-full overflow-hidden shadow-2xs">
              
              {/* Header & Mini Search */}
              <div className="pb-2 border-b border-slate-200/70 dark:border-white/5 space-y-1.5 shrink-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-[#007AFF]"></span>
                    <h2 className="text-xs font-black text-slate-900 dark:text-white">
                      کارمەندان و پلەکانیان
                    </h2>
                  </div>
                  <span className="text-[10px] font-mono text-slate-400 font-bold">
                    {filteredEmployees.length}
                  </span>
                </div>

                <div className="flex items-center gap-1">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="گەڕان..."
                      className="w-full pr-6 pl-2 py-1 text-[11px] rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-[#2c2c2e] text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none"
                    />
                    <Search className="w-3 h-3 text-slate-400 absolute right-2 top-2" />
                  </div>

                  <select
                    value={departmentFilter}
                    onChange={(e) => setDepartmentFilter(e.target.value)}
                    className="text-[10px] py-1 px-1 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-[#2c2c2e] text-slate-700 dark:text-slate-300 font-bold"
                  >
                    <option value="all">هەمووان</option>
                    <option value="warehouse">کۆگا</option>
                    <option value="transport">نقڵ</option>
                    <option value="admin">ئیدارە</option>
                    <option value="sales">فرۆشتن</option>
                    <option value="it">ئایتی</option>
                    <option value="dev">دیڤلۆپەر</option>
                  </select>
                </div>
              </div>

              {/* Compact Micro-Row Employee List */}
              <div 
                className="flex-1 overflow-y-auto space-y-1.5 py-1.5 pl-2 pr-0.5 custom-scrollbar"
                onScroll={updatePortCoordinates}
              >
                {filteredEmployees.map((emp) => {
                  const assignedRole = employeeRoles[emp.id] || 'employee';
                  const roleOption = ROLE_OPTIONS.find((r) => r.id === assignedRole) || ROLE_OPTIONS[5];
                  
                  const wireCount = connections.filter(
                    (c) => c.fromType === 'employee' && c.fromId === emp.id
                  ).length;

                  const isHovered = hoveredItem?.type === 'employee' && hoveredItem.id === emp.id;
                  const isSelected = selectedItem?.type === 'employee' && selectedItem.id === emp.id;
                  const isDrawingFromThis = drawingWire?.fromType === 'employee' && drawingWire?.fromId === emp.id;

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
                        isSelected || isHovered || isDrawingFromThis
                          ? 'bg-white dark:bg-[#2a2a2d] border-[#007AFF] shadow-xs'
                          : 'bg-white/80 dark:bg-[#242426]/80 border-slate-200/70 dark:border-white/5 hover:border-slate-300'
                      }`}
                      style={{
                        borderRightWidth: '3px',
                        borderRightColor: roleOption.color,
                      }}
                    >
                      {/* Name & Initial */}
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

                      {/* Micro Role Dropdown */}
                      <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                        <select
                          value={assignedRole}
                          onChange={(e) => handleRoleChange(emp.id, e.target.value as UserRole)}
                          className="text-[10px] font-bold py-0.5 px-1 rounded-md border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#2c2c2e] text-slate-800 dark:text-slate-200 cursor-pointer"
                        >
                          {ROLE_OPTIONS.map((opt) => (
                            <option key={opt.id} value={opt.id}>
                              {opt.title}
                            </option>
                          ))}
                        </select>

                        {wireCount > 0 && (
                          <span 
                            className="px-1 py-0.2 rounded text-[9px] font-mono font-bold text-white shrink-0"
                            style={{ backgroundColor: roleOption.color }}
                          >
                            {wireCount}
                          </span>
                        )}
                      </div>

                      {/* OUT-PORT ANCHOR (Micro Dot) */}
                      <button
                        type="button"
                        id={`port-emp-out-${emp.id}`}
                        onClick={(e) => handleStartWire('employee', emp.id, emp.name, `port-emp-out-${emp.id}`, e)}
                        className={`absolute -left-1.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full flex items-center justify-center cursor-pointer transition-all z-30 ${
                          isDrawingFromThis
                            ? 'bg-[#007AFF] text-white ring-2 ring-blue-500/40 scale-125'
                            : 'bg-white dark:bg-[#1c1c1e] border-2 border-[#007AFF] hover:scale-125 hover:bg-[#007AFF]'
                        }`}
                        title="بەستنەوە بە ئەرک"
                      />
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ------------------------------------------------------------ */}
            {/* COLUMN 2 (MIDDLE): ئەرکەکان (COMPACT TASK CARDS) */}
            {/* ------------------------------------------------------------ */}
            <div className="bg-white/60 dark:bg-[#1f1f22]/60 backdrop-blur-sm border border-slate-200/80 dark:border-white/5 rounded-2xl p-2.5 flex flex-col h-full overflow-hidden shadow-2xs">
              
              <div className="pb-2 border-b border-slate-200/70 dark:border-white/5 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#AF52DE]"></span>
                  <h2 className="text-xs font-black text-slate-900 dark:text-white">
                    ئەرک و کارلێکەکان
                  </h2>
                </div>
                <span className="text-[10px] font-mono text-slate-400 font-bold">
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
                  const isTargetHovered = drawingWire?.fromType === 'employee';
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
                      {/* IN-PORT ANCHOR (Right) */}
                      <button
                        type="button"
                        id={`port-task-in-${action.id}`}
                        onClick={(e) => handleCompleteWire('task', action.id, e)}
                        className={`absolute -right-1.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full flex items-center justify-center cursor-pointer transition-all z-30 ${
                          isTargetHovered
                            ? 'bg-emerald-500 text-white ring-2 ring-emerald-500/40 scale-125 animate-pulse'
                            : 'bg-white dark:bg-[#1c1c1e] border-2 border-emerald-500 hover:scale-125 hover:bg-emerald-500'
                        }`}
                        title="بەستنەوە لە کارمەندەوە"
                      />

                      {/* OUT-PORT ANCHOR (Left) */}
                      <button
                        type="button"
                        id={`port-task-out-${action.id}`}
                        onClick={(e) => handleStartWire('task', action.id, action.title, `port-task-out-${action.id}`, e)}
                        className={`absolute -left-1.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full flex items-center justify-center cursor-pointer transition-all z-30 ${
                          isSourceActive
                            ? 'bg-[#AF52DE] text-white ring-2 ring-purple-500/40 scale-125'
                            : 'bg-white dark:bg-[#1c1c1e] border-2 border-[#AF52DE] hover:scale-125 hover:bg-[#AF52DE]'
                        }`}
                        title="بەستنەوە بە دەسەڵاتی لای چەپ"
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
                        <span>⬅️ {inCount} کارمەند</span>
                        <span>➡️ {outCount} دەسەڵات</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ------------------------------------------------------------ */}
            {/* COLUMN 3 (LEFT): دەسەڵاتەکان (COMPACT ROLE CARDS) */}
            {/* ------------------------------------------------------------ */}
            <div className="bg-white/60 dark:bg-[#1f1f22]/60 backdrop-blur-sm border border-slate-200/80 dark:border-white/5 rounded-2xl p-2.5 flex flex-col h-full overflow-hidden shadow-2xs">
              
              <div className="pb-2 border-b border-slate-200/70 dark:border-white/5 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#34C759]"></span>
                  <h2 className="text-xs font-black text-slate-900 dark:text-white">
                    دەسەڵاتی بڕیاردان
                  </h2>
                </div>
                <span className="text-[10px] font-mono text-slate-400 font-bold">
                  {DESTINATION_ROLES.length} دەسەڵات
                </span>
              </div>

              <div 
                className="flex-1 overflow-y-auto space-y-2 py-1.5 pr-2 pl-0.5 custom-scrollbar"
                onScroll={updatePortCoordinates}
              >
                {DESTINATION_ROLES.map((role) => {
                  const inCount = connections.filter(
                    (c) => c.toType === 'role' && c.toId === role.id
                  ).length;

                  const isHovered = hoveredItem?.type === 'role' && hoveredItem.id === role.id;
                  const isSelected = selectedItem?.type === 'role' && selectedItem.id === role.id;
                  const isTargetHovered = drawingWire?.fromType === 'task';

                  return (
                    <div
                      key={role.id}
                      onMouseEnter={() => setHoveredItem({ type: 'role', id: role.id })}
                      onMouseLeave={() => setHoveredItem(null)}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedItem(selectedItem?.id === role.id ? null : { type: 'role', id: role.id });
                      }}
                      className={`p-2.5 rounded-xl border transition-all relative flex flex-col justify-between gap-1 cursor-pointer ${
                        isSelected || isHovered
                          ? 'bg-white dark:bg-[#2a2a2d] border-[#34C759] shadow-xs'
                          : 'bg-white/80 dark:bg-[#242426]/80 border-slate-200/70 dark:border-white/5 hover:border-slate-300'
                      }`}
                      style={{
                        borderLeftWidth: '3px',
                        borderLeftColor: role.color,
                      }}
                    >
                      {/* IN-PORT ANCHOR (Right) */}
                      <button
                        type="button"
                        id={`port-role-in-${role.id}`}
                        onClick={(e) => handleCompleteWire('role', role.id, e)}
                        className={`absolute -right-1.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full flex items-center justify-center cursor-pointer transition-all z-30 ${
                          isTargetHovered
                            ? 'bg-purple-500 text-white ring-2 ring-purple-500/40 scale-125 animate-pulse'
                            : 'bg-white dark:bg-[#1c1c1e] border-2 border-purple-500 hover:scale-125 hover:bg-purple-500'
                        }`}
                        title="بەستنەوە لە ئەرکەوە"
                      />

                      <div className="flex items-center justify-between">
                        <span 
                          className="px-1.5 py-0.5 rounded text-[9px] font-bold text-white shrink-0"
                          style={{ backgroundColor: role.color }}
                        >
                          {role.title}
                        </span>
                        <span className="text-[9px] font-mono text-slate-400 font-bold">
                          {inCount} ئەرک
                        </span>
                      </div>

                      <div className="text-[11px] font-black text-slate-900 dark:text-white">
                        {role.name}
                      </div>

                      <p className="text-[10px] text-slate-400 line-clamp-1">
                        {role.description}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>

          </div>
        </div>
      )}

      {/* 3. SIMULATOR TAB */}
      {activeTab === 'simulator' && (
        <div className="flex-1 bg-white/90 dark:bg-[#1c1c1e]/90 backdrop-blur-xl border border-slate-200/90 dark:border-white/10 rounded-2xl p-5 shadow-xs space-y-4 overflow-y-auto">
          <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100 dark:border-white/10">
            <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-[#007AFF] flex items-center justify-center">
              <Send className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-black text-slate-900 dark:text-white">
                تاقیکەرەوەی ئاگادارییەکانی تەلەگرام
              </h2>
              <p className="text-[11px] text-slate-400">
                کاتێک کارمەند لە تەلەگرام داواکارییەک دەنێرێت، کێ لە تەلەگرام ئاگاداری وەردەگرێت
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
                بەروار
              </label>
              <input
                type="text"
                value={simDate}
                onChange={(e) => setSimDate(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#2c2c2e] text-xs font-bold text-slate-800 dark:text-slate-200"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                هۆکار
              </label>
              <input
                type="text"
                value={simNote}
                onChange={(e) => setSimNote(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#2c2c2e] text-xs font-bold text-slate-800 dark:text-slate-200"
              />
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 dark:border-white/10 space-y-3">
            <h3 className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              <span>ئەو بەڕێوەبەرانەی ڕاستەوخۆ لە تەلەگرام بڕیار لەسەر ئەم ئەرکە دەدەن ({simulatedRecipients.length}):</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {simulatedRecipients.map((rec) => (
                <div
                  key={rec.role}
                  className="p-3 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200/80 dark:border-white/10 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span 
                      className="px-2 py-0.5 rounded text-[9px] font-bold text-white"
                      style={{ backgroundColor: rec.color }}
                    >
                      {rec.title}
                    </span>
                    <span className="text-[10px] text-emerald-500 font-bold">
                      ● ئامادەیە
                    </span>
                  </div>

                  <h4 className="text-xs font-black text-slate-900 dark:text-white">
                    {rec.name}
                  </h4>

                  <p className="text-[10px] text-slate-400">
                    {rec.reason}
                  </p>

                  <div className="flex items-center gap-2 pt-1">
                    <span className="px-2 py-1 rounded-lg bg-emerald-600 text-white text-[10px] font-bold">
                      ✅ پەسەندکردن
                    </span>
                    <span className="px-2 py-1 rounded-lg bg-red-600 text-white text-[10px] font-bold">
                      ❌ ڕەتکردنەوە
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
