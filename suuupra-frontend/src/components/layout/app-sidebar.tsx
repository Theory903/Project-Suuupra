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
    <div className="flex flex-col w-64 bg-white border-r border-gray-200 h-full">
      {/* Logo */}
      <div className="flex items-center px-6 py-4 border-b">
        <Link href="/dashboard" className="flex items-center space-x-2">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-lg">S</span>
          </div>
          <span className="text-xl font-bold text-gray-900">Suuupra</span>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 py-6 space-y-8 overflow-y-auto">
        {/* Main Navigation */}
        <div>
          <h3 className="px-2 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
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
                    'flex items-center px-2 py-2 text-sm font-medium rounded-md transition-colors',
                    isActive
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                  )}
                >
                  <item.icon className="mr-3 h-5 w-5" />
                  {item.name}
                </Link>
              );
            })}
          </div>
        </div>

        {/* Creator Navigation */}
        {filteredCreatorNav.length > 0 && (
          <div>
            <h3 className="px-2 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
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
                      'flex items-center px-2 py-2 text-sm font-medium rounded-md transition-colors',
                      isActive
                        ? 'bg-green-100 text-green-700'
                        : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                    )}
                  >
                    <item.icon className="mr-3 h-5 w-5" />
                    {item.name}
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {/* Admin Navigation */}
        {filteredAdminNav.length > 0 && (
          <div>
            <h3 className="px-2 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
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
                      'flex items-center px-2 py-2 text-sm font-medium rounded-md transition-colors',
                      isActive
                        ? 'bg-red-100 text-red-700'
                        : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                    )}
                  >
                    <item.icon className="mr-3 h-5 w-5" />
                    {item.name}
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

