// tests/exportDxf.test.mjs — Sesión 16 (Bug 1: orientación de planta)
// Criterio: el orden de los ejes Y en el DXF debe coincidir con el orden que produce
// toPlane/toScreen en el canvas (mode='plan', flipY=false → world Y crece hacia abajo, igual
// que la pantalla). En DXF, Y crece hacia arriba: el eje con menor Y de mundo (más arriba en
// pantalla) debe terminar con el MAYOR Y de papel (más arriba en el DXF), y viceversa.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateDxf } from '../src/core/exportDxf.js';

const grid = {
  xAxes: [{ id: 1, position: 0, label: 'A' }, { id: 2, position: 5000, label: 'B' }],
  // asimétricos a propósito: 0 (arriba en pantalla), 1000, 6000 (abajo en pantalla)
  yAxes: [{ id: 11, position: 0, label: '1' }, { id: 12, position: 1000, label: '2' }, { id: 13, position: 6000, label: '3' }]
};

const model = { grid, elements: [], projectParams: [], dimensions: [] };

// Extrae, para cada línea 'EJES' horizontal (eje Y de grilla: x1 != x2, y1 == y2), su Y de papel.
function extractYAxisPaperYs(dxf) {
  const tokens = dxf.split('\n');
  const ys = [];
  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i] !== '0' || tokens[i + 1] !== 'LINE') continue;
    const get = (code) => {
      const idx = tokens.indexOf(code, i);
      return idx === -1 || idx > i + 20 ? null : parseFloat(tokens[idx + 1]);
    };
    const layerIdx = tokens.indexOf('8', i);
    const layer = layerIdx !== -1 && layerIdx <= i + 3 ? tokens[layerIdx + 1] : null;
    if (layer !== 'EJES') continue;
    const [x1, y1, x2, y2] = [get('10'), get('20'), get('11'), get('21')];
    if (x1 !== x2 && y1 === y2) ys.push(y1); // horizontal → eje Y de grilla
  }
  return ys;
}

test('exportDxf: orden de ejes Y en el DXF es el inverso del orden en pantalla (mundo Y-abajo → papel Y-arriba)', () => {
  const dxf = generateDxf(model);
  const paperYs = extractYAxisPaperYs(dxf);
  assert.equal(paperYs.length, 3);
  // mundo ascendente [0, 1000, 6000] (de arriba a abajo en pantalla) → papel debe salir
  // estrictamente descendente (de arriba a abajo en el DXF, coherente con Y-arriba).
  assert.ok(paperYs[0] > paperYs[1] && paperYs[1] > paperYs[2],
    `esperaba orden descendente en papel, obtuve ${paperYs}`);
});
