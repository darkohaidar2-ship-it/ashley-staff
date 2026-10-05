import { supabase, fetchSupabaseJson, saveSupabaseJson } from '@/lib/supabase/client';
import { logger } from '@/lib/logger';
import { ASHLEY_OFFICIAL_EMPLOYEES } from '@/lib/ashley-employees';

export type UserRole = 
  | 'founder'             // کاک دارکۆ حەیدەر - Full Authority
  | 'warehouse_manager'   // کاک کامەران - Warehouse Head (Leave, Absence, Holiday, Warehouse Staff)
  | 'general_manager'     // مامۆستا وەلید - General Operations
  | 'it_admin'            // بەشی ئایتی - System & Devices
  | 'supervisor'          // سەرپەرشتیاری بەش - Team Attendance
  | 'employee';           // کارمەندی ئاسایی - Standard Staff

export interface RoleDefinition {
  id: UserRole;
  title: string;
  name: string;
  employeeId: string;
  color: string;
  avatar?: string;
  allowedActions: string[];
  scope: string[];
}

export interface TaskActionDefinition {
  id: string;
  title: string;
  description: string;
  iconName: string;
  defaultRoles: UserRole[];
  color: string;
}

export interface ScopeBranchDefinition {
  id: string;
  title: string;
  category: string;
}

export interface NotificationWorkflowRule {
  roleId: UserRole;
  employeeId: string;
  actionId: string;
  scopeId: string;
  enabled: boolean;
}

export const WORKFLOW_ROLES: RoleDefinition[] = [
  {
    id: 'founder',
    title: 'دامەزرێنەر و خاوەنی کۆمپانیا',
    name: 'دارکۆ حەیدەر حسێن',
    employeeId: 'emp-02',
    color: '#007AFF', // Royal Blue
    allowedActions: [
      'leave_approval', 
      'mark_absence', 
      'set_holiday', 
      'late_alerts', 
      'gps_geofence', 
      'broadcast_msg', 
      'device_management', 
      'shift_control',
      'full_reports'
    ],
    scope: ['all_branches'],
  },
  {
    id: 'warehouse_manager',
    title: 'بەڕێوەبەری کۆگا',
    name: 'کامەران عومەر ڕووئوف',
    employeeId: 'emp-06',
    color: '#AF52DE', // Purple
    allowedActions: [
      'leave_approval', 
      'mark_absence', 
      'set_holiday', 
      'late_alerts', 
      'warehouse_reports'
    ],
    scope: ['warehouse', 'factory'],
  },
  {
    id: 'general_manager',
    title: 'بەڕێوەبەری گشتی',
    name: 'مامۆستا وەلید',
    employeeId: 'fe2ad0d3-4d9d-48f8-8cbb-51dc705678e3',
    color: '#34C759', // Green
    allowedActions: [
      'leave_approval', 
      'broadcast_msg', 
      'late_alerts', 
      'full_reports'
    ],
    scope: ['all_branches'],
  },
  {
    id: 'supervisor',
    title: 'سەرپەرشتیاری دەوام و گواستنەوە',
    name: 'شادیار هوشیار / هەڤاڵ حبیب',
    employeeId: 'emp-03',
    color: '#FF9500', // Orange
    allowedActions: [
      'team_attendance', 
      'late_alerts'
    ],
    scope: ['local_branch'],
  },
  {
    id: 'it_admin',
    title: 'بەشی ئایتی و پشتگیری تەکنیکی',
    name: 'ئایتی کۆمپانیای ئاشڵی',
    employeeId: 'it-admin',
    color: '#5856D6', // Indigo
    allowedActions: [
      'device_management', 
      'system_diagnostics'
    ],
    scope: ['all_branches'],
  },
  {
    id: 'employee',
    title: 'کارمەندی ئاسایی',
    name: 'سەرجەم کارمەندانی ئاشڵی',
    employeeId: '*',
    color: '#FF2D55', // Pink
    allowedActions: [
      'self_checkin', 
      'self_report', 
      'request_leave', 
      'view_profile'
    ],
    scope: ['local_branch'],
  },
];

