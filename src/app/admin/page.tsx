
"use client";

import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, ShieldCheck, Users, KeyRound, Save, Plus, Trash2, Edit, X, Users2, Search, Calendar as CalendarIcon } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose, DialogDescription } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { useAppContext } from '@/context/app-provider';
import type { User, Role, Employee, ActivityLog } from '@/lib/types';
import { allPermissions } from '@/lib/permissions';
import { useAuth } from '@/hooks/use-auth';
import withAuth from '@/hooks/withAuth';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTranslation } from '@/hooks/use-translation';
import { format, parseISO, startOfDay, endOfDay, isWithinInterval } from 'date-fns';
import { DateRange } from "react-day-picker";
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';


export const useAdminAuth = () => {
  const { user, loading, hasPermission } = useAuth();
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (!loading) {
      const adminCheck = hasPermission('admin:all');
      setIsAdmin(adminCheck);
      if (!adminCheck) {
        router.replace('/');
      }
    }
  }, [user, loading, hasPermission, router]);

  return { user, loading, isAdmin };
};

function UserManagement() {
  const { users, setUsers, roles, employees, setActivityLogs } = useAppContext();
  const { user: currentUser } = useAuth();
  const { t } = useTranslation();
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  const handleSaveUser = (userToSave: User, isNew: boolean) => {
    if(isNew) {
        setUsers([...users, userToSave]);
        toast({ title: "بەکارهێنەر دروستکرا", description: `هەژماری بەکارهێنەر بۆ ${userToSave.username} دروستکرا.` });
        if (currentUser) {
            const log: ActivityLog = { id: crypto.randomUUID(), userId: currentUser.id, username: currentUser.username, action: 'create', entity: 'User Account', entityId: userToSave.id, description: `Created user account: ${userToSave.username}`, timestamp: new Date().toISOString() };
            setActivityLogs(prev => [...prev, log]);
        }
    } else {
        setUsers(users.map(u => u.id === userToSave.id ? userToSave : u));
        toast({ title: "بەکارهێنەر نوێکرایەوە", description: `وردەکارییەکانی ${userToSave.username} نوێکرانەوە.` });
        if (currentUser) {
            const log: ActivityLog = { id: crypto.randomUUID(), userId: currentUser.id, username: currentUser.username, action: 'update', entity: 'User Account', entityId: userToSave.id, description: `Updated user account: ${userToSave.username}`, timestamp: new Date().toISOString() };
            setActivityLogs(prev => [...prev, log]);
        }
    }
    setEditingUser(null);
    setIsDialogOpen(false);
  };

  const handleDeleteUser = (userId: string) => {
    const userToDelete = users.find(u => u.id === userId);
    setUsers(users.filter(u => u.id !== userId));
    toast({ title: "بەکارهێنەر سڕایەوە", description: "بەکارهێنەرەکە بە سەرکەوتوویی لادرا." });
    if (currentUser && userToDelete) {
        const log: ActivityLog = { id: crypto.randomUUID(), userId: currentUser.id, username: currentUser.username, action: 'delete', entity: 'User Account', entityId: userToDelete.id, description: `Deleted user account: ${userToDelete.username}`, timestamp: new Date().toISOString() };
        setActivityLogs(prev => [...prev, log]);
    }
  };
  
  const handleDeleteAllUsers = () => {
    const adminUser = users.find(u => u.username === 'Darko097');
    const usersToKeep = adminUser ? [adminUser] : [];
    const deletedCount = users.length - usersToKeep.length;

    setUsers(usersToKeep);
    
    if (deletedCount > 0) {
        toast({ title: "هەموو بەکارهێنەران سڕانەوە", description: `${deletedCount} هەژماری بەکارهێنەر لادران. هەژماری ئەدمین پارێزرا.` });
        if (currentUser) {
            const log: ActivityLog = { id: crypto.randomUUID(), userId: currentUser.id, username: currentUser.username, action: 'delete', entity: 'System', description: `Deleted ${deletedCount} user accounts.`, timestamp: new Date().toISOString() };
            setActivityLogs(prev => [...prev, log]);
        }
    } else {
        toast({ title: "هیچ بەکارهێنەرێک نەسرایەوە", description: "تەنها هەژماری ئەدمین بوونی هەیە." });
    }
  };

  const getRoleName = (roleId: string) => {
    const roleName = roles.find(r => r.id === roleId)?.name || 'Unknown Role';
    const roleKeys: Record<string, string> = {
      'Admin': 'ئەدمین',
      'Admin Assistant': 'یاریدەدەری ئەدمین',
      'Finance Manager': 'بەڕێوەبەری دارایی',
      'Inventory Manager': 'بەڕێوەبەری کۆگا',
      'HR Manager': 'بەڕێوەبەری سەرچاوە مرۆییەکان',
      'Viewer': 'بینەر',
      'Employee': 'کارمەند',
      'Unknown Role': 'ڕۆڵی نەناسراو'
    };
    return roleKeys[roleName] || roleName;
  };

  const handleCreateAllUsers = () => {
    const existingUsernames = new Set(users.map(u => u.username));
    const employeesWithoutUsers = employees.filter(emp => {
        const newUsername = `${emp.name.split(' ')[0]}${emp.employeeId || ''}`;
        return !existingUsernames.has(newUsername) && emp.employeeId !== '01'; // Exclude Darko
    });

    if (employeesWithoutUsers.length === 0) {
      toast({ title: "هیچ بەکارهێنەرێکی نوێ نییە", description: "هەموو کارمەندان لە ئێستادا خاوەنی هەژماری بەکارهێنەرن." });
      return;
    }

    const newUsers: User[] = employeesWithoutUsers.map(emp => {
      const defaultPassword = `${emp.name.split(' ')[0].toLowerCase()}123`;
      const newUsername = `${emp.name.split(' ')[0]}${emp.employeeId || ''}`;
      return {
        id: `user-${emp.id}`,
        username: newUsername,
        password: defaultPassword,
        roleId: 'role-viewer', // Default to Viewer role
      };
    });

    setUsers([...users, ...newUsers]);
    toast({ title: "بەکارهێنەران دروستکران", description: `${newUsers.length} هەژماری بەکارهێنەری نوێ دروستکران.` });
    if (currentUser) {
        const log: ActivityLog = { id: crypto.randomUUID(), userId: currentUser.id, username: currentUser.username, action: 'create', entity: 'System', description: `Bulk created ${newUsers.length} user accounts for employees.`, timestamp: new Date().toISOString() };
        setActivityLogs(prev => [...prev, log]);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('user_management')}</CardTitle>
        
      </CardHeader>
      <CardContent>
        <div className="mb-4 flex justify-end gap-2">
           <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline">
                  <Users2 className="mr-2 h-4 w-4" /> {t('create_all_users')}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{t('are_you_sure_create_all_users')}</AlertDialogTitle>
                  <AlertDialogDescription>
                    ""
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
                  <AlertDialogAction onClick={handleCreateAllUsers}>{t('create_users')}</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          <Button onClick={() => { setEditingUser(null); setIsDialogOpen(true); }}>
            <Plus className="mr-2 h-4 w-4" /> {t('add_user')}
          </Button>
           <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" disabled={users.length <= 1}>
                  <Trash2 className="mr-2 h-4 w-4" /> {t('remove_all')}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{t('are_you_sure_remove_all_users')}</AlertDialogTitle>
                  <AlertDialogDescription>
                    ""
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDeleteAllUsers}>{t('delete_all_users')}</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
        </div>
        <div className="overflow-x-auto">
            <Table>
            <TableHeader>
                <TableRow>
                <TableHead>{t('username')}</TableHead>
                <TableHead>{t('role')}</TableHead>
                <TableHead className="text-right">{t('actions')}</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {users.map(user => (
                <TableRow key={user.id}>
                    <TableCell>{user.username}</TableCell>
                    <TableCell>{getRoleName(user.roleId)}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => { setEditingUser(user); setIsDialogOpen(true); }}>
                          <Edit className="h-4 w-4" />
                      </Button>
                      <AlertDialog onOpenChange={(open) => !open && setDeleteConfirmText('')}>
                          <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" disabled={user.username === 'Darko097'} onClick={() => setUserToDelete(user)}>
                                  <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                              <AlertDialogHeader>
                                  <AlertDialogTitle>{t('are_you_sure')}</AlertDialogTitle>
                                   <AlertDialogDescription>
                                       ئەم کرداره ناتوانرێت هەڵبوەشێنرێتەوە. ئەمە بە هەمیشەیی هەژماری بەکارهێنەر بۆ <strong>{userToDelete?.username}</strong> دەسڕێتەوە.
                                       بۆ پشتڕاستکردنەوە، تکایە بنووسە <strong>DELETE {userToDelete?.username}</strong> لە خوارەوە.
                                   </AlertDialogDescription>
                              </AlertDialogHeader>
                              <Input
                                  value={deleteConfirmText}
                                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                                  placeholder={`DELETE ${userToDelete?.username}`}
                                  autoFocus
                              />
                              <AlertDialogFooter>
                                  <AlertDialogCancel onClick={() => setUserToDelete(null)}>{t('cancel')}</AlertDialogCancel>
                                  <AlertDialogAction
                                      disabled={deleteConfirmText !== `DELETE ${userToDelete?.username}`}
                                      onClick={() => {
                                          if (userToDelete) handleDeleteUser(userToDelete.id);
                                          setUserToDelete(null);
                                      }}
                                  >
                                      {t('delete_user')}
                                  </AlertDialogAction>
                              </AlertDialogFooter>
                          </AlertDialogContent>
                      </AlertDialog>
                    </TableCell>
                </TableRow>
                ))}
            </TableBody>
            </Table>
        </div>
      </CardContent>
      <UserDialog 
        open={isDialogOpen} 
        onOpenChange={setIsDialogOpen} 
        user={editingUser} 
        onSave={handleSaveUser} 
        roles={roles}
        employees={employees}
        existingUsers={users}
      />
    </Card>
  );
}

