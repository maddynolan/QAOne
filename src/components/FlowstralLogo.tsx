/**
 * FlowstralLogo — Single source of truth for all Flowstral branding.
 *
 * "Flow Constellation" mark: three flowing bezier paths with constellation
 * nodes, evoking continuous motion (testing flows) and stellar precision.
 *
 * Usage:
 *   <FlowstralLogo />                      // default: mark + wordmark, md size
 *   <FlowstralLogo variant="mark" />        // icon only
 *   <FlowstralLogo variant="wordmark" />    // text only
 *   <FlowstralLogo size="sm" />             // 24px mark
 *   <FlowstralLogo size="lg" />             // 48px mark
 *   <FlowstralLogo size={64} />             // custom px
 *   <FlowstralLogo darkBg />               // force dark-background colors
 */

import { cn } from '@/lib/utils';

type LogoSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | number;
type LogoVariant = 'full' | 'mark' | 'wordmark';

interface FlowstralLogoProps {
  size?: LogoSize;
  variant?: LogoVariant;
  darkBg?: boolean;
  className?: string;
}

const SIZE_MAP: Record<string, number> = {
  xs: 20,
  sm: 24,
  md: 32,
  lg: 48,
  xl: 64,
};

const TEXT_SIZE_MAP: Record<string, string> = {
  xs: 'text-sm',
  sm: 'text-base',
  md: 'text-lg',
  lg: 'text-2xl',
  xl: 'text-3xl',
};

/** Inline SVG mark — no external file dependency, instant render */
function LogoMark({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 512 512"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="fLogo_flowGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#06B6D4" />
          <stop offset="50%" stopColor="#6366F1" />
          <stop offset="100%" stopColor="#8B5CF6" />
        </linearGradient>
        <linearGradient id="fLogo_nodeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#22D3EE" />
          <stop offset="100%" stopColor="#A78BFA" />
        </linearGradient>
      </defs>
      {/* Background */}
      <rect width="512" height="512" rx="100" fill="#0B0E14" />
      {/* Flow paths */}
      <g fill="none" stroke="url(#fLogo_flowGrad)" strokeLinecap="round" strokeLinejoin="round">
        <path d="M120 110 C180 110, 200 160, 220 210 S280 340, 340 380 Q370 396, 400 390" strokeWidth="28" opacity="1" />
        <path d="M110 256 C160 220, 220 290, 280 256 S380 220, 400 256" strokeWidth="24" opacity="0.8" />
        <path d="M120 400 C180 400, 200 350, 220 300 S280 170, 340 130 Q370 114, 400 120" strokeWidth="20" opacity="0.6" />
      </g>
      {/* Constellation nodes */}
      <circle cx="220" cy="210" r="12" fill="url(#fLogo_nodeGrad)" />
      <circle cx="280" cy="256" r="10" fill="url(#fLogo_nodeGrad)" opacity="0.9" />
      <circle cx="340" cy="300" r="8" fill="url(#fLogo_nodeGrad)" opacity="0.7" />
      <circle cx="160" cy="256" r="5" fill="#22D3EE" opacity="0.5" />
      <circle cx="370" cy="180" r="5" fill="#A78BFA" opacity="0.5" />
      <circle cx="360" cy="350" r="4" fill="#A78BFA" opacity="0.4" />
    </svg>
  );
}

export default function FlowstralLogo({
  size = 'md',
  variant = 'full',
  darkBg = false,
  className,
}: FlowstralLogoProps) {
  const px = typeof size === 'number' ? size : (SIZE_MAP[size] ?? 32);
  const textCls = typeof size === 'number' ? 'text-lg' : (TEXT_SIZE_MAP[size] ?? 'text-lg');

  // Text colors: on dark backgrounds always white/cyan, otherwise slate/indigo
  const flowCls = darkBg ? 'text-white' : 'text-slate-900 dark:text-white';
  const stralCls = darkBg ? 'text-cyan-400' : 'text-indigo-600 dark:text-cyan-400';

  if (variant === 'mark') {
    return <LogoMark size={px} className={cn('shrink-0 rounded-lg', className)} />;
  }

  if (variant === 'wordmark') {
    return (
      <span className={cn('font-semibold tracking-tight', textCls, className)}>
        <span className={flowCls}>Flow</span>
        <span className={stralCls}>stral</span>
      </span>
    );
  }

  // variant === 'full'
  return (
    <div className={cn('flex items-center gap-2.5 shrink-0', className)}>
      <LogoMark size={px} className="rounded-lg" />
      <span className={cn('font-semibold tracking-tight', textCls)}>
        <span className={flowCls}>Flow</span>
        <span className={stralCls}>stral</span>
      </span>
    </div>
  );
}

export { LogoMark, FlowstralLogo };
