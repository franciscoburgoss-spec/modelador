// tests/sheetLayout.test.mjs — Sesión 22 (lámina profesional: formatos, cajetín, revisiones)
import test from 'node:test';
import assert from 'node:assert/strict';
import { sheetLayout, PAPER_FORMATS, FORMAT_KEYS, resolveFormat } from '../src/core/sheetFormats.js';
import { titleBlockEntities, revisionTableEntities, fitText, scaleBarEntities } from '../src/core/sheetTitleBlock.js';
import { legendEntities, wrapText, DEFAULT_NOTES } from '../src/core/sheetLegend.js';
import { createProjectInfo, normalizeProjectInfo, nextRevisionLetter } from '../src/core/projectInfo.js';
import { buildSuffix } from '../src/core/dxfTemplateAC1015.js';

const numbersOf = (entity, code) =>
  [...entity.matchAll(new RegExp(`\\n${code}\\n(-?[\\d.]+)`, 'g'))].map((m) => parseFloat(m[1]));

/** Caja envolvente de una lista de entidades R12-simple (sólo LINE/TEXT, que es lo que usa el
 * rótulo de lámina). */
function bbox(entities) {
  const xs = [], ys = [];
  for (const e of entities) {
    xs.push(...numbersOf(e, 10), ...numbersOf(e, 11));
    ys.push(...numbersOf(e, 20), ...numbersOf(e, 21));
  }
  return { xMin: Math.min(...xs), xMax: Math.max(...xs), yMin: Math.min(...ys), yMax: Math.max(...ys) };
}

const infoFixture = () => ({
  ...createProjectInfo(),
  mandante: 'INMOBILIARIA X', obra: 'CASA LEO', ubicacion: 'RANCAGUA',
  proyectoNumero: '2026-014', dibujo: 'FM', reviso: 'FM', aprobo: 'FM', fecha: '23-07-2026'
});

const titleData = (over = {}) => ({
  ...infoFixture(), titulo: 'TABIQUERIA', laminaNumero: 'E-TAB-01',
  sheetIndex: 1, totalSheets: 3, scale: 50, revision: 'A', ...over
});

test('cada formato deja el cajetín, la leyenda y el área de dibujo dentro del marco', () => {
  for (const key of FORMAT_KEYS) {
    const l = sheetLayout(key, 1);
    assert.equal(l.paperW, PAPER_FORMATS[key].w, key);
    assert.ok(l.titleBlock.x1 <= l.inner.x1 + 1e-9, `cajetín dentro del marco en ${key}`);
    assert.ok(l.titleBlock.y0 >= l.inner.y0 - 1e-9, `cajetín dentro del marco en ${key}`);
    assert.ok(l.legend.x1 < l.titleBlock.x0, `leyenda no pisa el cajetín en ${key}`);
    assert.ok(l.draw.y0 > l.revisions.y1, `el área de dibujo arranca sobre las revisiones en ${key}`);
    assert.ok(l.draw.y1 > l.draw.y0 && l.draw.x1 > l.draw.x0, `área de dibujo válida en ${key}`);
  }
});

test('más revisiones suben el piso del área de dibujo, nunca al revés', () => {
  const sin = sheetLayout('A1', 0);
  const con = sheetLayout('A1', 6);
  assert.ok(con.revisions.y1 > sin.revisions.y1);
  assert.ok(con.draw.y0 > sin.draw.y0);
  assert.ok(con.draw.y1 === sin.draw.y1); // el techo del área de dibujo no cambia
});

test('formato desconocido cae a A1 en vez de reventar', () => {
  assert.equal(resolveFormat('A9'), 'A1');
  assert.equal(sheetLayout(undefined).key, 'A1');
});