export const WORKFLOW_ACTIONS: TaskActionDefinition[] = [
  {
    id: 'leave_approval',
    title: 'پەسەندکردنی داواکاری مۆڵەت',
    description: 'وەرگرتن و پەسەندکردن یان ڕەتکردنەوەی مۆڵەتی کارمەندان',
    iconName: 'Palmtree',
    defaultRoles: ['founder', 'warehouse_manager', 'general_manager'],
    color: '#007AFF',
  },
  {
    id: 'mark_absence',
    title: 'تۆمارکردنی غیاب و لێبڕین',
    description: 'تۆمارکردنی غیابی ڕاستەوخۆ بۆ کارمەند لە تەلەگرام و سیستەم',
    iconName: 'UserX',
    defaultRoles: ['founder', 'warehouse_manager'],
    color: '#FF3B30',
  },
  {
    id: 'set_holiday',
    title: 'دیاریکردنی پشووی فەرمی',
    description: 'دیاریکردنی پشووی گشتی کۆمپانیا بەبێ هەژمارکردنی غیاب',
    iconName: 'CalendarOff',
    defaultRoles: ['founder', 'warehouse_manager', 'general_manager'],
    color: '#34C759',
  },
  {
    id: 'late_alerts',
    title: 'ئاگاداری دواکەوتنی دەوام',
    description: 'ناردنی ئاگاداری دەستبەجێ کاتێک کارمەند دوای ٠٨:١٥ دێت',
    iconName: 'ClockAlert',
    defaultRoles: ['founder', 'warehouse_manager', 'supervisor'],
    color: '#FF9500',
  },
  {
    id: 'broadcast_msg',
    title: 'ناردنی ئاگاداری گشتی',
    description: 'ناردنی ڕاگەیاندنی فەرمی بەڕێوەبەرایەتی بۆ هەموو کارمەندان',
    iconName: 'Megaphone',
    defaultRoles: ['founder', 'general_manager'],
    color: '#AF52DE',
  },
  {
    id: 'device_management',
    title: 'بەڕێوەبردنی مۆبایل و ئامێرەکان',
    description: 'بەستنەوە، کردنەوەی قوفڵی ئامێر و ڕێگری لە تەزویر',
    iconName: 'Smartphone',
    defaultRoles: ['founder', 'it_admin'],
    color: '#5856D6',
  },
  {
    id: 'gps_geofence',
    title: 'دیاریکردنی لۆکەیشن و GPS',
    description: 'پشکنین و دیاریکردنی سنوری بازنەی دەوامی لقەکان',
    iconName: 'MapPin',
    defaultRoles: ['founder'],
    color: '#30B0C7',
  },
];

export const WORKFLOW_SCOPES: ScopeBranchDefinition[] = [
  { id: 'all_branches', title: 'هەموو لقەکان و بەشەکان', category: 'گشتی' },
  { id: 'warehouse', title: 'کۆگای سەرەکی ئاشڵی', category: 'کۆگا' },
  { id: 'factory', title: 'کارگە و دروستکردنی مۆبیلیات', category: 'کارگە' },
  { id: 'showroom', title: 'پێشانگای سەرەکی ئاشڵی (Showroom)', category: 'فرۆشتن' },
  { id: 'sulaymaniyah', title: 'دیوان ١ و ٥ - سلێمانی', category: 'لق' },
  { id: 'erbil', title: 'دیوان ئاشڵی - هەولێر', category: 'لق' },
  { id: 'duhok', title: 'دیوان ئەلفەمۆ - دهۆک', category: 'لق' },
  { id: 'local_branch', title: 'لقەکانی خۆی', category: 'سنوردار' },
];

const WORKFLOW_REGISTRY_KEY = 'ashley_notification_workflows';

/**
 * Determine the user role based on employeeId, role, or name
 */
export function resolveEmployeeRole(employeeId: string, employeeName?: string): UserRole {
  const cleanId = (employeeId || '').toLowerCase().trim();
  const name = (employeeName || '').toLowerCase().trim();

  // 1. Founder (کاک دارکۆ حەیدەر)
  if (cleanId === 'emp-02' || cleanId === '02' || name.includes('دارکۆ')) {
    return 'founder';
  }

  // 2. Warehouse Manager (کاک کامەران عومەر)
  if (cleanId === 'emp-06' || cleanId === '06' || name.includes('کامەران')) {
    return 'warehouse_manager';
  }

  // 3. General Manager (مامۆستا وەلید)
  if (
    cleanId === 'emp-13' || 
    cleanId === '13' || 
    cleanId.includes('fe2ad0d3') || 
    name.includes('وەلید')
  ) {
    return 'general_manager';
  }

  // 4. IT Admin
  if (name.includes('ئایتی') || name.includes('it') || cleanId === 'it-admin') {
    return 'it_admin';
  }

  // 5. Supervisors (شادیار / هەڤاڵ)
  if (
    cleanId === 'emp-03' || 
    cleanId === 'emp-04' || 
    name.includes('شادیار') || 
    name.includes('هەڤاڵ')
  ) {
    return 'supervisor';
  }

  return 'employee';
}

