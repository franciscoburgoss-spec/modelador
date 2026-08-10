import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('SPEC-015-C-1 independencia: presentador, localizador y menús respetan fronteras', async () => {
  const presenter = await readFile(new URL('../src/core/structuralIntentVisualPresentation.js', import.meta.url), 'utf8');
  const locator = await readFile(new URL('../src/core/structuralIntentLocator.js', import.meta.url), 'utf8');
  const canvas = await readFile(new URL('../src/components/Canvas.jsx', import.meta.url), 'utf8');
  const menu = await readFile(new URL('../src/components/MenuBar.jsx', import.meta.url), 'utf8');
  assert.match(presenter, /projectAgnosticGeometry/);
  assert.doesNotMatch(presenter, /^import .*?(wallTypes|metalcon|recognizedStructuralTopology|spec14|three|useModelStore|react)/mi);
  assert.doesNotMatch(locator, /withHistory|appendStructuralIntentTrace|setElementIntent|setRoofIntent/);
  assert.ok(canvas.indexOf("locatorState.active") < canvas.indexOf('selectElement(dimHit)'));
  assert.match(
    menu,
    /<Item onClick=\{\(\) => onOpenModal\('structuralProposals'\)\}>Propuestas y caminos candidatos…<\/Item>/
  );
  assert.doesNotMatch(menu, /Disponible en SPEC-015-D/);
  assert.match(menu, /<Item disabled title="Disponible en SPEC-015-E">Topología estructural…<\/Item>/);
});

test('SPEC-015-C-1 reversión: quitar la intercepción previa haría detectable selección global silenciosa', async () => {
  const canvas = await readFile(new URL('../src/components/Canvas.jsx', import.meta.url), 'utf8');
  const reversed = canvas.replace(
    "if (panelId === 'a' && mode === 'plan' && locatorState.active)",
    "if (false && panelId === 'a' && mode === 'plan' && locatorState.active)"
  );
  assert.doesNotMatch(reversed, /if \(panelId === 'a' && mode === 'plan' && locatorState\.active\)/);
  assert.match(reversed, /selectElement\(dimHit\)/);
});
