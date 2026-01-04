/**
 * AI Button Component
 * 
 * Reusable button that shows AI capabilities when enabled.
 * Automatically hidden when AI is disabled in settings.
 * 
 * Usage:
 *   <AIButton
 *     featureId="test_case_generation"
 *     onClick={handleGenerateTests}
 *     label="Generate Tests"
 *   />
 */

import { Button } from '@/components/ui/button';
import { Sparkles, Loader2 } from 'lucide-react';
import { useAI, type AIFeatureId } from '@/contexts/AIContext';
import { cn } from '@/lib/utils';

interface AIButtonProps {
  featureId: AIFeatureId;
  onClick: () => void | Promise<void>;
  label: string;
  variant?: 'default' | 'outline' | 'ghost' | 'secondary';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  className?: string;
  loading?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
}

export function AIButton({
  featureId,
  onClick,
  label,
  variant = 'outline',
  size = 'default',
  className,
  loading = false,
  disabled = false,
  icon
}: AIButtonProps) {
  const { isFeatureEnabled, status } = useAI();
  
  // Don't render if feature is disabled
  if (!isFeatureEnabled(featureId)) {
    return null;
  }
  
  const isDisabled = disabled || loading || !status.connected;
  
  return (
    <Button
      variant={variant}
      size={size}
      onClick={onClick}
      disabled={isDisabled}
      className={cn(
        'bg-gradient-to-r from-purple-500/10 to-blue-500/10 hover:from-purple-500/20 hover:to-blue-500/20',
        'border-purple-500/30 hover:border-purple-500/50',
        'text-purple-400 hover:text-purple-300',
        className
      )}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
      ) : icon ? (
        <span className="mr-2">{icon}</span>
      ) : (
        <Sparkles className="h-4 w-4 mr-2" />
      )}
      {label}
    </Button>
  );
}

/**
 * AI Inline Badge - Small indicator for AI-powered features
 */
export function AIInlineBadge({ featureId }: { featureId: AIFeatureId }) {
  const { isFeatureEnabled } = useAI();
  
  if (!isFeatureEnabled(featureId)) {
    return null;
  }
  
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium rounded bg-purple-500/20 text-purple-400 border border-purple-500/30">
      <Sparkles className="h-2.5 w-2.5" />
      AI
    </span>
  );
}

/**
 * AI Panel - Collapsible panel for AI features
 */
interface AIPanelProps {
  featureId: AIFeatureId;
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}

export function AIPanel({ featureId, title, description, children, className }: AIPanelProps) {
  const { isFeatureEnabled, status } = useAI();
  
  if (!isFeatureEnabled(featureId)) {
    return null;
  }
  
  return (
    <div className={cn(
      'p-4 rounded-lg border',
      'bg-gradient-to-br from-purple-500/5 to-blue-500/5',
      'border-purple-500/20',
      className
    )}>
      <div className="flex items-center gap-2 mb-2">
        <Sparkles className="h-4 w-4 text-purple-500" />
        <span className="font-medium text-purple-400">{title}</span>
        {!status.connected && (
          <span className="text-xs text-muted-foreground">(not connected)</span>
        )}
      </div>
      {description && (
        <p className="text-sm text-muted-foreground mb-3">{description}</p>
      )}
      {children}
    </div>
  );
}

export default AIButton;

