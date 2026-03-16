/**
 * Download Page - Redirects to Signup (Download only available after account creation)
 */

import React, { useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { trackCTAClick, trackDownload } from '@/lib/web-analytics';
import {
  ArrowRight, Download, Monitor, Apple, Shield, Zap,
  Lock, UserPlus, CheckCircle2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export default function DownloadPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-sm border-b border-slate-200/50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5">
            <img src="/flowstral-logo.svg" alt="Flowstral" className="w-9 h-9 rounded-xl" />
            <span className="text-xl font-bold text-slate-900">Flow<span className="text-indigo-600">stral</span></span>
          </Link>
          <div className="flex items-center gap-3">
            <Button variant="ghost" className="text-slate-600 hover:text-slate-900 font-medium" onClick={() => { trackCTAClick('sign_in', '/download'); navigate('/signin'); }}>
              Sign In
            </Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => { trackCTAClick('start_free', '/download'); navigate('/signup'); }}>
              Start Free <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="pt-32 pb-20 px-6">
        <div className="max-w-3xl mx-auto text-center">
          {/* Icon */}
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-blue-100 mb-6">
            <Download className="w-10 h-10 text-blue-600" />
          </div>

          <Badge className="mb-4 bg-blue-100 text-blue-700 border-0 px-4 py-1.5">
            Desktop App
          </Badge>

          <h1 className="text-4xl lg:text-5xl font-bold text-slate-900 mb-4">
            Download Flowstral Desktop
          </h1>
          
          <p className="text-xl text-slate-600 mb-8 max-w-2xl mx-auto">
            Create your free account to download the desktop app. 
            Start testing in minutes with our one-click installer.
          </p>

          {/* Sign Up CTA */}
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-8 mb-8 max-w-md mx-auto">
            <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
              <UserPlus className="w-8 h-8 text-emerald-600" />
            </div>
            
            <h2 className="text-2xl font-bold text-slate-900 mb-2">
              Create Your Account
            </h2>
            <p className="text-slate-600 mb-6">
              Sign up to get instant access to download the installer
            </p>

            <Button
              size="lg"
              onClick={() => { trackCTAClick('create_account_download', '/download'); navigate('/signup'); }}
              className="w-full h-14 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl"
            >
              Create Free Account
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>

            <p className="text-sm text-slate-500 mt-4">
              Already have an account?{' '}
              <button 
                onClick={() => navigate('/signin')} 
                className="text-blue-600 hover:underline font-medium"
              >
                Sign in to download
              </button>
            </p>
          </div>

          {/* Why Sign Up First */}
          <div className="grid md:grid-cols-3 gap-6 mb-12">
            {[
              {
                icon: Shield,
                title: 'Secure License',
                description: 'Your download is tied to your account for security',
              },
              {
                icon: Zap,
                title: 'Instant Access',
                description: 'Download immediately after creating your account',
              },
              {
                icon: CheckCircle2,
                title: 'All Features',
                description: '14-day free trial with full access to all features',
              },
            ].map((item, idx) => (
              <div key={idx} className="p-6 bg-slate-50 rounded-xl border border-slate-200">
                <item.icon className="w-8 h-8 text-blue-600 mx-auto mb-3" />
                <h3 className="font-semibold text-slate-900 mb-1">{item.title}</h3>
                <p className="text-sm text-slate-600">{item.description}</p>
              </div>
            ))}
          </div>

          {/* Platform Preview */}
          <div className="bg-slate-900 rounded-2xl p-8 text-white">
            <h3 className="text-xl font-bold mb-6">Desktop App</h3>
            <div className="flex justify-center gap-8">
              {[
                { icon: Monitor, name: 'Windows', size: '~80 MB', available: true },
                { icon: Apple, name: 'macOS', size: 'Coming Soon', available: false },
                { icon: Monitor, name: 'Linux', size: 'Coming Soon', available: false },
              ].map((platform, idx) => (
                <div key={idx} className={cn("text-center", !platform.available && "opacity-50")}>
                  <div className="w-16 h-16 rounded-xl bg-white/10 flex items-center justify-center mx-auto mb-3">
                    <platform.icon className="w-8 h-8 text-white" />
                  </div>
                  <div className="font-medium">{platform.name}</div>
                  <div className="text-sm text-slate-400">{platform.size}</div>
                </div>
              ))}
            </div>
            <p className="text-slate-400 text-sm mt-6">
              One-click installer • No dependencies • Chromium included
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-8 px-6 border-t border-slate-200 text-center">
        <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-slate-500">
          <Link to="/privacy" className="hover:text-slate-700">Privacy</Link>
          <span>•</span>
          <Link to="/terms" className="hover:text-slate-700">Terms</Link>
          <span>•</span>
          <Link to="/contact" className="hover:text-slate-700">Support</Link>
        </div>
        <p className="text-xs text-slate-400 mt-2">© {new Date().getFullYear()} Flowstral Inc. All rights reserved.</p>
      </footer>
    </div>
  );
}
