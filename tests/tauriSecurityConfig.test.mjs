import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const expectedPermissions = [
  'allow-choose-open-project-path',
  'allow-choose-save-project-path',
  'allow-load-recent-project-paths',
  'allow-read-project-text',
  'allow-save-recent-project-paths',
  'allow-write-project-text-atomic'
];

test('SPEC-004-C: capability concede sólo los seis comandos a main', async () => {
  const capability = JSON.parse(await readFile(
    new URL('src-tauri/capabilities/main.json', root),
    'utf8'
  ));

  assert.deepEqual(capability.windows, ['main']);
  assert.deepEqual([...capability.permissions].sort(), expectedPermissions);
  assert.deepEqual(capability.platforms, ['macOS']);
  assert.equal(JSON.stringify(capability).match(/shell|fs:|http|opener/), null);
});

test('SPEC-004-C: config release usa frontend local, CSP cerrada y no empaqueta todavía', async () => {
  const config = JSON.parse(await readFile(
    new URL('src-tauri/tauri.conf.json', root),
    'utf8'
  ));
  const csp = JSON.stringify(config.app.security.csp);

  assert.equal(config.build.frontendDist, '../dist');
  assert.match(config.build.devUrl, /^http:\/\/127\.0\.0\.1:/);
  assert.deepEqual(config.app.security.capabilities, ['main']);
  assert.equal(config.app.windows.length, 1);
  assert.equal(config.app.windows[0].label, 'main');
  assert.equal('devtools' in config.app.windows[0], false);
  assert.equal(config.app.withGlobalTauri, false);
  assert.equal(config.bundle.active, false);
  assert.match(csp, /ipc:/);
  assert.doesNotMatch(csp, /https:|wss:|ws:|localhost(?!")/);
});

test('SPEC-004-C: dependencias Rust no incorporan plugins genéricos peligrosos', async () => {
  const cargo = await readFile(new URL('src-tauri/Cargo.toml', root), 'utf8');
  const build = await readFile(new URL('src-tauri/build.rs', root), 'utf8');

  assert.match(cargo, /tauri-plugin-dialog/);
  assert.doesNotMatch(cargo, /tauri-plugin-(shell|fs|http|opener)/);
  for (const command of expectedPermissions.map((permission) => permission.slice(6))) {
    assert.match(build, new RegExp(`"${command.replaceAll('-', '_')}"`));
  }
});

test('SPEC-004-C1: el lock fija la última línea Wry previa al quiebre de macOS 11', async () => {
  const lock = await readFile(new URL('src-tauri/Cargo.lock', root), 'utf8');
  const versionsFor = (packageName) => [
    ...lock.matchAll(new RegExp(
      `name = "${packageName}"\\nversion = "([^"]+)"`,
      'g'
    ))
  ].map((match) => match[1]);

  assert.deepEqual(versionsFor('tauri'), ['2.0.2']);
  assert.deepEqual(versionsFor('tauri-runtime'), ['2.0.1']);
  assert.deepEqual(versionsFor('tauri-runtime-wry'), ['2.0.1']);
  assert.deepEqual(versionsFor('wry'), ['0.44.1']);
  assert.equal(
    versionsFor('wry').some((version) => Number(version.split('.')[1]) >= 46),
    false
  );
});
