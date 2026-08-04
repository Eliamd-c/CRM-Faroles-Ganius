# Builder Refactoring - Phase 2 (Integration)

**Duration:** 2-3 weeks (40-60 working hours)
**Goal:** Safely integrate new architecture with legacy code in production
**Strategy:** Parallel execution → Gradual deprecation → Full migration
**Status:** Planning → Ready to Execute

---

## Phase 2 Overview

### Current State (End of Phase 1)
- ✅ New modular architecture complete (public/builder-new/)
- ✅ All 96 tests passing
- ✅ 100% UI parity with legacy code
- ✅ Full documentation
- ❌ Not yet integrated into main builder.js
- ❌ Legacy code still dominant

### End State (Phase 2)
- ✅ New architecture running in parallel with legacy
- ✅ New code handles all webhook events
- ✅ Legacy code as fallback only
- ✅ Monitoring shows stability
- ✅ Zero production issues

### Approach
**Safe, reversible, measurable migration:**
1. **Week 1:** Integration layer + dual execution setup
2. **Week 2:** Monitoring + validation + gradual traffic shift
3. **Week 3 (optional):** Full deprecation if fully stable

---

## Phase 2 Breakdown

### WEEK 1: Integration Foundation (20 hours)

#### Step 2.1: Create Integration Layer (6 hours)

**Objective:** Bridge new architecture with existing app.js

**Create public/builder-integration.js:**

```javascript
// Wrapper that coordinates old + new code
class BuilderIntegration {
  constructor(options) {
    this.legacyBuilder = options.legacyBuilder;  // old builder.js
    this.newBuilder = options.newBuilder;        // new builder-new/
    this.logger = options.logger;
    this.metrics = new MetricsCollector();
    this.featureFlags = options.featureFlags || {};
  }

  // Main entry point for webhook events
  async handleWebhookEvent(eventData) {
    const eventId = generateId();
    const startTime = Date.now();

    try {
      // STEP 1: Execute new code first (primary)
      let newResult = null;
      let newError = null;
      try {
        newResult = await this._executeNewHandler(eventData, eventId);
        this.metrics.recordSuccess('new_handler', Date.now() - startTime);
      } catch (e) {
        newError = e;
        this.metrics.recordError('new_handler', e);
        this.logger.error('New handler failed', { eventId, error: e });
      }

      // STEP 2: Execute legacy code in parallel (fallback)
      let legacyResult = null;
      let legacyError = null;
      try {
        legacyResult = await this._executeLegacyHandler(eventData, eventId);
        this.metrics.recordSuccess('legacy_handler', Date.now() - startTime);
      } catch (e) {
        legacyError = e;
        this.metrics.recordError('legacy_handler', e);
        this.logger.error('Legacy handler failed', { eventId, error: e });
      }

      // STEP 3: Compare results
      const comparison = this._compareResults(newResult, legacyResult, eventId);
      this.metrics.recordComparison(comparison);

      // STEP 4: Return result (new if successful, fallback to legacy)
      if (newResult && !newError) {
        return { result: newResult, source: 'new', eventId };
      } else if (legacyResult && !legacyError) {
        this.logger.warn('Fallback to legacy handler', { eventId });
        return { result: legacyResult, source: 'legacy', eventId };
      } else {
        throw new Error('Both handlers failed');
      }
    } catch (e) {
      this.logger.error('Critical webhook error', { eventId, error: e });
      this.metrics.recordCriticalError(eventId);
      throw e;
    }
  }

  private async _executeNewHandler(eventData, eventId) {
    // Use new use-cases from builder-new/
    const { di } = this;  // Dependency injection from Phase 1
    
    if (eventData.type === 'message') {
      return await di.handleIncomingMessage.execute({
        senderId: eventData.sender_id,
        text: eventData.message,
        mid: eventData.message_id
      });
    }
    // ... handle other event types
  }

  private async _executeLegacyHandler(eventData, eventId) {
    // Use old handlers from builder.js
    return this.legacyBuilder.handleWebhookEvent(eventData);
  }

  private _compareResults(newResult, legacyResult, eventId) {
    // Compare outcomes, log discrepancies
    return {
      match: this._resultsMatch(newResult, legacyResult),
      newResult,
      legacyResult,
      eventId
    };
  }

  getMetrics() {
    return this.metrics.getSummary();
  }
}
```

