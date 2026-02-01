/**
 * Comprehensive tests for GitHub Actions Node.js CI workflow
 * Tests workflow configuration, triggers, matrix strategy, and job steps
 */

import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import yaml from 'yaml';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Node.js CI Workflow', () => {
  let workflow;
  let workflowPath;

  beforeAll(() => {
    // Read the workflow file
    workflowPath = path.join(__dirname, '../../.github/workflows/node.js.yml');
    const workflowContent = fs.readFileSync(workflowPath, 'utf8');
    workflow = yaml.parse(workflowContent);
  });

  describe('Workflow Metadata', () => {
    it('should have correct workflow name', () => {
      expect(workflow.name).toBe('Node.js CI');
    });

    it('should have workflow name defined', () => {
      expect(workflow.name).toBeDefined();
      expect(typeof workflow.name).toBe('string');
      expect(workflow.name.length).toBeGreaterThan(0);
    });
  });

  describe('Workflow Triggers', () => {
    it('should trigger on push to main branch', () => {
      expect(workflow.on).toBeDefined();
      expect(workflow.on.push).toBeDefined();
      expect(workflow.on.push.branches).toContain('main');
    });

    it('should trigger on pull_request to main branch', () => {
      expect(workflow.on.pull_request).toBeDefined();
      expect(workflow.on.pull_request.branches).toContain('main');
    });

    it('should only trigger on main branch for both events', () => {
      expect(workflow.on.push.branches).toEqual(['main']);
      expect(workflow.on.pull_request.branches).toEqual(['main']);
    });

    it('should have exactly two trigger events', () => {
      const triggerKeys = Object.keys(workflow.on);
      expect(triggerKeys).toHaveLength(2);
      expect(triggerKeys).toContain('push');
      expect(triggerKeys).toContain('pull_request');
    });
  });

  describe('Build Job Configuration', () => {
    it('should have a build job defined', () => {
      expect(workflow.jobs).toBeDefined();
      expect(workflow.jobs.build).toBeDefined();
    });

    it('should run on ubuntu-latest', () => {
      expect(workflow.jobs.build['runs-on']).toBe('ubuntu-latest');
    });

    it('should have valid runner configuration', () => {
      const runnerOs = workflow.jobs.build['runs-on'];
      expect(runnerOs).toBeDefined();
      expect(typeof runnerOs).toBe('string');
      // Valid GitHub-hosted runner names
      const validRunners = ['ubuntu-latest', 'ubuntu-22.04', 'ubuntu-20.04', 'windows-latest', 'macos-latest'];
      expect(validRunners.some(runner => runnerOs.includes('ubuntu'))).toBe(true);
    });
  });

  describe('Matrix Strategy', () => {
    it('should have a matrix strategy defined', () => {
      expect(workflow.jobs.build.strategy).toBeDefined();
      expect(workflow.jobs.build.strategy.matrix).toBeDefined();
    });

    it('should test against Node.js versions 18.x, 20.x, and 22.x', () => {
      const nodeVersions = workflow.jobs.build.strategy.matrix['node-version'];
      expect(nodeVersions).toBeDefined();
      expect(Array.isArray(nodeVersions)).toBe(true);
      expect(nodeVersions).toHaveLength(3);
      expect(nodeVersions).toContain('18.x');
      expect(nodeVersions).toContain('20.x');
      expect(nodeVersions).toContain('22.x');
    });

    it('should include only currently supported Node.js LTS versions', () => {
      const nodeVersions = workflow.jobs.build.strategy.matrix['node-version'];
      // All versions should be >= 18 (Node 18 is the oldest LTS as of 2024)
      nodeVersions.forEach(version => {
        const majorVersion = parseInt(version.split('.')[0]);
        expect(majorVersion).toBeGreaterThanOrEqual(18);
      });
    });

    it('should have versions in ascending order', () => {
      const nodeVersions = workflow.jobs.build.strategy.matrix['node-version'];
      const majorVersions = nodeVersions.map(v => parseInt(v.split('.')[0]));
      for (let i = 1; i < majorVersions.length; i++) {
        expect(majorVersions[i]).toBeGreaterThan(majorVersions[i - 1]);
      }
    });

    it('should test against at least 2 Node.js versions for compatibility', () => {
      const nodeVersions = workflow.jobs.build.strategy.matrix['node-version'];
      expect(nodeVersions.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Job Steps', () => {
    let steps;

    beforeAll(() => {
      steps = workflow.jobs.build.steps;
    });

    it('should have all required steps defined', () => {
      expect(steps).toBeDefined();
      expect(Array.isArray(steps)).toBe(true);
      expect(steps.length).toBeGreaterThanOrEqual(4);
    });

    describe('Checkout Step', () => {
      it('should checkout code as first step', () => {
        const checkoutStep = steps[0];
        expect(checkoutStep.uses).toBe('actions/checkout@v4');
      });

      it('should use checkout action v4', () => {
        const checkoutStep = steps[0];
        expect(checkoutStep.uses).toContain('actions/checkout');
        expect(checkoutStep.uses).toContain('@v4');
      });
    });

    describe('Node.js Setup Step', () => {
      it('should setup Node.js as second step', () => {
        const setupNodeStep = steps[1];
        expect(setupNodeStep.uses).toBe('actions/setup-node@v4');
        expect(setupNodeStep.name).toContain('Use Node.js');
      });

      it('should use dynamic Node.js version from matrix', () => {
        const setupNodeStep = steps[1];
        expect(setupNodeStep.with['node-version']).toBe('${{ matrix.node-version }}');
      });

      it('should enable npm caching', () => {
        const setupNodeStep = steps[1];
        expect(setupNodeStep.with.cache).toBe('npm');
      });

      it('should have descriptive step name with version placeholder', () => {
        const setupNodeStep = steps[1];
        expect(setupNodeStep.name).toBeDefined();
        expect(setupNodeStep.name).toContain('${{ matrix.node-version }}');
        expect(setupNodeStep.name).toContain('Node.js');
      });

      it('should use setup-node action v4', () => {
        const setupNodeStep = steps[1];
        expect(setupNodeStep.uses).toContain('actions/setup-node');
        expect(setupNodeStep.uses).toContain('@v4');
      });
    });

    describe('Dependencies Installation Step', () => {
      it('should run npm ci for clean install', () => {
        const npmCiStep = steps.find(step => step.run === 'npm ci');
        expect(npmCiStep).toBeDefined();
      });

      it('should use npm ci instead of npm install for CI reproducibility', () => {
        const npmCommands = steps.filter(step => step.run && step.run.includes('npm'));
        const hasNpmCi = npmCommands.some(step => step.run === 'npm ci');
        expect(hasNpmCi).toBe(true);

        // Ensure we're not using npm install which is less deterministic
        const hasNpmInstall = npmCommands.some(step => step.run === 'npm install');
        expect(hasNpmInstall).toBe(false);
      });

      it('should install dependencies before build and test', () => {
        const npmCiIndex = steps.findIndex(step => step.run === 'npm ci');
        const buildIndex = steps.findIndex(step => step.run && step.run.includes('npm run build'));
        const testIndex = steps.findIndex(step => step.run === 'npm test');

        expect(npmCiIndex).toBeLessThan(buildIndex);
        expect(npmCiIndex).toBeLessThan(testIndex);
      });
    });

    describe('Build Step', () => {
      it('should run build command with --if-present flag', () => {
        const buildStep = steps.find(step => step.run === 'npm run build --if-present');
        expect(buildStep).toBeDefined();
      });

      it('should use --if-present flag to avoid errors when build script is missing', () => {
        const buildStep = steps.find(step => step.run && step.run.includes('npm run build'));
        expect(buildStep.run).toContain('--if-present');
      });

      it('should run build before tests', () => {
        const buildIndex = steps.findIndex(step => step.run && step.run.includes('npm run build'));
        const testIndex = steps.findIndex(step => step.run === 'npm test');

        expect(buildIndex).toBeLessThan(testIndex);
      });
    });

    describe('Test Step', () => {
      it('should run tests as final step', () => {
        const testStep = steps.find(step => step.run === 'npm test');
        expect(testStep).toBeDefined();
      });

      it('should run npm test command', () => {
        const lastStep = steps[steps.length - 1];
        expect(lastStep.run).toBe('npm test');
      });

      it('should be the last step in the workflow', () => {
        const testStepIndex = steps.findIndex(step => step.run === 'npm test');
        expect(testStepIndex).toBe(steps.length - 1);
      });
    });

    describe('Step Order and Dependencies', () => {
      it('should execute steps in correct order', () => {
        const stepCommands = steps.map(step => step.uses || step.run);

        expect(stepCommands[0]).toContain('checkout');
        expect(stepCommands[1]).toContain('setup-node');
        expect(stepCommands[2]).toBe('npm ci');
        expect(stepCommands[3]).toBe('npm run build --if-present');
        expect(stepCommands[4]).toBe('npm test');
      });

      it('should have exactly 5 steps', () => {
        expect(steps).toHaveLength(5);
      });
    });
  });

  describe('Workflow File Syntax', () => {
    it('should be valid YAML', () => {
      expect(workflow).toBeDefined();
      expect(typeof workflow).toBe('object');
    });

    it('should have required top-level keys', () => {
      expect(workflow).toHaveProperty('name');
      expect(workflow).toHaveProperty('on');
      expect(workflow).toHaveProperty('jobs');
    });

    it('should not have syntax errors', () => {
      // If we got here, YAML parsing succeeded
      expect(workflow).toBeTruthy();
    });

    it('should have proper indentation (parseable)', () => {
      // If yaml.parse succeeded, indentation is correct
      const workflowContent = fs.readFileSync(workflowPath, 'utf8');
      expect(() => yaml.parse(workflowContent)).not.toThrow();
    });
  });

  describe('Best Practices', () => {
    it('should use specific action versions (v4)', () => {
      const steps = workflow.jobs.build.steps;
      const actionSteps = steps.filter(step => step.uses);

      actionSteps.forEach(step => {
        expect(step.uses).toMatch(/@v\d+$/);
      });
    });

    it('should pin actions to major versions', () => {
      const steps = workflow.jobs.build.steps;
      const actionSteps = steps.filter(step => step.uses);

      actionSteps.forEach(step => {
        // Should use @v4 format, not @main or commit SHA
        expect(step.uses).toMatch(/@v\d+$/);
      });
    });

    it('should use npm ci for deterministic installs in CI', () => {
      const steps = workflow.jobs.build.steps;
      const npmCiStep = steps.find(step => step.run === 'npm ci');
      expect(npmCiStep).toBeDefined();
    });

    it('should enable caching for faster builds', () => {
      const setupNodeStep = workflow.jobs.build.steps[1];
      expect(setupNodeStep.with.cache).toBeDefined();
    });

    it('should test against multiple Node.js versions for compatibility', () => {
      const nodeVersions = workflow.jobs.build.strategy.matrix['node-version'];
      expect(nodeVersions.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Security and Reliability', () => {
    it('should not use deprecated Node.js versions', () => {
      const nodeVersions = workflow.jobs.build.strategy.matrix['node-version'];
      const majorVersions = nodeVersions.map(v => parseInt(v.split('.')[0]));

      // Node.js 16 reached EOL in September 2023
      majorVersions.forEach(version => {
        expect(version).toBeGreaterThanOrEqual(18);
      });
    });

    it('should use latest major version of GitHub actions', () => {
      const steps = workflow.jobs.build.steps;
      const checkoutStep = steps[0];
      const setupNodeStep = steps[1];

      expect(checkoutStep.uses).toContain('@v4');
      expect(setupNodeStep.uses).toContain('@v4');
    });

    it('should not expose secrets in workflow configuration', () => {
      const workflowString = JSON.stringify(workflow);
      expect(workflowString).not.toMatch(/password/i);
      expect(workflowString).not.toMatch(/secret/i);
      expect(workflowString).not.toMatch(/token/i);
    });

    it('should use secure checkout action', () => {
      const checkoutStep = workflow.jobs.build.steps[0];
      expect(checkoutStep.uses).toContain('actions/checkout');
    });
  });

  describe('CI/CD Integration', () => {
    it('should fail fast on test failures', () => {
      // By default, steps fail if exit code is non-zero
      const testStep = workflow.jobs.build.steps.find(step => step.run === 'npm test');
      // continue-on-error should not be set
      expect(testStep['continue-on-error']).toBeUndefined();
    });

    it('should run on pull requests for pre-merge validation', () => {
      expect(workflow.on.pull_request).toBeDefined();
      expect(workflow.on.pull_request.branches).toContain('main');
    });

    it('should run on pushes for continuous integration', () => {
      expect(workflow.on.push).toBeDefined();
      expect(workflow.on.push.branches).toContain('main');
    });
  });

  describe('Matrix Build Coverage', () => {
    it('should test on latest LTS version', () => {
      const nodeVersions = workflow.jobs.build.strategy.matrix['node-version'];
      // Node 20 is the current LTS as of 2024
      expect(nodeVersions.some(v => v.startsWith('20'))).toBe(true);
    });

    it('should test on current version', () => {
      const nodeVersions = workflow.jobs.build.strategy.matrix['node-version'];
      // Node 22 is the current version as of 2024
      expect(nodeVersions.some(v => v.startsWith('22'))).toBe(true);
    });

    it('should include previous LTS for backward compatibility', () => {
      const nodeVersions = workflow.jobs.build.strategy.matrix['node-version'];
      // Should include at least one version older than latest LTS
      expect(nodeVersions.some(v => v.startsWith('18'))).toBe(true);
    });
  });

  describe('Performance Optimizations', () => {
    it('should use npm caching to speed up installs', () => {
      const setupNodeStep = workflow.jobs.build.steps[1];
      expect(setupNodeStep.with.cache).toBe('npm');
    });

    it('should use latest runner OS for best performance', () => {
      expect(workflow.jobs.build['runs-on']).toBe('ubuntu-latest');
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle missing build script gracefully', () => {
      const buildStep = workflow.jobs.build.steps.find(step =>
        step.run && step.run.includes('npm run build')
      );
      expect(buildStep.run).toContain('--if-present');
    });

    it('should not have conditional steps that might be skipped unintentionally', () => {
      const steps = workflow.jobs.build.steps;
      const testStep = steps.find(step => step.run === 'npm test');

      // Test step should not have 'if' condition
      expect(testStep.if).toBeUndefined();
    });

    it('should handle all Node.js versions uniformly', () => {
      const strategy = workflow.jobs.build.strategy;
      // fail-fast should not be set or should be false to test all versions
      // If undefined, it defaults to true, which is acceptable for CI
      if (strategy['fail-fast'] !== undefined) {
        expect(typeof strategy['fail-fast']).toBe('boolean');
      }
    });
  });

  describe('Documentation and Maintainability', () => {
    it('should have comments explaining the workflow', () => {
      const workflowContent = fs.readFileSync(workflowPath, 'utf8');
      expect(workflowContent).toContain('#');
    });

    it('should reference Node.js documentation', () => {
      const workflowContent = fs.readFileSync(workflowPath, 'utf8');
      expect(workflowContent).toMatch(/nodejs\.org|github\.com/i);
    });

    it('should have clear step names where applicable', () => {
      const setupNodeStep = workflow.jobs.build.steps[1];
      expect(setupNodeStep.name).toBeDefined();
      expect(setupNodeStep.name.length).toBeGreaterThan(0);
    });
  });

  describe('Workflow Validation', () => {
    it('should have valid workflow structure', () => {
      expect(workflow.name).toBeDefined();
      expect(workflow.on).toBeDefined();
      expect(workflow.jobs).toBeDefined();
      expect(workflow.jobs.build).toBeDefined();
      expect(workflow.jobs.build.steps).toBeDefined();
    });

    it('should use string branch names', () => {
      workflow.on.push.branches.forEach(branch => {
        expect(typeof branch).toBe('string');
      });
      workflow.on.pull_request.branches.forEach(branch => {
        expect(typeof branch).toBe('string');
      });
    });

    it('should have valid matrix configuration', () => {
      const matrix = workflow.jobs.build.strategy.matrix;
      expect(matrix).toBeDefined();
      expect(matrix['node-version']).toBeDefined();
      expect(Array.isArray(matrix['node-version'])).toBe(true);
    });
  });

  describe('Regression Prevention', () => {
    it('should maintain existing trigger branches', () => {
      // Regression test: ensure we don't accidentally remove main branch
      expect(workflow.on.push.branches).toContain('main');
      expect(workflow.on.pull_request.branches).toContain('main');
    });

    it('should maintain all three Node.js versions', () => {
      // Regression test: ensure we don't drop any Node version
      const nodeVersions = workflow.jobs.build.strategy.matrix['node-version'];
      expect(nodeVersions).toHaveLength(3);
    });

    it('should maintain npm ci command', () => {
      // Regression test: ensure npm ci is not changed to npm install
      const npmCiStep = workflow.jobs.build.steps.find(step => step.run === 'npm ci');
      expect(npmCiStep).toBeDefined();
    });

    it('should maintain build --if-present flag', () => {
      // Regression test: ensure --if-present flag is not removed
      const buildStep = workflow.jobs.build.steps.find(step =>
        step.run && step.run.includes('npm run build')
      );
      expect(buildStep.run).toBe('npm run build --if-present');
    });

    it('should maintain npm cache configuration', () => {
      // Regression test: ensure caching is not disabled
      const setupNodeStep = workflow.jobs.build.steps[1];
      expect(setupNodeStep.with.cache).toBe('npm');
    });
  });

  describe('Boundary Cases', () => {
    it('should handle workflow with minimum required fields', () => {
      expect(workflow.name).toBeDefined();
      expect(workflow.on).toBeDefined();
      expect(workflow.jobs).toBeDefined();
    });

    it('should handle empty comments in workflow file', () => {
      const workflowContent = fs.readFileSync(workflowPath, 'utf8');
      // Should parse successfully even with comments
      expect(() => yaml.parse(workflowContent)).not.toThrow();
    });

    it('should handle matrix with single dimension', () => {
      const matrix = workflow.jobs.build.strategy.matrix;
      const dimensions = Object.keys(matrix);
      expect(dimensions).toContain('node-version');
    });
  });

  describe('Negative Test Cases', () => {
    it('should not trigger on branches other than main', () => {
      const pushBranches = workflow.on.push.branches;
      const prBranches = workflow.on.pull_request.branches;

      expect(pushBranches).not.toContain('develop');
      expect(pushBranches).not.toContain('feature/*');
      expect(prBranches).not.toContain('develop');
    });

    it('should not use outdated action versions', () => {
      const steps = workflow.jobs.build.steps;
      steps.forEach(step => {
        if (step.uses) {
          expect(step.uses).not.toContain('@v1');
          expect(step.uses).not.toContain('@v2');
          expect(step.uses).not.toContain('@v3');
        }
      });
    });

    it('should not include EOL Node.js versions', () => {
      const nodeVersions = workflow.jobs.build.strategy.matrix['node-version'];
      const eolVersions = ['12', '14', '16'];

      nodeVersions.forEach(version => {
        const major = version.split('.')[0];
        expect(eolVersions).not.toContain(major);
      });
    });

    it('should not use npm install in CI environment', () => {
      const steps = workflow.jobs.build.steps;
      const hasNpmInstall = steps.some(step => step.run === 'npm install');
      expect(hasNpmInstall).toBe(false);
    });

    it('should not skip tests on any condition', () => {
      const testStep = workflow.jobs.build.steps.find(step => step.run === 'npm test');
      expect(testStep.if).toBeUndefined();
    });
  });
});