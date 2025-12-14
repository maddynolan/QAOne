/**
 * Real-time Test Execution WebSocket Hook
 * Provides step-by-step progress updates during test execution
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { API_BASE_URL } from '@/lib/api-config';

export interface StepResult {
  step: number;
  name: string;
  status: 'pending' | 'running' | 'passed' | 'failed' | 'healed';
  duration?: number;
  error?: string;
}

export interface Screenshot {
  step: number;
  type: 'step' | 'failure' | 'assertion';
  base64?: string;
  path?: string;
}

export interface HealedSelector {
  step: number;
  original: string;
  healed: string;
  strategy: string;
}

export interface ExecutionProgress {
  currentStep: number;
  totalSteps: number;
  stepName: string;
  status: 'idle' | 'connecting' | 'running' | 'passed' | 'failed';
  stepResults: StepResult[];
  screenshots: Screenshot[];
  healedSelectors: HealedSelector[];
  logs: Array<{ level: string; message: string; timestamp: string }>;
}

interface UseExecutionWebSocketOptions {
  onStepStart?: (step: number, name: string) => void;
  onStepComplete?: (step: number, status: string, duration: number) => void;
  onSelfHealing?: (step: number, original: string, healed: string) => void;
  onScreenshot?: (step: number, screenshot: Screenshot) => void;
  onComplete?: (status: string, results: any) => void;
  onError?: (error: string) => void;
}

export function useExecutionWebSocket(options: UseExecutionWebSocketOptions = {}) {
  const [progress, setProgress] = useState<ExecutionProgress>({
    currentStep: 0,
    totalSteps: 0,
    stepName: '',
    status: 'idle',
    stepResults: [],
    screenshots: [],
    healedSelectors: [],
    logs: []
  });
  
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const executionIdRef = useRef<string | null>(null);
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const connect = useCallback((executionId: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.close();
    }

    executionIdRef.current = executionId;
    
    // Build WebSocket URL
    const wsUrl = API_BASE_URL.replace('http://', 'ws://').replace('https://', 'wss://');
    const ws = new WebSocket(`${wsUrl}/test-runs/ws/${executionId}`);
    
    setProgress(prev => ({ ...prev, status: 'connecting' }));

    ws.onopen = () => {
      console.log('Execution WebSocket connected');
      setIsConnected(true);
      setProgress(prev => ({ ...prev, status: 'running' }));
      
      // Start ping interval
      pingIntervalRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'ping' }));
        }
      }, 25000);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        handleMessage(data);
      } catch (e) {
        console.error('Failed to parse WebSocket message:', e);
      }
    };

    ws.onerror = (error) => {
      console.error('Execution WebSocket error:', error);
      options.onError?.('WebSocket connection error');
    };

    ws.onclose = () => {
      console.log('Execution WebSocket closed');
      setIsConnected(false);
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
      }
    };

    wsRef.current = ws;
  }, [options]);

  const handleMessage = useCallback((data: any) => {
    switch (data.type) {
      case 'connected':
        console.log('Connected to execution stream:', data.execution_id);
        break;
        
      case 'step_start':
        setProgress(prev => ({
          ...prev,
          currentStep: data.step_number,
          totalSteps: data.total_steps,
          stepName: data.step_name,
          stepResults: [
            ...prev.stepResults.filter(s => s.step !== data.step_number),
            { step: data.step_number, name: data.step_name, status: 'running' }
          ]
        }));
        options.onStepStart?.(data.step_number, data.step_name);
        break;
        
      case 'step_complete':
        setProgress(prev => ({
          ...prev,
          stepResults: prev.stepResults.map(s => 
            s.step === data.step_number 
              ? { ...s, status: data.status, duration: data.duration_ms, error: data.error }
              : s
          )
        }));
        options.onStepComplete?.(data.step_number, data.status, data.duration_ms);
        
        // Auto-add screenshot if included
        if (data.screenshot) {
          setProgress(prev => ({
            ...prev,
            screenshots: [...prev.screenshots, {
              step: data.step_number,
              type: data.screenshot.type || 'step',
              base64: data.screenshot.base64,
              path: data.screenshot.path
            }]
          }));
        }
        break;
        
      case 'self_healing':
        const healing: HealedSelector = {
          step: data.step_number,
          original: data.original_selector,
          healed: data.healed_selector,
          strategy: data.strategy
        };
        setProgress(prev => ({
          ...prev,
          healedSelectors: [...prev.healedSelectors, healing]
        }));
        options.onSelfHealing?.(data.step_number, data.original_selector, data.healed_selector);
        break;
        
      case 'screenshot':
        const screenshot: Screenshot = {
          step: data.step_number,
          type: data.screenshot_type,
          base64: data.base64,
          path: data.path
        };
        setProgress(prev => ({
          ...prev,
          screenshots: [...prev.screenshots, screenshot]
        }));
        options.onScreenshot?.(data.step_number, screenshot);
        break;
        
      case 'log':
        setProgress(prev => ({
          ...prev,
          logs: [...prev.logs.slice(-99), { // Keep last 100 logs
            level: data.level,
            message: data.message,
            timestamp: data.timestamp
          }]
        }));
        break;
        
      case 'execution_complete':
        setProgress(prev => ({
          ...prev,
          status: data.status === 'passed' ? 'passed' : 'failed',
          stepName: data.status === 'passed' ? 'All steps completed!' : 'Execution finished'
        }));
        options.onComplete?.(data.status, data);
        break;
        
      case 'heartbeat':
      case 'pong':
        // Keep alive, no action needed
        break;
        
      default:
        console.log('Unknown WebSocket message type:', data.type);
    }
  }, [options]);

  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
    }
    setIsConnected(false);
    executionIdRef.current = null;
  }, []);

  const reset = useCallback(() => {
    setProgress({
      currentStep: 0,
      totalSteps: 0,
      stepName: '',
      status: 'idle',
      stepResults: [],
      screenshots: [],
      healedSelectors: [],
      logs: []
    });
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    progress,
    isConnected,
    connect,
    disconnect,
    reset
  };
}