**Deliverables:**
- [ ] Create public/builder-integration.js (400+ lines)
- [ ] Implement dual execution logic
- [ ] Create MetricsCollector class
- [ ] Create EventComparator class
- [ ] Add error recovery logic
- [ ] Document integration points

**Validation:**
```bash
# Verify integration layer loads without errors
node -e "require('./public/builder-integration.js')"
```

---

#### Step 2.2: Update app.js Webhook Handler (4 hours)

**Objective:** Wire integration layer into main app

**Modify app.js around line 160 (webhook POST handler):**

```javascript
// app.js - around line 160

// PHASE 2: Use integration layer for dual execution
const builderIntegration = new BuilderIntegration({
  legacyBuilder: { handleWebhookEvent: handleWebhookLegacy },
  newBuilder: di,  // from Phase 1 bootstrap
  logger,
  featureFlags: {
    DUAL_EXECUTION: true,
    NEW_AS_PRIMARY: true,
    LEGACY_FALLBACK: true
  }
});

app.post('/webhook', async (req, res) => {
  try {
    const body = req.body;
    
    for (const event of body.entry[0].messaging) {
      // Use integration layer (new + legacy parallel)
      await builderIntegration.handleWebhookEvent({
        type: 'message',
        sender_id: event.sender.id,
        message: event.message?.text,
        message_id: event.message.mid,
        timestamp: event.timestamp
      });
    }
    
    res.sendStatus(200);
  } catch (e) {
    logger.error('Webhook error', { error: e });
    res.status(500).json({ error: 'Internal server error' });
  }
});
```

**Deliverables:**
- [ ] Import BuilderIntegration into app.js
- [ ] Initialize with both old + new builders
- [ ] Modify webhook handler to use integration layer
- [ ] Add error handling
- [ ] Verify existing functionality still works

**Validation:**
```bash
# Test webhook with integration layer
curl -X POST http://localhost:3000/webhook \
  -H "Content-Type: application/json" \
  -d '{"entry":[{"messaging":[{"sender":{"id":"123"},"message":{"text":"test"}}]}]}'
# Should return 200 (both handlers executed)
```

---

#### Step 2.3: Build Metrics & Monitoring (6 hours)

**Objective:** Track health of both systems

**Create public/services/metrics.js:**

```javascript
class MetricsCollector {
  constructor() {
    this.events = {
      total: 0,
      new_success: 0,
      new_error: 0,
      legacy_success: 0,
      legacy_error: 0,
      results_match: 0,
      results_differ: 0,
      critical_errors: 0
    };
    
    this.timings = {
      new_handler: [],
      legacy_handler: [],
      total: []
    };
    
    this.errors = [];
  }

  recordSuccess(handler, duration) {
    this.events.total += 1;
    this.events[`${handler}_success`] += 1;
    this.timings[handler].push(duration);
    this.timings.total.push(duration);
  }

  recordError(handler, error) {
    this.events[`${handler}_error`] += 1;
    this.errors.push({
      timestamp: new Date(),
      handler,
      error: error.message,
      stack: error.stack
    });
  }

  recordComparison(comparison) {
    if (comparison.match) {
      this.events.results_match += 1;
    } else {
      this.events.results_differ += 1;
      this.logger.warn('Results differ', comparison);
    }
  }

  recordCriticalError(eventId) {
    this.events.critical_errors += 1;
  }

  getSummary() {
    return {
      events: this.events,
      timings: {
        new_handler_avg: this._average(this.timings.new_handler),
        legacy_handler_avg: this._average(this.timings.legacy_handler),
        total_avg: this._average(this.timings.total)
      },
      health: this._calculateHealth(),
      recentErrors: this.errors.slice(-10)
    };
  }

  private _calculateHealth() {
    const totalEvents = this.events.total;
    if (totalEvents === 0) return 'UNKNOWN';
    
    const successRate = 
      (this.events.new_success + this.events.legacy_success) / (totalEvents * 2);
    const matchRate = 
      this.events.results_match / (this.events.results_match + this.events.results_differ || 1);
    
    if (successRate > 0.99 && matchRate > 0.95) return 'HEALTHY';
    if (successRate > 0.95 && matchRate > 0.80) return 'DEGRADED';
    return 'UNHEALTHY';
  }

  private _average(arr) {
    if (arr.length === 0) return 0;
    return arr.reduce((a, b) => a + b) / arr.length;
  }
}
```

