import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const packageJson = JSON.parse(
  await readFile(new URL('../package.json', import.meta.url), 'utf8')
);

test('SPEC-003-E: validate ejecuta todos los gates locales y nunca actualiza autoridades', () => {
  const commands = packageJson.scripts.validate.split(' && ');
  const required = [
    'npm run format:check',
    'npm run format:rust',
    'npm run lint',
    'npm test',
    'npm run test:rust',
    'npm run tauri:check',
    'npm run test:lab',
    'npm run test:coverage',
    'npm run build',
    'npm run verify:migration',
    'npm run verify:artifacts',
    'npm run verify:derived',
    'npm run verify:goldens',
    'npm run audit:dxf',
    'npm run smoke:ccx',
    'make governance'
  ];

  for (const command of required) {
    assert.equal(
      commands.filter((candidate) => candidate === command).length,
      1,
      `validate debe ejecutar exactamente una vez: ${command}`
    );
  }
  assert.equal(commands.some((command) => command.includes('update:goldens')), false);
  assert.equal(commands.some((command) => command.includes('test:e2e')), false);
});

test('SPEC-003-E: Playwright actual corre externamente y publica evidencia por commit', async () => {
  assert.match(packageJson.devDependencies['@playwright/test'], /^\d+\.\d+\.\d+$/);
  assert.equal(packageJson.scripts['test:e2e'], 'npm run build && playwright test');

  const [config, workflow, workflowTest] = await Promise.all([
    readFile(new URL('../playwright.config.mjs', import.meta.url), 'utf8'),
    readFile(new URL('../.github/workflows/e2e.yml', import.meta.url), 'utf8'),
    readFile(new URL('../e2e/review-download.spec.mjs', import.meta.url), 'utf8')
  ]);

  assert.match(config, /testDir:\s*['"]\.\/e2e['"]/);
  assert.match(config, /open:\s*['"]never['"]/);
  assert.match(config, /outputFile:\s*['"]test-results\/results\.json['"]/);
  assert.match(workflow, /npm ci/);
  assert.match(workflow, /playwright install --with-deps chromium/);
  assert.match(workflow, /npm run test:e2e/);
  assert.match(workflow, /actions\/upload-artifact@v4/);
  assert.match(workflowTest, /waitForEvent\(['"]download['"]\)/);
  assert.match(workflowTest, /revision-constructiva\.md/);
});
