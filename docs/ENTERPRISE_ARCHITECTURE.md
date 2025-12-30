# Flowstral Enterprise Architecture

## Overview

This document outlines the scalable architecture for Flowstral's enterprise QA platform, designed to handle thousands of test cases, multiple teams, and high-volume test execution.

## 1. Data Storage Architecture

### Current State (Local-First)
```
┌─────────────────────────────────────────────────────────────────┐
│                     Desktop Application                          │
├─────────────────────────────────────────────────────────────────┤
│  React App (Renderer)                                            │
│  ├── localStorage (Browser)      ← Fast, ~5MB limit              │
│  └── electronAPI.localStorage    ← Electron IPC → JSON files     │
├─────────────────────────────────────────────────────────────────┤
│  Electron Main Process                                           │
│  └── LocalStorage (JSON files in userData)                       │
│      ├── test_cases.json                                         │
│      ├── test_runs.json                                          │
│      ├── recording_sessions.json                                 │
│      └── elements.json                                           │
└─────────────────────────────────────────────────────────────────┘
```

### Target State (Enterprise Scale)
```
┌─────────────────────────────────────────────────────────────────┐
│                     Desktop Application                          │
├─────────────────────────────────────────────────────────────────┤
│  React App (Renderer)                                            │
│  ├── In-Memory Cache (React Query / Zustand)                     │
│  └── API Client (REST/GraphQL)                                   │
├─────────────────────────────────────────────────────────────────┤
│  Electron Main Process                                           │
│  ├── SQLite (Local)       ← Indexed, fast queries, unlimited     │
│  │   ├── test_cases                                              │
│  │   ├── test_steps                                              │
│  │   ├── test_runs                                               │
│  │   ├── folders                                                 │
│  │   ├── releases                                                │
│  │   └── sync_queue                                              │
│  └── Sync Service         ← Background sync to cloud             │
├─────────────────────────────────────────────────────────────────┤
│                     Cloud Backend (Optional)                      │
├─────────────────────────────────────────────────────────────────┤
│  API Gateway (REST/GraphQL)                                       │
│  ├── Authentication (OAuth, SSO)                                  │
│  ├── Rate Limiting                                                │
│  └── Caching (Redis)                                              │
├─────────────────────────────────────────────────────────────────┤
│  Database Layer                                                   │
│  ├── PostgreSQL (Primary - structured data)                      │
│  │   ├── test_cases (with full-text search)                      │
│  │   ├── test_runs                                                │
│  │   ├── organizations/teams                                      │
│  │   └── audit_logs                                               │
│  ├── MongoDB (Flexible schemas - test results, attachments)      │
│  └── S3/Blob Storage (Screenshots, videos, artifacts)            │
└─────────────────────────────────────────────────────────────────┘
```

## 2. SQLite Local Storage Schema

### Tables

```sql
-- Test Cases (main table)
CREATE TABLE test_cases (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  folder_id TEXT,
  release_id TEXT,
  plan_id TEXT,
  automation_status TEXT CHECK(automation_status IN ('none', 'partial', 'full')),
  priority TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME,
  sync_status TEXT DEFAULT 'pending',
  FOREIGN KEY (folder_id) REFERENCES folders(id)
);

-- Full-text search index
CREATE VIRTUAL TABLE test_cases_fts USING fts5(
  name, description, content='test_cases', content_rowid='rowid'
);

-- Test Steps (separated for efficient updates)
CREATE TABLE test_steps (
  id TEXT PRIMARY KEY,
  test_case_id TEXT NOT NULL,
  position INTEGER NOT NULL,
  name TEXT,
  type TEXT,
  selector TEXT,
  selector_obj TEXT, -- JSON blob for smart selectors
  value TEXT,
  expected_result TEXT,
  qword TEXT,
  args TEXT, -- JSON array
  automation_status TEXT,
  FOREIGN KEY (test_case_id) REFERENCES test_cases(id) ON DELETE CASCADE
);

-- Index for fast step lookups
CREATE INDEX idx_steps_test_case ON test_steps(test_case_id, position);

-- Folders
CREATE TABLE folders (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  parent_id TEXT,
  position INTEGER,
  FOREIGN KEY (parent_id) REFERENCES folders(id)
);

-- Tags (many-to-many)
CREATE TABLE tags (
  id TEXT PRIMARY KEY,
  name TEXT UNIQUE NOT NULL
);

CREATE TABLE test_case_tags (
  test_case_id TEXT,
  tag_id TEXT,
  PRIMARY KEY (test_case_id, tag_id),
  FOREIGN KEY (test_case_id) REFERENCES test_cases(id) ON DELETE CASCADE,
  FOREIGN KEY (tag_id) REFERENCES tags(id)
);

-- Test Runs
CREATE TABLE test_runs (
  id TEXT PRIMARY KEY,
  name TEXT,
  mode TEXT CHECK(mode IN ('manual', 'automated')),
  status TEXT,
  started_at DATETIME,
  ended_at DATETIME,
  release_id TEXT,
  plan_id TEXT,
  results TEXT -- JSON blob
);

-- Sync Queue (for offline-first)
CREATE TABLE sync_queue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  operation TEXT CHECK(operation IN ('create', 'update', 'delete')),
  payload TEXT, -- JSON
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  attempts INTEGER DEFAULT 0,
  last_error TEXT
);
```

