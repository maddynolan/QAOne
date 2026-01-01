/**
 * Salesforce Context Dashboard
 * 
 * The central hub for all Salesforce operations in tests:
 * - Connection status and org info
 * - Login As User feature for permission testing
 * - Captured variables dashboard
 * - Recent records quick access
 * - Session management
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Shield, Zap, Database, CheckCircle, Plus, Copy, RefreshCw, 
  Loader2, ChevronDown, ChevronRight, Target, Sparkles, 
  User, Users, Building2, Key, Clock, ExternalLink, Play,
  Search, Settings, LogIn, LogOut, Eye, EyeOff, AlertCircle,
  Cloud, Lock, Unlock, UserCog, History, Star
} from 'lucide-react';
import { toast } from 'sonner';
import { salesforceApi, SalesforceOrg } from '@/lib/salesforce-api';
import { cn } from '@/lib/utils';

// Types
interface CapturedVariable {
  name: string;
  value: string;
  type: 'id' | 'string' | 'number' | 'boolean' | 'object';
  timestamp: number;
  source: string; // where it was captured from
}

interface RecentRecord {
  id: string;
  name: string;
  objectType: string;
  timestamp: number;
}

interface UserInfo {
  id: string;
  name: string;
  username: string;
  email: string;
  profileName: string;
  roleName?: string;
  isActive: boolean;
}

interface SFContextDashboardProps {
  currentUrl?: string;
  isRecording?: boolean;
  onAddStep?: (step: { type: string; action: string; args: any }) => void;
  onVariableInsert?: (variable: string) => void;
  className?: string;
}

export function SFContextDashboard({
  currentUrl = '',
  isRecording = false,
  onAddStep,
  onVariableInsert,
  className
}: SFContextDashboardProps) {
  // Connection state
  const [isConnected, setIsConnected] = useState(false);
  const [currentOrg, setCurrentOrg] = useState<SalesforceOrg | null>(null);
  const [currentUser, setCurrentUser] = useState<UserInfo | null>(null);
  const [sessionTimeRemaining, setSessionTimeRemaining] = useState<number>(0);
  
  // Login As User state
  const [showLoginAs, setShowLoginAs] = useState(false);
  const [loginAsSearch, setLoginAsSearch] = useState('');
  const [availableUsers, setAvailableUsers] = useState<UserInfo[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [quickProfiles, setQuickProfiles] = useState<string[]>([
    'System Administrator',
    'Standard User',
    'Read Only',
    'Chatter Free User'
  ]);
  
  // Variables state
  const [capturedVariables, setCapturedVariables] = useState<CapturedVariable[]>([]);
  const [newVarName, setNewVarName] = useState('');
  const [newVarValue, setNewVarValue] = useState('');
  
  // Recent records state
  const [recentRecords, setRecentRecords] = useState<RecentRecord[]>([]);
  
  // UI state
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(['connection', 'variables', 'recent'])
  );
  
  // Initialize from localStorage
  useEffect(() => {
    const org = salesforceApi.getCurrentOrg();
    if (org) {
      setCurrentOrg(org);
      setIsConnected(true);
      loadCurrentUserInfo();
    }
    
    // Load captured variables from session
    const savedVars = sessionStorage.getItem('sf_captured_variables');
    if (savedVars) {
      setCapturedVariables(JSON.parse(savedVars));
    }
    
    // Load recent records
    const savedRecent = sessionStorage.getItem('sf_recent_records');
    if (savedRecent) {
      setRecentRecords(JSON.parse(savedRecent));
    }
  }, []);
  
  // Update session time countdown
  useEffect(() => {
    if (!currentOrg?.tokenExpiry) return;
    
    const interval = setInterval(() => {
      const remaining = Math.max(0, currentOrg.tokenExpiry! - Date.now());
      setSessionTimeRemaining(remaining);
    }, 1000);
    
    return () => clearInterval(interval);
  }, [currentOrg?.tokenExpiry]);
  
  // Load current user info
  const loadCurrentUserInfo = async () => {
    try {
      const result = await salesforceApi.query(
        'SELECT Id, Name, Username, Email, Profile.Name, UserRole.Name, IsActive FROM User WHERE Id = UserInfo.getUserId() LIMIT 1'
      );
      if (result.records?.[0]) {
        const u = result.records[0];
        setCurrentUser({
          id: u.Id,
          name: u.Name,
          username: u.Username,
          email: u.Email,
          profileName: u.Profile?.Name || 'Unknown',
          roleName: u.UserRole?.Name,
          isActive: u.IsActive
        });
      }
    } catch (e) {
      // Fallback - try simpler query
      try {
        const result = await salesforceApi.query('SELECT Id, Name, Username, Email FROM User LIMIT 1');
        if (result.records?.[0]) {
          const u = result.records[0];
          setCurrentUser({
            id: u.Id,
            name: u.Name,
            username: u.Username,
            email: u.Email,
            profileName: 'Unknown',
            isActive: true
          });
        }
      } catch (e2) {
        console.error('Could not load user info:', e2);
      }
    }
  };
  
  // Search users for Login As
  const searchUsers = useCallback(async (searchTerm: string) => {
    if (!searchTerm || searchTerm.length < 2) {
      setAvailableUsers([]);
      return;
    }
    
    setLoadingUsers(true);
    try {
      const result = await salesforceApi.query(`
        SELECT Id, Name, Username, Email, Profile.Name, UserRole.Name, IsActive 
        FROM User 
        WHERE (Name LIKE '%${searchTerm}%' OR Username LIKE '%${searchTerm}%' OR Email LIKE '%${searchTerm}%')
        AND IsActive = true
        ORDER BY Name
        LIMIT 20
      `);
      
      setAvailableUsers(result.records?.map((u: any) => ({
        id: u.Id,
        name: u.Name,
        username: u.Username,
        email: u.Email,
        profileName: u.Profile?.Name || 'Unknown',
        roleName: u.UserRole?.Name,
        isActive: u.IsActive
      })) || []);
    } catch (e) {
      console.error('Failed to search users:', e);
      toast.error('Failed to search users');
    } finally {
      setLoadingUsers(false);
    }
  }, []);
  
  // Search users by profile
  const searchUsersByProfile = async (profileName: string) => {
    setLoadingUsers(true);
    try {
      const result = await salesforceApi.query(`
        SELECT Id, Name, Username, Email, Profile.Name, UserRole.Name, IsActive 
        FROM User 
        WHERE Profile.Name = '${profileName}'
        AND IsActive = true
        ORDER BY Name
        LIMIT 20
      `);
      
      setAvailableUsers(result.records?.map((u: any) => ({
        id: u.Id,
        name: u.Name,
        username: u.Username,
        email: u.Email,
        profileName: u.Profile?.Name || 'Unknown',
        roleName: u.UserRole?.Name,
        isActive: u.IsActive
      })) || []);
    } catch (e) {
      console.error('Failed to search users:', e);
    } finally {
      setLoadingUsers(false);
    }
  };
  
  // Add Login As step
  const addLoginAsStep = (user: UserInfo) => {
    onAddStep?.({
      type: 'sf_login_as',
      action: 'LoginAsUser',
      args: {
        userId: user.id,
        userName: user.name,
        userEmail: user.username,
        profileName: user.profileName,
        description: `Login as ${user.name} (${user.profileName})`
      }
    });
    toast.success(`Added "Login As ${user.name}" step`);
  };
  
  // Navigate to Login As in SF
  const openLoginAsInSF = (user: UserInfo) => {
    if (currentOrg?.instanceUrl) {
      const url = `${currentOrg.instanceUrl}/servlet/servlet.su?oid=${currentOrg.id}&suorgadminid=${user.id}&targetURL=%2Fhome%2Fhome.jsp`;
      window.open(url, '_blank');
      toast.success(`Opening Salesforce as ${user.name}`);
    }
  };
  
  // Add variable
  const addVariable = () => {
    if (!newVarName.trim() || !newVarValue.trim()) {
      toast.error('Please enter both name and value');
      return;
    }
    
    const varName = newVarName.startsWith('{{') ? newVarName : `{{${newVarName}}}`;
    const newVar: CapturedVariable = {
      name: varName,
      value: newVarValue,
      type: detectValueType(newVarValue),
      timestamp: Date.now(),
      source: 'manual'
    };
    
    const updated = [...capturedVariables.filter(v => v.name !== varName), newVar];
    setCapturedVariables(updated);
    sessionStorage.setItem('sf_captured_variables', JSON.stringify(updated));
    
    setNewVarName('');
    setNewVarValue('');
    toast.success(`Variable ${varName} added`);
  };
  
  // Detect value type
  const detectValueType = (value: string): CapturedVariable['type'] => {
    if (/^[a-zA-Z0-9]{15,18}$/.test(value)) return 'id';
    if (!isNaN(Number(value))) return 'number';
    if (value === 'true' || value === 'false') return 'boolean';
    if (value.startsWith('{') || value.startsWith('[')) return 'object';
    return 'string';
  };
  
  // Insert variable
  const insertVariable = (varName: string) => {
    onVariableInsert?.(varName);
    navigator.clipboard.writeText(varName);
    toast.success(`${varName} copied to clipboard`);
  };
  
  // Delete variable
  const deleteVariable = (varName: string) => {
    const updated = capturedVariables.filter(v => v.name !== varName);
    setCapturedVariables(updated);
    sessionStorage.setItem('sf_captured_variables', JSON.stringify(updated));
  };
  
  // Add recent record
  const addRecentRecord = (record: RecentRecord) => {
    const updated = [record, ...recentRecords.filter(r => r.id !== record.id)].slice(0, 20);
    setRecentRecords(updated);
    sessionStorage.setItem('sf_recent_records', JSON.stringify(updated));
  };
  
  // Use record (add as variable)
  const useRecord = (record: RecentRecord) => {
    const varName = `{{${record.objectType.toLowerCase()}Id}}`;
    const newVar: CapturedVariable = {
      name: varName,
      value: record.id,
      type: 'id',
      timestamp: Date.now(),
      source: `${record.objectType}: ${record.name}`
    };
    
    const updated = [...capturedVariables.filter(v => v.name !== varName), newVar];
    setCapturedVariables(updated);
    sessionStorage.setItem('sf_captured_variables', JSON.stringify(updated));
    
    toast.success(`Added ${varName} = ${record.id}`);
  };
  
  // Toggle section
  const toggleSection = (section: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  };
  
  // Format time remaining
  const formatTimeRemaining = (ms: number) => {
    const hours = Math.floor(ms / 3600000);
    const minutes = Math.floor((ms % 3600000) / 60000);
    return `${hours}h ${minutes}m`;
  };
  
  // Not connected state
  if (!isConnected || !currentOrg) {
    return (
      <div className={cn("flex flex-col h-full items-center justify-center p-4", className)}>
        <Cloud className="w-10 h-10 mb-3 text-gray-500 opacity-50" />
        <h3 className="text-sm font-medium text-foreground mb-1">Not Connected</h3>
        <p className="text-xs text-gray-500 mb-3 text-center">
          Connect to a Salesforce org to access all features
        </p>
        <Button
          size="sm"
          className="bg-blue-600 hover:bg-blue-700"
          onClick={() => window.location.href = '/salesforce'}
        >
          <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
          Go to SF Tab to Connect
        </Button>
      </div>
    );
  }
  
  return (
    <div className={cn("flex flex-col h-full overflow-hidden", className)}>
      <ScrollArea className="flex-1 min-h-0">
        <div className="p-3 pb-20 space-y-3">
          
          {/* ===== CONNECTION STATUS ===== */}
          <Collapsible 
            open={expandedSections.has('connection')}
            onOpenChange={() => toggleSection('connection')}
          >
            <CollapsibleTrigger className="flex items-center justify-between w-full p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/15 transition-colors">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-xs font-medium text-emerald-400">Connected</span>
                <Badge variant="outline" className="h-4 px-1.5 text-[9px] border-emerald-500/30 text-emerald-400">
                  {currentOrg.orgType}
                </Badge>
              </div>
              {expandedSections.has('connection') ? (
                <ChevronDown className="h-3.5 w-3.5 text-emerald-400" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5 text-emerald-400" />
              )}
            </CollapsibleTrigger>
            
            <CollapsibleContent className="mt-2 space-y-2">
              {/* Org Info */}
              <div className="p-2.5 rounded-lg bg-[#1a1a25] border border-white/5 space-y-2">
                <div className="flex items-center gap-2">
                  <Building2 className="h-3.5 w-3.5 text-blue-400" />
                  <span className="text-xs text-foreground font-medium">{currentOrg.name}</span>
                </div>
                <div className="flex items-center gap-2 text-[10px] text-gray-500">
                  <span>{currentOrg.instanceUrl}</span>
                </div>
                <div className="flex items-center gap-2 text-[10px] text-gray-500">
                  <Key className="h-3 w-3" />
                  <span>API v{currentOrg.apiVersion}</span>
                  {sessionTimeRemaining > 0 && (
                    <>
                      <span className="mx-1">•</span>
                      <Clock className="h-3 w-3" />
                      <span>{formatTimeRemaining(sessionTimeRemaining)} remaining</span>
                    </>
                  )}
                </div>
              </div>
              
              {/* Current User */}
              {currentUser && (
                <div className="p-2.5 rounded-lg bg-[#1a1a25] border border-white/5 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <User className="h-3.5 w-3.5 text-purple-400" />
                      <span className="text-xs text-foreground font-medium">{currentUser.name}</span>
                    </div>
                    <Badge variant="outline" className="h-4 px-1.5 text-[9px] border-purple-500/30 text-purple-400">
                      {currentUser.profileName}
                    </Badge>
                  </div>
                  <div className="text-[10px] text-gray-500">
                    <p>{currentUser.username}</p>
                    {currentUser.roleName && <p>Role: {currentUser.roleName}</p>}
                  </div>
                </div>
              )}
            </CollapsibleContent>
          </Collapsible>
          
          {/* ===== LOGIN AS USER ===== */}
          <Collapsible 
            open={expandedSections.has('loginas')}
            onOpenChange={() => toggleSection('loginas')}
          >
            <CollapsibleTrigger className="flex items-center justify-between w-full p-2 rounded-lg bg-indigo-500/10 border border-indigo-500/20 hover:bg-indigo-500/15 transition-colors">
              <div className="flex items-center gap-2">
                <UserCog className="h-3.5 w-3.5 text-indigo-400" />
                <span className="text-xs font-medium text-indigo-400">Login As User</span>
              </div>
              {expandedSections.has('loginas') ? (
                <ChevronDown className="h-3.5 w-3.5 text-indigo-400" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5 text-indigo-400" />
              )}
            </CollapsibleTrigger>
            
            <CollapsibleContent className="mt-2 space-y-2">
              {/* Quick Profile Buttons */}
              <div className="flex flex-wrap gap-1">
                {quickProfiles.map(profile => (
                  <Button
                    key={profile}
                    size="sm"
                    variant="outline"
                    className="h-6 px-2 text-[9px] border-indigo-500/30 text-indigo-400 hover:bg-indigo-500/10"
                    onClick={() => searchUsersByProfile(profile)}
                  >
                    {profile.replace(' User', '').replace('System ', '')}
                  </Button>
                ))}
              </div>
              
              {/* Search Input */}
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-500" />
                <Input
                  value={loginAsSearch}
                  onChange={(e) => {
                    setLoginAsSearch(e.target.value);
                    searchUsers(e.target.value);
                  }}
                  placeholder="Search by name, email, or username..."
                  className="h-8 pl-8 text-xs bg-[#0d0d14] border-indigo-500/20"
                />
              </div>
              
              {/* User Results */}
              {loadingUsers && (
                <div className="text-center py-4">
                  <Loader2 className="h-5 w-5 mx-auto animate-spin text-indigo-400" />
                </div>
              )}
              
              {!loadingUsers && availableUsers.length > 0 && (
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {availableUsers.map(user => (
                    <div
                      key={user.id}
                      className="flex items-center justify-between p-2 rounded bg-[#1a1a25] border border-white/5 hover:border-indigo-500/30 group"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-foreground font-medium truncate">{user.name}</p>
                        <p className="text-[10px] text-muted-foreground truncate">{user.profileName}</p>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 w-6 p-0 text-indigo-400 hover:bg-indigo-500/20"
                          onClick={() => addLoginAsStep(user)}
                          title="Add as test step"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 w-6 p-0 text-emerald-400 hover:bg-emerald-500/20"
                          onClick={() => openLoginAsInSF(user)}
                          title="Open in Salesforce"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              
              <p className="text-[9px] text-gray-500 text-center">
                Test permission sets, profiles, and sharing rules
              </p>
            </CollapsibleContent>
          </Collapsible>
          
          {/* ===== CAPTURED VARIABLES ===== */}
          <Collapsible 
            open={expandedSections.has('variables')}
            onOpenChange={() => toggleSection('variables')}
          >
            <CollapsibleTrigger className="flex items-center justify-between w-full p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 hover:bg-amber-500/15 transition-colors">
              <div className="flex items-center gap-2">
                <Target className="h-3.5 w-3.5 text-amber-400" />
                <span className="text-xs font-medium text-amber-400">Variables</span>
                {capturedVariables.length > 0 && (
                  <Badge variant="outline" className="h-4 px-1.5 text-[9px] border-amber-500/30 text-amber-400">
                    {capturedVariables.length}
                  </Badge>
                )}
              </div>
              {expandedSections.has('variables') ? (
                <ChevronDown className="h-3.5 w-3.5 text-amber-400" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5 text-amber-400" />
              )}
            </CollapsibleTrigger>
            
            <CollapsibleContent className="mt-2 space-y-2">
              {/* Add Variable Form */}
              <div className="flex gap-1">
                <Input
                  value={newVarName}
                  onChange={(e) => setNewVarName(e.target.value)}
                  placeholder="name"
                  className="h-7 text-[10px] bg-[#0d0d14] border-amber-500/20 flex-1"
                />
                <Input
                  value={newVarValue}
                  onChange={(e) => setNewVarValue(e.target.value)}
                  placeholder="value"
                  className="h-7 text-[10px] bg-[#0d0d14] border-amber-500/20 flex-1"
                />
                <Button
                  size="sm"
                  className="h-7 px-2 bg-amber-600 hover:bg-amber-700"
                  onClick={addVariable}
                >
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
              
              {/* Variables List */}
              {capturedVariables.length > 0 ? (
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {capturedVariables.map(v => (
                    <div
                      key={v.name}
                      className="flex items-center justify-between p-2 rounded bg-[#1a1a25] border border-white/5 group"
                    >
                      <div className="flex-1 min-w-0">
                        <code className="text-[10px] text-amber-400 font-mono">{v.name}</code>
                        <p className="text-[9px] text-gray-500 truncate font-mono">{v.value}</p>
                      </div>
                      <div className="flex items-center gap-0.5">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-5 w-5 p-0 text-muted-foreground hover:text-warning"
                          onClick={() => insertVariable(v.name)}
                          title="Copy to clipboard"
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-5 w-5 p-0 text-muted-foreground hover:text-destructive"
                          onClick={() => deleteVariable(v.name)}
                          title="Delete"
                        >
                          ×
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[10px] text-gray-500 text-center py-2">
                  No variables captured yet. Use Record IDs or add manually.
                </p>
              )}
            </CollapsibleContent>
          </Collapsible>
          
          {/* ===== RECENT RECORDS ===== */}
          <Collapsible 
            open={expandedSections.has('recent')}
            onOpenChange={() => toggleSection('recent')}
          >
            <CollapsibleTrigger className="flex items-center justify-between w-full p-2 rounded-lg bg-blue-500/10 border border-blue-500/20 hover:bg-blue-500/15 transition-colors">
              <div className="flex items-center gap-2">
                <History className="h-3.5 w-3.5 text-blue-400" />
                <span className="text-xs font-medium text-blue-400">Recent Records</span>
                {recentRecords.length > 0 && (
                  <Badge variant="outline" className="h-4 px-1.5 text-[9px] border-blue-500/30 text-blue-400">
                    {recentRecords.length}
                  </Badge>
                )}
              </div>
              {expandedSections.has('recent') ? (
                <ChevronDown className="h-3.5 w-3.5 text-blue-400" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5 text-blue-400" />
              )}
            </CollapsibleTrigger>
            
            <CollapsibleContent className="mt-2">
              {recentRecords.length > 0 ? (
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {recentRecords.map(record => (
                    <div
                      key={record.id}
                      className="flex items-center justify-between p-2 rounded bg-[#1a1a25] border border-white/5 group"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <Badge variant="outline" className="h-4 px-1 text-[8px] border-blue-500/30 text-blue-400">
                            {record.objectType}
                          </Badge>
                          <span className="text-xs text-foreground truncate">{record.name}</span>
                        </div>
                        <code className="text-[9px] text-gray-500 font-mono">{record.id}</code>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 px-2 text-[9px] text-blue-400 hover:bg-blue-500/20 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => useRecord(record)}
                      >
                        Use
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[10px] text-gray-500 text-center py-3">
                  Navigate to records in Salesforce to see them here
                </p>
              )}
            </CollapsibleContent>
          </Collapsible>
          
          {/* Action Bar - Sticky at bottom */}
          <div className="sticky bottom-0 mt-4 px-2 py-2 border-t border-white/10 bg-[#0d0d14] -mx-3 space-y-1.5">
            <Button
              variant="default"
              size="sm"
              className="w-full h-7 text-xs bg-blue-600 hover:bg-blue-700"
              onClick={() => {
                onAddStep?.({
                  type: 'sf_navigate',
                  action: 'NavigateToSalesforce',
                  args: {
                    path: '/lightning/page/home',
                    description: 'Navigate to Salesforce Home'
                  }
                });
                toast.success('Added Navigate to SF Home step');
              }}
            >
              <Play className="h-3 w-3 mr-1.5" />
              Add "Login to Salesforce" Step
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="w-full h-7 text-xs border-purple-500/30 text-purple-400 hover:bg-purple-500/10"
              onClick={() => window.location.href = '/salesforce'}
            >
              <ExternalLink className="h-3 w-3 mr-1.5" />
              Open Full SF Tools
            </Button>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}

export default SFContextDashboard;

