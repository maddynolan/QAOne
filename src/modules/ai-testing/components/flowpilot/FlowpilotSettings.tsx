import React from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Settings } from 'lucide-react';
import type { FlowpilotSettings as SettingsType } from './types';
import { DEFAULT_SETTINGS } from './types';

interface FlowpilotSettingsProps {
  settings: SettingsType;
  onChange: (settings: SettingsType) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  theme: string;
}

export function FlowpilotSettingsPopover({ settings, onChange, open, onOpenChange, theme }: FlowpilotSettingsProps) {
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Button size="sm" variant="outline" className="h-8 w-8 p-0">
          <Settings className="w-4 h-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className={cn("w-72", theme === 'light' ? '' : 'bg-gray-900 border-gray-700')} align="end">
        <div className="space-y-4">
          <h4 className={cn("font-semibold text-sm", theme === 'light' ? 'text-gray-900' : 'text-white')}>
            Agent Settings
          </h4>

          <div className="space-y-2">
            <Label className="text-xs">LLM Model</Label>
            <Select value={settings.model} onValueChange={(v) => onChange({ ...settings, model: v })}>
              <SelectTrigger className={cn("h-8 text-xs", theme === 'light' ? '' : 'bg-gray-800 border-gray-700')}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="gpt-4o-mini">GPT-4o Mini (Fast)</SelectItem>
                <SelectItem value="gpt-4o">GPT-4o (Accurate)</SelectItem>
                <SelectItem value="gpt-4-turbo">GPT-4 Turbo</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between">
            <Label className="text-xs">Headless Browser</Label>
            <Switch
              checked={settings.headless}
              onCheckedChange={(v) => onChange({ ...settings, headless: v })}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Max Steps</Label>
              <span className={cn("text-xs tabular-nums", theme === 'light' ? 'text-gray-500' : 'text-gray-400')}>
                {settings.maxSteps}
              </span>
            </div>
            <Slider
              value={[settings.maxSteps]}
              onValueChange={([v]) => onChange({ ...settings, maxSteps: v })}
              min={5} max={50} step={5}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Timeout (seconds)</Label>
              <span className={cn("text-xs tabular-nums", theme === 'light' ? 'text-gray-500' : 'text-gray-400')}>
                {settings.timeout}s
              </span>
            </div>
            <Slider
              value={[settings.timeout]}
              onValueChange={([v]) => onChange({ ...settings, timeout: v })}
              min={10} max={120} step={10}
            />
          </div>

          <Button
            size="sm"
            variant="ghost"
            className="w-full h-7 text-xs"
            onClick={() => onChange({ ...DEFAULT_SETTINGS })}
          >
            Reset to Defaults
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
