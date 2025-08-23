'use client';

import { Button } from '@/components/ui/button';
import { Breadcrumbs } from './breadcrumbs';

interface PageHeaderProps {
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick?: () => void;
    href?: string;
  };
  breadcrumbs?: Array<{ label: string; href?: string }>;
  children?: React.ReactNode;
}

export function PageHeader({
  title,
  description,
  action,
  breadcrumbs,
  children,
}: PageHeaderProps) {
  return (
    <div className="mb-8">
      <Breadcrumbs items={breadcrumbs} />
      
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{title}</h1>
          {description && (
            <p className="mt-2 text-gray-600">{description}</p>
          )}
        </div>
        
        <div className="flex items-center space-x-4">
          {children}
          {action && (
            <Button onClick={action.onClick}>
              {action.label}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