test('el cajetín dibuja los datos de proyecto y nunca se sale de su caja', () => {
  const l = sheetLayout('A1', 1);
  const entities = titleBlockEntities(l, titleData());
  const content = entities.join('\n');
  for (const expected of ['INMOBILIARIA X', 'CASA LEO', 'RANCAGUA', 'PROYECTO N: 2026-014',
    'LAMINA N: E-TAB-01', 'HOJA 1 DE 3', 'ESCALA 1:50', 'FECHA: 23-07-2026', 'REV. A',
    'DIBUJO: FM', 'REVISO: FM', 'APROBO: FM']) {
    assert.ok(content.includes(expected), `falta "${expected}" en el cajetín`);
  }
  const b = bbox(entities);
  assert.ok(b.xMin >= l.titleBlock.x0 - 0.01 && b.xMax <= l.titleBlock.x1 + 0.01);
  assert.ok(b.yMin >= l.titleBlock.y0 - 0.01 && b.yMax <= l.titleBlock.y1 + 0.01);
});

test('campos vacíos salen como "-" y no como "undefined"', () => {
  const entities = titleBlockEntities(sheetLayout('A1'), titleData({ mandante: '', dibujo: '', revision: '' }));
  const content = entities.join('\n');
  assert.ok(!content.includes('undefined'));
  assert.ok(content.includes('DIBUJO: -'));
  assert.ok(content.includes('REV. -'));
});

test('fitText achica antes de truncar y nunca supera el ancho de la celda', () => {
  const corto = fitText('CASA LEO', 5, 100);
  assert.equal(corto.str, 'CASA LEO');
  assert.equal(corto.height, 5);

  const largo = fitText('INMOBILIARIA DESARROLLOS INMOBILIARIOS DEL VALLE CENTRAL SPA', 5, 40);
  assert.ok(largo.height < 5, 'debe achicar la altura');
  assert.ok(largo.str.length < 60, 'y truncar si aún no cabe');
});

test('la tabla de revisiones lista cada revisión y respeta el ancho del cajetín', () => {
  const l = sheetLayout('A1', 2);
  const revs = [
    { rev: 'A', fecha: '01-01-2026', descripcion: 'Emision original', autor: 'FM' },
    { rev: 'B', fecha: '15-02-2026', descripcion: 'Ajuste de vanos', autor: 'FM' }
  ];
  const entities = revisionTableEntities(l, revs);
  const content = entities.join('\n');
  assert.ok(content.includes('REV') && content.includes('DESCRIPCION'));
  assert.ok(content.includes('Emision original') && content.includes('Ajuste de vanos'));
  const b = bbox(entities);
  assert.ok(b.xMin >= l.revisions.x0 - 0.01 && b.xMax <= l.revisions.x1 + 0.01);
  assert.ok(b.yMax <= l.revisions.y1 + 0.01);
});

test('la leyenda trae simbología del tipo, cuadro de vistas y notas generales', () => {
  const l = sheetLayout('A1');
  const content = legendEntities(l, 'osb', ['D1 = MURO EJE A']).join('\n');
  assert.ok(content.includes('SIMBOLOGIA'));
  assert.ok(content.includes('CUADRO DE VISTAS') && content.includes('D1 = MURO EJE A'));
  assert.ok(content.includes('NOTAS GENERALES'));
  assert.ok(content.includes('Cadeneta'), 'nota propia de OSB'); // regla LP, decisión de Fran
});

// ★ R1 A-7 — leyenda de nomenclatura chilena (00-reglas-de-dominio.md §6). El gate de la spec
// dio negativo para un bloque nuevo; la salida fue reescribir la fila existente como la
// traducción, sin sumar filas por letra (solo D/A, que antes no existían). Se verifica sobre
// la lámina generada, no sobre la tabla — precedente s5: `column()` trunca en silencio.
test('R1 A-7: las nueve letras de tabiquería traen su nombre chileno en la leyenda (A3, peor caso)', () => {
  const l = sheetLayout('A3');
  const content = legendEntities(l, 'framing', []).join('\n');
  for (const [tag, nombre] of [
    ['K', 'Jamba'], ['J', 'Jamba'], ['C', 'Muchacho'], ['CS', 'Puntal'],
    ['E', 'Cabezal'], ['T', 'Pilar conformado'], ['R', 'Montante respaldo (legacy)'],
    ['D', 'Dintel'], ['A', 'Alfeizar']
  ]) {
    assert.ok(content.includes(`${tag} = ${nombre}`), `falta traducción de ${tag}`);
  }
});

