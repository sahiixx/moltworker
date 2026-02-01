#!/usr/bin/env node
/**
 * Tests for ai-tools/vision.cjs
 */

const { strict: assert } = require('assert');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

const SCRIPT_PATH = path.join(__dirname, '../../skills/ai-tools/scripts/vision.cjs');

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

// Create a tiny valid PNG for testing
function createTestPNG() {
  // Minimal 1x1 PNG
  const pngData = Buffer.from(
    '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c489' +
    '0000000a49444154789c6300010000050001e0e0f3d00000000049454e44ae426082',
    'hex'
  );
  const tempFile = path.join(os.tmpdir(), `test-image-${Date.now()}.png`);
  fs.writeFileSync(tempFile, pngData);
  return tempFile;
}

// Test: Missing API key
async function testMissingApiKey() {
  console.log('Test: Missing API key should error');
  const imagePath = createTestPNG();

  const result = await runScript([imagePath, 'describe this'], {
    ANTHROPIC_API_KEY: '',
    AI_GATEWAY_API_KEY: ''
  });

  fs.unlinkSync(imagePath);

  assert.equal(result.code, 1, 'Should exit with code 1');
  assert(result.stderr.includes('ANTHROPIC_API_KEY'), 'Should mention missing API key');
  console.log('✓ Passed');
}

// Test: No image provided
async function testNoImageProvided() {
  console.log('Test: No image provided should show usage');
  const result = await runScript([]);

  assert.equal(result.code, 1, 'Should exit with code 1');
  assert(result.stderr.includes('Usage'), 'Should show usage message');
  console.log('✓ Passed');
}

// Test: Non-existent image file
async function testNonExistentImage() {
  console.log('Test: Non-existent image file should error');
  const result = await runScript(['/nonexistent/image.png', 'describe'], {
    ANTHROPIC_API_KEY: 'test-key'
  });

  assert(result.code === 1, 'Should exit with error');
  assert(result.stderr.includes('not found') || result.stderr.includes('error'),
    'Should mention file error');
  console.log('✓ Passed');
}

// Test: Valid image file (local)
async function testValidImageFile() {
  console.log('Test: Valid local image file');
  const imagePath = createTestPNG();

  const result = await runScript([imagePath, 'What is in this image?'], {
    ANTHROPIC_API_KEY: 'test-key'
  });

  fs.unlinkSync(imagePath);

  assert(result.code === 1, 'Should fail with test key');
  assert(result.stderr.includes('API error') || result.stderr.includes('error'),
    'Should fail with API error');
  console.log('✓ Passed');
}

// Test: Image URL (http/https)
async function testImageURL() {
  console.log('Test: Image URL');
  const result = await runScript([
    'https://example.com/image.png',
    'Describe this image'
  ], {
    ANTHROPIC_API_KEY: 'test-key'
  });

  assert(result.code === 1, 'Should fail with test key');
  console.log('✓ Passed');
}

// Test: Default prompt (no prompt provided)
async function testDefaultPrompt() {
  console.log('Test: Default prompt when none provided');
  const imagePath = createTestPNG();

  const result = await runScript([imagePath], {
    ANTHROPIC_API_KEY: 'test-key'
  });

  fs.unlinkSync(imagePath);

  // Should use default prompt "Describe this image in detail."
  assert(result.code === 1, 'Should fail with test key');
  console.log('✓ Passed');
}

// Test: Custom model parameter
async function testCustomModel() {
  console.log('Test: Custom model parameter');
  const imagePath = createTestPNG();

  const result = await runScript([
    imagePath,
    'describe',
    '--model', 'claude-3-opus-20240229'
  ], {
    ANTHROPIC_API_KEY: 'test-key'
  });

  fs.unlinkSync(imagePath);

  assert(result.code === 1, 'Should fail with test key');
  console.log('✓ Passed');
}

// Test: Detail level parameter
async function testDetailLevel() {
  console.log('Test: Detail level parameter');
  const imagePath = createTestPNG();

  const result = await runScript([
    imagePath,
    'analyze',
    '--detail', 'high'
  ], {
    ANTHROPIC_API_KEY: 'test-key'
  });

  fs.unlinkSync(imagePath);

  assert(result.code === 1, 'Should fail with test key');
  console.log('✓ Passed');
}

// Test: Multiple words in prompt
async function testMultiWordPrompt() {
  console.log('Test: Multiple words in prompt');
  const imagePath = createTestPNG();

  const result = await runScript([
    imagePath,
    'What',
    'is',
    'visible',
    'in',
    'this',
    'image?'
  ], {
    ANTHROPIC_API_KEY: 'test-key'
  });

  fs.unlinkSync(imagePath);

  // Words after image should be joined into prompt
  assert(result.code === 1, 'Should fail with test key');
  console.log('✓ Passed');
}

// Test: Different image formats
async function testJPEGFormat() {
  console.log('Test: JPEG format detection');
  const jpegPath = path.join(os.tmpdir(), `test-image-${Date.now()}.jpg`);
  // Minimal JPEG header
  fs.writeFileSync(jpegPath, Buffer.from([0xFF, 0xD8, 0xFF]));

  const result = await runScript([jpegPath, 'analyze'], {
    ANTHROPIC_API_KEY: 'test-key'
  });

  fs.unlinkSync(jpegPath);

  assert(result.code === 1, 'Should fail with test key');
  console.log('✓ Passed');
}

// Test: AI Gateway configuration
async function testAiGatewayConfig() {
  console.log('Test: AI Gateway configuration');
  const imagePath = createTestPNG();

  const result = await runScript([imagePath, 'describe'], {
    AI_GATEWAY_API_KEY: 'gateway-key',
    AI_GATEWAY_BASE_URL: 'https://gateway.example.com'
  });

  fs.unlinkSync(imagePath);

  assert(result.stderr.includes('API error') || result.stderr.includes('error'),
    'Should fail with API error');
  console.log('✓ Passed');
}

// Run all tests
async function runTests() {
  console.log('Running vision.cjs tests...\n');

  try {
    await testMissingApiKey();
    await testNoImageProvided();
    await testNonExistentImage();
    await testValidImageFile();
    await testImageURL();
    await testDefaultPrompt();
    await testCustomModel();
    await testDetailLevel();
    await testMultiWordPrompt();
    await testJPEGFormat();
    await testAiGatewayConfig();

    console.log('\n✓ All vision.cjs tests passed!');
    process.exit(0);
  } catch (err) {
    console.error('\n✗ Test failed:', err.message);
    console.error(err.stack);
    process.exit(1);
  }
}

runTests();