### Query Examples

```javascript
// Fast search across 10,000+ test cases
const searchTestCases = (query, filters) => {
  return db.prepare(`
    SELECT tc.*, 
           (SELECT GROUP_CONCAT(t.name) FROM tags t 
            JOIN test_case_tags tct ON t.id = tct.tag_id 
            WHERE tct.test_case_id = tc.id) as tags
    FROM test_cases tc
    JOIN test_cases_fts fts ON tc.rowid = fts.rowid
    WHERE test_cases_fts MATCH ?
      AND (? IS NULL OR tc.folder_id = ?)
      AND (? IS NULL OR tc.automation_status = ?)
    ORDER BY rank
    LIMIT 50 OFFSET ?
  `).all(query, filters.folderId, filters.folderId, 
         filters.status, filters.status, filters.offset);
};

// Paginated folder contents
const getTestCasesInFolder = (folderId, page = 1, pageSize = 50) => {
  return db.prepare(`
    SELECT tc.*, COUNT(ts.id) as step_count
    FROM test_cases tc
    LEFT JOIN test_steps ts ON tc.id = ts.test_case_id
    WHERE tc.folder_id = ?
    GROUP BY tc.id
    ORDER BY tc.updated_at DESC
    LIMIT ? OFFSET ?
  `).all(folderId, pageSize, (page - 1) * pageSize);
};
```

## 3. Memory Management

### Virtualization Strategy

For rendering 1000s of test cases without performance issues:

```typescript
// Use react-virtual for large lists
import { useVirtualizer } from '@tanstack/react-virtual';

function TestCaseList({ testCases }) {
  const parentRef = useRef(null);
  
  const virtualizer = useVirtualizer({
    count: testCases.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 60, // Estimated row height
    overscan: 10 // Render 10 extra items outside viewport
  });
  
  return (
    <div ref={parentRef} style={{ height: '600px', overflow: 'auto' }}>
      <div style={{ height: virtualizer.getTotalSize() }}>
        {virtualizer.getVirtualItems().map(virtualRow => (
          <TestCaseRow 
            key={testCases[virtualRow.index].id}
            testCase={testCases[virtualRow.index]}
            style={{
              position: 'absolute',
              top: virtualRow.start,
              height: virtualRow.size
            }}
          />
        ))}
      </div>
    </div>
  );
}
```

### Caching Strategy

```typescript
// React Query for automatic caching and background refetching
const useTestCases = (filters) => {
  return useQuery({
    queryKey: ['testCases', filters],
    queryFn: () => fetchTestCases(filters),
    staleTime: 5 * 60 * 1000, // 5 minutes
    cacheTime: 30 * 60 * 1000, // 30 minutes
    keepPreviousData: true // Smooth pagination
  });
};

// Optimistic updates for instant UI feedback
const useUpdateTestCase = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: updateTestCase,
    onMutate: async (newData) => {
      await queryClient.cancelQueries(['testCases']);
      const previous = queryClient.getQueryData(['testCases']);
      queryClient.setQueryData(['testCases'], (old) => 
        old.map(tc => tc.id === newData.id ? { ...tc, ...newData } : tc)
      );
      return { previous };
    },
    onError: (err, newData, context) => {
      queryClient.setQueryData(['testCases'], context.previous);
    },
    onSettled: () => {
      queryClient.invalidateQueries(['testCases']);
    }
  });
};
```

## 4. Scalability Dimensions

### Test Case Volume
| Scale | Test Cases | Storage | Query Time |
|-------|------------|---------|------------|
| Small | < 100 | JSON (localStorage) | < 10ms |
| Medium | 100-1,000 | JSON (Electron) | < 50ms |
| Large | 1,000-10,000 | SQLite | < 100ms |
| Enterprise | 10,000+ | SQLite + Cloud | < 200ms |

### Team Size
| Scale | Users | Strategy |
|-------|-------|----------|
| Solo | 1 | Local-only |
| Small Team | 2-10 | Shared folder / Git |
| Medium Team | 10-50 | Cloud sync |
| Enterprise | 50+ | Cloud + RBAC + Audit |

### Execution Volume
| Scale | Runs/Day | Strategy |
|-------|----------|----------|
| Low | < 10 | Sequential local |
| Medium | 10-100 | Parallel local |
| High | 100-1000 | Distributed (CI/CD) |
| Enterprise | 1000+ | Cloud grid + scheduling |

