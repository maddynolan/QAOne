/**
 * AddOrgDialog - Dialog for connecting a new Salesforce org.
 * Supports three auth methods: Browser OAuth, Session ID, and manual credentials.
 */
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Check, ExternalLink, Key, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { salesforceApi, SalesforceCredentials } from '@/modules/salesforce/lib/salesforce-api';
import { ORG_COLORS } from '@/modules/salesforce/constants/salesforce-constants';
import { API_BASE_URL } from '@/lib/api-config';

export interface OrgFormState extends SalesforceCredentials {
  name: string;
  orgType: string;
  color: string;
}

interface AddOrgDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  form: OrgFormState;
  onFormChange: (form: OrgFormState) => void;
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
  onAddOrg: () => void;
  onOrgConnected: (orgId: string) => void;
}

export function AddOrgDialog({
  open,
  onOpenChange,
  form,
  onFormChange,
  isLoading,
  setIsLoading,
  onAddOrg,
  onOrgConnected,
}: AddOrgDialogProps) {
  const handleBrowserLogin = async () => {
    setIsLoading(true);
    let pollInterval: NodeJS.Timeout | null = null;
    let timeoutId: NodeJS.Timeout | null = null;
    let authWindow: Window | null = null;

    const cleanup = () => {
      if (pollInterval) clearInterval(pollInterval);
      if (timeoutId) clearTimeout(timeoutId);
      setIsLoading(false);
    };

    try {
      // Determine domain for OAuth
      let domain = 'login';

      // Check if full URL was provided FIRST (takes priority)
      if (form.loginUrl && form.loginUrl.includes('.salesforce.com')) {
        const match = form.loginUrl.match(/https?:\/\/([^/]+)/);
        if (match) {
          const hostname = match[1];
          if (hostname.includes('.develop.my.salesforce.com')) {
            domain = hostname.replace('.my.salesforce.com', '');
          } else if (hostname.includes('.my.salesforce.com')) {
            domain = hostname.replace('.my.salesforce.com', '');
          } else {
            domain = hostname.replace('.salesforce.com', '');
          }
        }
      } else if (form.orgType === 'sandbox') {
        domain = 'test';
      } else {
        domain = 'login';
      }

      const response = await fetch(`${API_BASE_URL}/api/salesforce/oauth/start?domain=${domain}`);
      const data = await response.json();

      if (data.auth_url) {
        authWindow = window.open(data.auth_url, 'salesforce_auth', 'width=600,height=700');

        if (!authWindow || authWindow.closed) {
          const copyUrl = await navigator.clipboard.writeText(data.auth_url).then(() => true).catch(() => false);
          if (copyUrl) {
            toast.success('URL copied! Paste it in your browser to login, then return here.');
          } else {
            prompt('Popup blocked! Copy this URL and open it in your browser:', data.auth_url);
          }
        }

        let pollCount = 0;
        const maxPolls = 60;

        pollInterval = setInterval(async () => {
          pollCount++;

          if (authWindow?.closed) {
            cleanup();
            toast.info('Login cancelled - window was closed');
            return;
          }

          if (pollCount >= maxPolls) {
            cleanup();
            authWindow?.close();
            toast.error('Login timed out. Please try again.');
            return;
          }

          try {
            const statusRes = await fetch(`${API_BASE_URL}/api/salesforce/oauth/status/${data.state}`);
            const status = await statusRes.json();

            if (status.status === 'completed') {
              cleanup();
              authWindow?.close();

              const newOrg = salesforceApi.addOrg({
                name: form.name || 'My Salesforce Org',
                instanceUrl: status.instance_url,
                loginUrl: status.instance_url,
                username: 'oauth-user',
                orgType: form.orgType as any,
                color: form.color,
                accessToken: status.access_token,
                refreshToken: status.refresh_token,
                tokenExpiry: Date.now() + 7200000,
                apiVersion: 'v59.0',
              });

              onOrgConnected(newOrg.id);
              onOpenChange(false);
              toast.success('Connected via browser login!');
            }
          } catch (e) {
            // Continue polling
          }
        }, 2000);
      }
    } catch (error: any) {
      cleanup();
      toast.error(`OAuth failed: ${error.message}`);
    }
  };

  const handleSessionConnect = () => {
    let instanceUrl = (document.getElementById('session-instance-url') as HTMLInputElement)?.value?.trim();
    const sessionId = (document.getElementById('session-id-input') as HTMLInputElement)?.value?.trim();

    if (!instanceUrl || !sessionId) {
      toast.error('Please enter both Instance URL and Session ID');
      return;
    }

    if (!instanceUrl.startsWith('http://') && !instanceUrl.startsWith('https://')) {
      instanceUrl = 'https://' + instanceUrl;
    }

    if (instanceUrl.includes('.lightning.force.com')) {
      instanceUrl = instanceUrl.replace('.lightning.force.com', '.my.salesforce.com');
      toast.info('Converted Lightning URL to API URL');
    }

    instanceUrl = instanceUrl.replace(/\/$/, '');

    const newOrg = salesforceApi.addOrg({
      name: form.name || 'My Salesforce Org',
      instanceUrl: instanceUrl,
      loginUrl: instanceUrl,
      username: 'session-user',
      orgType: form.orgType as any,
      color: form.color,
      accessToken: sessionId,
      refreshToken: '',
      tokenExpiry: Date.now() + 7200000,
      apiVersion: 'v59.0',
    });

    onOrgConnected(newOrg.id);
    onOpenChange(false);
    toast.success('Connected with Session ID!');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-input border-border max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-foreground">Connect Salesforce Org</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          {/* Browser OAuth Option - Recommended */}
          <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <ExternalLink className="w-5 h-5 text-blue-400" />
              <span className="font-medium text-blue-300">Recommended: Login with Browser</span>
            </div>
            <p className="text-sm text-muted-foreground mb-3">
              Opens Salesforce login in your browser. Works with SSO, MFA, and all org types.
            </p>
            <div className="space-y-2">
              <div className="flex gap-2 items-center">
                <Select
                  value={form.orgType}
                  onValueChange={(v) => onFormChange({ ...form, orgType: v })}
                >
                  <SelectTrigger className="w-[140px] bg-secondary border-border text-foreground">
                    <SelectValue placeholder="Org Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="production">Production</SelectItem>
                    <SelectItem value="sandbox">Sandbox</SelectItem>
                    <SelectItem value="developer">Developer</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  value={form.name}
                  onChange={(e) => onFormChange({ ...form, name: e.target.value })}
                  placeholder="Org nickname (for display)"
                  className="flex-1 bg-secondary border-border text-foreground placeholder:text-muted-foreground"
                />
              </div>
              <Input
                value={form.loginUrl}
                onChange={(e) => onFormChange({ ...form, loginUrl: e.target.value })}
                placeholder="Paste your Salesforce URL (e.g., https://orgfarm-xxx-dev-ed.develop.my.salesforce.com)"
                className="bg-secondary border-border text-foreground placeholder:text-muted-foreground text-xs"
              />
              <p className="text-xs text-muted-foreground">
                Paste your full Salesforce login URL, or leave empty to use standard login
              </p>
            </div>
            <div className="flex gap-2 items-center mt-3">
              <Button
                onClick={handleBrowserLogin}
                disabled={isLoading}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ExternalLink className="w-4 h-4" />}
                <span className="ml-2">{isLoading ? 'Waiting...' : 'Login'}</span>
              </Button>
              {isLoading && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsLoading(false)}
                  className="text-red-400 border-red-500/50 hover:bg-red-500/20"
                >
                  Cancel
                </Button>
              )}
            </div>
          </div>

          {/* Session ID Option */}
          <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Key className="w-5 h-5 text-green-400" />
              <span className="font-medium text-green-300">Quick: Connect with Session ID</span>
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              If username/password doesn't work, copy your session from the browser.
            </p>
            <div className="space-y-2">
              <Input
                placeholder="Instance URL (e.g., https://orgfarm-xxx.develop.my.salesforce.com)"
                className="bg-secondary border-border text-foreground placeholder:text-muted-foreground text-xs"
                id="session-instance-url"
              />
              <Input
                placeholder="Session ID (from browser cookies)"
                className="bg-secondary border-border text-foreground placeholder:text-muted-foreground text-xs"
                id="session-id-input"
              />
              <Button
                onClick={handleSessionConnect}
                className="w-full bg-green-600 hover:bg-green-700"
                size="sm"
              >
                <Check className="w-4 h-4 mr-2" />
                Connect with Session
              </Button>
            </div>
          </div>

          {/* Divider */}
          <div className="flex items-center gap-4">
            <div className="flex-1 border-t border-border" />
            <span className="text-xs text-muted-foreground">OR use credentials</span>
            <div className="flex-1 border-t border-border" />
          </div>

          {/* Manual Credentials */}
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label className="text-foreground">Org Name</Label>
              <Input
                value={form.name}
                onChange={(e) => onFormChange({ ...form, name: e.target.value })}
                placeholder="My Production Org"
                className="bg-secondary border-border text-foreground placeholder:text-muted-foreground"
              />
            </div>
            <div>
              <Label className="text-foreground">Org Type</Label>
              <Select value={form.orgType} onValueChange={(v) => onFormChange({ ...form, orgType: v })}>
                <SelectTrigger className="bg-secondary border-border text-foreground">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="production">Production</SelectItem>
                  <SelectItem value="sandbox">Sandbox</SelectItem>
                  <SelectItem value="developer">Developer</SelectItem>
                  <SelectItem value="scratch">Scratch Org</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-foreground">Color</Label>
              <Select value={form.color} onValueChange={(v) => onFormChange({ ...form, color: v })}>
                <SelectTrigger className="bg-secondary border-border text-foreground">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ORG_COLORS.map(c => (
                    <SelectItem key={c.value} value={c.value}>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: c.value }} />
                        {c.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <Label className="text-foreground">Login URL</Label>
              <div className="flex gap-2">
                <Select
                  value={form.loginUrl.includes('login.salesforce.com') ? 'https://login.salesforce.com' :
                         form.loginUrl.includes('test.salesforce.com') ? 'https://test.salesforce.com' : 'custom'}
                  onValueChange={(v) => {
                    if (v !== 'custom') {
                      onFormChange({ ...form, loginUrl: v });
                    }
                  }}
                >
                  <SelectTrigger className="w-[200px] bg-secondary border-border text-foreground">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="https://login.salesforce.com">Production</SelectItem>
                    <SelectItem value="https://test.salesforce.com">Sandbox</SelectItem>
                    <SelectItem value="custom">Custom Domain</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  value={form.loginUrl}
                  onChange={(e) => onFormChange({ ...form, loginUrl: e.target.value })}
                  placeholder="https://orgfam.my.salesforce.com"
                  className="flex-1 bg-secondary border-border text-foreground placeholder:text-muted-foreground"
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                For custom domains: https://[your-domain].my.salesforce.com
              </p>
            </div>
            <div className="col-span-2">
              <Label className="text-foreground">Username</Label>
              <Input
                value={form.username}
                onChange={(e) => onFormChange({ ...form, username: e.target.value })}
                placeholder="user@example.com"
                className="bg-secondary border-border text-foreground placeholder:text-muted-foreground"
              />
            </div>
            <div className="col-span-2">
              <Label className="text-foreground">Password</Label>
              <Input
                type="password"
                value={form.password}
                onChange={(e) => onFormChange({ ...form, password: e.target.value })}
                placeholder="Your password"
                className="bg-secondary border-border text-foreground placeholder:text-muted-foreground"
              />
            </div>
            <div className="col-span-2">
              <Label className="text-foreground">Security Token (optional)</Label>
              <Input
                value={form.securityToken}
                onChange={(e) => onFormChange({ ...form, securityToken: e.target.value })}
                placeholder="Security token from Salesforce"
                className="bg-secondary border-border text-foreground placeholder:text-muted-foreground"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Required if IP restrictions are enabled. Get from: Setup → My Personal Information → Reset Security Token
              </p>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="text-foreground border-border hover:text-foreground hover:bg-secondary">
            Cancel
          </Button>
          <Button onClick={onAddOrg} disabled={isLoading} className="gap-2">
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Check className="w-4 h-4" />
            )}
            Connect
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
