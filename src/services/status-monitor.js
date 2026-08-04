/**
 * Status Monitor Service
 * Tracks real connection status and configuration
 *
 * Based on Node.js Design Patterns:
 * - Observer Pattern (state changes)
 * - Strategy Pattern (different checks)
 * - Health Check Pattern
 */

const { state } = require('../shared');

class StatusMonitor {
  constructor() {
    this.status = {
      server: 'running',
      configured: false,
      webhookConfigured: false,
      instagramConnected: false,
      sseClientsConnected: false,
      lastChecked: Date.now()
    };

    this.observers = [];
  }

  // ============================================
  // OBSERVER PATTERN
  // ============================================
  subscribe(observer) {
    this.observers.push(observer);
  }

  unsubscribe(observer) {
    this.observers = this.observers.filter(o => o !== observer);
  }

  notify() {
    this.observers.forEach(observer => observer.update(this.status));
  }

  // ============================================
  // STATUS CHECKS
  // ============================================

  /**
   * Check if environment is properly configured
   * Strategy 1: Required environment variables
   */
  checkConfiguration() {
    const required = [
      'VERIFY_TOKEN',
      'API_SECRET',
    ];

    const hasEnvVars = required.every(key => process.env[key]);
    const hasIgAccess = !!state.ACCESS_TOKEN && !!state.INSTAGRAM_ACCOUNT_ID;
    
    const configured = hasEnvVars && hasIgAccess;
    this.status.configured = configured;

    return {
      configured,
      missing: [
        ...required.filter(key => !process.env[key]),
        ...(hasIgAccess ? [] : ['state.ACCESS_TOKEN o state.INSTAGRAM_ACCOUNT_ID'])
      ]
    };
  }

  /**
   * Check if webhook is properly configured
   * Strategy 2: Webhook verification token
   */
  checkWebhookConfig() {
    const hasVerifyToken = !!process.env.VERIFY_TOKEN;
    const hasAppSecret = !!process.env.META_APP_SECRET;

    this.status.webhookConfigured = hasVerifyToken && hasAppSecret;

    return {
      configured: this.status.webhookConfigured,
      verifyToken: hasVerifyToken,
      appSecret: hasAppSecret
    };
  }

  /**
   * Check Instagram connection
   * Strategy 3: Access token validity
   */
  checkInstagramConnection() {
    const hasToken = !!state.ACCESS_TOKEN;
    const hasAccountId = !!state.INSTAGRAM_ACCOUNT_ID;

    this.status.instagramConnected = hasToken && hasAccountId;

    return {
      connected: this.status.instagramConnected,
      token: hasToken,
      accountId: hasAccountId
    };
  }

  /**
   * Check SSE clients
   * Strategy 4: Active connections
   */
  checkSSEConnections() {
    const hasSecret = !!process.env.API_SECRET;
    const clientsConnected = state.sseClients.length > 0;

    this.status.sseClientsConnected = clientsConnected && hasSecret;

    return {
      connected: this.status.sseClientsConnected,
      clientCount: state.sseClients.length,
      secret: hasSecret
    };
  }

  /**
   * Run all checks and return comprehensive status
   */
  getFullStatus() {
    this.status.lastChecked = Date.now();

    return {
      overall: this.getOverallStatus(),
      configuration: this.checkConfiguration(),
      webhook: this.checkWebhookConfig(),
      instagram: this.checkInstagramConnection(),
      sse: this.checkSSEConnections(),
      server: {
        status: this.status.server,
        uptime: process.uptime()
      }
    };
  }

  /**
   * Determine overall system status
   */
  getOverallStatus() {
    if (!this.status.configured) {
      return {
        code: 'NOT_CONFIGURED',
        status: '🔴 NOT CONFIGURED',
        message: 'Missing required environment variables',
        severity: 'CRITICAL',
        nextStep: 'Configure .env file with required tokens'
      };
    }

    if (!this.status.webhookConfigured) {
      return {
        code: 'WEBHOOK_MISCONFIGURED',
        status: '🟡 WEBHOOK ERROR',
        message: 'Webhook not properly configured',
        severity: 'HIGH',
        nextStep: 'Verify VERIFY_TOKEN and META_APP_SECRET'
      };
    }

    if (!this.status.instagramConnected) {
      return {
        code: 'INSTAGRAM_DISCONNECTED',
        status: '🟡 INSTAGRAM OFFLINE',
        message: 'Cannot reach Instagram API',
        severity: 'HIGH',
        nextStep: 'Check PAGE_ACCESS_TOKEN validity'
      };
    }

    if (!this.status.sseClientsConnected) {
      return {
        code: 'WAITING_FOR_CLIENTS',
        status: '🟡 WAITING FOR MONITOR',
        message: 'Server ready but no Monitor connected',
        severity: 'INFO',
        nextStep: 'Open Monitor in browser'
      };
    }

    return {
      code: 'CONNECTED',
      status: '🟢 CONNECTED & RUNNING',
      message: 'All systems operational',
      severity: 'OK',
      nextStep: 'Ready to receive messages'
    };
  }

  /**
   * Health check endpoint data
   */
  getHealthCheck() {
    const fullStatus = this.getFullStatus();
    const overall = fullStatus.overall;

    return {
      status: overall.code,
      healthy: overall.code === 'CONNECTED',
      message: overall.message,
      timestamp: new Date().toISOString(),
      uptime: fullStatus.server.uptime,
      details: {
        configured: fullStatus.configuration.configured,
        webhookReady: fullStatus.webhook.configured,
        instagramConnected: fullStatus.instagram.connected,
        monitorConnected: fullStatus.sse.connected,
        activeConnections: fullStatus.sse.clientCount
      }
    };
  }
}

module.exports = StatusMonitor;
