import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('BUG-015-D-029: Canvas dibuja evidencia parcial del roofBoundary y no el polígono completo del host', async () => {
  const canvas = await readFile(new URL('../src/components/Canvas.jsx', import.meta.url), 'utf8');
  const marker = "if (structuralIntentLocator.preview?.kind === 'proposal-relation')";
  const branch = canvas.indexOf(marker);
  assert.ok(branch >= 0, 'debe existir una rama especializada para evidencia de interfaz roofBoundary');

  const evidenceCall = canvas.indexOf(
    'drawStructuralProposalRelationEvidence(ctx, structuralIntentLocator.preview, view, canvasH);',
    branch
  );
  assert.ok(evidenceCall > branch, 'la rama especializada debe dibujar boundary/overlapSegments');

  const fallback = canvas.indexOf('} else {', branch);
  assert.ok(fallback > evidenceCall, 'el dibujo de targets completos debe quedar sólo en el fallback');

  const fullTargetDraw = canvas.indexOf('drawStructuralIntentVisualTarget(ctx, target, view, canvasH, {', fallback);
  assert.ok(fullTargetDraw > fallback, 'los targets completos siguen disponibles para localizadores no especializados');
  assert.ok(evidenceCall < fallback && fallback < fullTargetDraw,
    'roofBoundary parcial debe consumir evidencia antes de entrar al dibujo de polígonos completos');
});

test('BUG-015-D-029: la corrección no altera el contrato de Encuadrar basado en visibleBounds', async () => {
  const locator = await readFile(new URL('../src/core/structuralIntentLocator.js', import.meta.url), 'utf8');
  assert.match(locator, /const bounds = locator\?\.preview\?\.visibleBounds \|\| locator\?\.preview\?\.targetBounds;/);
});

test('BUG-015-D-032: Canvas usa llamada exterior sólo para marcas de interfaz de cara corta', async () => {
  const canvas = await readFile(new URL('../src/components/Canvas.jsx', import.meta.url), 'utf8');
  assert.match(canvas, /structuralIntentMarkLayout/);
  assert.match(canvas, /target\.interfaceLocation\?\.kind === 'face'/);
  assert.match(canvas, /target\.interfaceLocation\.faceSegment\.map\(\(point\) => project/);
  assert.match(canvas, /if \(markLayout\?\.leader\)/);
  assert.match(canvas, /ctx\.moveTo\(markLayout\.leader\.start\.x, markLayout\.leader\.start\.y\)/);
  assert.match(canvas, /ctx\.fillText\(target\.mark, markLayout\.anchor\.x, markLayout\.anchor\.y\)/);
});