function UserDialog({ open, onOpenChange, user, onSave, roles, employees, existingUsers }: { open: boolean, onOpenChange: (open: boolean) => void, user: User | null, onSave: (user: User, isNew: boolean) => void, roles: Role[], employees: Employee[], existingUsers: User[] }) {
    const { t } = useTranslation();
    const { toast } = useToast();
    const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
    const [password, setPassword] = useState('');
    const [roleId, setRoleId] = useState('');
    const isNewUser = !user;

    const availableEmployees = useMemo(() => {
        const existingUsernames = new Set(existingUsers.map(u => {
             const empForUser = employees.find(e => `user-${e.id}` === u.id || e.name === u.username || `${e.name.split(' ')[0]}${e.employeeId || ''}` === u.username || e.employeeId === '01');
             if(empForUser) {
                 return `${empForUser.name.split(' ')[0]}${empForUser.employeeId || ''}`;
             }
             return u.username;
        }));
        
        return employees.filter(emp => {
            const potentialUsername = `${emp.name.split(' ')[0]}${emp.employeeId || ''}`;
            return !existingUsernames.has(potentialUsername);
        });
    }, [employees, existingUsers]);
  
    useEffect(() => {
      if (user) {
        setSelectedEmployeeId(''); // Not applicable for editing
        setPassword(''); // Always clear password for security
        setRoleId(user.roleId);
      } else {
        // Reset for new user
        setSelectedEmployeeId('');
        setPassword('');
        setRoleId('role-viewer'); // Default to Viewer
      }
    }, [user, open]);
  
    const handleSubmit = () => {
      if(isNewUser) {
        if (!selectedEmployeeId) {
            toast({ variant: 'destructive', title: t('please_select_employee')});
            return;
        }
        const selectedEmp = employees.find(e => e.id === selectedEmployeeId);
        if (!selectedEmp) {
            toast({ variant: 'destructive', title: t('selected_employee_not_found')});
            return;
        }
        
        const defaultPassword = `${selectedEmp.name.split(' ')[0].toLowerCase()}123`;
        const newUsername = `${selectedEmp.name.split(' ')[0]}${selectedEmp.employeeId || ''}`;

        const newUser: User = {
            id: `user-${selectedEmp.id}`,
            username: newUsername,
            password: password || defaultPassword,
            roleId
        }
        onSave(newUser, true);
      } else { // Editing existing user
        const updatedUser: User = {
            ...user!,
            roleId,
        };
        if (password) {
            updatedUser.password = password;
        }
        onSave(updatedUser, false);
      }
    };
  
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{user ? t('edit_user') : t('add_user')}</DialogTitle>
            <DialogDescription>
              {user ? `${t('user_updated_desc', { username: user.username})}` : t('create_new_user_desc')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
                <Label htmlFor="username">{t('username')}</Label>
                {isNewUser ? (
                    <Select value={selectedEmployeeId} onValueChange={setSelectedEmployeeId}>
                        <SelectTrigger id="username">
                            <SelectValue placeholder={t('select_an_employee')} />
                        </SelectTrigger>
                        <SelectContent>
                            {availableEmployees.map(emp => (
                                <SelectItem key={emp.id} value={emp.id}>{emp.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                ) : (
                    <Input id="username" value={user.username} disabled />
                )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">{t('password')}</Label>
              <Input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder={isNewUser ? t('password_default_new') : t('password_default_edit')} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="role">{t('role')}</Label>
              <Select value={roleId} onValueChange={setRoleId}>
                <SelectTrigger id="role">
                  <SelectValue placeholder={t('select_a_role')} />
                </SelectTrigger>
                <SelectContent>
                  {roles.map(role => {
                    const roleKeys: Record<string, string> = {
                      'Admin': 'ئەدمین',
                      'Admin Assistant': 'یاریدەدەری ئەدمین',
                      'Finance Manager': 'بەڕێوەبەری دارایی',
                      'Inventory Manager': 'بەڕێوەبەری کۆگا',
                      'HR Manager': 'بەڕێوەبەری سەرچاوە مرۆییەکان',
                      'Viewer': 'بینەر',
                      'Employee': 'کارمەند'
                    };
                    return (
                      <SelectItem key={role.id} value={role.id} disabled={user?.username === 'Darko097' && role.name !== 'Admin'}>
                        {roleKeys[role.name] || role.name}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">{t('cancel')}</Button></DialogClose>
            <Button onClick={handleSubmit}>{t('save')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
}

function RoleManagement() {
    const { roles, setRoles, setActivityLogs } = useAppContext();
    const { user: currentUser } = useAuth();
    const { t } = useTranslation();
    const [selectedRole, setSelectedRole] = useState<Role | null>(null);
    const { toast } = useToast();
  
    useEffect(() => {
      if (roles.length > 0 && !selectedRole) {
        setSelectedRole(roles[0]);
      }
    }, [roles, selectedRole]);

    const handlePermissionChange = (permission: string, checked: boolean) => {
        if (!selectedRole) return;
        
        setSelectedRole(prev => {
            if (!prev) return null;
            const newPermissions = checked
                ? [...prev.permissions, permission]
                : prev.permissions.filter(p => p !== permission);
            return { ...prev, permissions: newPermissions };
        });
    };

    const handleSaveRole = () => {
        if (!selectedRole) return;
        setRoles(roles.map(r => r.id === selectedRole.id ? selectedRole : r));
        toast({ title: t("role_updated"), description: t('role_updated_desc', {roleName: selectedRole.name})});
        if (currentUser) {
            const log: ActivityLog = { id: crypto.randomUUID(), userId: currentUser.id, username: currentUser.username, action: 'update', entity: 'Role', entityId: selectedRole.id, description: `Updated permissions for role: ${selectedRole.name}`, timestamp: new Date().toISOString() };
            setActivityLogs(prev => [...prev, log]);
        }
    };
  
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('role_management')}</CardTitle>
          
        </CardHeader>
        <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
                <Label htmlFor="role-select">{t('select_role')}</Label>
                <Select value={selectedRole?.id || ''} onValueChange={(roleId) => setSelectedRole(roles.find(r => r.id === roleId) || null)}>
                    <SelectTrigger id="role-select" className="w-[250px]">
                        <SelectValue placeholder={t('select_a_role')} />
                    </SelectTrigger>
                    <SelectContent>
                        {roles.map(role => (
                            <SelectItem key={role.id} value={role.id}>{role.name}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {selectedRole && (
                <div className="border p-4 rounded-lg">
                    <h3 className="mb-4">{t('permissions_for_role', {roleName: selectedRole.name})}</h3>
                    <div className="max-h-[40vh] overflow-y-auto space-y-2">
                        {allPermissions.map(permission => (
                            <div key={permission.id} className="flex items-center space-x-2">
                                <Checkbox
                                    id={`perm-${permission.id}`}
                                    checked={selectedRole.permissions.includes(permission.id)}
                                    onCheckedChange={(checked) => handlePermissionChange(permission.id, !!checked)}
                                    disabled={selectedRole.name === 'Admin'}
                                />
                                <label htmlFor={`perm-${permission.id}`} className="text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                    {permission.description}
                                </label>
                            </div>
                        ))}
                    </div>
                    <div className="mt-4 text-right">
                        <Button onClick={handleSaveRole} disabled={selectedRole.name === 'Admin'}>
                            <Save className="mr-2 h-4 w-4" /> {t('save_permissions_for_role', {roleName: selectedRole.name})}
                        </Button>
                    </div>
                </div>
            )}
        </CardContent>
      </Card>
    );
}

function ActivityLog() {
    const { t } = useTranslation();
    const { activityLogs, isLoading } = useAppContext();

    const [searchQuery, setSearchQuery] = useState('');
    const [dateRange, setDateRange] = useState<DateRange | undefined>();

    const sortedLogs = useMemo(() => {
        if (!activityLogs) return [];
        return [...activityLogs].sort((a,b) => parseISO(b.timestamp).getTime() - parseISO(a.timestamp).getTime());
    }, [activityLogs]);

    const filteredLogs = useMemo(() => {
        return sortedLogs.filter(log => {
            const queryMatch = log.username.toLowerCase().includes(searchQuery.toLowerCase()) || log.description.toLowerCase().includes(searchQuery.toLowerCase()) || log.action.toLowerCase().includes(searchQuery.toLowerCase());
            
            const dateMatch = !dateRange || !dateRange.from || (
                isWithinInterval(parseISO(log.timestamp), {
                    start: startOfDay(dateRange.from),
                    end: dateRange.to ? endOfDay(dateRange.to) : endOfDay(dateRange.from),
                })
            );

            return queryMatch && dateMatch;
        });
    }, [sortedLogs, searchQuery, dateRange]);

    const getActionBadgeVariant = (action: string) => {
        switch (action) {
            case 'create': return 'default';
            case 'login': return 'default';
            case 'update': return 'secondary';
            case 'delete': return 'destructive';
            case 'logout': return 'outline';
            default: return 'outline';
        }
    };

    if (isLoading) {
        return (
             <div className="flex items-center justify-center p-8"><Loader2 className="animate-spin text-primary h-8 w-8"/></div>
        )
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>{t('system_activity')}</CardTitle>
                
            </CardHeader>
            <CardContent>
                <div className="flex flex-col md:flex-row gap-4 mb-6">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input placeholder={t('search_by_user_or_action')} className="pl-10" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                    </div>
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button id="date" variant={"outline"} className={cn("w-full md:w-[300px] justify-start text-left font-normal", !dateRange && "text-muted-foreground")}>
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {dateRange?.from ? (dateRange.to ? (
                                    <>{format(dateRange.from, "LLL dd, y")} - {format(dateRange.to, "LLL dd, y")}</>
                                ) : (
                                    format(dateRange.from, "LLL dd, y")
                                )) : (
                                    <span>{t('pick_a_date_range')}</span>
                                )}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="end">
                            <Calendar initialFocus mode="range" defaultMonth={dateRange?.from} selected={dateRange} onSelect={setDateRange} numberOfMonths={2}/>
                        </PopoverContent>
                    </Popover>
                    <Button variant="ghost" onClick={() => {setSearchQuery(''); setDateRange(undefined);}}>{t('clear_filters')}</Button>
                </div>

                 <div className="border rounded-lg overflow-hidden">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[150px]">{t('user')}</TableHead>
                                <TableHead className="w-[100px]">{t('action')}</TableHead>
                                <TableHead>{t('description')}</TableHead>
                                <TableHead className="w-[200px] text-right">{t('timestamp')}</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredLogs.length > 0 ? (
                                filteredLogs.map(log => (
                                    <TableRow key={log.id}>
                                        <TableCell className="font-medium flex items-center gap-2 pt-4"><Users className="h-4 w-4 text-muted-foreground"/>{log.username}</TableCell>
                                        <TableCell><Badge variant={getActionBadgeVariant(log.action)}>{log.action}</Badge></TableCell>
                                        <TableCell>{log.description}</TableCell>
                                        <TableCell className="text-right">{format(parseISO(log.timestamp), 'PPP p')}</TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                 <TableRow>
                                    <TableCell colSpan={4} className="h-24 text-center">
                                        {t('no_activity_found')}
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                 </div>
            </CardContent>
        </Card>
    );
}


function AdminPage() {
  const { isAdmin, loading } = useAdminAuth();
  const { t } = useTranslation();

  if (loading || !isAdmin) {
    return (
      <div className="flex h-[calc(100vh-80px)] w-full items-center justify-center bg-background">
        <Loader2 className="h-16 w-16 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-80px)] flex flex-col">
        <main className="w-full p-4 md:p-8 flex-1 overflow-y-auto">
        <div className="mb-8">
            <h1 className="text-3xl flex items-center gap-2">
            <ShieldCheck className="h-8 w-8" />
            {t('admin_panel')}
            </h1>
            
        </div>

        <Tabs defaultValue="management" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="management">{t('user_role_management')}</TabsTrigger>
                <TabsTrigger value="activity">{t('activity_log')}</TabsTrigger>
            </TabsList>
            <TabsContent value="management" className="pt-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <UserManagement />
                    <RoleManagement />
                </div>
            </TabsContent>
            <TabsContent value="activity" className="pt-6">
                <ActivityLog />
            </TabsContent>
        </Tabs>
        </main>
    </div>
  );
}

export default withAuth(AdminPage);
