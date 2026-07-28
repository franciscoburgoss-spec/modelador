import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';
import { installBootGuard } from '../src/bootGuard.js';
import { hasOwn } from '../src/core/hasOwn.js';

const sourceRoot = new URL('../src/', import.meta.url);

async function productionJavaScriptFiles(directory = sourceRoot) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const url = new URL(entry.name + (entry.isDirectory() ? '/' : ''), directory);
    if (entry.isDirectory()) return productionJavaScriptFiles(url);
    return /\.[cm]?[jt]sx?$/.test(entry.name) ? [url] : [];
  }));
  return nested.flat().sort((a, b) => a.pathname.localeCompare(b.pathname));
}

test('SPEC-004-D1: hasOwn cubre prototipos, sombras y claves Symbol', () => {
  const inherited = { inherited: true };
  const source = Object.assign(Object.create(inherited), {
    own: true,
    hasOwnProperty: false
  });
  const symbol = Symbol('own');
  source[symbol] = true;
  const nullPrototype = Object.create(null);
  nullPrototype.own = true;

  assert.equal(hasOwn(source, 'own'), true);
  assert.equal(hasOwn(source, 'inherited'), false);
  assert.equal(hasOwn(source, 'hasOwnProperty'), true);
  assert.equal(hasOwn(source, symbol), true);
  assert.equal(hasOwn(nullPrototype, 'own'), true);
});

test('SPEC-004-D1: producción no depende de Object.hasOwn ausente en el WebView', async () => {
  const incompatible = [];
  for (const file of await productionJavaScriptFiles()) {
    const source = await readFile(file, 'utf8');
    if (source.includes('Object.hasOwn')) {
      incompatible.push(file.pathname.replace(sourceRoot.pathname, 'src/'));
    }
  }
  assert.deepEqual(incompatible, []);
});

test('SPEC-004-D1: las reglas cargan cuando Object.hasOwn no existe', async () => {
  const original = Object.hasOwn;
  Object.hasOwn = undefined;
  try {
    const { getDomainRule, resolveRuleLimit } = await import(
      `../src/core/domainRules.js?webview-compat=${Date.now()}`
    );
    assert.equal(getDomainRule('osb.tornillo.borde')?.id, 'osb.tornillo.borde');
    assert.deepEqual(
      resolveRuleLimit('osb.tornillo.borde'),
      { min: 10, unit: 'mm' }
    );
  } finally {
    Object.hasOwn = original;
  }
});

test('SPEC-004-D1: la guarda muestra errores escapados antes del render', () => {
  const dom = new JSDOM('<div id="root"><div id="modelador-bootstrap">Iniciando…</div></div>');
  const guard = installBootGuard(dom.window, dom.window.document);
  const error = new dom.window.Error('<img src=x onerror=alert(1)>');

  dom.window.dispatchEvent(new dom.window.ErrorEvent('error', { error }));

  const alert = dom.window.document.getElementById('modelador-boot-error');
  assert.equal(alert?.getAttribute('role'), 'alert');
  assert.match(alert.textContent, /Modelador no pudo iniciar/);
  assert.match(alert.textContent, /<img src=x onerror=alert\(1\)>/);
  assert.equal(alert.querySelector('img'), null);
  guard.dispose();
  dom.window.close();
});

test('SPEC-004-D1: rechazo visible no reemplaza una aplicación ya renderizada', () => {
  const dom = new JSDOM(
    '<div id="root"><div data-modelador-ready="true">Aplicación</div></div>'
  );
  const guard = installBootGuard(dom.window, dom.window.document);
  const rejection = new dom.window.Event('unhandledrejection');
  Object.defineProperty(rejection, 'reason', { value: new Error('fallo tardío') });

  dom.window.dispatchEvent(rejection);

  assert.equal(dom.window.document.getElementById('root').textContent, 'Aplicación');
  assert.equal(dom.window.document.getElementById('modelador-boot-error'), null);
  guard.dispose();
  dom.window.close();
});
