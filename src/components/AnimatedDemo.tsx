/**
 * AnimatedDemo — Pure CSS animated product demos for marketing pages.
 *
 * Light-themed to match the marketing site. Zero external file dependencies.
 *
 * Demo types:
 * - recording: Smart Trace — browser recording with click indicators + step list
 * - test-builder: Visual Builder — drag-and-drop workflow blocks
 * - api-testing: API request/response with assertions
 * - accessibility: WCAG scan with issue cards
 */

import React from 'react'
import { cn } from '@/lib/utils'
import {
  Circle, MousePointer2, CheckCircle2, XCircle,
  Globe, Shield, AlertTriangle, Zap,
  Code2, Send, Eye
} from 'lucide-react'

type DemoType = 'recording' | 'test-builder' | 'api-testing' | 'accessibility'

interface AnimatedDemoProps {
  type: DemoType
  className?: string
}

const URL_LABELS: Record<DemoType, string> = {
  'recording': 'app.flowstral.com/smart-trace',
  'test-builder': 'app.flowstral.com/builder',
  'api-testing': 'app.flowstral.com/api-testing',
  'accessibility': 'app.flowstral.com/accessibility',
}

export function AnimatedDemo({ type, className }: AnimatedDemoProps) {
  return (
    <div className={cn(
      'relative overflow-hidden bg-white rounded-xl border border-slate-200 shadow-sm',
      className,
    )}>
      {/* Browser chrome — light */}
      <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 border-b border-slate-200">
        <div className="flex gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
          <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
          <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
        </div>
        <div className="flex-1 mx-2">
          <div className="bg-white rounded-md px-3 py-1 text-[10px] text-slate-500 font-mono truncate border border-slate-200">
            {URL_LABELS[type]}
          </div>
        </div>
      </div>

      {/* Content area */}
      <div className="p-3 h-[260px] relative">
        {type === 'recording' && <RecordingDemo />}
        {type === 'test-builder' && <TestBuilderDemo />}
        {type === 'api-testing' && <APITestingDemo />}
        {type === 'accessibility' && <AccessibilityDemo />}
      </div>
    </div>
  )
}

// ── Smart Trace Demo: simulates capturing clicks on a page ──

function RecordingDemo() {
  return (
    <div className="flex gap-2 h-full">
      {/* Left: simulated page */}
      <div className="flex-1 bg-slate-50 rounded-lg p-3 relative overflow-hidden border border-slate-200">
        <div className="h-2.5 w-20 bg-blue-500 rounded-sm mb-3" />
        <div className="space-y-2">
          <div className="h-2 w-32 bg-slate-200 rounded-sm" />
          <div className="h-7 w-full bg-white rounded border border-slate-200 flex items-center px-2">
            <span className="text-[9px] text-slate-400">user@example.com</span>
          </div>
          <div className="h-7 w-full bg-white rounded border border-slate-200 flex items-center px-2">
            <span className="text-[9px] text-slate-400">••••••••</span>
          </div>
          <div className="h-7 w-24 bg-blue-500 rounded flex items-center justify-center animate-pulse">
            <span className="text-[9px] text-white font-medium">Log In</span>
          </div>
        </div>
        {/* Animated cursor */}
        <div className="absolute animate-cursorMove">
          <MousePointer2 className="w-4 h-4 text-blue-600 drop-shadow-md" />
        </div>
        {/* Click ripple */}
        <div className="absolute top-[130px] left-[50px] animate-ripple">
          <div className="w-5 h-5 rounded-full border-2 border-blue-400 opacity-0" />
        </div>
        {/* Recording indicator */}
        <div className="absolute top-2 right-2 flex items-center gap-1 bg-red-500 rounded-full px-2 py-0.5">
          <Circle className="w-2 h-2 fill-white text-white animate-pulse" />
          <span className="text-[8px] text-white font-medium">REC</span>
        </div>
      </div>

      {/* Right: step list */}
      <div className="w-[120px] bg-slate-50 rounded-lg p-2 space-y-1.5 border border-slate-200">
        <div className="text-[8px] text-slate-500 font-semibold mb-2">STEPS</div>
        {[
          { text: 'Navigate to URL', delay: '0s' },
          { text: 'Fill email field', delay: '0.5s' },
          { text: 'Fill password', delay: '1s' },
          { text: 'Click "Log In"', delay: '1.5s' },
        ].map((step, i) => (
          <div
            key={i}
            className="flex items-center gap-1.5 animate-fadeSlideIn opacity-0"
            style={{ animationDelay: step.delay }}
          >
            <CheckCircle2 className="w-2.5 h-2.5 text-green-500 flex-shrink-0" />
            <span className="text-[8px] text-slate-600 truncate">{step.text}</span>
          </div>
        ))}
        <div className="flex items-center gap-1.5 animate-fadeSlideIn opacity-0" style={{ animationDelay: '2.5s' }}>
          <div className="w-2.5 h-2.5 rounded-full border border-amber-400 animate-pulse flex-shrink-0" />
          <span className="text-[8px] text-amber-500 truncate">Waiting...</span>
        </div>
      </div>
    </div>
  )
}

