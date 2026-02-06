/**
 * License Admin Dashboard
 * 
 * Admin-only page for managing licenses.
 * Access restricted to authorized admin emails (e.g., sales@flowstral.com)
 */

import React, { useState, useEffect, useCallback } from 'react';
import { 
  Key, Shield, AlertTriangle, CheckCircle, XCircle, 
  RefreshCw, Copy, Download, Plus, Trash2, Users,
  Calendar, Clock, Building, Mail, Lock
} from 'lucide-react';

interface License {
  key: string;
  type: string;
  email?: string;
  company?: string;
  expiresAt: string;
  daysLeft: number;
  isExpired: boolean;
  isExpiringSoon: boolean;
  status: 'active' | 'expiring_soon' | 'expired';
  maxActivations: number;
  currentActivations: number;
  activations: Array<{
    deviceId: string;
    deviceName?: string;
    activatedAt: string;
  }>;
  createdAt: string;
  createdBy?: string;
}

interface LicenseStats {
  totalLicenses: number;
  totalActivations: number;
  byType: Record<string, number>;
  byStatus: {
    active: number;
    expiring_soon: number;
    expired: number;
  };
}

interface GeneratedLicense {
  key: string;
  type: string;
  expiresAt: string;
  validDays: number;
  maxActivations: number;
}

const API_BASE = import.meta.env.VITE_API_URL || 'https://qaone-production.up.railway.app/api';

