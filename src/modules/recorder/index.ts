/**
 * @module recorder
 *
 * Browser test recording, playback, and AI self-healing automation.
 *
 * Features:
 * - Playwright & CDP browser recording
 * - AI-powered self-healing (4-layer healing chain)
 * - Element repair wizard & manual assist
 * - Selector confidence scoring
 * - Test code generation (Playwright scripts)
 * - False positive detection & management
 */

// Pages
export { default as PlaywrightRecorderPage } from './pages/PlaywrightRecorderPage';
export { default as SelfHealing } from './pages/SelfHealing';
export { default as ElementRepository } from './pages/ElementRepository';

// Components
export { default as ManualAssistCard } from './components/ManualAssistCard';
export { default as ElementRepairWizard } from './components/ElementRepairWizard';
export { default as AITestGenerator } from './components/AITestGenerator';
export { default as QuickRerecordModal } from './components/QuickRerecordModal';
export { default as BlackboxLocatorStrategies } from './components/BlackboxLocatorStrategies';
export { default as StepAutomationLinker } from './components/StepAutomationLinker';
export { default as SmartFillDialog } from './components/SmartFillDialog';

// Confidence sub-components
export { ConfidenceBadge } from './components/confidence';
export { MatchCountBadge } from './components/confidence';
export { StepConfidenceIndicator } from './components/confidence';
