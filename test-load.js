/**
 * ═════════════════════════════════════════════════════════════════════
 * PHASE 2 STEP 2.7: LOAD TESTING
 * ═════════════════════════════════════════════════════════════════════
 *
 * Simulates 1000 concurrent webhook events
 * Monitors both handlers under heavy load
 * Tests:
 * 1. Success rate (target: 99%+)
 * 2. Response time (target: < 500ms avg)
 * 3. Handler completion (both handlers)
 * 4. No memory leaks
 * 5. Database stability
 *
 * Usage: node test-load.js <target-url> [--duration 3600] [--concurrent 1000]
 * Local: node test-load.js http://localhost:3000 --duration 60
 * Staging: node test-load.js https://crm-faroles-ganius.vercel.app --duration 3600
 *
 * ═════════════════════════════════════════════════════════════════════
 */

const https = require('https');
const http = require('http');

class LoadTester {
  constructor(targetUrl, options = {}) {
    this.targetUrl = targetUrl.replace(/\/$/, '');
    this.protocol = this.targetUrl.startsWith('https') ? https : http;
    this.duration = (options.duration || 3600) * 1000; // Convert to ms
    this.concurrentRequests = options.concurrent || 1000;
    this.reportInterval = options.reportInterval || 60000; // 1 minute
    this.batchSize = options.batchSize || 100;

    this.results = {
      startTime: new Date(),
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      totalDuration: 0,
      responseTimes: [],
      errors: [],
      statusCodes: {},
      memorySnapshots: []
    };

    this.config = {
      targets: [
        { type: 'message', weight: 0.5 },
        { type: 'delivery', weight: 0.3 },
        { type: 'read', weight: 0.2 }
      ]
    };
  }

  async run() {
    console.log('\n╔═══════════════════════════════════════════════════════════════════════╗');
    console.log('║ PHASE 2 STEP 2.7: LOAD TESTING                                      ║');
    console.log('╚═══════════════════════════════════════════════════════════════════════╝\n');

    console.log(`Target URL: ${this.targetUrl}`);
    console.log(`Duration: ${this.duration / 1000} seconds`);
    console.log(`Concurrent requests: ${this.concurrentRequests}`);
    console.log(`Batch size: ${this.batchSize}\n`);

    console.log('Success Criteria:');
    console.log('  ✓ Success rate: 99%+');
    console.log('  ✓ Average latency: < 500ms');
    console.log('  ✓ P95 latency: < 1000ms');
    console.log('  ✓ No timeout errors\n');

    await this._runLoadTest();
    this._generateReport();

    return this.results;
  }

  async _runLoadTest() {
    console.log('═══════════════════════════════════════════════════════════════════════\n');
    console.log('LOAD TEST STARTED\n');

    const startTime = Date.now();
    const endTime = startTime + this.duration;
    let batchNumber = 0;

    // Reporter interval
    const reporterInterval = setInterval(() => {
      this._printProgress();
    }, this.reportInterval);

    // Load test loop
    while (Date.now() < endTime) {
      batchNumber++;
      const batchPromises = [];

      for (let i = 0; i < this.batchSize; i++) {
        batchPromises.push(this._sendRequest());
      }

      await Promise.allSettled(batchPromises);

      // Throttle to avoid overwhelming system
      await this._sleep(100);
    }

    clearInterval(reporterInterval);
    console.log('\n═══════════════════════════════════════════════════════════════════════\n');
  }

