/**
 * VerifyEmailPage — Handles email verification from the magic link.
 *
 * Reads `?token=xxx` from URL, calls `GET /api/auth/verify-email?token=xxx`,
 * and shows success or error state with a link to sign in.
 */

import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { apiClient } from '@/lib/api-client';

type VerifyState = 'loading' | 'success' | 'error';

export default function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [state, setState] = useState<VerifyState>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token) {
      setState('error');
      setMessage('No verification token found. Please check the link in your email.');
      return;
    }

    const verify = async () => {
      try {
        const response = await apiClient.get(`/api/auth/verify-email?token=${encodeURIComponent(token)}`);
        if (response.data?.status === 'verified') {
          setState('success');
          setMessage(response.data.message || 'Your email has been verified successfully!');
        } else {
          setState('error');
          setMessage('Verification failed. The token may be invalid or expired.');
        }
      } catch (error: any) {
        setState('error');
        const detail = error?.response?.data?.detail;
        setMessage(detail || 'Verification failed. The token may be invalid or expired.');
      }
    };

    verify();
  }, [token]);

  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-6">
      <div className="max-w-md w-full text-center">
        {/* Logo */}
        <Link to="/" className="inline-flex items-center gap-2.5 mb-12">
          <img src="/flowstral-logo.svg" alt="Flowstral" className="w-9 h-9 rounded-xl" />
          <span className="text-xl font-bold text-slate-800">Flow<span className="text-indigo-600">stral</span></span>
        </Link>

        {state === 'loading' && (
          <div className="py-12">
            <Loader2 className="w-12 h-12 text-indigo-500 animate-spin mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-slate-900 mb-2">Verifying your email...</h1>
            <p className="text-slate-500">This will only take a moment.</p>
          </div>
        )}

        {state === 'success' && (
          <div className="py-12">
            <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 className="w-10 h-10 text-emerald-600" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900 mb-2">Email Verified!</h1>
            <p className="text-slate-600 mb-8">{message}</p>
            <Link to="/signin?verified=true">
              <Button className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3 rounded-xl">
                Sign In to Your Account
              </Button>
            </Link>
          </div>
        )}

        {state === 'error' && (
          <div className="py-12">
            <div className="w-20 h-20 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-6">
              <XCircle className="w-10 h-10 text-red-600" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900 mb-2">Verification Failed</h1>
            <p className="text-slate-600 mb-8">{message}</p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link to="/signup">
                <Button variant="outline" className="px-6">
                  Sign Up Again
                </Button>
              </Link>
              <Link to="/signin">
                <Button className="bg-indigo-600 hover:bg-indigo-700 text-white px-6">
                  Go to Sign In
                </Button>
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
