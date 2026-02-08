/**
 * Welcome Page - Post-signup page with email verification and download options
 */

import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { 
  ArrowRight, Mail, Download, Monitor, Apple, CheckCircle2, 
  Rocket, Globe, RefreshCw, Clock, Shield, Zap, Chrome
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export default function WelcomePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { email, name } = location.state || { email: 'your email', name: 'there' };
  const [resendCooldown, setResendCooldown] = useState(0);
  
  // Auto-detect platform
  const detectPlatform = (): 'windows' | 'mac' | 'web' => {
    const ua = navigator.userAgent.toLowerCase();
    if (ua.includes('win')) return 'windows';
    if (ua.includes('mac')) return 'mac';
    return 'windows'; // Default to Windows
  };
  
  const [selectedPlatform, setSelectedPlatform] = useState<'windows' | 'mac' | 'web'>(detectPlatform());

  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  const handleResendEmail = () => {
    setResendCooldown(60);
    // TODO: Call API to resend verification email
  };

  // Download URLs - GitHub Releases (use /latest/download/ with exact artifact names from electron-builder)
  const DOWNLOAD_BASE = 'https://github.com/maddynolan/QAOne/releases/latest/download';
  
  const platforms = {
    windows: {
      name: 'Windows',
      icon: Monitor,
      size: '~79 MB',
      url: `${DOWNLOAD_BASE}/Flowstral-Setup.exe`,
      filename: 'Flowstral-Setup.exe',
    },
    mac: {
      name: 'macOS',
      icon: Apple,
      size: 'Coming Soon',
      url: '#',
      filename: '',
    },
    web: {
      name: 'Web App',
      icon: Globe,
      size: 'No download',
      url: '/dashboard',
      filename: '',
    },
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 via-white to-blue-50">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-sm border-b border-slate-200/50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
              <span className="text-white font-bold text-lg">F</span>
            </div>
            <span className="text-xl font-bold text-slate-800">Flowstral</span>
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="pt-32 pb-20 px-6">
        <div className="max-w-3xl mx-auto">
          {/* Success Badge */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-emerald-100 mb-6">
              <CheckCircle2 className="w-10 h-10 text-emerald-600" />
            </div>
            <h1 className="text-3xl lg:text-4xl font-bold text-slate-900 mb-3">
              Welcome to Flowstral, {name?.split(' ')[0] || 'there'}! 🎉
            </h1>
            <p className="text-lg text-slate-600">
              Your account has been created successfully.
            </p>
          </div>

          {/* Email Verification Card */}
          <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-6 mb-8">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
                <Mail className="w-6 h-6 text-blue-600" />
              </div>
              <div className="flex-1">
                <h2 className="text-lg font-semibold text-slate-900 mb-1">
                  Verify your email
                </h2>
                <p className="text-slate-600 mb-4">
                  We've sent a verification link to <strong>{email}</strong>. 
                  Please check your inbox and click the link to activate your account.
                </p>
                <div className="flex flex-wrap items-center gap-3">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={handleResendEmail}
                    disabled={resendCooldown > 0}
                    className="border-slate-200"
                  >
                    {resendCooldown > 0 ? (
                      <>
                        <Clock className="w-4 h-4 mr-1" />
                        Resend in {resendCooldown}s
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-4 h-4 mr-1" />
                        Resend email
                      </>
                    )}
                  </Button>
                  <span className="text-sm text-slate-500">
                    Didn't receive it? Check your spam folder.
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Choose Your Platform */}
          <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-8 mb-8">
            <h2 className="text-xl font-bold text-slate-900 mb-2 text-center">
              Choose How to Get Started
            </h2>
            <p className="text-slate-600 text-center mb-8">
              Download the desktop app for the best experience, or use the web app.
            </p>

            {/* Platform Selection */}
            <div className="grid md:grid-cols-3 gap-4 mb-8">
              {(Object.entries(platforms) as [keyof typeof platforms, typeof platforms[keyof typeof platforms]][]).map(([key, platform]) => (
                <button
                  key={key}
                  onClick={() => setSelectedPlatform(key)}
                  className={cn(
                    "relative p-6 rounded-xl border-2 transition-all text-center",
                    selectedPlatform === key
                      ? "border-blue-500 bg-blue-50"
                      : "border-slate-200 bg-white hover:border-slate-300"
                  )}
                >
                  {key === 'windows' && (
                    <Badge className="absolute -top-2 left-1/2 -translate-x-1/2 bg-emerald-500 text-white text-[10px] px-2">
                      Recommended
                    </Badge>
                  )}
                  <platform.icon className={cn(
                    "w-10 h-10 mx-auto mb-3",
                    selectedPlatform === key ? "text-blue-600" : "text-slate-400"
                  )} />
                  <h3 className={cn(
                    "font-semibold mb-1",
                    selectedPlatform === key ? "text-blue-700" : "text-slate-700"
                  )}>
                    {platform.name}
                  </h3>
                  <p className="text-sm text-slate-500">{platform.size}</p>
                </button>
              ))}
            </div>

            {/* Download/Launch Button */}
            {selectedPlatform === 'web' ? (
              <Button
                size="lg"
                onClick={() => navigate('/dashboard')}
                className="w-full h-14 bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-700 hover:to-violet-700 text-white font-semibold rounded-xl shadow-lg shadow-blue-500/20"
              >
                <Globe className="w-5 h-5 mr-2" />
                Launch Web App
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            ) : (
              <Button
                size="lg"
                onClick={() => {
                  // Trigger download
                  window.location.href = platforms[selectedPlatform].url;
                }}
                className="w-full h-14 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-semibold rounded-xl shadow-lg shadow-emerald-500/20"
              >
                <Download className="w-5 h-5 mr-2" />
                Download for {platforms[selectedPlatform].name}
              </Button>
            )}

            <p className="text-center text-sm text-slate-500 mt-4">
              {selectedPlatform !== 'web' && (
                <>
                  After downloading, install and sign in with <strong>{email}</strong>
                </>
              )}
            </p>
          </div>

          {/* License Key Section */}
          <div className="bg-white rounded-2xl shadow-lg border border-amber-200 p-6 mb-8">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
                <Shield className="w-6 h-6 text-amber-600" />
              </div>
              <div className="flex-1">
                <h2 className="text-lg font-semibold text-slate-900 mb-1">
                  License Key Activation
                </h2>
                <p className="text-slate-600 mb-4">
                  After installing the desktop app, you'll need to enter your license key:
                </p>
                <ol className="text-sm text-slate-600 space-y-2 mb-4">
                  <li className="flex items-start gap-2">
                    <span className="w-5 h-5 rounded-full bg-amber-100 text-amber-700 text-xs flex items-center justify-center flex-shrink-0 mt-0.5">1</span>
                    <span>Open the Flowstral Desktop app</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="w-5 h-5 rounded-full bg-amber-100 text-amber-700 text-xs flex items-center justify-center flex-shrink-0 mt-0.5">2</span>
                    <span>Go to <strong>Settings</strong> → <strong>License</strong></span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="w-5 h-5 rounded-full bg-amber-100 text-amber-700 text-xs flex items-center justify-center flex-shrink-0 mt-0.5">3</span>
                    <span>Enter your license key and click <strong>Activate</strong></span>
                  </li>
                </ol>
                <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
                  <p className="text-sm text-amber-800">
                    <strong>Trial users:</strong> Your license key will be sent to your email, or contact your administrator.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Browser Extension */}
          <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-6 mb-8">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-violet-100 flex items-center justify-center flex-shrink-0">
                <Chrome className="w-6 h-6 text-violet-600" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h2 className="text-lg font-semibold text-slate-900">
                    Browser Extension
                  </h2>
                  <Badge className="bg-violet-100 text-violet-700 border-0 text-xs">Optional</Badge>
                </div>
                <p className="text-slate-600 mb-4">
                  Install the Chrome extension for quick recording directly in your browser without the desktop app.
                </p>
                <Button
                  variant="outline"
                  className="border-violet-200 text-violet-700 hover:bg-violet-50"
                  onClick={() => window.open('https://chrome.google.com/webstore/detail/flowstral', '_blank')}
                >
                  <Chrome className="w-4 h-4 mr-2" />
                  Add to Chrome
                </Button>
              </div>
            </div>
          </div>

          {/* Quick Start Steps */}
          <div className="bg-gradient-to-r from-slate-900 to-slate-800 rounded-2xl p-8 text-white">
            <h2 className="text-xl font-bold mb-6 text-center">Get Started in 4 Easy Steps</h2>
            <div className="grid md:grid-cols-4 gap-6">
              {[
                {
                  step: 1,
                  icon: Mail,
                  title: 'Verify Email',
                  description: 'Click the link we sent to activate your account',
                },
                {
                  step: 2,
                  icon: Download,
                  title: 'Download & Install',
                  description: 'Install the desktop app or use the web version',
                },
                {
                  step: 3,
                  icon: Shield,
                  title: 'Enter License',
                  description: 'Activate with your license key in Settings',
                },
                {
                  step: 4,
                  icon: Rocket,
                  title: 'Start Testing',
                  description: 'Click Record and capture your first test!',
                },
              ].map((item) => (
                <div key={item.step} className="text-center">
                  <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center mx-auto mb-3">
                    <item.icon className="w-6 h-6 text-emerald-400" />
                  </div>
                  <div className="text-emerald-400 text-sm font-bold mb-1">Step {item.step}</div>
                  <h3 className="font-semibold mb-1">{item.title}</h3>
                  <p className="text-sm text-slate-400">{item.description}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Skip for now link */}
          <div className="text-center mt-8">
            <button
              onClick={() => navigate('/dashboard')}
              className="text-slate-500 hover:text-slate-700 text-sm underline"
            >
              Skip for now and go to dashboard →
            </button>
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
        <p className="text-xs text-slate-400 mt-2">© 2025 Flowstral Inc. All rights reserved.</p>
      </footer>
    </div>
  );
}

