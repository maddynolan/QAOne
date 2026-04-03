/**
 * AnimatedDemo — Pure CSS animated product demos for marketing pages.
 *
 * Renders realistic animated mockups of Flowstral features using CSS
 * animations. Zero external file dependencies — loads instantly.
 *
 * Each demo type shows a different feature with looping animation:
 * - recording: Browser recording with click indicators + step list
 * - test-builder: No-code builder with drag-and-drop blocks
 * - api-testing: API request/response with assertions
 * - accessibility: WCAG scan with issue cards
 */

import React from 'react'
import { cn } from '@/lib/utils'
import {
  Play, Circle, MousePointer2, CheckCircle2, XCircle,
  Globe, ArrowRight, Shield, AlertTriangle, Zap,
  Code2, Send, LayoutGrid, Eye
} from 'lucide-react'

type DemoType = 'recording' | 'test-builder' | 'api-testing' | 'accessibility'

interface AnimatedDemoProps {
  type: DemoType
  className?: string
}

export function AnimatedDemo({ type, className }: AnimatedDemoProps) {
  return (
    <div className={cn(
      'relative overflow-hidden bg-slate-900 rounded-xl border border-slate-700/50',
      className,
    )}>
      {/* Browser chrome */}
      <div className="flex items-center gap-2 px-3 py-2 bg-slate-800 border-b border-slate-700/50">
        <div className="flex gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-red-400/80" />
          <div className="w-2.5 h-2.5 rounded-full bg-amber-400/80" />
          <div className="w-2.5 h-2.5 rounded-full bg-green-400/80" />
        </div>
        <div className="flex-1 mx-2">
          <div className="bg-slate-700/50 rounded-md px-3 py-1 text-[10px] text-slate-400 font-mono truncate">
            {type === 'recording' && 'flowstral.com/recorder'}
            {type === 'test-builder' && 'flowstral.com/builder'}
            {type === 'api-testing' && 'flowstral.com/api-testing'}
            {type === 'accessibility' && 'flowstral.com/accessibility'}
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

// ── Recording Demo: simulates capturing clicks on a page ──

function RecordingDemo() {
  return (
    <div className="flex gap-2 h-full">
      {/* Left: simulated page */}
      <div className="flex-1 bg-white rounded-lg p-3 relative overflow-hidden">
        <div className="h-2.5 w-20 bg-blue-500 rounded-sm mb-3" />
        <div className="space-y-2">
          <div className="h-2 w-32 bg-slate-200 rounded-sm" />
          <div className="h-7 w-full bg-slate-100 rounded border border-slate-200 flex items-center px-2">
            <span className="text-[9px] text-slate-400">user@example.com</span>
          </div>
          <div className="h-7 w-full bg-slate-100 rounded border border-slate-200 flex items-center px-2">
            <span className="text-[9px] text-slate-400">••••••••</span>
          </div>
          <div className="h-7 w-24 bg-blue-500 rounded flex items-center justify-center animate-pulse">
            <span className="text-[9px] text-white font-medium">Log In</span>
          </div>
        </div>
        {/* Animated cursor */}
        <div className="absolute animate-[cursorMove_4s_ease-in-out_infinite]">
          <MousePointer2 className="w-4 h-4 text-blue-600 drop-shadow-md" />
        </div>
        {/* Click ripple */}
        <div className="absolute top-[130px] left-[50px] animate-[ripple_4s_ease-in-out_infinite]">
          <div className="w-5 h-5 rounded-full border-2 border-blue-400 opacity-0 animate-[ping_4s_ease-in-out_infinite]" />
        </div>
        {/* Recording indicator */}
        <div className="absolute top-2 right-2 flex items-center gap-1 bg-red-500 rounded-full px-2 py-0.5">
          <Circle className="w-2 h-2 fill-white text-white animate-pulse" />
          <span className="text-[8px] text-white font-medium">REC</span>
        </div>
      </div>

      {/* Right: step list */}
      <div className="w-[120px] bg-slate-800 rounded-lg p-2 space-y-1.5">
        <div className="text-[8px] text-slate-400 font-medium mb-2">STEPS</div>
        {[
          { text: 'Navigate to URL', delay: '0s' },
          { text: 'Fill email field', delay: '0.5s' },
          { text: 'Fill password', delay: '1s' },
          { text: 'Click "Log In"', delay: '1.5s' },
        ].map((step, i) => (
          <div
            key={i}
            className="flex items-center gap-1.5 animate-[fadeSlideIn_0.5s_ease-out_forwards] opacity-0"
            style={{ animationDelay: step.delay }}
          >
            <CheckCircle2 className="w-2.5 h-2.5 text-green-400 flex-shrink-0" />
            <span className="text-[8px] text-slate-300 truncate">{step.text}</span>
          </div>
        ))}
        <div className="flex items-center gap-1.5 animate-[fadeSlideIn_0.5s_ease-out_forwards] opacity-0" style={{ animationDelay: '2.5s' }}>
          <div className="w-2.5 h-2.5 rounded-full border border-amber-400 animate-pulse flex-shrink-0" />
          <span className="text-[8px] text-amber-300 truncate">Waiting...</span>
        </div>
      </div>
    </div>
  )
}

// ── Test Builder Demo: visual no-code blocks ──

function TestBuilderDemo() {
  return (
    <div className="flex gap-2 h-full">
      {/* Left: block palette */}
      <div className="w-[90px] bg-slate-800 rounded-lg p-2 space-y-1.5">
        <div className="text-[8px] text-slate-400 font-medium mb-1">ACTIONS</div>
        {[
          { icon: Globe, label: 'Navigate', color: 'text-blue-400' },
          { icon: MousePointer2, label: 'Click', color: 'text-green-400' },
          { icon: Code2, label: 'Fill Input', color: 'text-purple-400' },
          { icon: Eye, label: 'Assert', color: 'text-amber-400' },
          { icon: Zap, label: 'Wait', color: 'text-cyan-400' },
        ].map(({ icon: Icon, label, color }, i) => (
          <div key={i} className="flex items-center gap-1.5 bg-slate-700/50 rounded px-1.5 py-1 cursor-grab hover:bg-slate-700 transition-colors">
            <Icon className={cn('w-2.5 h-2.5', color)} />
            <span className="text-[8px] text-slate-300">{label}</span>
          </div>
        ))}
      </div>

      {/* Right: canvas with blocks */}
      <div className="flex-1 bg-slate-800/50 rounded-lg p-2 relative">
        <div className="text-[8px] text-slate-400 font-medium mb-2">WORKFLOW</div>
        <div className="space-y-1">
          {[
            { icon: Globe, text: 'Go to https://app.example.com', color: 'border-blue-500/50 bg-blue-500/10', iconColor: 'text-blue-400' },
            { icon: MousePointer2, text: 'Click "Login" button', color: 'border-green-500/50 bg-green-500/10', iconColor: 'text-green-400' },
            { icon: Code2, text: 'Fill "Email" with ${email}', color: 'border-purple-500/50 bg-purple-500/10', iconColor: 'text-purple-400' },
            { icon: Code2, text: 'Fill "Password" with ${pass}', color: 'border-purple-500/50 bg-purple-500/10', iconColor: 'text-purple-400' },
            { icon: MousePointer2, text: 'Click "Submit"', color: 'border-green-500/50 bg-green-500/10', iconColor: 'text-green-400' },
            { icon: Eye, text: 'Assert "Dashboard" visible', color: 'border-amber-500/50 bg-amber-500/10', iconColor: 'text-amber-400' },
          ].map(({ icon: Icon, text, color, iconColor }, i) => (
            <div
              key={i}
              className={cn(
                'flex items-center gap-1.5 rounded border px-2 py-1 animate-[fadeSlideIn_0.4s_ease-out_forwards] opacity-0',
                color,
              )}
              style={{ animationDelay: `${i * 0.3}s` }}
            >
              <Icon className={cn('w-2.5 h-2.5 flex-shrink-0', iconColor)} />
              <span className="text-[8px] text-slate-200 truncate">{text}</span>
            </div>
          ))}
        </div>
        {/* Connection lines */}
        <div className="absolute left-[22px] top-[30px] w-px h-[calc(100%-40px)] bg-gradient-to-b from-blue-500/30 via-green-500/30 to-amber-500/30" />
      </div>
    </div>
  )
}

// ── API Testing Demo: request/response flow ──

function APITestingDemo() {
  return (
    <div className="space-y-2 h-full">
      {/* Request */}
      <div className="bg-slate-800 rounded-lg p-2">
        <div className="flex items-center gap-2 mb-1.5">
          <span className="text-[9px] font-bold text-green-400 bg-green-400/10 rounded px-1.5 py-0.5">POST</span>
          <span className="text-[9px] text-slate-300 font-mono">/api/v1/users</span>
          <div className="ml-auto">
            <Send className="w-3 h-3 text-blue-400 animate-[sendPulse_3s_ease-in-out_infinite]" />
          </div>
        </div>
        <div className="bg-slate-900/50 rounded p-1.5 font-mono text-[8px] text-slate-400">
          <span className="text-purple-400">{'{'}</span>
          <span className="text-blue-300">"name"</span>: <span className="text-green-300">"Jane"</span>,
          <span className="text-blue-300">"email"</span>: <span className="text-green-300">"j@co.io"</span>
          <span className="text-purple-400">{'}'}</span>
        </div>
      </div>

      {/* Response */}
      <div className="bg-slate-800 rounded-lg p-2 animate-[fadeSlideIn_0.5s_ease-out_forwards_1s] opacity-0">
        <div className="flex items-center gap-2 mb-1.5">
          <span className="text-[9px] font-bold text-green-400">201 Created</span>
          <span className="text-[8px] text-slate-500">142ms</span>
        </div>
        <div className="bg-slate-900/50 rounded p-1.5 font-mono text-[8px] text-slate-400">
          <span className="text-purple-400">{'{'}</span>
          <span className="text-blue-300">"id"</span>: <span className="text-amber-300">42</span>,
          <span className="text-blue-300">"status"</span>: <span className="text-green-300">"active"</span>
          <span className="text-purple-400">{'}'}</span>
        </div>
      </div>

      {/* Assertions */}
      <div className="bg-slate-800 rounded-lg p-2 animate-[fadeSlideIn_0.5s_ease-out_forwards_1.8s] opacity-0">
        <div className="text-[8px] text-slate-400 font-medium mb-1">ASSERTIONS</div>
        <div className="space-y-1">
          {[
            { text: 'Status code = 201', pass: true },
            { text: 'Response time < 500ms', pass: true },
            { text: 'Body contains "id"', pass: true },
            { text: 'Schema validates', pass: true },
          ].map((a, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <CheckCircle2 className="w-2.5 h-2.5 text-green-400" />
              <span className="text-[8px] text-slate-300">{a.text}</span>
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
          <Shield className="w-3.5 h-3.5 text-blue-400" />
          <span className="text-[10px] text-slate-200 font-medium">WCAG 2.1 AA Scan</span>
        </div>
        <div className="flex items-center gap-1 animate-[fadeSlideIn_0.5s_ease-out_forwards_0.5s] opacity-0">
          <div className="w-2 h-2 rounded-full bg-green-400" />
          <span className="text-[8px] text-green-400">Complete</span>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-1.5">
        {[
          { label: 'Critical', count: 0, color: 'text-green-400', bg: 'bg-green-400/10' },
          { label: 'Serious', count: 2, color: 'text-red-400', bg: 'bg-red-400/10' },
          { label: 'Moderate', count: 5, color: 'text-amber-400', bg: 'bg-amber-400/10' },
          { label: 'Minor', count: 3, color: 'text-blue-400', bg: 'bg-blue-400/10' },
        ].map((s, i) => (
          <div key={i} className={cn('rounded-lg p-1.5 text-center animate-[fadeSlideIn_0.3s_ease-out_forwards] opacity-0', s.bg)} style={{ animationDelay: `${0.3 + i * 0.2}s` }}>
            <div className={cn('text-sm font-bold', s.color)}>{s.count}</div>
            <div className="text-[7px] text-slate-400">{s.label}</div>
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
            className="flex items-start gap-1.5 bg-slate-800 rounded p-1.5 animate-[fadeSlideIn_0.4s_ease-out_forwards] opacity-0"
            style={{ animationDelay: `${1 + i * 0.3}s` }}
          >
            <Icon className={cn('w-2.5 h-2.5 flex-shrink-0 mt-0.5', severity === 'serious' ? 'text-red-400' : 'text-amber-400')} />
            <div className="min-w-0">
              <div className="flex items-center gap-1">
                <span className={cn('text-[7px] font-bold uppercase', severity === 'serious' ? 'text-red-400' : 'text-amber-400')}>{severity}</span>
                <span className="text-[7px] text-slate-500">{rule}</span>
                <span className="text-[7px] text-slate-600">WCAG {wcag}</span>
              </div>
              <span className="text-[8px] text-slate-300">{desc}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── CSS Animations (add to your global CSS or Tailwind config) ──
// These are defined as inline keyframes via Tailwind's arbitrary values

export default AnimatedDemo
