#!/usr/bin/env node
const { strict: assert } = require('assert');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

const QUERY_PATH = path.join(__dirname, '../../skills/data-transform/scripts/query.cjs');
const TRANSFORM_PATH = path.join(__dirname, '../../skills/data-transform/scripts/transform.cjs');
const DIFF_PATH = path.join(__dirname, '../../skills/data-transform/scripts/diff.cjs');

function runScript(scriptPath, args) {
  return new Promise((resolve) => {
    const proc = spawn('node', [scriptPath, ...args]);
    let stdout = '', stderr = '';
    proc.stdout.on('data', (d) => stdout += d);
    proc.stderr.on('data', (d) => stderr += d);
    proc.on('close', (code) => resolve({ code, stdout, stderr }));
  });
}

// Query tests
async function testQueryBasicPath() {
  console.log('Test: Query basic path');
  const data = JSON.stringify({users: [{name: 'Alice'}, {name: 'Bob'}]});
  const result = await runScript(QUERY_PATH, [data, '$.users[0].name']);

  assert.equal(result.code, 0);
  const output = JSON.parse(result.stdout);
  assert.deepEqual(output.results, ['Alice']);
  console.log('✓ Passed');
}

async function testQueryWildcard() {
  console.log('Test: Query wildcard');
  const data = JSON.stringify({users: [{name: 'Alice'}, {name: 'Bob'}]});
  const result = await runScript(QUERY_PATH, [data, '$.users[*].name']);

  assert.equal(result.code, 0);
  const output = JSON.parse(result.stdout);
  assert.deepEqual(output.results, ['Alice', 'Bob']);
  console.log('✓ Passed');
}

async function testQueryFilter() {
  console.log('Test: Query filter');
  const data = JSON.stringify({items: [{id: 1, active: true}, {id: 2, active: false}]});
  const result = await runScript(QUERY_PATH, [data, '$.items[?(@.active==true)].id']);

  assert.equal(result.code, 0);
  const output = JSON.parse(result.stdout);
  assert.deepEqual(output.results, [1]);
  console.log('✓ Passed');
}

async function testQueryNoInput() {
  console.log('Test: Query no input');
  const result = await runScript(QUERY_PATH, []);
  assert(result.stderr.includes('Usage'));
  console.log('✓ Passed');
}

// Transform tests
async function testTransformMap() {
  console.log('Test: Transform map');
  const data = JSON.stringify([{x: 1}, {x: 2}]);
  const result = await runScript(TRANSFORM_PATH, [data, '--map', '{y: x.x * 2}']);

  assert.equal(result.code, 0);
  const output = JSON.parse(result.stdout);
  assert.equal(output[0].y, 2);
  assert.equal(output[1].y, 4);
  console.log('✓ Passed');
}

async function testTransformFilter() {
  console.log('Test: Transform filter');
  const data = JSON.stringify([{age: 10}, {age: 20}, {age: 30}]);
  const result = await runScript(TRANSFORM_PATH, [data, '--filter', 'x.age >= 20']);

  assert.equal(result.code, 0);
  const output = JSON.parse(result.stdout);
  assert.equal(output.length, 2);
  console.log('✓ Passed');
}

async function testTransformSort() {
  console.log('Test: Transform sort');
  const data = JSON.stringify([{val: 3}, {val: 1}, {val: 2}]);
  const result = await runScript(TRANSFORM_PATH, [data, '--sort', 'val']);

  assert.equal(result.code, 0);
  const output = JSON.parse(result.stdout);
  assert.equal(output[0].val, 1);
  assert.equal(output[2].val, 3);
  console.log('✓ Passed');
}

async function testTransformReverse() {
  console.log('Test: Transform reverse');
  const data = JSON.stringify([{n: 1}, {n: 2}]);
  const result = await runScript(TRANSFORM_PATH, [data, '--reverse']);

  assert.equal(result.code, 0);
  const output = JSON.parse(result.stdout);
  assert.equal(output[0].n, 2);
  console.log('✓ Passed');
}

async function testTransformLimit() {
  console.log('Test: Transform limit');
  const data = JSON.stringify([{n: 1}, {n: 2}, {n: 3}]);
  const result = await runScript(TRANSFORM_PATH, [data, '--limit', '2']);

  assert.equal(result.code, 0);
  const output = JSON.parse(result.stdout);
  assert.equal(output.length, 2);
  console.log('✓ Passed');
}

// Diff tests
async function testDiffIdenticalFiles() {
  console.log('Test: Diff identical data');
  const data = '{"a":1,"b":2}';
  const result = await runScript(DIFF_PATH, [data, data]);

  assert.equal(result.code, 0);
  const output = JSON.parse(result.stdout);
  assert.equal(output.identical, true);
  console.log('✓ Passed');
}

async function testDiffAddedField() {
  console.log('Test: Diff added field');
  const data1 = '{"a":1}';
  const data2 = '{"a":1,"b":2}';
  const result = await runScript(DIFF_PATH, [data1, data2]);

  assert.equal(result.code, 1);
  const output = JSON.parse(result.stdout);
  assert.equal(output.summary.added, 1);
  console.log('✓ Passed');
}

async function testDiffRemovedField() {
  console.log('Test: Diff removed field');
  const data1 = '{"a":1,"b":2}';
  const data2 = '{"a":1}';
  const result = await runScript(DIFF_PATH, [data1, data2]);

  assert.equal(result.code, 1);
  const output = JSON.parse(result.stdout);
  assert.equal(output.summary.removed, 1);
  console.log('✓ Passed');
}

async function testDiffChangedValue() {
  console.log('Test: Diff changed value');
  const data1 = '{"a":1}';
  const data2 = '{"a":2}';
  const result = await runScript(DIFF_PATH, [data1, data2]);

  assert.equal(result.code, 1);
  const output = JSON.parse(result.stdout);
  assert.equal(output.summary.changed, 1);
  console.log('✓ Passed');
}

async function testDiffUnifiedFormat() {
  console.log('Test: Diff unified format');
  const data1 = '{"a":1}';
  const data2 = '{"a":2}';
  const result = await runScript(DIFF_PATH, [data1, data2, '--format', 'unified']);

  assert.equal(result.code, 1);
  assert(result.stdout.includes('-') || result.stdout.includes('+'));
  console.log('✓ Passed');
}

async function runTests() {
  console.log('Running query/transform/diff tests...\n');
  try {
    await testQueryBasicPath();
    await testQueryWildcard();
    await testQueryFilter();
    await testQueryNoInput();
    await testTransformMap();
    await testTransformFilter();
    await testTransformSort();
    await testTransformReverse();
    await testTransformLimit();
    await testDiffIdenticalFiles();
    await testDiffAddedField();
    await testDiffRemovedField();
    await testDiffChangedValue();
    await testDiffUnifiedFormat();
    console.log('\n✓ All query/transform/diff tests passed!');
    process.exit(0);
  } catch (err) {
    console.error('\n✗ Test failed:', err.message);
    console.error(err.stack);
    process.exit(1);
  }
}

runTests();