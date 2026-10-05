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

export interface AuthorityDefinition {
  id: string; // 'founder', 'general_manager', 'warehouse_manager', 'transport_manager', 'administration', 'developer', 'it_admin'
  title: string;
  name: string;
  employeeId?: string;
  description: string;
  badge: string;
  color: string;
}

export const AUTHORITIES_LIST: AuthorityDefinition[] = [
  {
    id: 'founder',
    title: 'ئەدمین و دامەزرێنەر',
    name: 'کاک دارکۆ حەیدەر حسێن',
    employeeId: 'emp-02',
    description: 'دەسەڵاتی باڵا، پەسەندکردنی مۆڵەت و سەرپەرشتی تەواوی سیستم لە تەلەگرام',
    badge: 'ئەدمین',
    color: '#007AFF',
  },
  {
    id: 'general_manager',
    title: 'بەڕێوەبەری گشتی',
    name: 'مامۆستا وەلید',
    employeeId: 'emp-13',
    description: 'پەسەندکردنی مۆڵەت و ناردنی ئاگاداری فەرمی گشتی بۆ هەمووان',
    badge: 'بەڕێوەبەر',
    color: '#34C759',
  },
  {
    id: 'warehouse_manager',
    title: 'بەڕێوەبەری کۆگا',
    name: 'کاک کامەران عومەر ڕووئوف',
    employeeId: 'emp-06',
    description: 'وەرگرتن و پەسەندکردنی مۆڵەت، غیاب، و پشووی کۆگا لە تەلەگرام',
    badge: 'کۆگا',
    color: '#AF52DE',
  },
  {
    id: 'transport_manager',
    title: 'بەڕێوەبەری نقڵ',
    name: 'کاک هەڤاڵ حبیب حەمەڕەزا',
    employeeId: 'emp-04',
    description: 'سەرپەرشتی گواستنەوە، نقڵی کەلوپەل و دەوامی کارمەندانی نقڵ',
    badge: 'نقڵ',
    color: '#FF9500',
  },
  {
    id: 'administration',
    title: 'ئیدارە و سەرچاوە مرۆییەکان',
    name: 'بەشی ئیدارە و کارگێڕی (HR)',
    employeeId: 'admin-hr',
    description: 'ئاگاداری مۆڵەت، گرێبەست، بەڵگەنامە و بەیاننامەی فەرمی کارمەندان',
    badge: 'ئیدارە',
    color: '#E11D48',
  },
  {
    id: 'developer',
    title: 'دیڤلۆپەر و پرۆگرامەر',
    name: 'گەشەپێدەری سیستم و بۆت',
    employeeId: 'dev-team',
    description: 'پشتگیری کۆد، هەڵەکانی سیستم، سێرڤەر و گەشەپێدانی تەلەگرام بۆت',
    badge: 'دیڤلۆپەر',
    color: '#06B6D4',
  },
  {
    id: 'it_admin',
    title: 'بەشی ئایتی و تەکنیکی',
    name: 'پشتگیری تەکنیکی و سیستم',
    employeeId: 'it-admin',
    description: 'ئاگاداری مۆبایل و ئامێرەکان، بەستنەوەی تەلەگرام و ڕێگری تەزویر',
    badge: 'ئایتی',
    color: '#5856D6',
  },
];

export interface RecipientDefinition {
  id: string;
  title: string;
  name: string;
  description: string;
  badge: string;
  color: string;
  type: 'group' | 'employee';
}