**Create public/services/health-check.js:**

```javascript
// Health check endpoint for monitoring
app.get('/health/builder', (req, res) => {
  const metrics = builderIntegration.getMetrics();
  
  res.json({
    status: metrics.health,
    timestamp: new Date(),
    metrics: {
      total_events: metrics.events.total,
      success_rate: 
        (metrics.events.new_success / metrics.events.total * 100).toFixed(2) + '%',
      match_rate: 
        (metrics.events.results_match / 
          (metrics.events.results_match + metrics.events.results_differ) * 100).toFixed(2) + '%',
      avg_latency_ms: metrics.timings.total_avg.toFixed(2),
      recent_errors: metrics.recentErrors.length
    }
  });
});

// Dashboard for real-time monitoring (optional)
app.get('/dashboard/builder-metrics', (req, res) => {
  const metrics = builderIntegration.getMetrics();
  res.json(metrics);
});
```

**Deliverables:**
- [ ] Create MetricsCollector class (200+ lines)
- [ ] Create HealthCheck service
- [ ] Add /health/builder endpoint
- [ ] Add /dashboard/builder-metrics endpoint
- [ ] Integration into app.js
- [ ] Test metrics collection

**Validation:**
```bash
# Check health endpoint
curl http://localhost:3000/health/builder
# Should return JSON with status, metrics

# Check metrics dashboard
curl http://localhost:3000/dashboard/builder-metrics
# Should return detailed metrics
```

---

#### Step 2.4: Add Feature Flags (4 hours)

**Objective:** Control behavior without redeploying

**Create public/services/feature-flags.js:**

```javascript
class FeatureFlags {
  constructor(config) {
    this.flags = {
      DUAL_EXECUTION: config.dualExecution ?? true,
      NEW_AS_PRIMARY: config.newAsPrimary ?? true,
      LEGACY_FALLBACK: config.legacyFallback ?? true,
      COMPARE_RESULTS: config.compareResults ?? true,
      LOG_DISCREPANCIES: config.logDiscrepancies ?? true,
      GRADUALLY_SHIFT_TRAFFIC: config.graduallyShiftTraffic ?? false
    };
    
    this.trafficShift = {
      newHandlerPercentage: config.newHandlerPercentage ?? 50,
      // 50% → new handler primary
      // 50% → legacy handler primary
    };
  }

  isEnabled(flagName) {
    return this.flags[flagName] ?? false;
  }

  shouldUseNewHandler() {
    if (!this.flags.GRADUALLY_SHIFT_TRAFFIC) {
      return this.flags.NEW_AS_PRIMARY;
    }
    
    // Percentage-based traffic shift
    const random = Math.random() * 100;
    return random < this.trafficShift.newHandlerPercentage;
  }

  updateFlag(flagName, value) {
    this.flags[flagName] = value;
    // Log update to backend
  }

  setTrafficShift(percentage) {
    this.trafficShift.newHandlerPercentage = percentage;
  }
}

// Control endpoint (admin only)
app.post('/admin/builder-flags', authenticate, (req, res) => {
  const { flag, value } = req.body;
  featureFlags.updateFlag(flag, value);
  res.json({ updated: flag, value });
});
```

