# API Testing: Postman & ReadyAPI Deep Dive — Detailed Feature List & Build Plan

> **Purpose:** Deep dive into Postman and ReadyAPI documentation to list **all** features (not high-level), explain **why** they exist and how they’re useful in testing, and plan which to build on top of what QAAI already has.

**References:**  
- Your current API tab: `EnhancedAPITesting.tsx`, `api-testing/` components, `backend/app/services/api_testing/`, `docs/API_TESTING_ARCHITECTURE.md`, `docs/API-TESTING-COMPREHENSIVE-PLAN.md`, `docs/API-TESTING-ENTERPRISE.md`

**How to use this doc:**  
1. **Part 1** — Confirms what you already have so nothing is duplicated.  
2. **Parts 2 & 3** — Use as a checklist: every listed feature is something Postman/ReadyAPI offer and why it matters.  
3. **Part 4** — Quick comparison to see where you’re ahead (e.g. OWASP, DataGen, generation from spec) vs behind (e.g. folders, history, code gen).  
4. **Part 5** — Prioritized “build on top” plan (Tiers 1–4); pick items and we can implement in your style.

---

## Part 1 — What QAAI Already Has (API Tab)

Summary of your current API testing surface so we can map gaps and build-on points.

### 1.1 Request building & execution
- **Builder tab:** Method (GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS), URL, Params, Headers, Body (JSON, Form, XML, Raw), Auth (Bearer, Basic, API Key).
- **Send & inspect:** Response status, time, size, body (JSON/XML formatting), headers; error and timeout handling.
- **Assertions (declarative):** Status code (==, !=, >, <), response time, body contains/not contains, JSONPath, JSON schema, regex, header, cookie; script assertions (sandboxed Python with `response`, `status_code`, `headers`).
- **Templates:** Quick-start for REST (JSONPlaceholder), GraphQL (Countries), SOAP (CountryInfo).

### 1.2 Import & test generation
- **Import:** OpenAPI/Swagger (JSON/YAML), Postman Collection (v2.1), HAR, WSDL/SOAP, GraphQL schema; URL fetch; drag-and-drop; sample one-click collections.
- **OpenAPI:** Validate + auto-fix; infer schema from response; generate test suite (positive, negative, boundary, security).
- **Export:** Postman collection, HAR.

### 1.3 Request chaining
- **Chains tab:** Multi-step flows; variable extraction (JSONPath, regex, header, cookie); variable injection in next steps (`{{var}}`); assertions per step; conditional branching; retry.
- **Backend:** `/api/request-chain/chains`, `/execute`, variable resolution.

### 1.4 Environments & variables
- **Environment manager:** Create/list/update/delete environments; variables (key/value); resolve `{{var}}` in URL, headers, body; switch active environment (e.g. dev/staging/prod).
- **Scope:** Environment-level only (no global/collection/local in UI).

### 1.5 Authentication
- **Builder:** Bearer Token, Basic Auth, API Key (header/query).
- **Backend OAuth2:** Full support (client credentials, password, auth code, PKCE, token exchange, refresh); not yet wired in Builder auth tab.

### 1.6 Security
- **OWASP API Security:** 8/10 categories (BOLA, broken auth, excessive data, rate limiting, function-level auth, mass assignment, misconfig, injection, SSRF, inventory); scan API; severity findings and remediation.

### 1.7 Data & mocking
- **Test data (DataGen):** 50+ types (email, name, phone, address, UUID, date, credit card, pattern, locale, batch, stats); `/datagen/*` endpoints.
- **Data-driven:** Backend supports CSV/JSON (and Excel) data sources and variable substitution per row; execution wired to real HTTP; **UI for data-driven (upload CSV/JSON, preview, run) added per COMPREHENSIVE-PLAN.**
- **Mock server:** Create HTTP mock servers, add endpoints (method/path/status/body), dynamic template variables, start/stop, logs; generate from OpenAPI.
- **Service virtualization:** In-memory scenarios (backend).

### 1.8 Database
- **Connectors:** PostgreSQL, MySQL, SQLite, MongoDB, MSSQL; connect, query, list connections.
- **Assertions:** Database state assertions wired to `DatabaseConnector` (no longer placeholder).

### 1.9 Reporting & execution
- **Execution:** Manual, automated, CI/CD mode; parallel (max_workers); load test params (VUs, duration, ramp-up, think time) in Execute tab.
- **Reports:** Summary, HTML, JUnit XML, JSON, Allure; inline view and download.

### 1.10 Other
- **Secrets Vault:** AES-256 encrypted secrets; types (api_key, password, token, credential, connection_string, certificate); use `{{secret}}` in requests.
- **APM:** Datadog, New Relic, Dynatrace, Prometheus, Grafana Cloud.
- **API Coverage Map & Data Dependency Graph:** Dedicated pages (coverage visualization, chain data flow).
- **APM Config:** `/apm` configuration UI.

### 1.11 Known gaps (from your docs)
- **UI:** No collection hierarchy (folders), no request history, no code snippet generation, no cookie jar UI, no OAuth2 in Builder auth tab, variable scoping only at environment level.
- **Backend:** WebSocket/gRPC/Kafka/MQTT generate but don’t execute; OWASP API6/API10 optional; scheduled execution not real cron; OAuth2 callback handler incomplete.
- **Bugs fixed (per COMPREHENSIVE-PLAN):** Data-driven execution and DB assertions wired; script assertions implemented (Python sandbox).

---

## Part 2 — Postman: Very Detailed Feature List (from documentation)

Organized by area, with **what** it is and **why** it’s useful for API testing.

---

### 2.1 Sending requests

