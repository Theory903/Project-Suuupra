'use client';

import { FloatingActionButton } from './floating-action-button';
import { KeyboardShortcutsModal } from './keyboard-shortcuts-modal';
import { cn } from '@/lib/utils';

interface EnhancedLayoutProps {
  children: React.ReactNode;
  showFAB?: boolean;
  showKeyboardShortcuts?: boolean;
  className?: string;
}

export function EnhancedLayout({ 
  children, 
  showFAB = true, 
  showKeyboardShortcuts = true,
  className 
}: EnhancedLayoutProps) {
  return (
    <div className={cn("relative min-h-screen", className)}>
      {children}
      
      {/* Floating Action Button */}
      {showFAB && <FloatingActionButton />}
      
      {/* Keyboard Shortcuts Modal */}
      {showKeyboardShortcuts && <KeyboardShortcutsModal />}
    </div>
  );
}