export const RECIPIENTS_LIST: RecipientDefinition[] = [
  {
    id: 'all_employees',
    title: 'سەرجەم کارمەندان',
    name: 'هەموو ستافی ئاشڵی (تەلەگرام & نۆتیفیکەیشن)',
    description: 'بۆ ئاگاداری گشتی، ڕاگەیاندنی پشوو و بەیاننامەکان',
    badge: 'گشتی',
    color: '#007AFF',
    type: 'group',
  },
  {
    id: 'warehouse_team',
    title: 'ستافی کۆگا',
    name: 'کارمەندانی کۆگای سەرەکی و کارگە',
    description: 'ئاگاداری پەیوەندیدار بە کۆگا، داواکاری و ئەرکەکان',
    badge: 'کۆگا',
    color: '#AF52DE',
    type: 'group',
  },
  {
    id: 'transport_team',
    title: 'ستافی نقڵ',
    name: 'شۆفێران و تیمی گواستنەوەی کەلوپەل',
    description: 'ئاگاداری گواستنەوە، بارکردن و خشتەی نقڵ',
    badge: 'نقڵ',
    color: '#FF9500',
    type: 'group',
  },
  {
    id: 'showroom_team',
    title: 'ستافی پێشانگا',
    name: 'فرۆشیاران و ستافی پێشانگای سەرەکی',
    description: 'ئاگاداری فرۆشتن، نرخ و بەیاننامەکانی پێشانگا',
    badge: 'فرۆشتن',
    color: '#10B981',
    type: 'group',
  },
  {
    id: 'admin_team',
    title: 'ستافی ئیدارە',
    name: 'بەشی ئیدارە، ژمێریاری و سەرچاوە مرۆییەکان',
    description: 'ئاگاداری مۆڵەت، گرێبەست، غیاب و دەوام',
    badge: 'ئیدارە',
    color: '#E11D48',
    type: 'group',
  },
];

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
  fromType: 'authority' | 'task' | 'employee';
  fromId: string;
  toType: 'task' | 'role' | 'recipient' | 'employee';
  toId: string;
  createdAt?: string;
}

export interface WorkflowConfiguration {
  employeeRoles: Record<string, UserRole>;
  connections: WireConnection[];
  taskAssignments?: Record<string, string[]>; // taskId -> string[] of assigned employee IDs (emp-XX)
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
  // --- ١. دەوامی سەرەکی و دۆخی دەوام ---
  {
    id: 'self_checkin',
    title: 'تۆمارکردنی هاتن و دەرچوون (Check-in / Out)',
    description: 'دوگمەکانی [🟢 تۆمارکردنی هاتن] و [🔴 تۆمارکردنی دەرچوون] بە GPS لە تەلەگرام',
    iconName: 'Clock',
    defaultRoles: ['founder', 'general_manager', 'warehouse_manager', 'transport_manager', 'administration', 'developer', 'it_admin', 'salesperson', 'warehouse_staff', 'supervisor', 'employee'],
    color: '#10B981',
  },
  {
    id: 'today_status',
    title: 'دۆخی دەوامی ئەمڕۆم',
    description: 'دوگمەی [📊 دۆخی دەوامی ئەمڕۆم] بۆ بینینی کاتی تۆمارکراوی هاتن و دەرچوونی ئەمڕۆ',
    iconName: 'Calendar',
    defaultRoles: ['founder', 'general_manager', 'warehouse_manager', 'transport_manager', 'administration', 'developer', 'it_admin', 'salesperson', 'warehouse_staff', 'supervisor', 'employee'],
    color: '#0EA5E9',
  },
  {
    id: 'monthly_report',
    title: 'دۆخی دەوامی ئەم مانگەم (ڕاپۆرت و PDF)',
    description: 'دوگمەی [📅 دۆخی دەوامی ئەم مانگەم] بۆ داگرتنی PDF و ئاماری دەوامی مانگانە',
    iconName: 'FileText',
    defaultRoles: ['founder', 'general_manager', 'warehouse_manager', 'transport_manager', 'administration', 'developer', 'it_admin', 'salesperson', 'warehouse_staff', 'supervisor', 'employee'],
    color: '#6366F1',
  },
  {
    id: 'view_profile',
    title: 'پرۆفایلی من (زانیاری و وێنە)',
    description: 'دوگمەی [👤 پرۆفایلی من] بۆ بینینی وێنەی فەرمی سیستەم و کارتی زانیاری کارمەند',
    iconName: 'User',
    defaultRoles: ['founder', 'general_manager', 'warehouse_manager', 'transport_manager', 'administration', 'developer', 'it_admin', 'salesperson', 'warehouse_staff', 'supervisor', 'employee'],
    color: '#8B5CF6',
  },
  {
    id: 'work_locations',
    title: 'شوێنەکانی دەوام',
    description: 'دوگمەی [ℹ️ شوێنەکانی دەوام] بۆ زانینی لۆکەیشنە پەسەندکراوەکانی کۆمپانیای ئاشڵی',
    iconName: 'MapPin',
    defaultRoles: ['founder', 'general_manager', 'warehouse_manager', 'transport_manager', 'administration', 'developer', 'it_admin', 'salesperson', 'warehouse_staff', 'supervisor', 'employee'],
    color: '#64748B',
  },

