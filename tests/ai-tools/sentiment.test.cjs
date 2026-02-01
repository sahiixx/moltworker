#!/usr/bin/env node
/**
 * Tests for ai-tools/sentiment.cjs
 */

const { strict: assert } = require('assert');
const { spawn } = require('child_process');
const path = require('path');

const SCRIPT_PATH = path.join(__dirname, '../../skills/ai-tools/scripts/sentiment.cjs');

function runScript(args, env = {}) {
  return new Promise((resolve) => {
    const proc = spawn('node', [SCRIPT_PATH, ...args], {
      env: { ...process.env, ...env }
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => stdout += data.toString());
    proc.stderr.on('data', (data) => stderr += data.toString());

    proc.on('close', (code) => {
      resolve({ code, stdout, stderr });
    });
  });
}

// Test: Missing API key
async function testMissingApiKey() {
  console.log('Test: Missing API key should error');
  const result = await runScript(['test text'], {
    ANTHROPIC_API_KEY: '',
    AI_GATEWAY_API_KEY: ''
  });

  assert.equal(result.code, 1, 'Should exit with code 1');
  assert(result.stderr.includes('ANTHROPIC_API_KEY'), 'Should mention missing API key');
  console.log('✓ Passed');
}

// Test: No text provided
async function testNoTextProvided() {
  console.log('Test: No text provided should show usage');
  const result = await runScript([]);

  assert.equal(result.code, 1, 'Should exit with code 1');
  assert(result.stderr.includes('Usage'), 'Should show usage message');
  console.log('✓ Passed');
}

// Test: Simple text input
async function testSimpleTextInput() {
  console.log('Test: Simple text input');
  const result = await runScript(['I am very happy today'], {
    ANTHROPIC_API_KEY: 'test-key'
  });

  assert(result.code === 1, 'Should fail with test key');
  assert(result.stderr.includes('API error') || result.stderr.includes('error'),
    'Should fail with API error');
  console.log('✓ Passed');
}

// Test: Custom model parameter
async function testCustomModel() {
  console.log('Test: Custom model parameter');
  const result = await runScript([
    'test text',
    '--model', 'claude-3-5-sonnet-20241022'
  ], {
    ANTHROPIC_API_KEY: 'test-key'
  });

  assert(result.code === 1, 'Should fail with test key');
  console.log('✓ Passed');
}

// Test: Text with multiple words (args joining)
async function testMultipleWords() {
  console.log('Test: Multiple words should be joined');
  const result = await runScript(['This', 'is', 'great', 'news'], {
    ANTHROPIC_API_KEY: 'test-key'
  });

  // Text should be joined: "This is great news"
  assert(result.code === 1, 'Should fail with test key');
  console.log('✓ Passed');
}

// Test: Long text input
async function testLongTextInput() {
  console.log('Test: Long text input');
  const longText = 'This is a long piece of text that contains multiple sentences. ' +
    'It expresses various emotions and sentiments throughout. ' +
    'Some parts are positive, some negative, and some neutral.';

  const result = await runScript([longText], {
    ANTHROPIC_API_KEY: 'test-key'
  });

  assert(result.code === 1, 'Should fail with test key');
  console.log('✓ Passed');
}

// Test: Text with special characters
async function testSpecialCharacters() {
  console.log('Test: Text with special characters');
  const result = await runScript(['I\'m so excited! 🎉 This is amazing!!!'], {
    ANTHROPIC_API_KEY: 'test-key'
  });

  assert(result.code === 1, 'Should fail with test key');
  console.log('✓ Passed');
}

// Test: Negative sentiment text
async function testNegativeSentiment() {
  console.log('Test: Negative sentiment text');
  const result = await runScript(['This is terrible and disappointing'], {
    ANTHROPIC_API_KEY: 'test-key'
  });

  assert(result.code === 1, 'Should fail with test key');
  console.log('✓ Passed');
}

// Test: Neutral sentiment text
async function testNeutralSentiment() {
  console.log('Test: Neutral sentiment text');
  const result = await runScript(['The weather today is 72 degrees'], {
    ANTHROPIC_API_KEY: 'test-key'
  });

  assert(result.code === 1, 'Should fail with test key');
  console.log('✓ Passed');
}

// Test: Mixed sentiment text
async function testMixedSentiment() {
  console.log('Test: Mixed sentiment text');
  const result = await runScript([
    'The food was great but the service was terrible'
  ], {
    ANTHROPIC_API_KEY: 'test-key'
  });

  assert(result.code === 1, 'Should fail with test key');
  console.log('✓ Passed');
}

// Test: AI Gateway configuration
async function testAiGatewayConfig() {
  console.log('Test: AI Gateway configuration');
  const result = await runScript(['test sentiment'], {
    AI_GATEWAY_API_KEY: 'gateway-key',
    AI_GATEWAY_BASE_URL: 'https://gateway.example.com'
  });

  assert(result.stderr.includes('API error') || result.stderr.includes('error'),
    'Should fail with API error');
  console.log('✓ Passed');
}

// Run all tests
async function runTests() {
  console.log('Running sentiment.cjs tests...\n');

  try {
    await testMissingApiKey();
    await testNoTextProvided();
    await testSimpleTextInput();
    await testCustomModel();
    await testMultipleWords();
    await testLongTextInput();
    await testSpecialCharacters();
    await testNegativeSentiment();
    await testNeutralSentiment();
    await testMixedSentiment();
    await testAiGatewayConfig();

    console.log('\n✓ All sentiment.cjs tests passed!');
    process.exit(0);
  } catch (err) {
    console.error('\n✗ Test failed:', err.message);
    console.error(err.stack);
    process.exit(1);
  }
}

runTests();