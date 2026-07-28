import test from 'node:test';
import assert from 'node:assert/strict';

import {
  appendCalculixKinematicProbe,
  assertCalculixDisplacements,
  assertCalculixInpContract,
  assertCalculixSolverCompletion,
  parseCalculixDatDisplacements,
  parseCalculixFrdDisplacements,
  parseCalculixInpContract
} from '../src/core/calculixResults.js';
import {
  calculixIdSetName,
  compactCalculixName,
  rectangularGeneralProperties
} from '../src/core/calculixCommon.js';

const sourceInp = [
  '** fuente',
  '*NODE',
  '1, 0, 0, 0',
  '2, 1000, 0, 0',
  '*ELEMENT, TYPE=U1, ELSET=F_123',
  '1, 1, 2',
  '*MATERIAL, NAME=M',
  '*ELASTIC',
  '25000, 0.2',
  '*BEAM SECTION, ELSET=F_123, MATERIAL=M, SECTION=GENERAL',
  '240000, 3200000000, 0, 7200000000, 0',
  '0, 0, 1',
  ''
].join('\n');

test('SPEC-003-C2: compactación preserva IDs que caben y hashea los largos', () => {
  assert.equal(calculixIdSetName('WM', 1784600403613), 'WM_1784600403613');
  const first = calculixIdSetName('WM', 'muro-persistente-extremadamente-largo');
  const second = calculixIdSetName('WM', 'muro-persistente-extremadamente-largo');
  const other = calculixIdSetName('WM', 'muro-persistente-extremadamente-largo-2');
  assert.equal(first, second);
  assert.notEqual(first, other);
  assert.equal(first.length, 20);
  assert.equal(compactCalculixName('SET_CORTO'), 'SET_CORTO');
});

test('SPEC-003-C2: propiedades GENERAL reproducen el rectángulo gobernado', () => {
  const section = rectangularGeneralProperties(400, 1050);
  assert.equal(section.area, 420000);
  assert.equal(section.i11, 5600000000);
  assert.equal(section.i22, 38587500000);
  assert.ok(Math.abs(section.torsion - 17033435410.142893) < 1e-4);
  assert.throws(() => rectangularGeneralProperties(0, 1050), /inválido/);
});

test('SPEC-003-C2: contrato INP resuelve secciones y rechaza set largo o inexistente', () => {
  const contract = assertCalculixInpContract(sourceInp);
  assert.deepEqual([...contract.nodeIds], [1, 2]);
  assert.deepEqual([...contract.elementSets], ['F_123']);
  assert.equal(contract.unresolvedSectionReferences.length, 0);

  assert.throws(
    () => assertCalculixInpContract(
      sourceInp.replaceAll('F_123', 'FUNDACION_CON_NOMBRE_DEMASIADO_LARGO')
    ),
    /mayores a 20/
  );
  assert.throws(
    () => assertCalculixInpContract(
      sourceInp.replace('BEAM SECTION, ELSET=F_123', 'BEAM SECTION, ELSET=F_AJENA')
    ),
    /ELSET inexistente/
  );
});

test('SPEC-003-C2: sonda preserva byte a byte la fuente y sólo agrega su contrato cinemático', () => {
  const executed = appendCalculixKinematicProbe(sourceInp);
  assert.equal(executed.slice(0, sourceInp.length), sourceInp);
  const suffix = executed.slice(sourceInp.length);
  assert.match(suffix, /\*NSET, NSET=SMOKE_GLOBAL\n1, 2/);
  assert.match(suffix, /\*BOUNDARY\nSMOKE_GLOBAL, 1, 6/);
  assert.match(suffix, /\*STEP\n\*STATIC/);
  assert.match(suffix, /\*NODE FILE, NSET=SMOKE_GLOBAL\nU\n\*END STEP/);
  assert.doesNotMatch(suffix, /\*CLOAD|\*DLOAD/);
  assert.deepEqual(
    [...parseCalculixInpContract(executed).nodeSets.get('SMOKE_GLOBAL')],
    [1, 2]
  );
});

test('SPEC-003-C2: parser FRD admite campos científicos concatenados y seis componentes', () => {
  const frd = [
    ' -4  DISP        7    1',
    ' -5  D1          1    2    1    0',
    ' -1         1 0.00000E+00-3.96680E-02-3.09416E-01 3.91099E-04 0.00000E+00 0.00000E+00',
    ' -1         2 1.00000E-03 2.00000E-03 3.00000E-03 4.00000E-03 5.00000E-03 6.00000E-03',
    ' -3'
  ].join('\n');
  const displacements = parseCalculixFrdDisplacements(frd);
  assert.deepEqual(displacements.get(1), {
    ux: 0,
    uy: -0.039668,
    uz: -0.309416,
    rx: 0.000391099,
    ry: 0,
    rz: 0
  });
  const summary = assertCalculixDisplacements(displacements, [1, 2]);
  assert.equal(summary.nodeCount, 2);
  assert.equal(summary.valueCount, 12);
  assert.equal(summary.maxAbs, 0.309416);
});

test('SPEC-003-C2: parser DAT conserva último bloque y rechaza faltantes, ajenos y no finitos', () => {
  const dat = [
    ' displacements (vx,vy,vz) for set NFUND and time 0.5',
    ' 1 1E+00 1E+00 1E+00',
    ' displacements (vx,vy,vz) for set NFUND and time 1.0',
    ' 1 0E+00 0E+00 -8.75E-01',
    ' 2 0E+00 0E+00 NaN'
  ].join('\n');
  const displacements = parseCalculixDatDisplacements(dat);
  assert.equal(displacements.size, 2);
  assert.equal(displacements.get(1).uz, -0.875);
  assert.throws(
    () => assertCalculixDisplacements(displacements, [1, 2]),
    /no finito/
  );
  assert.throws(
    () => assertCalculixDisplacements(new Map([[1, { ux: 0, uy: 0, uz: 0 }]]), [1, 2]),
    /faltan=\[2\]/
  );
  assert.throws(
    () => assertCalculixDisplacements(new Map([
      [1, { ux: 0, uy: 0, uz: 0 }],
      [3, { ux: 0, uy: 0, uz: 0 }]
    ]), [1]),
    /ajenos=\[3\]/
  );
});

test('SPEC-003-C2: sólo el warning global exacto puede acompañar Job finished', () => {
  const allowed = '*WARNING: no degrees of freedom in the model';
  assert.deepEqual(
    assertCalculixSolverCompletion(
      { status: 0, stdout: `${allowed}\nJob finished\n`, stderr: '' },
      { allowedWarnings: [allowed] }
    ),
    { finished: true, warnings: [allowed] }
  );
  assert.throws(
    () => assertCalculixSolverCompletion({
      status: 0,
      stdout: '*ERROR reading *BEAM SECTION\nJob finished\n',
      stderr: ''
    }),
    /informó errores/
  );
  assert.throws(
    () => assertCalculixSolverCompletion({
      status: 0,
      stdout: '*WARNING: otro warning\nJob finished\n',
      stderr: ''
    }),
    /warnings no permitidos/
  );
  assert.throws(
    () => assertCalculixSolverCompletion({ status: 0, stdout: '', stderr: '' }),
    /no informó Job finished/
  );
  assert.throws(
    () => assertCalculixSolverCompletion({ status: 201, stdout: 'Job finished', stderr: '' }),
    /código 201/
  );
});