| # | Feature | What it is | Why it’s useful |
|---|--------|------------|------------------|
| P1 | HTTP methods | GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS, custom | Covers all REST semantics and edge cases (e.g. OPTIONS for CORS). |
| P2 | URL & path | Full URL or base + path; path variables | Reuse base URL per environment; parameterize paths. |
| P3 | Query parameters | Key-value list; bulk edit; encode options | Test query APIs, pagination, filters. |
| P4 | Request body: none | No body | GET/HEAD-style requests. |
| P5 | Request body: form-urlencoded | Default for simple form data | Legacy and form-based APIs. |
| P6 | Request body: multipart/form-data | Files + fields | Uploads and multipart APIs. |
| P7 | Request body: raw | Text/JSON/XML/HTML with syntax highlighting | Most API payloads; validate structure. |
| P8 | Request body: binary | Attach file (image, video, etc.) | File upload and binary APIs. |
| P9 | Headers | Key-value; bulk edit; presets | Auth, Content-Type, custom headers, CORS. |
| P10 | Request examples | Save multiple request variants (params/body) per request | Document and replay different scenarios. |
| P11 | Response examples | Save multiple responses per request | Documentation and mock matching. |
| P12 | Response matching for mock | Match by method + path; optional body/header matching | Return the right example for different inputs. |

### 2.2 Protocols (beyond HTTP)

| # | Feature | What it is | Why it’s useful |
|---|--------|------------|------------------|
| P13 | GraphQL | Dedicated GraphQL tab; query/mutation; variables; schema introspection | Native GraphQL testing and docs. |
| P14 | gRPC | Unary/streaming; proto import; server reflection | Microservices and RPC testing. |
| P15 | WebSocket | Connect, send messages, view frames | Real-time and WS APIs. |
| P16 | MQTT | Publish/subscribe; connect to broker | IoT and message brokers. |
| P17 | SOAP | SOAP request body; WSDL-based | Legacy SOAP services. |

### 2.3 Authorization

| # | Feature | What it is | Why it’s useful |
|---|--------|------------|------------------|
| P18 | No auth | No credentials sent | Public endpoints. |
| P19 | API Key | Key in header or query | Simple API keys. |
| P20 | Bearer token | `Authorization: Bearer <token>` | OAuth2/JWT access tokens. |
| P21 | JWT Bearer | Build/sign JWT (HS/RS/ES/PS); payload; add to header/query | Test JWTs and expiry without external tools. |
| P22 | Basic auth | Base64 username:password | Basic-protected APIs. |
| P23 | Digest auth | Nonce, realm, algorithm | Digest-protected APIs. |
| P24 | Hawk | Hawk ID, key, algorithm | Hawk-signed requests. |
| P25 | AWS Signature | Region, service, keys; auto-sign | AWS and S3-compatible APIs. |
| P26 | OAuth 2.0 | All flows (auth code, implicit, password, client credentials); PKCE; token exchange | Real OAuth2 and OpenID Connect testing. |
| P27 | Inherit auth from parent | Collection/folder auth applied to requests | DRY and consistent auth. |
| P28 | Certificates | CA and client certs per domain | mTLS and enterprise APIs. |
| P29 | Session variables | Local-only, never synced | Keep secrets off cloud. |
| P30 | Postman Vault | Encrypted secrets; reference in requests | Secure team secrets. |
| P31 | Guided Auth (public APIs) | Step-by-step auth setup for known APIs | Faster onboarding. |

### 2.4 Variables & environments

| # | Feature | What it is | Why it’s useful |
|---|--------|------------|------------------|
| P32 | Global variables | Workspace-level key-value | Defaults and shared config. |
| P33 | Environment variables | Per-environment key-value | Dev/QA/Prod switching. |
| P34 | Collection variables | Scoped to collection | Collection-specific config. |
| P35 | Local (script) variables | Set in scripts; request/folder/collection scope | Temporary state and scripting. |
| P36 | Variable precedence | Global → env → collection → local | Predictable override behavior. |
| P37 | Dynamic variables (Faker) | `$randomInt`, `$randomFirstName`, `$timestamp`, etc. | Random data without scripts. |
| P38 | `pm.variables.replaceIn()` | Resolve `{{var}}` in strings in scripts | Dynamic URLs/bodies. |
| P39 | Environment selector | Switch active environment in UI | Quick env switch. |
| P40 | Team environments | Share and sync environments | Consistency across team. |

### 2.5 Scripts (pre-request & post-response)

| # | Feature | What it is | Why it’s useful |
|---|--------|------------|------------------|
| P41 | Pre-request script | JavaScript before request | Set vars, sign requests, generate data. |
| P42 | Post-response (test) script | JavaScript after response | Assert, parse, save to variables. |
| P43 | Script order | Collection → folder → request (pre then post) | Reusable setup/teardown. |
| P44 | Postman Sandbox | Node-like runtime; limited globals | Safe execution. |
| P45 | `pm.*` API | `pm.response`, `pm.request`, `pm.environment`, `pm.collection`, `pm.expect`, `pm.test` | Full access to request/response and BDD tests. |
| P46 | Chai-style assertions | `pm.expect(...).to...` | Readable test syntax. |
| P47 | Chai-JSONSchema | Schema validation in scripts | Flexible schema checks. |
| P48 | Script packages | Reusable script packages in team library | Shared logic. |
| P49 | External packages (npm/JSR) | Use npm/JSR packages in scripts | Libraries and utilities. |
| P50 | GraphQL: Before query / After response | Scripts for GraphQL | GraphQL-specific logic. |
| P51 | gRPC: Before invoke / On message / After response | Scripts for gRPC | gRPC-specific logic. |
| P52 | Console | Log and inspect during run | Debug scripts and requests. |
| P53 | Postbot (AI) | AI-suggested tests | Quick test ideas. |

### 2.6 Collections & organization