test('R6-B: la leyenda describe el pilar L/T y su costura en toda la altura', () => {
  const l = sheetLayout('A1');
  const content = legendEntities(l, 'framing', []).join('\n');
  assert.ok(content.includes('T = Pilar conformado esquina/T'));
  assert.ok(content.includes('R = Montante respaldo (legacy)'));
  assert.ok(content.includes('tornillos N%%D10x3/4" @150 mm'));
  assert.ok(content.includes('en zig-zag'));
});

test('R1 A-7: nada se trunca en A3 con la nomenclatura nueva — sin marcador "(...)"', () => {
  const l = sheetLayout('A3');
  const content = legendEntities(l, 'framing', ['D1 = MURO EJE A', 'D2 = MURO EJE B']).join('\n');
  assert.ok(!content.includes('(...)'), 'SIMBOLOGIA se truncó: no entra ni con la reescritura');
  // las filas que ya existían antes de R1 (no letra) siguen presentes
  assert.ok(content.includes('SOLERAS-APOYO'));
  assert.ok(content.includes('EJES ='));
  assert.ok(content.includes('COTAS ='));
});

test('las notas del proyecto reemplazan a las notas default del tipo', () => {
  const l = sheetLayout('A1');
  const content = legendEntities(l, 'framing', [], ['Nota propia del proyecto']).join('\n');
  assert.ok(content.includes('1. Nota propia del proyecto'));
  assert.ok(!content.includes(DEFAULT_NOTES.framing[0].slice(0, 20)));
});

test('wrapText corta por palabra y no genera líneas vacías', () => {
  const lines = wrapText('Cotas en milimetros y niveles en metros respecto al nivel de piso terminado', 2.5, 40);
  assert.ok(lines.length > 1);
  assert.ok(lines.every((l) => l.trim().length > 0));
  assert.equal(lines.join(' ').replace(/\s+/g, ' '), 'Cotas en milimetros y niveles en metros respecto al nivel de piso terminado');
});

test('la escala gráfica elige una longitud redonda que cabe en el papel', () => {
  for (const scale of [25, 50, 100, 200]) {
    const content = scaleBarEntities(0, 0, scale, 1).join('\n');
    const label = content.match(/\n1\n([\d.]+)m/);
    assert.ok(label, `sin rótulo de longitud para 1:${scale}`);
    const paperLen = Number(label[1]) * 1000 / scale;
    assert.ok(paperLen >= 20 && paperLen <= 60, `barra de ${paperLen}mm en 1:${scale}`);
  }
});

test('normalizeProjectInfo completa modelos antiguos sin pisar lo que ya existe', () => {
  const info = normalizeProjectInfo({ obra: 'CASA LEO', revisiones: null });
  assert.equal(info.obra, 'CASA LEO');
  assert.deepEqual(info.revisiones, []);
  assert.equal(info.laminaPrefijo, 'E');
  assert.equal(normalizeProjectInfo(undefined).formato, 'A1');
});

test('nextRevisionLetter avanza A → B → C y tolera revisiones sin letra', () => {
  assert.equal(nextRevisionLetter([]), 'A');
  assert.equal(nextRevisionLetter([{ rev: 'A' }]), 'B');
  assert.equal(nextRevisionLetter([{ rev: 'A' }, { rev: 'B' }]), 'C');
  assert.equal(nextRevisionLetter([{ rev: '0' }]), 'A');
});

test('buildSuffix reescribe el tamaño de papel del layout y deja A1 intacto', () => {
  const a3 = buildSuffix(420, 297);
  assert.ok(a3.includes('\n 44\n420.0\n') && a3.includes('\n 45\n297.0\n'), 'PLOTSETTINGS');
  assert.ok(a3.includes('\n 11\n410.0\n') && a3.includes('\n 21\n287.0\n'), 'límites del layout');
  assert.equal(buildSuffix(841, 594), buildSuffix());
});