## 5. Orphaned Test Case Handling

### Import Pipeline
```
┌───────────────┐     ┌───────────────┐     ┌───────────────┐
│ External Tool │ ──► │ Import Parser │ ──► │ Staging Area  │
│ (Jira, etc.)  │     │               │     │               │
└───────────────┘     └───────────────┘     └───────────────┘
                                                    │
                                                    ▼
                      ┌─────────────────────────────────────┐
                      │         Triage Dashboard            │
                      ├─────────────────────────────────────┤
                      │ • Auto-tag by keywords              │
                      │ • Suggest folder by similarity      │
                      │ • Bulk assign to release/plan       │
                      │ • Merge duplicates                  │
                      │ • Mark for automation review        │
                      └─────────────────────────────────────┘
                                                    │
                                                    ▼
                      ┌───────────────┐     ┌───────────────┐
                      │ Orphaned Pool │ ──► │   Organized   │
                      │ (No folder)   │     │   Folders     │
                      └───────────────┘     └───────────────┘
```

### Auto-Classification

```typescript
// ML-based auto-classification for orphaned tests
const classifyTestCase = (testCase) => {
  const keywords = extractKeywords(testCase.name + ' ' + testCase.description);
  
  const suggestions = {
    folder: suggestFolder(keywords),
    tags: suggestTags(keywords),
    priority: suggestPriority(keywords),
    automation: suggestAutomationPotential(testCase.steps)
  };
  
  return suggestions;
};

// Keyword-based folder suggestions
const folderMappings = {
  'login|auth|sso|password': 'Authentication',
  'api|rest|graphql|endpoint': 'API Tests',
  'payment|checkout|cart': 'E-Commerce',
  'mobile|ios|android': 'Mobile',
  'performance|load|stress': 'Performance'
};
```

## 6. Implementation Phases

### Phase 1: SQLite Migration (Week 1-2)
- [ ] Add better-sqlite3 to Electron
- [ ] Create migration from JSON to SQLite
- [ ] Update IPC handlers for SQLite queries
- [ ] Add full-text search

### Phase 2: Virtual Scrolling (Week 2-3)
- [ ] Install @tanstack/react-virtual
- [ ] Update TestRepository list component
- [ ] Update test case picker in Recorder
- [ ] Performance testing with 10k+ items

### Phase 3: Background Sync (Week 3-4)
- [ ] Implement sync queue
- [ ] Add conflict resolution
- [ ] Add offline indicator
- [ ] Test network edge cases

### Phase 4: Cloud Backend (Future)
- [ ] API design (REST/GraphQL)
- [ ] Authentication integration
- [ ] Multi-tenant architecture
- [ ] Team collaboration features

## 7. Memory Map

### Current Data Flow
```
User Action → React State → localStorage → Electron Storage
                              ↑                    ↓
                              └──────── Reload ────┘
```

### Target Data Flow
```
User Action → React Query Cache → SQLite (Local) → Sync Queue
                    ↑                                   ↓
                    └────── Background Sync ─────► Cloud DB
                                                       ↓
                    Other Clients ◄──── WebSocket ─────┘
```

### Key Principles
1. **Local-First**: Always save locally first, sync later
2. **Optimistic UI**: Update UI immediately, reconcile later
3. **Lazy Loading**: Only load what's visible
4. **Incremental Sync**: Sync changes, not full datasets
5. **Conflict Resolution**: Last-write-wins with audit trail

## 8. API Design (Future Cloud)

### GraphQL Schema (Draft)
```graphql
type TestCase {
  id: ID!
  name: String!
  description: String
  folder: Folder
  steps: [TestStep!]!
  tags: [Tag!]!
  automationStatus: AutomationStatus!
  createdBy: User!
  createdAt: DateTime!
  updatedAt: DateTime
}

type Query {
  testCases(
    filter: TestCaseFilter
    pagination: Pagination
    sort: TestCaseSort
  ): TestCaseConnection!
  
  testCase(id: ID!): TestCase
  
  searchTestCases(query: String!): [TestCase!]!
}

type Mutation {
  createTestCase(input: CreateTestCaseInput!): TestCase!
  updateTestCase(id: ID!, input: UpdateTestCaseInput!): TestCase!
  deleteTestCase(id: ID!): Boolean!
  
  mergeAutomation(
    testCaseId: ID!
    recordedActions: [RecordedActionInput!]!
    mergeStrategy: MergeStrategy!
  ): TestCase!
}
```

## Summary

This architecture provides:
- **Scalability**: From 10 to 100,000+ test cases
- **Performance**: Sub-second queries with proper indexing
- **Offline-First**: Full functionality without network
- **Enterprise-Ready**: Team collaboration, audit trails, SSO
- **Flexible Migration**: Gradual upgrade path from local to cloud