**Usage in integration layer:**

```javascript
async handleWebhookEvent(eventData) {
  if (featureFlags.shouldUseNewHandler()) {
    // Try new handler first
    newResult = await this._executeNewHandler(...);
  } else {
    // Try legacy handler first
    legacyResult = await this._executeLegacyHandler(...);
  }
}
```

**Deliverables:**
- [ ] Create FeatureFlags class (150+ lines)
- [ ] Add flag control endpoints
- [ ] Integrate into BuilderIntegration
- [ ] Add authentication to flag endpoints
- [ ] Document all flags and their effects

**Validation:**
```bash
# Toggle flag
curl -X POST http://localhost:3000/admin/builder-flags \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -d '{"flag":"NEW_AS_PRIMARY","value":false}'
# Should switch to legacy as primary
```

---

### WEEK 2: Monitoring & Validation (20 hours)

#### Step 2.5: Deploy to Staging (4 hours)

**Objective:** Test Phase 2 integration in staging environment

**Steps:**
1. Merge BUILDER_PHASE2_PLAN changes to staging branch
2. Deploy to Vercel staging
3. Verify both handlers execute
4. Check /health/builder endpoint
5. Monitor /dashboard/builder-metrics for 4 hours
6. Verify no regressions with real user traffic

**Validation Checklist:**
- [ ] Both handlers execute successfully
- [ ] Results match 95%+ of the time
- [ ] New handler latency < legacy handler latency
- [ ] No increase in error rate
- [ ] No visual regressions
- [ ] Metrics dashboard showing real data

---

#### Step 2.6: Gradual Traffic Shift (8 hours)

**Objective:** Incrementally increase reliance on new code

**Timeline:**
- **Hour 1-2:** Monitor at 50/50 split
- **Hour 3-4:** If healthy, shift to 60% new / 40% legacy
- **Hour 5-6:** If still healthy, shift to 70% new / 30% legacy
- **Hour 7-8:** If fully healthy, shift to 90% new / 10% legacy

**Per hour, verify:**
- [ ] Error rate < 0.5%
- [ ] Results match > 95%
- [ ] No increased latency
- [ ] User reports: no issues
- [ ] Backend logs: no anomalies

**If any issue detected:**
- [ ] Immediately revert to 50/50 split
- [ ] Investigate discrepancy
- [ ] Fix in new code
- [ ] Resume traffic shift

---

#### Step 2.7: Load Testing (8 hours)

**Objective:** Ensure both systems handle peak load

**Create test-load.js:**

```javascript
// Simulate 1000 concurrent webhook events
const concurrentRequests = 1000;
const duration = 3600000; // 1 hour

async function loadTest() {
  const metrics = [];
  const startTime = Date.now();
  
  while (Date.now() - startTime < duration) {
    const promises = [];
    
    for (let i = 0; i < concurrentRequests; i++) {
      promises.push(
        fetch('http://localhost:3000/webhook', {
          method: 'POST',
          body: JSON.stringify({
            entry: [{
              messaging: [{
                sender: { id: Math.random().toString() },
                message: { text: 'test message', mid: Math.random().toString() }
              }]
            })
          })
        })
      );
    }
    
    const results = await Promise.allSettled(promises);
    const failures = results.filter(r => r.status === 'rejected').length;
    
    metrics.push({
      timestamp: new Date(),
      totalRequests: concurrentRequests,
      failures,
      successRate: ((concurrentRequests - failures) / concurrentRequests * 100).toFixed(2) + '%'
    });
    
    console.log(`[${new Date().toISOString()}] Success rate: ${metrics[metrics.length - 1].successRate}`);
  }
  
  return metrics;
}

// Run: node test-load.js
```

**Success Criteria:**
- [ ] 99%+ success rate under 1000 concurrent requests
- [ ] Both handlers complete < 500ms average
- [ ] No memory leaks detected
- [ ] Database connections stable

---

### WEEK 3: Full Deprecation (Optional, 20 hours)

