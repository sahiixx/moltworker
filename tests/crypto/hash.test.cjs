#!/usr/bin/env node
const { strict: assert } = require('assert');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

const SCRIPT_PATH = path.join(__dirname, '../../skills/crypto/scripts/hash.cjs');

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

async function testNoData() {
  console.log('Test: No data provided');
  const result = await runScript([]);
  assert(result.stderr.includes('Usage'));
  console.log('✓ Passed');
}

async function testDefaultSHA256() {
  console.log('Test: Default SHA256 hash');
  const result = await runScript(['test data']);
  assert.equal(result.code, 0);
  const output = JSON.parse(result.stdout);
  assert.equal(output.algorithm, 'sha256');
  assert(output.hash.length === 64); // SHA256 hex is 64 chars
  console.log('✓ Passed');
}

async function testSHA384() {
  console.log('Test: SHA384 hash');
  const result = await runScript(['test', '--algorithm', 'sha384']);
  assert.equal(result.code, 0);
  const output = JSON.parse(result.stdout);
  assert.equal(output.algorithm, 'sha384');
  assert(output.hash.length === 96);
  console.log('✓ Passed');
}

async function testSHA512() {
  console.log('Test: SHA512 hash');
  const result = await runScript(['test', '--algorithm', 'sha512']);
  assert.equal(result.code, 0);
  const output = JSON.parse(result.stdout);
  assert.equal(output.algorithm, 'sha512');
  assert(output.hash.length === 128);
  console.log('✓ Passed');
}

async function testBase64Encoding() {
  console.log('Test: Base64 encoding');
  const result = await runScript(['test', '--encoding', 'base64']);
  assert.equal(result.code, 0);
  const output = JSON.parse(result.stdout);
  assert.equal(output.encoding, 'base64');
  console.log('✓ Passed');
}

async function testBase64URLEncoding() {
  console.log('Test: Base64URL encoding');
  const result = await runScript(['test', '--encoding', 'base64url']);
  assert.equal(result.code, 0);
  const output = JSON.parse(result.stdout);
  assert.equal(output.encoding, 'base64url');
  console.log('✓ Passed');
}

async function testFileInput() {
  console.log('Test: File input');
  const tempFile = path.join(os.tmpdir(), `test-${Date.now()}.txt`);
  fs.writeFileSync(tempFile, 'file content');

  const result = await runScript([tempFile, '--file']);
  fs.unlinkSync(tempFile);

  assert.equal(result.code, 0);
  const output = JSON.parse(result.stdout);
  assert(output.file);
  console.log('✓ Passed');
}

async function testNonExistentFile() {
  console.log('Test: Non-existent file');
  const result = await runScript(['/nonexistent/file.txt', '--file']);
  assert(result.stderr.includes('not found') || result.stderr.includes('error'));
  console.log('✓ Passed');
}

async function testHMAC() {
  console.log('Test: HMAC');
  const result = await runScript(['data', '--hmac', 'secret-key']);
  assert.equal(result.code, 0);
  const output = JSON.parse(result.stdout);
  assert.equal(output.type, 'hmac');
  console.log('✓ Passed');
}

async function testEmptyString() {
  console.log('Test: Empty string');
  const result = await runScript(['']);
  assert(result.code === 1);
  console.log('✓ Passed');
}

async function testConsistentHashing() {
  console.log('Test: Consistent hashing');
  const result1 = await runScript(['consistent data']);
  const result2 = await runScript(['consistent data']);

  const output1 = JSON.parse(result1.stdout);
  const output2 = JSON.parse(result2.stdout);

  assert.equal(output1.hash, output2.hash);
  console.log('✓ Passed');
}

async function runTests() {
  console.log('Running hash.cjs tests...\n');
  try {
    await testNoData();
    await testDefaultSHA256();
    await testSHA384();
    await testSHA512();
    await testBase64Encoding();
    await testBase64URLEncoding();
    await testFileInput();
    await testNonExistentFile();
    await testHMAC();
    await testEmptyString();
    await testConsistentHashing();
    console.log('\n✓ All hash.cjs tests passed!');
    process.exit(0);
  } catch (err) {
    console.error('\n✗ Test failed:', err.message);
    console.error(err.stack);
    process.exit(1);
  }
}

runTests();