| # | Feature | What it is | Why it’s useful |
|---|--------|------------|------------------|
| P54 | Collections | Top-level container for requests/folders | Group and share. |
| P55 | Folders (nested) | Hierarchy inside collection | Organize by feature/module. |
| P56 | Drag-and-drop | Reorder requests/folders | Organize without recreating. |
| P57 | Collection runner | Run some or all requests in order | Regression and flows. |
| P58 | Data file (CSV/JSON) in runner | Iterate collection per row | Data-driven runs. |
| P59 | Run with environment | Runner uses selected environment | Env-specific regression. |
| P60 | Collection format (schema) | Open format; machine-readable | Import/export, codegen, mocks. |
| P61 | Types in collections | Define types for params/body (OpenAPI-like) | Design and validate. |
| P62 | Generate collection from spec | From OpenAPI/RAML/WADL/GraphQL | Start from spec. |
| P63 | Generate collection from cURL | Paste cURL | Quick import. |

### 2.7 Mock servers

| # | Feature | What it is | Why it’s useful |
|---|--------|------------|------------------|
| P64 | Mock from collection | Create mock server from collection | Contract and front-end dev. |
| P65 | Examples as responses | Return saved response examples | Realistic stubs. |
| P66 | Dynamic variables in mock | `{{$randomEmail}}` etc. in examples | Varied mock data. |
| P67 | Optional body/header matching | Match request body/headers to pick example | Scenario-based mocking. |
| P68 | Network delay | Simulate latency | Test timeouts and loading. |
| P69 | Private mock (API key) | Require key for mock URL | Secure mocks. |
| P70 | Mock from history | Generate collection + mock from history | Quick mocks from real traffic. |

### 2.8 Running & automation

| # | Feature | What it is | Why it’s useful |
|---|--------|------------|------------------|
| P71 | Collection Runner (UI) | Manual run with options | Ad-hoc and small suites. |
| P72 | Newman (CLI) | Run collection from command line | CI/CD and scripts. |
| P73 | Postman CLI | Run collections, send results to Postman, governance/security checks | CI and governance. |
| P74 | Scheduled runs | Cron-like schedule for collection | Regression on schedule. |
| P75 | Monitors | Cloud runs on schedule; failure alerts | Uptime and SLA. |
| P76 | Private API monitoring | Run monitors from your network (runners) | Test internal/private APIs. |
| P77 | Static IPs for monitors | Fixed outbound IPs | Firewall allowlisting. |
| P78 | Webhooks | Trigger collection run from event | Event-driven tests. |
| P79 | Performance (virtual users) | Run collection with VUs for load | Simple load testing. |
| P80 | VS Code extension | Run/send from VS Code | Developer workflow. |

### 2.9 Response & debugging

| # | Feature | What it is | Why it’s useful |
|---|--------|------------|------------------|
| P81 | Response body | Raw, pretty, preview | Inspect JSON/XML/HTML. |
| P82 | Response headers | List of headers | Debug CORS, caching, auth. |
| P83 | Response cookies | List and manage cookies | Session and cookie-based auth. |
| P84 | Cookie manager | Per-domain cookies; persist | Multi-request sessions. |
| P85 | Status, time, size | Display in UI | Quick health and perf check. |
| P86 | Visualizer | Custom HTML/JS view via `pm.visualizer.set()` | Charts, tables, custom UI. |
| P87 | Request history | Auto-saved history of sent requests | Replay and compare. |
| P88 | Code snippet | Generate cURL, Python, Node, Java, C#, etc. from request | Copy into app code or docs. |
| P89 | Troubleshooting / Console | Full request/response and logs | Debug failures. |

### 2.10 Design & docs

| # | Feature | What it is | Why it’s useful |
|---|--------|------------|------------------|
| P90 | API Builder | Design API (elements) in Postman | API-first design. |
| P91 | Spec Hub | Central place for OpenAPI/RAML etc. | Single source of truth. |
| P92 | Document collection | Auto-generated docs from collection | Share with consumers. |
| P93 | Publish docs | Public or private published docs | Developer portal. |
| P94 | Generate collection from spec | Sync spec → collection | Keep tests aligned with spec. |

### 2.11 Collaboration & governance

| # | Feature | What it is | Why it’s useful |
|---|--------|------------|------------------|
| P95 | Workspaces | Personal, team, public | Organize and share. |
| P96 | Share collection/environment | Invite, roles | Team collaboration. |
| P97 | Comments | On collection, request, version | Discussion and context. |
| P98 | Version control / fork | Branch and merge collections | Change management. |
| P99 | API Governance | Rules on API definitions | Consistency and standards. |
| P100 | API Security (rules) | Security rules on definitions | Find security issues early. |
| P101 | Reports | Usage, security, billing reports | Visibility and compliance. |

### 2.12 Postman Flows (visual workflows)

| # | Feature | What it is | Why it’s useful |
|---|--------|------------|------------------|
| P102 | Flows canvas | Drag-and-drop blocks and connections | Visual API workflows. |
| P103 | Blocks | Data, logic, request blocks | Compose workflows. |
| P104 | Deploy flow as API | Flow as HTTP endpoint on Postman Cloud | Webhooks and integrations. |
| P105 | FQL / TypeScript in flows | Query and transform data | Complex logic. |
| P106 | Reuse flows in flows | Sub-flows as blocks | Modular workflows. |
| P107 | Agent mode (AI) | Natural language to build flows | Rapid prototyping. |

### 2.13 Other

| # | Feature | What it is | Why it’s useful |
|---|--------|------------|------------------|
| P108 | Proxy | Capture traffic from app/browser | Record real traffic. |
| P109 | Interceptor | Use browser cookies in Postman | Test with real session. |
| P110 | API Network | Discover and use public APIs | Ecosystem. |

