'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Search, Home, BookOpen, Settings, User, Bell, Command, Keyboard } from 'lucide-react';
import { cn } from '@/lib/utils';

interface KeyboardShortcut {
  keys: string[];
  description: string;
  icon?: React.ComponentType<{ className?: string }>;
  category: string;
}

const shortcuts: KeyboardShortcut[] = [
  // Navigation
  { keys: ['⌘', 'K'], description: 'Open search', icon: Search, category: 'Navigation' },
  { keys: ['⌘', 'H'], description: 'Go to dashboard', icon: Home, category: 'Navigation' },
  { keys: ['⌘', 'L'], description: 'Go to learning', icon: BookOpen, category: 'Navigation' },
  { keys: ['⌘', 'U'], description: 'User menu', icon: User, category: 'Navigation' },
  { keys: ['⌘', 'N'], description: 'Notifications', icon: Bell, category: 'Navigation' },
  
  // Actions
  { keys: ['⌘', 'Enter'], description: 'Quick action', category: 'Actions' },
  { keys: ['⌘', 'Shift', 'N'], description: 'New course', category: 'Actions' },
  { keys: ['⌘', 'Shift', 'L'], description: 'Start live session', category: 'Actions' },
  
  // Settings
  { keys: ['⌘', ','], description: 'Open settings', icon: Settings, category: 'Settings' },
  { keys: ['⌘', 'Shift', '?'], description: 'Show shortcuts', icon: Keyboard, category: 'Settings' },
];

export function KeyboardShortcutsModal() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Show shortcuts modal with ⌘+Shift+?
      if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key === '?') {
        event.preventDefault();
        setIsOpen(true);
      }

      // Close modal with Escape
      if (event.key === 'Escape') {
        setIsOpen(false);
      }

      // Global shortcuts (only when modal is not open)
      if (!isOpen) {
        // Search with ⌘+K
        if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
          event.preventDefault();
          // Focus search input
          const searchInput = document.querySelector('input[placeholder*="Search"]') as HTMLInputElement;
          if (searchInput) {
            searchInput.focus();
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const groupedShortcuts = shortcuts.reduce((acc, shortcut) => {
    if (!acc[shortcut.category]) {
      acc[shortcut.category] = [];
    }
    acc[shortcut.category].push(shortcut);
    return acc;
  }, {} as Record<string, KeyboardShortcut[]>);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2 text-xl">
            <Keyboard className="w-6 h-6" />
            <span>Keyboard Shortcuts</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 mt-6">
          {Object.entries(groupedShortcuts).map(([category, categoryShortcuts]) => (
            <div key={category} className="space-y-3">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {category}
              </h3>
              <div className="grid gap-2">
                {categoryShortcuts.map((shortcut, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  >
                    <div className="flex items-center space-x-3">
                      {shortcut.icon && (
                        <shortcut.icon className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                      )}
                      <span className="text-gray-900 dark:text-white font-medium">
                        {shortcut.description}
                      </span>
                    </div>
                    <div className="flex items-center space-x-1">
                      {shortcut.keys.map((key, keyIndex) => (
                        <Badge
                          key={keyIndex}
                          variant="outline"
                          className={cn(
                            "px-2 py-1 text-xs font-mono bg-white dark:bg-gray-700",
                            "border-gray-300 dark:border-gray-600",
                            "text-gray-700 dark:text-gray-300"
                          )}
                        >
                          {key}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-8 pt-4 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
            <span>Press <Badge variant="outline" className="mx-1">⌘ Shift ?</Badge> to toggle this menu</span>
            <Button variant="ghost" size="sm" onClick={() => setIsOpen(false)}>
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
