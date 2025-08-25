'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ThemeToggle } from '@/components/theme-toggle';
import { Search, Menu, X, Sparkles, BookOpen, Video, CreditCard, Users } from 'lucide-react';
import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';

export function PublicHeader() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navigationItems = [
    { href: '/courses', label: 'Courses', icon: BookOpen },
    { href: '/live', label: 'Live Events', icon: Video },
    { href: '/pricing', label: 'Pricing', icon: CreditCard },
    { href: '/about', label: 'About', icon: Users },
  ];

  return (
    <>
      <header className={cn(
        "fixed top-0 left-0 right-0 z-50 transition-all duration-300",
        scrolled 
          ? "bg-white/95 backdrop-blur-xl border-b border-gray-200/50 dark:bg-gray-950/95 dark:border-gray-800/50 shadow-lg shadow-black/5" 
          : "bg-white/80 backdrop-blur-md border-b border-transparent dark:bg-gray-950/80"
      )}>
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            {/* Logo with animation */}
            <Link href="/" className="group flex items-center space-x-3 z-10">
              <div className="relative">
                <div className="w-9 h-9 bg-gradient-to-br from-blue-600 via-purple-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/25 transition-all duration-300 group-hover:shadow-xl group-hover:shadow-blue-500/40 group-hover:scale-105">
                  <span className="text-white font-bold text-lg">S</span>
                  <Sparkles className="absolute -top-1 -right-1 w-3 h-3 text-yellow-400 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                </div>
                <div className="absolute inset-0 bg-gradient-to-br from-blue-600 via-purple-600 to-indigo-600 rounded-xl blur-md opacity-0 group-hover:opacity-30 transition-opacity duration-300 -z-10" />
              </div>
              <span className="text-xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 dark:from-white dark:to-gray-300 bg-clip-text text-transparent">
                Suuupra
              </span>
            </Link>

            {/* Desktop Navigation with enhanced styling */}
            <nav className="hidden lg:flex items-center space-x-1">
              {navigationItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="group flex items-center space-x-2 px-4 py-2 rounded-full text-sm font-medium text-gray-700 hover:text-blue-600 dark:text-gray-300 dark:hover:text-blue-400 transition-all duration-200 hover:bg-blue-50 dark:hover:bg-blue-950/50"
                >
                  <item.icon className="w-4 h-4 transition-transform duration-200 group-hover:scale-110" />
                  <span>{item.label}</span>
                </Link>
              ))}
            </nav>

            {/* Enhanced Search Bar */}
            <div className="hidden md:flex items-center space-x-4 flex-1 max-w-lg mx-8">
              <div className={cn(
                "relative flex-1 transition-all duration-300",
                isSearchFocused && "scale-105"
              )}>
                <Search className={cn(
                  "absolute left-4 top-1/2 transform -translate-y-1/2 h-4 w-4 transition-colors duration-200",
                  isSearchFocused ? "text-blue-500" : "text-gray-400"
                )} />
                <Input
                  placeholder="Discover amazing courses..."
                  className={cn(
                    "pl-12 pr-4 h-11 rounded-full border-gray-200 dark:border-gray-700 transition-all duration-200",
                    "focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:shadow-lg focus:shadow-blue-500/10",
                    "bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm"
                  )}
                  onFocus={() => setIsSearchFocused(true)}
                  onBlur={() => setIsSearchFocused(false)}
                  suppressHydrationWarning
                />
                <div className={cn(
                  "absolute right-3 top-1/2 transform -translate-y-1/2 text-xs text-gray-400 transition-opacity duration-200",
                  isSearchFocused ? "opacity-0" : "opacity-100"
                )}>
                  ⌘K
                </div>
              </div>
            </div>

            {/* Auth Buttons with enhanced styling */}
            <div className="hidden md:flex items-center space-x-3">
              <ThemeToggle />
              <Link href="/auth/sign-in">
                <Button 
                  variant="ghost" 
                  className="hover:bg-gray-100 dark:hover:bg-gray-800 transition-all duration-200"
                  suppressHydrationWarning
                >
                  Sign In
                </Button>
              </Link>
              <Link href="/auth/sign-up">
                <Button 
                  className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105"
                  suppressHydrationWarning
                >
                  Get Started
                </Button>
              </Link>
            </div>

            {/* Enhanced Mobile Menu Button */}
            <Button
              variant="ghost"
              size="sm"
              className="md:hidden relative p-2 transition-all duration-200 hover:bg-gray-100 dark:hover:bg-gray-800"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
            >
              <div className="w-5 h-5 relative">
                <Menu className={cn(
                  "absolute inset-0 transition-all duration-300",
                  isMenuOpen ? "rotate-90 opacity-0" : "rotate-0 opacity-100"
                )} />
                <X className={cn(
                  "absolute inset-0 transition-all duration-300",
                  isMenuOpen ? "rotate-0 opacity-100" : "-rotate-90 opacity-0"
                )} />
              </div>
            </Button>
          </div>

          {/* Enhanced Mobile Menu */}
          <div className={cn(
            "md:hidden overflow-hidden transition-all duration-300",
            isMenuOpen ? "max-h-96 opacity-100" : "max-h-0 opacity-0"
          )}>
            <div className="border-t border-gray-200/50 dark:border-gray-700/50 py-6 space-y-4">
              {/* Mobile Search */}
              <div className="relative">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search courses..."
                  className="pl-12 h-11 rounded-full bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700"
                />
              </div>

              {/* Mobile Navigation */}
              <div className="space-y-2">
                {navigationItems.map((item, index) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center space-x-3 px-4 py-3 rounded-xl text-gray-700 hover:text-blue-600 dark:text-gray-300 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/50 transition-all duration-200",
                      "transform translate-y-2 opacity-0 animate-in slide-in-from-top-2 fill-mode-forwards"
                    )}
                    style={{
                      animationDelay: `${(index + 1) * 50}ms`,
                      animationDuration: '300ms'
                    }}
                    onClick={() => setIsMenuOpen(false)}
                  >
                    <item.icon className="w-5 h-5" />
                    <span className="font-medium">{item.label}</span>
                  </Link>
                ))}
              </div>

              {/* Mobile Auth Buttons */}
              <div className="flex flex-col space-y-3 pt-4 border-t border-gray-200/50 dark:border-gray-700/50">
                <Link href="/auth/sign-in">
                  <Button 
                    variant="ghost" 
                    className="w-full justify-center h-12 text-base hover:bg-gray-100 dark:hover:bg-gray-800"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    Sign In
                  </Button>
                </Link>
                <Link href="/auth/sign-up">
                  <Button 
                    className="w-full h-12 text-base bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-lg"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    Get Started
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </header>
      
      {/* Spacer to prevent content from hiding behind fixed header */}
      <div className="h-16" />
    </>
  );
}