---

## Part 3 — ReadyAPI: Very Detailed Feature List (from documentation)

Organized by area, with **what** it is and **why** it’s useful.

---

### 3.1 Test steps — Sending requests

| # | Feature | What it is | Why it’s useful |
|---|--------|------------|------------------|
| R1 | SOAP Request | SOAP over HTTP/HTTPS/JMS; tied to WSDL operation | SOAP functional testing. |
| R2 | REST Request | REST over HTTP/HTTPS/JMS; tied to REST service/resource/method | REST functional testing. |
| R3 | HTTP Request | Generic HTTP; not tied to service | Any HTTP API. |
| R4 | GraphQL Query | Query from GraphQL schema | GraphQL query testing. |
| R5 | GraphQL Mutation | Mutation from schema | GraphQL mutation testing. |
| R6 | GraphQL Request | Ad-hoc GraphQL (no schema) | Quick GraphQL tests. |
| R7 | API Connection (Kafka) | Publish/consume Kafka topic | Event/message testing. |
| R8 | JDBC Request | SQL or stored procedure | DB setup/assertions. |
| R9 | JMS Request | SOAP/REST over JMS | Messaging and async. |
| R10 | XML-RPC | XML-RPC call | Legacy RPC. |

### 3.2 Test steps — Properties & data flow

| # | Feature | What it is | Why it’s useful |
|---|--------|------------|------------------|
| R11 | Properties | Key-value; optional read/write from file | Parameterization and state. |
| R12 | Property Transfer | Extract from response (XPath/JSONPath) → property or next step | Chaining and data passing. |
| R13 | Property Wait | Wait until property meets condition | Async and polling. |

### 3.3 Test steps — Data-driven testing

| # | Feature | What it is | Why it’s useful |
|---|--------|------------|------------------|
| R14 | Data Source | Read from DB, Excel, file, folder, etc. | External test data. |
| R15 | Data Sink | Write properties to DB, Excel, etc. | Store results for analysis. |
| R16 | DataGen (deprecated) | Counters, random values | Dynamic data (replaced by Data Source patterns). |
| R17 | Data Source Loop | Loop test steps for each data source row | Data-driven iteration. |

### 3.4 Test steps — Execution flow

| # | Feature | What it is | Why it’s useful |
|---|--------|------------|------------------|
| R18 | Conditional GoTo | Branch by last response content | Conditional flows. |
| R19 | Run Test Case | Call another test case with properties | Reusable sequences. |
| R20 | Delay | Pause for specified time | Rate limits and timing. |

### 3.5 Test steps — Scripting

| # | Feature | What it is | Why it’s useful |
|---|--------|------------|------------------|
| R21 | Groovy Script | Full Groovy in test step | Custom logic, parsing, assertions. |

### 3.6 Test steps — Validation (assertions)

| # | Feature | What it is | Why it’s useful |
|---|--------|------------|------------------|
| R22 | Assertion (flexible) | Property + assertion type; grouping and Boolean logic | Rich validation. |
| R23 | JSONPath Match | JSONPath → compare to expected | JSON validation. |
| R24 | XPath Match | XPath → compare (XML) | SOAP/XML validation. |
| R25 | JSON Schema Compliance | Response conforms to JSON Schema | Contract and structure. |
| R26 | Schema Compliance (WSDL/WADL) | Conforms to service schema | Contract for SOAP/REST. |
| R27 | Script Assertion | Groovy returns pass/fail | Custom validation. |

### 3.7 Test steps — Virtualization (callbacks/async)

| # | Feature | What it is | Why it’s useful |
|---|--------|------------|------------------|
| R28 | SOAP VirtResponse | Listen for SOAP request; return configured response | Callbacks and async SOAP. |
| R29 | REST VirtResponse | Listen for REST request; return response | Callbacks and async REST. |
| R30 | Virtual Service Runner | Start/stop virtual service from test | Control virt in flow. |

### 3.8 Test steps — AMQP

| # | Feature | What it is | Why it’s useful |
|---|--------|------------|------------------|
| R31 | AMQP Declare Exchange | Create exchange | AMQP setup. |
| R32 | AMQP Declare Queue | Create queue | AMQP setup. |
| R33 | AMQP Bind Queue | Bind queue to exchange | AMQP setup. |
| R34 | AMQP Publish | Send to exchange | AMQP testing. |
| R35 | AMQP Receive | Consume from queue | AMQP testing. |

### 3.9 Test steps — MQTT

| # | Feature | What it is | Why it’s useful |
|---|--------|------------|------------------|
| R36 | Receive MQTT Message | Act as MQTT client | IoT. |
| R37 | Publish using MQTT | Publish message | IoT. |
| R38 | Drop MQTT Connection | Disconnect | IoT cleanup. |

### 3.10 Test steps — Files & other

| # | Feature | What it is | Why it’s useful |
|---|--------|------------|------------------|
| R39 | File Wait | Wait for file to appear | File-based async. |
| R40 | Create File | Create file; optional wait for delete | File-based workflows. |
| R41 | FTP | Upload file via FTP | FTP integration. |
| R42 | Manual | Pause for manual step | Hybrid manual/automated. |
| R43 | TestComplete | Run TestComplete test | UI + API combined. |
| R44 | Send Mail | Send email from test | Notifications and triggers. |

### 3.11 Test structure & organization

| # | Feature | What it is | Why it’s useful |
|---|--------|------------|------------------|
| R45 | TestSuite → TestCase → TestStep | Three-level hierarchy | Organize by suite/case/step. |
| R46 | Sequential execution | Steps run in order | Predictable flow. |
| R47 | Properties at suite/case/step | Scoped properties | Clear data scope. |

