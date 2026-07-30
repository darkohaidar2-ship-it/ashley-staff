
import type { Permission } from './types';

export const allPermissions: Permission[] = [
    // Global Admin
    { id: 'admin:all', description: 'Full access to all system features (Admin only)'},
    
    // Page Access - Top Level
    { id: 'page:account', description: 'Access My Account page' },
    { id: 'page:admin', description: 'Access the Admin Panel' },
    { id: 'page:settings', description: 'Access Settings' },
    
    // Ashley Expenses
    { id: 'page:ashley-expenses:view', description: 'View Ashley Expenses dashboard' },
    { id: 'page:ashley-expenses:expenses', description: 'Access daily expenses section' },
    { id: 'page:ashley-expenses:overtime', description: 'Access overtime section' },
    { id: 'page:ashley-expenses:bonuses', description: 'Access bonuses section' },
    { id: 'page:ashley-expenses:withdrawals', description: 'Access cash withdrawals section' },
    { id: 'page:ashley-expenses:reports', description: 'Access monthly reports section' },
    { id: 'page:ashley-expenses:settings', description: 'Access Ashley Expenses settings' },
    
    // Transmit Cargo
    { id: 'page:transmit:view', description: 'View Transmit Cargo dashboard' },
    { id: 'page:transmit:request', description: 'Create new order requests' },
    { id: 'page:transmit:view-requests', description: 'View, edit, and delete order requests' },
    { id: 'page:transmit:add', description: 'Add/manage items for transfer' },
    { id: 'page:transmit:staged', description: 'View staged items by destination' },
    { id: 'page:transmit:create', description: 'Create new transfer slips' },
    { id: 'page:transmit:archive', description: 'View transfer archive' },

    // Placement & Storage
    { id: 'page:items:view', description: 'View Placement & Storage dashboard' },
    { id: 'page:items:locations', description: 'Manage storage locations' },
    { id: 'page:items:new', description: 'Create new files manually' },
    { id: 'page:items:import', description: 'Import items from Excel' },
    { id: 'page:items:archive', description: 'View Excel file archive' },
    
    // Marketing
    { id: 'page:marketing-feedback:view', description: 'Access Marketing Feedback dashboard' },

    // Employees
    { id: 'page:employees:view', description: 'Access Employees page' },
];

export const adminPermissions = allPermissions.map(p => p.id);

export const adminAssistantPermissions = allPermissions.filter(p => p.id !== 'admin:all').map(p => p.id);

// Viewer can see all pages but cannot edit
export const viewerPermissions = allPermissions.filter(p => p.id.endsWith(':view') || p.id.startsWith('page:account')).map(p => p.id);

// Employee/Member can only see their account and placement/storage
export const employeePermissions = [
    'page:account',
    'page:items:view',
    'page:items:locations',
    'page:items:archive',
];

export const financeManagerPermissions = [
    'page:account',
    'page:ashley-expenses:view',
    'page:ashley-expenses:expenses',
    'page:ashley-expenses:overtime',
    'page:ashley-expenses:bonuses',
    'page:ashley-expenses:withdrawals',
    'page:ashley-expenses:reports',
    'page:ashley-expenses:settings',
];

export const inventoryManagerPermissions = [
    'page:account',
    'page:items:view',
    'page:items:locations',
    'page:items:new',
    'page:items:import',
    'page:items:archive',
    'page:transmit:view',
    'page:transmit:add',
    'page:transmit:staged',
    'page:transmit:create',
    'page:transmit:archive',
];

export const hrManagerPermissions = [
    'page:account',
    'page:employees:view',
    'page:marketing-feedback:view',
];
