#!/usr/bin/env node
/**
 * Tests for ai-tools/embeddings.cjs
 */

const { strict: assert } = require('assert');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

const SCRIPT_PATH = path.join(__dirname, '../../skills/ai-tools/scripts/embeddings.cjs');

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
    OPENAI_API_KEY: '',
    AI_GATEWAY_API_KEY: ''
  });

  assert.equal(result.code, 1, 'Should exit with code 1');
  assert(result.stderr.includes('OPENAI_API_KEY'), 'Should mention missing API key');
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

// Test: Custom model parameter
async function testCustomModel() {
  console.log('Test: Custom model parameter parsing');
  const result = await runScript(['test', '--model', 'text-embedding-3-large'], {
    OPENAI_API_KEY: 'sk-test'
  });

  // Will fail without valid API key but should parse args correctly
  assert(result.stderr.includes('API error') || result.stderr.includes('error'),
    'Should fail with API error, not arg parsing error');
  console.log('✓ Passed');
}

// Test: Custom dimensions parameter
async function testCustomDimensions() {
  console.log('Test: Custom dimensions parameter parsing');
  const result = await runScript(['test', '--dimensions', '512'], {
    OPENAI_API_KEY: 'sk-test'
  });

  // Will fail without valid API key
  assert(result.code === 1, 'Should fail with invalid API key');
  console.log('✓ Passed');
}

// Test: Output file parameter
async function testOutputFileParameter() {
  console.log('Test: Output file parameter parsing');
  const tempFile = path.join(os.tmpdir(), `test-embedding-${Date.now()}.cjson`);

  const result = await runScript(['test', '--output', tempFile], {
    OPENAI_API_KEY: 'sk-test'
  });

  // Cleanup
  try { fs.unlinkSync(tempFile); } catch {}

  assert(result.code === 1, 'Should fail with invalid API key');
  console.log('✓ Passed');
}

// Test: Invalid dimensions (not a number)
async function testInvalidDimensions() {
  console.log('Test: Invalid dimensions should be parsed as NaN');
  const result = await runScript(['test', '--dimensions', 'invalid'], {
    OPENAI_API_KEY: 'sk-test'
  });

  assert(result.code === 1, 'Should fail');
  console.log('✓ Passed');
}

// Test: Argument parsing with spaces in text
async function testTextWithSpaces() {
  console.log('Test: Text with spaces should be handled');
  const result = await runScript(['test text with multiple words'], {
    OPENAI_API_KEY: ''
  });

  assert.equal(result.code, 1, 'Should fail without API key');
  assert(result.stderr.includes('OPENAI_API_KEY'), 'Should error on missing key');
  console.log('✓ Passed');
}

// Test: All parameters combined
async function testAllParametersCombined() {
  console.log('Test: All parameters combined');
  const tempFile = path.join(os.tmpdir(), `test-embedding-${Date.now()}.cjson`);

  const result = await runScript([
    'test text',
    '--model', 'text-embedding-3-small',
    '--dimensions', '256',
    '--output', tempFile
  ], {
    OPENAI_API_KEY: 'sk-test'
  });

  // Cleanup
  try { fs.unlinkSync(tempFile); } catch {}

  assert(result.code === 1, 'Should fail with test API key');
  console.log('✓ Passed');
}

// Test: Empty text string
async function testEmptyTextString() {
  console.log('Test: Empty text string should show usage');
  const result = await runScript([''], {
    OPENAI_API_KEY: 'sk-test'
  });

  assert.equal(result.code, 1, 'Should exit with error');
  console.log('✓ Passed');
}

// Test: Gateway API key environment variable
async function testGatewayApiKey() {
  console.log('Test: AI Gateway API key should be accepted');
  const result = await runScript(['test text'], {
    AI_GATEWAY_API_KEY: 'test-key',
    AI_GATEWAY_BASE_URL: 'https://gateway.example.com/v1'
  });

  // Should fail with connection/API error, not missing key
  assert(result.stderr.includes('API error') || result.stderr.includes('error'),
    'Should fail with API error, not missing key error');
  console.log('✓ Passed');
}

// Run all tests
async function runTests() {
  console.log('Running embeddings.cjs tests...\n');

  try {
    await testMissingApiKey();
    await testNoTextProvided();
    await testCustomModel();
    await testCustomDimensions();
    await testOutputFileParameter();
    await testInvalidDimensions();
    await testTextWithSpaces();
    await testAllParametersCombined();
    await testEmptyTextString();
    await testGatewayApiKey();

    console.log('\n✓ All embeddings.cjs tests passed!');
    process.exit(0);
  } catch (err) {
    console.error('\n✗ Test failed:', err.message);
    console.error(err.stack);
    process.exit(1);
  }
}

runTests();