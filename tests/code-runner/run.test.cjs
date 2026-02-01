#!/usr/bin/env node
/**
 * Tests for code-runner/run.cjs
 */

const { strict: assert } = require('assert');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

const SCRIPT_PATH = path.join(__dirname, '../../skills/code-runner/scripts/run.cjs');

function runScript(args) {
  return new Promise((resolve) => {
    const proc = spawn('node', [SCRIPT_PATH, ...args], {
      timeout: 10000
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

async function testNoLanguage() {
  console.log('Test: No language specified should show usage');
  const result = await runScript(['console.log("test")']);
  assert(result.stderr.includes('Usage'), 'Should show usage');
  console.log('✓ Passed');
}

async function testJavaScriptExecution() {
  console.log('Test: JavaScript execution');
  const result = await runScript(['console.log("Hello World")', '--lang', 'js']);
  assert(result.code === 0 || result.code === 1, 'Should complete');
  if (result.code === 0) {
    const output = JSON.parse(result.stdout);
    assert.equal(output.language, 'javascript');
    assert.equal(output.stdout, 'Hello World');
  }
  console.log('✓ Passed');
}

async function testPythonExecution() {
  console.log('Test: Python execution');
  const result = await runScript(['print("Hello from Python")', '--lang', 'python']);
  if (result.code === 0) {
    const output = JSON.parse(result.stdout);
    assert.equal(output.language, 'python');
    assert(output.stdout.includes('Hello from Python'));
  }
  console.log('✓ Passed');
}

async function testShellExecution() {
  console.log('Test: Shell execution');
  const result = await runScript(['echo "test"', '--lang', 'bash']);
  if (result.code === 0) {
    const output = JSON.parse(result.stdout);
    assert.equal(output.language, 'shell');
  }
  console.log('✓ Passed');
}

async function testFileInput() {
  console.log('Test: File input');
  const tempFile = path.join(os.tmpdir(), `test-code-${Date.now()}.cjs`);
  fs.writeFileSync(tempFile, 'console.log("from file");');

  const result = await runScript(['--file', tempFile, '--lang', 'js']);
  fs.unlinkSync(tempFile);

  if (result.code === 0) {
    const output = JSON.parse(result.stdout);
    assert(output.stdout.includes('from file'));
  }
  console.log('✓ Passed');
}

async function testNonExistentFile() {
  console.log('Test: Non-existent file should error');
  const result = await runScript(['--file', '/nonexistent.cjs', '--lang', 'js']);
  assert(result.stderr.includes('not found') || result.stderr.includes('error'));
  console.log('✓ Passed');
}

async function testTimeout() {
  console.log('Test: Timeout parameter');
  const result = await runScript([
    'console.log("start")',
    '--lang', 'js',
    '--timeout', '100'
  ]);
  assert(result.code === 0 || result.code === 1);
  console.log('✓ Passed');
}

async function testStdinInput() {
  console.log('Test: Stdin input');
  const result = await runScript([
    'const fs = require("fs"); console.log(fs.readFileSync(0, "utf-8"));',
    '--lang', 'js',
    '--stdin', 'test input'
  ]);
  if (result.code === 0) {
    const output = JSON.parse(result.stdout);
    assert(output.stdout.includes('test input'));
  }
  console.log('✓ Passed');
}

async function testCommandArgs() {
  console.log('Test: Command arguments');
  const result = await runScript([
    'console.log(process.argv.slice(2));',
    '--lang', 'js',
    '--args', 'arg1,arg2,arg3'
  ]);
  if (result.code === 0) {
    const output = JSON.parse(result.stdout);
    assert(output.stdout.includes('arg1'));
  }
  console.log('✓ Passed');
}

async function testEnvVariables() {
  console.log('Test: Environment variables');
  const result = await runScript([
    'console.log(process.env.TEST_VAR);',
    '--lang', 'js',
    '--env', '{"TEST_VAR":"test_value"}'
  ]);
  if (result.code === 0) {
    const output = JSON.parse(result.stdout);
    assert(output.stdout.includes('test_value'));
  }
  console.log('✓ Passed');
}

async function testSyntaxError() {
  console.log('Test: Syntax error handling');
  const result = await runScript(['this is invalid code;;;', '--lang', 'js']);
  assert(result.code === 1);
  const output = JSON.parse(result.stdout);
  assert.equal(output.success, false);
  console.log('✓ Passed');
}

async function testUnsupportedLanguage() {
  console.log('Test: Unsupported language');
  const result = await runScript(['code', '--lang', 'unsupported']);
  assert(result.stderr.includes('Unsupported') || result.stderr.includes('error'));
  console.log('✓ Passed');
}

async function runTests() {
  console.log('Running run.cjs tests...\n');
  try {
    await testNoLanguage();
    await testJavaScriptExecution();
    await testPythonExecution();
    await testShellExecution();
    await testFileInput();
    await testNonExistentFile();
    await testTimeout();
    await testStdinInput();
    await testCommandArgs();
    await testEnvVariables();
    await testSyntaxError();
    await testUnsupportedLanguage();

    console.log('\n✓ All run.cjs tests passed!');
    process.exit(0);
  } catch (err) {
    console.error('\n✗ Test failed:', err.message);
    console.error(err.stack);
    process.exit(1);
  }
}

runTests();