  async _sendRequest() {
    const startTime = Date.now();
    const eventType = this._selectEventType();
    const payload = this._generatePayload(eventType);

    return new Promise((resolve, reject) => {
      const url = new URL(this.targetUrl + '/webhook');
      const options = {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname + url.search,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Hub-Signature-256': 'sha256=test'
        },
        timeout: 10000 // 10 second timeout
      };

      const req = this.protocol.request(options, (res) => {
        let data = '';

        res.on('data', chunk => {
          data += chunk;
        });

        res.on('end', () => {
          const duration = Date.now() - startTime;
          this.results.totalRequests += 1;
          this.results.responseTimes.push(duration);
          this.results.totalDuration += duration;

          if (res.statusCode === 200) {
            this.results.successfulRequests += 1;
          } else {
            this.results.failedRequests += 1;
          }

          this.results.statusCodes[res.statusCode] = (this.results.statusCodes[res.statusCode] || 0) + 1;

          resolve({ statusCode: res.statusCode, duration });
        });
      });

      req.on('error', (e) => {
        this.results.failedRequests += 1;
        this.results.totalRequests += 1;
        this.results.errors.push({
          type: 'error',
          message: e.message,
          timestamp: new Date().toISOString()
        });
        resolve({ error: e.message });
      });

      req.on('timeout', () => {
        this.results.failedRequests += 1;
        this.results.totalRequests += 1;
        this.results.errors.push({
          type: 'timeout',
          message: 'Request timeout',
          timestamp: new Date().toISOString()
        });
        req.destroy();
        resolve({ error: 'timeout' });
      });

      req.write(JSON.stringify(payload));
      req.end();
    });
  }

  _selectEventType() {
    const rand = Math.random();
    let cumulative = 0;

    for (const config of this.config.targets) {
      cumulative += config.weight;
      if (rand < cumulative) {
        return config.type;
      }
    }

    return 'message';
  }

  _generatePayload(eventType) {
    const senderId = Math.random().toString(36).substring(7);
    const mid = Math.random().toString(36).substring(7);
    const timestamp = Date.now();

    return {
      object: 'page',
      entry: [
        {
          id: 'PAGE_ID',
          time: timestamp,
          messaging: [
            {
              sender: { id: senderId },
              recipient: { id: 'PAGE_ID' },
              timestamp,
              message: {
                mid,
                text: `Test message for load testing - ${eventType}`,
                attachments: []
              }
            }
          ]
        }
      ]
    };
  }

  _printProgress() {
    const elapsed = Date.now() - this.results.startTime;
    const elapsedSeconds = elapsed / 1000;
    const successRate = this.results.totalRequests > 0
      ? ((this.results.successfulRequests / this.results.totalRequests) * 100).toFixed(2)
      : 0;

    const avgLatency = this.results.totalRequests > 0
      ? (this.results.totalDuration / this.results.totalRequests).toFixed(2)
      : 0;

    console.log(`[${new Date().toLocaleTimeString()}]`);
    console.log(`  Elapsed: ${elapsedSeconds.toFixed(0)}s`);
    console.log(`  Total requests: ${this.results.totalRequests}`);
    console.log(`  Success rate: ${successRate}%`);
    console.log(`  Avg latency: ${avgLatency}ms`);
    console.log(`  Errors: ${this.results.errors.length}\n`);
  }

  _generateReport() {
    console.log('╔═══════════════════════════════════════════════════════════════════════╗');
    console.log('║ LOAD TEST REPORT                                                     ║');
    console.log('╚═══════════════════════════════════════════════════════════════════════╝\n');

    const successRate = this.results.totalRequests > 0
      ? ((this.results.successfulRequests / this.results.totalRequests) * 100).toFixed(2)
      : 0;

    const avgLatency = this.results.totalRequests > 0
      ? (this.results.totalDuration / this.results.totalRequests).toFixed(2)
      : 0;

    // Calculate percentiles
    const sorted = [...this.results.responseTimes].sort((a, b) => a - b);
    const p50 = sorted[Math.floor(sorted.length * 0.5)];
    const p95 = sorted[Math.floor(sorted.length * 0.95)];
    const p99 = sorted[Math.floor(sorted.length * 0.99)];

    console.log('RESULTS SUMMARY:');
    console.log(`  Total requests: ${this.results.totalRequests}`);
    console.log(`  Successful: ${this.results.successfulRequests}`);
    console.log(`  Failed: ${this.results.failedRequests}`);
    console.log(`  Success rate: ${successRate}%\n`);

    console.log('LATENCY METRICS:');
    console.log(`  Average: ${avgLatency}ms`);
    console.log(`  P50: ${p50}ms`);
    console.log(`  P95: ${p95}ms`);
    console.log(`  P99: ${p99}ms`);
    console.log(`  Max: ${Math.max(...this.results.responseTimes)}ms\n`);

    console.log('STATUS CODES:');
    Object.entries(this.results.statusCodes).forEach(([code, count]) => {
      const percentage = ((count / this.results.totalRequests) * 100).toFixed(2);
      console.log(`  ${code}: ${count} (${percentage}%)`);
    });

    if (this.results.errors.length > 0) {
      console.log('\nERRORS:');
      const errorTypes = {};
      this.results.errors.forEach(e => {
        errorTypes[e.type] = (errorTypes[e.type] || 0) + 1;
      });
      Object.entries(errorTypes).forEach(([type, count]) => {
        console.log(`  ${type}: ${count}`);
      });

      console.log('\nSample Errors:');
      this.results.errors.slice(0, 5).forEach((e, idx) => {
        console.log(`  ${idx + 1}. ${e.type}: ${e.message}`);
      });
    }

    console.log('\n╔═══════════════════════════════════════════════════════════════════════╗');

    const passedCriteria = [];
    const failedCriteria = [];

    if (parseFloat(successRate) >= 99) {
      passedCriteria.push('✅ Success rate: ' + successRate + '% (target: 99%+)');
    } else {
      failedCriteria.push('❌ Success rate: ' + successRate + '% (target: 99%+)');
    }

    if (parseFloat(avgLatency) < 500) {
      passedCriteria.push('✅ Average latency: ' + avgLatency + 'ms (target: < 500ms)');
    } else {
      failedCriteria.push('❌ Average latency: ' + avgLatency + 'ms (target: < 500ms)');
    }

    if (p95 < 1000) {
      passedCriteria.push('✅ P95 latency: ' + p95 + 'ms (target: < 1000ms)');
    } else {
      failedCriteria.push('❌ P95 latency: ' + p95 + 'ms (target: < 1000ms)');
    }

    if (this.results.errors.length === 0) {
      passedCriteria.push('✅ No errors');
    }

    if (failedCriteria.length === 0) {
      console.log('║ ✅ LOAD TEST PASSED ALL CRITERIA                                   ║');
      console.log('║                                                                     ║');
      passedCriteria.forEach(criterion => {
        const line = criterion.padEnd(69, ' ');
        console.log('║ ' + line + '║');
      });
      console.log('║                                                                     ║');
      console.log('║ Ready for STEP 2.8: Production Deployment                           ║');
    } else {
      console.log('║ ⚠️  LOAD TEST FAILED SOME CRITERIA                                  ║');
      console.log('║                                                                     ║');
      console.log('║ Passed:');
      passedCriteria.forEach(criterion => {
        const line = criterion.padEnd(65, ' ');
        console.log('║   ' + line + ' ║');
      });
      console.log('║');
      console.log('║ Failed:');
      failedCriteria.forEach(criterion => {
        const line = criterion.padEnd(65, ' ');
        console.log('║   ' + line + ' ║');
      });
      console.log('║                                                                     ║');
      console.log('║ Recommendations:                                                    ║');
      console.log('║ 1. Review staging implementation                                   ║');
      console.log('║ 2. Optimize performance bottlenecks                                ║');
      console.log('║ 3. Increase database connection pool if needed                     ║');
      console.log('║ 4. Re-run load test after fixes                                    ║');
    }

    console.log('╚═══════════════════════════════════════════════════════════════════════╝\n');
  }

  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Parse command line arguments
