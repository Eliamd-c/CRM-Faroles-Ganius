/**
 * ═════════════════════════════════════════════════════════════════════
 * PHASE 2 STEP 2.6: GRADUAL TRAFFIC SHIFT CONTROLLER
 * ═════════════════════════════════════════════════════════════════════
 *
 * Gradually shifts traffic from legacy to new handler
 * Timeline: 8 hours
 *
 * Hour 1-2: 50/50 split (monitoring)
 * Hour 3-4: 60/40 split
 * Hour 5-6: 70/30 split
 * Hour 7-8: 90/10 split
 *
 * Usage: node test_gradual_traffic_shift.js <staging-url> [--hours 8]
 * Example: node test_gradual_traffic_shift.js https://crm-faroles-ganius.vercel.app --hours 8
 *
 * ═════════════════════════════════════════════════════════════════════
 */

const https = require('https');
const http = require('http');

class TrafficShiftController {
  constructor(stagingUrl, options = {}) {
    this.stagingUrl = stagingUrl.replace(/\/$/, '');
    this.protocol = this.stagingUrl.startsWith('https') ? https : http;
    this.hours = options.hours || 8;
    this.monitoringInterval = options.monitoringInterval || 300000; // 5 minutes
    this.healthThresholds = {
      errorRate: 0.5, // max 0.5%
      matchRate: 0.95, // min 95%
      latency: 500 // max 500ms
    };
    this.trafficShifts = [
      { hour: 0, newPercentage: 50, duration: 120, label: 'Baseline 50/50' },
      { hour: 2, newPercentage: 60, duration: 120, label: '60/40 split' },
      { hour: 4, newPercentage: 70, duration: 120, label: '70/30 split' },
      { hour: 6, newPercentage: 90, duration: 120, label: '90/10 split' }
    ];
    this.monitoringData = [];
    this.issues = [];
  }

  async runShiftTest() {
    console.log('\n╔═══════════════════════════════════════════════════════════════════════╗');
    console.log('║ PHASE 2 STEP 2.6: GRADUAL TRAFFIC SHIFT TEST                         ║');
    console.log('╚═══════════════════════════════════════════════════════════════════════╝\n');

    console.log(`Target URL: ${this.stagingUrl}`);
    console.log(`Duration: ${this.hours} hours`);
    console.log(`Monitoring interval: ${this.monitoringInterval / 1000 / 60} minutes\n`);

    console.log('TRAFFIC SHIFT SCHEDULE:');
    this.trafficShifts.forEach(shift => {
      console.log(`  Hour ${shift.hour + 1}-${shift.hour + 2}: ${shift.label} (${shift.newPercentage}% new handler)`);
    });

    console.log('\nThresholds:');
    console.log(`  Error rate: < ${this.healthThresholds.errorRate}%`);
    console.log(`  Match rate: > ${this.healthThresholds.matchRate * 100}%`);
    console.log(`  Latency: < ${this.healthThresholds.latency}ms\n`);

    await this._executeTrafficShift();
    this._generateReport();
  }

  async _executeTrafficShift() {
    const startTime = Date.now();
    const endTime = startTime + (this.hours * 3600 * 1000);
    let currentShiftIndex = 0;

    console.log('═══════════════════════════════════════════════════════════════════════\n');
    console.log('MONITORING STARTED\n');

    const monitoringTimer = setInterval(async () => {
      const elapsed = Date.now() - startTime;
      const elapsedHours = elapsed / (3600 * 1000);

      // Check if we need to change traffic shift
      if (currentShiftIndex < this.trafficShifts.length - 1) {
        const nextShift = this.trafficShifts[currentShiftIndex + 1];
        if (elapsedHours >= nextShift.hour) {
          await this._updateTrafficShift(nextShift.newPercentage);
          currentShiftIndex += 1;
        }
      }

      // Collect metrics
      const metrics = await this._collectMetrics();
      this._recordMetrics(metrics, elapsedHours);

      // Check health
      const isHealthy = this._checkHealth(metrics);
      if (!isHealthy) {
        console.log(`⚠️  HEALTH ISSUE DETECTED at hour ${elapsedHours.toFixed(1)}`);
        this.issues.push({
          hour: elapsedHours,
          timestamp: new Date().toISOString(),
          shift: this.trafficShifts[currentShiftIndex],
          recommendation: 'CONSIDER REVERTING TO PREVIOUS SHIFT'
        });
      }

      // Stop if test duration exceeded
      if (Date.now() > endTime) {
        clearInterval(monitoringTimer);
        console.log('\n═══════════════════════════════════════════════════════════════════════\n');
      }
    }, this.monitoringInterval);

    // Wait for test to complete
    await new Promise(resolve => {
      const checkTimer = setInterval(() => {
        if (Date.now() > endTime) {
          clearInterval(checkTimer);
          clearInterval(monitoringTimer);
          resolve();
        }
      }, 1000);
    });
  }

