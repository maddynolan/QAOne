import React from 'react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ChevronDown, ChevronUp, Lock } from 'lucide-react';
import type { ExplorerConfig as ExplorerConfigType } from './types';

interface ExplorerConfigProps {
  config: ExplorerConfigType;
  onChange: (config: ExplorerConfigType) => void;
  expanded: boolean;
  onToggle: () => void;
  disabled?: boolean;
  theme: string;
}

export function ExplorerConfigPanel({ config, onChange, expanded, onToggle, disabled, theme }: ExplorerConfigProps) {
  const update = (partial: Partial<ExplorerConfigType>) => onChange({ ...config, ...partial });
  const inputCn = cn("h-8 text-xs", theme === 'light' ? "bg-white border-gray-200" : "bg-gray-800 border-gray-700");

  return (
    <div className={cn(
      "rounded-lg border",
      theme === 'light' ? "border-gray-200" : "border-gray-800"
    )}>
      <button
        onClick={onToggle}
        className={cn(
          "w-full flex items-center justify-between px-4 py-2 text-left",
          theme === 'light' ? 'hover:bg-gray-50' : 'hover:bg-gray-800/50'
        )}
      >
        <span className={cn("text-sm font-medium flex items-center gap-2", theme === 'light' ? 'text-gray-700' : 'text-gray-300')}>
          <Lock className="w-3.5 h-3.5" /> Configuration
        </span>
        {expanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </button>

      {expanded && (
        <div className={cn(
          "px-4 pb-4 space-y-4 border-t",
          theme === 'light' ? 'border-gray-100' : 'border-gray-800'
        )}>
          {/* Crawl Settings */}
          <div className="grid grid-cols-3 gap-4 pt-3">
            <div className="space-y-1.5">
              <div className="flex justify-between">
                <Label className="text-[11px]">Max Pages</Label>
                <span className="text-[11px] text-gray-400 tabular-nums">{config.maxPages}</span>
              </div>
              <Slider value={[config.maxPages]} onValueChange={([v]) => update({ maxPages: v })} min={10} max={500} step={10} disabled={disabled} />
            </div>
            <div className="space-y-1.5">
              <div className="flex justify-between">
                <Label className="text-[11px]">Depth</Label>
                <span className="text-[11px] text-gray-400 tabular-nums">{config.maxDepth}</span>
              </div>
              <Slider value={[config.maxDepth]} onValueChange={([v]) => update({ maxDepth: v })} min={1} max={10} step={1} disabled={disabled} />
            </div>
            <div className="space-y-1.5">
              <div className="flex justify-between">
                <Label className="text-[11px]">Concurrency</Label>
                <span className="text-[11px] text-gray-400 tabular-nums">{config.concurrency}</span>
              </div>
              <Slider value={[config.concurrency]} onValueChange={([v]) => update({ concurrency: v })} min={1} max={10} step={1} disabled={disabled} />
            </div>
          </div>

          {/* Auth */}
          <div className="space-y-2">
            <Label className="text-[11px]">Authentication</Label>
            <Select
              value={config.authType}
              onValueChange={(v: ExplorerConfigType['authType']) => update({ authType: v })}
              disabled={disabled}
            >
              <SelectTrigger className={cn("h-8 text-xs", theme === 'light' ? '' : 'bg-gray-800 border-gray-700')}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                <SelectItem value="bearer">Bearer Token</SelectItem>
                <SelectItem value="cookie">Cookie JSON</SelectItem>
                <SelectItem value="basic">Basic Auth</SelectItem>
                <SelectItem value="form_login">Form Login</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {config.authType === 'bearer' && (
            <div className="space-y-1.5">
              <Label className="text-[11px]">Bearer Token</Label>
              <Input value={config.bearerToken} onChange={(e) => update({ bearerToken: e.target.value })} placeholder="eyJhbGciOi..." className={inputCn} disabled={disabled} />
            </div>
          )}

          {config.authType === 'cookie' && (
            <div className="space-y-1.5">
              <Label className="text-[11px]">Cookie JSON</Label>
              <Input value={config.cookieJson} onChange={(e) => update({ cookieJson: e.target.value })} placeholder='[{"name": "session", "value": "..."}]' className={inputCn} disabled={disabled} />
            </div>
          )}

          {config.authType === 'basic' && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-[11px]">Username</Label>
                <Input value={config.basicUsername} onChange={(e) => update({ basicUsername: e.target.value })} className={inputCn} disabled={disabled} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[11px]">Password</Label>
                <Input type="password" value={config.basicPassword} onChange={(e) => update({ basicPassword: e.target.value })} className={inputCn} disabled={disabled} />
              </div>
            </div>
          )}

          {config.authType === 'form_login' && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-[11px]">Login URL</Label>
                <Input value={config.loginUrl} onChange={(e) => update({ loginUrl: e.target.value })} placeholder="https://example.com/login" className={inputCn} disabled={disabled} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-[11px]">Username</Label>
                  <Input value={config.loginUsername} onChange={(e) => update({ loginUsername: e.target.value })} className={inputCn} disabled={disabled} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[11px]">Password</Label>
                  <Input type="password" value={config.loginPassword} onChange={(e) => update({ loginPassword: e.target.value })} className={inputCn} disabled={disabled} />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-[11px]">Username Selector</Label>
                  <Input value={config.usernameSelector} onChange={(e) => update({ usernameSelector: e.target.value })} className={cn(inputCn, "font-mono")} disabled={disabled} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[11px]">Password Selector</Label>
                  <Input value={config.passwordSelector} onChange={(e) => update({ passwordSelector: e.target.value })} className={cn(inputCn, "font-mono")} disabled={disabled} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[11px]">Submit Selector</Label>
                  <Input value={config.submitSelector} onChange={(e) => update({ submitSelector: e.target.value })} className={cn(inputCn, "font-mono")} disabled={disabled} />
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
