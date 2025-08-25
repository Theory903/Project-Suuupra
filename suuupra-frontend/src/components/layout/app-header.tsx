'use client';

import { Bell, Search, User as UserIcon, Settings, HelpCircle, LogOut, Zap, BookOpen, Award, Command } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,

  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ThemeToggle } from '@/components/theme-toggle';
import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';

import type { User } from '@/lib/auth-server';

interface AppHeaderProps {
  user: User;
}

export function AppHeader({ user }: AppHeaderProps) {
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [hasNotifications] = useState(true);
  const [notificationCount] = useState(3);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 10);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const getUserDisplayName = () => {
    if (user.name) return user.name;
    if (user.email) return user.email.split('@')[0];
    return 'User';
  };

  const getUserInitials = () => {
    if (user.name) {
      return user.name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);
    }
    if (user.email && user.email.length > 0) {
      return user.email[0].toUpperCase();
    }
    return 'U';
  };

  return (
    <header className={cn(
      "sticky top-0 z-40 transition-all duration-300 px-6 py-4",
      scrolled 
        ? "bg-white/95 backdrop-blur-xl border-b border-gray-200/60 dark:bg-gray-950/95 dark:border-gray-800/60 shadow-sm shadow-black/5" 
        : "bg-white/90 backdrop-blur-lg border-b border-gray-100 dark:bg-gray-950/90 dark:border-gray-800"
    )}>
      <div className="flex items-center justify-between">
        {/* Enhanced Search */}
        <div className="flex-1 max-w-2xl">
          <div className={cn(
            "relative group transition-all duration-300",
            isSearchFocused && "scale-105"
          )}>
            <div className={cn(
              "absolute left-4 top-1/2 transform -translate-y-1/2 transition-all duration-200 z-10",
              isSearchFocused ? "text-blue-500 scale-110" : "text-gray-400"
            )}>
              <Search className="w-4 h-4" />
            </div>
            <Input
              placeholder="Search courses, topics, or press ⌘K..."
              className={cn(
                "pl-12 pr-12 h-11 rounded-2xl transition-all duration-300",
                "bg-gray-50/80 dark:bg-gray-800/80 backdrop-blur-sm",
                "border-gray-200/60 dark:border-gray-700/60",
                "focus:bg-white dark:focus:bg-gray-800",
                "focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500",
                "focus:shadow-lg focus:shadow-blue-500/10",
                "hover:bg-gray-50 dark:hover:bg-gray-800/90",
                "placeholder:text-gray-500 dark:placeholder:text-gray-400"
              )}
              onFocus={() => setIsSearchFocused(true)}
              onBlur={() => setIsSearchFocused(false)}
            />
            {/* Search shortcut indicator */}
            <div className={cn(
              "absolute right-4 top-1/2 transform -translate-y-1/2 transition-opacity duration-200",
              isSearchFocused ? "opacity-0" : "opacity-100"
            )}>
              <div className="flex items-center space-x-1 px-2 py-1 rounded-md bg-gray-200/50 dark:bg-gray-700/50">
                <Command className="w-3 h-3 text-gray-400" />
                <span className="text-xs text-gray-400 font-medium">K</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right side controls */}
        <div className="flex items-center space-x-2 ml-6">
          <ThemeToggle />
          
          {/* Quick Actions */}
          <Button 
            variant="ghost" 
            size="sm" 
            className="hidden md:flex items-center space-x-2 px-3 text-gray-600 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/50 transition-all duration-200"
          >
            <Zap className="w-4 h-4" />
            <span className="text-sm font-medium">Quick Actions</span>
          </Button>

          {/* Notifications with enhanced styling */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="ghost" 
                size="sm" 
                className={cn(
                  "relative p-2.5 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all duration-200",
                  hasNotifications && "hover:scale-105"
                )}
              >
                <Bell className={cn(
                  "w-5 h-5 transition-all duration-200",
                  hasNotifications ? "text-blue-600 dark:text-blue-400" : "text-gray-500"
                )} />
                {hasNotifications && (
                  <>
                    {/* Notification badge */}
                    <div className={cn(
                      "absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center",
                      "bg-gradient-to-r from-red-500 to-red-600 text-white text-xs font-bold rounded-full",
                      "shadow-lg shadow-red-500/30 animate-pulse"
                    )}>
                      {notificationCount}
                    </div>
                    {/* Pulse animation */}
                    <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500/30 rounded-full animate-ping" />
                  </>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-80 p-0" align="end" forceMount>
              <div className="p-4 border-b bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/20 dark:to-purple-950/20">
                <h3 className="font-semibold text-gray-900 dark:text-white flex items-center space-x-2">
                  <Bell className="w-4 h-4" />
                  <span>Notifications</span>
                  {hasNotifications && (
                    <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 text-xs rounded-full font-medium">
                      {notificationCount} new
                    </span>
                  )}
                </h3>
              </div>
              <div className="p-2">
                {/* Sample notifications */}
                <div className="space-y-1">
                  <div className="flex items-start space-x-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                    <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white">New course available</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Advanced React Patterns is now live</p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                    <div className="w-2 h-2 bg-green-500 rounded-full mt-2 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white">Course completed</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">You finished &quot;JavaScript Fundamentals&quot;</p>
                    </div>
                  </div>
                </div>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Enhanced User Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-all duration-200 hover:scale-105">
                <div className="relative">
                  <Avatar className="h-9 w-9 ring-2 ring-transparent hover:ring-blue-500/20 transition-all duration-200">
                    <AvatarImage src={user.avatar} alt={getUserDisplayName()} />
                    <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white font-semibold">
                      {getUserInitials()}
                    </AvatarFallback>
                  </Avatar>
                  {/* Online indicator */}
                  <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-white dark:border-gray-950 shadow-sm" />
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-64 p-0" align="end" forceMount>
              {/* User info header */}
              <div className="p-4 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/20 dark:to-purple-950/20">
                <div className="flex items-center space-x-3">
                  <Avatar className="h-12 w-12">
                    <AvatarImage src={user.avatar} alt={getUserDisplayName()} />
                    <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white font-semibold text-lg">
                      {getUserInitials()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                      {getUserDisplayName()}
                    </p>
                    {user.email && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                        {user.email}
                      </p>
                    )}
                    <div className="flex items-center space-x-2 mt-1">
                      <div className="flex items-center space-x-1">
                        <Award className="w-3 h-3 text-yellow-500" />
                        <span className="text-xs text-gray-600 dark:text-gray-400">Pro Member</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="p-2">
                <DropdownMenuItem className="flex items-center space-x-3 p-3 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-950/50 transition-colors cursor-pointer">
                  <UserIcon className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  <span className="font-medium">View Profile</span>
                </DropdownMenuItem>
                
                <DropdownMenuItem className="flex items-center space-x-3 p-3 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-950/50 transition-colors cursor-pointer">
                  <BookOpen className="w-4 h-4 text-green-600 dark:text-green-400" />
                  <span className="font-medium">My Learning</span>
                </DropdownMenuItem>
                
                <DropdownMenuItem className="flex items-center space-x-3 p-3 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-950/50 transition-colors cursor-pointer">
                  <Settings className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                  <span className="font-medium">Settings</span>
                </DropdownMenuItem>
                
                <DropdownMenuItem className="flex items-center space-x-3 p-3 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-950/50 transition-colors cursor-pointer">
                  <HelpCircle className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                  <span className="font-medium">Help & Support</span>
                </DropdownMenuItem>
                
                <DropdownMenuSeparator className="my-2" />
                
                <DropdownMenuItem className="flex items-center space-x-3 p-3 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/50 transition-colors cursor-pointer text-red-600 dark:text-red-400">
                  <LogOut className="w-4 h-4" />
                  <span className="font-medium">Sign Out</span>
                </DropdownMenuItem>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
