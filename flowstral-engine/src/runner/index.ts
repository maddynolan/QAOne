/**
 * Runner Module - Test execution with pause/resume/debug support
 */

export { TestRunner } from './TestRunner';
export type { 
  TestStep, 
  TestConfig, 
  StepResult, 
  TestResult,
  TestRunnerEvent 
} from './TestRunner';

export { 
  testRunnerHandlers,
  playwrightRecorderAPI,
  registerTestRunnerIPC,
  setEventCallback,
  preloadScript
} from './TestRunnerIPC';

