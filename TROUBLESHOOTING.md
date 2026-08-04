# Troubleshooting Guide

**Version:** 2.0  
**Last Updated:** August 4, 2024

## Common Issues & Solutions

### Issue: Webhook Not Receiving Events

**Symptoms:**
- No messages being processed
- `/webhook` endpoint returning 200 OK but no handler execution
- Meta webhook logs show delivery success but nothing happens

**Causes & Solutions:**

1. **Verify Webhook URL Configuration**
   ```bash
   # Check Meta app configuration
   # Go to: Meta for Developers > Your App > Messenger > Settings
   # Verify webhook URL matches production domain
   ```

2. **Check Webhook Signature**
   ```bash
   # If signature validation fails, check APP_SECRET
   # Webhook handler logs: "Firma de webhook inválida (NO BLOQUEANTE)"
   # This is non-blocking but indicates configuration mismatch
   ```

3. **Verify Subscribe Webhook**
   ```bash
   # Meta requires subscription to specific fields:
   # - messaging
   # - messages
   # - message_reads
   # - message_echoes
   # - standby
   # - message_edits
   ```

4. **Check Verify Token**
   ```bash
   # In Meta webhook setup, verify token must match VERIFY_TOKEN env var
   # Test: curl https://your-domain/webhook?hub.mode=subscribe&hub.verify_token=YOUR_TOKEN&hub.challenge=TEST
   ```

### Issue: Messages Not Being Sent

**Symptoms:**
- Incoming messages processed but no response sent
- Database shows message received but no outbound message
- Logs show no errors

**Causes & Solutions:**

1. **Check Access Token**
   ```bash
   # Verify INSTAGRAM_ACCESS_TOKEN is set and valid
   # Test with Meta Graph API:
   curl "https://graph.instagram.com/me?access_token=YOUR_TOKEN"
   # Should return user info, not error
   ```

2. **Verify Account ID**
   ```bash
   # INSTAGRAM_ACCOUNT_ID must be the business account ID
   # Not the personal account username
   # Check logs: "Account ID : <value>"
   ```

3. **Check Recipient**
   ```javascript
   // Recipient ID must be the customer's IG user ID
   // Not their username
   // Get from webhook event: event.sender.id
   ```

4. **Verify Flow Configuration**
   ```bash
   # Check if default flow exists
   GET /api/flows
   
   # If empty, create default flow via UI
   # Or: POST /api/flows with empty array
   ```

### Issue: Database Connection Errors

**Symptoms:**
- "Supabase no conectado" errors
- Database operations failing
- Can't save customer data

**Causes & Solutions:**

1. **Verify Supabase Configuration**
   ```bash
   # Check .env file for:
   # SUPABASE_URL=https://...
   # SUPABASE_KEY=eyJ...
   
   # Test connection:
   # Look for logs during startup: "✅ Supabase connected"
   ```

2. **Check Database Tables**
   ```sql
   -- Verify required tables exist:
   SELECT table_name FROM information_schema.tables 
   WHERE table_schema = 'public';
   
   -- Should include: customers, messages, flows, etc.
   ```

3. **Network Connectivity**
   ```bash
   # From server, test Supabase connectivity:
   curl -I https://YOUR_SUPABASE_URL
   # Should return 200
   ```

### Issue: High Latency / Slow Performance

**Symptoms:**
- Messages taking > 1 second to process
- P95 latency > 500ms
- Memory usage creeping up

**Causes & Solutions:**

1. **Check Database Performance**
   ```sql
   -- Analyze query performance
   SELECT query, mean_time, calls 
   FROM pg_stat_statements 
   ORDER BY mean_time DESC 
   LIMIT 10;
   ```

2. **Review Logs for Slow Operations**
   ```bash
   # Look for messages with high duration
   # Typical breakdown:
   # - Database: 20-50ms
   # - AI/OpenAI: 1-2 seconds (if used)
   # - Meta API: 30-100ms
   # - Flow processing: 10-50ms
   ```

3. **Monitor Memory Usage**
   ```bash
   # If memory > 500MB, check for:
   # - Memory leaks in event listeners
   # - Unbounded arrays/caches
   # - Connection pooling issues
   
   # Restart server to clear memory
   ```

4. **Check Concurrent Requests**
   ```bash
   # Verify not exceeding database connection limits
   # Default pool: 10 connections
   # If > 10 concurrent, increase pool size or optimize queries
   ```

### Issue: AI/OpenAI Not Working

**Symptoms:**
- AI agent responses returning generic messages
- OpenAI API errors in logs
- "OPENAI_API_KEY not configured"

**Causes & Solutions:**

1. **Verify API Key**
   ```bash
   # Check .env: OPENAI_API_KEY=sk-...
   # Test API key:
   curl "https://api.openai.com/v1/models" \
     -H "Authorization: Bearer YOUR_KEY"
   # Should return model list, not error
   ```

2. **Check Rate Limits**
   ```bash
   # OpenAI rate limit errors show up as 429
   # Look for logs: "Error: 429 Too Many Requests"
   # Solution: Add request throttling or upgrade plan
   ```

3. **Verify Model Availability**
   ```bash
   # Current model: gpt-4o-mini
   # If not available, check:
   # - Account access level
   # - Organization limits
   # - Model deprecation
   ```

### Issue: Memory Leaks

