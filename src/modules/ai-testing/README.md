# AI Testing

AI-powered testing capabilities including natural language test generation, autonomous exploration agents, and conversational test authoring. Leverages LLMs to generate, execute, and refine test cases from plain English descriptions.

## Architecture

The module provides two main capabilities:

1. **AI Chat Testing** -- `AIChatTesting` enables conversational test creation where users describe test scenarios in natural language and the AI generates executable test steps.
2. **Autonomous Exploration** -- `AIExplorerAgent` and `AIFlowExplorer` provide autonomous application exploration where an AI agent navigates the application, discovers flows, and generates test cases automatically.

`FlowpilotPage` serves as the primary AI-guided test authoring experience, while `AITestingPage` acts as a lightweight hub.

## File Inventory

### Pages

| File | Lines | Purpose |
|------|-------|---------|
| `pages/FlowpilotPage.tsx` | 525 | AI-guided test authoring with Flowpilot agent for step-by-step test creation |
| `pages/AITestingPage.tsx` | 78 | AI testing hub page routing to sub-features |

### Components

| File | Lines | Purpose |
|------|-------|---------|
| `components/AIFlowExplorer.tsx` | 959 | Autonomous flow exploration -- discovers application paths and generates test flows |
| `components/AIChatTesting.tsx` | 729 | Conversational test generation -- natural language to executable test steps |
| `components/AIExplorerAgent.tsx` | 693 | AI agent for autonomous application exploration with configurable goals |

### Module Entry

| File | Purpose |
|------|---------|
| `index.ts` | Barrel exports for pages and components |

## API Endpoints Consumed

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/ai/generate-tests` | POST | Generate test cases from natural language descriptions |
| `/ai/chat` | POST | Conversational AI interaction for test authoring |
| `/ai/explore` | POST | Start autonomous exploration session |
| `/ai/explore/status/{id}` | GET | Check exploration session status |
| `/ai/flowpilot/generate` | POST | Flowpilot AI-guided test generation |
| `/ai/triage` | POST | AI-powered test failure triage |

## Dependencies

- **Internal**: `@/lib/api-config`, `@/components/ui/*`, `@/contexts/AIContext`
- **External**: React 18, Tailwind CSS, Radix UI, Lucide icons

## Testing Notes

- AI test generation quality depends on the configured LLM provider (OpenAI gpt-4o-mini or Anthropic Claude).
- Autonomous exploration requires a running application target URL; mock for unit tests.
- Chat-based testing should be tested with diverse natural language inputs (simple, complex, ambiguous).
- Flowpilot page requires backend AI endpoints to be available; test degraded behavior when AI is unavailable.
- Explorer agent session management should handle long-running sessions and timeouts gracefully.
