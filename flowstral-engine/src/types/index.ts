/**
 * Flowstral - Enterprise Application Playwright Script Generator
 * Core Types and Interfaces
 */

// ============================================================================
// Application Detection Types
// ============================================================================

export type EnterpriseApplication =
  | 'salesforce'
  | 'workday'
  | 'servicenow'
  | 'sap'
  | 'pega'
  | 'oracle-fusion'
  | 'dynamics365'
  | 'netsuite'
  | 'successfactors'
  | 'concur'
  | 'veeva'
  | 'coupa'
  | 'ariba'
  | 'zendesk'
  | 'hubspot'
  | 'zoho'
  | 'freshworks'
  | 'anaplan'
  | 'snowflake'
  | 'tableau'
  | 'power-bi'
  | 'jira'
  | 'confluence'
  | 'monday'
  | 'asana'
  | 'unknown';

export interface ApplicationFingerprint {
  application: EnterpriseApplication;
  version?: string;
  framework?: string;
  confidence: number;
  detectionMethod: DetectionMethod;
  shadowDomEnabled: boolean;
  lightningEnabled?: boolean; // Salesforce specific
  customComponents?: string[];
}

export type DetectionMethod =
  | 'url-pattern'
  | 'dom-signature'
  | 'meta-tags'
  | 'global-objects'
  | 'css-variables'
  | 'custom-elements';

// ============================================================================
// Element and Locator Types
// ============================================================================

export interface RecordedElement {
  tagName: string;
  id?: string;
  className?: string;
  name?: string;
  type?: string;
  text?: string;
  placeholder?: string;
  ariaLabel?: string;
  ariaLabelledBy?: string;
  ariaDescribedBy?: string;
  role?: string;
  dataAttributes: Record<string, string>;
  customAttributes: Record<string, string>;
  xpath: string;
  cssSelector: string;
  shadowPath?: ShadowPathSegment[];
  boundingRect: BoundingRect;
  isVisible: boolean;
  isEnabled: boolean;
  parentInfo?: ParentElementInfo;
  siblings?: SiblingInfo[];
  nearbyLabels?: LabelInfo[];
  framePath?: string[];
  timestamp: number;
}

export interface ShadowPathSegment {
  hostSelector: string;
  shadowSelector: string;
  depth: number;
}

export interface BoundingRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ParentElementInfo {
  tagName: string;
  id?: string;
  className?: string;
  role?: string;
  level: number;
}

export interface SiblingInfo {
  position: 'before' | 'after';
  tagName: string;
  text?: string;
  index: number;
}

export interface LabelInfo {
  text: string;
  position: 'left' | 'right' | 'above' | 'below';
  distance: number;
  forAttribute?: string;
}

// ============================================================================
// Locator Strategy Types
// ============================================================================

export interface LocatorStrategy {
  type: LocatorType;
  value: string;
  priority: number;
  confidence: number;
  isStable: boolean;
  isSemantic: boolean;
  applicationSpecific: boolean;
  requiresShadowDom: boolean;
  playwrightCode: string;
}

export type LocatorType =
  | 'role'
  | 'text'
  | 'label'
  | 'placeholder'
  | 'testid'
  | 'data-attribute'
  | 'aria'
  | 'css'
  | 'xpath'
  | 'frame-locator'
  | 'shadow-locator'
  | 'chained'
  | 'filtered'
  | 'nth'
  | 'custom-component';

export interface AutoHealingLocator {
  primary: LocatorStrategy;
  fallbacks: LocatorStrategy[];
  elementSignature: ElementSignature;
  healingMetadata: HealingMetadata;
}

export interface ElementSignature {
  tagName: string;
  textContent?: string;
  visualPosition: VisualPosition;
  attributes: StableAttribute[];
  contextualHints: ContextualHint[];
  semanticRole?: string;
}

export interface VisualPosition {
  relativeToViewport: 'top' | 'middle' | 'bottom';
  relativeToParent: 'first' | 'middle' | 'last';
  approximateLocation: { x: number; y: number };
}

export interface StableAttribute {
  name: string;
  value: string;
  stability: 'high' | 'medium' | 'low';
}

export interface ContextualHint {
  type: 'nearby-text' | 'parent-context' | 'sibling-relation' | 'form-context';
  value: string;
  reliability: number;
}

export interface HealingMetadata {
  lastValidated: number;
  healingAttempts: number;
  successfulHeals: number;
  lastHealStrategy?: LocatorType;
}

// ============================================================================
// Action Types
// ============================================================================