export default function LicenseAdminPage() {
  // Auth state
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [adminEmail, setAdminEmail] = useState('');
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [token, setToken] = useState<string | null>(null);
  
  // Dashboard state
  const [licenses, setLicenses] = useState<License[]>([]);
  const [stats, setStats] = useState<LicenseStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Generator state
  const [showGenerator, setShowGenerator] = useState(false);
  const [genType, setGenType] = useState('trial');
  const [genCount, setGenCount] = useState(1);
  const [genDays, setGenDays] = useState(14);
  const [genMaxActivations, setGenMaxActivations] = useState(1);
  const [genEmail, setGenEmail] = useState('');
  const [genCompany, setGenCompany] = useState('');
  const [generatedKeys, setGeneratedKeys] = useState<GeneratedLicense[]>([]);
  const [generating, setGenerating] = useState(false);

  // Check for stored token on mount
  useEffect(() => {
    const storedToken = localStorage.getItem('flowstral_admin_token');
    const storedEmail = localStorage.getItem('flowstral_admin_email');
    if (storedToken && storedEmail) {
      setToken(storedToken);
      setAdminEmail(storedEmail);
      setIsAuthenticated(true);
    }
  }, []);

  // Fetch data when authenticated
  useEffect(() => {
    if (isAuthenticated && token) {
      fetchLicenses();
      fetchStats();
    }
  }, [isAuthenticated, token]);

  const authHeaders = useCallback(() => ({
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }), [token]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    
    try {
      const response = await fetch(
        `${API_BASE}/license/admin/login?email=${encodeURIComponent(loginEmail)}&password=${encodeURIComponent(loginPassword)}`,
        { method: 'POST' }
      );
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.detail || 'Login failed');
      }
      
      // Store token and email
      localStorage.setItem('flowstral_admin_token', data.token);
      localStorage.setItem('flowstral_admin_email', data.email);
      
      setToken(data.token);
      setAdminEmail(data.email);
      setIsAuthenticated(true);
      setLoginPassword('');
    } catch (err: any) {
      setLoginError(err.message || 'Login failed');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('flowstral_admin_token');
    localStorage.removeItem('flowstral_admin_email');
    setToken(null);
    setAdminEmail('');
    setIsAuthenticated(false);
    setLicenses([]);
    setStats(null);
  };

  const fetchLicenses = async () => {
    setLoading(true);
    setError('');
    
    try {
      const response = await fetch(`${API_BASE}/license/admin/list`, {
        headers: authHeaders()
      });
      
      if (!response.ok) {
        if (response.status === 401) {
          handleLogout();
          return;
        }
        throw new Error('Failed to fetch licenses');
      }
      
      const data = await response.json();
      setLicenses(data.licenses || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await fetch(`${API_BASE}/license/admin/stats`, {
        headers: authHeaders()
      });
      
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    }
  };

  const handleGenerate = async () => {
    setGenerating(true);
    setGeneratedKeys([]);
    
    try {
      const params = new URLSearchParams({
        license_type: genType,
        count: genCount.toString(),
        days: genDays.toString(),
        max_activations: genMaxActivations.toString(),
        ...(genEmail && { email: genEmail }),
        ...(genCompany && { company: genCompany })
      });
      
      const response = await fetch(`${API_BASE}/license/admin/generate?${params}`, {
        method: 'POST',
        headers: authHeaders()
      });
      
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.detail || 'Generation failed');
      }
      
      const data = await response.json();
      setGeneratedKeys(data.licenses || []);
      
      // Refresh the list
      fetchLicenses();
      fetchStats();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setGenerating(false);
    }
  };

  const handleRevoke = async (licenseKey: string) => {
    if (!confirm('Are you sure you want to revoke this license? This cannot be undone.')) {
      return;
    }
    
    try {
      const response = await fetch(`${API_BASE}/license/admin/revoke/${encodeURIComponent(licenseKey)}`, {
        method: 'DELETE',
        headers: authHeaders()
      });
      
      if (!response.ok) {
        throw new Error('Failed to revoke license');
      }
      
      // Refresh
      fetchLicenses();
      fetchStats();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const exportAsCSV = () => {
    const headers = ['License Key', 'Type', 'Expires At', 'Days Left', 'Status', 'Activations', 'Email', 'Company'];
    const rows = licenses.map(l => [
      l.key,
      l.type,
      l.expiresAt,
      l.daysLeft.toString(),
      l.status,
      `${l.currentActivations}/${l.maxActivations}`,
      l.email || '',
      l.company || ''
    ]);
    
    const csv = [headers.join(','), ...rows.map(r => r.map(c => `"${c}"`).join(','))].join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `flowstral-licenses-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-700 flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Active</span>;
      case 'expiring_soon':
        return <span className="px-2 py-1 text-xs font-medium rounded-full bg-yellow-100 text-yellow-700 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Expiring Soon</span>;
      case 'expired':
        return <span className="px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-700 flex items-center gap-1"><XCircle className="w-3 h-3" /> Expired</span>;
      default:
        return null;
    }
  };

  const getTypeBadge = (type: string) => {
    const colors: Record<string, string> = {
      trial: 'bg-gray-100 text-gray-700',
      professional: 'bg-blue-100 text-blue-700',
      enterprise: 'bg-purple-100 text-purple-700',
      unlimited: 'bg-amber-100 text-amber-700'
    };
    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${colors[type] || colors.trial}`}>
        {type.charAt(0).toUpperCase() + type.slice(1)}
      </span>
    );
  };

  // Login Screen
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-xl shadow-lg p-8">
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Shield className="w-8 h-8 text-indigo-600" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900">License Admin</h1>
              <p className="text-gray-500 mt-2">Sign in to manage licenses</p>
            </div>
            
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Admin Email
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="email"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="sales@flowstral.com"
                    required
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="password"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="••••••••"
                    required
                  />
                </div>
              </div>
              
              {loginError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                  {loginError}
                </div>
              )}
              
              <button
                type="submit"
                className="w-full py-2 px-4 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-colors"
              >
                Sign In
              </button>
            </form>
            
            <p className="text-center text-xs text-gray-400 mt-6">
              Only authorized admin emails can access this dashboard.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Admin Dashboard
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
                <Key className="w-5 h-5 text-indigo-600" />
              </div>
              <div>
                <h1 className="font-semibold text-gray-900">License Admin</h1>
                <p className="text-xs text-gray-500">{adminEmail}</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <button
                onClick={() => { fetchLicenses(); fetchStats(); }}
                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
                title="Refresh"
              >
                <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
              </button>
              <button
                onClick={exportAsCSV}
                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
                title="Export CSV"
              >
                <Download className="w-5 h-5" />
              </button>
              <button
                onClick={handleLogout}
                className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 border rounded-lg hover:bg-gray-50"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </div>
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-white rounded-xl p-4 shadow-sm border">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
                  <Key className="w-5 h-5 text-indigo-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{stats.totalLicenses}</p>
                  <p className="text-sm text-gray-500">Total Licenses</p>
                </div>
              </div>
            </div>
            
            <div className="bg-white rounded-xl p-4 shadow-sm border">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{stats.byStatus.active}</p>
                  <p className="text-sm text-gray-500">Active</p>
                </div>
              </div>
            </div>
            
            <div className="bg-white rounded-xl p-4 shadow-sm border">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-yellow-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{stats.byStatus.expiring_soon}</p>
                  <p className="text-sm text-gray-500">Expiring Soon</p>
                </div>
              </div>
            </div>
            
            <div className="bg-white rounded-xl p-4 shadow-sm border">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Users className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{stats.totalActivations}</p>
                  <p className="text-sm text-gray-500">Activations</p>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* License Generator */}
        <div className="bg-white rounded-xl shadow-sm border mb-8">
          <div 
            className="px-6 py-4 border-b flex items-center justify-between cursor-pointer hover:bg-gray-50"
            onClick={() => setShowGenerator(!showGenerator)}
          >
            <div className="flex items-center gap-3">
              <Plus className="w-5 h-5 text-indigo-600" />
              <h2 className="font-semibold text-gray-900">Generate New Licenses</h2>
            </div>
            <span className="text-sm text-gray-500">{showGenerator ? 'Hide' : 'Show'}</span>
          </div>
          
          {showGenerator && (
            <div className="p-6">
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                  <select
                    value={genType}
                    onChange={(e) => setGenType(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="trial">Trial</option>
                    <option value="professional">Professional</option>
                    <option value="enterprise">Enterprise</option>
                    <option value="unlimited">Unlimited</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Count</label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={genCount}
                    onChange={(e) => setGenCount(parseInt(e.target.value) || 1)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Days Valid</label>
                  <input
                    type="number"
                    min="1"
                    max="365"
                    value={genDays}
                    onChange={(e) => setGenDays(parseInt(e.target.value) || 14)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Max Activations</label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={genMaxActivations}
                    onChange={(e) => setGenMaxActivations(parseInt(e.target.value) || 1)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email (opt)</label>
                  <input
                    type="email"
                    value={genEmail}
                    onChange={(e) => setGenEmail(e.target.value)}
                    placeholder="customer@email.com"
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Company (opt)</label>
                  <input
                    type="text"
                    value={genCompany}
                    onChange={(e) => setGenCompany(e.target.value)}
                    placeholder="Acme Inc"
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
              
              <button
                onClick={handleGenerate}
                disabled={generating}
                className="px-4 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2"
              >
                {generating ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    Generate {genCount} License{genCount > 1 ? 's' : ''}
                  </>
                )}
              </button>
              
              {/* Generated Keys */}
              {generatedKeys.length > 0 && (
                <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-medium text-green-800">Generated Licenses</h3>
                    <button
                      onClick={() => copyToClipboard(generatedKeys.map(k => k.key).join('\n'))}
                      className="text-sm text-green-600 hover:text-green-800 flex items-center gap-1"
                    >
                      <Copy className="w-4 h-4" /> Copy All
                    </button>
                  </div>
                  <div className="space-y-2">
                    {generatedKeys.map((key, i) => (
                      <div key={i} className="flex items-center justify-between p-2 bg-white rounded border">
                        <code className="text-sm font-mono text-gray-800">{key.key}</code>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-500">{key.validDays} days</span>
                          <button
                            onClick={() => copyToClipboard(key.key)}
                            className="p-1 text-gray-400 hover:text-gray-600"
                          >
                            <Copy className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
        
        {/* Error Display */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
            <button onClick={() => setError('')} className="ml-2 text-red-500 hover:text-red-700">×</button>
          </div>
        )}
        
        {/* Licenses Table */}
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          <div className="px-6 py-4 border-b">
            <h2 className="font-semibold text-gray-900">All Licenses ({licenses.length})</h2>
          </div>
          
          {loading && licenses.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2" />
              Loading licenses...
            </div>
          ) : licenses.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              No licenses found. Generate your first license above.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 text-left">
                  <tr>
                    <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase">License Key</th>
                    <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase">Type</th>
                    <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase">Days Left</th>
                    <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase">Activations</th>
                    <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase">Email</th>
                    <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {licenses.map((license) => (
                    <tr key={license.key} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <code className="text-sm font-mono text-gray-700">{license.key.substring(0, 20)}...</code>
                          <button
                            onClick={() => copyToClipboard(license.key)}
                            className="p-1 text-gray-400 hover:text-gray-600"
                            title="Copy full key"
                          >
                            <Copy className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                      <td className="px-6 py-4">{getTypeBadge(license.type)}</td>
                      <td className="px-6 py-4">{getStatusBadge(license.status)}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1 text-sm">
                          <Clock className="w-4 h-4 text-gray-400" />
                          <span className={license.daysLeft <= 0 ? 'text-red-600' : license.daysLeft <= 7 ? 'text-yellow-600' : 'text-gray-700'}>
                            {license.daysLeft <= 0 ? 'Expired' : `${license.daysLeft} days`}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1 text-sm">
                          <Users className="w-4 h-4 text-gray-400" />
                          <span>{license.currentActivations} / {license.maxActivations}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {license.email || '-'}
                      </td>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => handleRevoke(license.key)}
                          className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded"
                          title="Revoke license"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
