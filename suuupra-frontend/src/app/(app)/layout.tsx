import { AppSidebar } from '@/components/layout/app-sidebar';
import { AppHeader } from '@/components/layout/app-header';
import { EnhancedLayout } from '@/components/layout/enhanced-layout';
import { requireAuth } from '@/lib/auth';

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireAuth();

  return (
    <EnhancedLayout>
      <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
        <AppSidebar user={user} />
        <div className="flex-1 flex flex-col overflow-hidden">
          <AppHeader user={user} />
          <main className="flex-1 overflow-auto p-6 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
            <div className="max-w-7xl mx-auto">
              {children}
            </div>
          </main>
        </div>
      </div>
    </EnhancedLayout>
  );
}