### 3.12 Data sources & parameterization

| # | Feature | What it is | Why it’s useful |
|---|--------|------------|------------------|
| R48 | Data Source types | Database, Excel, file, directory, grid | Flexible test data. |
| R49 | Property expansion | `${Request#property}` in steps | Reference other steps. |
| R50 | Data Source Loop | Iterate steps per row | Data-driven execution. |

### 3.13 Verifying results (testing docs)

| # | Feature | What it is | Why it’s useful |
|---|--------|------------|------------------|
| R51 | Using Properties | Transfer and use across steps | Chaining. |
| R52 | Data-driven tests | Docs and patterns | Best practices. |
| R53 | Scripting | Groovy for logic | Custom behavior. |
| R54 | Teamwork | Shared projects | Collaboration. |
| R55 | Events | Event handlers | Setup/teardown. |
| R56 | Reporting | Report templates | Custom reports. |
| R57 | Environments | Env configs | Multi-environment. |

### 3.14 Protocols & services

| # | Feature | What it is | Why it’s useful |
|---|--------|------------|------------------|
| R58 | REST services | REST project structure | REST testing. |
| R59 | SOAP services | WSDL-based structure | SOAP testing. |
| R60 | GraphQL | GraphQL testing | GraphQL. |
| R61 | gRPC | gRPC testing | gRPC. |
| R62 | Kafka | Kafka testing | Event streaming. |
| R63 | Cookies | Cookie handling | Session. |
| R64 | Webhooks | Webhook testing | Callbacks. |
| R65 | HTTP Monitor | Capture traffic | Recording. |
| R66 | IoT | IoT testing | IoT. |
| R67 | AMQP | AMQP testing | Messaging. |
| R68 | JMS | JMS testing | Java messaging. |
| R69 | Coverage testing | Coverage metrics | Coverage. |
| R70 | JSONPath reference | JSONPath support | Assertions and transfer. |

### 3.15 Security tests

| # | Feature | What it is | Why it’s useful |
|---|--------|------------|------------------|
| R71 | Security scan types | Multiple scan types (e.g. Groovy-based custom) | Find vulnerabilities. |
| R72 | Security scan parameters | Map request properties to scan parameters (Query/Path, XPath/JSONPath) | Target specific fields. |
| R73 | Sensitive Information Exposure | Default assertion (no sensitive data in response) | Security baseline. |
| R74 | Custom script (Groovy) scan | Modify parameters, return true/false to drive scan | Custom security checks. |

### 3.16 Virtualization (VirtServer)

| # | Feature | What it is | Why it’s useful |
|---|--------|------------|------------------|
| R75 | Virtual services | REST, SOAP, JMS, TCP, JDBC | Replace dependencies. |
| R76 | VirtServer | Run virtuals remotely | Scale and share. |
| R77 | Sync for load testing | Option to optimize virt for load | Performance under load. |
| R78 | Virtual Service Runner step | Control virt from test case | Dynamic virt control. |

### 3.17 Performance / load

| # | Feature | What it is | Why it’s useful |
|---|--------|------------|------------------|
| R79 | Load test from functional | Same test cases under load | Reuse functional as load. |
| R80 | Virtual users & duration | Configure VUs and run length | Load testing. |
| R81 | Synchronization (virtuals) | Tune for accuracy vs speed | Reliable load results. |

### 3.18 Reporting & integration

| # | Feature | What it is | Why it’s useful |
|---|--------|------------|------------------|
| R82 | Report templates | Customize report output | Fit process. |
| R83 | TestEngine | Headless/CI execution | Automation. |
| R84 | Integration with tools | External tool integration | CI and ALM. |

---

## Part 4 — Side-by-Side: You vs Postman vs ReadyAPI (condensed)

| Area | QAAI | Postman | ReadyAPI |
|------|-----|---------|----------|
| **Request builder** | ✅ Full (method, params, headers, body, auth) | ✅ + examples, binary | ✅ + tied to service |
| **Protocols** | REST, SOAP, GraphQL (import/generate); WS/gRPC/Kafka generate only | REST, GraphQL, gRPC, WS, MQTT, SOAP | REST, SOAP, GraphQL, gRPC, Kafka, JMS, AMQP, MQTT, XML-RPC |
| **Auth** | Bearer, Basic, API Key; OAuth2 backend (not in Builder) | No auth → OAuth2, JWT, Digest, Hawk, AWS, certs, Vault | Per-request auth |
| **Variables** | Environment only | Global, env, collection, local, dynamic (Faker) | Properties, suite/case/step, data source |
| **Scripts** | Declarative + Python script assertions | Pre-request + test scripts (JS), Chai, packages | Groovy script step, script assertions |
| **Chaining** | Chains + extract + inject + conditions | Scripts + variables + runner order | Property Transfer + Run Test Case + Conditional GoTo |
| **Data-driven** | Backend + UI (CSV/JSON, run per row) | Runner + CSV/JSON data file | Data Source + Data Source Loop |
| **Assertions** | Status, time, body, JSONPath, schema, regex, header, cookie, DB, script | Test scripts + Chai + visualizer | Many assertion types + grouping + script |
| **Collections/organization** | Flat list (localStorage) | Collections + nested folders | TestSuite → TestCase → TestStep |
| **Mock server** | Real HTTP server, dynamic, scenarios, logs | Mock from collection + examples, dynamic vars | VirtServer, full virtualization |
| **Import** | OpenAPI, Postman, HAR, WSDL, GraphQL | OpenAPI, RAML, WADL, GraphQL, cURL | OpenAPI, WSDL, Postman, HAR |
| **Test generation** | From spec (positive, negative, boundary, security) | From spec (generate collection) | Manual / script |
| **Security scan** | OWASP 8/10 built-in | Governance/Security rules on spec; monitors for health | Security scan types + Groovy |
| **Execution** | Manual, automated, parallel, load (VUs, duration, ramp) | Runner, Newman, CLI, scheduled, monitors, webhooks, perf | TestEngine, CI, load from functional |
| **Reporting** | Summary, HTML, JUnit, JSON, Allure, inline | Built-in + Newman XML | Report templates |
| **Code generation** | ❌ | cURL, Python, Node, Java, C#, etc. | ❌ |
| **Request history** | ❌ | ✅ | ❌ (HTTP Monitor capture) |
| **Cookie jar** | ❌ | ✅ | Cookies doc |
| **Visualizer** | ❌ | Custom HTML/JS view | ❌ |
| **Flows (visual)** | ❌ (you have chain builder) | Flows canvas + deploy as API | ❌ |
| **Database** | Connectors + DB assertions | Scripts only | JDBC step, DB as data source |
| **DataGen** | 50+ types, batch, locale | Faker in scripts | DataGen step (deprecated), data sources |

