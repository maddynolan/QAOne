/**
 * MarketingHeader — shared responsive header for all marketing/public pages.
 *
 * Features:
 * - Scroll-aware backdrop blur + shadow
 * - Desktop: horizontal nav with active-page highlighting
 * - Mobile: hamburger icon → slide-out sidebar with nav + CTAs
 * - Auto-closes sidebar on route change
 */

import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { trackCTAClick } from '@/lib/web-analytics';
import { Menu, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const navLinks = [
  { label: 'Features', href: '/#features', matchPath: '/', exactMatch: true },
  { label: 'Pricing', href: '/pricing', matchPath: '/pricing' },
  { label: 'Compare', href: '/compare/katalon', matchPath: '/compare' },
  { label: 'Blog', href: '/blog', matchPath: '/blog' },
  { label: 'Download', href: '/download', matchPath: '/download' },
  { label: 'About', href: '/about', matchPath: '/about' },
];

export function MarketingHeader() {
  const navigate = useNavigate();
  const location = useLocation();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  // Prevent body scroll when mobile menu is open
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [mobileOpen]);

  const isActive = (link: typeof navLinks[0]) => {
    if (link.exactMatch) return location.pathname === link.matchPath;
    return location.pathname.startsWith(link.matchPath);
  };

  return (
    <>
      <header className={cn(
        "fixed top-0 left-0 right-0 z-50 transition-all duration-300",
        scrolled
          ? "bg-white/95 backdrop-blur-md shadow-sm border-b border-slate-200/50"
          : "bg-white/80 backdrop-blur-sm"
      )}>
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-8">
            <Link to="/" className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-slate-900 flex items-center justify-center">
                <span className="text-white font-bold text-sm">F</span>
              </div>
              <span className="text-lg font-bold text-slate-900">Flowstral</span>
            </Link>
            {/* Desktop nav */}
            <nav className="hidden md:flex items-center gap-6">
              {navLinks.map(link => (
                <Link
                  key={link.matchPath}
                  to={link.href}
                  className={cn(
                    "text-sm transition-colors font-medium",
                    isActive(link)
                      ? "text-emerald-600 font-semibold"
                      : "text-slate-600 hover:text-slate-900"
                  )}
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>

          {/* Desktop CTAs + Mobile hamburger */}
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              className="hidden md:inline-flex text-slate-600 hover:text-slate-900"
              onClick={() => { trackCTAClick('sign_in', location.pathname); navigate('/signin'); }}
            >
              Sign In
            </Button>
            <Button
              className="hidden md:inline-flex bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={() => { trackCTAClick('start_free', location.pathname); navigate('/signup'); }}
            >
              Start Free
            </Button>
            {/* Hamburger — mobile only */}
            <button
              className="md:hidden p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
              onClick={() => setMobileOpen(v => !v)}
              aria-label="Toggle menu"
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile slide-out sidebar */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/20 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          {/* Sidebar panel */}
          <div className="absolute right-0 top-0 h-full w-72 bg-white shadow-xl animate-in slide-in-from-right duration-200">
            <div className="pt-20 px-6 space-y-1">
              {navLinks.map(link => (
                <Link
                  key={link.matchPath}
                  to={link.href}
                  className={cn(
                    "block px-4 py-3 rounded-lg text-sm font-medium transition-colors",
                    isActive(link)
                      ? "bg-emerald-50 text-emerald-700"
                      : "text-slate-700 hover:bg-slate-50"
                  )}
                  onClick={() => setMobileOpen(false)}
                >
                  {link.label}
                </Link>
              ))}
              <div className="pt-4 border-t border-slate-200 mt-4 space-y-2">
                <Button
                  variant="outline"
                  className="w-full justify-center"
                  onClick={() => { trackCTAClick('sign_in', location.pathname); navigate('/signin'); setMobileOpen(false); }}
                >
                  Sign In
                </Button>
                <Button
                  className="w-full justify-center bg-emerald-600 hover:bg-emerald-700 text-white"
                  onClick={() => { trackCTAClick('start_free', location.pathname); navigate('/signup'); setMobileOpen(false); }}
                >
                  Start Free
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