**Symptoms:**
- Memory usage grows over time
- Server crashes after several hours
- Restart required daily

**Causes & Solutions:**

1. **Check Event Listener Cleanup**
   ```bash
   # In app.js, SSE clients should be removed on close:
   req.on('close', () => {
     clearInterval(heartbeat);
     state.sseClients = state.sseClients.filter(c => c.id !== clientId);
   });
   ```

2. **Verify Database Connection Pooling**
   ```bash
   # Connection pool should auto-manage
   # If manual connections, ensure proper cleanup
   ```

3. **Monitor Array Growth**
   ```javascript
   // Dangerous patterns:
   state.array.push(item); // Without limit
   
   // Safe patterns:
   state.array = state.array.slice(-1000); // Keep last 1000
   ```

### Issue: Webhook Returns 500 Error

**Symptoms:**
- Meta reports webhook delivery failed
- Error response body may be truncated
- Logs show error stack trace

**Causes & Solutions:**

1. **Check Recent Errors**
   ```bash
   # Review application logs for:
   # [EXPRESS ERROR] message
   # [BuilderIntegration ...] Error (phase 2 only)
   # [Handler ...] Error
   ```

2. **Common Error Causes:**
   - Uninitialized state variables
   - Missing environment variables
   - Database connection timeout
   - Unhandled promise rejection

3. **Test Webhook Locally**
   ```bash
   # Simulate webhook event:
   curl -X POST http://localhost:3000/webhook \
     -H "Content-Type: application/json" \
     -H "X-Hub-Signature-256: sha256=..." \
     -d '{"object":"instagram","entry":[{"messaging":[{"sender":{"id":"123"},"message":{"text":"test"}}]}]}'
   ```

### Issue: Contact Data Not Syncing

**Symptoms:**
- Contacts visible in Meta but not in CRM
- `/api/contacts` returns empty list
- Sync operation completes but no data appears

**Causes & Solutions:**

1. **Trigger Manual Sync**
   ```bash
   # Run sync endpoint:
   curl -X POST https://your-domain/api/sync-conversations \
     -H "Authorization: Bearer YOUR_API_SECRET" \
     -H "Content-Type: application/json"
   
   # Check response for messages_synced count
   ```

2. **Verify Database Permissions**
   ```sql
   -- Check if inserts are working:
   SELECT COUNT(*) FROM customers;
   ```

3. **Check Account ID Configuration**
   ```bash
   # Must be exact match to Meta business account ID
   # Not the Instagram business account ID (different!)
   ```

## Performance Optimization Tips

### 1. Database Query Optimization

```sql
-- Add indexes for common queries:
CREATE INDEX idx_customers_instagram_id ON customers(instagram_id);
CREATE INDEX idx_messages_instagram_id ON messages(instagram_id);
CREATE INDEX idx_messages_created_at ON messages(created_at);
```

### 2. Caching Strategy

```javascript
// Cache frequently accessed flows:
const flowCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function getFlow(id) {
  if (flowCache.has(id)) {
    return flowCache.get(id);
  }
  // Load from DB, cache result
}
```

### 3. Connection Pooling

```javascript
// Supabase auto-manages pooling
// Default: 10 connections
// For higher load, check Supabase dashboard
```

### 4. Reduce API Calls

```javascript
// Batch similar operations:
// Instead of: 10 API calls in sequence
// Do: 1 batch API call
```

## Debug Procedures

### Step 1: Check Server Status

```bash
# Is server running?
curl https://your-domain/health/builder

# Expected: 200 HEALTHY
```

### Step 2: Check Environment

```bash
# Verify all .env variables set:
echo $INSTAGRAM_ACCESS_TOKEN
echo $API_SECRET
echo $SUPABASE_URL
echo $OPENAI_API_KEY
```

### Step 3: Check Logs

```bash
# If using Vercel:
# Go to Vercel dashboard > Deployments > Logs

# If local:
# Check console output, look for [ERROR] lines
```

### Step 4: Test Components Individually

```bash
# Test Meta API:
curl "https://graph.instagram.com/me?access_token=TOKEN"

# Test Supabase:
# Check Supabase dashboard > SQL Editor

# Test OpenAI:
curl "https://api.openai.com/v1/models" -H "Authorization: Bearer KEY"
```

### Step 5: Enable Debug Logging

```bash
# In app.js, add before server start:
console.debug = (...args) => console.log('[DEBUG]', ...args);
```

## Rollback Procedure

**If Critical Issue:**

```bash
# Fast rollback (< 5 minutes):
git revert <phase3-commit>
git push origin main

# Vercel auto-deploys
# Monitor: https://vercel.com/dashboard
```

**Recovery Steps:**

1. Revert code
2. Verify deployment successful
3. Run `/health/builder` check
4. Monitor error rates for 10 minutes
5. Document incident

## Support Contacts

- **Architecture Questions:** See ARCHITECTURE_FINAL.md
- **Deployment Issues:** See PRODUCTION_DEPLOYMENT_GUIDE.md
- **Code Issues:** Check git log and code comments
- **Emergency Rollback:** See steps above

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 2.0 | Aug 4, 2024 | Clean architecture, removed integration layer |
| 1.1 | Phase 2 | Dual execution with metrics |
| 1.0 | Phase 1 | Initial architecture design |
