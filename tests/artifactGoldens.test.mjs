import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  buildGoldenDocuments,
  NORMALIZATION_CONTRACT,
  summarizeCsv,
  summarizeDxf,
  summarizeInp,
  summarizeJson
} from '../scripts/lib/artifact-normalizers.mjs';
import {
  buildReferenceArtifacts,
  buildReferenceModels
} from '../scripts/lib/reference-artifacts.mjs';

const goldenDirectory = new URL('../harness/goldens/', import.meta.url);

function golden(filename) {
  return JSON.parse(readFileSync(new URL(filename, goldenDirectory), 'utf8'));
}

test('SPEC-003-B: los goldens semánticos son deterministas, LF y no mutan los modelos', () => {
  const models = buildReferenceModels();
  const before = structuredClone(models);
  const documents = buildGoldenDocuments(buildReferenceArtifacts(models));

  assert.deepEqual(models, before, 'generar artefactos debe ser puro respecto de los modelos');
  assert.deepEqual(golden('normalization-contract.json'), NORMALIZATION_CONTRACT);
  for (const format of ['json', 'csv', 'dxf', 'inp']) {
    assert.deepEqual(documents[format], golden(`${format}.golden.json`));
    assert.ok(documents[format].artifacts.every((artifact) => (
      artifact.lineEndings === 'LF' && artifact.terminalLineFeed
    )));
  }
});

test('SPEC-003-B: magnitud, referencia, unidad, capa y stale son contractuales', () => {
  const artifacts = buildReferenceArtifacts();
  const json = artifacts.find((artifact) => artifact.id === 'json-fx003-derived-fresh');
  const csv = artifacts.find((artifact) => artifact.id === 'csv-fx003-takeoff');
  const dxf = artifacts.find((artifact) => artifact.id === 'dxf-plan');
  const inp = artifacts.find((artifact) => artifact.id === 'inp-global');

  const changedMagnitude = JSON.parse(json.content);
  changedMagnitude.elements[0].thickness += 1;
  assert.notDeepEqual(
    summarizeJson(`${JSON.stringify(changedMagnitude)}\n`),
    summarizeJson(json.content)
  );

  const changedReference = JSON.parse(json.content);
  changedReference.elements[0].wallTypeId = 'TIPO-INEXISTENTE';
  assert.notDeepEqual(
    summarizeJson(`${JSON.stringify(changedReference)}\n`),
    summarizeJson(json.content)
  );

  const stale = JSON.parse(json.content);
  stale.elements[0].studsStale = true;
  assert.notDeepEqual(
    summarizeJson(`${JSON.stringify(stale)}\n`),
    summarizeJson(json.content)
  );

  assert.notDeepEqual(
    summarizeCsv(csv.content.replace(',ml,m2,m3,', ',ft,m2,m3,')),
    summarizeCsv(csv.content)
  );
  assert.notDeepEqual(
    summarizeDxf(dxf.content.replace(/\n8\nMUROS\n/, '\n8\nMUROS-ALTERADOS\n')),
    summarizeDxf(dxf.content)
  );
  assert.notDeepEqual(
    summarizeInp(inp.content.replace(/Unidades: mm/, 'Unidades: cm')),
    summarizeInp(inp.content)
  );
});

test('SPEC-003-B: existen ocho familias DXF y tres variantes INP con IDs persistidos', () => {
  const artifacts = buildReferenceArtifacts();
  const dxf = artifacts.filter((artifact) => artifact.format === 'dxf');
  const inp = artifacts.filter((artifact) => artifact.format === 'inp');
  const families = new Set(dxf.map((artifact) => artifact.family));

  assert.deepEqual(families, new Set([
    'plan',
    'foundations',
    'framing-r12',
    'framing-a3',
    'osb-r12',
    'osb-a3',
    'truss-r12',
    'truss-a3'
  ]));
  assert.equal(dxf.length, 9, 'OSB A3 ocupa dos láminas y ambas son contractuales');
  assert.deepEqual(
    inp.map((artifact) => artifact.family).sort(),
    ['calculix-foundations', 'calculix-global', 'calculix-truss']
  );
  assert.match(
    inp.find((artifact) => artifact.id === 'inp-global').content,
    /MONTANTES_M1784600403613/
  );
  assert.match(
    inp.find((artifact) => artifact.id === 'inp-truss').content,
    /FX4-RP-01__t0/
  );
  assert.match(
    inp.find((artifact) => artifact.id === 'inp-foundations').content,
    /1784817127997/
  );
  assert.equal(
    summarizeInp(inp.find((artifact) => artifact.id === 'inp-global').content).nonFiniteTokens,
    0
  );
  assert.equal(
    summarizeInp(inp.find((artifact) => artifact.id === 'inp-foundations').content).nonFiniteTokens,
    0
  );
  assert.equal(
    summarizeInp(inp.find((artifact) => artifact.id === 'inp-truss').content).nonFiniteTokens,
    0,
    'FX-004 persiste las propiedades mecánicas exigidas por la cercha'
  );

  const manifest = JSON.parse(
    readFileSync(new URL('../harness/fixtures.manifest.json', import.meta.url), 'utf8')
  );
  for (const fixture of manifest.fixtures) {
    assert.deepEqual(
      fixture.goldenOutputs,
      artifacts
        .filter((artifact) => artifact.sourceFixture === fixture.id)
        .map((artifact) => artifact.id)
        .sort(),
      `${fixture.id}: goldenOutputs debe enumerar exactamente sus artefactos`
    );
  }
});

test('SPEC-003-B: audit:dxf fija ezdxf y usa sólo el entorno Python del repositorio', () => {
  const packageJson = JSON.parse(
    readFileSync(new URL('../package.json', import.meta.url), 'utf8')
  );
  const requirements = readFileSync(
    new URL('../harness/python/requirements-dxf.txt', import.meta.url),
    'utf8'
  );
  const auditScript = readFileSync(
    new URL('../scripts/audit-dxf.mjs', import.meta.url),
    'utf8'
  );

  assert.equal(requirements, 'ezdxf==1.4.4\n');
  assert.equal(packageJson.scripts['audit:dxf'], 'node scripts/audit-dxf.mjs');
  assert.match(auditScript, /\.venv-verification\/bin\/python/);
  assert.match(auditScript, /spawnSync\(\s*python,/);
  assert.doesNotMatch(auditScript, /\bpython3\b|\/tmp\b/);
});
