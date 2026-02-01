#!/usr/bin/env node
/**
 * Tests for code-runner/eval.cjs
 */

const { strict: assert } = require('assert');
const { spawn } = require('child_process');
const path = require('path');

const SCRIPT_PATH = path.join(__dirname, '../../skills/code-runner/scripts/eval.cjs');

function runScript(args) {
  return new Promise((resolve) => {
    const proc = spawn('node', [SCRIPT_PATH, ...args]);
    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (data) => stdout += data.toString());
    proc.stderr.on('data', (data) => stderr += data.toString());
    proc.on('close', (code) => resolve({ code, stdout, stderr }));
  });
}

async function testNoExpression() {
  console.log('Test: No expression should show usage');
  const result = await runScript([]);
  assert(result.stderr.includes('Usage'));
  console.log('✓ Passed');
}

async function testSimpleArithmetic() {
  console.log('Test: Simple arithmetic');
  const result = await runScript(['2 + 2']);
  assert.equal(result.code, 0);
  const output = JSON.parse(result.stdout);
  assert.equal(output.result, 4);
  console.log('✓ Passed');
}

async function testMathFunctions() {
  console.log('Test: Math functions');
  const result = await runScript(['Math.sqrt(16)']);
  assert.equal(result.code, 0);
  const output = JSON.parse(result.stdout);
  assert.equal(output.result, 4);
  console.log('✓ Passed');
}

async function testArrayOperations() {
  console.log('Test: Array operations');
  const result = await runScript(['[1,2,3].map(x => x * 2)']);
  assert.equal(result.code, 0);
  const output = JSON.parse(result.stdout);
  assert.deepEqual(output.result, [2, 4, 6]);
  console.log('✓ Passed');
}

async function testDateOperations() {
  console.log('Test: Date operations');
  const result = await runScript(['new Date(0).getTime()']);
  assert.equal(result.code, 0);
  const output = JSON.parse(result.stdout);
  assert.equal(output.result, 0);
  console.log('✓ Passed');
}

async function testStringOperations() {
  console.log('Test: String operations');
  const result = await runScript(['"hello".toUpperCase()']);
  assert.equal(result.code, 0);
  const output = JSON.parse(result.stdout);
  assert.equal(output.result, 'HELLO');
  console.log('✓ Passed');
}

async function testJSONOperations() {
  console.log('Test: JSON operations');
  const result = await runScript(['JSON.stringify({a:1})']);
  assert.equal(result.code, 0);
  const output = JSON.parse(result.stdout);
  assert.equal(output.result, '{"a":1}');
  console.log('✓ Passed');
}

async function testSyntaxError() {
  console.log('Test: Syntax error');
  const result = await runScript(['invalid syntax here;;;']);
  assert(result.code === 1);
  const output = JSON.parse(result.stderr);
  assert(output.error);
  console.log('✓ Passed');
}

async function testUndefinedResult() {
  console.log('Test: Undefined result');
  const result = await runScript(['undefined']);
  assert.equal(result.code, 0);
  const output = JSON.parse(result.stdout);
  assert.equal(output.result, 'undefined');
  console.log('✓ Passed');
}

async function testNullResult() {
  console.log('Test: Null result');
  const result = await runScript(['null']);
  assert.equal(result.code, 0);
  const output = JSON.parse(result.stdout);
  assert.equal(output.result, 'null');
  console.log('✓ Passed');
}

async function testBooleanResult() {
  console.log('Test: Boolean result');
  const result = await runScript(['true && false']);
  assert.equal(result.code, 0);
  const output = JSON.parse(result.stdout);
  assert.equal(output.result, false);
  console.log('✓ Passed');
}

async function testComplexExpression() {
  console.log('Test: Complex expression');
  const result = await runScript(['Math.floor(Math.random() * 100) >= 0']);
  assert.equal(result.code, 0);
  const output = JSON.parse(result.stdout);
  assert.equal(typeof output.result, 'boolean');
  console.log('✓ Passed');
}

async function runTests() {
  console.log('Running eval.cjs tests...\n');
  try {
    await testNoExpression();
    await testSimpleArithmetic();
    await testMathFunctions();
    await testArrayOperations();
    await testDateOperations();
    await testStringOperations();
    await testJSONOperations();
    await testSyntaxError();
    await testUndefinedResult();
    await testNullResult();
    await testBooleanResult();
    await testComplexExpression();

    console.log('\n✓ All eval.cjs tests passed!');
    process.exit(0);
  } catch (err) {
    console.error('\n✗ Test failed:', err.message);
    console.error(err.stack);
    process.exit(1);
  }
}

runTests();