/**
 * Sign In Page - Marketing Style Auth Page
 */

import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  ArrowRight, Eye, EyeOff, Loader2, Mail, Lock, Github, Chrome,
  CheckCircle2, Shield, Users
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { trackEvent } from '@/lib/web-analytics';

export default function SignInPage() {
  const navigate = useNavigate();
  const { signIn } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await signIn(formData.email, formData.password);
      trackEvent('login', { method: 'email' });
      toast.success('Welcome back!');
      navigate('/dashboard');
    } catch (error: any) {
      toast.error(error.message || 'Invalid email or password');
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = async () => {
    setLoading(true);
    try {
      await signIn('demo@qaone.com', 'demo123');
      toast.success('Welcome! Logged in with demo account.');
      navigate('/dashboard');
    } catch (error: any) {
      toast.error(error.message || 'Demo login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left Side - Form */}
      <div className="flex-1 flex flex-col justify-center px-8 lg:px-16 py-12 bg-white">
        <div className="w-full max-w-md mx-auto">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2.5 mb-8">
            <img src="/flowstral-logo.svg" alt="Flowstral" className="w-10 h-10 rounded-xl" />
            <span className="text-2xl font-bold text-slate-800">Flow<span className="text-indigo-600">stral</span></span>
          </Link>

          <h1 className="text-3xl font-bold text-slate-900 mb-2">Welcome back</h1>
          <p className="text-slate-600 mb-8">
            Sign in to your account to continue testing
          </p>


          {/* Sign In Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <Label htmlFor="email" className="text-slate-700">Email</Label>
              <div className="relative mt-1.5">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <Input
                  id="email"
                  type="email"
                  placeholder="you@company.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="pl-10 h-12 border-slate-200 focus:border-blue-500 focus:ring-blue-500"
                  required
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-slate-700">Password</Label>
                <Link to="/forgot-password" className="text-sm text-blue-600 hover:text-blue-700">
                  Forgot password?
                </Link>
              </div>
              <div className="relative mt-1.5">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="pl-10 pr-10 h-12 border-slate-200 focus:border-blue-500 focus:ring-blue-500"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Signing in...
                </>
              ) : (
                <>
                  Sign In
                  <ArrowRight className="w-4 h-4 ml-2" />
                </>
              )}
            </Button>
          </form>

          {/* Social Login */}
          <div className="mt-6 grid grid-cols-2 gap-3">
            <Button variant="outline" className="h-11 border-slate-200">
              <Github className="w-5 h-5 mr-2" />
              GitHub
            </Button>
            <Button variant="outline" className="h-11 border-slate-200">
              <Chrome className="w-5 h-5 mr-2" />
              Google
            </Button>
          </div>

          <p className="mt-8 text-center text-slate-600">
            Don't have an account?{' '}
            <Link to="/signup" className="text-blue-600 hover:text-blue-700 font-medium">
              Start free trial
            </Link>
          </p>
        </div>
      </div>

      {/* Right Side - Branding */}
      <div className="hidden lg:flex flex-1 bg-slate-900 p-12 flex-col justify-between">
        <div />

        <div className="text-white">
          <h2 className="text-4xl font-bold mb-6">
            No-code QA platform for modern teams
          </h2>
          <p className="text-xl text-slate-400 mb-10">
            Record, build, and execute tests without writing a single line of code.
          </p>

          <div className="space-y-4">
            {[
              { icon: CheckCircle2, text: 'Smart Trace with intelligent element recognition' },
              { icon: Shield, text: 'Enterprise-grade security & compliance' },
              { icon: Users, text: 'Built for QA teams of all sizes' },
            ].map((item, idx) => (
              <div key={idx} className="flex items-center gap-3 text-slate-300">
                <item.icon className="w-5 h-5 text-slate-500" />
                <span>{item.text}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-4 text-slate-500 text-sm">
          <Link to="/privacy" className="hover:text-white">Privacy</Link>
          <span>•</span>
          <Link to="/terms" className="hover:text-white">Terms</Link>
          <span>•</span>
          <Link to="/contact" className="hover:text-white">Contact</Link>
        </div>
      </div>
    </div>
  );
}