#### Step 2.8: Remove Legacy Handlers (6 hours)

**Objective:** Complete migration if Phase 2 fully successful

**Only execute if:**
- ✅ Week 1-2 completely stable
- ✅ Zero discrepancies between new/legacy
- ✅ All metrics green for 48+ hours
- ✅ Team confidence high

**Process:**
1. Backup old builder.js (rename to builder.legacy.js)
2. Remove all legacy handler code
3. Update app.js to use only new handlers
4. Remove integration layer
5. Remove feature flags (no longer needed)
6. Simplify webhook handler

**Final webhook handler:**
```javascript
app.post('/webhook', async (req, res) => {
  try {
    const body = req.body;
    
    for (const event of body.entry[0].messaging) {
      // Only new handlers (clean architecture)
      await di.handleIncomingMessage.execute({
        senderId: event.sender.id,
        text: event.message?.text,
        mid: event.message.mid
      });
    }
    
    res.sendStatus(200);
  } catch (e) {
    errorHandler.handle(e, { context: 'webhook' });
    res.status(500).json({ error: 'Internal server error' });
  }
});
```

**Deliverables:**
- [ ] Remove legacy handler code
- [ ] Remove integration layer
- [ ] Remove feature flags
- [ ] Clean up app.js
- [ ] Update documentation
- [ ] Verify all tests still pass
- [ ] Deploy to production

**Validation:**
- [ ] app.js simplified by 30%+
- [ ] All 96 tests still passing
- [ ] Zero regressions
- [ ] Metrics show expected behavior

---

## Rollback Plan

**At any point during Phase 2, if issues detected:**

1. **Immediate:** Flip feature flag back to legacy
   ```bash
   curl -X POST /admin/builder-flags \
     -d '{"flag":"NEW_AS_PRIMARY","value":false}'
   ```

2. **Short term (< 1 hour):** Revert commits on staging
   ```bash
   git revert <integration-commit>
   git push origin staging
   ```

3. **Long term:** Return to Phase 1
   - Remove integration layer
   - Keep new architecture for future
   - Debug issues before re-attempting Phase 2

**Never** force a migration if system is unhealthy.

---

## Success Criteria for Phase 2

✅ **Execution:**
- Both handlers running in parallel successfully
- New handler executes first, legacy as fallback
- 100% webhook event handling (no dropped events)

✅ **Stability:**
- Error rate < 0.5%
- Results match > 95% of the time
- No performance degradation
- No increased memory usage

✅ **Monitoring:**
- Health checks passing
- Metrics dashboard operational
- All discrepancies logged and reviewed

✅ **Team Confidence:**
- Zero production incidents
- User reports: no issues
- Code review approved
- Ready for full migration

---

## Timeline

| Week | Days | Task | Hours | Status |
|------|------|------|-------|--------|
| 1 | Mon-Tue | Integration layer | 10 | 🟡 |
| 1 | Wed-Thu | Metrics + health | 6 | ⏳ |
| 1 | Fri | Feature flags + staging | 4 | ⏳ |
| 2 | Mon-Tue | Monitor + validation | 8 | ⏳ |
| 2 | Wed-Thu | Load testing | 8 | ⏳ |
| 2 | Fri | Adjust based on results | 4 | ⏳ |
| 3 | Mon-Fri | Full deprecation (if ready) | 20 | ⏳ |
| **TOTAL** | **2-3 weeks** | **Safe migration** | **40-60h** | 🟡 |

---

## Supervisor Responsibilities

1. **Daily standups** - Review integration progress
2. **Metric validation** - Ensure accuracy and completeness
3. **Feature flag control** - Manage traffic shifting
4. **Issue resolution** - Debug any discrepancies
5. **Go/no-go decisions** - Week-by-week progression

---

## Success = Safe Production Migration

By end of Phase 2:
- ✅ New architecture proven in production
- ✅ Zero downtime migration
- ✅ Full team confidence
- ✅ Ready for Phase 3 (cleanup)

