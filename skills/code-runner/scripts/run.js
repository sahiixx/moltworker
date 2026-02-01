#!/usr/bin/env node
/**
 * Code Runner - Execute Code
 * Execute code snippets in various languages
 * Usage: node run.js <code> --lang <language>
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const args = process.argv.slice(2);

/**
 * Parse command-line tokens into execution options for running a code snippet.
 *
 * Parses tokens from the surrounding `args` array and returns an options object
 * with fields controlling code content, language, source file, timeout, stdin,
 * CLI arguments, and environment variables.
 *
 * @returns {{code: string, lang: string|null, file: string|null, timeout: number, stdin: string|null, args: string[], env: Object}} An options object:
 * - `code`: inline code string (if provided).
 * - `lang`: lowercased language identifier or `null`.
 * - `file`: path to a file containing code or `null`.
 * - `timeout`: execution timeout in milliseconds.
 * - `stdin`: data to feed to the program's stdin or `null`.
 * - `args`: array of additional CLI arguments for the executed program.
 * - `env`: object of environment variables to merge with the current environment.
 */
function parseArgs() {
  const result = {
    code: '',
    lang: null,
    file: null,
    timeout: 30000,
    stdin: null,
    args: [],
    env: {}
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--lang' && args[i + 1]) {
      result.lang = args[i + 1].toLowerCase();
      i++;
    } else if (args[i] === '--file' && args[i + 1]) {
      result.file = args[i + 1];
      i++;
    } else if (args[i] === '--timeout' && args[i + 1]) {
      result.timeout = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === '--stdin' && args[i + 1]) {
      result.stdin = args[i + 1];
      i++;
    } else if (args[i] === '--args' && args[i + 1]) {
      result.args = args[i + 1].split(',');
      i++;
    } else if (args[i] === '--env' && args[i + 1]) {
      result.env = JSON.parse(args[i + 1]);
      i++;
    } else if (!args[i].startsWith('--')) {
      result.code = args[i];
    }
  }

  return result;
}

/**
 * Resolve a language identifier to its execution configuration.
 * @param {string} lang - Language identifier such as "js", "javascript", "node", "ts", "typescript", "python", "py", "python3", "bash", "sh", or "shell".
 * @returns {{cmd: string, ext: string, name: string, cmdArgs?: string[]}|null} The execution configuration object for the specified language, or `null` if the language is unsupported.
 */
function getLanguageConfig(lang) {
  const configs = {
    js: { cmd: 'node', ext: '.js', name: 'javascript' },
    javascript: { cmd: 'node', ext: '.js', name: 'javascript' },
    node: { cmd: 'node', ext: '.js', name: 'javascript' },
    ts: { cmd: 'npx', cmdArgs: ['tsx'], ext: '.ts', name: 'typescript' },
    typescript: { cmd: 'npx', cmdArgs: ['tsx'], ext: '.ts', name: 'typescript' },
    python: { cmd: 'python3', ext: '.py', name: 'python' },
    py: { cmd: 'python3', ext: '.py', name: 'python' },
    python3: { cmd: 'python3', ext: '.py', name: 'python' },
    shell: { cmd: '/bin/bash', ext: '.sh', name: 'shell' },
    bash: { cmd: '/bin/bash', ext: '.sh', name: 'shell' },
    sh: { cmd: '/bin/sh', ext: '.sh', name: 'shell' }
  };

  return configs[lang] || null;
}

/**
 * Execute source code using a language-specific runtime and return a structured execution result.
 *
 * @param {string} code - The source code to write to a temporary file and execute.
 * @param {{cmd: string, ext: string, name: string, cmdArgs?: string[]}} config - Language execution configuration:
 *   - cmd: command to run (e.g., "node", "python3"),
 *   - ext: file extension to use for the temporary file (e.g., ".js", ".py"),
 *   - name: human-friendly language name,
 *   - cmdArgs: optional extra arguments that precede the temp file path.
 * @param {{timeout: number, args?: string[], stdin?: string, env?: Object}} options - Execution options:
 *   - timeout: maximum runtime in milliseconds,
 *   - args: additional command-line arguments to pass after the temp file,
 *   - stdin: data to write to the child process's standard input,
 *   - env: additional environment variables to merge with the current process env.
 * @returns {{success: boolean, language: string, exitCode: number|null, stdout: string, stderr: string, duration: number, timedOut: boolean, error: string|null}} An object describing the execution:
 *   - success: `true` when the process exited with code 0 and did not time out, `false` otherwise,
 *   - language: the human-friendly language name from `config.name`,
 *   - exitCode: the process exit code, or `null` if the run timed out,
 *   - stdout: trimmed standard output captured from the process,
 *   - stderr: trimmed standard error captured from the process,
 *   - duration: execution time in milliseconds,
 *   - timedOut: `true` if the process was terminated due to timeout,
 *   - error: informational error message for timeouts or failures, or `null` when none.
 */
