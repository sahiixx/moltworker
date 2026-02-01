#!/usr/bin/env node
const { strict: assert } = require('assert');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

const SCRIPT_PATH = path.join(__dirname, '../../skills/data-transform/scripts/convert.cjs');

function runScript(args) {
  return new Promise((resolve) => {
    const proc = spawn('node', [SCRIPT_PATH, ...args]);
    let stdout = '', stderr = '';
    proc.stdout.on('data', (d) => stdout += d);
    proc.stderr.on('data', (d) => stderr += d);
    proc.on('close', (code) => resolve({ code, stdout, stderr }));
  });
}

async function testNoInput() {
  console.log('Test: No input');
  const result = await runScript([]);
  assert(result.stderr.includes('Usage'));
  console.log('✓ Passed');
}

async function testNoTargetFormat() {
  console.log('Test: No target format');
  const result = await runScript(['{"test":1}']);
  assert(result.stderr.includes('Usage') || result.stderr.includes('--to'));
  console.log('✓ Passed');
}

async function testJSONtoCSV() {
  console.log('Test: JSON to CSV');
  const tempFile = path.join(os.tmpdir(), `test-${Date.now()}.cjson`);
  fs.writeFileSync(tempFile, JSON.stringify([
    {name: 'Alice', age: 30},
    {name: 'Bob', age: 25}
  ]));

  const result = await runScript([tempFile, '--to', 'csv']);
  fs.unlinkSync(tempFile);

  assert.equal(result.code, 0);
  assert(result.stdout.includes('name,age'));
  assert(result.stdout.includes('Alice'));
  console.log('✓ Passed');
}

async function testJSONtoMarkdown() {
  console.log('Test: JSON to Markdown');
  const data = JSON.stringify([{col1: 'A', col2: 'B'}]);
  const result = await runScript([data, '--to', 'markdown']);

  assert.equal(result.code, 0);
  assert(result.stdout.includes('|'));
  assert(result.stdout.includes('col1'));
  console.log('✓ Passed');
}

async function testCSVtoJSON() {
  console.log('Test: CSV to JSON');
  const tempFile = path.join(os.tmpdir(), `test-${Date.now()}.csv`);
  fs.writeFileSync(tempFile, 'name,age\nAlice,30\nBob,25');

  const result = await runScript([tempFile, '--to', 'json']);
  fs.unlinkSync(tempFile);

  assert.equal(result.code, 0);
  const output = JSON.parse(result.stdout);
  assert.equal(output[0].name, 'Alice');
  console.log('✓ Passed');
}

async function testJSONtoXML() {
  console.log('Test: JSON to XML');
  const data = JSON.stringify([{name: 'Test', value: 123}]);
  const result = await runScript([data, '--to', 'xml']);

  assert.equal(result.code, 0);
  assert(result.stdout.includes('<?xml'));
  assert(result.stdout.includes('<name>Test</name>'));
  console.log('✓ Passed');
}

async function testJSONtoYAML() {
  console.log('Test: JSON to YAML');
  const data = JSON.stringify({key: 'value', number: 42});
  const result = await runScript([data, '--to', 'yaml']);

  assert.equal(result.code, 0);
  assert(result.stdout.includes('key: value'));
  console.log('✓ Passed');
}

async function testPrettyJSON() {
  console.log('Test: Pretty JSON');
  const data = '{"a":1,"b":2}';
  const result = await runScript([data, '--to', 'json', '--pretty']);

  assert.equal(result.code, 0);
  assert(result.stdout.includes('\n'));
  console.log('✓ Passed');
}

async function testInvalidJSON() {
  console.log('Test: Invalid JSON');
  const result = await runScript(['{invalid json', '--to', 'csv']);
  assert.equal(result.code, 1);
  console.log('✓ Passed');
}

async function runTests() {
  console.log('Running convert.cjs tests...\n');
  try {
    await testNoInput();
    await testNoTargetFormat();
    await testJSONtoCSV();
    await testJSONtoMarkdown();
    await testCSVtoJSON();
    await testJSONtoXML();
    await testJSONtoYAML();
    await testPrettyJSON();
    await testInvalidJSON();
    console.log('\n✓ All convert.cjs tests passed!');
    process.exit(0);
  } catch (err) {
    console.error('\n✗ Test failed:', err.message);
    console.error(err.stack);
    process.exit(1);
  }
}

runTests();