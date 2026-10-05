import { supabase, fetchSupabaseJson, saveSupabaseJson } from '@/lib/supabase/client';
import { logger } from '@/lib/logger';
import { ASHLEY_OFFICIAL_EMPLOYEES } from '@/lib/ashley-employees';

export type UserRole = 
  | 'founder'             // ئەدمین / خاوەن کار (کاک دارکۆ حەیدەر)
  | 'general_manager'     // بەڕێوەبەری گشتی (مامۆستا وەلید)
  | 'warehouse_manager'   // بەڕێوەبەری کۆگا (کاک کامەران عومەر)
  | 'transport_manager'   // بەڕێوەبەری نقڵ (کاک هەڤاڵ حبیب)
  | 'administration'      // ئیدارە و سەرچاوە مرۆییەکان (HR / Admin)
  | 'developer'           // دیڤلۆپەر و گەشەپێدەر (Developer)
  | 'it_admin'            // ئایتی و پشتگیری تەکنیکی
  | 'salesperson'         // فرۆشیار و ستافی پێشانگا
  | 'warehouse_staff'     // ڕێکخستنی کۆگا
  | 'supervisor'          // سەرپەرشتیاری بەش
  | 'employee';           // کارمەندی ئاسایی

export interface RoleOption {
  id: UserRole;
  title: string;
  badge: string;
  color: string;
}

export const ROLE_OPTIONS: RoleOption[] = [
  { id: 'founder', title: 'ئەدمین / خاوەن کار', badge: 'ئەدمین', color: '#007AFF' },
  { id: 'general_manager', title: 'بەڕێوەبەری گشتی', badge: 'بەڕێوەبەر', color: '#34C759' },
  { id: 'warehouse_manager', title: 'بەڕێوەبەری کۆگا', badge: 'کۆگا', color: '#AF52DE' },
  { id: 'transport_manager', title: 'بەڕێوەبەری نقڵ', badge: 'نقڵ', color: '#FF9500' },
  { id: 'administration', title: 'ئیدارە', badge: 'ئیدارە', color: '#E11D48' },
  { id: 'developer', title: 'دیڤلۆپەر', badge: 'دیڤلۆپەر', color: '#06B6D4' },
  { id: 'it_admin', title: 'ئایتی و تەکنیکی', badge: 'ئایتی', color: '#5856D6' },
  { id: 'salesperson', title: 'فرۆشیار', badge: 'فرۆشیار', color: '#10B981' },
  { id: 'warehouse_staff', title: 'ڕێکخستنی کۆگا', badge: 'ڕێکخستن', color: '#F59E0B' },
  { id: 'supervisor', title: 'سەرپەرشتیاری بەش', badge: 'سەرپەرشتیار', color: '#8B5CF6' },
  { id: 'employee', title: 'کارمەندی ئاسایی', badge: 'کارمەند', color: '#64748B' },
];

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

export interface DestinationRoleDefinition {
  id: UserRole;
  title: string;
  name: string;
  description: string;
  color: string;
}