  // --- ٢. مۆڵەت و پەیوەندییەکان ---
  {
    id: 'request_leave',
    title: 'داواکردنی مۆڵەت',
    description: 'پێشکەشکردنی داواکاری مۆڵەت لە ڕێگەی کالێندەر لە تەلەگرام یان مۆبایل ئەپ',
    iconName: 'Palmtree',
    defaultRoles: ['founder', 'general_manager', 'warehouse_manager', 'transport_manager', 'administration', 'developer', 'it_admin', 'salesperson', 'warehouse_staff', 'supervisor', 'employee'],
    color: '#007AFF',
  },
  {
    id: 'leave_approval',
    title: 'بینینی لیستی مۆڵەتەکان و پەسەندکردن',
    description: 'بینینی داواکارییەکان، پەسەندکردن یان ڕەتکردنەوە لەلایەن بەرپرسی پەیوەندیدار',
    iconName: 'CheckCircle2',
    defaultRoles: ['founder', 'warehouse_manager', 'general_manager', 'transport_manager'],
    color: '#34C759',
  },
  {
    id: 'broadcast_msg',
    title: 'ناردنی ئاگاداری گشتی',
    description: 'ناردنی ئاگاداری، بەیاننامە و ڕاگەیاندنی فەرمی بە دەق یان وێنە بۆ کارمەندان',
    iconName: 'Megaphone',
    defaultRoles: ['founder', 'general_manager'],
    color: '#AF52DE',
  },

