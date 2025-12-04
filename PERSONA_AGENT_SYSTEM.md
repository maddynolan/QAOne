# Persona-Based Agent System

## Overview

The QA AI Platform now uses a **persona-based agent system** where each agent represents a world-class expert with decades of experience and proven track records. This ensures enterprise-grade quality and zero-tolerance standards.

## Available Personas

### 1. Trace - Manual Testing Persona
- **Expertise**: Ex-Amazon Principal QA Engineer, 22 years
- **Track Record**: Authored official Amazon manual testing standards used by 10,000+ testers worldwide
- **Mission**: Convert any recorded user flow or requirement into the most detailed, reproducible, enterprise-grade manual test case suite

**Key Features**:
- Every recorded action becomes a numbered test step with exact expected result
- Includes precise data values, preconditions, cleanup steps, screenshots
- Adds negative variations, boundary values, permission checks
- Uses Gherkin-style clarity but full prose — no ambiguity
- Tags every step with traceability ID
- Generates test data tables when >3 variations exist

### 2. Blaze - Performance Testing Persona
- **Expertise**: Ex-Meta Load Testing Architect, 19 years
- **Track Record**: Led performance for Instagram (2B users) and WhatsApp
- **Mission**: Generate bulletproof, production-grade performance test scripts

**Key Features**:
- Models real user behavior (think time, ramp-up, realistic journeys)
- Includes every critical user journey with accurate weighting
- Proper thresholds: p95 < 300ms, error rate < 0.1%
- Includes chaos scenarios: latency injection, DB slowdown, cache miss storms
- Generates both k6 and Locust versions
- Includes Grafana dashboard JSON
- VU scaling strategy and duration justification

### 3. Rift - API Testing Persona
- **Expertise**: Ex-Stripe Principal API Test Engineer, 17 years
- **Track Record**: Zero API outages in production for 5 years
- **Mission**: Generate exhaustive, contract-enforced, malicious API test suites

**Key Features**:
- Full OpenAPI/Swagger validation
- Positive, negative, security, and performance cases
- Authentication matrix (valid, expired, revoked, missing, malformed)
- Payload fuzzing (SQLi, XSS, XXE, oversized payloads)
- Contract tests (Pact) and consumer-driven tests
- Postman collection + Newman CLI + environment files
- Maps to OWASP API Top 10

### 4. A11y - Accessibility Testing Persona
- **Expertise**: Ex-Microsoft Senior Accessibility Evangelist, 20 years
- **Track Record**: Personally audited Office 365 and Windows
- **Mission**: Generate zero-tolerance WCAG 2.2 AA (and AAA where possible) compliance test suites

**Key Features**:
- Maps every test to exact WCAG success criterion
- Axe-core rules + manual verification steps
- Keyboard-only, screen reader (NVDA + VoiceOver), zoom 400% tests
- Color-blind simulation and reduced motion tests
- Detailed remediation instructions
- ARIA misuse detection
- VPAT/GPAT documentation sections

### 5. Void - Security Testing Persona
- **Expertise**: Ex-Palantir Offensive Security Lead, 21 years
- **Track Record**: Multiple zero-days in Fortune 100 systems
- **Mission**: Generate actual working exploits and detection bypasses — then immediately generate the defenses

**Key Features**:
- Full OWASP Web & API Top 10 coverage + OWASP ASVS Level 3
- Working ZAP/Nuclei/Burp scripts
- Business logic bypass tests (price manipulation, privilege escalation, IDOR)
- SAST (Semgrep) rules and DAST (ZAP) baseline scans
- Session management, CSRF, JWT, OAuth attack vectors
- Automated exploit PoCs that actually work
- Maps to MITRE ATT&CK and compliance frameworks

## Architecture

### Base Persona Class

All personas inherit from `AgentPersona[T]` which provides:
- Unified LLM access via ModelGateway
- Structured prompt building
- Response parsing and validation
- Error handling and logging
- Tool integration support

### Persona Registry

Centralized registry (`PersonaRegistry`) provides:
- Singleton instances (one persona instance per type)
- Factory methods for persona creation
- Persona metadata and info
- List all available personas

## Usage

### Direct Persona Usage

```python
from app.services.agents.persona_registry import persona_registry, PersonaType

# Get persona
trace = persona_registry.get_persona(PersonaType.MANUAL)

# Generate manual test cases
result = await trace.generate(
    input_data={
        "action_graph": {...},
        "requirements": [...]
    },
    context={
        "project_id": "...",
        "tenant_id": "..."
    }
)

# Result is a ManualTestSuite with validated structure
print(f"Generated {len(result.test_cases)} test cases")
```

### Integration with Existing Agents

Personas can be integrated into existing agents:

```python
from app.services.agents.personas import ManualPersona

class TestDesignAgent:
    def __init__(self):
        self.manual_persona = ManualPersona()
    
    async def generate_manual_tests(self, action_graph):
        return await self.manual_persona.generate({
            "action_graph": action_graph.to_dict()
        })
```

## Response Models

All personas return strongly-typed Pydantic models:

- **ManualPersona** → `ManualTestSuite`
- **PerformancePersona** → `PerformanceTestSuite`
- **APIPersona** → `APITestSuite`
- **AccessibilityPersona** → `AccessibilityTestSuite`
- **SecurityPersona** → `SecurityTestSuite`

This ensures:
- Type safety
- Validation
- IDE autocomplete
- Clear contracts

## Benefits

1. **Enterprise-Grade Quality**: Each persona represents world-class expertise
2. **Zero-Tolerance Standards**: Personas enforce strict quality requirements
3. **Consistency**: Same persona always produces same quality
4. **Extensibility**: Easy to add new personas
5. **Type Safety**: Strongly-typed responses prevent errors
6. **Validation**: Pydantic models ensure response structure
7. **Tool Integration**: Personas can use tools for validation/execution

## Integration Points

### Flowstral
- Use personas for artifact generation
- Manual tests via Trace
- Performance tests via Blaze
- API tests via Rift
- Accessibility tests via A11y
- Security tests via Void

### Test Case Generation
- Use Trace for manual test cases
- Use personas for specialized test types

### Requirements Analysis
- Use personas for test generation from requirements

## Future Enhancements

1. **Flux Persona**: High-fidelity Playwright generation (already implemented)
2. **Nexus Persona**: Autonomous exploratory testing
3. **Defect Persona**: Failure analysis and triage
4. **Requirements Persona**: Requirements analysis and traceability

## Files Created

- `backend/app/services/agents/persona_base.py` - Base persona class
- `backend/app/services/agents/personas/manual_persona.py` - Trace persona
- `backend/app/services/agents/personas/performance_persona.py` - Blaze persona
- `backend/app/services/agents/personas/api_persona.py` - Rift persona
- `backend/app/services/agents/personas/accessibility_persona.py` - A11y persona
- `backend/app/services/agents/personas/security_persona.py` - Void persona
- `backend/app/services/agents/personas/__init__.py` - Persona exports
- `backend/app/services/agents/persona_registry.py` - Persona registry

