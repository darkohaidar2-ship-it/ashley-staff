
'use client';

import * as React from 'react';
import { useEffect, useState, useMemo } from 'react';
import { Building2,
  Save,
  Palette,
  ShieldCheck,
  ImageIcon as ImageIconLucide,
  Languages,
  FileText,
  Loader2,
  X,
  Plus,
  Check,
  Video,
  Type,
  ScrollText,
  Link as LinkIcon,
  Users,
  Users2,
  Activity,
  Trash2,
  Edit,
  Search,
  KeyRound,
  ShieldAlert,
  Database,
  Download,
  RefreshCw,
  Bomb,
  LayoutTemplate,
  Monitor,
  Maximize,
  Scaling,
  MousePointer2,
  CaseSensitive,
  Home,
  Box,
  CreditCard,
  PackagePlus,
  Settings,
  LayoutGrid,
} from 'lucide-react';
import { ThemeSwitcher } from '@/components/layout/ThemeSwitcher';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { 
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useTranslation } from '@/hooks/use-translation';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import type { AppSettings, ThemeColors, User, Role, Employee, ActivityLog, TextTransform } from '@/lib/types';
import withAuth from '@/hooks/withAuth';
import { useAppContext } from '@/context/app-provider';
import { useAuth } from '@/hooks/use-auth';
import { initialSettings, initialData } from '@/context/initial-data';
import { cn } from '@/lib/utils';
import Image from 'next/image';
import { format, parseISO } from 'date-fns';
import { allPermissions } from '@/lib/permissions';
import enStatic from '@/app/locales/en.json';
import kuStatic from '@/app/locales/ku.json';

const themes = [
  { name: 'purple', color: 'bg-purple-600', label: 'Corporate Purple' },
  { name: 'blue', color: 'bg-blue-600', label: 'Tech Blue' },
  { name: 'green', color: 'bg-green-600', label: 'Forest Emerald' },
  { name: 'rose', color: 'bg-rose-600', label: 'Elegant Rose' },
  { name: 'amber', color: 'bg-amber-600', label: 'Golden Amber' },
  { name: 'violet', color: 'bg-violet-600', label: 'Royal Violet' },
  { name: 'orange', color: 'bg-orange-600', label: 'Sunset Orange' },
  { name: 'cyan', color: 'bg-cyan-600', label: 'Arctic Cyan' },
  { name: 'indigo', color: 'bg-indigo-600', label: 'Deep Indigo' },
  { name: 'zinc', color: 'bg-zinc-600', label: 'Industrial Zinc' },
  { name: 'crimson', color: 'bg-red-700', label: 'Crimson Power' },
  { name: 'custom', color: 'bg-gradient-to-br from-gray-400 to-gray-800', label: 'Custom Architect' },
];

/** Utility to convert HSL variable string to Hex for input type color */
function hslToHex(hsl: string): string {
    const parts = hsl.split(' ');
    if (parts.length < 3) return '#000000';
    const h = parseInt(parts[0]);
    const s = parseInt(parts[1].replace('%', ''));
    const l = parseInt(parts[2].replace('%', ''));

    const l_calc = l / 100;
    const a = s * Math.min(l_calc, 1 - l_calc) / 100;
    const f = (n: number) => {
        const k = (n + h / 30) % 12;
        const color = l_calc - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
        return Math.round(255 * color).toString(16).padStart(2, '0');
    };
    return `#${f(0)}${f(8)}${f(4)}`;
}

