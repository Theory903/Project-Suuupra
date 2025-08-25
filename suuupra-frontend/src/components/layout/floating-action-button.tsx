'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Plus, Zap, BookOpen, Video, MessageSquare, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FloatingActionButtonProps {
  className?: string;
}

export function FloatingActionButton({ className }: FloatingActionButtonProps) {
  const [isOpen, setIsOpen] = useState(false);

  const actions = [
    {
      icon: BookOpen,
      label: 'New Course',
      color: 'bg-blue-500 hover:bg-blue-600',
      action: () => console.log('New course'),
    },
    {
      icon: Video,
      label: 'Start Live',
      color: 'bg-red-500 hover:bg-red-600',
      action: () => console.log('Start live'),
    },
    {
      icon: MessageSquare,
      label: 'Quick Chat',
      color: 'bg-green-500 hover:bg-green-600',
      action: () => console.log('Quick chat'),
    },
    {
      icon: Sparkles,
      label: 'AI Helper',
      color: 'bg-purple-500 hover:bg-purple-600',
      action: () => console.log('AI helper'),
    },
  ];

  return (
    <div className={cn("fixed bottom-6 right-6 z-50", className)}>
      {/* Action buttons */}
      <div className={cn(
        "flex flex-col items-end space-y-3 mb-4 transition-all duration-300",
        isOpen ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none"
      )}>
        {actions.map((action, index) => (
          <div
            key={action.label}
            className={cn(
              "flex items-center space-x-3 animate-in slide-in-from-right-2 fill-mode-forwards",
            )}
            style={{
              animationDelay: isOpen ? `${index * 50}ms` : '0ms',
              animationDuration: '200ms'
            }}
          >
            <span className="bg-white dark:bg-gray-800 text-gray-800 dark:text-white px-3 py-2 rounded-lg text-sm font-medium shadow-lg whitespace-nowrap">
              {action.label}
            </span>
            <Button
              size="icon"
              className={cn(
                "w-12 h-12 rounded-full shadow-lg transition-all duration-200 hover:scale-110",
                action.color
              )}
              onClick={() => {
                action.action();
                setIsOpen(false);
              }}
            >
              <action.icon className="w-5 h-5 text-white" />
            </Button>
          </div>
        ))}
      </div>

      {/* Main FAB */}
      <Button
        size="icon"
        className={cn(
          "w-14 h-14 rounded-full shadow-lg transition-all duration-300",
          "bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700",
          "hover:scale-110 hover:shadow-xl",
          isOpen && "rotate-45"
        )}
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="relative">
          <Plus className={cn(
            "w-6 h-6 text-white transition-all duration-300",
            isOpen ? "rotate-45" : "rotate-0"
          )} />
          <Zap className={cn(
            "absolute inset-0 w-6 h-6 text-white transition-all duration-300",
            isOpen ? "opacity-0 rotate-90" : "opacity-0 rotate-0"
          )} />
        </div>
      </Button>
    </div>
  );
}
