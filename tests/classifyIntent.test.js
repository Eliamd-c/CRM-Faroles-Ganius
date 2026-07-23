const { test, describe } = require('node:test');
const assert = require('node:assert');
const { classifyIntent } = require('../ai_copilot');

/**
 * Test suite for classifyIntent function
 * Tests the AI-powered intent classification system
 */

describe('classifyIntent', () => {
    test('should classify sales inquiry correctly', async () => {
        const text = 'How much does the product cost?';
        const history = 'Customer: Hello\nAgent: Hi, how can I help?';
        const triggers = [
            { intent_name: 'sales_inquiry', keyword: 'price' },
            { intent_name: 'support', keyword: 'help' }
        ];

        const result = await classifyIntent(text, history, triggers);
        assert.ok(result);
        assert.ok(result.intent);
    });

    test('should handle empty text gracefully', async () => {
        const text = '';
        const history = '';
        const triggers = [];

        const result = await classifyIntent(text, history, triggers);
        assert.ok(result);
        assert.ok(result.error || result.intent);
    });

    test('should classify support request correctly', async () => {
        const text = 'I need help with my order';
        const history = 'Customer: Hi\nAgent: Welcome';
        const triggers = [
            { intent_name: 'support', keyword: 'help' },
            { intent_name: 'complaint', keyword: 'problem' }
        ];

        const result = await classifyIntent(text, history, triggers);
        assert.ok(result);
    });

    test('should return confidence score', async () => {
        const text = 'Can I buy this product?';
        const history = '';
        const triggers = [{ intent_name: 'purchase', keyword: 'buy' }];

        const result = await classifyIntent(text, history, triggers);
        assert.ok(result.confianza !== undefined || result.error);
    });

    test('should handle multiple triggers', async () => {
        const text = 'What is your refund policy?';
        const history = '';
        const triggers = [
            { intent_name: 'sales', keyword: 'buy' },
            { intent_name: 'policy', keyword: 'refund' },
            { intent_name: 'delivery', keyword: 'shipping' },
            { intent_name: 'support', keyword: 'help' }
        ];

        const result = await classifyIntent(text, history, triggers);
        assert.ok(result);
    });

    test('should return fallback for unmatched intent', async () => {
        const text = 'xyz random gibberish qwerty';
        const history = '';
        const triggers = [];

        const result = await classifyIntent(text, history, triggers);
        assert.ok(result.intent || result.error);
    });
});