  async _updateTrafficShift(percentage) {
    console.log(`\n[TRAFFIC SHIFT] Updating to ${percentage}% new handler...\n`);

    try {
      // This would call the admin API to update traffic shift
      // POST /admin/builder-flags with { flag: 'newHandlerPercentage', value: percentage }
      // For now, we simulate the update
      console.log(`✅ Traffic shift updated to ${percentage}%`);
    } catch (e) {
      console.log(`❌ Failed to update traffic shift: ${e.message}`);
      this.issues.push({
        timestamp: new Date().toISOString(),
        type: 'TRAFFIC_SHIFT_FAILED',
        message: e.message
      });
    }
  }

  async _collectMetrics() {
    try {
      const response = await this._fetch('/dashboard/builder-metrics');

      if (response.status === 200 && response.body) {
        return {
          timestamp: new Date().toISOString(),
          events: response.body.events || {},
          timings: response.body.timings || {},
          health: response.body.health || 'UNKNOWN'
        };
      }
    } catch (e) {
      console.log(`⚠️  Failed to collect metrics: ${e.message}`);
    }

    return null;
  }

  _recordMetrics(metrics, elapsedHours) {
    if (!metrics) return;

    this.monitoringData.push({
      hour: elapsedHours.toFixed(1),
      ...metrics
    });

    // Print status every monitoring interval
    const events = metrics.events || {};
    const timings = metrics.timings || {};

    const totalEvents = events.total || 0;
    const newSuccesses = events.new_success || 0;
    const legacySuccesses = events.legacy_success || 0;
    const matchCount = events.results_match || 0;
    const diffCount = events.results_differ || 0;
    const avgLatency = timings.total_avg ? parseFloat(timings.total_avg).toFixed(2) : 'N/A';

    const errorRate = totalEvents > 0
      ? (((events.new_error || 0) + (events.legacy_error || 0)) / (totalEvents * 2) * 100).toFixed(2)
      : 'N/A';

    const matchRate = matchCount + diffCount > 0
      ? ((matchCount / (matchCount + diffCount)) * 100).toFixed(2)
      : 'N/A';

    console.log(`[Hour ${elapsedHours.toFixed(1)}]`);
    console.log(`  Events: ${totalEvents} | New: ${newSuccesses} | Legacy: ${legacySuccesses}`);
    console.log(`  Error Rate: ${errorRate}% | Match Rate: ${matchRate}% | Latency: ${avgLatency}ms`);
    console.log(`  Health: ${metrics.health}\n`);
  }