  // --- ٣. بەڕێوەبەرایەتی و ستاف ---
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
    color: '#10B981',
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
  {
    id: 'view_attendance',
    title: 'لیستی ئامادەبووانی ئەمڕۆ',
    description: 'بینینی ناوی ئەو کارمەندانەی ئەمڕۆ لە دەوام ئامادەن لە تەلەگرام',
    iconName: 'Activity',
    defaultRoles: ['founder', 'general_manager', 'warehouse_manager', 'transport_manager', 'administration', 'supervisor'],
    color: '#0284C7',
  },
  {
    id: 'warehouse_attendance',
    title: 'ئامادەبووانی کۆگا',
    description: 'بینینی لیستی دەوام و ئامادەبووانی بەشی کۆگا و کارگە لە تەلەگرام',
    iconName: 'Building2',
    defaultRoles: ['warehouse_manager', 'founder', 'warehouse_staff'],
    color: '#D97706',
  },
  {
    id: 'transport_attendance',
    title: 'ستافی نقڵ و گواستنەوە',
    description: 'بینینی ئامادەبووانی شۆفێران و تیمی گواستنەوە لە تەلەگرام',
    iconName: 'Truck',
    defaultRoles: ['transport_manager', 'founder'],
    color: '#EA580C',
  },
  {
    id: 'system_diagnostics',
    title: 'پشکنینی سیستەم (System Diagnostics)',
    description: 'دوگمەی [🔍 پشکنینی سیستەم] بۆ پیشاندانی دۆخی بەستراوی بنکەدراوە و بۆت',
    iconName: 'Cpu',
    defaultRoles: ['founder', 'developer', 'it_admin'],
    color: '#6366F1',
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
 * Returns default task assignments (task ID -> assigned employee IDs)
 * Authoritative mapping for the 2-Column Notification Board
 */
export function getDefaultTaskAssignments(): Record<string, string[]> {
  const allEmpIds = ASHLEY_OFFICIAL_EMPLOYEES.map((e) => e.id);
  return {
    self_checkin: allEmpIds, // Everyone by default
    today_status: allEmpIds, // Everyone by default
    monthly_report: allEmpIds, // Everyone by default
    view_profile: allEmpIds, // Everyone by default
    work_locations: allEmpIds, // Everyone by default
    request_leave: allEmpIds, // Everyone can submit leave requests by default
    leave_approval: ['emp-06', 'emp-02', 'emp-13', 'emp-04'], // Kamaran, Darko, Walid, Heval
    broadcast_msg: ['emp-02', 'emp-13'], // Darko, Walid
    mark_absence: ['emp-06', 'emp-02', 'emp-04'], // Kamaran, Darko, Heval
    set_holiday: ['emp-02', 'emp-06', 'emp-13'], // Darko, Kamaran, Walid
    device_management: ['emp-02'], // Darko
    view_attendance: ['emp-02', 'emp-06', 'emp-13', 'emp-04', 'emp-03'], // Managers & supervisors
    warehouse_attendance: ['emp-06', 'emp-03', 'emp-02'], // Kamaran, Shadyar, Darko
    transport_attendance: ['emp-04', 'emp-02'], // Heval, Darko
    system_diagnostics: ['emp-02', 'it-admin'], // Darko, IT
    late_alerts: ['emp-02', 'emp-06'], // Darko, Kamaran
  };
}

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

  // 1. Column 1 (Authorities) ➡️ Column 2 (Tasks)
  // Kak Darko (founder) - full authority over all tasks
  WORKFLOW_ACTIONS.forEach((act) => {
    connections.push({
      id: `founder__${act.id}`,
      fromType: 'authority',
      fromId: 'founder',
      toType: 'task',
      toId: act.id,
    });
  });

  // Mamosta Walid (general_manager)
  connections.push(
    { id: 'general_manager__leave_approval', fromType: 'authority', fromId: 'general_manager', toType: 'task', toId: 'leave_approval' },
    { id: 'general_manager__broadcast_msg', fromType: 'authority', fromId: 'general_manager', toType: 'task', toId: 'broadcast_msg' },
    { id: 'general_manager__set_holiday', fromType: 'authority', fromId: 'general_manager', toType: 'task', toId: 'set_holiday' }
  );

  // Kak Kamaran (warehouse_manager)
  connections.push(
    { id: 'warehouse_manager__leave_approval', fromType: 'authority', fromId: 'warehouse_manager', toType: 'task', toId: 'leave_approval' },
    { id: 'warehouse_manager__mark_absence', fromType: 'authority', fromId: 'warehouse_manager', toType: 'task', toId: 'mark_absence' },
    { id: 'warehouse_manager__set_holiday', fromType: 'authority', fromId: 'warehouse_manager', toType: 'task', toId: 'set_holiday' },
    { id: 'warehouse_manager__late_alerts', fromType: 'authority', fromId: 'warehouse_manager', toType: 'task', toId: 'late_alerts' }
  );

  // Kak Heval (transport_manager)
  connections.push(
    { id: 'transport_manager__leave_approval', fromType: 'authority', fromId: 'transport_manager', toType: 'task', toId: 'leave_approval' },
    { id: 'transport_manager__mark_absence', fromType: 'authority', fromId: 'transport_manager', toType: 'task', toId: 'mark_absence' },
    { id: 'transport_manager__late_alerts', fromType: 'authority', fromId: 'transport_manager', toType: 'task', toId: 'late_alerts' }
  );

  // Administration (administration)
  connections.push(
    { id: 'administration__leave_approval', fromType: 'authority', fromId: 'administration', toType: 'task', toId: 'leave_approval' },
    { id: 'administration__broadcast_msg', fromType: 'authority', fromId: 'administration', toType: 'task', toId: 'broadcast_msg' },
    { id: 'administration__mark_absence', fromType: 'authority', fromId: 'administration', toType: 'task', toId: 'mark_absence' },
    { id: 'administration__set_holiday', fromType: 'authority', fromId: 'administration', toType: 'task', toId: 'set_holiday' }
  );

  // Developer & IT
  connections.push(
    { id: 'developer__device_management', fromType: 'authority', fromId: 'developer', toType: 'task', toId: 'device_management' },
    { id: 'developer__broadcast_msg', fromType: 'authority', fromId: 'developer', toType: 'task', toId: 'broadcast_msg' },
    { id: 'it_admin__device_management', fromType: 'authority', fromId: 'it_admin', toType: 'task', toId: 'device_management' }
  );

  // 2. Column 2 (Tasks) ➡️ Column 3 (Recipients)
  connections.push(
    { id: 'leave_approval__admin_team', fromType: 'task', fromId: 'leave_approval', toType: 'recipient', toId: 'admin_team' },
    { id: 'leave_approval__warehouse_team', fromType: 'task', fromId: 'leave_approval', toType: 'recipient', toId: 'warehouse_team' },
    { id: 'leave_approval__transport_team', fromType: 'task', fromId: 'leave_approval', toType: 'recipient', toId: 'transport_team' },

    { id: 'broadcast_msg__all_employees', fromType: 'task', fromId: 'broadcast_msg', toType: 'recipient', toId: 'all_employees' },
    { id: 'set_holiday__all_employees', fromType: 'task', fromId: 'set_holiday', toType: 'recipient', toId: 'all_employees' },

    { id: 'mark_absence__admin_team', fromType: 'task', fromId: 'mark_absence', toType: 'recipient', toId: 'admin_team' },
    { id: 'late_alerts__admin_team', fromType: 'task', fromId: 'late_alerts', toType: 'recipient', toId: 'admin_team' },
    { id: 'late_alerts__warehouse_team', fromType: 'task', fromId: 'late_alerts', toType: 'recipient', toId: 'warehouse_team' },
    { id: 'device_management__admin_team', fromType: 'task', fromId: 'device_management', toType: 'recipient', toId: 'admin_team' }
  );

  return connections;
}

let cachedWorkflowConfig: { config: WorkflowConfiguration; timestamp: number } | null = null;
const CACHE_TTL_MS = 15000; // 15 seconds

/**
 * Fetch the complete workflow configuration (roles + manual wire connections + taskAssignments)
 */
export async function fetchWorkflowConfiguration(forceRefresh: boolean = false): Promise<WorkflowConfiguration> {
  const now = Date.now();
  if (!forceRefresh && cachedWorkflowConfig && (now - cachedWorkflowConfig.timestamp < CACHE_TTL_MS)) {
    return cachedWorkflowConfig.config;
  }

  const fallback: WorkflowConfiguration = {
    employeeRoles: getDefaultEmployeeRoles(),
    connections: getDefaultConnections(),
    taskAssignments: getDefaultTaskAssignments(),
  };

  try {
    const config = await fetchSupabaseJson<WorkflowConfiguration | null>(WORKFLOW_CONFIG_KEY, null);
    if (config) {
      const merged: WorkflowConfiguration = {
        employeeRoles: { ...fallback.employeeRoles, ...(config.employeeRoles || {}) },
        connections: (config.connections && Array.isArray(config.connections) && config.connections.length > 0) ? config.connections : fallback.connections,
        taskAssignments: config.taskAssignments || fallback.taskAssignments,
      };
      cachedWorkflowConfig = { config: merged, timestamp: now };
      return merged;
    }
  } catch (err) {
    logger.warn('[WorkflowService] Error reading workflow configuration from Supabase:', err);
  }

  cachedWorkflowConfig = { config: fallback, timestamp: now };
  return fallback;
}

/**
 * Save complete workflow configuration to Supabase
 */
export async function saveWorkflowConfiguration(config: WorkflowConfiguration): Promise<boolean> {
  try {
    cachedWorkflowConfig = null;

    if (!config.taskAssignments) {
      config.taskAssignments = getDefaultTaskAssignments();
    }

    // Auto-generate wire connections from taskAssignments to keep legacy readers compatible
    const newConnections: WireConnection[] = [];
    Object.entries(config.taskAssignments).forEach(([taskId, empIds]) => {
      if (Array.isArray(empIds)) {
        empIds.forEach((empId) => {
          newConnections.push({
            id: `${empId}__${taskId}`,
            fromType: 'employee',
            fromId: empId,
            toType: 'task',
            toId: taskId,
          });
        });
      }
    });

    if (newConnections.length > 0) {
      config.connections = newConnections;
    }

    const ok = await saveSupabaseJson<WorkflowConfiguration>(
      WORKFLOW_CONFIG_KEY,
      'Ashley Notification & Manual Workflow Wiring Configuration',
      config
    );

    if (ok) {
      cachedWorkflowConfig = { config, timestamp: Date.now() };
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
 * Check if a specific employee has permission for an action / telegram button
 * Authoritative: follows taskAssignments from the 2-Column Board
 * "ئەو کارمەندە لە تەلگرام ئەو ئەرکە ببینێت . گەر بۆی ڕانەکێشرابوو لە تەلگرام نەیبینێت"
 */
export async function hasActionPermission(
  employeeId: string, 
  actionId: string, 
  scopeId?: string
): Promise<boolean> {
  const config = await fetchWorkflowConfiguration();
  const rawNum = employeeId.replace('emp-', '');
  const cleanId = employeeId.startsWith('emp-') ? employeeId : `emp-${employeeId}`;

  // 1. Authoritative check in taskAssignments (2-Column Board)
  const assignments = config.taskAssignments || getDefaultTaskAssignments();
  if (assignments && assignments[actionId]) {
    const list = assignments[actionId];
    return list.some(id => 
      id === employeeId || 
      id === cleanId || 
      id === rawNum || 
      id === `emp-${rawNum}` ||
      id === '*' ||
      id === 'all'
    );
  }

  // 2. Fallback to connections
  const role = resolveEmployeeRole(employeeId, undefined, config.employeeRoles);
  const isConnected = config.connections.some((c) => {
    const matchesAction = c.fromId === actionId || c.toId === actionId;
    const matchesEntity = 
      c.fromId === role || c.toId === role || 
      c.fromId === employeeId || c.toId === employeeId ||
      c.fromId === rawNum || c.toId === rawNum ||
      c.fromId === `emp-${rawNum}` || c.toId === `emp-${rawNum}`;
    return matchesAction && matchesEntity;
  });

  return isConnected;
}

export const isActionAllowedForEmployee = hasActionPermission;

/**
 * Dynamic Telegram Reply Keyboard Generator:
 * Builds the keyboard containing ONLY the buttons the employee is assigned to!
 * "ئەو کارمەندە لە تەلگرام ئەو ئەرکە ببینێت . گەر بۆی ڕانەکێشرابوو لە تەلگرام نەیبینێت"
 */
export async function getDynamicEmployeeTelegramKeyboard(
  employeeId?: string,
  fallbackRole?: UserRole
) {
  const config = await fetchWorkflowConfiguration();
  const assignments = config.taskAssignments || getDefaultTaskAssignments();

  const isAssigned = (taskId: string) => {
    if (!employeeId) return false;
    const list = assignments[taskId];
    if (!Array.isArray(list)) return false;
    const rawNum = employeeId.replace('emp-', '');
    const cleanId = employeeId.startsWith('emp-') ? employeeId : `emp-${employeeId}`;
    return list.some(id => 
      id === employeeId || 
      id === cleanId || 
      id === rawNum || 
      id === `emp-${rawNum}` || 
      id === '*' || 
      id === 'all'
    );
  };

  const keyboard: any[][] = [];

  // 1. Check-in & Check-out row (strictly based on self_checkin assignment)
  if (isAssigned('self_checkin')) {
    keyboard.push([
      { text: '🟢 تۆمارکردنی هاتن' },
      { text: '🔴 تۆمارکردنی دەرچوون' },
    ]);
  }

  // 2. Attendance Status row (Today status & Monthly report)
  const statusRow: any[] = [];
  if (isAssigned('today_status')) {
    statusRow.push({ text: '📊 دۆخی دەوامی ئەمڕۆم' });
  }
  if (isAssigned('monthly_report')) {
    statusRow.push({ text: '📅 دۆخی دەوامی ئەم مانگەم' });
  }
  if (statusRow.length > 0) {
    keyboard.push(statusRow);
  }

  // 3. Profile & Work Locations row
  const profileRow: any[] = [];
  if (isAssigned('view_profile')) {
    profileRow.push({ text: '👤 پرۆفایلی من' });
  }
  if (isAssigned('work_locations')) {
    profileRow.push({ text: 'ℹ️ شوێنەکانی دەوام' });
  }
  if (profileRow.length > 0) {
    keyboard.push(profileRow);
  }

  // 4. Other dynamic action buttons:
  const dynamicButtons: { text: string }[] = [];

  if (isAssigned('request_leave')) {
    dynamicButtons.push({ text: '🏖️ داواکردنی مۆڵەت' });
  }
  if (isAssigned('leave_approval')) {
    dynamicButtons.push({ text: '🏖️ داواکارییەکانی مۆڵەت' });
  }
  if (isAssigned('broadcast_msg')) {
    dynamicButtons.push({ text: '📢 ناردنی ئاگاداری گشتی' });
  }
  if (isAssigned('mark_absence')) {
    dynamicButtons.push({ text: '❌ تۆمارکردنی غیاب' });
  }
  if (isAssigned('set_holiday')) {
    dynamicButtons.push({ text: '🌴 دیاریکردنی پشوو' });
  }
  if (isAssigned('device_management')) {
    dynamicButtons.push({ text: '📱 بەستنەوەی ئامێرەکان' });
  }
  if (isAssigned('view_attendance')) {
    dynamicButtons.push({ text: '📋 لیستی ئامادەبووانی ئەمڕۆ' });
  }
  if (isAssigned('warehouse_attendance')) {
    dynamicButtons.push({ text: '📦 ئامادەبووانی کۆگا' });
  }
  if (isAssigned('transport_attendance')) {
    dynamicButtons.push({ text: '🚚 ستافی نقڵ و گواستنەوە' });
  }
  if (isAssigned('system_diagnostics')) {
    dynamicButtons.push({ text: '🔍 پشکنینی سیستەم' });
  }

  // Pair dynamic buttons 2 per row
  for (let i = 0; i < dynamicButtons.length; i += 2) {
    if (i + 1 < dynamicButtons.length) {
      keyboard.push([dynamicButtons[i], dynamicButtons[i + 1]]);
    } else {
      keyboard.push([dynamicButtons[i]]);
    }
  }

  // Minimal fallback if admin unchecked all buttons for this employee:
  if (keyboard.length === 0) {
    keyboard.push([{ text: '🟢 تۆمارکردنی هاتن' }, { text: '🔴 تۆمارکردنی دەرچوون' }]);
    keyboard.push([{ text: '👤 پرۆفایلی من' }]);
  }

  return {
    keyboard,
    resize_keyboard: true,
    is_persistent: true,
  };
}

/**
 * Get all employee IDs or Telegram Chat IDs who should be notified for a specific task action
 */
export async function getActionRecipients(
  actionId: string, 
  bindings: Record<string, { employeeId: string; employeeName: string }>
): Promise<Array<{ chatId: string; employeeId: string; employeeName: string; role: UserRole }>> {
  const config = await fetchWorkflowConfiguration();
  
  // 🎯 PRIORITY 1: Direct 2-Column Task Assignments (Strictly only assigned employees)
  if (config.taskAssignments && Array.isArray(config.taskAssignments[actionId])) {
    const assignedIds = new Set(config.taskAssignments[actionId]);
    if (assignedIds.size > 0) {
      const explicitRecipients: Array<{ chatId: string; employeeId: string; employeeName: string; role: UserRole }> = [];
      for (const [chatId, info] of Object.entries(bindings)) {
        const cleanEmpId = info.employeeId.startsWith('emp-') ? info.employeeId : `emp-${info.employeeId}`;
        const rawNum = info.employeeId.replace('emp-', '');
        if (
          assignedIds.has(cleanEmpId) || 
          assignedIds.has(info.employeeId) || 
          assignedIds.has(rawNum) ||
          assignedIds.has(`emp-${rawNum}`)
        ) {
          explicitRecipients.push({
            chatId,
            employeeId: info.employeeId,
            employeeName: info.employeeName,
            role: resolveEmployeeRole(info.employeeId, info.employeeName, config.employeeRoles),
          });
        }
      }
      return explicitRecipients;
    }
  }

  // Find all authorities, roles, recipient groups, or employee IDs connected to this task in legacy Column 3
  const targetKeys = new Set<string>();
  config.connections.forEach((c) => {
    if (c.fromId === actionId) targetKeys.add(c.toId);
    if (c.toId === actionId && ((c.toType as string) === 'recipient' || (c.fromType as string) === 'recipient')) targetKeys.add(c.fromId);
  });

  // If no connections in active config, check defaults
  if (targetKeys.size === 0) {
    // For leave_approval, NEVER broadcast to entire warehouse team - only default to managers
    if (actionId === 'leave_approval') {
      const defaultApprovers = ['emp-01', 'emp-06']; // Darko & Kak Kamaran
      const explicitRecipients: Array<{ chatId: string; employeeId: string; employeeName: string; role: UserRole }> = [];
      for (const [chatId, info] of Object.entries(bindings)) {
        const rawNum = info.employeeId.replace('emp-', '');
        if (defaultApprovers.includes(info.employeeId) || defaultApprovers.includes(`emp-${rawNum}`)) {
          explicitRecipients.push({
            chatId,
            employeeId: info.employeeId,
            employeeName: info.employeeName,
            role: resolveEmployeeRole(info.employeeId, info.employeeName, config.employeeRoles),
          });
        }
      }
      return explicitRecipients;
    }

    const defaults = getDefaultConnections();
    defaults.forEach((c) => {
      if (c.fromId === actionId) targetKeys.add(c.toId);
    });
  }

  // 🔕 If STILL empty, this action has NO recipients wired ("هەندێ ئەرکیش هەیە پێویست ناکا ئاگەداری بچی بۆ کارمەدنەکانی تر")
  if (targetKeys.size === 0) {
    return [];
  }

  const recipients: Array<{ chatId: string; employeeId: string; employeeName: string; role: UserRole }> = [];

  for (const [chatId, info] of Object.entries(bindings)) {
    const role = resolveEmployeeRole(info.employeeId, info.employeeName, config.employeeRoles);
    const rawNum = info.employeeId.replace('emp-', '');
    
    const matchesDirect = 
      targetKeys.has(role) || 
      targetKeys.has(info.employeeId) || 
      targetKeys.has(rawNum) || 
      targetKeys.has(`emp-${rawNum}`);

    const matchesAllStaff = targetKeys.has('all_employees') || targetKeys.has('employee');
    const matchesWarehouse = (targetKeys.has('warehouse_team') || targetKeys.has('warehouse_staff') || targetKeys.has('warehouse_manager')) && 
      (role === 'warehouse_manager' || role === 'warehouse_staff' || info.employeeId === 'emp-06' || info.employeeId === 'emp-03');
    const matchesTransport = (targetKeys.has('transport_team') || targetKeys.has('transport_manager')) && 
      (role === 'transport_manager' || info.employeeId === 'emp-04');
    const matchesShowroom = (targetKeys.has('showroom_team') || targetKeys.has('salesperson')) && 
      (role === 'salesperson');
    const matchesAdmin = (targetKeys.has('admin_team') || targetKeys.has('administration')) && 
      (role === 'administration' || role === 'general_manager' || role === 'founder' || info.employeeId === 'emp-02');

    if (
      matchesDirect || 
      matchesAllStaff || 
      matchesWarehouse || 
      matchesTransport || 
      matchesShowroom || 
      matchesAdmin
    ) {
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