---

## Part 5 — Plan: What to Build on Top of What You Have

Use this to decide **which** features to add next; implementation should match your existing style (e.g. Builder, Chains, Execute, Results, backend services).

### Tier 1 — Table stakes (high impact, users expect them)

| # | Feature | Source | You have | Build on / add |
|---|--------|--------|----------|-----------------|
| 1 | **Collection hierarchy (folders)** | Postman | Flat list | Add folders in UI and in saved structure (e.g. tree in sidebar); persist with existing storage. |
| 2 | **Data-driven UI** | Both | Backend done | You added CSV/JSON upload, preview, run in Execute; verify it’s complete and visible. |
| 3 | **Request history** | Postman | None | Log each Builder “Send” (method, URL, timestamp); store in localStorage or backend; show in sidebar with search/replay. |
| 4 | **OAuth2 in Builder** | Both | Backend only | Add “OAuth2” to Builder Auth tab; call existing OAuth2 endpoints to get token, then set Bearer. |
| 5 | **Code snippet generation** | Postman | None | Add “Code” in Builder: generate cURL, Python (requests), Node (fetch), optionally Java/C#; copy to clipboard. |

### Tier 2 — Parity & power (match Postman/ReadyAPI where it matters)

| # | Feature | Source | You have | Build on / add |
|---|--------|--------|----------|-----------------|
| 6 | **Variable scoping** | Postman | Environment only | Add “global” (workspace) and “collection” (or “suite”) variables; resolve order: global → env → collection → local (in chain step). |
| 7 | **Pre-request / test scripts** | Postman | Script assertions only | Add optional Pre-request and Post-response script (JS or keep Python) per request or folder; run in same order as Postman (collection → folder → request). |
| 8 | **Mock server full UI** | Both | Basic mock UI | You have backend; add UI: endpoint list, edit, logs, “verify calls”, optional body/header matching, delay. |
| 9 | **Load testing UI** | Both | Params in Execute | You send VUs, duration, ramp-up; add simple UI: inputs, “Run load”, and a results view (pass/fail, response time, throughput). |
| 10 | **Cookie management** | Postman | None | Cookie jar: store Set-Cookie per domain; auto-send in Builder; optional “Cookies” tab to view/edit. |
| 11 | **Console / network inspector** | Postman | Response view | Optional “Console” tab: log request/response and script logs for last run or history. |

### Tier 3 — Differentiation (your style, beyond Postman/ReadyAPI)

| # | Feature | Source | You have | Build on / add |
|---|--------|--------|----------|-----------------|
| 12 | **AI assertion suggestions** | Your differentiator | Assertions panel | After response, call LLM or rules to suggest assertions (status, JSONPath, schema) from response shape. |
| 13 | **AI chain from description** | Your differentiator | Chain builder | “Describe flow in English” → generate chain steps and extractions (reuse existing chain execution). |
| 14 | **API coverage map (real data)** | Your differentiator | APICoverageMap page | Wire to real run results and spec; show tested vs untested endpoints (you already have the concept). |
| 15 | **Contract / breaking change check** | ReadyAPI-like | OpenAPI validator | Compare last run response to current spec; flag breaking changes (status, required fields, types). |
| 16 | **Scheduled runs (real)** | Postman | Not real cron | Backend: scheduler (e.g. APScheduler) for “run this suite every N” and store results; UI: list schedules and last run. |

### Tier 4 — Later (protocols, advanced virtualization)

| # | Feature | Source | You have | Build on / add |
|---|--------|--------|----------|-----------------|
| 17 | **WebSocket execution** | Postman | Generate only | Backend: execute WebSocket connect/send/receive; UI: WebSocket tab or step in chain. |
| 18 | **gRPC execution** | Both | Generate only | Backend: execute gRPC (unary at least); UI: gRPC request step or builder. |
| 19 | **Response visualizer** | Postman | None | Optional “Visualization” tab: run user-provided HTML/JS template with response data (sandboxed iframe). |
| 20 | **Full service virtualization** | ReadyAPI | Basic mock + scenarios | Richer scenarios, scripting, and state (if you need to replace heavy dependencies). |

---

## Part 6 — Summary Counts (for planning)

- **Postman (detailed):** ~110 distinct features listed (P1–P110).
- **ReadyAPI (detailed):** ~84 distinct features listed (R1–R84).
- **Your current surface:** Covers a large share of “core” API testing (request build, import, chains, envs, auth backend, security, DataGen, mock, DB, reporting, execution, load params). Main gaps: organization (folders, history), variable scoping, scripting (pre/post), code gen, cookie jar, OAuth2 in Builder, and optional advanced (Flows-like canvas, WebSocket/gRPC execution, visualizer).

