'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  WORKFLOW_ROLES, 
  WORKFLOW_ACTIONS, 
  WORKFLOW_SCOPES, 
  NotificationWorkflowRule, 
  UserRole,
  fetchNotificationWorkflowRules,
  saveNotificationWorkflowRules
} from '@/lib/workflow/workflow-service';
import { 
  ShieldCheck, 
  Sparkles, 
  RefreshCw, 
  Save, 
  Send, 
  Users, 
  CheckCircle2, 
  AlertCircle, 
  Palmtree, 
  UserX, 
  CalendarOff, 
  Clock, 
  Megaphone, 
  Smartphone, 
  MapPin, 
  Eye, 
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  Zap,
  Building,
  Check
} from 'lucide-react';

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Palmtree,
  UserX,
  CalendarOff,
  ClockAlert: Clock,
  Megaphone,
  Smartphone,
  MapPin,
};

export default function NotificationRoutingMatrix() {
  const [rules, setRules] = useState<NotificationWorkflowRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);
  const [selectedAction, setSelectedAction] = useState<string | null>(null);
  const [hoveredRole, setHoveredRole] = useState<UserRole | null>(null);
  const [hoveredAction, setHoveredAction] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'visual' | 'simulator' | 'table'>('visual');

  // Simulator state
  const [simAction, setSimAction] = useState<string>('leave_approval');
  const [simEmployee, setSimEmployee] = useState<string>('ئالان سەردار (کۆگا)');
  const [simDate, setSimDate] = useState<string>('2026-10-11');

  // SVG lines ref
  const containerRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState<{
    roles: Record<string, { x: number; y: number }>;
    actionsLeft: Record<string, { x: number; y: number }>;
    actionsRight: Record<string, { x: number; y: number }>;
    scopes: Record<string, { x: number; y: number }>;
  }>({
    roles: {},
    actionsLeft: {},
    actionsRight: {},
    scopes: {},
  });

  // Load rules on mount
  useEffect(() => {
    async function load() {
      setLoading(true);
      const data = await fetchNotificationWorkflowRules();
      setRules(data);
      setLoading(false);
    }
    load();
  }, []);

  // Calculate coordinates for SVG connecting lines
  const updateCoordinates = () => {
    if (!containerRef.current) return;
    const containerRect = containerRef.current.getBoundingClientRect();

    const newCoords = {
      roles: {} as Record<string, { x: number; y: number }>,
      actionsLeft: {} as Record<string, { x: number; y: number }>,
      actionsRight: {} as Record<string, { x: number; y: number }>,
      scopes: {} as Record<string, { x: number; y: number }>,
    };

    // Right Column: Roles (RTL: right is start of flow)
    WORKFLOW_ROLES.forEach((r) => {
      const el = document.getElementById(`node-role-${r.id}`);
      if (el) {
        const rect = el.getBoundingClientRect();
        newCoords.roles[r.id] = {
          x: rect.left - containerRect.left + 8, // Left edge of role card
          y: rect.top - containerRect.top + rect.height / 2,
        };
      }
    });

    // Middle Column: Actions
    WORKFLOW_ACTIONS.forEach((a) => {
      const el = document.getElementById(`node-action-${a.id}`);
      if (el) {
        const rect = el.getBoundingClientRect();
        newCoords.actionsRight[a.id] = {
          x: rect.right - containerRect.left - 8, // Right edge facing roles
          y: rect.top - containerRect.top + rect.height / 2,
        };
        newCoords.actionsLeft[a.id] = {
          x: rect.left - containerRect.left + 8, // Left edge facing scopes
          y: rect.top - containerRect.top + rect.height / 2,
        };
      }
    });

    // Left Column: Scopes
    WORKFLOW_SCOPES.forEach((s) => {
      const el = document.getElementById(`node-scope-${s.id}`);
      if (el) {
        const rect = el.getBoundingClientRect();
        newCoords.scopes[s.id] = {
          x: rect.right - containerRect.left - 8, // Right edge facing actions
          y: rect.top - containerRect.top + rect.height / 2,
        };
      }
    });

    setCoords(newCoords);
  };

  useEffect(() => {
    updateCoordinates();
    window.addEventListener('resize', updateCoordinates);
    const timer = setTimeout(updateCoordinates, 300);
    return () => {
      window.removeEventListener('resize', updateCoordinates);
      clearTimeout(timer);
    };
  }, [loading, activeTab, rules]);

  // Toggle rule
  const handleToggleRule = (roleId: UserRole, actionId: string, scopeId: string = 'all_branches') => {
    setRules((prev) => {
      const idx = prev.findIndex(
        (r) => r.roleId === roleId && r.actionId === actionId && r.scopeId === scopeId
      );
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = { ...updated[idx], enabled: !updated[idx].enabled };
        return updated;
      } else {
        const empId = WORKFLOW_ROLES.find((r) => r.id === roleId)?.employeeId || '*';
        return [...prev, { roleId, employeeId: empId, actionId, scopeId, enabled: true }];
      }
    });
  };

  // Save rules to Supabase
  const handleSave = async () => {
    setSaving(true);
    setSaveSuccess(false);
    const ok = await saveNotificationWorkflowRules(rules);
    setSaving(false);
    if (ok) {
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } else {
      alert('❌ هەڵەیەک ڕوویدا لە کاتی هەڵگرتنی یاساکان لە بنکەدراوە.');
    }
  };

  // Reset to system defaults
  const handleResetDefaults = async () => {
    if (!confirm('ئایا دڵنیایت لە گەڕاندنەوەی یاساکان بۆ باری بنەڕەتی کۆمپانیا؟')) return;
    setLoading(true);
    const ok = await saveNotificationWorkflowRules([]);
    if (ok) {
      const fresh = await fetchNotificationWorkflowRules();
      setRules(fresh);
    }
    setLoading(false);
  };

  // Active connections map
  const activeRoleActionSet = useMemo(() => {
    const set = new Set<string>();
    rules.forEach((r) => {
      if (r.enabled) set.add(`${r.roleId}__${r.actionId}`);
    });
    return set;
  }, [rules]);

  // Simulator recipients
  const simulatedRecipients = useMemo(() => {
    const list: Array<{ role: UserRole; name: string; title: string; color: string; branch: string; reason: string }> = [];
    
    // Check which roles have enabled rule for simAction
    WORKFLOW_ROLES.forEach((r) => {
      const isEnabled = rules.some((rule) => rule.roleId === r.id && rule.actionId === simAction && rule.enabled);
      if (r.id === 'founder' || isEnabled) {
        let reason = 'دەسەڵاتی بڕیاردان و پێداچوونەوە لە تەلەگرام';
        if (r.id === 'founder') reason = 'دامەزرێنەر - ئاگاداری ڕاستەوخۆ و پەسەندکردنی باڵا';
        else if (r.id === 'warehouse_manager') reason = 'بەرپرسی کۆگا - وەرگرتنی داواکاری و تۆمارکردنی خشتە';
        else if (r.id === 'general_manager') reason = 'بەڕێوەبەری گشتی - چاودێری و بڕیار لە تەلەگرام';

        list.push({
          role: r.id,
          name: r.name,
          title: r.title,
          color: r.color,
          branch: r.scope.join(', '),
          reason,
        });
      }
    });

    return list;
  }, [rules, simAction]);

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 animate-fade-in print:hidden" dir="rtl">
      
      {/* 1. TOP HEADER & CONTROLS */}
      <div className="bg-white/90 dark:bg-[#1c1c1e]/90 backdrop-blur-xl border border-slate-200/80 dark:border-white/10 rounded-3xl p-5 sm:p-6 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#007AFF] to-[#5856D6] flex items-center justify-center text-white shadow-md shadow-blue-500/20 shrink-0">
            <SlidersHorizontal className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white">
                بەڕێوەبردنی ئاگادارییەکان و دەسەڵاتەکان
              </h1>
              <span className="px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/40 text-[#007AFF] dark:text-blue-400 border border-blue-200/50 dark:border-blue-800/40 text-[10px] font-bold">
                تەلەگرام بۆت & ERP
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
              دیاریکردنی ئەرک، ئاگاداری مۆڵەت، غیاب، پشوو و بەشەکان بە شێوازی نەخشەی بەستەر (Routing Matrix)
            </p>
          </div>
        </div>

        {/* View Switcher & Action Buttons */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-end">
          <div className="flex items-center bg-slate-100 dark:bg-white/10 p-1 rounded-2xl">
            <button
              type="button"
              onClick={() => setActiveTab('visual')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'visual'
                  ? 'bg-white dark:bg-[#2c2c2e] text-[#007AFF] shadow-2xs font-black'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Zap className="w-3.5 h-3.5" />
              <span>نەخشەی پەیوەندییەکان</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('simulator')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'simulator'
                  ? 'bg-white dark:bg-[#2c2c2e] text-[#007AFF] shadow-2xs font-black'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Send className="w-3.5 h-3.5" />
              <span>تاقیکردنەوەی ئاگاداری</span>
            </button>
          </div>

          <button
            type="button"
            onClick={handleResetDefaults}
            disabled={loading || saving}
            className="p-2 sm:px-3 sm:py-2 rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 hover:bg-slate-100 dark:bg-white/5 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
            title="گەڕاندنەوە بۆ باری بنەڕەتی"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">باری بنەڕەتی</span>
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
            <span>{saveSuccess ? 'پاشەکەوت کرا!' : 'پاشەکەوتکردن و هاوکاتکردن'}</span>
          </button>
        </div>
      </div>

      {/* 2. MAIN WORKFLOW VISUAL CANVAS */}
      {activeTab === 'visual' && (
        <div 
          ref={containerRef}
          className="relative bg-white/70 dark:bg-[#1c1c1e]/70 backdrop-blur-md border border-slate-200/80 dark:border-white/10 rounded-3xl p-6 sm:p-8 shadow-xs overflow-hidden"
        >
          {/* Informational Guidance Alert */}
          <div className="mb-6 p-4 rounded-2xl bg-blue-50/70 dark:bg-blue-950/20 border border-blue-200/60 dark:border-blue-800/40 flex items-center justify-between gap-3 text-xs text-blue-900 dark:text-blue-200">
            <div className="flex items-center gap-2 font-medium">
              <Sparkles className="w-4 h-4 text-[#007AFF] shrink-0" />
              <span>
                <b>ڕێنمایی دەسەڵاتەکان:</b> کلیک لەسەر هەر ڕۆڵێک (کێ) یان ئەرکێک (چی) بکە تا دەسەڵاتەکان و پەیوەندییەکانی چالاک یان ناچالاک بکەیت. کاک دارکۆ و کاک کامەران دەسەڵاتی مۆڵەت و غیاب و پشوویان هەیە.
              </span>
            </div>
            <div className="flex items-center gap-2 text-[11px] font-mono shrink-0">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>سەرکەوتووانە بەستراوە بە بۆت</span>
            </div>
          </div>

          {/* SVG Connection Lines Overlay */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none z-10">
            {/* Draw lines from Roles (Column 1) to Actions (Column 2) */}
            {WORKFLOW_ROLES.map((role) => {
              const roleCoord = coords.roles[role.id];
              if (!roleCoord) return null;

              return WORKFLOW_ACTIONS.map((action) => {
                const actionCoord = coords.actionsRight[action.id];
                if (!actionCoord) return null;

                const isConnected = activeRoleActionSet.has(`${role.id}__${action.id}`);
                const isHovered = hoveredRole === role.id || hoveredAction === action.id;
                const isSelected = selectedRole === role.id || selectedAction === action.id;

                if (!isConnected && !isHovered && !isSelected) return null;

                // Cubic Bézier Curve
                const dx = (actionCoord.x - roleCoord.x) / 2;
                const pathD = `M ${roleCoord.x} ${roleCoord.y} C ${roleCoord.x + dx} ${roleCoord.y}, ${actionCoord.x - dx} ${actionCoord.y}, ${actionCoord.x} ${actionCoord.y}`;

                return (
                  <path
                    key={`line-${role.id}-${action.id}`}
                    d={pathD}
                    fill="none"
                    stroke={role.color}
                    strokeWidth={isSelected || isHovered ? 3.5 : isConnected ? 2 : 1}
                    strokeOpacity={isSelected || isHovered ? 0.95 : isConnected ? 0.45 : 0.15}
                    strokeDasharray={isConnected ? 'none' : '4,4'}
                    className="transition-all duration-300"
                  />
                );
              });
            })}

            {/* Draw lines from Actions (Column 2) to Scopes (Column 3) */}
            {WORKFLOW_ACTIONS.map((action) => {
              const actionCoord = coords.actionsLeft[action.id];
              if (!actionCoord) return null;

              return WORKFLOW_SCOPES.slice(0, 4).map((scope) => {
                const scopeCoord = coords.scopes[scope.id];
                if (!scopeCoord) return null;

                const isHovered = hoveredAction === action.id;
                const isSelected = selectedAction === action.id;
                const dx = (scopeCoord.x - actionCoord.x) / 2;
                const pathD = `M ${actionCoord.x} ${actionCoord.y} C ${actionCoord.x + dx} ${actionCoord.y}, ${scopeCoord.x - dx} ${scopeCoord.y}, ${scopeCoord.x} ${scopeCoord.y}`;

                return (
                  <path
                    key={`line-action-${action.id}-scope-${scope.id}`}
                    d={pathD}
                    fill="none"
                    stroke={action.color}
                    strokeWidth={isSelected || isHovered ? 2.5 : 1}
                    strokeOpacity={isSelected || isHovered ? 0.7 : 0.2}
                    className="transition-all duration-300"
                  />
                );
              });
            })}
          </svg>

          {/* 3-COLUMN INTERACTIVE MATRIX GRID */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8 relative z-20">
            
            {/* ============================================================== */}
            {/* COLUMN 1: کێ (WHO / ROLES & OFFICIALS) */}
            {/* ============================================================== */}
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200/80 dark:border-white/10">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-[#007AFF]"></span>
                  <h2 className="text-sm font-black text-slate-900 dark:text-white">
                    کێ (ڕۆڵەکان و بەرپرسان)
                  </h2>
                </div>
                <span className="text-[11px] font-mono text-slate-400">
                  {WORKFLOW_ROLES.length} ڕۆڵ
                </span>
              </div>

              <div className="space-y-3">
                {WORKFLOW_ROLES.map((role) => {
                  const isHovered = hoveredRole === role.id;
                  const isSelected = selectedRole === role.id;
                  const activeCount = rules.filter((r) => r.roleId === role.id && r.enabled).length;

                  return (
                    <div
                      key={role.id}
                      id={`node-role-${role.id}`}
                      onMouseEnter={() => setHoveredRole(role.id)}
                      onMouseLeave={() => setHoveredRole(null)}
                      onClick={() => setSelectedRole(selectedRole === role.id ? null : role.id)}
                      className={`p-4 rounded-2xl border transition-all duration-200 cursor-pointer select-none relative group ${
                        isSelected
                          ? 'bg-white dark:bg-[#2c2c2e] border-[#007AFF] shadow-md ring-2 ring-blue-500/20'
                          : isHovered
                          ? 'bg-slate-50/90 dark:bg-white/10 border-slate-300 dark:border-white/20'
                          : 'bg-white/80 dark:bg-[#242426]/80 border-slate-200/80 dark:border-white/5 hover:border-slate-300'
                      }`}
                      style={{
                        borderRightWidth: '4px',
                        borderRightColor: role.color,
                      }}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <h3 className="text-xs font-black text-slate-900 dark:text-white">
                              {role.name}
                            </h3>
                            {role.id === 'founder' && (
                              <span className="px-1.5 py-0.5 rounded-md bg-blue-100 dark:bg-blue-900/40 text-[#007AFF] text-[9px] font-bold">
                                خاوەن
                              </span>
                            )}
                            {role.id === 'warehouse_manager' && (
                              <span className="px-1.5 py-0.5 rounded-md bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-300 text-[9px] font-bold">
                                کۆگا
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                            {role.title}
                          </p>
                        </div>

                        {/* Connected Count Badge */}
                        <span 
                          className="px-2 py-0.5 rounded-full text-[10px] font-bold font-mono text-white shrink-0"
                          style={{ backgroundColor: role.color }}
                        >
                          {activeCount} ئەرک
                        </span>
                      </div>

                      {/* Role Quick Action Scope Tags */}
                      <div className="flex flex-wrap gap-1 mt-2.5 pt-2 border-t border-slate-100 dark:border-white/5">
                        {role.scope.map((sc) => (
                          <span 
                            key={sc}
                            className="px-1.5 py-0.5 rounded text-[10px] bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400 font-medium"
                          >
                            {sc === 'all_branches' ? 'تەواوی ئاشڵی' : sc === 'warehouse' ? 'کۆگا و کارگە' : sc}
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ============================================================== */}
            {/* COLUMN 2: چی (WHAT / TASKS & PERMISSIONS) */}
            {/* ============================================================== */}
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200/80 dark:border-white/10">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-[#AF52DE]"></span>
                  <h2 className="text-sm font-black text-slate-900 dark:text-white">
                    چی (ئەرک و ئاگادارییەکان)
                  </h2>
                </div>
                <span className="text-[11px] font-mono text-slate-400">
                  {WORKFLOW_ACTIONS.length} ئەرک
                </span>
              </div>

              <div className="space-y-3">
                {WORKFLOW_ACTIONS.map((action) => {
                  const isHovered = hoveredAction === action.id;
                  const isSelected = selectedAction === action.id;
                  const IconComp = ICON_MAP[action.iconName] || Zap;

                  // Find which roles are connected
                  const connectedRoles = WORKFLOW_ROLES.filter((r) =>
                    activeRoleActionSet.has(`${r.id}__${action.id}`)
                  );

                  return (
                    <div
                      key={action.id}
                      id={`node-action-${action.id}`}
                      onMouseEnter={() => setHoveredAction(action.id)}
                      onMouseLeave={() => setHoveredAction(null)}
                      onClick={() => setSelectedAction(selectedAction === action.id ? null : action.id)}
                      className={`p-4 rounded-2xl border transition-all duration-200 cursor-pointer select-none ${
                        isSelected
                          ? 'bg-white dark:bg-[#2c2c2e] border-[#AF52DE] shadow-md ring-2 ring-purple-500/20'
                          : isHovered
                          ? 'bg-slate-50/90 dark:bg-white/10 border-slate-300 dark:border-white/20'
                          : 'bg-white/80 dark:bg-[#242426]/80 border-slate-200/80 dark:border-white/5 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div 
                          className="w-9 h-9 rounded-xl flex items-center justify-center text-white shrink-0 shadow-xs"
                          style={{ backgroundColor: action.color }}
                        >
                          <IconComp className="w-4 h-4" />
                        </div>

                        <div className="flex-1 space-y-1">
                          <div className="flex items-center justify-between">
                            <h3 className="text-xs font-black text-slate-900 dark:text-white">
                              {action.title}
                            </h3>
                          </div>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                            {action.description}
                          </p>

                          {/* Connected Manager Avatars / Pills */}
                          <div className="flex flex-wrap items-center gap-1.5 pt-2">
                            <span className="text-[10px] text-slate-400 font-bold ml-1">بەرپرسان:</span>
                            {WORKFLOW_ROLES.map((role) => {
                              const isChecked = activeRoleActionSet.has(`${role.id}__${action.id}`);
                              return (
                                <button
                                  key={role.id}
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleToggleRule(role.id, action.id);
                                  }}
                                  className={`px-2 py-0.5 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1 cursor-pointer ${
                                    isChecked
                                      ? 'text-white shadow-2xs'
                                      : 'bg-slate-100 dark:bg-white/5 text-slate-400 hover:text-slate-600'
                                  }`}
                                  style={{
                                    backgroundColor: isChecked ? role.color : undefined,
                                  }}
                                  title={`گۆڕینی دەسەڵات بۆ ${role.name}`}
                                >
                                  {isChecked && <Check className="w-2.5 h-2.5" />}
                                  <span>{role.name.split(' ')[0]}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ============================================================== */}
            {/* COLUMN 3: لە کوێ (WHERE / SCOPES & BRANCHES) */}
            {/* ============================================================== */}
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200/80 dark:border-white/10">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-[#34C759]"></span>
                  <h2 className="text-sm font-black text-slate-900 dark:text-white">
                    لە کوێ (لقەکان و مەوداکان)
                  </h2>
                </div>
                <span className="text-[11px] font-mono text-slate-400">
                  {WORKFLOW_SCOPES.length} شوێن
                </span>
              </div>

              <div className="space-y-3">
                {WORKFLOW_SCOPES.map((scope) => (
                  <div
                    key={scope.id}
                    id={`node-scope-${scope.id}`}
                    className="p-3.5 rounded-2xl bg-white/80 dark:bg-[#242426]/80 border border-slate-200/80 dark:border-white/5 flex items-center justify-between gap-3 hover:border-slate-300 transition-all select-none"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-200/50 dark:border-emerald-800/40">
                        <Building className="w-4 h-4" />
                      </div>
                      <div>
                        <h3 className="text-xs font-bold text-slate-900 dark:text-white">
                          {scope.title}
                        </h3>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {scope.category}
                        </span>
                      </div>
                    </div>

                    <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-white/5 text-[10px] font-bold text-slate-500">
                      چالاکە
                    </span>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>
      )}

      {/* 3. LIVE NOTIFICATION SIMULATOR */}
      {activeTab === 'simulator' && (
        <div className="bg-white/80 dark:bg-[#1c1c1e]/80 backdrop-blur-xl border border-slate-200/80 dark:border-white/10 rounded-3xl p-6 sm:p-8 shadow-xs space-y-6">
          <div className="flex items-center gap-3 pb-4 border-b border-slate-100 dark:border-white/10">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-[#007AFF] flex items-center justify-center">
              <Send className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-slate-900 dark:text-white">
                تاقیکەرەوەی ڕاستەوخۆی ئاگاداری تەلەگرام
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                تاقیکردنەوەی ئەوەی کە کاتێک ڕووداوێک ڕوودەدات، کێ ئاگادارییەکەی لە تەلەگرام پێ دەگات و دەتوانێت بڕیار بدات
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                جۆری ئاگاداری / ئەرک
              </label>
              <select
                value={simAction}
                onChange={(e) => setSimAction(e.target.value)}
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
                ناوی کارمەندی داواکار
              </label>
              <input
                type="text"
                value={simEmployee}
                onChange={(e) => setSimEmployee(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#2c2c2e] text-xs font-bold text-slate-800 dark:text-slate-200"
              />
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
          </div>

          {/* Resulting Telegram Flow Notification Cards */}
          <div className="mt-4 pt-4 border-t border-slate-100 dark:border-white/10 space-y-3">
            <h3 className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              <span>ئەو بەڕێوەبەرانەی کە ڕاستەوخۆ لە تەلەگرام ئەم ئاگادارییە وەردەگرن ({simulatedRecipients.length}):</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {simulatedRecipients.map((rec) => (
                <div
                  key={rec.role}
                  className="p-4 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200/80 dark:border-white/10 space-y-2 relative"
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
                      ئۆنلاینە
                    </span>
                  </div>

                  <h4 className="text-xs font-black text-slate-900 dark:text-white">
                    {rec.name}
                  </h4>

                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    {rec.reason}
                  </p>

                  <div className="p-2.5 rounded-xl bg-white dark:bg-[#242426] border border-slate-200/60 dark:border-white/5 text-[11px] font-mono text-slate-700 dark:text-slate-300">
                    📩 <b>دەقی پەیام:</b> داواکاری مۆڵەت بۆ کارمەند {simEmployee} بۆ بەرواری {simDate} گەیشت.
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