// ── Visual Builder Demo: no-code workflow blocks ──

function TestBuilderDemo() {
  return (
    <div className="flex gap-2 h-full">
      {/* Left: block palette */}
      <div className="w-[90px] bg-slate-50 rounded-lg p-2 space-y-1.5 border border-slate-200">
        <div className="text-[8px] text-slate-500 font-semibold mb-1">ACTIONS</div>
        {[
          { icon: Globe, label: 'Navigate', color: 'text-blue-500' },
          { icon: MousePointer2, label: 'Click', color: 'text-green-500' },
          { icon: Code2, label: 'Fill Input', color: 'text-purple-500' },
          { icon: Eye, label: 'Assert', color: 'text-amber-500' },
          { icon: Zap, label: 'Wait', color: 'text-cyan-500' },
        ].map(({ icon: Icon, label, color }, i) => (
          <div key={i} className="flex items-center gap-1.5 bg-white rounded px-1.5 py-1 border border-slate-200 cursor-grab hover:border-slate-300 transition-colors">
            <Icon className={cn('w-2.5 h-2.5', color)} />
            <span className="text-[8px] text-slate-600">{label}</span>
          </div>
        ))}
      </div>

      {/* Right: canvas with blocks */}
      <div className="flex-1 bg-slate-50 rounded-lg p-2 border border-slate-200">
        <div className="text-[8px] text-slate-500 font-semibold mb-2">WORKFLOW</div>
        <div className="space-y-1.5">
          {[
            { icon: Globe, text: 'Go to https://app.example.com', color: 'border-blue-300 bg-blue-50', iconColor: 'text-blue-500' },
            { icon: MousePointer2, text: 'Click "Login" button', color: 'border-green-300 bg-green-50', iconColor: 'text-green-500' },
            { icon: Code2, text: 'Fill "Email" with ${email}', color: 'border-purple-300 bg-purple-50', iconColor: 'text-purple-500' },
            { icon: Code2, text: 'Fill "Password" with ${pass}', color: 'border-purple-300 bg-purple-50', iconColor: 'text-purple-500' },
            { icon: MousePointer2, text: 'Click "Submit"', color: 'border-green-300 bg-green-50', iconColor: 'text-green-500' },
            { icon: Eye, text: 'Assert "Dashboard" visible', color: 'border-amber-300 bg-amber-50', iconColor: 'text-amber-500' },
          ].map(({ icon: Icon, text, color, iconColor }, i) => (
            <div
              key={i}
              className={cn(
                'flex items-center gap-1.5 rounded border px-2 py-1 animate-fadeSlideIn opacity-0',
                color,
              )}
              style={{ animationDelay: `${i * 0.3}s` }}
            >
              <Icon className={cn('w-2.5 h-2.5 flex-shrink-0', iconColor)} />
              <span className="text-[8px] text-slate-700 truncate">{text}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── API Testing Demo: request/response flow ──

function APITestingDemo() {
  return (
    <div className="space-y-2 h-full">
      {/* Request */}
      <div className="bg-slate-50 rounded-lg p-2 border border-slate-200">
        <div className="flex items-center gap-2 mb-1.5">
          <span className="text-[9px] font-bold text-green-600 bg-green-50 rounded px-1.5 py-0.5 border border-green-200">POST</span>
          <span className="text-[9px] text-slate-600 font-mono">/api/v1/users</span>
          <div className="ml-auto">
            <Send className="w-3 h-3 text-blue-500 animate-sendPulse" />
          </div>
        </div>
        <div className="bg-white rounded p-1.5 font-mono text-[8px] text-slate-500 border border-slate-100">
          <span className="text-purple-500">{'{'}</span>
          <span className="text-blue-600">"name"</span>: <span className="text-green-600">"Jane"</span>,{' '}
          <span className="text-blue-600">"email"</span>: <span className="text-green-600">"j@co.io"</span>
          <span className="text-purple-500">{'}'}</span>
        </div>
      </div>

      {/* Response */}
      <div className="bg-slate-50 rounded-lg p-2 border border-slate-200 animate-fadeSlideIn opacity-0" style={{ animationDelay: '1s' }}>
        <div className="flex items-center gap-2 mb-1.5">
          <span className="text-[9px] font-bold text-green-600">201 Created</span>
          <span className="text-[8px] text-slate-400">142ms</span>
        </div>
        <div className="bg-white rounded p-1.5 font-mono text-[8px] text-slate-500 border border-slate-100">
          <span className="text-purple-500">{'{'}</span>
          <span className="text-blue-600">"id"</span>: <span className="text-amber-600">42</span>,{' '}
          <span className="text-blue-600">"status"</span>: <span className="text-green-600">"active"</span>
          <span className="text-purple-500">{'}'}</span>
        </div>
      </div>

      {/* Assertions */}
      <div className="bg-slate-50 rounded-lg p-2 border border-slate-200 animate-fadeSlideIn opacity-0" style={{ animationDelay: '1.8s' }}>
        <div className="text-[8px] text-slate-500 font-semibold mb-1">ASSERTIONS</div>
        <div className="space-y-1">
          {[
            'Status code = 201',
            'Response time < 500ms',
            'Body contains "id"',
            'Schema validates',
          ].map((text, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <CheckCircle2 className="w-2.5 h-2.5 text-green-500" />
              <span className="text-[8px] text-slate-600">{text}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Accessibility Demo: WCAG scan results ──

function AccessibilityDemo() {
  return (
    <div className="space-y-2 h-full">
      {/* Scan header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="w-3.5 h-3.5 text-blue-500" />
          <span className="text-[10px] text-slate-700 font-semibold">WCAG 2.1 AA Scan</span>
        </div>
        <div className="flex items-center gap-1 animate-fadeSlideIn opacity-0" style={{ animationDelay: '0.5s' }}>
          <div className="w-2 h-2 rounded-full bg-green-500" />
          <span className="text-[8px] text-green-600 font-medium">Complete</span>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-1.5">
        {[
          { label: 'Critical', count: 0, color: 'text-green-600', bg: 'bg-green-50 border-green-200' },
          { label: 'Serious', count: 2, color: 'text-red-600', bg: 'bg-red-50 border-red-200' },
          { label: 'Moderate', count: 5, color: 'text-amber-600', bg: 'bg-amber-50 border-amber-200' },
          { label: 'Minor', count: 3, color: 'text-blue-600', bg: 'bg-blue-50 border-blue-200' },
        ].map((s, i) => (
          <div key={i} className={cn('rounded-lg p-1.5 text-center border animate-fadeSlideIn opacity-0', s.bg)} style={{ animationDelay: `${0.3 + i * 0.2}s` }}>
            <div className={cn('text-sm font-bold', s.color)}>{s.count}</div>
            <div className="text-[7px] text-slate-500">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Issue list */}
      <div className="space-y-1.5">
        {[
          { severity: 'serious', rule: 'color-contrast', desc: 'Text has insufficient contrast', wcag: '1.4.3', icon: XCircle },
          { severity: 'serious', rule: 'image-alt', desc: 'Image missing alt attribute', wcag: '1.1.1', icon: AlertTriangle },
          { severity: 'moderate', rule: 'label', desc: 'Form input missing label', wcag: '1.3.1', icon: AlertTriangle },
          { severity: 'moderate', rule: 'link-name', desc: 'Link has no accessible name', wcag: '4.1.2', icon: AlertTriangle },
        ].map(({ severity, rule, desc, wcag, icon: Icon }, i) => (
          <div
            key={i}
            className="flex items-start gap-1.5 bg-slate-50 rounded p-1.5 border border-slate-200 animate-fadeSlideIn opacity-0"
            style={{ animationDelay: `${1 + i * 0.3}s` }}
          >
            <Icon className={cn('w-2.5 h-2.5 flex-shrink-0 mt-0.5', severity === 'serious' ? 'text-red-500' : 'text-amber-500')} />
            <div className="min-w-0">
              <div className="flex items-center gap-1">
                <span className={cn('text-[7px] font-bold uppercase', severity === 'serious' ? 'text-red-500' : 'text-amber-500')}>{severity}</span>
                <span className="text-[7px] text-slate-400">{rule}</span>
                <span className="text-[7px] text-slate-400">WCAG {wcag}</span>
              </div>
              <span className="text-[8px] text-slate-600">{desc}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default AnimatedDemo
