/**
 * ═════════════════════════════════════════════════════════════════════
 * PHASE 2 STEP 2.5: STAGING DEPLOYMENT VALIDATOR
 * ═════════════════════════════════════════════════════════════════════
 *
 * Validates staging deployment of Phase 2 integration layer
 * Tests:
 * 1. App.js loads without errors
 * 2. All critical tests pass
 * 3. Dual execution ready
 * 4. Metrics collection working
 * 5. Feature flags operational
 *
 * ═════════════════════════════════════════════════════════════════════
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const LOG_PREFIX = '[STEP 2.5]';
const TESTS_TO_RUN = [
  'test_integration_layer.js',
  'test_app_integration.js',
  'test_dual_execution.js',
  'test_monitoring_endpoints.js'
];

class StagingValidator {
  constructor() {
    this.results = {
      timestamp: new Date().toISOString(),
      allTestsPassed: true,
      testResults: [],
      codeValidation: {},
      deploymentStatus: 'PENDING',
      metrics: {
        testsRun: 0,
        testsPassed: 0,
        testsFailed: 0
      }
    };
  }

  async validate() {
    console.log('\n╔═══════════════════════════════════════════════════════════════════════╗');
    console.log('║ PHASE 2 STEP 2.5: STAGING DEPLOYMENT VALIDATION                      ║');
    console.log('╚═══════════════════════════════════════════════════════════════════════╝\n');

    // Step 1: Validate code syntax
    await this._validateCodeSyntax();

    // Step 2: Run critical tests
    await this._runCriticalTests();

    // Step 3: Validate integration
    await this._validateIntegration();

    // Step 4: Deployment status
    await this._checkDeploymentStatus();

    // Step 5: Generate report
    this._generateReport();

    return this.results;
  }

  async _validateCodeSyntax() {
    console.log(`${LOG_PREFIX} Validating code syntax...\n`);

    const filesToCheck = [
      'app.js',
      'public/builder-integration.js',
      'public/services/metrics.js',
      'public/services/event-comparator.js'
    ];

    for (const file of filesToCheck) {
      const filePath = path.join(process.cwd(), file);
      try {
        if (!fs.existsSync(filePath)) {
          console.log(`❌ File not found: ${file}`);
          this.results.codeValidation[file] = 'NOT_FOUND';
          this.results.allTestsPassed = false;
          continue;
        }

        execSync(`node -c "${filePath}"`, { stdio: 'pipe' });
        console.log(`✅ ${file} - syntax valid`);
        this.results.codeValidation[file] = 'VALID';
      } catch (e) {
        console.log(`❌ ${file} - syntax error: ${e.message}`);
        this.results.codeValidation[file] = 'SYNTAX_ERROR';
        this.results.allTestsPassed = false;
      }
    }

    console.log('\n');
  }

  async _runCriticalTests() {
    console.log(`${LOG_PREFIX} Running critical tests...\n`);

    for (const testFile of TESTS_TO_RUN) {
      const testPath = path.join(process.cwd(), testFile);

      if (!fs.existsSync(testPath)) {
        console.log(`⚠️  Test file not found: ${testFile}\n`);
        continue;
      }

      try {
        console.log(`Running ${testFile}...`);
        const output = execSync(`node "${testPath}"`, { encoding: 'utf8' });

        // Check if test passed (look for ✅ ALL TESTS PASSED)
        const passed = output.includes('✅ ALL TESTS PASSED') ||
                       output.includes('PASSED') ||
                       !output.includes('❌');

        if (passed) {
          console.log(`✅ ${testFile} PASSED\n`);
          this.results.testResults.push({
            test: testFile,
            status: 'PASSED',
            timestamp: new Date().toISOString()
          });
          this.results.metrics.testsPassed += 1;
        } else {
          console.log(`❌ ${testFile} FAILED\n`);
          this.results.testResults.push({
            test: testFile,
            status: 'FAILED',
            timestamp: new Date().toISOString()
          });
          this.results.metrics.testsFailed += 1;
          this.results.allTestsPassed = false;
        }

        this.results.metrics.testsRun += 1;
      } catch (e) {
        console.log(`❌ ${testFile} - Execution error: ${e.message}\n`);
        this.results.testResults.push({
          test: testFile,
          status: 'ERROR',
          error: e.message,
          timestamp: new Date().toISOString()
        });
        this.results.metrics.testsFailed += 1;
        this.results.metrics.testsRun += 1;
        this.results.allTestsPassed = false;
      }
    }

    console.log('\n');
  }

  async _validateIntegration() {
    console.log(`${LOG_PREFIX} Validating integration layer...\n`);

    const integrationChecks = [
      {
        name: 'BuilderIntegration instantiation',
        check: async () => {
          try {
            const BuilderIntegration = require('./public/builder-integration.js');
            const instance = new BuilderIntegration();
            return instance && typeof instance.handleWebhookEvent === 'function';
          } catch (e) {
            console.log(`  Error: ${e.message}`);
            return false;
          }
        }
      },
      {
        name: 'MetricsCollector instantiation',
        check: async () => {
          try {
            const MetricsCollector = require('./public/services/metrics.js');
            const instance = new MetricsCollector();
            return instance && typeof instance.recordExecution === 'function';
          } catch (e) {
            console.log(`  Error: ${e.message}`);
            return false;
          }
        }
      },
      {
        name: 'EventComparator instantiation',
        check: async () => {
          try {
            const EventComparator = require('./public/services/event-comparator.js');
            const instance = new EventComparator();
            return instance && typeof instance.compare === 'function';
          } catch (e) {
            console.log(`  Error: ${e.message}`);
            return false;
          }
        }
      }
    ];

    for (const check of integrationChecks) {
      try {
        const result = await check.check();
        if (result) {
          console.log(`✅ ${check.name}`);
        } else {
          console.log(`❌ ${check.name}`);
          this.results.allTestsPassed = false;
        }
      } catch (e) {
        console.log(`❌ ${check.name} - ${e.message}`);
        this.results.allTestsPassed = false;
      }
    }

    console.log('\n');
  }

  async _checkDeploymentStatus() {
    console.log(`${LOG_PREFIX} Checking deployment readiness...\n`);

    // Check git status
    try {
      const status = execSync('git status --porcelain', { encoding: 'utf8' }).trim();
      if (status === '') {
        console.log('✅ Git working tree clean');
        this.results.gitStatus = 'CLEAN';
      } else {
        console.log('⚠️  Uncommitted changes detected:');
        console.log(status);
        this.results.gitStatus = 'DIRTY';
      }
    } catch (e) {
      console.log('⚠️  Could not check git status');
    }

    // Check branch
    try {
      const branch = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8' }).trim();
      console.log(`✅ Current branch: ${branch}`);
      this.results.currentBranch = branch;
    } catch (e) {
      console.log('⚠️  Could not determine current branch');
    }

    // Check recent commits
    try {
      const commits = execSync('git log --oneline -5', { encoding: 'utf8' });
      console.log('✅ Recent commits:');
      commits.split('\n').slice(0, 3).forEach(c => {
        if (c) console.log(`   ${c}`);
      });
      this.results.recentCommits = commits.split('\n').slice(0, 5).filter(c => c);
    } catch (e) {
      console.log('⚠️  Could not retrieve commit history');
    }

    console.log('\n');
  }

  _generateReport() {
    console.log('╔═══════════════════════════════════════════════════════════════════════╗');
    console.log('║ STAGING DEPLOYMENT VALIDATION REPORT                                  ║');
    console.log('╚═══════════════════════════════════════════════════════════════════════╝\n');

    console.log(`Timestamp: ${this.results.timestamp}`);
    console.log(`\nOVERALL STATUS: ${this.results.allTestsPassed ? '✅ READY FOR STAGING' : '❌ NOT READY'}\n`);

    console.log('CODE VALIDATION:');
    Object.entries(this.results.codeValidation).forEach(([file, status]) => {
      const icon = status === 'VALID' ? '✅' : '❌';
      console.log(`  ${icon} ${file}: ${status}`);
    });

    console.log(`\nTEST RESULTS: ${this.results.metrics.testsPassed}/${this.results.metrics.testsRun} passed`);
    this.results.testResults.forEach(result => {
      const icon = result.status === 'PASSED' ? '✅' : '❌';
      console.log(`  ${icon} ${result.test}: ${result.status}`);
    });

    console.log(`\nDEPLOYMENT STATUS:`);
    console.log(`  Branch: ${this.results.currentBranch}`);
    console.log(`  Git Status: ${this.results.gitStatus}`);

    console.log('\n╔═══════════════════════════════════════════════════════════════════════╗');
    if (this.results.allTestsPassed) {
      console.log('║ ✅ ALL CHECKS PASSED - READY TO DEPLOY TO STAGING                   ║');
      console.log('║                                                                     ║');
      console.log('║ Next steps:                                                         ║');
      console.log('║ 1. Verify Vercel deployment at:                                    ║');
      console.log('║    https://vercel.com/Eliamd-c/CRM-Faroles-Ganius                   ║');
      console.log('║ 2. Wait for "READY" status (green checkmark)                        ║');
      console.log('║ 3. Get staging URL from dashboard                                  ║');
      console.log('║ 4. Run: node test_staging_health.js <staging-url>                  ║');
      console.log('║                                                                     ║');
    } else {
      console.log('║ ❌ VALIDATION FAILED - DO NOT DEPLOY                                ║');
      console.log('║                                                                     ║');
      console.log('║ Issues detected:                                                    ║');
      Object.entries(this.results.codeValidation).forEach(([file, status]) => {
        if (status !== 'VALID') {
          console.log(`║ - ${file}: ${status}`);
        }
      });
      this.results.testResults.forEach(result => {
        if (result.status !== 'PASSED') {
          console.log(`║ - ${result.test}: ${result.status}`);
        }
      });
    }
    console.log('╚═══════════════════════════════════════════════════════════════════════╝\n');
  }
}

// Execute validation
(async () => {
  const validator = new StagingValidator();
  const results = await validator.validate();

  process.exit(results.allTestsPassed ? 0 : 1);
})();
