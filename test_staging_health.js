/**
 * ═════════════════════════════════════════════════════════════════════
 * PHASE 2 STEP 2.5: STAGING HEALTH CHECKER
 * ═════════════════════════════════════════════════════════════════════
 *
 * Validates staging deployment health
 * Tests:
 * 1. Health endpoint responds (200 OK)
 * 2. Metrics dashboard operational
 * 3. Dual execution active
 * 4. Both handlers executing
 * 5. Results matching above 80%
 *
 * Usage: node test_staging_health.js <staging-url>
 * Example: node test_staging_health.js https://crm-faroles-ganius.vercel.app
 *
 * ═════════════════════════════════════════════════════════════════════
 */

const https = require('https');
const http = require('http');

class StagingHealthChecker {
  constructor(stagingUrl) {
    this.stagingUrl = stagingUrl.replace(/\/$/, ''); // Remove trailing slash
    this.protocol = this.stagingUrl.startsWith('https') ? https : http;
    this.results = {
      timestamp: new Date().toISOString(),
      stagingUrl: this.stagingUrl,
      checks: {},
      allHealthy: true,
      metrics: null,
      issues: []
    };
  }

  async runChecks() {
    console.log('\n╔═══════════════════════════════════════════════════════════════════════╗');
    console.log('║ PHASE 2 STEP 2.5: STAGING HEALTH CHECKS                             ║');
    console.log('╚═══════════════════════════════════════════════════════════════════════╝\n');

    console.log(`Target URL: ${this.stagingUrl}\n`);

    await this._checkHealthEndpoint();
    await this._checkMetricsEndpoint();
    await this._checkBuilderMetrics();
    await this._checkDualExecution();

    this._generateReport();

    return this.results;
  }

  async _checkHealthEndpoint() {
    console.log('CHECK 1: Health endpoint (/health/builder)');

    try {
      const response = await this._fetch('/health/builder');

      if (response.status === 200) {
        console.log('✅ Health endpoint responds with 200 OK');
        console.log(`   Status: ${response.body.status || 'unknown'}`);

        this.results.checks.healthEndpoint = 'PASS';

        if (response.body.metrics) {
          const metrics = response.body.metrics;
          console.log(`   Events processed: ${metrics.total_events || 0}`);
          console.log(`   Success rate: ${metrics.success_rate || 'N/A'}`);
          console.log(`   Match rate: ${metrics.match_rate || 'N/A'}`);
          console.log(`   Avg latency: ${metrics.avg_latency_ms || 'N/A'}ms`);
        }
      } else {
        console.log(`❌ Health endpoint returned ${response.status}`);
        this.results.checks.healthEndpoint = 'FAIL';
        this.results.allHealthy = false;
        this.results.issues.push('Health endpoint not responding correctly');
      }
    } catch (e) {
      console.log(`❌ Failed to reach health endpoint: ${e.message}`);
      this.results.checks.healthEndpoint = 'ERROR';
      this.results.allHealthy = false;
      this.results.issues.push(`Health endpoint error: ${e.message}`);
    }

    console.log('\n');
  }

  async _checkMetricsEndpoint() {
    console.log('CHECK 2: Metrics dashboard (/dashboard/builder-metrics)');

    try {
      const response = await this._fetch('/dashboard/builder-metrics');

      if (response.status === 200 && response.body) {
        console.log('✅ Metrics dashboard operational');
        this.results.checks.metricsEndpoint = 'PASS';
        this.results.metrics = response.body;

        if (response.body.events) {
          console.log(`   Total events: ${response.body.events.total || 0}`);
          console.log(`   New handler successes: ${response.body.events.new_success || 0}`);
          console.log(`   Legacy handler successes: ${response.body.events.legacy_success || 0}`);
          console.log(`   Results matching: ${response.body.events.results_match || 0}`);
        }
      } else {
        console.log(`❌ Metrics endpoint returned ${response.status}`);
        this.results.checks.metricsEndpoint = 'FAIL';
        this.results.allHealthy = false;
        this.results.issues.push('Metrics endpoint not responding');
      }
    } catch (e) {
      console.log(`❌ Failed to reach metrics endpoint: ${e.message}`);
      this.results.checks.metricsEndpoint = 'ERROR';
      this.results.allHealthy = false;
      this.results.issues.push(`Metrics endpoint error: ${e.message}`);
    }

    console.log('\n');
  }

