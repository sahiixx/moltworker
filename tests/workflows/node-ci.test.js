/**
 * Tests for .github/workflows/node.js.yml
 *
 * These tests validate the GitHub Actions workflow configuration including:
 * - YAML syntax and structure
 * - Workflow triggers and events
 * - Job configuration and matrix strategy
 * - Step definitions and actions
 * - Best practices and security
 */

import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import yaml from 'yaml';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const WORKFLOW_PATH = path.join(__dirname, '../../.github/workflows/node.js.yml');

describe('GitHub Actions Workflow: node.js.yml', () => {
  let workflow;
  let workflowContent;

  beforeAll(() => {
    workflowContent = fs.readFileSync(WORKFLOW_PATH, 'utf8');
    workflow = yaml.parse(workflowContent);
  });

  describe('Basic Structure', () => {
    it('should exist and be readable', () => {
      expect(fs.existsSync(WORKFLOW_PATH)).toBe(true);
      expect(workflowContent.length).toBeGreaterThan(0);
    });

    it('should have valid YAML syntax', () => {
      expect(workflow).toBeTruthy();
      expect(typeof workflow).toBe('object');
    });

    it('should have a descriptive name', () => {
      expect(workflow.name).toBeDefined();
      expect(workflow.name).toBe('Node.js CI');
    });

    it('should have reasonable file size', () => {
      const stats = fs.statSync(WORKFLOW_PATH);
      expect(stats.size).toBeLessThan(10240); // Under 10KB
    });

    it('should have helpful comments', () => {
      expect(workflowContent).toContain('# This workflow');
    });
  });

  describe('Workflow Triggers', () => {
    it('should have triggers defined', () => {
      expect(workflow.on).toBeDefined();
    });

    it('should trigger on push events', () => {
      expect(workflow.on.push).toBeDefined();
      expect(workflow.on.push.branches).toEqual(['main']);
    });

    it('should trigger on pull request events', () => {
      expect(workflow.on.pull_request).toBeDefined();
      expect(workflow.on.pull_request.branches).toEqual(['main']);
    });

    it('should not trigger on all branches (negative test)', () => {
      if (workflow.on.push) {
        expect(workflow.on.push.branches).toBeDefined();
        expect(workflow.on.push.branches).not.toContain('*');
      }
    });
  });

  describe('Build Job', () => {
    it('should have jobs defined', () => {
      expect(workflow.jobs).toBeDefined();
    });

    it('should have a build job', () => {
      expect(workflow.jobs.build).toBeDefined();
    });

    it('should use ubuntu-latest runner', () => {
      expect(workflow.jobs.build['runs-on']).toBe('ubuntu-latest');
    });
  });

  describe('Matrix Strategy', () => {
    it('should have a matrix strategy defined', () => {
      expect(workflow.jobs.build.strategy).toBeDefined();
      expect(workflow.jobs.build.strategy.matrix).toBeDefined();
    });

    it('should define node-version in matrix', () => {
      expect(workflow.jobs.build.strategy.matrix['node-version']).toBeDefined();
    });

    it('should test multiple Node.js versions', () => {
      const nodeVersions = workflow.jobs.build.strategy.matrix['node-version'];
      expect(Array.isArray(nodeVersions)).toBe(true);
      expect(nodeVersions.length).toBeGreaterThanOrEqual(3);
    });

    it('should include supported LTS versions', () => {
      const nodeVersions = workflow.jobs.build.strategy.matrix['node-version'];
      expect(nodeVersions).toContain('18.x');
      expect(nodeVersions).toContain('20.x');
      expect(nodeVersions).toContain('22.x');
    });

    it('should use valid version format', () => {
      const nodeVersions = workflow.jobs.build.strategy.matrix['node-version'];
      const validVersionPattern = /^\d+\.x$/;
      nodeVersions.forEach(version => {
        expect(validVersionPattern.test(version)).toBe(true);
      });
    });

    it('should have unique versions', () => {
      const nodeVersions = workflow.jobs.build.strategy.matrix['node-version'];
      const uniqueVersions = [...new Set(nodeVersions)];
      expect(nodeVersions.length).toBe(uniqueVersions.length);
    });

    it('should not have empty matrix', () => {
      const matrix = workflow.jobs.build.strategy.matrix;
      expect(Object.keys(matrix).length).toBeGreaterThan(0);

      Object.entries(matrix).forEach(([key, value]) => {
        if (Array.isArray(value)) {
          expect(value.length).toBeGreaterThan(0);
        }
      });
    });

    it('should have valid fail-fast configuration if defined', () => {
      const strategy = workflow.jobs.build.strategy;
      if (strategy['fail-fast'] !== undefined) {
        expect(typeof strategy['fail-fast']).toBe('boolean');
      }
    });
  });

  describe('Workflow Steps', () => {
    let steps;

    beforeAll(() => {
      steps = workflow.jobs.build.steps;
    });

    it('should have steps defined', () => {
      expect(Array.isArray(steps)).toBe(true);
      expect(steps.length).toBeGreaterThanOrEqual(4);
    });

    it('should checkout code as first step', () => {
      const checkoutStep = steps[0];
      expect(checkoutStep.uses).toBeDefined();
      expect(checkoutStep.uses).toContain('actions/checkout@');
      expect(checkoutStep.uses).toBe('actions/checkout@v4');
    });

    it('should setup Node.js with matrix version', () => {
      const setupStep = steps.find(step =>
        step.uses && step.uses.includes('setup-node')
      );

      expect(setupStep).toBeDefined();
      expect(setupStep.uses).toBe('actions/setup-node@v4');
      expect(setupStep.name).toBeDefined();
      expect(setupStep.name).toContain('${{ matrix.node-version }}');
      expect(setupStep.with['node-version']).toBe('${{ matrix.node-version }}');
    });

    it('should enable npm caching', () => {
      const setupStep = steps.find(step =>
        step.uses && step.uses.includes('setup-node')
      );

      expect(setupStep.with.cache).toBe('npm');
    });

    it('should install dependencies with npm ci', () => {
      const installStep = steps.find(step =>
        step.run && step.run.includes('npm ci')
      );

      expect(installStep).toBeDefined();
      expect(installStep.run).toBe('npm ci');
    });

    it('should not use npm install (regression test)', () => {
      const hasNpmInstall = steps.some(step =>
        step.run && step.run.match(/npm\s+install(?!\s)/)
      );

      expect(hasNpmInstall).toBe(false);
    });

    it('should have build step', () => {
      const buildStep = steps.find(step =>
        step.run && step.run.includes('npm run build')
      );

      expect(buildStep).toBeDefined();
      expect(buildStep.run).toContain('--if-present');
    });

    it('should have test step', () => {
      const testStep = steps.find(step =>
        step.run && step.run === 'npm test'
      );

      expect(testStep).toBeDefined();
    });

    it('should have steps in correct order', () => {
      const stepIdentifiers = steps.map(step => {
        if (step.uses && step.uses.includes('checkout')) return 'checkout';
        if (step.uses && step.uses.includes('setup-node')) return 'setup';
        if (step.run && step.run.includes('npm ci')) return 'install';
        if (step.run && step.run.includes('npm run build')) return 'build';
        if (step.run && step.run.includes('npm test')) return 'test';
        return 'other';
      });

      const checkoutIndex = stepIdentifiers.indexOf('checkout');
      const setupIndex = stepIdentifiers.indexOf('setup');
      const installIndex = stepIdentifiers.indexOf('install');
      const buildIndex = stepIdentifiers.indexOf('build');
      const testIndex = stepIdentifiers.indexOf('test');

      expect(checkoutIndex).toBeLessThan(setupIndex);
      expect(setupIndex).toBeLessThan(installIndex);
      expect(installIndex).toBeLessThan(buildIndex);
      expect(buildIndex).toBeLessThan(testIndex);
    });
  });

  describe('Security Best Practices', () => {
    it('should not contain hardcoded secrets', () => {
      const secretPatterns = [
        /password\s*[:=]\s*['"][^'"]+['"]/i,
        /api[_-]?key\s*[:=]\s*['"][^'"]+['"]/i,
        /token\s*[:=]\s*['"][^'"]+['"]/i,
        /secret\s*[:=]\s*['"][^'"]+['"]/i,
      ];

      secretPatterns.forEach(pattern => {
        expect(pattern.test(workflowContent)).toBe(false);
      });
    });

    it('should use pinned action versions', () => {
      const steps = workflow.jobs.build.steps;

      steps.forEach((step, index) => {
        if (step.uses) {
          expect(/@v?\d+/.test(step.uses)).toBe(true);
          expect(step.uses).not.toContain('@main');
          expect(step.uses).not.toContain('@master');
        }
      });
    });

    it('should use valid action version format', () => {
      const steps = workflow.jobs.build.steps;

      steps.forEach((step, index) => {
        if (step.uses) {
          const [action, version] = step.uses.split('@');
          expect(action).toBeTruthy();
          expect(version).toBeTruthy();

          const validVersion = /^v\d+$|^[a-f0-9]{40}$/.test(version);
          expect(validVersion).toBe(true);
        }
      });
    });

    it('should not have shell injection vulnerabilities', () => {
      const steps = workflow.jobs.build.steps;

      const unsafePatterns = [
        /\$\{\{\s*github\.event\.issue\.title\s*\}\}/,
        /\$\{\{\s*github\.event\.pull_request\.title\s*\}\}/,
        /\$\{\{\s*github\.event\.comment\.body\s*\}\}/,
      ];

      steps.forEach((step, index) => {
        if (step.run) {
          unsafePatterns.forEach(pattern => {
            expect(pattern.test(step.run)).toBe(false);
          });
        }
      });
    });

    it('should follow principle of least privilege', () => {
      if (workflow.permissions) {
        const permissionKeys = Object.keys(workflow.permissions);
        permissionKeys.forEach(key => {
          expect(['read', 'write', 'none']).toContain(workflow.permissions[key]);
        });
      }
      // Test passes if no permissions defined (uses defaults)
    });
  });

  describe('Node.js Project Compatibility', () => {
    it('should use setup-node action', () => {
      const steps = workflow.jobs.build.steps;
      const hasSetupNode = steps.some(step =>
        step.uses && step.uses.includes('setup-node')
      );

      expect(hasSetupNode).toBe(true);
    });

    it('should install Node.js dependencies', () => {
      const steps = workflow.jobs.build.steps;
      const hasInstall = steps.some(step =>
        step.run && (step.run.includes('npm') || step.run.includes('yarn'))
      );

      expect(hasInstall).toBe(true);
    });

    it('should run tests', () => {
      const steps = workflow.jobs.build.steps;
      const hasTest = steps.some(step =>
        step.run && step.run.includes('test')
      );

      expect(hasTest).toBe(true);
    });
  });

  describe('GitHub Actions Best Practices', () => {
    it('should have at least one job', () => {
      expect(Object.keys(workflow.jobs).length).toBeGreaterThan(0);
    });

    it('should have reasonable triggers', () => {
      expect(workflow.on).toBeDefined();
    });
  });

  describe('Edge Cases and Boundary Tests', () => {
    it('should handle matrix configuration properly (boundary test)', () => {
      const nodeVersions = workflow.jobs.build.strategy.matrix['node-version'];
      expect(nodeVersions.length).toBeGreaterThanOrEqual(3);

      // Verify all versions are valid
      nodeVersions.forEach(version => {
        expect(typeof version).toBe('string');
        expect(version.length).toBeGreaterThan(0);
      });
    });

    it('should handle build step with conditional flag', () => {
      const buildStep = workflow.jobs.build.steps.find(step =>
        step.run && step.run.includes('npm run build')
      );

      // The --if-present flag ensures builds don't fail if script is missing
      expect(buildStep.run).toContain('--if-present');
    });

    it('should use specific branch constraints', () => {
      // Verify that the workflow is targeted to specific branches
      // and not running on every branch (performance optimization)
      expect(workflow.on.push.branches).toEqual(['main']);
      expect(workflow.on.pull_request.branches).toEqual(['main']);
    });
  });
});