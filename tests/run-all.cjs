#!/usr/bin/env node
/**
 * Master test runner for all skill tests
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Find all test files
function findTestFiles(dir) {
  const files = [];

  function walk(directory) {
    const items = fs.readdirSync(directory);
    for (const item of items) {
      const fullPath = path.join(directory, item);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        walk(fullPath);
      } else if (item.endsWith('.test.cjs')) {
        files.push(fullPath);
      }
    }
  }

  walk(dir);
  return files;
}

function runTest(testFile) {
  return new Promise((resolve) => {
    console.log(`\n${'='.repeat(70)}`);
    console.log(`Running: ${path.relative(__dirname, testFile)}`);
    console.log('='.repeat(70));

    const proc = spawn('node', [testFile], {
      stdio: 'inherit',
      timeout: 60000
    });

    proc.on('close', (code) => {
      resolve({ file: testFile, code });
    });

    proc.on('error', (err) => {
      console.error(`Failed to start test: ${err.message}`);
      resolve({ file: testFile, code: 1, error: err.message });
    });
  });
}

async function runAllTests() {
  const testsDir = __dirname;
  const testFiles = findTestFiles(testsDir);

  console.log(`Found ${testFiles.length} test files\n`);

  const results = [];

  for (const testFile of testFiles) {
    const result = await runTest(testFile);
    results.push(result);
  }

  // Summary
  console.log('\n' + '='.repeat(70));
  console.log('TEST SUMMARY');
  console.log('='.repeat(70));

  const passed = results.filter(r => r.code === 0);
  const failed = results.filter(r => r.code !== 0);

  console.log(`\nTotal: ${results.length}`);
  console.log(`Passed: ${passed.length} ✓`);
  console.log(`Failed: ${failed.length} ✗`);

  if (failed.length > 0) {
    console.log('\nFailed tests:');
    failed.forEach(r => {
      console.log(`  ✗ ${path.relative(testsDir, r.file)}`);
    });
  }

  process.exit(failed.length > 0 ? 1 : 0);
}

runAllTests().catch(err => {
  console.error('Test runner error:', err);
  process.exit(1);
});