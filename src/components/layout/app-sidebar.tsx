'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  CreditCard,
  Box,
  Users,
  UserCircle,
  Settings,
  Home,
  LayoutGrid,
  MapPin,
  Upload,
  Archive,
  Calendar,
  ClipboardList,
  Clock
} from 'lucide-react';

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
  useSidebar,
} from '@/components/ui/sidebar';
import { useTranslation } from '@/hooks/use-translation';
import { useAuth } from '@/hooks/use-auth';
import { cn } from '@/lib/utils';
import { useAppContext } from '@/context/app-provider';
import Image from 'next/image';

export function AppSidebar() {
  const { t, language } = useTranslation();
  const { hasPermission } = useAuth();
  const { settings } = useAppContext();
  const pathname = usePathname();
  const { state } = useSidebar();
  const [activeGroupIndex, setActiveGroupIndex] = React.useState<number | null>(null);

  const side = language === 'ku' ? 'right' : 'left';
  const isRTL = language === 'ku';

  const navigation = [
    {
      label: isRTL ? 'کۆگا و جەرد' : 'Warehouse & Inventory',
      icon: Box,
      items: [
        { title: 'dashboard', icon: Home, href: '/', permission: 'admin:all' },
        { title: 'placement_storage', icon: Box, href: '/items', permission: 'page:items:view' },
        { title: 'locations', icon: MapPin, href: '/locations', permission: 'page:items:locations' },
        { title: 'warehouse_map', icon: LayoutGrid, href: '/warehouse-map', permission: 'admin:all' },
        { title: 'import', icon: Upload, href: '/import', permission: 'page:items:import' },
        { title: 'excel_archive', icon: Archive, href: '/archive', permission: 'page:items:archive' },
      ],
    },
    {
      label: isRTL ? 'بەڕێوەبردنی ستاف' : 'Staff Management',
      icon: Users,
      items: [
        { title: 'employees', icon: Users, href: '/employees', permission: 'page:employees:view' },
        { title: 'ashley_employees_management', icon: CreditCard, href: '/ashley-expenses', permission: 'page:ashley-expenses:view' },
        { title: 'overtime', icon: Clock, href: '/overtime', permission: 'page:employees:view' },
        { title: 'inputs', icon: Upload, href: '/inputs', permission: 'page:employees:view' },
        { title: 'attendance', icon: Calendar, href: '/attendance', permission: 'page:employees:view' },
        { title: 'admin_attendance', icon: ClipboardList, href: '/admin/attendance', permission: 'admin:all' },
      ],
    },
    {
      label: isRTL ? 'ڕێکخستنەکان' : 'Settings',
      icon: Settings,
      items: [
        { title: 'my_account', icon: UserCircle, href: '/account', permission: 'page:account' },
        { title: 'settings', icon: Settings, href: '/settings', permission: 'page:settings' },
      ],
    }
  ];

  // Compact mobile navigation bar items
  const mobileNavItems = [
    { icon: Home, href: '/', label: isRTL ? 'داشبۆرد' : 'Dashboard', permission: 'admin:all' },
    { icon: Box, href: '/items', label: isRTL ? 'کۆگا' : 'Inventory', permission: 'page:items:view' },
    { icon: Calendar, href: '/attendance', label: isRTL ? 'دەوام' : 'Attendance', permission: 'page:employees:view' },
    { icon: Users, href: '/employees', label: isRTL ? 'ستاف' : 'Staff', permission: 'page:employees:view' },
    { icon: CreditCard, href: '/ashley-expenses', label: isRTL ? 'خەرجی' : 'Expenses', permission: 'page:ashley-expenses:view' },
  ];

  return (
    <div 
      className="relative flex h-full" 
      onMouseLeave={() => setActiveGroupIndex(null)}
    >
      {/* Desktop Sidebar (hidden on mobile, visible on medium screens and up) */}
      <Sidebar 
        side={side} 
        collapsible="icon" 
        className="hidden md:flex border-r border-white/50 bg-white/45 backdrop-blur-xl print:hidden overflow-hidden mt-12 z-40"
      >
        <SidebarHeader className="p-2 flex flex-col items-center gap-4">
          <SidebarTrigger className="text-muted-foreground hover:text-foreground hover:bg-muted transition-all h-8 w-8 rounded-md" />
          
          {state !== "collapsed" && settings.appLogo && (
              <div className="relative w-8 h-8 opacity-80 mt-2">
                  <Image src={settings.appLogo} alt="Logo" fill className="object-contain" unoptimized />
              </div>
          )}
        </SidebarHeader>

        <SidebarContent className="scrollbar-none pt-4">
          <SidebarMenu>
            {navigation.map((group, gIndex) => {
              const hasVisibleItems = group.items.some(item => hasPermission(item.permission));
              if (!hasVisibleItems) return null;

              // A group is active if the current pathname matches any of its sub-items
              const isGroupActive = group.items.some(item => 
                pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href))
              );

              const isHovered = activeGroupIndex === gIndex;

              return (
                <SidebarMenuItem key={gIndex} className="px-2 mb-1 group-data-[collapsible=icon]:px-1.5">
                  <SidebarMenuButton
                    isActive={isGroupActive}
                    tooltip={group.label}
                    onMouseEnter={() => setActiveGroupIndex(gIndex)}
                    className={cn(
                      "rounded-md transition-all duration-200 h-10 flex items-center justify-start gap-3 px-3 relative cursor-pointer w-full text-right",
                      isGroupActive ? "bg-primary/10 text-primary font-bold" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    <group.icon className="w-4 h-4 shrink-0" />
                    {state !== "collapsed" && (
                      <span className="text-xs font-semibold tracking-wide truncate">
                        {group.label}
                      </span>
                    )}
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarContent>
        <SidebarFooter className="p-2 flex items-center justify-center opacity-50">
            <div className="w-1 h-1 rounded-full bg-border" />
        </SidebarFooter>
      </Sidebar>

      {/* Floating Flyout Submenu Panel */}
      {activeGroupIndex !== null && (
        <div 
          className="absolute right-full top-12 h-[calc(100vh-3rem)] w-56 bg-white/75 backdrop-blur-2xl border border-white/50 shadow-xl z-50 animate-in slide-in-from-right-5 duration-200 p-4 rounded-l-2xl"
          onMouseEnter={() => setActiveGroupIndex(activeGroupIndex)}
          dir={isRTL ? "rtl" : "ltr"}
        >
          <div className="mb-4 pb-2 border-b border-border/40">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 opacity-90">
              {navigation[activeGroupIndex].label}
            </h3>
          </div>
          <div className="flex flex-col gap-1.5">
            {navigation[activeGroupIndex].items
              .filter(item => hasPermission(item.permission))
              .map(item => {
                const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
                return (
                  <Link 
                    key={item.href} 
                    href={item.href}
                    onClick={() => setActiveGroupIndex(null)} // Close on click
                    className={cn(
                      "flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-semibold transition-all duration-200",
                      isActive 
                        ? "bg-primary/10 text-primary font-bold" 
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    <item.icon className="w-3.5 h-3.5 shrink-0" />
                    <span>{t(item.title)}</span>
                  </Link>
                );
              })}
          </div>
        </div>
      )}

      {/* Mobile Bottom Navigation Bar (visible only on mobile, fixed at the bottom) */}
      <div 
        className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-white/70 backdrop-blur-2xl border-t border-white/50 z-50 flex items-center justify-around px-2 shadow-xl print:hidden" 
        dir={isRTL ? "rtl" : "ltr"}
      >
        {mobileNavItems.filter(item => hasPermission(item.permission)).map((item) => {
          const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
          return (
            <Link 
              key={item.href} 
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center flex-1 h-full gap-1 transition-all duration-200",
                isActive ? "text-primary scale-105 font-bold" : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-350"
              )}
            >
              <item.icon className="w-4.5 h-4.5 shrink-0" />
              <span className="text-[9px] font-medium tracking-wider">
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