async function runCode(code, config, options) {
  return new Promise((resolve) => {
    const tempDir = os.tmpdir();
    const tempFile = path.join(tempDir, `code_${Date.now()}${config.ext}`);

    fs.writeFileSync(tempFile, code);

    const startTime = Date.now();
    let stdout = '';
    let stderr = '';
    let timedOut = false;

    const cmdArgs = [...(config.cmdArgs || []), tempFile, ...options.args];
    const proc = spawn(config.cmd, cmdArgs, {
      env: { ...process.env, ...options.env },
      timeout: options.timeout
    });

    const timeoutId = setTimeout(() => {
      timedOut = true;
      proc.kill('SIGKILL');
    }, options.timeout);

    if (options.stdin) {
      proc.stdin.write(options.stdin);
      proc.stdin.end();
    }

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (exitCode) => {
      clearTimeout(timeoutId);

      // Clean up temp file
      try {
        fs.unlinkSync(tempFile);
      } catch {
        // Ignore cleanup errors
      }

      const duration = Date.now() - startTime;

      resolve({
        success: exitCode === 0 && !timedOut,
        language: config.name,
        exitCode: timedOut ? null : exitCode,
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        duration,
        timedOut,
        error: timedOut ? 'Execution timed out' : (exitCode !== 0 ? `Process exited with code ${exitCode}` : null)
      });
    });

    proc.on('error', (err) => {
      clearTimeout(timeoutId);

      try {
        fs.unlinkSync(tempFile);
      } catch {
        // Ignore cleanup errors
      }

      resolve({
        success: false,
        language: config.name,
        exitCode: null,
        stdout: '',
        stderr: '',
        duration: Date.now() - startTime,
        timedOut: false,
        error: err.message
      });
    });
  });
}

/**
 * Parse command-line options, run the provided code (inline or from a file) using the chosen language runtime, print the execution result as JSON to stdout, and exit with 0 on success or 1 on failure.
 *
 * Validates required flags and inputs, selects the language runtime, enforces timeout and environment options, executes the code, and reports outcome including stdout, stderr, exit code, duration, and any error information.
 */
async function main() {
  const options = parseArgs();

  if (!options.lang) {
    console.error('Usage: node run.js <code> --lang <language>');
    console.error('       node run.js --file <path> --lang <language>');
    console.error('');
    console.error('Languages: js, ts, python, shell, bash');
    console.error('');
    console.error('Options:');
    console.error('  --lang <lang>     Language (required)');
    console.error('  --file <path>     Execute from file');
    console.error('  --timeout <ms>    Timeout (default: 30000)');
    console.error('  --stdin <data>    Provide stdin');
    console.error('  --args <a,b,c>    Command arguments');
    console.error('  --env <json>      Environment variables');
    process.exit(1);
  }

  const config = getLanguageConfig(options.lang);
  if (!config) {
    console.error(JSON.stringify({
      error: `Unsupported language: ${options.lang}`,
      supported: ['js', 'ts', 'python', 'shell', 'bash']
    }));
    process.exit(1);
  }

  let code = options.code;

  if (options.file) {
    const filePath = path.resolve(options.file);
    if (!fs.existsSync(filePath)) {
      console.error(JSON.stringify({ error: `File not found: ${filePath}` }));
      process.exit(1);
    }
    code = fs.readFileSync(filePath, 'utf-8');
  }

  if (!code) {
    console.error(JSON.stringify({ error: 'No code provided' }));
    process.exit(1);
  }

  const result = await runCode(code, config, options);
  console.log(JSON.stringify(result, null, 2));

  process.exit(result.success ? 0 : 1);
}

main();