import assert from 'node:assert/strict';
import test from 'node:test';

import {
  MetalconConstructiveGeometryError,
  buildMetalconVerticalSegmentsB33
} from '../src/core/metalconConstructiveGeometry.js';

const BASE_FRAME = {
  axis: 'x',
  start: {
    x: 1000,
    y: 2000,
    z: 450
  },
  end: {
    x: 5000,
    y: 2000,
    z: 450
  },
  L: 4000,
  z0: 450,
  z1: 3250,
  thickness: 101.1
};

function opening({
  openingId = 200,
  kind = 'door',
  sMin = 900,
  sMax = 1100,
  zMin = 1000,
  zMax = 2000
} = {}) {
  return {
    openingId,
    kind,
    sMin,
    sMax,
    zMin,
    zMax
  };
}

function build({
  frame = {},
  openings = [],
  studSpacingMm = 1000
} = {}) {
  return buildMetalconVerticalSegmentsB33({
    frame: {
      ...structuredClone(BASE_FRAME),
      ...structuredClone(frame)
    },
    openings:
      structuredClone(openings),
    studSpacingMm
  });
}

function positions(
  segments
) {
  return [
    ...new Set(
      segments.map(
        (segment) => segment.s
      )
    )
  ];
}

function segmentsAt(
  segments,
  s
) {
  return segments.filter(
    (segment) =>
      segment.s === s
  );
}

function expectCode(
  action,
  code
) {
  assert.throws(
    action,
    (error) => (
      error
        instanceof MetalconConstructiveGeometryError
      && error.code === code
    )
  );
}

test(
  'SPEC-016-B B3.3 / D-091: d mayor que L produce sólo 0 y L',
  () => {
    const result =
      build({
        frame: {
          L: 500,
          z0: 0,
          z1: 1000
        },
        studSpacingMm: 600
      });

    assert.deepEqual(
      positions(result),
      [
        0,
        500
      ]
    );
  }
);

test(
  'SPEC-016-B B3.3 / D-091: Pgrid usa múltiplos directos n*d y agrega L una vez',
  () => {
    const result =
      build({
        frame: {
          L: 1000,
          z0: 0,
          z1: 1000
        },
        studSpacingMm: 333.333
      });

    assert.deepEqual(
      positions(result),
      [
        0,
        333.333,
        666.666,
        999.999,
        1000
      ]
    );
  }
);

test(
  'SPEC-016-B B3.3 / D-088: borde exactamente a 0.1 mm prevalece sobre grid',
  () => {
    const result =
      build({
        openings: [
          opening({
            sMin: 1000.1,
            sMax: 1200
          })
        ]
      });

    const s =
      positions(result);

    assert.equal(
      s.includes(1000),
      false
    );

    assert.equal(
      s.includes(1000.1),
      true
    );
  }
);

test(
  'SPEC-016-B B3.3 / D-088: borde a 0.1001 mm permanece distinto del grid',
  () => {
    const result =
      build({
        openings: [
          opening({
            sMin: 1000.1001,
            sMax: 1200
          })
        ]
      });

    const s =
      positions(result);

    assert.equal(
      s.includes(1000),
      true
    );

    assert.equal(
      s.includes(1000.1),
      true
    );
  }
);

test(
  'SPEC-016-B B3.3 / D-092: mínimo único recibe exclusivamente el candidato grid',
  () => {
    const result =
      build({
        openings: [
          opening({
            openingId: 201,
            sMin: 800,
            sMax: 999.9375
          }),
          opening({
            openingId: 202,
            sMin: 1000.09375,
            sMax: 1200
          })
        ]
      });

    const s =
      positions(result);

    assert.equal(
      s.includes(1000),
      false
    );

    assert.equal(
      s.includes(999.938),
      true
    );

    assert.equal(
      s.includes(1000.094),
      true
    );
  }
);

test(
  'SPEC-016-B B3.3 / D-092: empate exacto entre bordes distintos falla cerrado',
  () => {
    expectCode(
      () =>
        build({
          openings: [
            opening({
              openingId: 201,
              sMin: 800,
              sMax: 999.9375
            }),
            opening({
              openingId: 202,
              sMin: 1000.0625,
              sMax: 1200
            })
          ]
        }),
      'METALCON_B33_AMBIGUOUS_GRID_EDGE'
    );
  }
);

test(
  'SPEC-016-B B3.3 / D-089: posición en borde exacto de opening permanece continua',
  () => {
    const result =
      build({
        openings: [
          opening({
            sMin: 1000,
            sMax: 1200,
            zMin: 1000,
            zMax: 2000
          })
        ]
      });

    assert.deepEqual(
      segmentsAt(
        result,
        1000
      ),
      [
        {
          s: 1000,
          zMin: 450,
          zMax: 3250
        }
      ]
    );
  }
);

test(
  'SPEC-016-B B3.3 / D-089: posición estrictamente interior sustrae el intervalo Z',
  () => {
    const result =
      build({
        openings: [
          opening({
            sMin: 900,
            sMax: 1100,
            zMin: 1000,
            zMax: 2000
          })
        ]
      });

    assert.deepEqual(
      segmentsAt(
        result,
        1000
      ),
      [
        {
          s: 1000,
          zMin: 450,
          zMax: 1000
        },
        {
          s: 1000,
          zMin: 2000,
          zMax: 3250
        }
      ]
    );
  }
);

test(
  'SPEC-016-B B3.3 / D-090: segmento de longitud exactamente 0.1 mm se omite',
  () => {
    const result =
      build({
        openings: [
          opening({
            sMin: 900,
            sMax: 1100,
            zMin: 450.1,
            zMax: 3250
          })
        ]
      });

    assert.deepEqual(
      segmentsAt(
        result,
        1000
      ),
      []
    );
  }
);

test(
  'SPEC-016-B B3.3 / D-090: 0.1001 mm sobrevive aunque la salida se canonicalice después',
  () => {
    const result =
      build({
        openings: [
          opening({
            sMin: 900,
            sMax: 1100,
            zMin: 450.1001,
            zMax: 3250
          })
        ]
      });

    assert.deepEqual(
      segmentsAt(
        result,
        1000
      ),
      [
        {
          s: 1000,
          zMin: 450,
          zMax: 450.1
        }
      ]
    );
  }
);
