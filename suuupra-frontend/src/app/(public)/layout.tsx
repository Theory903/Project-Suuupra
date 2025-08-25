import { PublicHeader } from '@/components/layout/public-header';
import { PublicFooter } from '@/components/layout/public-footer';
import { EnhancedLayout } from '@/components/layout/enhanced-layout';

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <EnhancedLayout showFAB={false}>
      <div className="min-h-screen flex flex-col bg-gradient-to-br from-white via-blue-50/30 to-purple-50/30 dark:from-gray-950 dark:via-gray-900 dark:to-gray-800">
        <PublicHeader />
        <main className="flex-1 relative">
          {/* Subtle background pattern */}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,_rgba(255,255,255,0.15)_1px,_transparent_0)] bg-[size:20px_20px] opacity-30" />
          <div className="relative z-10">
            {children}
          </div>
        </main>
        <PublicFooter />
      </div>
    </EnhancedLayout>
  );
}

