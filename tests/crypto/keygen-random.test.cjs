#!/usr/bin/env node
const { strict: assert } = require('assert');
const { spawn } = require('child_process');
const path = require('path');

const KEYGEN_PATH = path.join(__dirname, '../../skills/crypto/scripts/keygen.cjs');
const RANDOM_PATH = path.join(__dirname, '../../skills/crypto/scripts/random.cjs');

function runScript(scriptPath, args) {
  return new Promise((resolve) => {
    const proc = spawn('node', [scriptPath, ...args]);
    let stdout = '', stderr = '';
    proc.stdout.on('data', (d) => stdout += d);
    proc.stderr.on('data', (d) => stderr += d);
    proc.on('close', (code) => resolve({ code, stdout, stderr }));
  });
}

// Keygen tests
async function testKeygenAES() {
  console.log('Test: Keygen AES');
  const result = await runScript(KEYGEN_PATH, ['aes']);
  assert.equal(result.code, 0);
  const output = JSON.parse(result.stdout);
  assert.equal(output.type, 'aes');
  assert(output.key);
  console.log('✓ Passed');
}

async function testKeygenRSA() {
  console.log('Test: Keygen RSA (may take a moment)');
  const result = await runScript(KEYGEN_PATH, ['rsa', '--bits', '2048']);
  assert.equal(result.code, 0);
  const output = JSON.parse(result.stdout);
  assert.equal(output.type, 'rsa');
  assert(output.publicKey);
  assert(output.privateKey);
  console.log('✓ Passed');
}

async function testKeygenECDSA() {
  console.log('Test: Keygen ECDSA');
  const result = await runScript(KEYGEN_PATH, ['ecdsa']);
  assert.equal(result.code, 0);
  const output = JSON.parse(result.stdout);
  assert.equal(output.type, 'ecdsa');
  assert(output.publicKey);
  assert(output.privateKey);
  console.log('✓ Passed');
}

async function testKeygenEd25519() {
  console.log('Test: Keygen Ed25519');
  const result = await runScript(KEYGEN_PATH, ['ed25519']);
  assert.equal(result.code, 0);
  const output = JSON.parse(result.stdout);
  assert.equal(output.type, 'ed25519');
  console.log('✓ Passed');
}

async function testKeygenPassword() {
  console.log('Test: Keygen password hash');
  const result = await runScript(KEYGEN_PATH, ['password', '--password', 'testpass']);
  assert.equal(result.code, 0);
  const output = JSON.parse(result.stdout);
  assert.equal(output.type, 'password');
  assert(output.hash);
  assert(output.salt);
  console.log('✓ Passed');
}

// Random tests
async function testRandomDefault() {
  console.log('Test: Random default (32 bytes hex)');
  const result = await runScript(RANDOM_PATH, []);
  assert.equal(result.code, 0);
  const output = JSON.parse(result.stdout);
  assert.equal(output.bytes, 32);
  assert.equal(output.encoding, 'hex');
  assert.equal(output.values.length, 64); // 32 bytes = 64 hex chars
  console.log('✓ Passed');
}

async function testRandomCustomBytes() {
  console.log('Test: Random custom bytes');
  const result = await runScript(RANDOM_PATH, ['--bytes', '16']);
  assert.equal(result.code, 0);
  const output = JSON.parse(result.stdout);
  assert.equal(output.bytes, 16);
  console.log('✓ Passed');
}

async function testRandomBase64() {
  console.log('Test: Random base64 encoding');
  const result = await runScript(RANDOM_PATH, ['--encoding', 'base64']);
  assert.equal(result.code, 0);
  const output = JSON.parse(result.stdout);
  assert.equal(output.encoding, 'base64');
  console.log('✓ Passed');
}

async function testRandomBase64URL() {
  console.log('Test: Random base64url encoding');
  const result = await runScript(RANDOM_PATH, ['--encoding', 'base64url']);
  assert.equal(result.code, 0);
  const output = JSON.parse(result.stdout);
  assert.equal(output.encoding, 'base64url');
  console.log('✓ Passed');
}

async function testRandomUUID() {
  console.log('Test: Random UUID');
  const result = await runScript(RANDOM_PATH, ['--encoding', 'uuid']);
  assert.equal(result.code, 0);
  const output = JSON.parse(result.stdout);
  assert.equal(output.encoding, 'uuid');
  assert(output.values.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/));
  console.log('✓ Passed');
}

async function testRandomWords() {
  console.log('Test: Random words');
  const result = await runScript(RANDOM_PATH, ['--encoding', 'words']);
  assert.equal(result.code, 0);
  const output = JSON.parse(result.stdout);
  assert.equal(output.encoding, 'words');
  assert(output.values.includes('-'));
  console.log('✓ Passed');
}

async function testRandomMultipleValues() {
  console.log('Test: Random multiple values');
  const result = await runScript(RANDOM_PATH, ['--count', '3']);
  assert.equal(result.code, 0);
  const output = JSON.parse(result.stdout);
  assert.equal(output.count, 3);
  assert(Array.isArray(output.values));
  assert.equal(output.values.length, 3);
  console.log('✓ Passed');
}

async function testRandomUniqueness() {
  console.log('Test: Random values are unique');
  const result = await runScript(RANDOM_PATH, ['--count', '5']);
  const output = JSON.parse(result.stdout);
  const unique = new Set(output.values);
  assert.equal(unique.size, 5);
  console.log('✓ Passed');
}

async function runTests() {
  console.log('Running keygen/random tests...\n');
  try {
    await testKeygenAES();
    await testKeygenRSA();
    await testKeygenECDSA();
    await testKeygenEd25519();
    await testKeygenPassword();
    await testRandomDefault();
    await testRandomCustomBytes();
    await testRandomBase64();
    await testRandomBase64URL();
    await testRandomUUID();
    await testRandomWords();
    await testRandomMultipleValues();
    await testRandomUniqueness();
    console.log('\n✓ All keygen/random tests passed!');
    process.exit(0);
  } catch (err) {
    console.error('\n✗ Test failed:', err.message);
    console.error(err.stack);
    process.exit(1);
  }
}

runTests();