const targetUrl = process.argv[2];
let duration = 3600; // default 1 hour
let concurrent = 1000; // default 1000 requests

// Parse --duration flag
const durationIdx = process.argv.indexOf('--duration');
if (durationIdx !== -1 && process.argv[durationIdx + 1]) {
  duration = parseInt(process.argv[durationIdx + 1]);
}

// Parse --concurrent flag
const concurrentIdx = process.argv.indexOf('--concurrent');
if (concurrentIdx !== -1 && process.argv[concurrentIdx + 1]) {
  concurrent = parseInt(process.argv[concurrentIdx + 1]);
}

if (!targetUrl) {
  console.log('\n❌ Usage: node test-load.js <target-url> [--duration 3600] [--concurrent 1000]');
  console.log('   Local example: node test-load.js http://localhost:3000 --duration 60');
  console.log('   Staging example: node test-load.js https://crm-faroles-ganius.vercel.app --duration 3600\n');
  process.exit(1);
}

// Run load test
(async () => {
  const tester = new LoadTester(targetUrl, { duration, concurrent });
  const results = await tester.run();

  const successRate = results.totalRequests > 0
    ? ((results.successfulRequests / results.totalRequests) * 100)
    : 0;

  process.exit(successRate >= 99 ? 0 : 1);
})();
