#!/usr/bin/env node
const { strict: assert } = require('assert');
const { spawn } = require('child_process');
const path = require('path');

const ENCRYPT_PATH = path.join(__dirname, '../../skills/crypto/scripts/encrypt.cjs');
const DECRYPT_PATH = path.join(__dirname, '../../skills/crypto/scripts/decrypt.cjs');

function runScript(scriptPath, args) {
  return new Promise((resolve) => {
    const proc = spawn('node', [scriptPath, ...args]);
    let stdout = '', stderr = '';
    proc.stdout.on('data', (d) => stdout += d);
    proc.stderr.on('data', (d) => stderr += d);
    proc.on('close', (code) => resolve({ code, stdout, stderr }));
  });
}

async function testEncryptNoData() {
  console.log('Test: Encrypt - no data');
  const result = await runScript(ENCRYPT_PATH, []);
  assert(result.stderr.includes('Usage'));
  console.log('✓ Passed');
}

async function testEncryptNoPassword() {
  console.log('Test: Encrypt - no password/key');
  const result = await runScript(ENCRYPT_PATH, ['data']);
  assert(result.stderr.includes('Usage'));
  console.log('✓ Passed');
}

async function testEncryptWithPassword() {
  console.log('Test: Encrypt with password');
  const result = await runScript(ENCRYPT_PATH, ['secret data', '--password', 'testpass']);
  assert.equal(result.code, 0);
  const output = JSON.parse(result.stdout);
  assert.equal(output.algorithm, 'aes-256-gcm');
  assert(output.iv);
  assert(output.salt);
  assert(output.tag);
  assert(output.ciphertext);
  console.log('✓ Passed');
}

async function testEncryptDecryptRoundTrip() {
  console.log('Test: Encrypt-decrypt round trip');
  const plaintext = 'secret message to encrypt';

  const encResult = await runScript(ENCRYPT_PATH, [plaintext, '--password', 'mypass']);
  assert.equal(encResult.code, 0);
  const encrypted = JSON.parse(encResult.stdout);

  const decResult = await runScript(DECRYPT_PATH, [JSON.stringify(encrypted), '--password', 'mypass']);
  assert.equal(decResult.code, 0);
  const decrypted = JSON.parse(decResult.stdout);

  assert.equal(decrypted.plaintext, plaintext);
  console.log('✓ Passed');
}

async function testDecryptWrongPassword() {
  console.log('Test: Decrypt with wrong password');
  const encResult = await runScript(ENCRYPT_PATH, ['data', '--password', 'correct']);
  const encrypted = JSON.parse(encResult.stdout);

  const decResult = await runScript(DECRYPT_PATH, [JSON.stringify(encrypted), '--password', 'wrong']);
  assert.equal(decResult.code, 1);
  assert(decResult.stderr.includes('Decryption failed') || decResult.stderr.includes('error'));
  console.log('✓ Passed');
}

async function testDecryptNoPassword() {
  console.log('Test: Decrypt - no password');
  const result = await runScript(DECRYPT_PATH, ['{"iv":"test"}']);
  assert(result.stderr.includes('Usage') || result.code === 1);
  console.log('✓ Passed');
}

async function testDecryptInvalidJSON() {
  console.log('Test: Decrypt - invalid JSON');
  const result = await runScript(DECRYPT_PATH, ['invalid json', '--password', 'test']);
  assert.equal(result.code, 1);
  console.log('✓ Passed');
}

async function runTests() {
  console.log('Running encrypt/decrypt tests...\n');
  try {
    await testEncryptNoData();
    await testEncryptNoPassword();
    await testEncryptWithPassword();
    await testEncryptDecryptRoundTrip();
    await testDecryptWrongPassword();
    await testDecryptNoPassword();
    await testDecryptInvalidJSON();
    console.log('\n✓ All encrypt/decrypt tests passed!');
    process.exit(0);
  } catch (err) {
    console.error('\n✗ Test failed:', err.message);
    console.error(err.stack);
    process.exit(1);
  }
}

runTests();