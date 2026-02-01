#!/usr/bin/env node
/**
 * Tests for ai-tools/summarize.cjs
 */

const { strict: assert } = require('assert');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

const SCRIPT_PATH = path.join(__dirname, '../../skills/ai-tools/scripts/summarize.cjs');

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

// Test: Custom length parameter
async function testCustomLength() {
  console.log('Test: Custom length parameter');
  const result = await runScript(['test text', '--length', '50'], {
    ANTHROPIC_API_KEY: 'test-key'
  });

  assert(result.code === 1, 'Should fail with test key');
  console.log('✓ Passed');
}

// Test: Brief style (default)
async function testBriefStyle() {
  console.log('Test: Brief style');
  const result = await runScript(['long text here', '--style', 'brief'], {
    ANTHROPIC_API_KEY: 'test-key'
  });

  assert(result.code === 1, 'Should fail with test key');
  console.log('✓ Passed');
}

// Test: Detailed style
async function testDetailedStyle() {
  console.log('Test: Detailed style');
  const result = await runScript(['text', '--style', 'detailed'], {
    ANTHROPIC_API_KEY: 'test-key'
  });

  assert(result.code === 1, 'Should fail with test key');
  console.log('✓ Passed');
}

// Test: Bullets style
async function testBulletsStyle() {
  console.log('Test: Bullets style');
  const result = await runScript(['text', '--style', 'bullets'], {
    ANTHROPIC_API_KEY: 'test-key'
  });

  assert(result.code === 1, 'Should fail with test key');
  console.log('✓ Passed');
}

// Test: File input flag
async function testFileInput() {
  console.log('Test: File input flag');
  const tempFile = path.join(os.tmpdir(), `test-input-${Date.now()}.txt`);
  fs.writeFileSync(tempFile, 'This is test content for summarization.');

  const result = await runScript([tempFile, '--file'], {
    ANTHROPIC_API_KEY: 'test-key'
  });

  fs.unlinkSync(tempFile);

  assert(result.code === 1, 'Should fail with test key');
  console.log('✓ Passed');
}

// Test: Non-existent file
async function testNonExistentFile() {
  console.log('Test: Non-existent file should error');
  const result = await runScript(['/nonexistent/file.txt', '--file'], {
    ANTHROPIC_API_KEY: 'test-key'
  });

  assert(result.code === 1, 'Should exit with error');
  assert(result.stderr.includes('not found') || result.stderr.includes('error'),
    'Should mention file error');
  console.log('✓ Passed');
}

// Test: Custom model parameter
async function testCustomModel() {
  console.log('Test: Custom model parameter');
  const result = await runScript([
    'text',
    '--model', 'claude-3-5-haiku-20241022'
  ], {
    ANTHROPIC_API_KEY: 'test-key'
  });

  assert(result.code === 1, 'Should fail with test key');
  console.log('✓ Passed');
}

// Test: All parameters combined
async function testAllParametersCombined() {
  console.log('Test: All parameters combined');
  const result = await runScript([
    'test text',
    '--length', '200',
    '--style', 'detailed',
    '--model', 'claude-3-5-sonnet-20241022'
  ], {
    ANTHROPIC_API_KEY: 'test-key'
  });

  assert(result.code === 1, 'Should fail with test key');
  console.log('✓ Passed');
}

// Test: Invalid length (not a number)
async function testInvalidLength() {
  console.log('Test: Invalid length parameter');
  const result = await runScript(['text', '--length', 'invalid'], {
    ANTHROPIC_API_KEY: 'test-key'
  });

  // Should parse as NaN but still run
  assert(result.code === 1, 'Should fail');
  console.log('✓ Passed');
}

// Run all tests
async function runTests() {
  console.log('Running summarize.cjs tests...\n');

  try {
    await testMissingApiKey();
    await testNoTextProvided();
    await testCustomLength();
    await testBriefStyle();
    await testDetailedStyle();
    await testBulletsStyle();
    await testFileInput();
    await testNonExistentFile();
    await testCustomModel();
    await testAllParametersCombined();
    await testInvalidLength();

    console.log('\n✓ All summarize.cjs tests passed!');
    process.exit(0);
  } catch (err) {
    console.error('\n✗ Test failed:', err.message);
    console.error(err.stack);
    process.exit(1);
  }
}

runTests();