**Next step:** Pick from Tiers 1–4 which items you want in the next 1–2 sprints; then we can break each into concrete tasks (backend + frontend) and implement in your style.

---

## Part 7 — Zero-Code Tier 1 & Tier 2 (Build Plan)

QAAI is a **zero-code platform**: we match Postman/ReadyAPI capabilities in **our style** with **no (or minimal) user scripting**. Below: what we implement instead of scripts, and a full checklist so we don’t miss any Postman/ReadyAPI feature in Tiers 1–2.

### 7.1 Zero-code principles

| Postman/ReadyAPI (script-based) | Our approach (declarative / UI) |
|---------------------------------|---------------------------------|
| Pre-request script (JS/Groovy)   | **Before request** actions: set header/param/body from **dynamic value** (e.g. `$timestamp`, `$randomUUID`, `$randomInt`) — reuse DataGen or built-in placeholders; no code. |
| Test script (assertions in code)| Keep **declarative assertions** (status, JSONPath, schema, contains, header, cookie) + **extract to variable** (already in Chains). Optional: “Save from response” in Builder to set a variable for next request. |
| Variable logic in scripts       | **Variable scoping** (global → env → collection → local) + **dynamic variables** in UI (dropdown: “Timestamp”, “Random UUID”, “Random integer”, etc.). |
| Cookie handling in scripts      | **Cookie jar**: auto-store Set-Cookie from response; auto-send Cookie for same domain; **Cookies** tab to view/edit. No code. |
| Console.log / debugging         | **Console** tab: read-only log of last (or selected) request + response (method, URL, headers, body, status, time). No scripting. |

### 7.2 Tier 1 — Full checklist (match Postman/ReadyAPI, zero-code)

| # | Feature | Postman/ReadyAPI | We implement |
|---|--------|-------------------|--------------|
| 1 | **Collection hierarchy (folders)** | Collections + nested folders; drag-drop | **Folders** in test suite: tree (folder → folder/request); persist in suite; drag-drop or move; export to Postman keeps structure. |
| 2 | **Data-driven UI** | Runner + CSV/JSON data file; iterate per row | **Execute tab**: upload CSV/JSON (or paste); **Preview** table; **Run with data** → call `/data-driven/execute`; show results per row. No scripts. |
| 3 | **Request history** | History tab; every sent request saved; search; replay | **History** (sidebar or Builder panel): log each **Send** (method, URL, timestamp, optional name); store in localStorage; search/filter; click to load in Builder. |
| 4 | **OAuth2 in Builder** | OAuth2 auth type; get token; use in request | **Auth** tab: type **OAuth2**; list configs from `/api/oauth2/configs`; **Get token** (client credentials / password / auth code); set Bearer automatically. No script. |
| 5 | **Code snippet generation** | Code → cURL, Python, Node, etc. | **Code** button in Builder: generate **cURL**, **Python (requests)**, **Node (fetch)**; copy to clipboard. Optional: Java, C#. |

### 7.3 Tier 2 — Full checklist (zero-code)

| # | Feature | Postman/ReadyAPI | We implement |
|---|--------|-------------------|--------------|
| 6 | **Variable scoping** | Global, env, collection, local | **Variables** UI: **Global** (workspace), **Environment** (existing), **Collection** (current suite); resolve order **global → env → collection**. Use in URL, headers, body via `{{name}}`. |
| 7 | **Pre-request / test “scripts”** | Pre-request + test scripts (JS) | **Declarative only:** (a) **Before request**: list of “Set variable” = name + value type: **Static**, **$timestamp**, **$randomUUID**, **$randomInt**, **$randomEmail**, etc. (b) **After response**: existing assertions + “Extract to variable” (JSONPath/header/cookie) for use in next request or chain. No scripts. |
| 8 | **Mock server full UI** | Mock from collection; examples; logs; verify | **Mock** tab: list **endpoints** (method, path, status, body); **Add/Edit** endpoint; **Start/Stop**; **Logs** (incoming requests); **Verify** (expected vs received); optional **delay**. Backend already exists. |
| 9 | **Load testing UI** | Runner with VUs; duration; results | **Execute**: when mode = Load, use **React state** for VUs, duration, ramp-up, think time (no getElementById). **Run** → same execute endpoint; **Results**: show load summary (total requests, pass/fail, avg/p95 response time, throughput) from execution_results. |
| 10 | **Cookie management** | Cookie jar; auto-send; per domain | **Cookie jar**: on response, parse **Set-Cookie**; store by **domain**; on next request to same domain, send **Cookie** header. **Cookies** tab in Builder: list by domain; add/edit/delete. No code. |
| 11 | **Console / network inspector** | Console with request/response + logs | **Console** tab (or panel): show **last request** (method, URL, headers, body) and **last response** (status, headers, body, time). Optional: select from **History** to view. Read-only; no script logs. |

### 7.4 Postman/ReadyAPI items covered by Tier 1+2 (no scripts)

From the detailed lists (Parts 2 & 3), these are covered by the above:

- **P54–P57, P61–P63**: Collections, folders, runner, data file → **folders + data-driven UI**.
- **P58**: Data file in runner → **data-driven UI** (CSV/JSON upload, preview, run).
- **P71–P72, P79**: Runner, performance → **Execute + Load mode**.
- **P26, P31**: OAuth2, Guided Auth → **OAuth2 in Builder**.
- **P32–P40**: Variables, scoping, dynamic → **variable scoping + declarative before-request**.
- **P41–P45**: Pre-request / test scripts → **declarative Before request + assertions + extract**.
- **P64–P70**: Mock servers → **Mock tab** (endpoints, logs, verify, delay).
- **P81–P89**: Response, cookies, history, code snippet, console → **response view, cookie jar, history, code gen, console**.
- **R14–R17, R48–R50**: Data Source, Data Sink, Loop, property expansion → **data-driven UI + variable scoping + extract to variable**.
- **R22–R27**: Assertions → we already have; **R11–R13**: Properties, transfer → **variables + extract**.