  async _checkBuilderMetrics() {
    console.log('CHECK 3: Builder metrics validation');

    if (!this.results.metrics || !this.results.metrics.events) {
      console.log('⚠️  Metrics not available for validation');
      this.results.checks.metricsValidation = 'SKIP';
      return;
    }

    const metrics = this.results.metrics;
    const checks = [];

    // Check 1: Error rate
    const totalEvents = metrics.events.total || 0;
    if (totalEvents > 0) {
      const errorCount = (metrics.events.new_error || 0) + (metrics.events.legacy_error || 0);
      const errorRate = (errorCount / (totalEvents * 2)) * 100;

      if (errorRate < 0.5) {
        console.log(`✅ Error rate: ${errorRate.toFixed(2)}% (target: < 0.5%)`);
        checks.push(true);
      } else {
        console.log(`⚠️  Error rate: ${errorRate.toFixed(2)}% (target: < 0.5%)`);
        checks.push(false);
      }
    } else {
      console.log('ℹ️  No events processed yet (cold start)');
    }

    // Check 2: Match rate
    const matchCount = metrics.events.results_match || 0;
    const diffCount = metrics.events.results_differ || 0;
    if (matchCount + diffCount > 0) {
      const matchRate = (matchCount / (matchCount + diffCount)) * 100;

      if (matchRate >= 80) {
        console.log(`✅ Results match rate: ${matchRate.toFixed(2)}% (target: > 80%)`);
        checks.push(true);
      } else if (matchRate >= 50) {
        console.log(`⚠️  Results match rate: ${matchRate.toFixed(2)}% (target: > 80%)`);
        checks.push(false);
      } else {
        console.log(`❌ Results match rate: ${matchRate.toFixed(2)}% (target: > 80%)`);
        checks.push(false);
        this.results.allHealthy = false;
      }
    } else {
      console.log('ℹ️  No result comparisons available yet');
    }

    // Check 3: Latency
    if (metrics.timings && metrics.timings.total_avg) {
      const avgLatency = parseFloat(metrics.timings.total_avg);
      if (avgLatency < 500) {
        console.log(`✅ Average latency: ${avgLatency.toFixed(2)}ms (target: < 500ms)`);
        checks.push(true);
      } else {
        console.log(`⚠️  Average latency: ${avgLatency.toFixed(2)}ms (target: < 500ms)`);
        checks.push(false);
      }
    }

    if (checks.every(c => c)) {
      this.results.checks.metricsValidation = 'PASS';
    } else if (checks.some(c => c)) {
      this.results.checks.metricsValidation = 'WARN';
    } else {
      this.results.checks.metricsValidation = 'FAIL';
      this.results.allHealthy = false;
    }

    console.log('\n');
  }

  async _checkDualExecution() {
    console.log('CHECK 4: Dual execution status');

    if (!this.results.metrics || !this.results.metrics.events) {
      console.log('⚠️  Metrics not available for dual execution check');
      this.results.checks.dualExecution = 'SKIP';
      return;
    }

    const metrics = this.results.metrics.events;

    const newSuccesses = metrics.new_success || 0;
    const legacySuccesses = metrics.legacy_success || 0;

    if (newSuccesses > 0 && legacySuccesses > 0) {
      console.log('✅ Both handlers executing successfully');
      console.log(`   New handler successes: ${newSuccesses}`);
      console.log(`   Legacy handler successes: ${legacySuccesses}`);
      this.results.checks.dualExecution = 'PASS';
    } else if (newSuccesses > 0 || legacySuccesses > 0) {
      console.log('⚠️  Only one handler executing');
      console.log(`   New handler successes: ${newSuccesses}`);
      console.log(`   Legacy handler successes: ${legacySuccesses}`);
      this.results.checks.dualExecution = 'WARN';
    } else {
      console.log('ℹ️  No events processed yet (cold start)');
      this.results.checks.dualExecution = 'UNKNOWN';
    }

    console.log('\n');
  }

  _generateReport() {
    console.log('╔═══════════════════════════════════════════════════════════════════════╗');
    console.log('║ STAGING HEALTH CHECK REPORT                                          ║');
    console.log('╚═══════════════════════════════════════════════════════════════════════╝\n');

    console.log(`Timestamp: ${this.results.timestamp}`);
    console.log(`Target: ${this.stagingUrl}\n`);

    console.log('CHECK RESULTS:');
    Object.entries(this.results.checks).forEach(([check, status]) => {
      const icon = status === 'PASS' ? '✅' :
                   status === 'WARN' ? '⚠️' :
                   status === 'FAIL' ? '❌' : 'ℹ️';
      console.log(`  ${icon} ${check}: ${status}`);
    });

    if (this.results.issues.length > 0) {
      console.log('\nISSUES DETECTED:');
      this.results.issues.forEach(issue => {
        console.log(`  ⚠️  ${issue}`);
      });
    }

    console.log('\n╔═══════════════════════════════════════════════════════════════════════╗');
    if (this.results.allHealthy) {
      console.log('║ ✅ STAGING DEPLOYMENT HEALTHY                                       ║');
      console.log('║                                                                     ║');
      console.log('║ Next step: STEP 2.6 - Gradual Traffic Shift                         ║');
      console.log('║ Run: node test_gradual_traffic_shift.js <staging-url>               ║');
    } else {
      console.log('║ ⚠️  STAGING DEPLOYMENT ISSUES DETECTED                              ║');
      console.log('║                                                                     ║');
      console.log('║ Review issues above before proceeding to traffic shift.              ║');
      console.log('║                                                                     ║');
      console.log('║ Check logs: https://vercel.com/Eliamd-c/CRM-Faroles-Ganius          ║');
    }
    console.log('╚═══════════════════════════════════════════════════════════════════════╝\n');
  }

  _fetch(endpoint) {
    return new Promise((resolve, reject) => {
      const url = new URL(this.stagingUrl + endpoint);
      const options = {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname + url.search,
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        }
      };

      const req = this.protocol.request(options, (res) => {
        let data = '';

        res.on('data', chunk => {
          data += chunk;
        });

        res.on('end', () => {
          try {
            const body = data ? JSON.parse(data) : {};
            resolve({ status: res.statusCode, body });
          } catch (e) {
            resolve({ status: res.statusCode, body: {} });
          }
        });
      });

      req.on('error', reject);
      req.end();
    });
  }
}

// Parse command line arguments
const stagingUrl = process.argv[2];

if (!stagingUrl) {
  console.log('\n❌ Usage: node test_staging_health.js <staging-url>');
  console.log('   Example: node test_staging_health.js https://crm-faroles-ganius.vercel.app\n');
  process.exit(1);
}

// Run checks
(async () => {
  const checker = new StagingHealthChecker(stagingUrl);
  const results = await checker.runChecks();

  process.exit(results.allHealthy ? 0 : 1);
})();
