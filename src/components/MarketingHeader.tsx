/**
 * Shared Marketing Header component
 *
 * Used across all marketing pages for consistent navigation.
 * Fixed header with scroll-aware background transition.
 * Includes mobile hamburger menu.
 */

import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowRight, Menu, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function MarketingHeader() {
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close mobile menu on navigation
  const handleNavClick = (path: string) => {
    setMobileMenuOpen(false);
    navigate(path);
  };

  const navLinks = [
    { label: 'Features', href: '/#features' },
    { label: 'Pricing', href: '/pricing' },
    { label: 'Compare', href: '/compare/katalon' },
    { label: 'Blog', href: '/blog' },
    { label: 'About', href: '/about' },
  ];

  return (
    <header className={cn(
      "fixed top-0 left-0 right-0 z-50 transition-all duration-300",
      scrolled ? "bg-white/95 backdrop-blur-md shadow-sm border-b border-slate-200/50" : "bg-white/80 backdrop-blur-sm"
    )}>
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <Link to="/" className="flex items-center gap-2.5">
            <img src="/flowstral-logo.svg" alt="Flowstral" className="w-9 h-9 rounded-xl" />
            <span className="text-xl font-bold text-slate-900">Flow<span className="text-indigo-600">stral</span></span>
          </Link>
          <nav className="hidden md:flex items-center gap-6">
            {navLinks.map((link) => (
              <Link key={link.href} to={link.href} className="text-sm text-slate-600 hover:text-slate-900 transition-colors font-medium">
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="hidden md:flex items-center gap-3">
          <Button variant="ghost" className="text-slate-600 hover:text-slate-900 font-medium" onClick={() => navigate('/signin')}>
            Sign In
          </Button>
          <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => navigate('/signup')}>
            Start Free <ArrowRight className="w-4 h-4 ml-1" />
          </Button>
        </div>

        {/* Mobile hamburger button */}
        <button
          className="md:hidden p-2 rounded-lg hover:bg-slate-100 transition-colors"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
        >
          {mobileMenuOpen ? <X className="w-6 h-6 text-slate-700" /> : <Menu className="w-6 h-6 text-slate-700" />}
        </button>
      </div>

      {/* Mobile menu dropdown */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-white border-t border-slate-200 shadow-lg">
          <nav className="max-w-7xl mx-auto px-6 py-4 space-y-1">
            {navLinks.map((link) => (
              <button
                key={link.href}
                onClick={() => handleNavClick(link.href)}
                className="block w-full text-left px-3 py-2.5 text-sm text-slate-700 hover:bg-slate-50 rounded-lg font-medium transition-colors"
              >
                {link.label}
              </button>
            ))}
            <div className="pt-3 border-t border-slate-100 space-y-2">
              <Button
                variant="outline"
                className="w-full justify-center border-slate-300 text-slate-700"
                onClick={() => handleNavClick('/signin')}
              >
                Sign In
              </Button>
              <Button
                className="w-full justify-center bg-emerald-600 hover:bg-emerald-700 text-white"
                onClick={() => handleNavClick('/signup')}
              >
                Start Free <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