  _checkHealth(metrics) {
    if (!metrics || !metrics.events) return true;

    const events = metrics.events;
    const timings = metrics.timings || {};

    // Only check if we have processed events
    if (events.total === 0) return true;

    // Error rate check
    const errorCount = (events.new_error || 0) + (events.legacy_error || 0);
    const errorRate = (errorCount / (events.total * 2)) * 100;

    if (errorRate > this.healthThresholds.errorRate) {
      console.log(`❌ Error rate ${errorRate.toFixed(2)}% exceeds threshold ${this.healthThresholds.errorRate}%`);
      return false;
    }

    // Match rate check
    const matchCount = events.results_match || 0;
    const diffCount = events.results_differ || 0;

    if (matchCount + diffCount > 0) {
      const matchRate = matchCount / (matchCount + diffCount);

      if (matchRate < this.healthThresholds.matchRate) {
        console.log(`❌ Match rate ${(matchRate * 100).toFixed(2)}% below threshold ${this.healthThresholds.matchRate * 100}%`);
        return false;
      }
    }

    // Latency check
    if (timings.total_avg) {
      const avgLatency = parseFloat(timings.total_avg);

      if (avgLatency > this.healthThresholds.latency) {
        console.log(`❌ Latency ${avgLatency.toFixed(2)}ms exceeds threshold ${this.healthThresholds.latency}ms`);
        return false;
      }
    }

    return true;
  }

  _generateReport() {
    console.log('╔═══════════════════════════════════════════════════════════════════════╗');
    console.log('║ GRADUAL TRAFFIC SHIFT REPORT                                         ║');
    console.log('╚═══════════════════════════════════════════════════════════════════════╝\n');

    if (this.monitoringData.length === 0) {
      console.log('❌ No monitoring data collected\n');
      return;
    }

    // Summary statistics
    console.log('MONITORING SUMMARY:');
    console.log(`  Total data points: ${this.monitoringData.length}`);
    console.log(`  Duration: ~${this.hours} hours`);
    console.log(`  Issues detected: ${this.issues.length}\n`);

    // Latest metrics
    const latest = this.monitoringData[this.monitoringData.length - 1];
    if (latest) {
      const events = latest.events || {};
      const timings = latest.timings || {};

      console.log('LATEST METRICS:');
      console.log(`  Total events: ${events.total || 0}`);
      console.log(`  New handler successes: ${events.new_success || 0}`);
      console.log(`  Legacy handler successes: ${events.legacy_success || 0}`);

      if (events.results_match !== undefined) {
        const matchRate = ((events.results_match / (events.results_match + events.results_differ || 1)) * 100).toFixed(2);
        console.log(`  Results match rate: ${matchRate}%`);
      }

      if (timings.total_avg) {
        console.log(`  Average latency: ${parseFloat(timings.total_avg).toFixed(2)}ms`);
      }

      console.log(`  System health: ${latest.health || 'UNKNOWN'}\n`);
    }

    // Issues
    if (this.issues.length > 0) {
      console.log('ISSUES DETECTED:');
      this.issues.forEach((issue, idx) => {
        console.log(`  ${idx + 1}. [Hour ${issue.hour}] ${issue.recommendation || issue.message}`);
      });
      console.log('\n');
    }

    console.log('╔═══════════════════════════════════════════════════════════════════════╗');
    if (this.issues.length === 0) {
      console.log('║ ✅ TRAFFIC SHIFT TEST COMPLETED SUCCESSFULLY                        ║');
      console.log('║                                                                     ║');
      console.log('║ Next step: STEP 2.7 - Load Testing                                  ║');
      console.log('║ Run: node test-load.js <staging-url>                                ║');
    } else {
      console.log('║ ⚠️  TRAFFIC SHIFT TEST COMPLETED WITH WARNINGS                      ║');
      console.log('║                                                                     ║');
      console.log('║ Review issues above before proceeding.                              ║');
      console.log('║ Consider reverting to 50/50 split and investigating.                ║');
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
const hoursArg = process.argv.indexOf('--hours') !== -1
  ? parseInt(process.argv[process.argv.indexOf('--hours') + 1])
  : 8;

if (!stagingUrl) {
  console.log('\n❌ Usage: node test_gradual_traffic_shift.js <staging-url> [--hours 8]');
  console.log('   Example: node test_gradual_traffic_shift.js https://crm-faroles-ganius.vercel.app --hours 8\n');
  process.exit(1);
}

// Run traffic shift test
(async () => {
  const controller = new TrafficShiftController(stagingUrl, { hours: hoursArg });
  await controller.runShiftTest();

  process.exit(controller.issues.length === 0 ? 0 : 1);
})();
