# Skills Test Suite

Comprehensive unit tests for all skill scripts in the moltbot-sandbox project.

## Test Structure

Tests are organized by skill category:

```
tests/
├── ai-tools/
│   ├── embeddings.test.cjs
│   ├── extract.test.cjs
│   ├── sentiment.test.cjs
│   ├── summarize.test.cjs
│   └── vision.test.cjs
├── code-runner/
│   ├── benchmark.test.cjs
│   ├── eval.test.cjs
│   └── run.test.cjs
├── crypto/
│   ├── encrypt-decrypt.test.cjs
│   ├── hash.test.cjs
│   └── keygen-random.test.cjs
├── data-transform/
│   ├── convert.test.cjs
│   └── query-transform-diff.test.cjs
├── datetime/
│   └── convert-duration.test.cjs
└── run-all.cjs (master test runner)
```

## Running Tests

### Run All Tests

```bash
node tests/run-all.cjs
```

### Run Individual Test Suite

```bash
node tests/ai-tools/embeddings.test.cjs
node tests/crypto/hash.test.cjs
node tests/datetime/convert-duration.test.cjs
# etc.
```

## Test Coverage

### AI Tools (5 test files)
- **embeddings.test.cjs**: 10 tests covering embedding generation with various models, dimensions, output formats
- **extract.test.cjs**: 11 tests for structured data extraction with schema validation
- **sentiment.test.cjs**: 11 tests for sentiment analysis with different text types
- **summarize.test.cjs**: 11 tests for text summarization with styles and file input
- **vision.test.cjs**: 11 tests for image analysis with local/remote images

### Code Runner (3 test files)
- **run.test.cjs**: 12 tests for code execution in multiple languages (JS, Python, Shell)
- **eval.test.cjs**: 12 tests for JavaScript expression evaluation
- **benchmark.test.cjs**: 9 tests for code benchmarking with statistics

### Crypto (3 test files)
- **hash.test.cjs**: 11 tests for hashing algorithms (SHA256/384/512), HMAC, encodings
- **encrypt-decrypt.test.cjs**: 7 tests for AES-256-GCM encryption/decryption round-trip
- **keygen-random.test.cjs**: 13 tests for key generation (AES, RSA, ECDSA, Ed25519) and secure random

### Data Transform (2 test files)
- **convert.test.cjs**: 9 tests for format conversion (JSON, CSV, YAML, XML, Markdown)
- **query-transform-diff.test.cjs**: 14 tests for JSONPath queries, transformations, and diffs

### DateTime (1 test file)
- **convert-duration.test.cjs**: 14 tests for timezone conversion and duration calculation

## Total Test Count

**14 test files** with **154+ individual test cases**

## Test Patterns

All tests follow these patterns:

1. **Argument validation**: Test missing/invalid arguments
2. **Happy path**: Test successful execution with valid inputs
3. **Error handling**: Test error conditions and edge cases
4. **Parameter variations**: Test all command-line options
5. **File I/O**: Test file input/output where applicable
6. **Format variations**: Test different data formats and encodings
7. **Boundary conditions**: Test limits, empty inputs, extremes
8. **Integration**: Test round-trip operations (encrypt/decrypt, convert/parse)

## Notes

- All scripts use CommonJS modules (.cjs extension) due to package.json "type": "module"
- Tests use Node.js native test patterns with `assert` for compatibility
- Tests mock external API calls by testing with invalid keys (expected to fail gracefully)
- Test runner provides colored output and summary statistics