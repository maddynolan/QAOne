# Hybrid Engine-First, AI-Assisted Architecture

## Overview
This architecture uses deterministic engines for 80-90% of work, with targeted LLM usage only for naming, summarizing, and gap-filling.

## Architecture Layers

### Layer 1: Ingestion & Connectors
- Flowstral Extension (enhanced)
- Requirements Connectors (Jira, Azure DevOps, Linear)
- Code Repo Connectors (GitHub, GitLab, Bitbucket)
- API Spec Connectors (OpenAPI, Swagger, WSDL, Postman, GraphQL)

### Layer 2: Core Engines (Non-AI, Deterministic)
- Action Graph Engine
- Test Design Engine
- Script Generation Engine
- API Test Engine
- Accessibility & Performance Rule Engines

### Layer 3: Thin AI Layer (Targeted LLM Usage)
- Natural-Language Test Case Beautifier
- Script Refiner / Idiomatic Code Styler
- Gap Analysis & Optimization Hints
- Requirement Parsing (optional)

### Layer 4: Orchestration & Agents
- Requirements Agent
- UI Flow Agent
- API Agent
- Repo Agent
- Defect Agent

### Layer 5: UI & UX Layer
- QA AI Web App enhancements
- Flowstral Extension enhancements

## Key Flows

### Flow A: App-first (Flowstral/Action Builder)
1. User records with Flowstral
2. Action Graph Engine processes
3. Test Design Engine generates test cases
4. Script Engine generates code
5. Thin AI beautifies output

### Flow B: Requirements-first
1. Requirements Agent pulls from Jira/ADO
2. Optional LLM parsing
3. Test Design Engine creates skeletons
4. Maps to Flowstral graphs when available
5. Generates tests and scripts

### Flow C: API Engine
1. User uploads API spec
2. API Test Engine builds catalogue
3. Generates deterministic test suite
4. Optional LLM beautification

### Flow D: Repo-first
1. Repo Agent scans existing tests
2. Maps to flows/endpoints
3. Test Design Engine compares coverage
4. Optional LLM gap analysis
5. Generates missing tests

## Implementation Status
- [ ] Layer 1: Ingestion & Connectors
- [ ] Layer 2: Core Engines
- [ ] Layer 3: Thin AI Layer
- [ ] Layer 4: Orchestration Agents
- [ ] Layer 5: UI & UX Layer
- [ ] Flow A: App-first
- [ ] Flow B: Requirements-first
- [ ] Flow C: API Engine
- [ ] Flow D: Repo-first
- [ ] Integration & Testing



