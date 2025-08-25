'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  BookOpen,
  Library,
  Video,
  MessageCircle,
  ShoppingCart,
  Settings,
  BarChart3,
  Users,
  Shield,
  Cog,
  PenTool,
  DollarSign,
} from 'lucide-react';
import type { User } from '@/types/api';

interface AppSidebarProps {
  user: User;
}

export function AppSidebar({ user }: AppSidebarProps) {
  const pathname = usePathname();

  const navigation = [
    {
      name: 'Dashboard',
      href: '/dashboard',
      icon: LayoutDashboard,
      roles: ['USER', 'CREATOR', 'ADMIN'],
    },
    {
      name: 'Learn',
      href: '/learn',
      icon: BookOpen,
      roles: ['USER', 'CREATOR', 'ADMIN'],
    },
    {
      name: 'Library',
      href: '/library',
      icon: Library,
      roles: ['USER', 'CREATOR', 'ADMIN'],
    },
    {
      name: 'Live',
      href: '/live',
      icon: Video,
      roles: ['USER', 'CREATOR', 'ADMIN'],
    },
    {
      name: 'AI Tutor',
      href: '/tutor',
      icon: MessageCircle,
      roles: ['USER', 'CREATOR', 'ADMIN'],
    },
    {
      name: 'Cart & Orders',
      href: '/cart',
      icon: ShoppingCart,
      roles: ['USER', 'CREATOR', 'ADMIN'],
    },
    {
      name: 'Analytics',
      href: '/analytics',
      icon: BarChart3,
      roles: ['USER', 'CREATOR', 'ADMIN'],
    },
    {
      name: 'Settings',
      href: '/settings',
      icon: Settings,
      roles: ['USER', 'CREATOR', 'ADMIN'],
    },
  ];

  const creatorNavigation = [
    {
      name: 'Creator Studio',
      href: '/creators',
      icon: PenTool,
      roles: ['CREATOR', 'ADMIN'],
    },
    {
      name: 'My Content',
      href: '/creators/content',
      icon: BookOpen,
      roles: ['CREATOR', 'ADMIN'],
    },
    {
      name: 'Videos',
      href: '/creators/videos',
      icon: Video,
      roles: ['CREATOR', 'ADMIN'],
    },
    {
      name: 'Live Streaming',
      href: '/creators/live',
      icon: Video,
      roles: ['CREATOR', 'ADMIN'],
    },
    {
      name: 'Earnings',
      href: '/creators/earnings',
      icon: DollarSign,
      roles: ['CREATOR', 'ADMIN'],
    },
  ];

  const adminNavigation = [
    {
      name: 'Admin Dashboard',
      href: '/admin',
      icon: Shield,
      roles: ['ADMIN'],
    },
    {
      name: 'User Management',
      href: '/admin/users',
      icon: Users,
      roles: ['ADMIN'],
    },
    {
      name: 'Content Moderation',
      href: '/admin/content',
      icon: BookOpen,
      roles: ['ADMIN'],
    },
    {
      name: 'System Status',
      href: '/admin/system',
      icon: Cog,
      roles: ['ADMIN'],
    },
    {
      name: 'Financial',
      href: '/admin/financial',
      icon: DollarSign,
      roles: ['ADMIN'],
    },
    {
      name: 'Gateway Config',
      href: '/admin/gateway',
      icon: Cog,
      roles: ['ADMIN'],
    },
  ];

  const filteredNavigation = navigation.filter(item => 
    item.roles.includes(user.role || 'USER')
  );

  const filteredCreatorNav = creatorNavigation.filter(item => 
    item.roles.includes(user.role || 'USER')
  );

  const filteredAdminNav = adminNavigation.filter(item => 
    item.roles.includes(user.role || 'USER')
  );

  return (
    <div className="flex flex-col w-64 bg-white dark:bg-gray-900/95 border-r border-gray-200 dark:border-gray-800 h-full backdrop-blur-xl transition-colors duration-300">
      {/* Logo */}
      <div className="flex items-center px-6 py-4 border-b border-gray-200 dark:border-gray-800">
        <Link href="/dashboard" className="group flex items-center space-x-3">
          <div className="relative">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-600 via-purple-600 to-indigo-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-500/25 dark:shadow-blue-500/40 transition-all duration-300 group-hover:shadow-xl group-hover:shadow-blue-500/50 group-hover:scale-105">
              <span className="text-white font-bold text-lg">S</span>
            </div>
            <div className="absolute inset-0 bg-gradient-to-br from-blue-600 via-purple-600 to-indigo-600 rounded-lg blur-md opacity-0 group-hover:opacity-30 transition-opacity duration-300 -z-10" />
          </div>
          <span className="text-xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 dark:from-white dark:to-gray-300 bg-clip-text text-transparent">
            Suuupra
          </span>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 py-6 space-y-8 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600 scrollbar-track-transparent">
        {/* Main Navigation */}
        <div>
          <h3 className="px-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4 flex items-center">
            <div className="w-1 h-1 bg-blue-500 rounded-full mr-2"></div>
            Main
          </h3>
          <div className="space-y-1">
            {filteredNavigation.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    'group flex items-center px-3 py-2.5 text-sm font-medium rounded-xl transition-all duration-200 relative',
                    isActive
                      ? 'bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/50 dark:to-indigo-950/50 text-blue-700 dark:text-blue-300 shadow-lg shadow-blue-500/10 dark:shadow-blue-500/20 border border-blue-200 dark:border-blue-800/50'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800/50 hover:text-gray-900 dark:hover:text-white hover:shadow-md hover:scale-[1.02] border border-transparent'
                  )}
                >
                  <item.icon className={cn(
                    "mr-3 h-5 w-5 transition-all duration-200",
                    isActive 
                      ? "text-blue-600 dark:text-blue-400 scale-110" 
                      : "text-gray-500 dark:text-gray-400 group-hover:text-gray-700 dark:group-hover:text-gray-300"
                  )} />
                  {item.name}
                  {isActive && (
                    <div className="absolute right-2 w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                  )}
                </Link>
              );
            })}
          </div>
        </div>

        {/* Creator Navigation */}
        {filteredCreatorNav.length > 0 && (
          <div>
            <h3 className="px-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4 flex items-center">
              <div className="w-1 h-1 bg-green-500 rounded-full mr-2"></div>
              Creator Tools
            </h3>
            <div className="space-y-1">
              {filteredCreatorNav.map((item) => {
                const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={cn(
                      'group flex items-center px-3 py-2.5 text-sm font-medium rounded-xl transition-all duration-200 relative',
                      isActive
                        ? 'bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/50 dark:to-emerald-950/50 text-green-700 dark:text-green-300 shadow-lg shadow-green-500/10 dark:shadow-green-500/20 border border-green-200 dark:border-green-800/50'
                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800/50 hover:text-gray-900 dark:hover:text-white hover:shadow-md hover:scale-[1.02] border border-transparent'
                    )}
                  >
                    <item.icon className={cn(
                      "mr-3 h-5 w-5 transition-all duration-200",
                      isActive 
                        ? "text-green-600 dark:text-green-400 scale-110" 
                        : "text-gray-500 dark:text-gray-400 group-hover:text-gray-700 dark:group-hover:text-gray-300"
                    )} />
                    {item.name}
                    {isActive && (
                      <div className="absolute right-2 w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {/* Admin Navigation */}
        {filteredAdminNav.length > 0 && (
          <div>
            <h3 className="px-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4 flex items-center">
              <div className="w-1 h-1 bg-red-500 rounded-full mr-2"></div>
              Administration
            </h3>
            <div className="space-y-1">
              {filteredAdminNav.map((item) => {
                const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={cn(
                      'group flex items-center px-3 py-2.5 text-sm font-medium rounded-xl transition-all duration-200 relative',
                      isActive
                        ? 'bg-gradient-to-r from-red-50 to-pink-50 dark:from-red-950/50 dark:to-pink-950/50 text-red-700 dark:text-red-300 shadow-lg shadow-red-500/10 dark:shadow-red-500/20 border border-red-200 dark:border-red-800/50'
                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800/50 hover:text-gray-900 dark:hover:text-white hover:shadow-md hover:scale-[1.02] border border-transparent'
                    )}
                  >
                    <item.icon className={cn(
                      "mr-3 h-5 w-5 transition-all duration-200",
                      isActive 
                        ? "text-red-600 dark:text-red-400 scale-110" 
                        : "text-gray-500 dark:text-gray-400 group-hover:text-gray-700 dark:group-hover:text-gray-300"
                    )} />
                    {item.name}
                    {isActive && (
                      <div className="absolute right-2 w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </nav>
    </div>
  );
}

