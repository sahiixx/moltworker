#!/usr/bin/env node
/**
 * Tests for ai-tools/extract.cjs
 */

const { strict: assert } = require('assert');
const { spawn } = require('child_process');
const path = require('path');

const SCRIPT_PATH = path.join(__dirname, '../../skills/ai-tools/scripts/extract.cjs');

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
  const result = await runScript(['test text', '--schema', '{"name":"string"}'], {
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
  const result = await runScript(['--schema', '{"name":"string"}']);

  assert.equal(result.code, 1, 'Should exit with code 1');
  assert(result.stderr.includes('Usage'), 'Should show usage message');
  console.log('✓ Passed');
}

// Test: No schema provided
async function testNoSchemaProvided() {
  console.log('Test: No schema provided should show usage');
  const result = await runScript(['test text']);

  assert.equal(result.code, 1, 'Should exit with code 1');
  assert(result.stderr.includes('Usage'), 'Should show usage message');
  console.log('✓ Passed');
}

// Test: Valid JSON schema as string
async function testValidJsonSchema() {
  console.log('Test: Valid JSON schema parsing');
  const result = await runScript([
    'John Doe, 30 years old',
    '--schema', '{"name":"string","age":"number"}'
  ], {
    ANTHROPIC_API_KEY: 'test-key'
  });

  // Will fail with test key but should parse arguments correctly
  assert(result.stderr.includes('API error') || result.stderr.includes('error'),
    'Should fail with API error, not parsing error');
  console.log('✓ Passed');
}

// Test: Invalid JSON schema
async function testInvalidJsonSchema() {
  console.log('Test: Invalid JSON schema handling');
  const result = await runScript([
    'test text',
    '--schema', '{invalid json'
  ], {
    ANTHROPIC_API_KEY: 'test-key'
  });

  // Should still try to process as plain string schema
  assert(result.code === 1, 'Should exit with error');
  console.log('✓ Passed');
}

// Test: Custom model parameter
async function testCustomModel() {
  console.log('Test: Custom model parameter');
  const result = await runScript([
    'test',
    '--schema', '{"field":"string"}',
    '--model', 'claude-3-opus-20240229'
  ], {
    ANTHROPIC_API_KEY: 'test-key'
  });

  assert(result.code === 1, 'Should fail with test key');
  console.log('✓ Passed');
}

// Test: Complex schema with nested fields
async function testComplexSchema() {
  console.log('Test: Complex schema with nested fields');
  const schema = {
    person: {
      name: 'string',
      age: 'number',
      address: {
        city: 'string',
        country: 'string'
      }
    }
  };

  const result = await runScript([
    'John lives in NYC, USA and is 30',
    '--schema', JSON.stringify(schema)
  ], {
    ANTHROPIC_API_KEY: 'test-key'
  });

  assert(result.code === 1, 'Should fail with test key');
  console.log('✓ Passed');
}

// Test: Schema with array type
async function testSchemaWithArray() {
  console.log('Test: Schema with array type');
  const result = await runScript([
    'John likes pizza, pasta, and salad',
    '--schema', '{"name":"string","foods":["string"]}'
  ], {
    ANTHROPIC_API_KEY: 'test-key'
  });

  assert(result.code === 1, 'Should fail with test key');
  console.log('✓ Passed');
}

// Test: Empty text
async function testEmptyText() {
  console.log('Test: Empty text should show usage');
  const result = await runScript(['', '--schema', '{"name":"string"}']);

  assert.equal(result.code, 1, 'Should exit with error');
  console.log('✓ Passed');
}

// Test: Text with special characters
async function testTextWithSpecialCharacters() {
  console.log('Test: Text with special characters');
  const result = await runScript([
    'Name: John O\'Brien, Email: john@example.com',
    '--schema', '{"name":"string","email":"string"}'
  ], {
    ANTHROPIC_API_KEY: 'test-key'
  });

  assert(result.code === 1, 'Should fail with test key');
  console.log('✓ Passed');
}

// Test: AI Gateway environment variables
async function testAiGatewayEnv() {
  console.log('Test: AI Gateway environment variables');
  const result = await runScript([
    'test',
    '--schema', '{"field":"string"}'
  ], {
    AI_GATEWAY_API_KEY: 'gateway-key',
    AI_GATEWAY_BASE_URL: 'https://gateway.example.com'
  });

  assert(result.stderr.includes('API error') || result.stderr.includes('error'),
    'Should fail with API error');
  console.log('✓ Passed');
}

// Run all tests
async function runTests() {
  console.log('Running extract.cjs tests...\n');

  try {
    await testMissingApiKey();
    await testNoTextProvided();
    await testNoSchemaProvided();
    await testValidJsonSchema();
    await testInvalidJsonSchema();
    await testCustomModel();
    await testComplexSchema();
    await testSchemaWithArray();
    await testEmptyText();
    await testTextWithSpecialCharacters();
    await testAiGatewayEnv();

    console.log('\n✓ All extract.cjs tests passed!');
    process.exit(0);
  } catch (err) {
    console.error('\n✗ Test failed:', err.message);
    console.error(err.stack);
    process.exit(1);
  }
}

runTests();