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
  TaskActionDefinition,
  DestinationRoleDefinition,
} from '@/lib/workflow/workflow-service';
import { ASHLEY_OFFICIAL_EMPLOYEES, AshleyOfficialEmployee } from '@/lib/ashley-employees';
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
  Filter, 
  HelpCircle,
  Building,
  Shield,
  Layers,
  Activity
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

  // Filters & Search for employees
  const [searchQuery, setSearchQuery] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState<string>('all');

  // Interactive Wiring State
  const [drawingWire, setDrawingWire] = useState<ActiveDrawingWire | null>(null);
  const [hoveredPort, setHoveredPort] = useState<string | null>(null);
  const [hoveredNode, setHoveredNode] = useState<{ type: string; id: string } | null>(null);

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

    // Helper to record port center
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

    // Right Column: Employee Out Ports
    ASHLEY_OFFICIAL_EMPLOYEES.forEach((emp) => {
      measure(`port-emp-out-${emp.id}`);
    });

    // Middle Column: Task In & Out Ports
    WORKFLOW_ACTIONS.forEach((act) => {
      measure(`port-task-in-${act.id}`);
      measure(`port-task-out-${act.id}`);
    });

    // Left Column: Destination Role In Ports
    DESTINATION_ROLES.forEach((role) => {
      measure(`port-role-in-${role.id}`);
    });

    setPortCoords(newCoords);
  }, []);

  // Update coordinates on resize, tab switch, scroll, search, or data load
  useEffect(() => {
    updatePortCoordinates();
    const handleResize = () => updatePortCoordinates();
    window.addEventListener('resize', handleResize);
    const timer = setTimeout(updatePortCoordinates, 350);
    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(timer);
    };
  }, [updatePortCoordinates, loading, activeTab, searchQuery, departmentFilter, connections]);

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
      setTimeout(() => setSaveSuccess(false), 3000);
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

  // 10. Complete a wire connection by clicking on a target port
  const handleCompleteWire = (
    toType: 'task' | 'role', 
    toId: string, 
    e: React.MouseEvent
  ) => {
    e.stopPropagation();
    if (!drawingWire) return;

    // Validate connection logic:
    // Employee can ONLY connect to Task
    // Task can ONLY connect to Role
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
        // Toggle remove if already connected
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

  // 11. Cancel drawing wire if clicked elsewhere
  const handleContainerClick = () => {
    if (drawingWire) {
      setDrawingWire(null);
    }
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

      const matchesDept = 
        departmentFilter === 'all' ||
        (departmentFilter === 'warehouse' && (emp.id === 'emp-06' || emp.id === 'emp-03' || emp.id === 'emp-04')) ||
        (departmentFilter === 'admin' && (emp.id === 'emp-02' || emp.id === 'emp-13')) ||
        (departmentFilter === 'it' && (emp.id === 'it-admin' || emp.name.includes('ئایتی')));

      return matchesSearch && matchesDept;
    });
  }, [searchQuery, departmentFilter]);

  // Simulator recipients calculation
  const simulatedRecipients = useMemo(() => {
    // 1. Roles connected to simTask
    const targetRoles = new Set<string>();
    connections
      .filter((c) => c.fromType === 'task' && c.fromId === simTask && c.toType === 'role')
      .forEach((c) => targetRoles.add(c.toId));

    // Founder always gets alerts
    targetRoles.add('founder');

    // 2. Map target roles to officials
    const recipients: Array<{ role: UserRole; name: string; title: string; color: string; reason: string }> = [];

    DESTINATION_ROLES.forEach((r) => {
      if (targetRoles.has(r.id)) {
        let reason = 'دەسەڵاتی بڕیاردان و ئاگاداری فەرمی لە تەلەگرام';
        if (r.id === 'warehouse_manager') reason = 'بەرپرسی کۆگا - وەرگرتنی مۆڵەت و جێگیرکردن لە خشتەی دەوام';
        else if (r.id === 'founder') reason = 'ئەدمین و خاوەنی کۆمپانیا - سەرپەرشتی تەواوی بڕیارەکان';
        else if (r.id === 'general_manager') reason = 'بەڕێوەبەری گشتی - ئاگاداری ڕاستەوخۆ لە تەلەگرام';
        else if (r.id === 'it_admin') reason = 'بەشی ئایتی - بەستنەوەی ئامێرەکان و پاراستنی سیستم';

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

  return (
    <div 
      className="w-full max-w-[1400px] mx-auto space-y-6 select-none animate-fade-in print:hidden" 
      dir="rtl"
    >
      
      {/* 1. TOP HEADER & MAIN CONTROLS */}
      <div className="bg-white/95 dark:bg-[#1c1c1e]/95 backdrop-blur-xl border border-slate-200/90 dark:border-white/10 rounded-3xl p-5 sm:p-6 shadow-sm flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#007AFF] via-[#5856D6] to-[#AF52DE] flex items-center justify-center text-white shadow-md shadow-blue-500/25 shrink-0">
            <SlidersHorizontal className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white">
                بەڕێوەبردنی ئاگادارییەکان و دەسەڵاتەکان
              </h1>
              <span className="px-2.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/40 text-[#007AFF] dark:text-blue-400 border border-blue-200/50 dark:border-blue-800/40 text-[11px] font-bold">
                بەستەری دەستی (Interactive Wire Builder)
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
              هەڵبژاردنی پلەی کارمەندان (لای ڕاست)، ئەرکەکان (ناوەڕاست)، و گەیاندنی دەستی هێڵەکان بۆ دەسەڵاتی بڕیاردان (لای چەپ)
            </p>
          </div>
        </div>

        {/* Action Buttons & Tabs */}
        <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto justify-end">
          <div className="flex items-center bg-slate-100 dark:bg-white/10 p-1 rounded-2xl">
            <button
              type="button"
              onClick={() => setActiveTab('visual')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'visual'
                  ? 'bg-white dark:bg-[#2c2c2e] text-[#007AFF] shadow-xs font-black'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Zap className="w-3.5 h-3.5" />
              <span>نەخشەی بەستەری دەستی</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('simulator')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'simulator'
                  ? 'bg-white dark:bg-[#2c2c2e] text-[#007AFF] shadow-xs font-black'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Send className="w-3.5 h-3.5" />
              <span>تاقیکردنەوەی تەلەگرام</span>
            </button>
          </div>

          <button
            type="button"
            onClick={handleClearConnections}
            disabled={loading || saving}
            className="p-2 sm:px-3 sm:py-2 rounded-2xl border border-red-200/80 dark:border-red-900/40 bg-red-50/50 hover:bg-red-100/70 dark:bg-red-950/20 text-red-600 dark:text-red-400 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
            title="سڕینەوەی هەموو هێڵەکان"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">سڕینەوەی هێڵەکان</span>
          </button>

          <button
            type="button"
            onClick={handleResetDefaults}
            disabled={loading || saving}
            className="p-2 sm:px-3 sm:py-2 rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 hover:bg-slate-100 dark:bg-white/5 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
            title="گەڕاندنەوە بۆ باری پێشنیارکراو"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">باری پێشنیارکراو</span>
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={loading || saving}
            className="px-4 py-2 rounded-2xl bg-[#007AFF] hover:bg-blue-600 active:scale-95 text-white text-xs font-black shadow-md shadow-blue-500/25 transition-all cursor-pointer flex items-center gap-2"
          >
            {saving ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : saveSuccess ? (
              <Check className="w-4 h-4 text-emerald-300" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            <span>{saveSuccess ? 'پاشەکەوت کرا!' : 'پاشەکەوتکردن لە سیستەم'}</span>
          </button>
        </div>
      </div>

      {/* 2. VISUAL CANVAS (MAIN 3-COLUMN INTERACTIVE MATRIX) */}
      {activeTab === 'visual' && (
        <div 
          ref={containerRef}
          onMouseMove={handleMouseMove}
          onClick={handleContainerClick}
          className="relative bg-white/70 dark:bg-[#1c1c1e]/70 backdrop-blur-md border border-slate-200/90 dark:border-white/10 rounded-3xl p-4 sm:p-6 shadow-xs overflow-hidden min-h-[750px]"
        >
          {/* Quick Guidance Alert */}
          <div className="mb-6 p-4 rounded-2xl bg-blue-50/80 dark:bg-blue-950/20 border border-blue-200/60 dark:border-blue-800/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-blue-950 dark:text-blue-200">
            <div className="flex items-center gap-2.5 font-medium">
              <Sparkles className="w-4 h-4 text-[#007AFF] shrink-0" />
              <span>
                <b>ڕێنمایی بەستەری دەستی:</b> دەتوانیت لە ڕێگەی کلیک یان ڕاکێشان، لە خاڵی دەرچوونی هەر کارمەندێکەوە هێڵ ببەستیتەوە بە ئەرکی ناوەڕاست، و لە ئەرکەوە بۆ دەسەڵاتی بڕیاردانی لای چەپ (کاک کامەران یان بەڕێوەبەر). بۆ سڕینەوەی هەر هێڵێک، کلیک لەسەر دوگمەی <b className="text-red-500">✕</b> سەر هێڵەکە بکە.
              </span>
            </div>
            <div className="flex items-center gap-2 text-[11px] font-mono shrink-0">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>{connections.length} هێڵی چالاک</span>
            </div>
          </div>

          {/* ============================================================== */}
          {/* SVG INTERACTIVE WIRES OVERLAY */}
          {/* ============================================================== */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none z-10">
            <defs>
              <linearGradient id="wireGradientActive" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#007AFF" />
                <stop offset="100%" stopColor="#AF52DE" />
              </linearGradient>
            </defs>

            {/* 1. Render all established connections */}
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

              // Determine color
              let wireColor = '#007AFF';
              if (conn.fromType === 'employee') {
                const role = employeeRoles[conn.fromId] || 'employee';
                const roleOpt = ROLE_OPTIONS.find((r) => r.id === role);
                if (roleOpt) wireColor = roleOpt.color;
              } else {
                const actDef = WORKFLOW_ACTIONS.find((a) => a.id === conn.fromId);
                if (actDef) wireColor = actDef.color;
              }

              const midX = (fromCoord.x + toCoord.x) / 2;
              const midY = (fromCoord.y + toCoord.y) / 2;

              return (
                <g key={conn.id} className="transition-all duration-200">
                  {/* Outer subtle glow */}
                  <path
                    d={pathD}
                    fill="none"
                    stroke={wireColor}
                    strokeWidth={5}
                    strokeOpacity={0.18}
                  />

                  {/* Main connection line */}
                  <path
                    d={pathD}
                    fill="none"
                    stroke={wireColor}
                    strokeWidth={2.5}
                    strokeOpacity={0.85}
                  />

                  {/* Animated dash flow */}
                  <path
                    d={pathD}
                    fill="none"
                    stroke="#ffffff"
                    strokeWidth={1.5}
                    strokeDasharray="4,6"
                    strokeOpacity={0.7}
                  />

                  {/* Interactive center delete button */}
                  <foreignObject
                    x={midX - 10}
                    y={midY - 10}
                    width={20}
                    height={20}
                    className="pointer-events-auto overflow-visible"
                  >
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveConnection(conn.id);
                      }}
                      className="w-5 h-5 rounded-full bg-slate-900/90 text-white hover:bg-red-600 hover:scale-125 flex items-center justify-center text-[10px] font-bold shadow-md transition-all cursor-pointer border border-white/20"
                      title="سڕینەوەی ئەم هێڵە"
                    >
                      ✕
                    </button>
                  </foreignObject>
                </g>
              );
            })}

            {/* 2. Live in-progress drawing wire */}
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
                        strokeWidth={6}
                        strokeOpacity={0.3}
                      />
                      <path
                        d={pathD}
                        fill="none"
                        stroke="#007AFF"
                        strokeWidth={3}
                        strokeDasharray="6,4"
                      />
                      <circle
                        cx={drawingWire.currentX}
                        cy={drawingWire.currentY}
                        r={6}
                        fill="#007AFF"
                        className="animate-ping"
                      />
                      <circle
                        cx={drawingWire.currentX}
                        cy={drawingWire.currentY}
                        r={4}
                        fill="#ffffff"
                      />
                    </>
                  );
                })()}
              </g>
            )}
          </svg>

          {/* ============================================================== */}
          {/* 3-COLUMN GRID: RIGHT (EMPLOYEES) -> MIDDLE (TASKS) -> LEFT (ROLES) */}
          {/* ============================================================== */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 relative z-20">
            
            {/* ------------------------------------------------------------ */}
            {/* COLUMN 1 (RIGHT): هەموو کارمەندەکان و هەڵبژاردنی پلە بۆیان */}
            {/* ------------------------------------------------------------ */}
            <div className="space-y-4 flex flex-col">
              <div className="pb-3 border-b border-slate-200/80 dark:border-white/10 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-[#007AFF]"></span>
                    <h2 className="text-sm font-black text-slate-900 dark:text-white">
                      لای ڕاست: کارمەندان و پلەکانیان
                    </h2>
                  </div>
                  <span className="text-[11px] font-mono text-slate-400 font-bold">
                    {filteredEmployees.length} کارمەند
                  </span>
                </div>

                {/* Search Bar */}
                <div className="relative">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="گەڕان بەدوای کارمەنددا..."
                    className="w-full pr-8 pl-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-white/10 bg-white/90 dark:bg-[#2c2c2e]/90 text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-2.5" />
                </div>

                {/* Category Chips */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[10px]">
                  <button
                    type="button"
                    onClick={() => setDepartmentFilter('all')}
                    className={`px-2 py-0.5 rounded-lg font-bold transition-all ${
                      departmentFilter === 'all'
                        ? 'bg-[#007AFF] text-white'
                        : 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    هەمووان
                  </button>
                  <button
                    type="button"
                    onClick={() => setDepartmentFilter('warehouse')}
                    className={`px-2 py-0.5 rounded-lg font-bold transition-all ${
                      departmentFilter === 'warehouse'
                        ? 'bg-purple-600 text-white'
                        : 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    کۆگا
                  </button>
                  <button
                    type="button"
                    onClick={() => setDepartmentFilter('admin')}
                    className={`px-2 py-0.5 rounded-lg font-bold transition-all ${
                      departmentFilter === 'admin'
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    ئیدارە
                  </button>
                  <button
                    type="button"
                    onClick={() => setDepartmentFilter('it')}
                    className={`px-2 py-0.5 rounded-lg font-bold transition-all ${
                      departmentFilter === 'it'
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    ئایتی
                  </button>
                </div>
              </div>

              {/* Employees List Container */}
              <div 
                className="space-y-3 overflow-y-auto max-h-[620px] pr-1 pl-3 custom-scrollbar"
                onScroll={updatePortCoordinates}
              >
                {filteredEmployees.map((emp) => {
                  const assignedRole = employeeRoles[emp.id] || 'employee';
                  const roleOption = ROLE_OPTIONS.find((r) => r.id === assignedRole) || ROLE_OPTIONS[5];
                  
                  // Count wires from this employee
                  const wireCount = connections.filter(
                    (c) => c.fromType === 'employee' && c.fromId === emp.id
                  ).length;

                  const isWired = wireCount > 0;
                  const isDrawingFromThis = drawingWire?.fromType === 'employee' && drawingWire?.fromId === emp.id;

                  return (
                    <div
                      key={emp.id}
                      className={`p-3.5 rounded-2xl border transition-all relative group bg-white/90 dark:bg-[#242426]/90 shadow-2xs ${
                        isDrawingFromThis
                          ? 'border-[#007AFF] ring-2 ring-blue-500/20 shadow-md'
                          : 'border-slate-200/80 dark:border-white/5 hover:border-slate-300'
                      }`}
                      style={{
                        borderRightWidth: '4px',
                        borderRightColor: roleOption.color,
                      }}
                    >
                      <div className="flex items-start justify-between gap-2.5">
                        <div className="flex items-center gap-2.5 min-w-0">
                          {/* Initials circle */}
                          <div 
                            className="w-8 h-8 rounded-xl flex items-center justify-center text-white text-xs font-bold shrink-0 shadow-2xs"
                            style={{ backgroundColor: roleOption.color }}
                          >
                            {emp.name.charAt(0)}
                          </div>
                          <div className="min-w-0">
                            <h3 className="text-xs font-bold text-slate-900 dark:text-white truncate">
                              {emp.name}
                            </h3>
                            <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
                              <span className="font-mono">{emp.id}</span>
                              <span>•</span>
                              <span>{emp.role || 'کارمەند'}</span>
                            </div>
                          </div>
                        </div>

                        {/* Connected Wires Badge */}
                        {isWired && (
                          <span 
                            className="px-1.5 py-0.5 rounded text-[10px] font-bold font-mono text-white shrink-0"
                            style={{ backgroundColor: roleOption.color }}
                          >
                            {wireCount} هێڵ
                          </span>
                        )}
                      </div>

                      {/* Role Selector Dropdown */}
                      <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-white/5 flex items-center justify-between gap-2">
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold shrink-0">
                          پلەی کارمەند:
                        </span>

                        <select
                          value={assignedRole}
                          onChange={(e) => handleRoleChange(emp.id, e.target.value as UserRole)}
                          className="text-[11px] font-bold px-2 py-1 rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#2c2c2e] text-slate-800 dark:text-slate-200 focus:outline-none cursor-pointer"
                        >
                          {ROLE_OPTIONS.map((opt) => (
                            <option key={opt.id} value={opt.id}>
                              {opt.title}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* OUT-PORT ANCHOR (دەرچەی بەستەری هێڵ) */}
                      <button
                        type="button"
                        id={`port-emp-out-${emp.id}`}
                        onClick={(e) => handleStartWire('employee', emp.id, emp.name, `port-emp-out-${emp.id}`, e)}
                        className={`absolute -left-2.5 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full flex items-center justify-center cursor-pointer transition-all shadow-md z-30 ${
                          isDrawingFromThis
                            ? 'bg-[#007AFF] text-white ring-4 ring-blue-500/30 scale-125'
                            : 'bg-white dark:bg-[#1c1c1e] text-slate-500 hover:text-white hover:bg-[#007AFF] border-2 border-[#007AFF] hover:scale-125'
                        }`}
                        title="کلیک یان ڕابکێشە بۆ بەستنەوە بە ئەرک"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ------------------------------------------------------------ */}
            {/* COLUMN 2 (MIDDLE): ئەرکەکان (TASKS & TRIGGERS) */}
            {/* ------------------------------------------------------------ */}
            <div className="space-y-4 flex flex-col">
              <div className="pb-3 border-b border-slate-200/80 dark:border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-[#AF52DE]"></span>
                  <h2 className="text-sm font-black text-slate-900 dark:text-white">
                    ناوەڕاست: ئەرکەکان و کارلێکەکان
                  </h2>
                </div>
                <span className="text-[11px] font-mono text-slate-400 font-bold">
                  {WORKFLOW_ACTIONS.length} ئەرک
                </span>
              </div>

              <div 
                className="space-y-3 overflow-y-auto max-h-[620px] px-3 custom-scrollbar"
                onScroll={updatePortCoordinates}
              >
                {WORKFLOW_ACTIONS.map((action) => {
                  const IconComp = ICON_MAP[action.iconName] || Zap;

                  // Count incoming wires from employees
                  const inCount = connections.filter(
                    (c) => c.toType === 'task' && c.toId === action.id
                  ).length;

                  // Count outgoing wires to roles
                  const outCount = connections.filter(
                    (c) => c.fromType === 'task' && c.fromId === action.id
                  ).length;

                  const isTargetHovered = drawingWire?.fromType === 'employee';
                  const isSourceActive = drawingWire?.fromType === 'task' && drawingWire?.fromId === action.id;

                  return (
                    <div
                      key={action.id}
                      className={`p-4 rounded-2xl border transition-all relative group bg-white/90 dark:bg-[#242426]/90 shadow-2xs ${
                        isSourceActive
                          ? 'border-[#AF52DE] ring-2 ring-purple-500/20 shadow-md'
                          : 'border-slate-200/80 dark:border-white/5 hover:border-slate-300'
                      }`}
                    >
                      {/* IN-PORT ANCHOR (Receives from Employees) */}
                      <button
                        type="button"
                        id={`port-task-in-${action.id}`}
                        onClick={(e) => handleCompleteWire('task', action.id, e)}
                        className={`absolute -right-2.5 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full flex items-center justify-center cursor-pointer transition-all shadow-md z-30 ${
                          isTargetHovered
                            ? 'bg-emerald-500 text-white ring-4 ring-emerald-500/30 scale-125 animate-pulse'
                            : 'bg-white dark:bg-[#1c1c1e] text-slate-500 border-2 border-emerald-500 hover:scale-125 hover:bg-emerald-500 hover:text-white'
                        }`}
                        title="کلیک بکە بۆ تەواوکردنی بەستەری ئەم ئەرکە لەگەڵ کارمەند"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
                      </button>

                      {/* OUT-PORT ANCHOR (Sends to Roles) */}
                      <button
                        type="button"
                        id={`port-task-out-${action.id}`}
                        onClick={(e) => handleStartWire('task', action.id, action.title, `port-task-out-${action.id}`, e)}
                        className={`absolute -left-2.5 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full flex items-center justify-center cursor-pointer transition-all shadow-md z-30 ${
                          isSourceActive
                            ? 'bg-[#AF52DE] text-white ring-4 ring-purple-500/30 scale-125'
                            : 'bg-white dark:bg-[#1c1c1e] text-slate-500 hover:text-white hover:bg-[#AF52DE] border-2 border-[#AF52DE] hover:scale-125'
                        }`}
                        title="کلیک یان ڕابکێشە بۆ بەستنەوە بە دەسەڵاتی بڕیاردانی لای چەپ"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
                      </button>

                      <div className="flex items-start gap-3">
                        <div 
                          className="w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0 shadow-xs"
                          style={{ backgroundColor: action.color }}
                        >
                          <IconComp className="w-5 h-5" />
                        </div>

                        <div className="flex-1 space-y-1">
                          <h3 className="text-xs font-black text-slate-900 dark:text-white">
                            {action.title}
                          </h3>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                            {action.description}
                          </p>

                          {/* Stats badge */}
                          <div className="flex items-center gap-2 pt-2 text-[10px] font-mono text-slate-500">
                            <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-white/5 font-bold">
                              ⬅️ {inCount} کارمەند
                            </span>
                            <span className="px-2 py-0.5 rounded-md bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-300 font-bold">
                              ➡️ {outCount} دەسەڵات
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ------------------------------------------------------------ */}
            {/* COLUMN 3 (LEFT): ڕۆڵەکان و دەسەڵاتەکانی بڕیاردان */}
            {/* ------------------------------------------------------------ */}
            <div className="space-y-4 flex flex-col">
              <div className="pb-3 border-b border-slate-200/80 dark:border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-[#34C759]"></span>
                  <h2 className="text-sm font-black text-slate-900 dark:text-white">
                    لای چەپ: دەسەڵات و وەرگرانی بڕیار
                  </h2>
                </div>
                <span className="text-[11px] font-mono text-slate-400 font-bold">
                  {DESTINATION_ROLES.length} دەسەڵات
                </span>
              </div>

              <div 
                className="space-y-3 overflow-y-auto max-h-[620px] pl-1 pr-3 custom-scrollbar"
                onScroll={updatePortCoordinates}
              >
                {DESTINATION_ROLES.map((role) => {
                  // Count wires incoming to this role
                  const inCount = connections.filter(
                    (c) => c.toType === 'role' && c.toId === role.id
                  ).length;

                  const isTargetHovered = drawingWire?.fromType === 'task';

                  return (
                    <div
                      key={role.id}
                      className="p-4 rounded-2xl border transition-all relative group bg-white/90 dark:bg-[#242426]/90 border-slate-200/80 dark:border-white/5 hover:border-slate-300 shadow-2xs"
                      style={{
                        borderLeftWidth: '4px',
                        borderLeftColor: role.color,
                      }}
                    >
                      {/* IN-PORT ANCHOR (Receives from Tasks) */}
                      <button
                        type="button"
                        id={`port-role-in-${role.id}`}
                        onClick={(e) => handleCompleteWire('role', role.id, e)}
                        className={`absolute -right-2.5 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full flex items-center justify-center cursor-pointer transition-all shadow-md z-30 ${
                          isTargetHovered
                            ? 'bg-purple-500 text-white ring-4 ring-purple-500/30 scale-125 animate-pulse'
                            : 'bg-white dark:bg-[#1c1c1e] text-slate-500 border-2 border-purple-500 hover:scale-125 hover:bg-purple-500 hover:text-white'
                        }`}
                        title="کلیک بکە بۆ تەواوکردنی بەستەری ئەم دەسەڵاتە لەگەڵ ئەرک"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
                      </button>

                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <span 
                            className="px-2 py-0.5 rounded-md text-[10px] font-bold text-white shrink-0"
                            style={{ backgroundColor: role.color }}
                          >
                            {role.title}
                          </span>
                          <span className="text-[10px] font-mono font-bold text-slate-400">
                            {inCount} ئەرک
                          </span>
                        </div>

                        <h3 className="text-xs font-black text-slate-900 dark:text-white">
                          {role.name}
                        </h3>

                        <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                          {role.description}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

          </div>
        </div>
      )}

      {/* 3. LIVE NOTIFICATION SIMULATOR TAB */}
      {activeTab === 'simulator' && (
        <div className="bg-white/90 dark:bg-[#1c1c1e]/90 backdrop-blur-xl border border-slate-200/90 dark:border-white/10 rounded-3xl p-6 sm:p-8 shadow-xs space-y-6">
          <div className="flex items-center gap-3 pb-4 border-b border-slate-100 dark:border-white/10">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-[#007AFF] flex items-center justify-center">
              <Send className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-slate-900 dark:text-white">
                تاقیکەرەوەی ڕاستەوخۆی ئاگادارییەکانی تەلەگرام بەپێی بەستەرە دەستییەکان
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                کاتێک کارمەند لە تەلەگرام یان سیستم داواکاری یان چالاکییەک ئەنجام دەدات، کێ ئاگادارییەکەی پێ دەگات و دوگمەی پەسەندکردنی دەبێت
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                جۆری ئەرک / چالاکی
              </label>
              <select
                value={simTask}
                onChange={(e) => setSimTask(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#2c2c2e] text-xs font-bold text-slate-800 dark:text-slate-200"
              >
                {WORKFLOW_ACTIONS.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.title}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                کارمەندی داواکار
              </label>
              <select
                value={simEmployeeId}
                onChange={(e) => setSimEmployeeId(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#2c2c2e] text-xs font-bold text-slate-800 dark:text-slate-200"
              >
                {ASHLEY_OFFICIAL_EMPLOYEES.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name} ({emp.id})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                بەرواری دیاریکراو
              </label>
              <input
                type="text"
                value={simDate}
                onChange={(e) => setSimDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#2c2c2e] text-xs font-bold text-slate-800 dark:text-slate-200"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                تێبینی / هۆکار
              </label>
              <input
                type="text"
                value={simNote}
                onChange={(e) => setSimNote(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#2c2c2e] text-xs font-bold text-slate-800 dark:text-slate-200"
              />
            </div>
          </div>

          {/* Results: Approvers & Telegram Bot Cards */}
          <div className="mt-4 pt-4 border-t border-slate-100 dark:border-white/10 space-y-4">
            <h3 className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              <span>ئەو بەڕێوەبەر و کەسانەی ڕاستەوخۆ لە تەلەگرام ئەم ئاگادارییە وەردەگرن ({simulatedRecipients.length}):</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {simulatedRecipients.map((rec) => {
                const empObj = ASHLEY_OFFICIAL_EMPLOYEES.find((e) => e.id === simEmployeeId);
                const empName = empObj?.name || 'کارمەندی ئاشڵی';

                return (
                  <div
                    key={rec.role}
                    className="p-4 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200/80 dark:border-white/10 space-y-3 relative"
                  >
                    <div className="flex items-center justify-between">
                      <span 
                        className="px-2 py-0.5 rounded-md text-[10px] font-bold text-white"
                        style={{ backgroundColor: rec.color }}
                      >
                        {rec.title}
                      </span>
                      <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
                        ئامادەیە بۆ بڕیاردان
                      </span>
                    </div>

                    <div>
                      <h4 className="text-xs font-black text-slate-900 dark:text-white">
                        {rec.name}
                      </h4>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        {rec.reason}
                      </p>
                    </div>

                    <div className="p-3 rounded-xl bg-white dark:bg-[#242426] border border-slate-200/60 dark:border-white/5 text-[11px] font-mono text-slate-700 dark:text-slate-300 space-y-1.5">
                      <div className="font-bold text-blue-600 dark:text-blue-400">
                        🔔 داواکاری مۆڵەتی نوێ
                      </div>
                      <div>👤 کارمەند: <b>{empName}</b> ({simEmployeeId})</div>
                      <div>📅 بەرواری مۆڵەت: <b>{simDate}</b></div>
                      <div>📝 هۆکار: <i>{simNote}</i></div>
                    </div>

                    {/* Interactive Telegram Mock Buttons */}
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <button 
                        type="button" 
                        className="py-1.5 px-2 rounded-xl bg-emerald-600 text-white text-[11px] font-bold shadow-2xs hover:bg-emerald-500 transition-all cursor-pointer text-center"
                      >
                        ✅ پەسەندکردن
                      </button>
                      <button 
                        type="button" 
                        className="py-1.5 px-2 rounded-xl bg-red-600 text-white text-[11px] font-bold shadow-2xs hover:bg-red-500 transition-all cursor-pointer text-center"
                      >
                        ❌ ڕەتکردنەوە
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
