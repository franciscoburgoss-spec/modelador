import assert from 'node:assert/strict';
import test from 'node:test';

import { buildSpec015eEvidence } from '../scripts/generate-spec015e-evidence.mjs';

test('BUG-015-E-003: anotaciones de planta salen a franja de callouts con líderes', async () => {
  const { svg } = await buildSpec015eEvidence();
  assert.match(svg, /class="plan-callout-layer"/);
  assert.match(svg, /class="plan-callout"/);
  assert.match(svg, /class="leader"/);
  assert.doesNotMatch(svg, /class="b1-label"/);
  assert.match(svg, /La geometría fuente permanece visible/);
});

test('BUG-015-E-004: foco usa halo y no repone trazo negro grueso sobre targets', async () => {
  const { svg, evidence } = await buildSpec015eEvidence();
  assert.match(svg, /\.target\{stroke:#64748b;stroke-width:1\.4\}/);
  assert.doesNotMatch(svg, /\.target\{stroke:#111827;stroke-width:3\}/);
  assert.match(svg, /\.focus-strong\{filter:drop-shadow/);
  assert.equal(evidence.visualReview.geometryPreservedUnderFocus, true);
});

test('BUG-015-E-005: C/6 y C/7 tienen detalles ampliados no a escala con cotas exactas', async () => {
  const { svg, evidence } = await buildSpec015eEvidence();
  assert.equal(evidence.visualReview.partialRegionsUseExplicitNotToScaleInsets, true);
  assert.match(svg, /C\/6 receptor · AMPLIADO · NO A ESCALA/);
  assert.match(svg, /C\/7 receptor de extremo · AMPLIADO · NO A ESCALA/);
  assert.match(svg, /L 101,1 mm/);
  assert.match(svg, /Extremo highS · S 2\.000 mm/);
  assert.match(svg, /Localización S 1\.999,9→2\.000 mm/);
  assert.match(svg, /tol\. 0,1 mm · Z 3\.250→4\.150 mm/);
  assert.match(svg, /La envolvente NO es longitud física/);
  assert.doesNotMatch(svg, /L 0,1 mm/);
  assert.deepEqual(evidence.regions.c6.longitudinalLocation, { kind: 'range', sRange: [1949.45, 2050.55] });
  assert.deepEqual(evidence.regions.c7.longitudinalLocation, { kind: 'end', end: 'highS', anchorS: 2000, localizationEnvelope: [1999.9, 2000] });
});

test('BUG-015-E-006: lateral usa descriptor humano primero y deja ID como referencia técnica', async () => {
  const { evidence, svg } = await buildSpec015eEvidence();
  assert.equal(evidence.visualReview.humanDescriptorsPrimary, true);
  assert.equal(evidence.lateralScenario.roofHuman.title, 'Faldón rectangular 1–6 entre B–H');
  assert.equal(evidence.lateralScenario.wallHuman.title, 'Muro X · 3→5 @ C1');
  assert.match(svg, />Faldón rectangular 1–6 entre B–H</);
  assert.match(svg, />Muro X · 3→5 @ C1</);
  assert.doesNotMatch(svg, />Cubierta 1785158713616/);
  assert.doesNotMatch(svg, />Muro 1784606313849/);
  assert.match(svg, /Ref\. técnica: cubierta 1785158713616/);
  assert.match(svg, /Ref\. técnica: muro 1784606313849/);
});

test('BUG-015-E-007: G1–G4 son inspeccionables y permanecen completeCandidate/notVerified', async () => {
  const { evidence, svg, html } = await buildSpec015eEvidence();
  assert.deepEqual(evidence.visualReview.gravityPathsInspectable, ['G1', 'G2', 'G3', 'G4']);
  assert.equal(evidence.gravityPaths.length, 4);
  for (const [index, pathItem] of evidence.gravityPaths.entries()) {
    assert.equal(pathItem.key, `g${index + 1}`);
    assert.equal(pathItem.label, `G${index + 1}`);
    assert.equal(pathItem.candidateState, 'completeCandidate');
    assert.equal(pathItem.verificationState, 'notVerified');
    assert.equal(pathItem.edges.length, 4);
    assert.ok(pathItem.display.source.includes('Faldón'));
    assert.ok(pathItem.display.receiver.includes('Muro'));
    assert.ok(pathItem.display.foundation.startsWith('Fundación corrida · eje '));
  }
  assert.match(svg, /G1–G4 · caminos gravitacionales candidatos inspeccionables/);
  assert.match(html, /data-focus="g1"[^>]*>G1</);
  assert.match(html, /data-focus="g4"[^>]*>G4</);
  assert.match(html, /Camino gravitacional seleccionado/);
});

test('B3.1: foco G1–G4 propaga a B1/C6/C7 sin ocultar geometría y detalle técnico queda secundario', async () => {
  const { svg, html } = await buildSpec015eEvidence();
  assert.match(svg, /data-focus="b1 g1 g4"/);
  assert.match(svg, /data-focus="c6 g1 g3"/);
  assert.match(svg, /data-focus="c7 g2 g4"/);
  assert.match(html, /split\(\/\\s\+\/\)\.includes\(focus\)/);
  assert.match(html, /Referencia técnica:/);
  assert.match(html, /notVerified/);
});


test('BUG-015-E-012: detalle C/7 separa la advertencia crítica en líneas legibles', async () => {
  const { svg } = await buildSpec015eEvidence();
  assert.match(svg, /class="detail-end-line">Extremo highS · S 2\.000 mm</);
  assert.match(svg, /class="detail-end-line">Localización S 1\.999,9→2\.000 mm</);
  assert.match(svg, /class="detail-end-line">tol\. 0,1 mm · Z 3\.250→4\.150 mm</);
  assert.match(svg, /class="detail-warning">La envolvente NO es longitud física</);
  assert.doesNotMatch(svg, /Envolvente de localización S 1\.999,9→2\.000 · tol\. 0,1 mm/);
  assert.doesNotMatch(svg, /Z 3\.250→4\.150 mm · la envolvente NO es longitud física/);
});
