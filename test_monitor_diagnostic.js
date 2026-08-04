#!/usr/bin/env node

/**
 * Monitor Diagnostic Tool
 * Checks webhook, SSE, and message flow
 * Based on Node.js Design Patterns
 */

const http = require('http');
const https = require('https');

const BASE_URL = 'http://localhost:3000';
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(type, message) {
  const icons = {
    success: `${colors.green}✓${colors.reset}`,
    error: `${colors.red}✗${colors.reset}`,
    warning: `${colors.yellow}⚠${colors.reset}`,
    info: `${colors.blue}ℹ${colors.reset}`,
    debug: `${colors.cyan}→${colors.reset}`
  };
  console.log(`${icons[type]} ${message}`);
}

async function testWebhookVerification() {
  log('info', '\n═══ TEST 1: Webhook Verification ═══');

  return new Promise((resolve) => {
    const verifyToken = process.env.VERIFY_TOKEN || 'test_token';
    const url = `${BASE_URL}/webhook?hub.mode=subscribe&hub.verify_token=${verifyToken}&hub.challenge=test_challenge_123`;

    http.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 200 && data === 'test_challenge_123') {
          log('success', `Webhook verification OK (Status: ${res.statusCode})`);
          log('debug', `Response: ${data}`);
          resolve(true);
        } else {
          log('error', `Webhook verification FAILED (Status: ${res.statusCode})`);
          if (res.statusCode === 403) {
            log('warning', 'VERIFY_TOKEN mismatch - Check .env vs Meta settings');
          }
          resolve(false);
        }
      });
    }).on('error', (err) => {
      log('error', `Connection error: ${err.message}`);
      resolve(false);
    });
  });
}

async function testSSEConnection() {
  log('info', '\n═══ TEST 2: SSE Connection ═══');

  return new Promise((resolve) => {
    const apiSecret = process.env.API_SECRET || 'test_secret';
    const url = `${BASE_URL}/stream?token=${encodeURIComponent(apiSecret)}`;

    const req = http.get(url, (res) => {
      if (res.statusCode === 200 && res.headers['content-type'] === 'text/event-stream') {
        log('success', `SSE connection OK (Status: ${res.statusCode})`);
        log('debug', `Content-Type: ${res.headers['content-type']}`);

        let eventCount = 0;
        res.on('data', (chunk) => {
          const str = chunk.toString();
          if (str.includes('data: {')) {
            eventCount++;
            try {
              const dataMatch = str.match(/data: ({.*?})/);
              if (dataMatch) {
                const event = JSON.parse(dataMatch[1]);
                log('debug', `Received event: ${event.type} - ${event.message.substring(0, 40)}...`);
              }
            } catch (e) {
              log('warning', `Could not parse event: ${str.substring(0, 30)}`);
            }
          }
        });

        setTimeout(() => {
          log('success', `SSE received ${eventCount} events during test`);
          req.destroy();
          resolve(true);
        }, 2000);
      } else {
        log('error', `SSE connection FAILED (Status: ${res.statusCode})`);
        if (res.statusCode === 403) {
          log('warning', 'API_SECRET mismatch - Check localStorage vs .env');
        }
        req.destroy();
        resolve(false);
      }
    }).on('error', (err) => {
      log('error', `Connection error: ${err.message}`);
      resolve(false);
    });
  });
}

async function testWebhookPOST() {
  log('info', '\n═══ TEST 3: Webhook POST (Simulated Message) ═══');

  return new Promise((resolve) => {
    const payload = JSON.stringify({
      object: 'instagram',
      entry: [{
        messaging: [{
          sender: { id: '123456789', name: 'Test User' },
          message: { text: '🧪 Diagnostic test message', mid: 'test_mid_123' },
          timestamp: Date.now()
        }]
      }]
    });

    const options = {
      hostname: 'localhost',
      port: 3000,
      path: '/webhook',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
        'x-hub-signature-256': 'sha256=test_signature'
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          log('success', `Webhook POST accepted (Status: 200)`);
          log('debug', `Test message simulated - check console for broadcast`);
          resolve(true);
        } else {
          log('error', `Webhook POST rejected (Status: ${res.statusCode})`);
          resolve(false);
        }
      });
    }).on('error', (err) => {
      log('error', `Connection error: ${err.message}`);
      resolve(false);
    });

    req.write(payload);
    req.end();
  });
}

