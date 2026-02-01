#!/usr/bin/env node
const { strict: assert } = require('assert');
const { spawn } = require('child_process');
const path = require('path');

const CONVERT_PATH = path.join(__dirname, '../../skills/datetime/scripts/convert.cjs');
const DURATION_PATH = path.join(__dirname, '../../skills/datetime/scripts/duration.cjs');

function runScript(scriptPath, args) {
  return new Promise((resolve) => {
    const proc = spawn('node', [scriptPath, ...args]);
    let stdout = '', stderr = '';
    proc.stdout.on('data', (d) => stdout += d);
    proc.stderr.on('data', (d) => stderr += d);
    proc.on('close', (code) => resolve({ code, stdout, stderr }));
  });
}

// Convert tests
async function testConvertNoDatetime() {
  console.log('Test: Convert - no datetime');
  const result = await runScript(CONVERT_PATH, []);
  assert(result.stderr.includes('Usage'));
  console.log('✓ Passed');
}

async function testConvertNoTargetTimezone() {
  console.log('Test: Convert - no target timezone');
  const result = await runScript(CONVERT_PATH, ['2024-01-15T10:00:00Z']);
  assert(result.stderr.includes('Usage') || result.stderr.includes('--to'));
  console.log('✓ Passed');
}

async function testConvertValidTimezone() {
  console.log('Test: Convert valid timezone');
  const result = await runScript(CONVERT_PATH, [
    '2024-01-15T10:00:00Z',
    '--to', 'America/New_York'
  ]);

  assert.equal(result.code, 0);
  const output = JSON.parse(result.stdout);
  assert(output.result);
  assert(output.iso);
  console.log('✓ Passed');
}

async function testConvertWithFromTimezone() {
  console.log('Test: Convert with from timezone');
  const result = await runScript(CONVERT_PATH, [
    '2024-01-15 10:00',
    '--from', 'UTC',
    '--to', 'Europe/London'
  ]);

  assert.equal(result.code, 0);
  const output = JSON.parse(result.stdout);
  assert(output.from);
  assert(output.to);
  console.log('✓ Passed');
}

async function testConvertInvalidDate() {
  console.log('Test: Convert invalid date');
  const result = await runScript(CONVERT_PATH, [
    'invalid date',
    '--to', 'UTC'
  ]);

  assert.equal(result.code, 1);
  assert(result.stderr.includes('Invalid') || result.stderr.includes('Error'));
  console.log('✓ Passed');
}

// Duration tests
async function testDurationNoDates() {
  console.log('Test: Duration - no dates');
  const result = await runScript(DURATION_PATH, []);
  assert(result.stderr.includes('Usage'));
  console.log('✓ Passed');
}

async function testDurationOnlyOneDate() {
  console.log('Test: Duration - only one date');
  const result = await runScript(DURATION_PATH, ['2024-01-01']);
  assert(result.stderr.includes('Usage') || result.code === 1);
  console.log('✓ Passed');
}

async function testDurationValidDates() {
  console.log('Test: Duration valid dates');
  const result = await runScript(DURATION_PATH, [
    '2024-01-01',
    '2024-01-02'
  ]);

  assert.equal(result.code, 0);
  const output = JSON.parse(result.stdout);
  assert(output.duration);
  assert(output.duration.human);
  assert.equal(output.duration.days, 1);
  console.log('✓ Passed');
}

async function testDurationNegative() {
  console.log('Test: Duration negative (past)');
  const result = await runScript(DURATION_PATH, [
    '2024-01-02',
    '2024-01-01'
  ]);

  assert.equal(result.code, 0);
  const output = JSON.parse(result.stdout);
  assert.equal(output.direction, 'past');
  assert.equal(output.duration.days, -1);
  console.log('✓ Passed');
}

async function testDurationWithUnit() {
  console.log('Test: Duration with unit');
  const result = await runScript(DURATION_PATH, [
    '2024-01-01T10:00:00Z',
    '2024-01-01T14:30:00Z',
    '--unit', 'hours'
  ]);

  assert.equal(result.code, 0);
  const output = JSON.parse(result.stdout);
  assert(output.duration.human.includes('hours'));
  console.log('✓ Passed');
}

async function testDurationMinutes() {
  console.log('Test: Duration minutes');
  const result = await runScript(DURATION_PATH, [
    '2024-01-01T10:00:00Z',
    '2024-01-01T10:30:00Z',
    '--unit', 'minutes'
  ]);

  assert.equal(result.code, 0);
  const output = JSON.parse(result.stdout);
  assert(output.duration.minutes === 30);
  console.log('✓ Passed');
}

async function testDurationSeconds() {
  console.log('Test: Duration seconds');
  const result = await runScript(DURATION_PATH, [
    '2024-01-01T10:00:00Z',
    '2024-01-01T10:00:30Z',
    '--unit', 'seconds'
  ]);

  assert.equal(result.code, 0);
  const output = JSON.parse(result.stdout);
  assert(output.duration.seconds === 30);
  console.log('✓ Passed');
}

async function testDurationAutoFormat() {
  console.log('Test: Duration auto format');
  const result = await runScript(DURATION_PATH, [
    '2024-01-01',
    '2024-12-31',
    '--unit', 'auto'
  ]);

  assert.equal(result.code, 0);
  const output = JSON.parse(result.stdout);
  assert(output.duration.human.includes('days'));
  console.log('✓ Passed');
}

async function testDurationInvalidDate() {
  console.log('Test: Duration invalid date');
  const result = await runScript(DURATION_PATH, [
    'invalid',
    '2024-01-01'
  ]);

  assert.equal(result.code, 1);
  assert(result.stderr.includes('Invalid') || result.stderr.includes('Error'));
  console.log('✓ Passed');
}

async function runTests() {
  console.log('Running datetime tests...\n');
  try {
    await testConvertNoDatetime();
    await testConvertNoTargetTimezone();
    await testConvertValidTimezone();
    await testConvertWithFromTimezone();
    await testConvertInvalidDate();
    await testDurationNoDates();
    await testDurationOnlyOneDate();
    await testDurationValidDates();
    await testDurationNegative();
    await testDurationWithUnit();
    await testDurationMinutes();
    await testDurationSeconds();
    await testDurationAutoFormat();
    await testDurationInvalidDate();
    console.log('\n✓ All datetime tests passed!');
    process.exit(0);
  } catch (err) {
    console.error('\n✗ Test failed:', err.message);
    console.error(err.stack);
    process.exit(1);
  }
}

runTests();