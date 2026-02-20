/**
 * Sign Up Page - Marketing Style Registration Page
 */

import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  ArrowRight, Eye, EyeOff, Loader2, Mail, Lock, User, Github, Chrome,
  CheckCircle2, Zap, Shield, Rocket, AlertCircle, Building2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { validateBusinessEmail, isPersonalEmail, getEmailDomain } from '@/lib/email-validator';
import { captureSignupLead } from '@/lib/leads-service';
import { trackSignup } from '@/lib/web-analytics';

export default function SignUpPage() {
  const navigate = useNavigate();
  const { signUp } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    company: '',
  });

  // Validate email as user types (debounced)
  useEffect(() => {
    if (!formData.email) {
      setEmailError(null);
      return;
    }
    
    const timer = setTimeout(() => {
      const validation = validateBusinessEmail(formData.email);
      if (!validation.isValid && formData.email.includes('@')) {
        setEmailError(validation.error || null);
      } else {
        setEmailError(null);
      }
    }, 500);
    
    return () => clearTimeout(timer);
  }, [formData.email]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate business email
    const emailValidation = validateBusinessEmail(formData.email);
    if (!emailValidation.isValid) {
      setEmailError(emailValidation.error || 'Invalid email');
      toast.error(emailValidation.error || 'Please use your work email');
      return;
    }
    
    setLoading(true);

    try {
      // Capture lead for sales tracking (non-blocking)
      captureSignupLead(formData.email, formData.name, formData.company)
        .then(result => {
          if (result.success) {
            console.log('[Signup] Lead captured:', result.lead_id);
          }
        })
        .catch(() => {}); // Silent fail - don't block signup
      
      await signUp(formData.email, formData.password, formData.name);
      trackSignup('email');
      toast.success('Account created! Check your email to verify.');
      // Navigate to welcome page instead of dashboard
      navigate('/welcome', { state: { email: formData.email, name: formData.name } });
    } catch (error: any) {
      toast.error(error.message || 'Failed to create account');
    } finally {
      setLoading(false);
    }
  };

  const passwordStrength = (password: string) => {
    let strength = 0;
    if (password.length >= 8) strength++;
    if (/[A-Z]/.test(password)) strength++;
    if (/[0-9]/.test(password)) strength++;
    if (/[^A-Za-z0-9]/.test(password)) strength++;
    return strength;
  };

  const strength = passwordStrength(formData.password);

  return (
    <div className="min-h-screen flex">
      {/* Left Side - Branding */}
      <div className="hidden lg:flex flex-1 bg-gradient-to-br from-emerald-600 via-teal-600 to-cyan-700 p-12 flex-col justify-between">
        <div />
        
        <div className="text-white">
          <h2 className="text-4xl font-bold mb-6">
            Start Your Free 14-Day Trial
          </h2>
          <p className="text-xl text-emerald-100 mb-10">
            Full access to all features. No credit card required.
          </p>
          
          <div className="space-y-4">
            {[
              { icon: Rocket, text: 'Get started in under 2 minutes' },
              { icon: CheckCircle2, text: 'Unlimited test cases during trial' },
              { icon: Shield, text: 'Your data is secure & encrypted' },
              { icon: Zap, text: 'Cancel anytime, no questions asked' },
            ].map((item, idx) => (
              <div key={idx} className="flex items-center gap-3 text-emerald-100">
                <item.icon className="w-5 h-5 text-emerald-300" />
                <span>{item.text}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-4 text-emerald-200 text-sm">
          <Link to="/privacy" className="hover:text-white">Privacy</Link>
          <span>•</span>
          <Link to="/terms" className="hover:text-white">Terms</Link>
          <span>•</span>
          <Link to="/contact" className="hover:text-white">Contact</Link>
        </div>
      </div>

      {/* Right Side - Form */}
      <div className="flex-1 flex flex-col justify-center px-8 lg:px-16 py-12 bg-white">
        <div className="w-full max-w-md mx-auto">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2.5 mb-8">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
              <span className="text-white font-bold text-xl">F</span>
            </div>
            <span className="text-2xl font-bold text-slate-800">Flowstral</span>
          </Link>

          <h1 className="text-3xl font-bold text-slate-900 mb-2">Create your account</h1>
          <p className="text-slate-600 mb-8">
            Start your free trial - no credit card required
          </p>

          {/* Social Sign Up */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            <Button variant="outline" className="h-11 border-slate-200">
              <Github className="w-5 h-5 mr-2" />
              GitHub
            </Button>
            <Button variant="outline" className="h-11 border-slate-200">
              <Chrome className="w-5 h-5 mr-2" />
              Google
            </Button>
          </div>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-white text-slate-500">or continue with email</span>
            </div>
          </div>

          {/* Sign Up Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="name" className="text-slate-700">Full Name</Label>
                <div className="relative mt-1.5">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <Input
                    id="name"
                    type="text"
                    placeholder="John Doe"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="pl-10 h-11 border-slate-200 focus:border-blue-500 focus:ring-blue-500"
                    required
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="company" className="text-slate-700">Company</Label>
                <Input
                  id="company"
                  type="text"
                  placeholder="Acme Inc"
                  value={formData.company}
                  onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                  className="mt-1.5 h-11 border-slate-200 focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="email" className="text-slate-700">Work Email</Label>
              <div className="relative mt-1.5">
                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <Input
                  id="email"
                  type="email"
                  placeholder="you@company.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className={cn(
                    "pl-10 h-11 border-slate-200 focus:border-blue-500 focus:ring-blue-500",
                    emailError && "border-red-500 focus:border-red-500 focus:ring-red-500"
                  )}
                  required
                />
              </div>
              {emailError && (
                <div className="mt-1.5 flex items-center gap-1.5 text-red-600 text-sm">
                  <AlertCircle className="w-4 h-4" />
                  <span>{emailError}</span>
                </div>
              )}
              <p className="mt-1 text-xs text-slate-500">
                Please use your work email. Personal emails (Gmail, Yahoo, etc.) are not accepted.
              </p>
            </div>

            <div>
              <Label htmlFor="password" className="text-slate-700">Password</Label>
              <div className="relative mt-1.5">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Create a strong password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="pl-10 pr-10 h-11 border-slate-200 focus:border-blue-500 focus:ring-blue-500"
                  required
                  minLength={8}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              {/* Password Strength Indicator */}
              {formData.password && (
                <div className="mt-2">
                  <div className="flex gap-1">
                    {[1, 2, 3, 4].map((level) => (
                      <div
                        key={level}
                        className={cn(
                          "h-1 flex-1 rounded-full transition-colors",
                          strength >= level
                            ? strength <= 1 ? "bg-red-500"
                              : strength <= 2 ? "bg-amber-500"
                              : strength <= 3 ? "bg-blue-500"
                              : "bg-emerald-500"
                            : "bg-slate-200"
                        )}
                      />
                    ))}
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    {strength <= 1 && "Weak - add more characters"}
                    {strength === 2 && "Fair - add numbers or symbols"}
                    {strength === 3 && "Good - almost there"}
                    {strength === 4 && "Strong password!"}
                  </p>
                </div>
              )}
            </div>

            <div className="flex items-start gap-2 pt-2">
              <input
                type="checkbox"
                id="terms"
                required
                className="mt-1 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <label htmlFor="terms" className="text-sm text-slate-600">
                I agree to the{' '}
                <Link to="/terms" className="text-blue-600 hover:underline">Terms of Service</Link>
                {' '}and{' '}
                <Link to="/privacy" className="text-blue-600 hover:underline">Privacy Policy</Link>
              </label>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-12 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-semibold rounded-xl shadow-lg shadow-emerald-500/20 mt-4"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Creating account...
                </>
              ) : (
                <>
                  Start Free Trial
                  <ArrowRight className="w-4 h-4 ml-2" />
                </>
              )}
            </Button>
          </form>

          <p className="mt-8 text-center text-slate-600">
            Already have an account?{' '}
            <Link to="/signin" className="text-blue-600 hover:text-blue-700 font-medium">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

