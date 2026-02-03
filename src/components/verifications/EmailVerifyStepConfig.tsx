/**
 * Email Verification Step Configuration UI
 * 
 * Allows users to configure email verification in the workflow editor.
 */

import React, { useState, useCallback } from 'react';
import { Mail, Plus, Trash2, Clock, Filter, Link, Key, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import type { EmailVerifyConfig, EmailAssertion, EmailAssertionType } from './types';
import { EMAIL_ASSERTION_TYPES } from './types';
import { ComplexVerificationService } from './ComplexVerificationService';

interface EmailVerifyStepConfigProps {
  config: EmailVerifyConfig;
  onChange: (config: EmailVerifyConfig) => void;
  onTest?: () => void;
  readOnly?: boolean;
}

export function EmailVerifyStepConfig({ 
  config, 
  onChange, 
  onTest,
  readOnly = false 
}: EmailVerifyStepConfigProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const updateConfig = useCallback((updates: Partial<EmailVerifyConfig>) => {
    onChange({ ...config, ...updates });
  }, [config, onChange]);

  const addAssertion = useCallback(() => {
    const newAssertion: EmailAssertion = {
      id: `email_assert_${Date.now()}`,
      type: 'subject_contains',
      expected: '',
      enabled: true
    };
    updateConfig({ assertions: [...config.assertions, newAssertion] });
  }, [config.assertions, updateConfig]);

  const updateAssertion = useCallback((id: string, updates: Partial<EmailAssertion>) => {
    updateConfig({
      assertions: config.assertions.map(a => 
        a.id === id ? { ...a, ...updates } : a
      )
    });
  }, [config.assertions, updateConfig]);

  const removeAssertion = useCallback((id: string) => {
    updateConfig({
      assertions: config.assertions.filter(a => a.id !== id)
    });
  }, [config.assertions, updateConfig]);

  const handleTest = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const result = await ComplexVerificationService.checkLatestEmails(
        config.provider,
        config.inbox,
        3
      );
      setTestResult({
        success: true,
        message: `Found ${result.count} email(s). Latest: ${result.emails[0]?.subject || 'N/A'}`
      });
    } catch (error: any) {
      setTestResult({
        success: false,
        message: error.message || 'Failed to check emails'
      });
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="space-y-4" onClick={(e) => e.stopPropagation()}>
      {/* Provider & Inbox */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-sm font-medium">Email Provider</Label>
          <Select 
            value={config.provider} 
            onValueChange={(v) => updateConfig({ provider: v as 'microsoft_365' | 'gmail' })}
            disabled={readOnly}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select provider" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="microsoft_365">
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-blue-500" />
                  <span>Microsoft 365 / Outlook</span>
                </div>
              </SelectItem>
              <SelectItem value="gmail">
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-red-500" />
                  <span>Gmail</span>
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label className="text-sm font-medium">Inbox / Email Address</Label>
          <Input
            type="email"
            value={config.inbox || ''}
            onChange={(e) => updateConfig({ inbox: e.target.value })}
            onFocus={(e) => e.target.select()}
            placeholder="test@company.com"
            disabled={readOnly}
            className="w-full"
          />
        </div>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-sm font-medium flex items-center gap-1">
            <Filter className="h-3 w-3" />
            Subject Filter
          </Label>
          <Input
            type="text"
            value={config.subjectFilter || ''}
            onChange={(e) => {
              e.stopPropagation();
              updateConfig({ subjectFilter: e.target.value || undefined });
            }}
            onFocus={(e) => e.target.select()}
            onKeyDown={(e) => e.stopPropagation()}
            placeholder="Welcome to..."
            disabled={readOnly}
            className="w-full"
          />
          <p className="text-xs text-muted-foreground">Only check emails with this subject text</p>
        </div>

        <div className="space-y-2">
          <Label className="text-sm font-medium flex items-center gap-1">
            <Filter className="h-3 w-3" />
            Sender Filter
          </Label>
          <Input
            type="text"
            value={config.senderFilter || ''}
            onChange={(e) => {
              e.stopPropagation();
              updateConfig({ senderFilter: e.target.value || undefined });
            }}
            onFocus={(e) => e.target.select()}
            onKeyDown={(e) => e.stopPropagation()}
            placeholder="noreply@company.com"
            disabled={readOnly}
            className="w-full"
          />
          <p className="text-xs text-muted-foreground">Only check emails from this sender</p>
        </div>
      </div>

      {/* Timeout */}
      <div className="space-y-2">
        <Label className="text-sm font-medium flex items-center gap-1">
          <Clock className="h-3 w-3" />
          Wait Timeout (seconds)
        </Label>
        <Input
          type="number"
          min={5}
          max={300}
          value={config.timeoutSeconds || 60}
          onChange={(e) => {
            e.stopPropagation();
            updateConfig({ timeoutSeconds: parseInt(e.target.value) || 60 });
          }}
          onKeyDown={(e) => e.stopPropagation()}
          disabled={readOnly}
          className="w-full max-w-[200px]"
        />
        <p className="text-xs text-muted-foreground">Maximum time to wait for email to arrive</p>
      </div>

      {/* Assertions */}
      <Card>
        <CardHeader className="py-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">Email Assertions</CardTitle>
            {!readOnly && (
              <Button variant="outline" size="sm" onClick={addAssertion}>
                <Plus className="h-3 w-3 mr-1" />
                Add
              </Button>
            )}
          </div>
          <CardDescription className="text-xs">
            Verify email content matches expected values
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {config.assertions.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No assertions added. Click "Add" to add email verifications.
            </p>
          ) : (
            config.assertions.map((assertion) => (
              <div 
                key={assertion.id} 
                className="flex flex-wrap items-center gap-2 p-2 bg-muted/50 rounded-md"
                onClick={(e) => e.stopPropagation()}
              >
                <Switch
                  checked={assertion.enabled}
                  onCheckedChange={(checked) => updateAssertion(assertion.id, { enabled: checked })}
                  disabled={readOnly}
                />
                <Select
                  value={assertion.type}
                  onValueChange={(v) => updateAssertion(assertion.id, { type: v as EmailAssertionType })}
                  disabled={readOnly}
                >
                  <SelectTrigger className="w-[140px] sm:w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(EMAIL_ASSERTION_TYPES).map(([type, meta]) => (
                      <SelectItem key={type} value={type}>
                        {meta.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  type="text"
                  value={assertion.expected || ''}
                  onChange={(e) => {
                    e.stopPropagation();
                    updateAssertion(assertion.id, { expected: e.target.value });
                  }}
                  onFocus={(e) => e.target.select()}
                  onKeyDown={(e) => e.stopPropagation()}
                  placeholder={EMAIL_ASSERTION_TYPES[assertion.type]?.description || 'Enter value...'}
                  className="flex-1 min-w-[120px]"
                  disabled={readOnly}
                />
                {!readOnly && (
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => removeAssertion(assertion.id)}
                    className="shrink-0"
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Extractions */}
      <Collapsible open={showAdvanced} onOpenChange={setShowAdvanced}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" className="w-full justify-between">
            <span className="flex items-center gap-2">
              <Key className="h-4 w-4" />
              Extract Values (Link, OTP)
            </span>
            <Badge variant="outline">{showAdvanced ? 'Hide' : 'Show'}</Badge>
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-4 pt-4">
          {/* Extract Link */}
          <Card>
            <CardHeader className="py-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Link className="h-4 w-4" />
                Extract Link
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center gap-2">
                <Switch
                  checked={!!config.extractLink}
                  onCheckedChange={(checked) => 
                    updateConfig({ 
                      extractLink: checked ? { storeAs: 'verifyUrl' } : undefined 
                    })
                  }
                  disabled={readOnly}
                />
                <span className="text-sm">Extract verification/reset link</span>
              </div>
              {config.extractLink && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2" onClick={(e) => e.stopPropagation()}>
                  <div className="space-y-1">
                    <Label className="text-xs">Pattern (regex, optional)</Label>
                    <Input
                      type="text"
                      value={config.extractLink.pattern || ''}
                      onChange={(e) => {
                        e.stopPropagation();
                        updateConfig({ 
                          extractLink: { ...config.extractLink!, pattern: e.target.value || undefined }
                        });
                      }}
                      onFocus={(e) => e.target.select()}
                      onKeyDown={(e) => e.stopPropagation()}
                      placeholder="verify|confirm|reset"
                      disabled={readOnly}
                      className="w-full"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Store as variable</Label>
                    <Input
                      type="text"
                      value={config.extractLink.storeAs || ''}
                      onChange={(e) => {
                        e.stopPropagation();
                        updateConfig({ 
                          extractLink: { ...config.extractLink!, storeAs: e.target.value }
                        });
                      }}
                      onFocus={(e) => e.target.select()}
                      onKeyDown={(e) => e.stopPropagation()}
                      placeholder="verifyUrl"
                      disabled={readOnly}
                      className="w-full"
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Extract OTP */}
          <Card>
            <CardHeader className="py-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Key className="h-4 w-4" />
                Extract OTP Code
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center gap-2">
                <Switch
                  checked={!!config.extractOTP}
                  onCheckedChange={(checked) => 
                    updateConfig({ 
                      extractOTP: checked ? { storeAs: 'otpCode' } : undefined 
                    })
                  }
                  disabled={readOnly}
                />
                <span className="text-sm">Extract OTP/verification code (4-8 digits)</span>
              </div>
              {config.extractOTP && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2" onClick={(e) => e.stopPropagation()}>
                  <div className="space-y-1">
                    <Label className="text-xs">Pattern (regex, optional)</Label>
                    <Input
                      type="text"
                      value={config.extractOTP.pattern || ''}
                      onChange={(e) => {
                        e.stopPropagation();
                        updateConfig({ 
                          extractOTP: { ...config.extractOTP!, pattern: e.target.value || undefined }
                        });
                      }}
                      onFocus={(e) => e.target.select()}
                      onKeyDown={(e) => e.stopPropagation()}
                      placeholder="\d{6}"
                      disabled={readOnly}
                      className="w-full"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Store as variable</Label>
                    <Input
                      type="text"
                      value={config.extractOTP.storeAs || ''}
                      onChange={(e) => {
                        e.stopPropagation();
                        updateConfig({ 
                          extractOTP: { ...config.extractOTP!, storeAs: e.target.value }
                        });
                      }}
                      onFocus={(e) => e.target.select()}
                      onKeyDown={(e) => e.stopPropagation()}
                      placeholder="otpCode"
                      disabled={readOnly}
                      className="w-full"
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </CollapsibleContent>
      </Collapsible>

      {/* Test Connection */}
      {!readOnly && (
        <div className="pt-2">
          <Button 
            variant="outline" 
            className="w-full"
            onClick={handleTest}
            disabled={isTesting || !config.inbox}
          >
            {isTesting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Checking...
              </>
            ) : (
              <>
                <Mail className="h-4 w-4 mr-2" />
                Test Email Connection
              </>
            )}
          </Button>
          
          {testResult && (
            <div className={`mt-2 p-2 rounded-md text-sm flex items-center gap-2 ${
              testResult.success ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
            }`}>
              {testResult.success ? (
                <CheckCircle className="h-4 w-4" />
              ) : (
                <XCircle className="h-4 w-4" />
              )}
              {testResult.message}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Default configuration for new email verify steps
 */
export function getDefaultEmailVerifyConfig(): EmailVerifyConfig {
  return {
    provider: 'microsoft_365',
    inbox: '',
    timeoutSeconds: 60,
    assertions: []
  };
}