### 7.5 What we explicitly do *not* add (stay zero-code)

- **Postman/ReadyAPI script editors** (pre-request, test, Groovy) — replaced by declarative actions and dynamic variables.
- **Custom visualizer** (user HTML/JS) — out of scope for Tier 1–2.
- **Flows (visual canvas)** — we have Chains; no duplicate.
- **npm/JSR packages in scripts** — not applicable.

### 7.6 Implementation order (recommended)

1. **Tier 1.1** — Request history, Code snippet (Builder-only; small).
2. **Tier 1.2** — OAuth2 in Builder (wire existing backend).
3. **Tier 1.3** — Data-driven UI in Execute (upload, preview, run).
4. **Tier 1.4** — Collection hierarchy (folders + tree; persist; export).
5. **Tier 2.1** — Variable scoping (global, collection) + resolve order.
6. **Tier 2.2** — Declarative “Before request” (set variable from dynamic).
7. **Tier 2.3** — Load testing state + results view; Cookie jar; Console tab.
8. **Tier 2.4** — Mock server full UI (endpoints, logs, verify).

### 7.7 Tier 3 — How to implement (discussion)

Tier 3 is **differentiation** (AI, coverage, contract, scheduling). Implementation options in our style, zero-code first:

| Feature | Implementation approach | Notes |
|--------|-------------------------|------|
| **AI assertion suggestions** | After response in Builder: call backend with `{ response_body, response_headers, status }` → return suggested assertions (status, JSONPath, contains). User clicks to add. No scripts. | Reuse existing assertion types; optional LLM or rule-based. |
| **AI chain from description** | "Describe flow" text area → backend generates `{ steps: [{ request, extractions, assertions }] }` → inject into Chains tab. | Same chain execution; only generation is new. |
| **API coverage map (real data)** | Wire APICoverageMap page to: (1) last run results (which endpoints were hit), (2) current spec or test suite (all endpoints). Show tested vs untested per method/path. | Backend can expose `GET /api/v2/testing/coverage` with run_id + suite_id. |
| **Contract / breaking change** | After run: compare response schema (or key fields) to OpenAPI spec; flag new required, removed fields, type changes. UI: "Breaking changes" section in Results. | Backend: diff last response vs spec; return list of breaks. |
| **Scheduled runs** | Backend: APScheduler (or cron) to run a suite on interval; store results; optional webhook/email. UI: "Schedules" tab with list, "Add schedule" (suite, cron expr, env). | Requires backend job runner and persistence. |

These can be scoped one at a time; all stay zero-code (config + AI/analytics, no user scripts).

---

## Part 8 — Response → Store & Assert on Nested Nodes (Zero-Code)

**Goal:** Let users see the response, store any node as a variable, and assert on any (including nested) node — without writing code. They should **understand** structure (nested paths) clearly.

### 8.1 Best approach (zero-code)

| Need | Solution | Why |
|------|----------|-----|
| **Show output response** | Expandable **tree** of the response body (and headers/meta). Each row = one node; expand to see children. | Nested structure is obvious; no raw JSON scanning. |
| **Understand nesting** | Show **two paths** per node: (1) **Breadcrumb** (human): `data → user → id` or `items → [0] → name`. (2) **JSONPath** (machine): `$.data.user.id`, `$.items[0].name`. Optional tooltip: "Use in assertions or save as variable." | Users see where the value lives; power users get the path to copy. |
| **Store (extract)** | On any node: **"Save as variable"** button → dialog "Variable name" → value stored in **collection** or **global** scope. Next request (or chain step) can use `{{variable_name}}`. | No scripts; same as Chains "extract" but from Builder after one request. |
| **Assert on any node** | On any node: **"Assert"** button → prefill assertion with path + current value; user can change operator (equals, exists, contains) or expected. Support **leaf and parent** nodes: for object/array, default to "exists" (node present). | One click = one assertion; works for deep nesting. |
| **Bulk actions** | **"Assert all visible"** or **"Assert all in path …"** to add many assertions at once (e.g. all leaves under `$.data`). Optional: **"Save all under … as variables"** with a prefix. | Speeds up building test cases from a large response. |

### 8.2 Implementation checklist

- **Tree already has:** expand/collapse, search, JSONPath, click-to-assert (leaf), copy path, Quick Assert (status, time, suggested body), headers with assert.
- **Add:**
  1. **Breadcrumb** for each node: e.g. `data › user › id` (or `items › [0] › name`) next to or under the key, so nesting is readable.
  2. **"Save as variable"** on every node (not only leaves): on click → prompt or small modal "Variable name" → parent stores in collection/global vars and shows toast "Saved; use {{name}} in next request."
  3. **Assert on parent nodes:** for object/array, "Assert" adds an "exists" assertion (path exists and is non-null). User can change to "equals" with a stringified value if needed.
  4. **Path tooltip:** show both breadcrumb and JSONPath on hover (or in a small inline badge) so users learn the mapping.
  5. **Optional:** "Assert all under this" for a node (add assertions for all leaf descendants).

### 8.3 Where it lives

- **ResponseTreeExplorer** (Builder → Response → Assert Builder tab): add breadcrumb, "Save as variable", and parent-node assert. RequestBuilder passes `onSaveAsVariable?(name: string, path: string, value: any)` and provides storage (collection/global vars from Tier 2).
- **Chains:** already have "extract" per step; no change. Builder "Save as variable" reuses the same variable scope so that the next Builder request or first chain step can use `{{var}}`.

