// tests/goToElevationFromPlan.test.mjs — sesión 21 (UI B), parte B: doble click en planta →
// ir a la elevación. Integración completa sobre el store (no solo resolveElevationAxisForElement
// aislado): centrado de planta + cambio de layout/viewMode/viewB del OTRO panel.
import test from 'node:test';
import assert from 'node:assert/strict';
import { useModelStore } from '../src/store/useModelStore.js';

const grid = {
  xAxes: [{ id: 1, position: 0 }, { id: 2, position: 4000 }],
  yAxes: [{ id: 11, position: 0 }, { id: 12, position: 3000 }],
  zLevels: [{ id: 100, elevation: 0 }, { id: 200, elevation: 2400 }]
};

// Muro corre en X, fijo en Y=0 (eje 11) — su elevación es 'elevation-y-11'.
const wallX = {
  id: 'w1', type: 'wall', direction: 'x',
  xStart: 1, xEnd: 2, yStart: 11, yEnd: 11,
  thickness: 150, bottomZ: 100, topZ: 200
};

// Columna auxiliar cuyo centro Y (1500) no coincide con ningún eje de grilla — sirve para ubicar
// un muro "fuera de eje" por REFERENCIA a otro elemento (el caso real de la nota de la sesión 18:
// "si un muro quedó fuera de eje... aparece igual pero rotulado Y=..."), a diferencia de un ID de
// eje inexistente (que ni siquiera resuelve geometría, y por lo tanto no prueba lo mismo).
const helperColumn = { id: 'helper', type: 'column', axisXId: 1, axisYId: 11, offsetY: 1500, widthX: 100, widthY: 100 };
const wallOffAxis = {
  id: 'w2', type: 'wall', direction: 'x',
  xStart: 1, xEnd: 2, yStart: { refElementId: 'helper', edge: 'center' }, yEnd: { refElementId: 'helper', edge: 'center' },
  thickness: 150, bottomZ: 100, topZ: 200
};

function resetStore({ elements = [wallX], gridOverride = grid } = {}) {
  useModelStore.setState((s) => ({
    ...s,
    model: {
      ...s.model, grid: gridOverride, elements, roofSystems: [],
      viewMode: 'plan', selectedElementId: null, selectedRoofSystemId: 'algo-previo', currentZLevelId: null
    },
    layout: 'single',
    viewModeB: 'plan',
    view: { scale: 1, offsetX: -999, offsetY: -999, showAxes: true },
    viewB: { scale: 1, offsetX: -999, offsetY: -999, showAxes: true },
    past: [], future: []
  }));
}

test('doble click en panel A: planta (A) queda centrada y B pasa a la elevación del muro', () => {
  resetStore();
  useModelStore.getState().goToElevationFromPlan('w1', 'a', 800, 600);
  const s = useModelStore.getState();

  assert.equal(s.model.selectedElementId, 'w1');
  assert.equal(s.model.selectedRoofSystemId, null, 'limpia selección de techumbre previa');
  assert.equal(s.layout, 'split');

  // A: sigue en planta, recentrada sobre el muro (centro world x=2000,y=0) con SU propia escala.
  assert.equal(s.model.viewMode, 'plan');
  assert.equal(s.view.scale, 1, 'el panel de planta conserva su escala (no se re-encuadra)');
  assert.equal(s.view.offsetX, 2000 - 800 / 2 / 1);
  assert.equal(s.view.offsetY, 0 - 600 / 2 / 1);

  // B: pasa a la elevación 'y' del eje 11 (el muro corre en X, fijo en Y=0=eje 11).
  assert.equal(s.viewModeB, 'elevation-y-11');
  assert.ok(s.viewB.scale > 0);
});

test('doble click en panel B: B queda en planta centrada y A pasa a la elevación', () => {
  resetStore();
  useModelStore.setState((s) => ({ ...s, layout: 'split' }));
  useModelStore.getState().goToElevationFromPlan('w1', 'b', 400, 600);
  const s = useModelStore.getState();

  assert.equal(s.viewModeB, 'plan');
  assert.equal(s.viewB.offsetX, 2000 - 400 / 2 / 1);
  assert.equal(s.model.viewMode, 'elevation-y-11');
  assert.equal(s.layout, 'split');
});

test('muro fuera de eje de grilla (ubicado por referencia a otro elemento): solo recentra la planta, no toca el otro panel ni el layout', () => {
  resetStore({ elements: [wallOffAxis, helperColumn] });

  useModelStore.getState().goToElevationFromPlan('w2', 'a', 800, 600);
  const s = useModelStore.getState();

  assert.equal(s.model.selectedElementId, 'w2');
  assert.equal(s.layout, 'single', 'sin corte de elevación posible, no fuerza split');
  assert.equal(s.model.viewMode, 'plan');
  assert.equal(s.viewModeB, 'plan', 'panel B intacto');
  assert.equal(s.viewB.offsetX, -999, 'panel B sin tocar');
});

test('id inexistente: no rompe, deja el store intacto', () => {
  resetStore();
  const before = useModelStore.getState();
  useModelStore.getState().goToElevationFromPlan('no-existe', 'a', 800, 600);
  const after = useModelStore.getState();
  assert.equal(after.model, before.model, 'sin cambios: mismo objeto de modelo');
  assert.equal(after.layout, 'single');
});
