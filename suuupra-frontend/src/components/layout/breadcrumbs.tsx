'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronRight, Home } from 'lucide-react';
import { Fragment } from 'react';

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbsProps {
  items?: BreadcrumbItem[];
}

export function Breadcrumbs({ items }: BreadcrumbsProps) {
  const pathname = usePathname();

  // Generate breadcrumbs from pathname if items not provided
  const breadcrumbs = items || generateBreadcrumbs(pathname);

  if (breadcrumbs.length <= 1) {
    return null;
  }

  return (
    <nav className="flex items-center space-x-2 text-sm text-gray-600 mb-6">
      <Link
        href="/dashboard"
        className="flex items-center hover:text-gray-900 transition-colors"
      >
        <Home className="h-4 w-4" />
      </Link>
      
      {breadcrumbs.map((item, index) => (
        <Fragment key={index}>
          <ChevronRight className="h-4 w-4 text-gray-400" />
          {item.href && index < breadcrumbs.length - 1 ? (
            <Link
              href={item.href}
              className="hover:text-gray-900 transition-colors"
            >
              {item.label}
            </Link>
          ) : (
            <span className="text-gray-900 font-medium">{item.label}</span>
          )}
        </Fragment>
      ))}
    </nav>
  );
}

function generateBreadcrumbs(pathname: string): BreadcrumbItem[] {
  const segments = pathname.split('/').filter(Boolean);
  const breadcrumbs: BreadcrumbItem[] = [];

  // Route mappings for better labels
  const routeLabels: Record<string, string> = {
    dashboard: 'Dashboard',
    learn: 'Learn',
    courses: 'Courses',
    videos: 'Videos',
    library: 'Library',
    progress: 'Progress',
    bookmarks: 'Bookmarks',
    downloads: 'Downloads',
    live: 'Live',
    classes: 'Classes',
    events: 'Events',
    tutor: 'AI Tutor',
    cart: 'Cart',
    orders: 'Orders',
    search: 'Search',
    analytics: 'Analytics',
    settings: 'Settings',
    profile: 'Profile',
    billing: 'Billing',
    notifications: 'Notifications',
    'api-keys': 'API Keys',
    webhooks: 'Webhooks',
    creators: 'Creator Studio',
    content: 'Content',
    new: 'New',
    upload: 'Upload',
    earnings: 'Earnings',
    admin: 'Admin',
    users: 'Users',
    system: 'System',
    financial: 'Financial',
    ledger: 'Ledger',
    transactions: 'Transactions',
    sagas: 'Sagas',
    gateway: 'Gateway',
  };

  let currentPath = '';
  segments.forEach((segment, index) => {
    currentPath += `/${segment}`;
    
    // Skip if it's an ID (UUID pattern or numeric)
    if (isId(segment)) {
      return;
    }

    const label = routeLabels[segment] || capitalize(segment);
    const href = index < segments.length - 1 ? currentPath : undefined;
    
    breadcrumbs.push({ label, href });
  });

  return breadcrumbs;
}

function isId(segment: string): boolean {
  // Check if segment looks like an ID (UUID or numeric)
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const numericRegex = /^\d+$/;
  
  return uuidRegex.test(segment) || numericRegex.test(segment);
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1).replace(/-/g, ' ');
}