export type ActionType =
  | 'click'
  | 'dblclick'
  | 'rightclick'
  | 'fill'
  | 'type'
  | 'clear'
  | 'select'
  | 'check'
  | 'uncheck'
  | 'hover'
  | 'focus'
  | 'blur'
  | 'press'
  | 'upload'
  | 'drag'
  | 'scroll'
  | 'wait'
  | 'navigate'
  | 'screenshot'
  | 'assert';

export interface RecordedAction {
  id: string;
  type: ActionType;
  element?: RecordedElement;
  value?: string | string[];
  key?: string;
  modifiers?: string[];
  targetUrl?: string;
  waitCondition?: WaitCondition;
  timestamp: number;
  duration?: number;
  screenshot?: string;
}

export interface WaitCondition {
  type: 'visible' | 'hidden' | 'enabled' | 'disabled' | 'stable' | 'networkidle' | 'custom';
  timeout?: number;
  customCondition?: string;
}

// ============================================================================
// Script Generation Types
// ============================================================================

export interface GeneratedScript {
  language: 'typescript' | 'javascript';
  framework: 'playwright';
  code: string;
  imports: string[];
  helpers: HelperFunction[];
  pageObjects?: PageObjectModel[];
  testCases: TestCase[];
}

export interface HelperFunction {
  name: string;
  code: string;
  description: string;
}

export interface PageObjectModel {
  name: string;
  elements: PageObjectElement[];
  actions: PageObjectAction[];
}

export interface PageObjectElement {
  name: string;
  locator: AutoHealingLocator;
  description?: string;
}

export interface PageObjectAction {
  name: string;
  steps: string[];
  parameters?: ActionParameter[];
}

export interface ActionParameter {
  name: string;
  type: string;
  required: boolean;
  defaultValue?: string;
}

export interface TestCase {
  name: string;
  description?: string;
  steps: TestStep[];
  assertions: Assertion[];
}

export interface TestStep {
  action: RecordedAction;
  locator: AutoHealingLocator;
  generatedCode: string;
  comment?: string;
}

export interface Assertion {
  type: 'visible' | 'hidden' | 'text' | 'value' | 'attribute' | 'count' | 'url' | 'title';
  locator?: AutoHealingLocator;
  expected: string | number | boolean;
  generatedCode: string;
}

// ============================================================================
// Application-Specific Configuration Types
// ============================================================================

export interface ApplicationConfig {
  application: EnterpriseApplication;
  shadowDomStrategy: ShadowDomStrategy;
  waitStrategies: ApplicationWaitStrategy[];
  locatorPriorities: LocatorType[];
  customSelectors: CustomSelectorPattern[];
  frameHandling: FrameHandlingConfig;
  componentPatterns: ComponentPattern[];
  antiPatterns: AntiPattern[];
  stabilityWait: number;
  networkIdleTimeout: number;
}

export interface ShadowDomStrategy {
  enabled: boolean;
  piercing: boolean;
  hostSelectors: string[];
  traversalMethod: 'evaluate' | 'locator-chain' | 'custom';
}

export interface ApplicationWaitStrategy {
  trigger: string;
  waitFor: WaitCondition;
  description: string;
}

export interface CustomSelectorPattern {
  name: string;
  pattern: RegExp;
  locatorTemplate: string;
  priority: number;
}

export interface FrameHandlingConfig {
  hasIframes: boolean;
  frameIdentifiers: FrameIdentifier[];
  nestedFrameStrategy: 'sequential' | 'parallel';
}

export interface FrameIdentifier {
  name?: string;
  src?: RegExp;
  title?: string;
  index?: number;
}

export interface ComponentPattern {
  name: string;
  selector: string;
  innerElementStrategies: LocatorType[];
  waitAfterInteraction?: number;
}

export interface AntiPattern {
  description: string;
  pattern: string | RegExp;
  alternative: string;
  reason: string;
}

// ============================================================================
// Recording Session Types
// ============================================================================

export interface RecordingSession {
  id: string;
  startTime: number;
  endTime?: number;
  application: ApplicationFingerprint;
  baseUrl: string;
  actions: RecordedAction[];
  pageTransitions: PageTransition[];
  errors: RecordingError[];
  metadata: SessionMetadata;
}

export interface PageTransition {
  fromUrl: string;
  toUrl: string;
  timestamp: number;
  type: 'navigation' | 'spa-route' | 'popup' | 'new-tab';
}

export interface RecordingError {
  timestamp: number;
  type: 'element-not-found' | 'timeout' | 'frame-detached' | 'navigation-error';
  message: string;
  recoveryAction?: string;
}

export interface SessionMetadata {
  browserType: string;
  browserVersion: string;
  viewportSize: { width: number; height: number };
  userAgent: string;
  locale: string;
  timezone: string;
}
