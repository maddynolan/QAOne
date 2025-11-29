# ⭐ Flowstral Architecture V2 - Optimized & Production-Ready

## 🎯 Your Architecture is Excellent - Here's Why

Your proposed architecture is **spot-on** for production. The clear separation between deterministic engine work and LLM reasoning is exactly what's needed. Here's my analysis and implementation plan.

## ✅ Architecture Validation

### Stage 1: Capture & Instrumentation (NO LLM) ✅
**Status**: Already implemented, but needs optimization

**Current Implementation:**
- ✅ Event capture (clicks, typing, navigation)
- ✅ DOM snapshots
- ✅ Network metrics (basic)
- ✅ Accessibility scans (WCAG)
- ⚠️ Screenshots: Partial (needs enhancement for visual anchors)
- ⚠️ Performance metrics: Basic (needs full Web Vitals)

**Optimizations Needed:**
1. **Screenshot Strategy**: Capture at "stable states" (after page load, after major actions) - NOT for element detection
2. **DOM Compression**: Current DOM snapshots are too large (50KB limit helps, but we can do better)
3. **Event Batching**: Already implemented, but can optimize buffer size

### Stage 2: Action Graph Builder (NO LLM) ✅
**Status**: Implemented, but needs refinement

**Current Implementation:**
- ✅ Node/edge creation
- ✅ Session normalization (basic)
- ⚠️ Element identity resolution: Needs stable selector generation
- ⚠️ Flow clustering: Not yet implemented

**Critical Missing Pieces:**
1. **Stable Selector Generation**: Need to prioritize data-testid → ARIA → CSS → XPath
2. **Element ID Mapping**: Decouple element identity from brittle selectors
3. **Flow Deduplication**: Group similar paths (e.g., multiple login recordings)

### Stage 3: LLM Work 🧠
**Status**: Implemented, but TOO SLOW (8 minutes = bottleneck)

**Current Implementation:**
- ✅ Semantic enrichment (basic)
- ✅ Test case generation
- ✅ Playwright script generation
- ⚠️ **SPEED ISSUE**: Sequential LLM calls are killing performance

**Root Cause Analysis:**
1. **Sequential Processing**: Test cases generated one-by-one
2. **Large Prompts**: Sending full action graph to LLM each time
3. **No Caching**: Re-generating similar patterns
4. **Model Selection**: Not using tiered models (7B for bulk, 30B for complex)

## 🚀 Speed Optimization Plan

### Immediate Fixes (Target: < 2 minutes)

1. **Parallel Test Case Generation** ✅ (Already implemented in flowstral_artifacts.py line 544)
   - But: Still too slow because of large prompts

2. **Prompt Optimization** 🔧
   - Reduce action graph context (first 20 nodes instead of all)
   - Use focused prompts per test case type
   - Pre-compute summaries before LLM calls

3. **Tiered Model Usage** 🔧
   - Use 7B model for bulk generation (test cases)
   - Use 30B model only for complex reasoning (cross-page flows)

4. **Caching Layer** 🔧
   - Cache common patterns (login, signup, checkout)
   - Reuse test case templates

5. **Batch Processing** 🔧
   - Generate multiple test cases in single LLM call
   - Use JSON array output instead of individual calls

### Implementation Priority

**Phase 1 (Immediate - This Session):**
1. ✅ Add screenshot capture at stable states
2. ✅ Optimize LLM prompts (reduce context size)
3. ✅ Implement tiered model selection
4. ✅ Fix test case display in frontend

**Phase 2 (Next Session):**
1. Stable selector generation
2. Flow clustering/deduplication
3. Pattern library for common flows
4. Quality scoring loop

## 📸 Screenshot Strategy

**Your Approach is Correct:**
- ✅ Screenshots for visual anchors (documentation, reports)
- ✅ DOM is ground truth for element detection
- ❌ NOT using screenshots for element detection (correct!)

**Implementation:**
- Capture screenshots at:
  1. Page load completion
  2. After major actions (form submit, navigation)
  3. Before/after state changes
- Store as base64 in artifacts
- Link to DOM snapshots for cross-reference
- Use for test documentation and visual reports

## 🧠 LLM vs Engine: Clear Boundaries

### ✅ Engine (Deterministic) - MUST be rock solid
- [x] Event capture & instrumentation
- [x] DOM snapshots
- [x] Action graph construction
- [ ] Stable selector generation (TODO)
- [ ] Flow deduplication (TODO)
- [ ] Test execution & flakiness detection (TODO)

### 🧠 LLM (Semantic Reasoning) - Where it shines
- [x] Semantic labeling (page names, flow names)
- [x] Test case generation
- [x] Script synthesis
- [ ] Change impact analysis (TODO - advanced)
- [ ] Defect summarization (TODO)

## 💡 Unique Optimizations

### 1. Delta-Aware Regeneration (Future)
- Detect DOM diffs
- LLM updates tests based on changes
- Self-healing tests

### 2. Pattern Library (Future)
- Store common flows (login, checkout, etc.)
- Reuse optimized patterns
- Merge with new recordings

### 3. Quality Scoring (Future)
- Track test pass rates
- Filter low-quality tests
- Prioritize regeneration

### 4. Tiered Model Usage (NOW)
- 7B model: Bulk test case generation
- 30B model: Complex reasoning, refactoring

## 🎯 Recording-First Approach

**Your Strategy is Correct:**
1. User records flow → Action Graph
2. Engine cleans & structures
3. LLM enriches & generates tests
4. Requirements/repo integration is enrichment layer

**This is the right order for existing apps.**



