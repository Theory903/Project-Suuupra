import { AppSidebar } from '@/components/layout/app-sidebar';
import { AppHeader } from '@/components/layout/app-header';
import { requireRole } from '@/lib/auth';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireRole(['ADMIN']);

  return (
    <div className="flex h-screen bg-gray-50">
      <AppSidebar user={user} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <AppHeader user={user} />
        <main className="flex-1 overflow-auto p-6">{children}</main>
      </div>
    </div>
  );
}