/**
 * Fetch the active workflow rules from Supabase
 */
export async function fetchNotificationWorkflowRules(): Promise<NotificationWorkflowRule[]> {
  try {
    const rules = await fetchSupabaseJson<NotificationWorkflowRule[]>(WORKFLOW_REGISTRY_KEY, []);
    if (rules && Array.isArray(rules) && rules.length > 0) {
      return rules;
    }
  } catch (err) {
    logger.warn('[WorkflowService] Error fetching rules from Supabase:', err);
  }

  // Default seed rules matching the system structure
  const defaultRules: NotificationWorkflowRule[] = [];

  // Founder has all actions for all branches
  for (const act of WORKFLOW_ACTIONS) {
    defaultRules.push({
      roleId: 'founder',
      employeeId: 'emp-02',
      actionId: act.id,
      scopeId: 'all_branches',
      enabled: true,
    });
  }

  // Warehouse manager (کاک کامەران) has leave approval, absence, holiday, late alerts
  defaultRules.push(
    { roleId: 'warehouse_manager', employeeId: 'emp-06', actionId: 'leave_approval', scopeId: 'warehouse', enabled: true },
    { roleId: 'warehouse_manager', employeeId: 'emp-06', actionId: 'mark_absence', scopeId: 'warehouse', enabled: true },
    { roleId: 'warehouse_manager', employeeId: 'emp-06', actionId: 'set_holiday', scopeId: 'warehouse', enabled: true },
    { roleId: 'warehouse_manager', employeeId: 'emp-06', actionId: 'late_alerts', scopeId: 'warehouse', enabled: true }
  );

  // General manager (مامۆستا وەلید) has leave approval, broadcast
  defaultRules.push(
    { roleId: 'general_manager', employeeId: 'emp-13', actionId: 'leave_approval', scopeId: 'all_branches', enabled: true },
    { roleId: 'general_manager', employeeId: 'emp-13', actionId: 'broadcast_msg', scopeId: 'all_branches', enabled: true }
  );

  // IT admin
  defaultRules.push(
    { roleId: 'it_admin', employeeId: 'it-admin', actionId: 'device_management', scopeId: 'all_branches', enabled: true }
  );

  return defaultRules;
}

/**
 * Save updated workflow rules to Supabase
 */
export async function saveNotificationWorkflowRules(rules: NotificationWorkflowRule[]): Promise<boolean> {
  try {
    return await saveSupabaseJson<NotificationWorkflowRule[]>(
      WORKFLOW_REGISTRY_KEY,
      'Ashley Notification & Task Workflow Matrix',
      rules
    );
  } catch (err) {
    logger.error('[WorkflowService] Error saving rules:', err);
    return false;
  }
}

/**
 * Check if a specific employee or role has permission for an action in a scope
 */
export async function hasActionPermission(
  employeeId: string, 
  actionId: string, 
  scopeId?: string
): Promise<boolean> {
  const role = resolveEmployeeRole(employeeId);
  // Founder always has permission
  if (role === 'founder') return true;

  const rules = await fetchNotificationWorkflowRules();
  return rules.some(r => 
    r.enabled && 
    (r.employeeId === employeeId || r.roleId === role) && 
    r.actionId === actionId &&
    (!scopeId || r.scopeId === scopeId || r.scopeId === 'all_branches')
  );
}

/**
 * Get all employee IDs or Telegram Chat IDs who should be notified for a specific task action
 */
export async function getActionRecipients(
  actionId: string, 
  bindings: Record<string, { employeeId: string; employeeName: string }>
): Promise<Array<{ chatId: string; employeeId: string; employeeName: string; role: UserRole }>> {
  const rules = await fetchNotificationWorkflowRules();
  const allowedRules = rules.filter(r => r.enabled && r.actionId === actionId);

  const recipients: Array<{ chatId: string; employeeId: string; employeeName: string; role: UserRole }> = [];

  for (const [chatId, info] of Object.entries(bindings)) {
    const role = resolveEmployeeRole(info.employeeId, info.employeeName);
    const matchesRule = allowedRules.some(r => r.roleId === role || r.employeeId === info.employeeId);
    
    // Founder always gets important notifications
    if (role === 'founder' || matchesRule) {
      if (!recipients.some(rc => rc.chatId === chatId)) {
        recipients.push({
          chatId,
          employeeId: info.employeeId,
          employeeName: info.employeeName,
          role,
        });
      }
    }
  }

  return recipients;
}