export const DESTINATION_ROLES: DestinationRoleDefinition[] = [
  {
    id: 'founder',
    title: 'ئەدمین و دامەزرێنەر',
    name: 'دارکۆ حەیدەر حسێن',
    description: 'دەسەڵاتی باڵا، پەسەندکردنی مۆڵەت و سەرپەرشتی تەواوی سیستم لە تەلەگرام',
    color: '#007AFF',
  },
  {
    id: 'general_manager',
    title: 'بەڕێوەبەری گشتی',
    name: 'مامۆستا وەلید',
    description: 'پەسەندکردنی مۆڵەت و ناردنی ئاگاداری فەرمی گشتی بۆ هەمووان',
    color: '#34C759',
  },
  {
    id: 'warehouse_manager',
    title: 'بەڕێوەبەری کۆگا (کاک کامەران)',
    name: 'کامەران عومەر ڕووئوف',
    description: 'وەرگرتن و پەسەندکردنی مۆڵەت، غیاب، و پشووی کۆگا لە تەلەگرام',
    color: '#AF52DE',
  },
  {
    id: 'transport_manager',
    title: 'بەڕێوەبەری نقڵ (کاک هەڤاڵ)',
    name: 'هەڤاڵ حبیب حەمەڕەزا',
    description: 'سەرپەرشتی گواستنەوە، نقڵی کەلوپەل و دەوامی کارمەندانی نقڵ',
    color: '#FF9500',
  },
  {
    id: 'administration',
    title: 'ئیدارە و سەرچاوە مرۆییەکان',
    name: 'بەشی ئیدارە و کارگێڕی',
    description: 'ئاگاداری مۆڵەت، گرێبەست، بەڵگەنامە و بەیاننامەی فەرمی کارمەندان',
    color: '#E11D48',
  },
  {
    id: 'developer',
    title: 'دیڤلۆپەر و پرۆگرامەر',
    name: 'گەشەپێدەری سیستم و بۆت',
    description: 'پشتگیری کۆد، هەڵەکانی سیستم، سێرڤەر و گەشەپێدانی تەلەگرام بۆت',
    color: '#06B6D4',
  },
  {
    id: 'it_admin',
    title: 'بەشی ئایتی',
    name: 'پشتگیری تەکنیکی و سیستم',
    description: 'ئاگاداری مۆبایل و ئامێرەکان، بەستنەوەی تەلەگرام و ڕێگری تەزویر',
    color: '#5856D6',
  },
  {
    id: 'salesperson',
    title: 'بەشی فرۆشتن و پێشانگا',
    name: 'فرۆشیارانی ئاشڵی',
    description: 'ئاگاداری داواکاری موشتەری، کەلوپەلی نوێ و پەیوەندی پێشانگا',
    color: '#10B981',
  },
  {
    id: 'warehouse_staff',
    title: 'ڕێکخستنی کۆگا',
    name: 'کارمەندانی کۆگا و بەشەکان',
    description: 'ئاگاداری ئەرکەکانی ناو کۆگا و هەماهەنگی ڕۆژانە',
    color: '#F59E0B',
  },
  {
    id: 'employee',
    title: 'سەرجەم کارمەندان',
    name: 'هەموو ستافی ئاشڵی',
    description: 'وەرگرتنی ئاگاداری گشتی، ڕاگەیاندنی پشوو و ڕێنماییەکان',
    color: '#64748B',
  },
];

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

export interface WireConnection {
  id: string; // `${fromId}__${toId}`
  fromType: 'employee' | 'task';
  fromId: string;
  toType: 'task' | 'role';
  toId: string;
  createdAt?: string;
}