/** Utility to convert Hex to HSL variable string */
function hexToHsl(hex: string): string {
    let r = parseInt(hex.slice(1, 3), 16) / 255;
    let g = parseInt(hex.slice(3, 5), 16) / 255;
    let b = parseInt(hex.slice(5, 7), 16) / 255;

    let max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s, l = (max + min) / 2;

    if (max === min) {
        h = s = 0;
    } else {
        let d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
    }

    return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

function ColorPicker({ label, value, onChange }: { label: string, value: string, onChange: (val: string) => void }) {
    const hex = useMemo(() => hslToHex(value), [value]);
    
    return (
        <div className="space-y-2">
            <Label className="text-[10px] font-bold uppercase tracking-wider opacity-70">{label}</Label>
            <div className="flex items-center gap-3 bg-muted/20 p-2 rounded-xl border border-white/10 group hover:border-primary/30 transition-all">
                <div className="relative shrink-0 w-10 h-10 overflow-hidden rounded-lg shadow-lg border-2 border-white/20">
                    <input 
                        type="color" 
                        value={hex} 
                        onChange={e => onChange(hexToHsl(e.target.value))}
                        className="absolute inset-0 w-[150%] h-[150%] -translate-x-1/4 -translate-y-1/4 cursor-pointer"
                    />
                </div>
                <div className="flex-1 space-y-0.5">
                    <p className="text-[9px] font-black uppercase tracking-tighter opacity-40">HSL Variable</p>
                    <Input 
                        value={value} 
                        onChange={e => onChange(e.target.value)} 
                        className="h-6 text-[10px] font-mono border-none bg-transparent p-0 focus-visible:ring-0 shadow-none"
                    />
                </div>
                <MousePointer2 className="w-3 h-3 opacity-0 group-hover:opacity-40 transition-opacity" />
            </div>
        </div>
    );
}

function StandardColorPicker({ label, value, onChange }: { label: string, value: string, onChange: (val: string) => void }) {
    return (
        <div className="space-y-2">
            {label && <Label className="text-[10px] font-bold uppercase tracking-wider opacity-60">{label}</Label>}
            <div className="flex items-center gap-3 bg-muted/20 p-2 rounded-xl border border-white/10 group hover:border-primary/30 transition-all">
                <div className="relative shrink-0 w-8 h-8 overflow-hidden rounded-lg shadow-lg border border-white/20">
                    <input 
                        type="color" 
                        value={value.startsWith('#') ? value : '#3b82f6'} 
                        onChange={e => onChange(e.target.value)}
                        className="absolute inset-0 w-[150%] h-[150%] -translate-x-1/4 -translate-y-1/4 cursor-pointer"
                    />
                </div>
                <div className="flex-1">
                    <Input 
                        value={value} 
                        onChange={e => onChange(e.target.value)} 
                        className="h-6 text-[10px] font-mono border-none bg-transparent p-0 focus-visible:ring-0 shadow-none"
                        placeholder="Hex / Gradient"
                    />
                </div>
            </div>
        </div>
    );
}

function ImageControl({ 
    label, 
    description, 
    value, 
    onValueChange, 
    onFileUpload 
}: { 
    label: string, 
    description: string, 
    value: string | null, 
    onValueChange: (val: string) => void,
    onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void 
}) {
    return (
        <Card className="border-none shadow-sm bg-card/68 backdrop-blur-sm">
            <CardHeader className="pb-3">
                <CardTitle className="text-sm">{label}</CardTitle>
                <CardDescription className="text-[10px]">{description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="relative w-full h-32 border-2 border-dashed rounded-xl p-2 flex justify-center bg-muted/30 overflow-hidden">
                    {value ? (
                        <Image src={value} alt={label} fill className="object-contain" unoptimized />
                    ) : (
                        <div className="flex items-center justify-center text-muted-foreground opacity-20">
                            <ImageIconLucide className="w-12 h-12" />
                        </div>
                    )}
                </div>
                <div className="space-y-3">
                    <div className="space-y-1.5">
                        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest opacity-60">
                            <LinkIcon className="w-3 h-3" />
                            URL Import
                        </div>
                        <Input 
                            value={value || ''} 
                            onChange={e => onValueChange(e.target.value)} 
                            placeholder="https://example.com/image.png"
                            className="h-9 text-xs"
                        />
                    </div>
                    <Separator className="opacity-50" />
                    <div className="space-y-1.5">
                        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest opacity-60">
                            <Plus className="w-3 h-3" />
                            File Upload
                        </div>
                        <Input type="file" accept="image/*" onChange={onFileUpload} className="h-9 text-xs cursor-pointer" />
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

const AdminPowerSuite = () => {
    const { t } = useTranslation();
    const { 
        users, setUsers, 
        roles, setRoles, 
        employees, setEmployees,
        activityLogs,
        excelFiles, setExcelFiles,
        items, setItems,
        expenses, setExpenses,
        expenseReports, setExpenseReports,
        transfers, setTransfers,
        transferItems, setTransferItems,
        orderRequests, setOrderRequests,
        settings, setSettings
    } = useAppContext();
    const { user: currentUser } = useAuth();
    const { toast } = useToast();

    // User State
    const [isUserDialogOpen, setIsUserDialogOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [newPassword, setNewPassword] = useState("");
    
    // ڕۆڵەکان State
    const [selectedRole, setSelectedRole] = useState<Role | null>(null);
    const [isNewRoleOpen, setIsNewRoleOpen] = useState(false);
    const [newRoleName, setNewRoleName] = useState("");

    // Multi-Factor Reset State
    const [resetSafetyUnlocked, setResetSafetyUnlocked] = useState(false);
    const [resetConfirmationChecked, setResetConfirmationChecked] = useState(false);
    const [resetVerifyCode, setResetVerifyCode] = useState("");

    useEffect(() => {
        if (roles.length > 0 && !selectedRole) {
            setSelectedRole(roles[0]);
        }
    }, [roles, selectedRole]);

    // چالاکی Log Filtering
    const [searchQuery, setSearchQuery] = useState('');
    const filteredLogs = useMemo(() => {
        return [...activityLogs]
            .filter(log => log.username.toLowerCase().includes(searchQuery.toLowerCase()) || log.description.toLowerCase().includes(searchQuery.toLowerCase()))
            .sort((a,b) => parseISO(b.timestamp).getTime() - parseISO(a.timestamp).getTime());
    }, [activityLogs, searchQuery]);

    const handleCreateAllUsers = () => {
        const existingUsernames = new Set(users.map(u => u.username));
        const employeesWithoutUsers = employees.filter(emp => {
            const newUsername = `${emp.name.split(' ')[0]}${emp.employeeId || ''}`;
            return !existingUsernames.has(newUsername);
        });

        if (employeesWithoutUsers.length === 0) {
            toast({ title: t('no_new_users_to_create') });
            return;
        }

        const newUsers: User[] = employeesWithoutUsers.map(emp => ({
            id: `user-${emp.id}`,
            username: `${emp.name.split(' ')[0]}${emp.employeeId || ''}`,
            password: `${emp.name.split(' ')[0].toLowerCase()}123`,
            roleId: 'role-viewer',
        }));

        setUsers([...users, ...newUsers]);
        toast({ title: t('users_created'), description: t('users_created_desc', { newUsersCount: newUsers.length }) });
    };

    const handleSaveUserChanges = () => {
        if (!editingUser) return;
        const updatedUser = { ...editingUser };
        if (newPassword) updatedUser.password = newPassword;
        setUsers(users.map(u => u.id === updatedUser.id ? updatedUser : u));
        toast({ title: "User Updated", description: `Member ${updatedUser.username} has been synchronized.` });
        setIsUserDialogOpen(false);
        setNewPassword("");
    };

    const handleCreateNewRole = () => {
        if (!newRoleName.trim()) return;
        const newRole: Role = {
            id: `role-${Date.now()}`,
            name: newRoleName.trim(),
            permissions: []
        };
        setRoles([...roles, newRole]);
        toast({ title: "Role Provisioned", description: `Architectural tier "${newRoleName}" has been added.` });
        setNewRoleName("");
        setIsNewRoleOpen(false);
    };

    const handleSaveRole = () => {
        if (!selectedRole) return;
        setRoles(roles.map(r => r.id === selectedRole.id ? selectedRole : r));
        toast({ title: t("role_updated"), description: t('role_updated_desc', {roleName: selectedRole.name})});
    };

    const exportAllData = () => {
        const fullState = {
            employees, excelFiles, items, expenses, expenseReports, transfers, transferItems, orderRequests, users, roles, settings
        };
        const blob = new Blob([JSON.stringify(fullState, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Ashley_Terminal_Backup_${format(new Date(), 'yyyy-MM-dd')}.json`;
        a.click();
        toast({ title: "Nexus Export Complete", description: "All terminal sectors have been backed up to JSON." });
    };

    const handleImportData = (e: React.ChangeEvent<HTMLInputElement>, mode: 'employees' | 'branch') => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const incoming = JSON.parse(event.target?.result as string);
                
                if (mode === 'employees') {
                    if (incoming.employees) {
                        setEmployees(incoming.employees);
                        toast({ title: "Biometric Sync Success", description: "Employee database and image headers have been updated." });
                    } else {
                        throw new Error("No employee cluster found in backup.");
                    }
                } else if (mode === 'branch') {
                    const brandingKeys = [
                        'appLogo', 'mainBackground', 'loginBackground', 'loginBackgroundVideo', 
                        'loginBackgroundEmbed', 'loginCardUpperImage', 'dashboardBanner', 
                        'printHeaderImage', 'printFooterImage', 'customFont'
                    ];
                    
                    if (incoming.employees) setEmployees(incoming.employees);
                    if (incoming.excelFiles) setExcelFiles(incoming.excelFiles);
                    if (incoming.items) setItems(incoming.items);
                    if (incoming.expenses) setExpenses(incoming.expenses);
                    if (incoming.expenseReports) setExpenseReports(incoming.expenseReports);
                    if (incoming.transfers) setTransfers(incoming.transfers);
                    if (incoming.transferItems) setTransferItems(incoming.transferItems);
                    if (incoming.orderRequests) setOrderRequests(incoming.orderRequests);
                    if (incoming.users) setUsers(incoming.users);
                    if (incoming.roles) setRoles(incoming.roles);
                    
                    if (incoming.settings) {
                        const sanitizedSettings = { ...incoming.settings };
                        brandingKeys.forEach(key => {
                            if (settings[key as keyof AppSettings]) {
                                sanitizedSettings[key] = settings[key as keyof AppSettings];
                            }
                        });
                        setSettings(sanitizedSettings);
                    }
                    
                    toast({ title: "Nexus Link Established", description: "Operational data synchronized. Local branding architecture protected." });
                }
            } catch (err) {
                toast({ variant: "destructive", title: "Nexus Breach", description: "Could not parse data cluster. File may be corrupted." });
            }
        };
        reader.readAsText(file);
    };

    const handleTerminalReset = async () => {
        if (!resetSafetyUnlocked || !resetConfirmationChecked || resetVerifyCode !== "RESET") return;
        
        await setEmployees(initialData.employees);
        await setExcelFiles([]);
        await setItems([]);
        await setExpenses([]);
        await setExpenseReports([]);
        await setTransfers([]);
        await setTransferItems([]);
        await setOrderRequests([]);
        await setUsers(initialData.users);
        await setRoles(initialData.roles);
        await setSettings(initialSettings);
        
        toast({ title: "Factory Reset Successful", description: "Terminal has been purged and returned to initial state." });
        window.location.reload();
    };

    return (
        <div className="space-y-8">
            <Tabs defaultValue="users" className="w-full">
                <TabsList className="bg-transparent border-b border-border p-0 mb-6 flex overflow-x-auto h-auto gap-8 justify-start">
                    <TabsTrigger value="users" className="text-[10px] font-bold uppercase tracking-widest px-0 py-4"><Users className="w-3 h-3 mr-2" /> کارمەندان</TabsTrigger>
                    <TabsTrigger value="roles" className="text-[10px] font-bold uppercase tracking-widest px-0 py-4"><ShieldCheck className="w-3 h-3 mr-2" /> ڕۆڵەکان</TabsTrigger>
                    <TabsTrigger value="activity" className="text-[10px] font-bold uppercase tracking-widest px-0 py-4"><Activity className="w-3 h-3 mr-2" /> چالاکی</TabsTrigger>
                    <TabsTrigger value="data" className="text-[10px] font-bold uppercase tracking-widest px-0 py-4"><Database className="w-3 h-3 mr-2" /> ڕێکخستنی داتا</TabsTrigger>
                </TabsList>

                <TabsContent value="users" className="space-y-4">
                    <div className="flex justify-end gap-2">
                        <Button variant="outline" size="sm" onClick={handleCreateAllUsers}>
                            <Users2 className="w-3 h-3 mr-2" /> {t('create_all_users')}
                        </Button>
                    </div>
                    <div className="border rounded-xl overflow-hidden bg-card/30">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="text-[9px] uppercase font-black tracking-widest">{t('username')}</TableHead>
                                    <TableHead className="text-[9px] uppercase font-black tracking-widest">{t('role')}</TableHead>
                                    <TableHead className="text-right text-[9px] uppercase font-black tracking-widest">{t('actions')}</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {users.map(u => (
                                    <TableRow key={u.id}>
                                        <TableCell className="font-bold text-xs">{u.username}</TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className="text-[9px] uppercase font-black tracking-tighter">
                                                {roles.find(r => r.id === u.roleId)?.name || 'Unknown'}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditingUser(u); setIsUserDialogOpen(true); }}>
                                                <Edit className="w-3 h-3" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </TabsContent>

                <TabsContent value="roles" className="space-y-6">
                    <div className="flex flex-wrap items-center gap-4 bg-muted/20 p-4 rounded-xl border">
                        <Label className="text-xs font-bold uppercase tracking-widest">{t('language') === 'ku' ? 'ڕۆڵ هەڵبژێرە:' : 'Select Role:'}</Label>
                        <Select value={selectedRole?.id || ''} onValueChange={(val) => setSelectedRole(roles.find(r => r.id === val) || null)}>
                            <SelectTrigger className="w-64 h-9 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                {roles.map(r => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                        <Button size="sm" onClick={handleSaveRole} disabled={selectedRole?.name === 'ئەدمین'}>
                            <Save className="w-3 h-3 mr-2" /> {t('language') === 'ku' ? 'پاشەکەوتکردنی ڕۆڵ' : 'Save Tier'}
                        </Button>
                        <Separator orientation="vertical" className="h-6 hidden md:block" />
                        <Button variant="outline" size="sm" onClick={() => setIsNewRoleOpen(true)}>
                            <Plus className="w-3 h-3 mr-2" /> {t('language') === 'ku' ? 'ڕۆڵی نوێ' : 'New Role'}
                        </Button>
                    </div>

                    {selectedRole && (
                        <Card className="bg-card/20 border-none shadow-none">
                            <CardHeader>
                                <CardTitle className="text-xs uppercase font-black tracking-widest text-primary">{t('language') === 'ku' ? 'بەرپرسیارێتییەکان: ' : 'Permissions Architect: '}{selectedRole.name}</CardTitle>
                            </CardHeader>
                            <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[400px] overflow-y-auto">
                                {allPermissions.map(p => (
                                    <div key={p.id} className="flex items-center space-x-2 p-2 rounded-lg hover:bg-muted/50 transition-colors">
                                        <Checkbox 
                                            id={`perm-${p.id}`} 
                                            checked={selectedRole.permissions.includes(p.id)}
                                            onCheckedChange={(checked) => {
                                                const newPerms = checked 
                                                    ? [...selectedRole.permissions, p.id]
                                                    : selectedRole.permissions.filter(id => id !== p.id);
                                                setSelectedRole({ ...selectedRole, permissions: newPerms });
                                            }}
                                            disabled={selectedRole.name === 'ئەدمین'}
                                        />
                                        <label htmlFor={`perm-${p.id}`} className="text-[10px] font-bold leading-tight cursor-pointer opacity-80">{p.description}</label>
                                    </div>
                                ))}
                            </CardContent>
                        </Card>
                    )}
                </TabsContent>

                <TabsContent value="activity">
                    <div className="relative mb-4">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                        <Input 
                            placeholder={t('language') === 'ku' ? 'فلتەرکردنی تۆمارەکان...' : 'Filter logs...'} 
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            className="pl-10 h-9 text-xs"
                        />
                    </div>
                    <div className="border rounded-xl overflow-hidden bg-card/30 max-h-[500px] overflow-y-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="text-[9px] uppercase font-black tracking-widest">{t('language') === 'ku' ? 'کات' : 'Timestamp'}</TableHead>
                                    <TableHead className="text-[9px] uppercase font-black tracking-widest">{t('language') === 'ku' ? 'بەکارهێنەر' : 'User'}</TableHead>
                                    <TableHead className="text-[9px] uppercase font-black tracking-widest">{t('language') === 'ku' ? 'کردار' : 'Action'}</TableHead>
                                    <TableHead className="text-[9px] uppercase font-black tracking-widest">{t('language') === 'ku' ? 'وردەکاری' : 'Details'}</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredLogs.map(log => (
                                    <TableRow key={log.id}>
                                        <TableCell className="text-[9px] font-mono opacity-60">{format(parseISO(log.timestamp), 'MMM d, HH:mm')}</TableCell>
                                        <TableCell className="text-[10px] font-bold">{log.username}</TableCell>
                                        <TableCell>
                                            <Badge variant={log.action === 'delete' ? 'destructive' : 'outline'} className="text-[8px] h-4 px-1 uppercase font-black">
                                                {log.action}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-[10px] font-medium opacity-80">{log.description}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </TabsContent>

                <TabsContent value="data" className="space-y-10">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <Card className="bg-card/20 border-none">
                            <CardHeader>
                                <CardTitle className="text-sm">هەناردەکردنی داتای نێکسیوس</CardTitle>
                                <CardDescription className="text-[10px]">Generate a complete encrypted backup of all terminal sectors.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <Button className="w-full font-black uppercase tracking-widest text-[10px]" onClick={exportAllData}>
                                    <Download className="w-3.5 h-3.5 mr-2" /> Initiate Export
                                </Button>
                            </CardContent>
                        </Card>

                        <Card className="bg-card/20 border-none">
                            <CardHeader>
                                <CardTitle className="text-sm">هاوردەکردنی داتای نێکسیوس</CardTitle>
                                <CardDescription className="text-[10px]">Synchronize data clusters from backups or other branches.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-2">
                                    <Label className="text-[9px] uppercase font-black tracking-widest opacity-60">Strategy A: Biometric Sync</Label>
                                    <div className="relative">
                                        <Button variant="outline" className="w-full text-[9px] uppercase font-black tracking-widest h-9" asChild>
                                            <label>
                                                <Users className="w-3 h-3 mr-2" /> Import Employees Only
                                                <input type="file" accept=".json" onChange={e => handleImportData(e, 'employees')} className="hidden" />
                                            </label>
                                        </Button>
                                    </div>
                                    <p className="text-[8px] text-muted-foreground italic">Imports employee list and photos only. Preserves all existing reports.</p>
                                </div>
                                <Separator />
                                <div className="space-y-2">
                                    <Label className="text-[9px] uppercase font-black tracking-widest opacity-60">Strategy B: Neural Branch Link</Label>
                                    <div className="relative">
                                        <Button variant="outline" className="w-full text-[9px] uppercase font-black tracking-widest h-9 border-primary/30" asChild>
                                            <label>
                                                <RefreshCw className="w-3 h-3 mr-2" /> Import Branch Data
                                                <input type="file" accept=".json" onChange={e => handleImportData(e, 'branch')} className="hidden" />
                                            </label>
                                        </Button>
                                    </div>
                                    <p className="text-[8px] text-muted-foreground italic">Imports all operational data. <span className="text-primary">سڕینەوەی هەموو لۆگۆ و وێنەکان</span> to protect this terminal's UI.</p>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    <Separator className="opacity-20" />

                    <Card className="border-destructive/20 shadow-xl bg-destructive/5 overflow-hidden">
                        <CardHeader className="bg-destructive/10 border-b border-destructive/10">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-destructive text-white rounded-lg shadow-lg">
                                    <Bomb className="w-5 h-5" />
                                </div>
                                <div>
                                    <CardTitle className="text-destructive font-black uppercase tracking-widest text-base">پرۆتۆکۆلی سڕینەوەی گشتی</CardTitle>
                                    <CardDescription className="text-destructive/70 text-[10px] font-bold">CRITICAL: This action wipes all database sectors and resets identity anchors.</CardDescription>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="p-6 space-y-6">
                            <div className="flex items-center justify-between p-4 bg-background/40 rounded-xl border border-destructive/20">
                                <div className="space-y-0.5">
                                    <Label className="text-[10px] font-black uppercase tracking-widest">Factor 1: Neural Safety Interlock</Label>
                                    <p className="text-[9px] text-muted-foreground">Unlock the primary reset circuit.</p>
                                </div>
                                <Switch checked={resetSafetyUnlocked} onCheckedChange={setResetSafetyUnlocked} className="data-[state=checked]:bg-destructive" />
                            </div>

                            <div className={cn("space-y-6 transition-all duration-500", resetSafetyUnlocked ? "opacity-100 scale-100" : "opacity-20 scale-[0.98] pointer-events-none grayscale")}>
                                <div className="flex items-start space-x-3 p-4 bg-background/40 rounded-xl border border-destructive/10">
                                    <Checkbox id="confirm-wipe" checked={resetConfirmationChecked} onCheckedChange={(v) => setResetConfirmationChecked(!!v)} />
                                    <div className="grid gap-1.5 leading-none">
                                        <label htmlFor="confirm-wipe" className="text-[10px] font-black uppercase tracking-widest cursor-pointer">Factor 2: Confirmation of Data Loss</label>
                                        <p className="text-[9px] text-muted-foreground italic">I acknowledge that all reports, items, and biometric headers will be permanently deleted.</p>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label className="text-[10px] font-black uppercase tracking-widest ml-1">Factor 3: Verification Sequence</Label>
                                    <div className="relative">
                                        <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground opacity-50" />
                                        <Input 
                                            value={resetVerifyCode} 
                                            onChange={e => setResetVerifyCode(e.target.value)} 
                                            placeholder="Enter 'RESET' to authorize"
                                            className="pl-10 border-destructive/30 focus-visible:ring-destructive bg-background/50 h-10 font-mono text-xs"
                                        />
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                        <CardFooter className="bg-destructive/5 p-6 border-t border-destructive/10">
                            <Button 
                                variant="destructive" 
                                className="w-full font-black uppercase tracking-widest h-12 shadow-2xl transition-all" 
                                disabled={!resetSafetyUnlocked || !resetConfirmationChecked || resetVerifyCode !== "RESET"}
                                onClick={handleTerminalReset}
                            >
                                <ShieldAlert className="w-4 h-4 mr-2" /> Execute Factory Purge
                            </Button>
                        </CardFooter>
                    </Card>
                </TabsContent>
            </Tabs>

            {/* Dialogs */}
            <Dialog open={isUserDialogOpen} onOpenChange={setIsUserDialogOpen}>
                <DialogContent>
                    <DialogHeader><DialogTitle>Edit Member Architecture: {editingUser?.username}</DialogTitle></DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Access Tier (Role)</Label>
                            <Select value={editingUser?.roleId || ''} onValueChange={v => editingUser && setEditingUser({...editingUser, roleId: v})}>
                                <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {roles.map(r => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Overwrite Security Key (Password)</Label>
                            <Input 
                                type="password" 
                                value={newPassword} 
                                onChange={e => setNewPassword(e.target.value)} 
                                placeholder="Leave blank to maintain current"
                                className="h-9 text-xs"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setIsUserDialogOpen(false)}>پاشگەزبوونەوە</Button>
                        <Button onClick={handleSaveUserChanges}>پاشەکەوتکردنی ڕێکخستنەکان</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={isNewRoleOpen} onOpenChange={setIsNewRoleOpen}>
                <DialogContent>
                    <DialogHeader><DialogTitle>دروستکردنی ڕۆڵی نوێ</DialogTitle></DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>ناوی ڕۆڵ</Label>
                            <Input value={newRoleName} onChange={e => setNewRoleName(e.target.value)} placeholder="e.g. Finance Architect" />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setIsNewRoleOpen(false)}>پاشگەزبوونەوە</Button>
                        <Button onClick={handleCreateNewRole}>دروستکردنی ڕۆڵ</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

function SettingsPage() {
  const { toast } = useToast();
  const { t } = useTranslation();
  const { settings, setSettings } = useAppContext();
  const { hasPermission } = useAuth();

  const [draftSettings, setDraftSettings] = useState<AppSettings>(initialSettings);
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  const isAdmin = hasPermission('admin:all');

  useEffect(() => {
    if (settings) {
      setDraftSettings(JSON.parse(JSON.stringify(settings)));
    }
  }, [settings]);

  useEffect(() => {
    if (JSON.stringify(settings) !== JSON.stringify(draftSettings)) {
      setIsDirty(true);
    } else {
      setIsDirty(false);
    }
  }, [settings, draftSettings]);

  // پێشبینی ڕاستەوخۆ: Inject sizing scale into CSS variables immediately
  useEffect(() => {
    if (typeof document !== 'undefined') {
        const root = document.documentElement;
        // Global Scaling
        root.style.setProperty('--global-font-size', `${draftSettings.globalTextSize || 14}px`);
        root.style.setProperty('--branch-font-size', `${draftSettings.branchTextSize || 9}px`);
    }
  }, [
    draftSettings.globalTextSize,
    draftSettings.branchTextSize
  ]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, settingKeyPath: string) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = event => {
      const localUrl = event.target?.result as string;
      if (localUrl) {
        updateSetting(settingKeyPath, localUrl);
      }
    };
    reader.readAsDataURL(file);
  };

  const updateSetting = (path: string, value: any) => {
    setDraftSettings(prev => {
        const newSettings = JSON.parse(JSON.stringify(prev));
        const keys = path.split('.');
        let current: any = newSettings;
        for (let i = 0; i < keys.length - 1; i++) {
            if (!current[keys[i]]) current[keys[i]] = {};
            current = current[keys[i]];
        }
        current[keys[keys.length - 1]] = value;
        return newSettings;
    });
  };

  const handleSave = async () => {
    if (!isAdmin) return;
    setIsSaving(true);
    try {
        await setSettings(draftSettings);
        toast({ title: 'Settings Saved', description: 'Your visual changes have been applied.' });
    } catch (err) {
        toast({ variant: 'destructive', title: 'Save Failed', description: 'An error occurred while saving configuration.' });
    } finally {
        setIsSaving(false);
    }
  };

  const updateCustomColor = (mode: 'light' | 'dark', key: keyof ThemeColors, value: string) => {
      setDraftSettings(prev => ({
          ...prev,
          [mode === 'light' ? 'lightThemeColors' : 'darkThemeColors']: {
              ...prev[mode === 'light' ? 'lightThemeColors' : 'darkThemeColors'],
              [key]: value
          }
      }));
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col pb-24">
      <main className="flex-1 overflow-y-auto p-4 md:p-6 w-full">
        <Tabs defaultValue="language" className="w-full">
          <TabsList className="bg-transparent border-b border-border p-0 flex overflow-x-auto h-auto mb-6 gap-8 justify-start">
            <TabsTrigger value="language" className="px-0 py-4 whitespace-nowrap"><Languages className="mr-2 h-4 w-4" /> {t('language_text')}</TabsTrigger>
            <TabsTrigger value="translations" className="px-0 py-4 whitespace-nowrap"><CaseSensitive className="mr-2 h-4 w-4" /> پێکهاتەی وەرگێڕانەکان</TabsTrigger>
            <TabsTrigger value="media" className="px-0 py-4 whitespace-nowrap"><ImageIconLucide className="mr-2 h-4 w-4" /> ناوەندی میدیا</TabsTrigger>
            <TabsTrigger value="pdf" className="px-0 py-4 whitespace-nowrap"><FileText className="mr-2 h-4 w-4" /> {t('pdf_reports')}</TabsTrigger>
            <TabsTrigger value="themes" className="px-0 py-4 whitespace-nowrap"><Palette className="mr-2 h-4 w-4" /> Themes & Customization</TabsTrigger>
            {isAdmin && <TabsTrigger value="admin" className="px-0 py-4 whitespace-nowrap"><ShieldCheck className="mr-2 h-4 w-4" /> ئەدمین</TabsTrigger>}
          </TabsList>


          <TabsContent value="language" className="space-y-6 animate-in fade-in slide-in-from-top-4 duration-500">
             <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="border-none shadow-sm bg-card/68 backdrop-blur-sm shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-sm font-bold"><ScrollText className="w-4 h-4 text-primary"/> شریتی هەواڵی داشبۆرد</CardTitle>
                        <CardDescription className="text-[10px]">Define the scrolling intelligence that appears on the main terminal hub.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label className="text-[10px] font-bold uppercase tracking-widest opacity-60">دەقی ڕاگەیاندن</Label>
                            <Textarea 
                                value={draftSettings.newsTickerText || ''} 
                                onChange={e => setDraftSettings(prev => ({ ...prev, newsTickerText: e.target.value }))}
                                placeholder="Enter text to scroll on the dashboard..."
                                className="min-h-[100px] text-xs resize-none bg-muted/20 border-none focus-visible:ring-primary/20"
                            />
                        </div>
                        <div className="p-3 bg-muted/10 rounded-xl border border-border/50">
                            <p className="text-[10px] font-black uppercase tracking-widest opacity-60 mb-2">پێشبینی ڕاستەوخۆ</p>
                            <div className="relative h-6 bg-muted/20 rounded-lg overflow-hidden flex items-center">
                                <div className="animate-marquee whitespace-nowrap text-[9px] font-bold text-primary">
                                    {draftSettings.newsTickerText || "Waiting for input..."}
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-none shadow-sm bg-card/68 backdrop-blur-sm shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-sm font-bold"><Type className="w-4 h-4 text-primary"/> فۆنت و شێوازی نووسین</CardTitle>
                        <CardDescription className="text-[10px]">Upload a custom TrueType Font (.ttf) to transform the entire terminal's configuration.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="p-4 border-2 border-dashed rounded-2xl bg-muted/30 text-center space-y-3 transition-colors hover:border-primary/30">
                            <Label className="block text-[10px] font-bold uppercase tracking-widest opacity-60">بارکردنی فایلی فۆنتی TTF</Label>
                            <Input type="file" accept=".ttf" onChange={e => handleFileUpload(e, 'customFont')} className="max-w-xs mx-auto h-9 text-xs cursor-pointer border-none bg-muted/40" />
                            {draftSettings.customFont && (
                                <div className="pt-2">
                                    <Badge variant="secondary" className="bg-green-500/10 text-green-600 border-green-500/20 px-3 py-1 font-black uppercase tracking-widest text-[9px]">
                                        <Check className="w-2.5 h-2.5 mr-1.5"/> Custom Neural Font Active
                                    </Badge>
                                </div>
                            )}
                        </div>
                        <div className="p-4 bg-muted/20 rounded-2xl border border-white/5">
                            <p className="text-[10px] font-bold uppercase opacity-60 mb-2 tracking-widest">پشکنینی فۆنت</p>
                            <p className="text-sm font-bold leading-relaxed" style={{ fontFamily: draftSettings.customFont ? 'CustomAppFont' : 'inherit' }}>
                                THE QUICK BROWN FOX JUMPS OVER THE LAZY DOG. ستافی ئاشلی بۆ کارگێڕی.
                            </p>
                            <p className="text-[11px] opacity-70 mt-1" style={{ fontFamily: draftSettings.customFont ? 'CustomAppFont' : 'inherit' }}>
                                0123456789 ABCDEFGHIJKLMNOPQRSTUVWXYZ
                            </p>
                        </div>
                    </CardContent>
                </Card>
             </div>
          </TabsContent>

          <TabsContent value="media" className="space-y-6 animate-in fade-in slide-in-from-top-4 duration-500">
             <div className="bg-primary/5 p-4 rounded-2xl border border-primary/20 mb-4">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg">
                        <ImageIconLucide className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                        <h3 className="text-sm font-bold">Media & Global Asset Hub</h3>
                        <p className="text-[10px] opacity-70">Manage all visual endpoints and cinematic backgrounds from a single control plane.</p>
                    </div>
                </div>
             </div>

             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <ImageControl 
                    label="System Master Logo" 
                    description="The main identity anchor for Navigation and PDF Branding." 
                    value={draftSettings.appLogo} 
                    onValueChange={v => updateSetting('appLogo', v)}
                    onFileUpload={e => handleFileUpload(e, 'appLogo')}
                />
                <ImageControl 
                    label="Login Portal Background" 
                    description="Primary high-definition image for the authentication terminal." 
                    value={draftSettings.loginBackground} 
                    onValueChange={v => updateSetting('loginBackground', v)}
                    onFileUpload={e => handleFileUpload(e, 'loginBackground')}
                />
                <ImageControl 
                    label="Main Terminal Background" 
                    description="Subtle background architecture for the entire dashboard." 
                    value={draftSettings.mainBackground} 
                    onValueChange={v => updateSetting('mainBackground', v)}
                    onFileUpload={e => handleFileUpload(e, 'mainBackground')}
                />
                <ImageControl 
                    label="Login Card Header" 
                    description="Upper cosmetic image for the login credentials box." 
                    value={draftSettings.loginCardUpperImage} 
                    onValueChange={v => updateSetting('loginCardUpperImage', v)}
                    onFileUpload={e => handleFileUpload(e, 'loginCardUpperImage')}
                />
                <ImageControl 
                    label="Dashboard Master Banner" 
                    description="Wide cinematic banner displayed at the top of the hub." 
                    value={draftSettings.dashboardBanner} 
                    onValueChange={v => updateSetting('dashboardBanner', v)}
                    onFileUpload={e => handleFileUpload(e, 'dashboardBanner')}
                />
                <Card className="border-none shadow-sm bg-card/68 backdrop-blur-sm lg:col-span-2">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-bold flex items-center gap-2"><Video className="w-4 h-4 text-primary"/> ڤیدیۆکانی لاپەڕەی چوونەژوورەوە</CardTitle>
                        <CardDescription className="text-[10px]">YouTube links for the Apple-style mockups on the login screen.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="flex flex-col gap-2">
                                <Label className="text-[10px] font-bold uppercase tracking-widest opacity-60">شاشەی لاپتۆپ</Label>
                                <Input 
                                    value={draftSettings.loginVideoLaptop || ''} 
                                    onChange={e => updateSetting('loginVideoLaptop', e.target.value)}
                                    placeholder="https://www.youtube.com/embed/..."
                                    className="h-9 text-xs"
                                />
                            </div>
                            <div className="flex flex-col gap-2">
                                <Label className="text-[10px] font-bold uppercase tracking-widest opacity-60">شاشەی تابلێت</Label>
                                <Input 
                                    value={draftSettings.loginVideoTablet || ''} 
                                    onChange={e => updateSetting('loginVideoTablet', e.target.value)}
                                    placeholder="https://www.youtube.com/embed/..."
                                    className="h-9 text-xs"
                                />
                            </div>
                            <div className="flex flex-col gap-2">
                                <Label className="text-[10px] font-bold uppercase tracking-widest opacity-60">شاشەی مۆبایل</Label>
                                <Input 
                                    value={draftSettings.loginVideoPhone || ''} 
                                    onChange={e => updateSetting('loginVideoPhone', e.target.value)}
                                    placeholder="https://www.youtube.com/embed/..."
                                    className="h-9 text-xs"
                                />
                            </div>
                        </div>
                        <div className="p-3 bg-muted/30 rounded-xl border border-dashed text-center">
                            <p className="text-[9px] text-muted-foreground italic">Videos automatically loop and mute for a smooth ambient effect.</p>
                        </div>
                    </CardContent>
                </Card>
             </div>

             <Separator className="opacity-10" />
             
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <ImageControl 
                    label="Digital Print Header" 
                    description="Consolidated letterhead imagery for all PDF outputs." 
                    value={draftSettings.printHeaderImage} 
                    onValueChange={v => updateSetting('printHeaderImage', v)}
                    onFileUpload={e => handleFileUpload(e, 'printHeaderImage')}
                />
                <ImageControl 
                    label="Digital Print Footer" 
                    description="Standardized signature/footer image for documents." 
                    value={draftSettings.printFooterImage} 
                    onValueChange={v => updateSetting('printFooterImage', v)}
                    onFileUpload={e => handleFileUpload(e, 'printFooterImage')}
                />
             </div>

             <Card className="border-none bg-muted/20 shadow-none mt-8">
                <CardHeader className="pb-2">
                    <CardTitle className="text-xs font-black uppercase tracking-[0.2em] opacity-60 flex items-center gap-2">
                        <LinkIcon className="w-3 h-3" /> Live Digital Asset Registry
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="border rounded-xl overflow-hidden bg-background/50">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-muted/30">
                                    <TableHead className="text-[9px] uppercase font-black py-2">کۆگای مەبەست</TableHead>
                                    <TableHead className="text-[9px] uppercase font-black py-2">Source Link / Pointer</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {[
                                    { name: 'App Logo', value: draftSettings.appLogo },
                                    { name: 'Main Background', value: draftSettings.mainBackground },
                                    { name: 'Login Background', value: draftSettings.loginBackground },
                                    { name: 'Login Card Image', value: draftSettings.loginCardUpperImage },
                                    { name: 'Dashboard Banner', value: draftSettings.dashboardBanner },
                                    { name: 'Document Header', value: draftSettings.printHeaderImage },
                                    { name: 'Document Footer', value: draftSettings.printFooterImage },
                                ].map((asset) => (
                                    <TableRow key={asset.name} className="hover:bg-primary/5 transition-colors">
                                        <TableCell className="text-[10px] font-bold py-2">{asset.name}</TableCell>
                                        <TableCell className="text-[10px] font-mono py-2 opacity-70 truncate max-w-[300px]">
                                            {asset.value || <span className="opacity-30 italic">No resource assigned</span>}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
             </Card>
          </TabsContent>

          <TabsContent value="pdf" className="space-y-6 animate-in fade-in slide-in-from-top-4 duration-500">
             <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* PDF Specific Density and Theme controls already exist or can be expanded here */}
                <Card className="md:col-span-3 border-none bg-primary/5 p-8 rounded-3xl text-center">
                    <h3 className="text-lg font-bold">ڕێکخستنی سیستەمی بەڵگەنامەکان</h3>
                    <p className="text-xs opacity-70">Media assets for prints are now managed in the "ناوەندی میدیا" tab for centralized control.</p>
                </Card>
             </div>
          </TabsContent>

          <TabsContent value="admin" className="space-y-8 animate-in fade-in slide-in-from-top-4 duration-500">
              <AdminPowerSuite />
          </TabsContent>
          <TabsContent value="translations" className="space-y-8 animate-in fade-in slide-in-from-top-4 duration-500">
              <TranslationArchitect draft={draftSettings} onChange={updateSetting} />
          </TabsContent>
          <TabsContent value="themes" className="space-y-8 animate-in fade-in slide-in-from-top-4 duration-500">
              <DashboardSettingsSuite draft={draftSettings} onChange={updateSetting} />
          </TabsContent>

        </Tabs>
      </main>

      <footer className="fixed bottom-0 left-0 right-0 bg-background/80 backdrop-blur-md border-t p-4 z-50 flex justify-center animate-in slide-in-from-bottom-full duration-500">
          <div className="w-full max-w-4xl flex items-center justify-between gap-4">
              <div className="hidden md:block">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground opacity-60">
                      {isDirty ? "Configuration pending synchronization..." : "Terminal synchronized with Firestore."}
                  </p>
              </div>
              <div className="flex items-center gap-2 w-full md:w-auto">
                  <Button variant="ghost" size="sm" className="flex-1 md:flex-none" onClick={() => setDraftSettings(settings)} disabled={!isDirty || isSaving}>
                      <X className="mr-2 h-3.5 w-3.5" /> Discard
                  </Button>
                  <Button className="flex-1 md:flex-none shadow-xl px-12 h-10 font-bold" onClick={handleSave} disabled={!isDirty || isSaving || !isAdmin}>
                      {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                      {t('save_all_changes')}
                  </Button>
              </div>
          </div>
      </footer>
        </div>
    );
}

function DashboardSettingsSuite({ draft, onChange }: { draft: AppSettings, onChange: (path: string, val: any) => void }) {
    const { t } = useTranslation();
    const config = draft.dashboard;
    const sidebar = draft.sidebar;

    const accentPresets = [
        { label: 'System Default (None)', bg: '', text: '' },
        { label: 'Forest Emerald to Ocean', bg: 'linear-gradient(to right, #22c55e, #3b82f6)', text: '#ffffff' },
        { label: 'Sunset Orange', bg: 'linear-gradient(to right, #f97316, #eab308)', text: '#ffffff' },
        { label: 'Royal Violet', bg: 'linear-gradient(to right, #8b5cf6, #d946ef)', text: '#ffffff' },
        { label: 'Midnight Blue', bg: 'linear-gradient(to right, #1e3a8a, #3b82f6)', text: '#ffffff' },
        { label: 'Ruby Red', bg: 'linear-gradient(to right, #be123c, #f43f5e)', text: '#ffffff' },
        { label: 'Slate Quartz', bg: 'linear-gradient(to right, #475569, #94a3b8)', text: '#ffffff' },
        { label: 'Solid Purple', bg: '#9333ea', text: '#ffffff' },
        { label: 'Solid Sky', bg: '#0ea5e9', text: '#ffffff' },
    ];

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-top-4 duration-500">
            {/* 🎨 DYNAMIC ENTERPRISE THEME & STYLE SWITCHER */}
            <ThemeSwitcher />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="border-none shadow-sm bg-card/68 backdrop-blur-sm">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><Maximize className="w-4 h-4"/> دیزاینی کارتەکان</CardTitle>
                        <CardDescription>Adjust the geometric sharpness and structure of terminal cards.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="space-y-4">
                            <div className="flex justify-between items-center">
                                <Label className="text-[10px] font-black uppercase tracking-widest opacity-60">Corner Radius (Sharpness)</Label>
                                <Badge variant="outline" className="font-mono text-[10px]">{config.cardRadius}px</Badge>
                            </div>
                            <Slider 
                                value={[config.cardRadius]} 
                                min={0} max={40} step={1}
                                onValueChange={([val]) => onChange('dashboard.cardRadius', val)}
                            />
                        </div>
                        <div className="space-y-4 pt-4 border-t border-white/5">
                            <Label className="text-[10px] font-black uppercase tracking-widest opacity-60 flex items-center gap-2">
                                <CaseSensitive className="w-3.5 h-3.5" /> Text Transformation (Paragraph)
                            </Label>
                            <Select value={config.textTransform} onValueChange={(val: TextTransform) => onChange('dashboard.textTransform', val)}>
                                <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">Default (None)</SelectItem>
                                    <SelectItem value="uppercase">پیتی گەورە (ALL UPPERCASE)</SelectItem>
                                    <SelectItem value="capitalize">پیتی یەکەم گەورە</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-none shadow-sm bg-card/68 backdrop-blur-sm">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><Scaling className="w-4 h-4"/> فۆنتی داشبۆردی سەرەکی</CardTitle>
                        <CardDescription>Calibrate the information density of the main terminal hub.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="space-y-4">
                            <div className="flex justify-between items-center">
                                <Label className="text-[10px] font-black uppercase tracking-widest opacity-60">قەبارەی فۆنتی داشبۆردی گشتی</Label>
                                <Badge variant="outline" className="font-mono text-[10px]">{config.fontSize}px</Badge>
                            </div>
                            <Slider 
                                value={[config.fontSize]} 
                                min={1} max={72} step={1}
                                onValueChange={([val]) => onChange('dashboard.fontSize', val)}
                            />
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-none shadow-sm bg-card/68 backdrop-blur-sm">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><Monitor className="w-4 h-4"/> ڕێکخستنی سایدباری فەرمانەکان</CardTitle>
                        <CardDescription>Customize the navigation interface density and styling.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="space-y-4">
                            <div className="flex justify-between items-center">
                                <Label className="text-[10px] font-black uppercase tracking-widest opacity-60">قەبارەی فۆنتی سایدبار</Label>
                                <Badge variant="outline" className="font-mono text-[10px]">{sidebar.fontSize}px</Badge>
                            </div>
                            <Slider 
                                value={[sidebar.fontSize]} 
                                min={8} max={24} step={1}
                                onValueChange={([val]) => onChange('sidebar.fontSize', val)}
                            />
                        </div>
                        <div className="space-y-4 pt-4 border-t border-white/5">
                            <Label className="text-[10px] font-black uppercase tracking-widest opacity-60 flex items-center gap-2">
                                <CaseSensitive className="w-3.5 h-3.5" /> Sidebar Text Case
                            </Label>
                            <Select value={sidebar.textTransform} onValueChange={(val: TextTransform) => onChange('sidebar.textTransform', val)}>
                                <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">Default (None)</SelectItem>
                                    <SelectItem value="uppercase">پیتی گەورە (ALL UPPERCASE)</SelectItem>
                                    <SelectItem value="capitalize">پیتی یەکەم گەورە</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </CardContent>
                  </Card>

                <Card className="border-none shadow-sm bg-card/68 backdrop-blur-sm">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><Scaling className="w-4 h-4"/> پێوەری ڕووکاری سیستەم</CardTitle>
                        <CardDescription>Manually calibrate the global density of the entire terminal.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="space-y-4">
                            <div className="flex justify-between items-center">
                                <Label className="text-[10px] font-black uppercase tracking-widest opacity-60">قەبارەی دەقی گشتی</Label>
                                <Badge variant="outline" className="font-mono text-[10px]">{draft.globalTextSize}px</Badge>
                            </div>
                            <Slider 
                                value={[draft.globalTextSize]} 
                                min={8} max={24} step={1}
                                onValueChange={([val]) => onChange('globalTextSize', val)}
                            />
                            <p className="text-[8px] text-muted-foreground italic">Adjusting this will scale all fonts and component spacing globally.</p>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-none shadow-sm bg-card/68 backdrop-blur-sm">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><Building2 className="w-4 h-4"/> ناسنامەی نیشاندانی لق</CardTitle>
                        <CardDescription>Fine-tune the typography for branch identifiers and labels.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="space-y-4">
                            <div className="flex justify-between items-center">
                                <Label className="text-[10px] font-black uppercase tracking-widest opacity-60">قەبارەی نیشاندەری لق</Label>
                                <Badge variant="outline" className="font-mono text-[10px]">{draft.branchTextSize}px</Badge>
                            </div>
                            <Slider 
                                value={[draft.branchTextSize]} 
                                min={6} max={16} step={0.5}
                                onValueChange={([val]) => onChange('branchTextSize', val)}
                            />
                            <p className="text-[8px] text-muted-foreground italic">Recommended: 9px for a clean, professional Windows 11 appearance.</p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Separator className="opacity-20" />

            <div className="space-y-4">
                <h3 className="text-xs font-black uppercase tracking-[0.3em] opacity-40 text-center">Operational Architecture Audit (پێشبینی ڕاستەوخۆ)</h3>
                <div className="p-8 rounded-3xl border-2 border-dashed bg-muted/10 overflow-hidden relative min-h-[400px] flex items-center justify-center">
                    <div className="absolute inset-0 z-0 opacity-20">
                        {draft.mainBackground && <Image src={draft.mainBackground} alt="Preview BG" fill className="object-cover" unoptimized />}
                    </div>
                    
                    <div className="relative z-10 w-full max-w-2xl grid grid-cols-1 md:grid-cols-2 gap-6 p-4">
                        {/* Sidebar Mockup */}
                        <div className="bg-primary/50 backdrop-blur-xl border border-white/10 rounded-2xl p-4 space-y-4 shadow-2xl">
                            <div className="w-8 h-8 rounded-lg bg-white/20" />
                            <div className="space-y-2">
                                <div className="h-2 w-full bg-white/30 rounded" />
                                <div className="h-2 w-3/4 bg-white/20 rounded" />
                            </div>
                            <div className="pt-4 border-t border-white/5">
                                <p className="text-[10px] font-black uppercase tracking-widest text-primary-foreground/60">کەرتی فەرمانەکان</p>
                                <div 
                                    className="p-3 rounded-xl transition-all shadow-md mt-4" 
                                    style={{ 
                                        background: sidebar.activeTabBackground || 'var(--primary)',
                                    }}
                                >
                                    <p 
                                        className="font-bold transition-all flex items-center gap-2" 
                                        style={{ 
                                            fontSize: `${sidebar.fontSize}px`, 
                                            textTransform: sidebar.textTransform as any,
                                            color: sidebar.activeTabTextColor || '#ffffff'
                                        }}
                                    >
                                        <div className="w-4 h-4 rounded bg-white/20" /> Navigation Active Tab
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Data Card Mockup */}
                        <div 
                            className="bg-card/68 backdrop-blur-md border border-white/10 p-6 flex flex-col justify-between shadow-2xl transition-all"
                            style={{ 
                                borderRadius: `${config.cardRadius}px`,
                                fontSize: `${config.fontSize}px`,
                                textTransform: config.textTransform as any,
                                color: `hsl(${config.textColor})`
                            }}
                        >
                            <div className="space-y-2">
                                <h4 className="font-black uppercase tracking-widest transition-all" style={{ color: `hsl(${config.titleColor})` }}>داتای پێکهاتەی داشبۆرد</h4>
                                <p className="opacity-80">This sample text represents the body content density of your terminal hub at {config.fontSize}px size.</p>
                            </div>
                            
                            <div className="mt-6 flex flex-col gap-2">
                                <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: `hsl(${config.accentColor})` }} />
                                    <span className="text-[10px] font-bold uppercase opacity-60">سەردێڕی بچووک</span>
                                </div>
                                <div className="h-8 w-full rounded flex items-center justify-center font-black uppercase tracking-widest text-[9px] transition-all" style={{ backgroundColor: `hsl(${config.accentColor})` }}>
                                    Confirm Protocol
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

const TranslationArchitect = ({ draft, onChange }: { draft: AppSettings, onChange: (path: string, val: any) => void }) => {
    const { t } = useTranslation();
    const [search, setSearch] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('All');
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [newKey, setNewKey] = useState('');
    const [newEn, setNewEn] = useState('');
    const [newKu, setNewKu] = useState('');

    const categories = [
        { id: 'All', label: 'All Clusters', icon: LayoutGrid },
        { id: 'Global', label: 'Global Buttons', icon: CaseSensitive },
        { id: 'Dashboard', label: 'Dashboard Hub', icon: Home },
        { id: 'Login', label: 'Auth & Login', icon: KeyRound },
        { id: 'Warehouse', label: 'Warehouse & Map', icon: Box },
        { id: 'Employees', label: 'Staff & Biometrics', icon: Users },
        { id: 'Financial', label: 'Salary & Expenses', icon: CreditCard },
        { id: 'Logistics', label: 'Transmit / Cargo', icon: PackagePlus },
        { id: 'System', label: 'Settings & UI', icon: Settings },
    ];

    const en = { ...(enStatic as any), ...(draft.translations?.en || {}) };
    const ku = { ...(kuStatic as any), ...(draft.translations?.ku || {}) };

    const categorizeKey = (key: string) => {
        const k = key.toLowerCase();
        if (k.includes('login_') || k.includes('admin_user') || k === 'welcome_back') return 'Login';
        if (k.includes('dashboard_') || k.includes('main_hub') || k.includes('news_ticker')) return 'Dashboard';
        if (k.includes('item') || k.includes('warehouse') || k.includes('location') || k.includes('floor') || k.includes('area') || k.includes('map') || k.includes('archive')) return 'Warehouse';
        if (k.includes('emp') || k.includes('role') || k.includes('staff')) return 'Employees';
        if (k.includes('bonus') || k.includes('expense') || k.includes('withdrawal') || k.includes('salary') || k.includes('amount')) return 'Financial';
        if (k.includes('transmit') || k.includes('cargo') || k.includes('staged') || k.includes('region') || k.includes('terminal')) return 'Logistics';
        if (k.includes('settings') || k.includes('theme') || k.includes('pdf_') || k.includes('language') || k.includes('media')) return 'System';
        if (k === 'save_changes' || k === 'cancel' || k === 'delete' || k === 'edit' || k === 'update' || k === 'back') return 'Global';
        return 'Other';
    };

    const allKeys = useMemo(() => {
        const keys = new Set([...Object.keys(en), ...Object.keys(ku)]);
        return Array.from(keys).filter(k => {
            const matchesSearch = k.toLowerCase().includes(search.toLowerCase()) || 
                (en[k] || '').toLowerCase().includes(search.toLowerCase()) || 
                (ku[k] || '').toLowerCase().includes(search.toLowerCase());
            
            const matchesCategory = selectedCategory === 'All' || categorizeKey(k) === selectedCategory;
            
            return matchesSearch && matchesCategory;
        }).sort();
    }, [en, ku, search, selectedCategory]);

    const handleUpdate = (key: string, lang: 'en' | 'ku', val: string) => {
        const currentLangSet = draft.translations?.[lang] || {};
        onChange(`translations.${lang}`, { ...currentLangSet, [key]: val });
    };

    const handleAddKey = () => {
        if (!newKey.trim()) return;
        const key = newKey.trim().toLowerCase().replace(/\s+/g, '_');
        onChange('translations.en', { ...en, [key]: newEn });
        onChange('translations.ku', { ...ku, [key]: newKu });
        setNewKey(''); setNewEn(''); setNewKu('');
        setIsAddOpen(false);
    };

    const handleDeleteKey = (key: string) => {
        const newEn = { ...en }; delete newEn[key];
        const newKu = { ...ku }; delete newKu[key];
        onChange('translations.en', newEn);
        onChange('translations.ku', newKu);
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-6 bg-card/40 p-6 rounded-2xl border border-white/10">
                <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-primary/10 rounded-xl">
                            <CaseSensitive className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                            <h3 className="text-sm font-black uppercase tracking-widest">Translation Architect / ئەندازیاری وەرگێڕان</h3>
                            <p className="text-[10px] opacity-60">Organized by system modules and logical pages.</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3 w-full md:w-auto">
                        <div className="relative flex-1 md:w-64">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 opacity-40" />
                            <Input 
                                placeholder="Search all sectors..." 
                                value={search} 
                                onChange={e => setSearch(e.target.value)}
                                className="h-10 pl-10 bg-muted/20 border-none text-xs rounded-xl"
                            />
                        </div>
                        <Button onClick={() => setIsAddOpen(true)} className="h-10 rounded-xl px-4 font-bold uppercase text-[10px] tracking-widest shadow-lg shadow-primary/20">
                            <Plus className="w-4 h-4 mr-2" /> Add Key
                        </Button>
                    </div>
                </div>

                <div className="flex flex-wrap gap-2 pt-2 border-t border-white/5">
                    {categories.map(cat => (
                        <Button 
                            key={cat.id} 
                            variant={selectedCategory === cat.id ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setSelectedCategory(cat.id)}
                            className={cn(
                                "h-8 px-3 rounded-lg text-[10px] font-black uppercase tracking-tighter transition-all",
                                selectedCategory === cat.id ? "shadow-lg shadow-primary/20" : "bg-muted/10 border-none opacity-60 hover:opacity-100 hover:bg-muted/30"
                            )}
                        >
                            <cat.icon className="w-3 h-3 mr-2" />
                            {cat.label}
                        </Button>
                    ))}
                </div>
            </div>

            <div className="border border-white/5 rounded-2xl overflow-hidden bg-card/20 backdrop-blur-md min-h-[400px]">
                <Table>
                    <TableHeader className="bg-muted/30">
                        <TableRow>
                            <TableHead className="text-[10px] uppercase font-black tracking-widest py-4 pl-6">Identifier (Key)</TableHead>
                            <TableHead className="text-[10px] uppercase font-black tracking-widest py-4">English / ئینگلیزی</TableHead>
                            <TableHead className="text-[10px] uppercase font-black tracking-widest py-4">Kurdish / کوردی</TableHead>
                            <TableHead className="w-12"></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {allKeys.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={4} className="h-64 text-center">
                                    <p className="text-[10px] font-black uppercase tracking-widest opacity-20">Sector Empty / زانیاری نەدۆزرایەوە</p>
                                </TableCell>
                            </TableRow>
                        ) : (
                            allKeys.map(key => (
                                <TableRow key={key} className="hover:bg-white/5 transition-colors group">
                                    <TableCell className="py-4 pl-6">
                                        <div className="flex flex-col gap-1">
                                            <code className="text-[9px] font-mono font-bold bg-primary/5 px-2 py-0.5 rounded text-primary border border-primary/10 w-fit">{key}</code>
                                            <span className="text-[8px] opacity-30 font-black uppercase tracking-tighter">{categorizeKey(key)} Section</span>
                                        </div>
                                    </TableCell>
                                    <TableCell className="py-2">
                                        <Input 
                                            value={en[key] || ''} 
                                            onChange={e => handleUpdate(key, 'en', e.target.value)}
                                            className="bg-transparent border-none text-[12px] font-bold focus-visible:ring-1 focus-visible:ring-primary/20 h-9"
                                        />
                                    </TableCell>
                                    <TableCell className="py-2">
                                        <Input 
                                            value={ku[key] || ''} 
                                            onChange={e => handleUpdate(key, 'ku', e.target.value)}
                                            className="bg-transparent border-none text-[12px] font-bold text-right font-kurmanji focus-visible:ring-1 focus-visible:ring-primary/20 h-9"
                                            dir="rtl"
                                        />
                                    </TableCell>
                                    <TableCell className="pr-6">
                                        <Button 
                                            variant="ghost" 
                                            size="icon" 
                                            className="h-8 w-8 text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                                            onClick={() => handleDeleteKey(key)}
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
                <DialogContent className="max-w-md rounded-3xl overflow-hidden border-none shadow-2xl">
                    <DialogHeader className="p-6 bg-primary/5 border-b border-primary/10">
                        <DialogTitle className="flex items-center gap-2"><Plus className="w-5 h-5"/> سەرچاوەی زمانەوانی نوێ</DialogTitle>
                    </DialogHeader>
                    <div className="p-6 space-y-5">
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest opacity-60">System Key (e.g. app_name)</Label>
                            <Input value={newKey} onChange={e => setNewKey(e.target.value)} placeholder="Enter unique ID" className="h-11 rounded-xl" />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest opacity-60">وەرگێڕانی ئینگلیزی</Label>
                            <Input value={newEn} onChange={e => setNewEn(e.target.value)} placeholder="Enter English text" className="h-11 rounded-xl" />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest opacity-60">وەرگێڕانی کوردی</Label>
                            <Input value={newKu} onChange={e => setNewKu(e.target.value)} placeholder="دەقی کوردی لێرە بنووسە" className="h-11 rounded-xl font-kurmanji text-right" dir="rtl" />
                        </div>
                    </div>
                    <DialogFooter className="p-6 pt-0">
                        <DialogClose asChild><Button variant="ghost">پاشگەزبوونەوە</Button></DialogClose>
                        <Button onClick={handleAddKey} disabled={!newKey.trim()} className="px-8 font-black uppercase tracking-widest text-[10px]">دروستکردنی وەرگێڕان</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default withAuth(SettingsPage);
