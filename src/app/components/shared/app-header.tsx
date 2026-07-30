
'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  Bell,
  ChevronDown,
  Calendar,
  Clock,
  RefreshCcw,
  Languages,
  Home,
  LogOut,
  Sun,
  Moon,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/hooks/use-translation';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import { useAppContext } from '@/context/app-provider';
import { useTheme } from '@/components/shared/theme-provider';


function DateTimeDisplay() {
  const [time, setTime] = useState<Date | null>(null);

  useEffect(() => {
    // This code runs only on the client, after the component has mounted.
    setTime(new Date());
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []); // The empty dependency array ensures this effect runs only once on mount.

  if (!time) {
    // On the server and during initial client render, show a placeholder.
    return (
      <>
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4" />
          <span>...</span>
        </div>
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4" />
          <span>...</span>
        </div>
      </>
    );
  }

  // Once mounted on the client, render the actual time.
  return (
    <>
      <div className="flex items-center gap-2">
        <Calendar className="w-4 h-4" />
        <span>{format(time, 'MMMM d, yyyy')}</span>
      </div>
      <div className="flex items-center gap-2">
        <Clock className="w-4 h-4" />
        <span>{format(time, 'h:mm:ss a')}</span>
      </div>
    </>
  );
}


export function AppHeader() {
  const { t, setLanguage, language } = useTranslation();
  const { user, logout } = useAuth();
  const { settings } = useAppContext();
  const { theme, setTheme } = useTheme();
  const router = useRouter();

  const [isMounted, setIsMounted] = useState(false);
  
  useEffect(() => {
    setIsMounted(true);
  }, []);

  const handleRefresh = () => {
    window.location.reload();
  };

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  return (
    <header className="bg-card border-b top-0 z-10 print:hidden">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-20">
            <div className="flex-1 flex items-center justify-start">
                 <div className="hidden md:flex items-center gap-4 text-sm text-muted-foreground">
                    <DateTimeDisplay />
                </div>
            </div>
          
            <div className="flex-1 flex items-center justify-center">
                {isMounted && settings.appLogo && (
                <Link href="/">
                    <div className="relative w-full max-w-[240px] h-16 cursor-pointer">
                    <Image
                        key={settings.appLogo}
                        src={settings.appLogo}
                        alt="App Logo"
                        fill
                        className="object-contain"
                        data-ai-hint="logo"
                    />
                    </div>
                </Link>
                )}
            </div>

            <div className="flex-1 flex items-center justify-end gap-2">
                <Button variant="ghost" size="icon" asChild>
                    <Link href="/"><Home className="w-5 h-5 text-muted-foreground hover:text-primary" /></Link>
                </Button>
                <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon">
                    <Languages className="w-5 h-5 text-muted-foreground hover:text-primary" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    <DropdownMenuItem
                    onSelect={() => setLanguage('en')}
                    disabled={language === 'en'}
                    >
                    English
                    </DropdownMenuItem>
                    <DropdownMenuItem
                    onSelect={() => setLanguage('ku')}
                    disabled={language === 'ku'}
                    >
                    Kurdish (Soranî)
                    </DropdownMenuItem>
                </DropdownMenuContent>
                </DropdownMenu>

                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
                  aria-label={t('toggle_theme')}
                >
                  <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                  <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
                </Button>

                <Button
                variant="ghost"
                size="icon"
                onClick={handleRefresh}
                aria-label={t('refresh_page')}
                >
                <RefreshCcw className="w-5 h-5 text-muted-foreground hover:text-primary" />
                </Button>
                <Bell className="w-6 h-6 text-muted-foreground hover:text-primary cursor-pointer" />
                
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <div className="flex items-center gap-2 cursor-pointer">
                            <Avatar className="w-10 h-10">
                            <AvatarImage src={undefined} />
                            <AvatarFallback>{user?.username?.charAt(0).toUpperCase() || 'U'}</AvatarFallback>
                            </Avatar>
                            <ChevronDown className="w-4 h-4 text-muted-foreground" />
                        </div>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                            <Link href="/account">{t('my_account')}</Link>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={handleLogout}>
                            <LogOut className="mr-2 h-4 w-4" />
                            <span>{t('logout')}</span>
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
          </div>
        </div>
      </div>
    </header>
  );
}