async function testEnvironmentVars() {
  log('info', '\n═══ TEST 4: Environment Variables ═══');

  const required = [
    'PAGE_ACCESS_TOKEN',
    'VERIFY_TOKEN',
    'API_SECRET',
    'INSTAGRAM_ACCOUNT_ID'
  ];

  const optional = [
    'META_APP_SECRET',
    'OPENAI_API_KEY'
  ];

  let allPresent = true;
  for (const key of required) {
    const value = process.env[key];
    if (value) {
      log('success', `${key}: ${value.substring(0, 10)}... ✓`);
    } else {
      log('error', `${key}: MISSING ✗`);
      allPresent = false;
    }
  }

  for (const key of optional) {
    const value = process.env[key];
    if (value) {
      log('debug', `${key}: configured (optional)`);
    } else {
      log('warning', `${key}: not configured (optional)`);
    }
  }

  return allPresent;
}

async function testBroadcasting() {
  log('info', '\n═══ TEST 5: Message Broadcasting ═══');

  return new Promise((resolve) => {
    // Connect SSE client
    const url = `${BASE_URL}/stream?token=${encodeURIComponent(process.env.API_SECRET || 'test')}`;
    const req = http.get(url, (res) => {
      let receivedBroadcast = false;

      res.on('data', (chunk) => {
        const str = chunk.toString();
        if (str.includes('data: {') && str.includes('type')) {
          receivedBroadcast = true;
          log('success', 'Broadcasting working - SSE events received');
        }
      });

      // Simulate webhook POST after connection
      setTimeout(() => {
        const payload = JSON.stringify({
          object: 'instagram',
          entry: [{
            messaging: [{
              sender: { id: '999', name: 'Broadcast Test' },
              message: { text: 'Broadcasting test' }
            }]
          }]
        });

        const options = {
          hostname: 'localhost',
          port: 3000,
          path: '/webhook',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(payload)
          }
        };

        const postReq = http.request(options, (res) => {
          // Wait for broadcast
          setTimeout(() => {
            req.destroy();
            if (receivedBroadcast) {
              log('success', 'Message broadcasting: OK');
              resolve(true);
            } else {
              log('warning', 'No broadcast received after POST (check console logs)');
              resolve(false);
            }
          }, 1000);
        });

        postReq.write(payload);
        postReq.end();
      }, 1000);
    }).on('error', (err) => {
      log('error', `Broadcasting test failed: ${err.message}`);
      resolve(false);
    });
  });
}

async function runDiagnostics() {
  console.log(`\n${colors.cyan}╔════════════════════════════════════════════════════════════╗${colors.reset}`);
  console.log(`${colors.cyan}║  MONITOR DIAGNOSTIC TOOL - Node.js Design Patterns       ║${colors.reset}`);
  console.log(`${colors.cyan}╚════════════════════════════════════════════════════════════╝${colors.reset}\n`);

  log('info', `Testing: ${BASE_URL}`);

  const results = {
    webhookVerification: await testWebhookVerification(),
    sseConnection: await testSSEConnection(),
    webhookPOST: await testWebhookPOST(),
    environment: await testEnvironmentVars(),
    broadcasting: await testBroadcasting()
  };

  // Summary
  log('info', '\n═══ SUMMARY ═══');
  console.log(`
${colors.blue}Webhook Verification:${colors.reset} ${results.webhookVerification ? colors.green + '✓ PASS' : colors.red + '✗ FAIL'}${colors.reset}
${colors.blue}SSE Connection:${colors.reset}       ${results.sseConnection ? colors.green + '✓ PASS' : colors.red + '✗ FAIL'}${colors.reset}
${colors.blue}Webhook POST:${colors.reset}          ${results.webhookPOST ? colors.green + '✓ PASS' : colors.red + '✗ FAIL'}${colors.reset}
${colors.blue}Environment:${colors.reset}           ${results.environment ? colors.green + '✓ PASS' : colors.red + '✗ FAIL'}${colors.reset}
${colors.blue}Broadcasting:${colors.reset}         ${results.broadcasting ? colors.green + '✓ PASS' : colors.red + '✗ FAIL'}${colors.reset}
  `);

  const passed = Object.values(results).filter(r => r).length;
  const total = Object.keys(results).length;

  log('info', `\n📊 Score: ${passed}/${total} tests passed`);

  if (passed === total) {
    log('success', 'All tests passed! Monitor should be working.');
  } else {
    log('error', `${total - passed} tests failed. Check issues above.`);
  }
}

runDiagnostics().catch(err => {
  log('error', `Diagnostic error: ${err.message}`);
  process.exit(1);
});