export interface WorkflowConfiguration {
  employeeRoles: Record<string, UserRole>;
  connections: WireConnection[];
  rules?: NotificationWorkflowRule[];
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
      'broadcast_msg', 
      'mark_absence', 
      'set_holiday', 
      'late_alerts', 
      'device_management', 
      'gps_geofence', 
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
    id: 'transport_manager',
    title: 'بەڕێوەبەری نقڵ',
    name: 'هەڤاڵ حبیب حەمەڕەزا',
    employeeId: 'emp-04',
    color: '#FF9500', // Orange
    allowedActions: [
      'leave_approval', 
      'mark_absence', 
      'late_alerts', 
      'transport_reports'
    ],
    scope: ['warehouse', 'showroom', 'all_branches'],
  },
  {
    id: 'administration',
    title: 'ئیدارە و کارگێڕی',
    name: 'بەشی ئیدارە و سەرچاوە مرۆییەکان',
    employeeId: 'admin-hr',
    color: '#E11D48', // Crimson Red
    allowedActions: [
      'leave_approval', 
      'broadcast_msg', 
      'set_holiday', 
      'mark_absence', 
      'full_reports'
    ],
    scope: ['all_branches'],
  },
  {
    id: 'developer',
    title: 'دیڤلۆپەر و پرۆگرامەر',
    name: 'گەشەپێدەری سیستم و بۆت',
    employeeId: 'dev-team',
    color: '#06B6D4', // Cyan
    allowedActions: [
      'device_management', 
      'system_diagnostics', 
      'broadcast_msg'
    ],
    scope: ['all_branches'],
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
    id: 'salesperson',
    title: 'فرۆشیار و ستافی پێشانگا',
    name: 'فرۆشیارانی ئاشڵی',
    employeeId: '*',
    color: '#10B981', // Emerald
    allowedActions: [
      'self_checkin', 
      'self_report', 
      'request_leave', 
      'view_profile'
    ],
    scope: ['showroom', 'local_branch'],
  },
  {
    id: 'warehouse_staff',
    title: 'ڕێکخستنی کۆگا',
    name: 'ستافی کۆگا و گواستنەوە',
    employeeId: 'emp-03',
    color: '#F59E0B', // Amber
    allowedActions: [
      'team_attendance', 
      'late_alerts'
    ],
    scope: ['warehouse'],
  },
  {
    id: 'employee',
    title: 'کارمەندی ئاسایی',
    name: 'سەرجەم کارمەندانی ئاشڵی',
    employeeId: '*',
    color: '#64748B', // Slate
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
    title: 'داواکردنی مۆڵەت',
    description: 'داواکاری مۆڵەت بە کالێندەر لە تەلەگرام و پەسەندکردن لەلایەن کاک کامەران یان بەڕێوەبەرایەتی',
    iconName: 'Palmtree',
    defaultRoles: ['founder', 'warehouse_manager', 'general_manager'],
    color: '#007AFF',
  },
  {
    id: 'broadcast_msg',
    title: 'ئاگەدارکردنەوەی کارمەندانی تر',
    description: 'ناردنی ئاگاداری، بەیاننامە و ڕاگەیاندنی فەرمی لە تەلەگرام بۆ ستاف',
    iconName: 'Megaphone',
    defaultRoles: ['founder', 'general_manager'],
    color: '#AF52DE',
  },
  {
    id: 'mark_absence',
    title: 'تۆمارکردنی غیاب و لێبڕین',
    description: 'دیاریکردنی غیابی کارمەند لە تەلەگرام و لێبڕینی دەستبەجێ لە خشتەی دەوام',
    iconName: 'UserX',
    defaultRoles: ['founder', 'warehouse_manager'],
    color: '#FF3B30',
  },
  {
    id: 'set_holiday',
    title: 'دیاریکردنی پشووی فەرمی',
    description: 'دیاریکردنی پشووی کۆمپانیا لە تەلەگرام بەبێ هەژمارکردنی غیاب لە خشتە',
    iconName: 'CalendarOff',
    defaultRoles: ['founder', 'warehouse_manager', 'general_manager'],
    color: '#34C759',
  },
  {
    id: 'late_alerts',
    title: 'ئاگاداری دواکەوتنی دەوام',
    description: 'ناردنی ئاگاداری ڕاستەوخۆ کاتێک کارمەند دوای کاتژمێر ٠٨:١٥ دەگاتە دەوام',
    iconName: 'ClockAlert',
    defaultRoles: ['founder', 'warehouse_manager'],
    color: '#FF9500',
  },
  {
    id: 'device_management',
    title: 'بەڕێوەبردنی مۆبایل و ئامێرەکان',
    description: 'کردنەوەی قوفڵی ئامێر، بەستنەوەی تەلەگرام و ڕێگری لە دەستکاریکردنی ئامێر',
    iconName: 'Smartphone',
    defaultRoles: ['founder', 'it_admin'],
    color: '#5856D6',
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

const WORKFLOW_CONFIG_KEY = 'ashley_notification_workflows_config';
const WORKFLOW_REGISTRY_KEY = 'ashley_notification_workflows';

/**
 * Returns default employee-to-role mappings
 */
export function getDefaultEmployeeRoles(): Record<string, UserRole> {
  const roles: Record<string, UserRole> = {};

  ASHLEY_OFFICIAL_EMPLOYEES.forEach((emp) => {
    const cleanId = emp.id.toLowerCase().trim();
    const name = emp.name.toLowerCase().trim();
    const empRole = (emp.role || '').toLowerCase();

    if (cleanId === 'emp-02' || cleanId === '02' || name.includes('دارکۆ')) {
      roles[emp.id] = 'founder';
    } else if (cleanId === 'emp-06' || cleanId === '06' || name.includes('کامەران')) {
      roles[emp.id] = 'warehouse_manager';
    } else if (cleanId === 'emp-04' || cleanId === '04' || name.includes('هەڤاڵ') || empRole.includes('transport') || name.includes('نقڵ')) {
      roles[emp.id] = 'transport_manager';
    } else if (cleanId === 'emp-13' || cleanId === '13' || name.includes('وەلید')) {
      roles[emp.id] = 'general_manager';
    } else if (name.includes('دیڤلۆپەر') || name.includes('developer') || empRole.includes('developer')) {
      roles[emp.id] = 'developer';
    } else if (name.includes('ئیدارە') || name.includes('admin') || empRole.includes('administration') || empRole.includes('hr')) {
      roles[emp.id] = 'administration';
    } else if (name.includes('فرۆشیار') || name.includes('sales') || empRole.includes('sales')) {
      roles[emp.id] = 'salesperson';
    } else if (name.includes('ئایتی') || name.includes('it') || cleanId === 'it-admin') {
      roles[emp.id] = 'it_admin';
    } else if (cleanId === 'emp-03' || name.includes('شادیار')) {
      roles[emp.id] = 'warehouse_staff';
    } else {
      roles[emp.id] = 'employee';
    }
  });

  return roles;
}

/**
 * Returns default manual wiring connections
 */
export function getDefaultConnections(): WireConnection[] {
  const connections: WireConnection[] = [];

  // 1. Employees to Tasks
  // Kak Kamaran (emp-06) connected to Warehouse tasks
  connections.push(
    { id: 'emp-06__leave_approval', fromType: 'employee', fromId: 'emp-06', toType: 'task', toId: 'leave_approval' },
    { id: 'emp-06__mark_absence', fromType: 'employee', fromId: 'emp-06', toType: 'task', toId: 'mark_absence' },
    { id: 'emp-06__set_holiday', fromType: 'employee', fromId: 'emp-06', toType: 'task', toId: 'set_holiday' },
    { id: 'emp-06__late_alerts', fromType: 'employee', fromId: 'emp-06', toType: 'task', toId: 'late_alerts' }
  );

  // Kak Heval (emp-04) Transport Manager connected to Transport & Leave tasks
  connections.push(
    { id: 'emp-04__leave_approval', fromType: 'employee', fromId: 'emp-04', toType: 'task', toId: 'leave_approval' },
    { id: 'emp-04__late_alerts', fromType: 'employee', fromId: 'emp-04', toType: 'task', toId: 'late_alerts' }
  );

  // Kak Darko (emp-02) connected to all tasks
  WORKFLOW_ACTIONS.forEach((act) => {
    connections.push({
      id: `emp-02__${act.id}`,
      fromType: 'employee',
      fromId: 'emp-02',
      toType: 'task',
      toId: act.id,
    });
  });

  // General employees connected to leave request
  const sampleEmps = ['emp-01', 'emp-03', 'emp-05', 'emp-07', 'emp-08'];
  sampleEmps.forEach((eId) => {
    connections.push({
      id: `${eId}__leave_approval`,
      fromType: 'employee',
      fromId: eId,
      toType: 'task',
      toId: 'leave_approval',
    });
  });

  // 2. Tasks to Destination Roles
  connections.push(
    // Leave approval routes to Warehouse Manager (Kak Kamaran), Transport Manager (Kak Heval), Administration & Founder
    { id: 'leave_approval__warehouse_manager', fromType: 'task', fromId: 'leave_approval', toType: 'role', toId: 'warehouse_manager' },
    { id: 'leave_approval__transport_manager', fromType: 'task', fromId: 'leave_approval', toType: 'role', toId: 'transport_manager' },
    { id: 'leave_approval__administration', fromType: 'task', fromId: 'leave_approval', toType: 'role', toId: 'administration' },
    { id: 'leave_approval__founder', fromType: 'task', fromId: 'leave_approval', toType: 'role', toId: 'founder' },
    { id: 'leave_approval__general_manager', fromType: 'task', fromId: 'leave_approval', toType: 'role', toId: 'general_manager' },

    // Broadcast routes to General Manager, Administration, Developer, Salesperson, and Founder
    { id: 'broadcast_msg__founder', fromType: 'task', fromId: 'broadcast_msg', toType: 'role', toId: 'founder' },
    { id: 'broadcast_msg__general_manager', fromType: 'task', fromId: 'broadcast_msg', toType: 'role', toId: 'general_manager' },
    { id: 'broadcast_msg__administration', fromType: 'task', fromId: 'broadcast_msg', toType: 'role', toId: 'administration' },
    { id: 'broadcast_msg__developer', fromType: 'task', fromId: 'broadcast_msg', toType: 'role', toId: 'developer' },
    { id: 'broadcast_msg__salesperson', fromType: 'task', fromId: 'broadcast_msg', toType: 'role', toId: 'salesperson' },
    { id: 'broadcast_msg__employee', fromType: 'task', fromId: 'broadcast_msg', toType: 'role', toId: 'employee' },

    // Absence routes to Warehouse Manager, Administration and Founder
    { id: 'mark_absence__warehouse_manager', fromType: 'task', fromId: 'mark_absence', toType: 'role', toId: 'warehouse_manager' },
    { id: 'mark_absence__transport_manager', fromType: 'task', fromId: 'mark_absence', toType: 'role', toId: 'transport_manager' },
    { id: 'mark_absence__administration', fromType: 'task', fromId: 'mark_absence', toType: 'role', toId: 'administration' },
    { id: 'mark_absence__founder', fromType: 'task', fromId: 'mark_absence', toType: 'role', toId: 'founder' },

    // Holiday routes to Warehouse Manager, General Manager, Administration, and Founder
    { id: 'set_holiday__warehouse_manager', fromType: 'task', fromId: 'set_holiday', toType: 'role', toId: 'warehouse_manager' },
    { id: 'set_holiday__administration', fromType: 'task', fromId: 'set_holiday', toType: 'role', toId: 'administration' },
    { id: 'set_holiday__founder', fromType: 'task', fromId: 'set_holiday', toType: 'role', toId: 'founder' },
    { id: 'set_holiday__general_manager', fromType: 'task', fromId: 'set_holiday', toType: 'role', toId: 'general_manager' },

    // Late alerts route to Warehouse Manager, Transport Manager and Founder
    { id: 'late_alerts__warehouse_manager', fromType: 'task', fromId: 'late_alerts', toType: 'role', toId: 'warehouse_manager' },
    { id: 'late_alerts__transport_manager', fromType: 'task', fromId: 'late_alerts', toType: 'role', toId: 'transport_manager' },
    { id: 'late_alerts__founder', fromType: 'task', fromId: 'late_alerts', toType: 'role', toId: 'founder' },

    // Device management routes to IT Admin, Developer and Founder
    { id: 'device_management__it_admin', fromType: 'task', fromId: 'device_management', toType: 'role', toId: 'it_admin' },
    { id: 'device_management__developer', fromType: 'task', fromId: 'device_management', toType: 'role', toId: 'developer' },
    { id: 'device_management__founder', fromType: 'task', fromId: 'device_management', toType: 'role', toId: 'founder' }
  );

  return connections;
}

/**
 * Fetch the complete workflow configuration (roles + manual wire connections)
 */
export async function fetchWorkflowConfiguration(): Promise<WorkflowConfiguration> {
  const fallback: WorkflowConfiguration = {
    employeeRoles: getDefaultEmployeeRoles(),
    connections: getDefaultConnections(),
  };

  try {
    const config = await fetchSupabaseJson<WorkflowConfiguration | null>(WORKFLOW_CONFIG_KEY, null);
    if (config && config.connections && Array.isArray(config.connections)) {
      return {
        employeeRoles: { ...fallback.employeeRoles, ...(config.employeeRoles || {}) },
        connections: config.connections.length > 0 ? config.connections : fallback.connections,
      };
    }
  } catch (err) {
    logger.warn('[WorkflowService] Error reading workflow configuration from Supabase:', err);
  }

  return fallback;
}

/**
 * Save complete workflow configuration to Supabase
 */
export async function saveWorkflowConfiguration(config: WorkflowConfiguration): Promise<boolean> {
  try {
    const ok = await saveSupabaseJson<WorkflowConfiguration>(
      WORKFLOW_CONFIG_KEY,
      'Ashley Notification & Manual Workflow Wiring Configuration',
      config
    );

    // Also sync to legacy rules format for backward compatibility
    if (ok) {
      const legacyRules: NotificationWorkflowRule[] = [];
      config.connections
        .filter((c) => c.fromType === 'task' && c.toType === 'role')
        .forEach((c) => {
          legacyRules.push({
            roleId: c.toId as UserRole,
            employeeId: '*',
            actionId: c.fromId,
            scopeId: 'all_branches',
            enabled: true,
          });
        });
      await saveSupabaseJson<NotificationWorkflowRule[]>(
        WORKFLOW_REGISTRY_KEY,
        'Ashley Notification Legacy Rules',
        legacyRules
      );
    }

    return ok;
  } catch (err) {
    logger.error('[WorkflowService] Error saving workflow configuration:', err);
    return false;
  }
}

/**
 * Determine employee role considering custom overrides
 */
export function resolveEmployeeRole(
  employeeId: string, 
  employeeName?: string,
  customRoles?: Record<string, UserRole>
): UserRole {
  const cleanId = (employeeId || '').toLowerCase().trim();
  const name = (employeeName || '').toLowerCase().trim();

  // 1. Check custom overrides first
  if (customRoles) {
    if (customRoles[employeeId]) return customRoles[employeeId];
    if (customRoles[cleanId]) return customRoles[cleanId];
    const matchKey = Object.keys(customRoles).find((k) => k.toLowerCase() === cleanId);
    if (matchKey && customRoles[matchKey]) return customRoles[matchKey];
  }

  // 2. Founder (کاک دارکۆ حەیدەر)
  if (cleanId === 'emp-02' || cleanId === '02' || name.includes('دارکۆ')) {
    return 'founder';
  }

  // 3. Warehouse Manager (کاک کامەران عومەر)
  if (cleanId === 'emp-06' || cleanId === '06' || name.includes('کامەران')) {
    return 'warehouse_manager';
  }

  // 4. Transport Manager (کاک هەڤاڵ حبیب)
  if (cleanId === 'emp-04' || cleanId === '04' || name.includes('هەڤاڵ') || name.includes('نقڵ')) {
    return 'transport_manager';
  }

  // 5. General Manager (مامۆستا وەلید)
  if (
    cleanId === 'emp-13' || 
    cleanId === '13' || 
    cleanId.includes('fe2ad0d3') || 
    name.includes('وەلید')
  ) {
    return 'general_manager';
  }

  // 6. Developer (دیڤلۆپەر)
  if (name.includes('دیڤلۆپەر') || name.includes('developer') || cleanId.includes('dev')) {
    return 'developer';
  }

  // 7. Administration (ئیدارە)
  if (name.includes('ئیدارە') || name.includes('کارگێڕی') || name.includes('hr')) {
    return 'administration';
  }

  // 8. Salesperson (فرۆشیار)
  if (name.includes('فرۆشیار') || name.includes('sales')) {
    return 'salesperson';
  }

  // 9. IT Admin
  if (name.includes('ئایتی') || name.includes('it') || cleanId === 'it-admin') {
    return 'it_admin';
  }

  // 10. Warehouse Staff / Supervisor
  if (cleanId === 'emp-03' || name.includes('شادیار')) {
    return 'warehouse_staff';
  }

  return 'employee';
}

/**
 * Fetch the active workflow rules from Supabase (Legacy compat)
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

  const defaultRules: NotificationWorkflowRule[] = [];
  for (const act of WORKFLOW_ACTIONS) {
    defaultRules.push({
      roleId: 'founder',
      employeeId: 'emp-02',
      actionId: act.id,
      scopeId: 'all_branches',
      enabled: true,
    });
  }

  defaultRules.push(
    { roleId: 'warehouse_manager', employeeId: 'emp-06', actionId: 'leave_approval', scopeId: 'warehouse', enabled: true },
    { roleId: 'warehouse_manager', employeeId: 'emp-06', actionId: 'mark_absence', scopeId: 'warehouse', enabled: true },
    { roleId: 'warehouse_manager', employeeId: 'emp-06', actionId: 'set_holiday', scopeId: 'warehouse', enabled: true },
    { roleId: 'warehouse_manager', employeeId: 'emp-06', actionId: 'late_alerts', scopeId: 'warehouse', enabled: true }
  );

  defaultRules.push(
    { roleId: 'general_manager', employeeId: 'emp-13', actionId: 'leave_approval', scopeId: 'all_branches', enabled: true },
    { roleId: 'general_manager', employeeId: 'emp-13', actionId: 'broadcast_msg', scopeId: 'all_branches', enabled: true }
  );

  defaultRules.push(
    { roleId: 'it_admin', employeeId: 'it-admin', actionId: 'device_management', scopeId: 'all_branches', enabled: true }
  );

  return defaultRules;
}

/**
 * Save updated workflow rules to Supabase (Legacy compat)
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
  const config = await fetchWorkflowConfiguration();
  const role = resolveEmployeeRole(employeeId, undefined, config.employeeRoles);

  // Founder always has permission
  if (role === 'founder') return true;

  // Check manual task-to-role connections
  const isRoleConnected = config.connections.some(
    (c) => c.fromType === 'task' && c.fromId === actionId && c.toType === 'role' && c.toId === role
  );
  if (isRoleConnected) return true;

  // Check direct employee-to-task connection
  const isEmployeeConnected = config.connections.some(
    (c) => c.fromType === 'employee' && c.fromId === employeeId && c.toType === 'task' && c.toId === actionId
  );
  if (isEmployeeConnected) return true;

  return false;
}

/**
 * Get all employee IDs or Telegram Chat IDs who should be notified for a specific task action
 */
export async function getActionRecipients(
  actionId: string, 
  bindings: Record<string, { employeeId: string; employeeName: string }>
): Promise<Array<{ chatId: string; employeeId: string; employeeName: string; role: UserRole }>> {
  const config = await fetchWorkflowConfiguration();
  
  // Find all destination roles connected to this task
  const targetRoles = new Set<string>();
  config.connections
    .filter((c) => c.fromType === 'task' && c.fromId === actionId && c.toType === 'role')
    .forEach((c) => targetRoles.add(c.toId));

  // Fallback defaults if no connections configured
  if (targetRoles.size === 0) {
    const actDef = WORKFLOW_ACTIONS.find((a) => a.id === actionId);
    if (actDef) {
      actDef.defaultRoles.forEach((r) => targetRoles.add(r));
    }
  }

  // Founder always included
  targetRoles.add('founder');

  const recipients: Array<{ chatId: string; employeeId: string; employeeName: string; role: UserRole }> = [];

  for (const [chatId, info] of Object.entries(bindings)) {
    const role = resolveEmployeeRole(info.employeeId, info.employeeName, config.employeeRoles);
    
    // Check if employee's role is in target roles or if employee is directly wired
    const matchesRole = targetRoles.has(role);
    const matchesDirect = config.connections.some(
      (c) => c.fromType === 'employee' && c.fromId === info.employeeId && c.toType === 'task' && c.toId === actionId
    );

    if (matchesRole || matchesDirect || role === 'founder') {
      if (!recipients.some((rc) => rc.chatId === chatId)) {
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
