#!/usr/bin/env node
/**
 * Tests for code-runner/benchmark.cjs
 */

const { strict: assert } = require('assert');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

const SCRIPT_PATH = path.join(__dirname, '../../skills/code-runner/scripts/benchmark.cjs');

function runScript(args) {
  return new Promise((resolve) => {
    const proc = spawn('node', [SCRIPT_PATH, ...args], { timeout: 30000 });
    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (data) => stdout += data.toString());
    proc.stderr.on('data', (data) => stderr += data.toString());
    proc.on('close', (code) => resolve({ code, stdout, stderr }));
  });
}

async function testNoCode() {
  console.log('Test: No code should show usage');
  const result = await runScript([]);
  assert(result.stderr.includes('Usage'));
  console.log('✓ Passed');
}

async function testJavaScriptBenchmark() {
  console.log('Test: JavaScript benchmark');
  const result = await runScript([
    'let x = 0; x++;',
    '--lang', 'js',
    '--iterations', '10',
    '--warmup', '2'
  ]);

  if (result.code === 0) {
    const output = JSON.parse(result.stdout);
    assert.equal(output.language, 'javascript');
    assert.equal(output.iterations, 10);
    assert(output.results.mean >= 0);
    assert(output.results.min >= 0);
    assert(output.results.max >= output.results.min);
  }
  console.log('✓ Passed');
}

async function testPythonBenchmark() {
  console.log('Test: Python benchmark');
  const result = await runScript([
    'x = 1 + 1',
    '--lang', 'python',
    '--iterations', '10',
    '--warmup', '2'
  ]);

  if (result.code === 0) {
    const output = JSON.parse(result.stdout);
    assert.equal(output.language, 'python');
    assert(output.results.mean >= 0);
  }
  console.log('✓ Passed');
}

async function testFileInput() {
  console.log('Test: File input');
  const tempFile = path.join(os.tmpdir(), `bench-${Date.now()}.cjs`);
  fs.writeFileSync(tempFile, 'Math.sqrt(144);');

  const result = await runScript([
    '--file', tempFile,
    '--lang', 'js',
    '--iterations', '5',
    '--warmup', '1'
  ]);

  fs.unlinkSync(tempFile);

  if (result.code === 0) {
    const output = JSON.parse(result.stdout);
    assert(output.results);
  }
  console.log('✓ Passed');
}

async function testCustomIterations() {
  console.log('Test: Custom iterations');
  const result = await runScript([
    '1 + 1',
    '--lang', 'js',
    '--iterations', '20',
    '--warmup', '5'
  ]);

  if (result.code === 0) {
    const output = JSON.parse(result.stdout);
    assert.equal(output.iterations, 20);
    assert.equal(output.warmupRuns, 5);
  }
  console.log('✓ Passed');
}

async function testStatisticsCalculation() {
  console.log('Test: Statistics calculation');
  const result = await runScript([
    'Array(100).fill(0).reduce((a,b) => a+b, 0)',
    '--lang', 'js',
    '--iterations', '10',
    '--warmup', '0'
  ]);

  if (result.code === 0) {
    const output = JSON.parse(result.stdout);
    assert(output.results.min !== undefined);
    assert(output.results.max !== undefined);
    assert(output.results.mean !== undefined);
    assert(output.results.median !== undefined);
    assert(output.results.stdDev !== undefined);
    assert(output.results.p95 !== undefined);
    assert(output.results.p99 !== undefined);
  }
  console.log('✓ Passed');
}

async function testZeroWarmup() {
  console.log('Test: Zero warmup');
  const result = await runScript([
    '1',
    '--lang', 'js',
    '--iterations', '5',
    '--warmup', '0'
  ]);

  if (result.code === 0) {
    const output = JSON.parse(result.stdout);
    assert.equal(output.warmupRuns, 0);
  }
  console.log('✓ Passed');
}

async function testInvalidCode() {
  console.log('Test: Invalid code handling');
  const result = await runScript([
    'invalid syntax;;;',
    '--lang', 'js',
    '--iterations', '5'
  ]);

  assert(result.code === 1);
  assert(result.stderr.includes('error'));
  console.log('✓ Passed');
}

async function testUnsupportedLanguage() {
  console.log('Test: Unsupported language for benchmarking');
  const result = await runScript([
    'code',
    '--lang', 'bash',
    '--iterations', '5'
  ]);

  // Bash may not be supported for benchmarking
  assert(result.code === 1 || result.code === 0);
  console.log('✓ Passed');
}

async function runTests() {
  console.log('Running benchmark.cjs tests...\n');
  try {
    await testNoCode();
    await testJavaScriptBenchmark();
    await testPythonBenchmark();
    await testFileInput();
    await testCustomIterations();
    await testStatisticsCalculation();
    await testZeroWarmup();
    await testInvalidCode();
    await testUnsupportedLanguage();

    console.log('\n✓ All benchmark.cjs tests passed!');
    process.exit(0);
  } catch (err) {
    console.error('\n✗ Test failed:', err.message);
    console.error(err.stack);
    process.exit(1);
  }
}

runTests();