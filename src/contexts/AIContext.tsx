/**
 * Global AI Context
 * 
 * Manages AI settings across the entire application.
 * When AI is disabled, all AI features are hidden.
 * When enabled, AI features appear throughout the app.
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { API_BASE_URL } from '@/lib/api-config';

// ============================================================================
// AI Feature Areas - All places where AI can be used
// ============================================================================
export const AI_FEATURE_AREAS = {
  // Test Generation
  TEST_CASE_GENERATION: {
    id: 'test_case_generation',
    name: 'Test Case Generation',
    description: 'Generate test cases from requirements or descriptions',
    pages: ['Tests', 'Requirements', 'Build'],
    icon: '🧪'
  },
  TEST_STEP_SUGGESTIONS: {
    id: 'test_step_suggestions',
    name: 'Test Step Suggestions',
    description: 'AI suggests next steps while building tests',
    pages: ['Build', 'Record'],
    icon: '💡'
  },
  
  // Self-Healing & Locators
  SELF_HEALING: {
    id: 'self_healing',
    name: 'Self-Healing Selectors',
    description: 'Automatically fix broken selectors using AI vision',
    pages: ['Record', 'Build', 'Tests'],
    icon: '🔧'
  },
  SMART_LOCATORS: {
    id: 'smart_locators',
    name: 'Smart Locator Generation',
    description: 'Generate robust locators using AI analysis',
    pages: ['Record', 'Build'],
    icon: '🎯'
  },
  
  // API Testing
  API_TEST_GENERATION: {
    id: 'api_test_generation',
    name: 'API Test Generation',
    description: 'Generate API tests from OpenAPI/Swagger specs',
    pages: ['API'],
    icon: '🔌'
  },
  API_MOCK_GENERATION: {
    id: 'api_mock_generation',
    name: 'API Mock Generation',
    description: 'Generate mock responses for virtual services',
    pages: ['API'],
    icon: '🎭'
  },
  
  // Performance
  PERF_ANALYSIS: {
    id: 'perf_analysis',
    name: 'Performance Analysis',
    description: 'AI analyzes load test results and suggests optimizations',
    pages: ['Perf'],
    icon: '📊'
  },
  LOAD_PATTERN_SUGGESTIONS: {
    id: 'load_pattern_suggestions',
    name: 'Load Pattern Suggestions',
    description: 'AI suggests optimal load test patterns',
    pages: ['Perf'],
    icon: '📈'
  },
  
  // Visual Testing
  VISUAL_ANALYSIS: {
    id: 'visual_analysis',
    name: 'Visual Analysis',
    description: 'AI-powered visual comparison and anomaly detection',
    pages: ['Visual'],
    icon: '👁️'
  },
  
  // Accessibility
  A11Y_SUGGESTIONS: {
    id: 'a11y_suggestions',
    name: 'Accessibility Suggestions',
    description: 'AI suggests accessibility fixes and improvements',
    pages: ['A11y'],
    icon: '♿'
  },
  
  // Defect Analysis
  DEFECT_ANALYSIS: {
    id: 'defect_analysis',
    name: 'Defect Analysis',
    description: 'AI analyzes failures and suggests root causes',
    pages: ['Tests', 'Defects'],
    icon: '🔍'
  },
  DEFECT_TRIAGE: {
    id: 'defect_triage',
    name: 'Defect Triage',
    description: 'AI prioritizes and categorizes defects',
    pages: ['Defects'],
    icon: '📋'
  },
  
  // Code Generation
  CODE_GENERATION: {
    id: 'code_generation',
    name: 'Code Generation',
    description: 'Generate Playwright/Cypress code from recordings',
    pages: ['Record', 'Alchemy'],
    icon: '💻'
  },
  CODE_OPTIMIZATION: {
    id: 'code_optimization',
    name: 'Code Optimization',
    description: 'AI optimizes and refactors test code',
    pages: ['Alchemy'],
    icon: '⚡'
  },
  
  // Requirements
  REQUIREMENT_ANALYSIS: {
    id: 'requirement_analysis',
    name: 'Requirement Analysis',
    description: 'Extract test scenarios from requirements',
    pages: ['Requirements'],
    icon: '📝'
  },
  GHERKIN_GENERATION: {
    id: 'gherkin_generation',
    name: 'Gherkin Generation',
    description: 'Generate BDD scenarios from requirements',
    pages: ['Requirements', 'Build'],
    icon: '🥒'
  },
  
  // Salesforce
  SF_TEST_GENERATION: {
    id: 'sf_test_generation',
    name: 'Salesforce Test Generation',
    description: 'Generate Salesforce-specific test cases',
    pages: ['SF'],
    icon: '☁️'
  },
  SF_DATA_GENERATION: {
    id: 'sf_data_generation',
    name: 'Salesforce Data Generation',
    description: 'AI generates realistic Salesforce test data',
    pages: ['SF'],
    icon: '📦'
  },
  
  // Smart Assistants
  CHAT_ASSISTANT: {
    id: 'chat_assistant',
    name: 'AI Chat Assistant',
    description: 'Interactive AI assistant for testing guidance',
    pages: ['All'],
    icon: '💬'
  },
  SMART_FILL: {
    id: 'smart_fill',
    name: 'Smart Form Fill',
    description: 'AI generates contextual test data for forms',
    pages: ['Record', 'Build'],
    icon: '✏️'
  }
} as const;

export type AIFeatureId = typeof AI_FEATURE_AREAS[keyof typeof AI_FEATURE_AREAS]['id'];

// ============================================================================
// AI Configuration Types
// ============================================================================
export interface AIConfig {
  enabled: boolean;
  provider: 'openai' | 'anthropic' | 'ollama' | 'custom';
  model: string;
  apiKey: string;
  endpoint?: string;
  maxTokens: number;
  temperature: number;
  enabledFeatures: Set<AIFeatureId>;
  costTracking: boolean;
  totalCost: number;
  requestCount: number;
}

export interface AIStatus {
  connected: boolean;
  lastCheck: Date | null;
  error: string | null;
  latency: number | null;
}

export interface AIContextType {
  config: AIConfig;
  status: AIStatus;
  updateConfig: (updates: Partial<AIConfig>) => void;
  toggleFeature: (featureId: AIFeatureId, enabled: boolean) => void;
  isFeatureEnabled: (featureId: AIFeatureId) => boolean;
  testConnection: () => Promise<boolean>;
  getEnabledFeaturesForPage: (page: string) => typeof AI_FEATURE_AREAS[keyof typeof AI_FEATURE_AREAS][];
  trackUsage: (tokens: number, cost: number) => void;
}

// ============================================================================
// Default Configuration
// ============================================================================
const DEFAULT_CONFIG: AIConfig = {
  enabled: false,
  provider: 'openai',
  model: 'gpt-4o-mini', // Cost-effective default
  apiKey: '',
  endpoint: 'https://api.openai.com/v1',
  maxTokens: 4096,
  temperature: 0.7,
  enabledFeatures: new Set(Object.values(AI_FEATURE_AREAS).map(f => f.id)),
  costTracking: true,
  totalCost: 0,
  requestCount: 0
};

const DEFAULT_STATUS: AIStatus = {
  connected: false,
  lastCheck: null,
  error: null,
  latency: null
};

// ============================================================================
// Context
// ============================================================================
const AIContext = createContext<AIContextType | undefined>(undefined);

// ============================================================================
// Provider Component
// ============================================================================
export function AIProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = useState<AIConfig>(() => {
    // Load from localStorage
    const saved = localStorage.getItem('aristrace_ai_config');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return {
          ...DEFAULT_CONFIG,
          ...parsed,
          enabledFeatures: new Set(parsed.enabledFeatures || [])
        };
      } catch {
        return DEFAULT_CONFIG;
      }
    }
    return DEFAULT_CONFIG;
  });
  
  const [status, setStatus] = useState<AIStatus>(DEFAULT_STATUS);
  
  // Save config to localStorage when it changes
  useEffect(() => {
    const toSave = {
      ...config,
      enabledFeatures: Array.from(config.enabledFeatures)
    };
    localStorage.setItem('aristrace_ai_config', JSON.stringify(toSave));
  }, [config]);
  
  // Auto-check connection when API key changes
  useEffect(() => {
    if (config.enabled && config.apiKey) {
      testConnection();
    }
  }, [config.enabled, config.apiKey, config.provider]);
  
  const updateConfig = useCallback((updates: Partial<AIConfig>) => {
    setConfig(prev => ({ ...prev, ...updates }));
  }, []);
  
  const toggleFeature = useCallback((featureId: AIFeatureId, enabled: boolean) => {
    setConfig(prev => {
      const newFeatures = new Set(prev.enabledFeatures);
      if (enabled) {
        newFeatures.add(featureId);
      } else {
        newFeatures.delete(featureId);
      }
      return { ...prev, enabledFeatures: newFeatures };
    });
  }, []);
  
  const isFeatureEnabled = useCallback((featureId: AIFeatureId): boolean => {
    return config.enabled && config.enabledFeatures.has(featureId);
  }, [config.enabled, config.enabledFeatures]);
  
  const getEnabledFeaturesForPage = useCallback((page: string) => {
    if (!config.enabled) return [];
    
    return Object.values(AI_FEATURE_AREAS).filter(feature => 
      config.enabledFeatures.has(feature.id) &&
      (feature.pages.includes(page) || feature.pages.includes('All'))
    );
  }, [config.enabled, config.enabledFeatures]);
  
  const testConnection = useCallback(async (): Promise<boolean> => {
    if (!config.apiKey) {
      setStatus({
        connected: false,
        lastCheck: new Date(),
        error: 'No API key configured',
        latency: null
      });
      return false;
    }
    
    const startTime = Date.now();
    
    try {
      // Test via backend
      const response = await fetch(`${API_BASE_URL}/api/ai/vision/status`);
      const data = await response.json();
      
      const latency = Date.now() - startTime;
      
      if (data.available) {
        setStatus({
          connected: true,
          lastCheck: new Date(),
          error: null,
          latency
        });
        return true;
      } else {
        // Try direct OpenAI test
        const openaiResponse = await fetch('https://api.openai.com/v1/models', {
          headers: {
            'Authorization': `Bearer ${config.apiKey}`
          }
        });
        
        if (openaiResponse.ok) {
          setStatus({
            connected: true,
            lastCheck: new Date(),
            error: null,
            latency: Date.now() - startTime
          });
          return true;
        } else {
          throw new Error('Invalid API key');
        }
      }
    } catch (error: any) {
      setStatus({
        connected: false,
        lastCheck: new Date(),
        error: error.message || 'Connection failed',
        latency: null
      });
      return false;
    }
  }, [config.apiKey]);
  
  const trackUsage = useCallback((tokens: number, cost: number) => {
    if (config.costTracking) {
      setConfig(prev => ({
        ...prev,
        totalCost: prev.totalCost + cost,
        requestCount: prev.requestCount + 1
      }));
    }
  }, [config.costTracking]);
  
  const value: AIContextType = {
    config,
    status,
    updateConfig,
    toggleFeature,
    isFeatureEnabled,
    testConnection,
    getEnabledFeaturesForPage,
    trackUsage
  };
  
  return (
    <AIContext.Provider value={value}>
      {children}
    </AIContext.Provider>
  );
}

// ============================================================================
// Hook
// ============================================================================
export function useAI() {
  const context = useContext(AIContext);
  if (context === undefined) {
    throw new Error('useAI must be used within an AIProvider');
  }
  return context;
}

// ============================================================================
// Utility Hook - Check if AI feature is available
// ============================================================================
export function useAIFeature(featureId: AIFeatureId) {
  const { config, isFeatureEnabled, status } = useAI();
  
  return {
    enabled: isFeatureEnabled(featureId),
    available: config.enabled && status.connected,
    loading: false
  };
}

// ============================================================================
// Utility Component - Conditionally render AI features
// ============================================================================
export function AIFeatureGate({ 
  featureId, 
  children,
  fallback = null 
}: { 
  featureId: AIFeatureId; 
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  const { enabled } = useAIFeature(featureId);
  
  if (!enabled) return <>{fallback}</>;
  return <>{children}</>;
}

// ============================================================================
// AI Badge Component - Shows AI is available
// ============================================================================
export function AIBadge({ className = '' }: { className?: string }) {
  const { config, status } = useAI();
  
  if (!config.enabled) return null;
  
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-gradient-to-r from-purple-500/20 to-blue-500/20 text-purple-400 border border-purple-500/30 ${className}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${status.connected ? 'bg-green-400' : 'bg-yellow-400'} animate-pulse`} />
      AI
    </span>
  );
}

export default AIContext;

