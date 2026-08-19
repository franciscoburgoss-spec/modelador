import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildMetalconVerticalCandidatesB33
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
  return buildMetalconVerticalCandidatesB33({
    frame: {
      ...structuredClone(BASE_FRAME),
      ...structuredClone(frame)
    },
    openings:
      structuredClone(openings),
    studSpacingMm
  });
}

function at(
  candidates,
  s
) {
  return candidates.filter(
    (candidate) =>
      candidate.s === s
  );
}

function normalized(
  candidates
) {
  return structuredClone(candidates)
    .sort(
      (left, right) => {
        const role =
          left.role.localeCompare(
            right.role
          );

        if (role !== 0) {
          return role;
        }

        const a =
          JSON.stringify(
            left.cause
          );

        const b =
          JSON.stringify(
            right.cause
          );

        return a.localeCompare(b);
      }
    );
}

test(
  'SPEC-016-B B3.3 / D-095: Pgrid y extremos conservan causas separadas',
  () => {
    const result =
      build({
        frame: {
          L: 2000,
          z0: 0,
          z1: 2400
        }
      });

    assert.deepEqual(
      normalized(
        at(
          result,
          0
        )
      ),
      normalized([
        {
          role: 'stud',
          cause: {
            kind: 'grid',
            sGrid: 0
          },
          s: 0,
          zMin: 0,
          zMax: 2400
        },
        {
          role: 'wallEnd',
          cause: {
            kind: 'wallEnd',
            side: 'start'
          },
          s: 0,
          zMin: 0,
          zMax: 2400
        }
      ])
    );

    assert.deepEqual(
      normalized(
        at(
          result,
          2000
        )
      ),
      normalized([
        {
          role: 'stud',
          cause: {
            kind: 'grid',
            sGrid: 2000
          },
          s: 2000,
          zMin: 0,
          zMax: 2400
        },
        {
          role: 'wallEnd',
          cause: {
            kind: 'wallEnd',
            side: 'end'
          },
          s: 2000,
          zMin: 0,
          zMax: 2400
        }
      ])
    );
  }
);

test(
  'SPEC-016-B B3.3 / D-095: grid coincidente con borde conserva stud y jamb separados',
  () => {
    const result =
      build({
        openings: [
          opening({
            sMin: 1000,
            sMax: 1200
          })
        ]
      });

    assert.deepEqual(
      normalized(
        at(
          result,
          1000
        )
      ),
      normalized([
        {
          role: 'stud',
          cause: {
            kind: 'grid',
            sGrid: 1000
          },
          s: 1000,
          zMin: 450,
          zMax: 3250
        },
        {
          role: 'jamb',
          cause: {
            kind: 'openingEdge',
            openingId: 200,
            edge: 'sMin'
          },
          s: 1000,
          zMin: 450,
          zMax: 3250
        }
      ])
    );
  }
);

test(
  'SPEC-016-B B3.3 / D-088/D-095: grid absorbido por borde conserva su causa grid original',
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

    assert.deepEqual(
      normalized(
        at(
          result,
          1000.1
        )
      ),
      normalized([
        {
          role: 'stud',
          cause: {
            kind: 'grid',
            sGrid: 1000
          },
          s: 1000.1,
          zMin: 450,
          zMax: 3250
        },
        {
          role: 'jamb',
          cause: {
            kind: 'openingEdge',
            openingId: 200,
            edge: 'sMin'
          },
          s: 1000.1,
          zMin: 450,
          zMax: 3250
        }
      ])
    );
  }
);

test(
  'SPEC-016-B B3.3 / D-095: extremo, grid y borde de opening pueden coexistir como tres causas',
  () => {
    const result =
      build({
        openings: [
          opening({
            sMin: 0,
            sMax: 1200
          })
        ]
      });

    assert.deepEqual(
      normalized(
        at(
          result,
          0
        )
      ),
      normalized([
        {
          role: 'stud',
          cause: {
            kind: 'grid',
            sGrid: 0
          },
          s: 0,
          zMin: 450,
          zMax: 3250
        },
        {
          role: 'wallEnd',
          cause: {
            kind: 'wallEnd',
            side: 'start'
          },
          s: 0,
          zMin: 450,
          zMax: 3250
        },
        {
          role: 'jamb',
          cause: {
            kind: 'openingEdge',
            openingId: 200,
            edge: 'sMin'
          },
          s: 0,
          zMin: 450,
          zMax: 3250
        }
      ])
    );
  }
);

test(
  'SPEC-016-B B3.3 / D-089/D-095: stud interior recortado conserva rol y causa grid',
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

    const studs =
      at(
        result,
        1000
      ).filter(
        (candidate) =>
          candidate.role
            === 'stud'
      );

    assert.deepEqual(
      studs,
      [
        {
          role: 'stud',
          cause: {
            kind: 'grid',
            sGrid: 1000
          },
          s: 1000,
          zMin: 450,
          zMax: 1000
        },
        {
          role: 'stud',
          cause: {
            kind: 'grid',
            sGrid: 1000
          },
          s: 1000,
          zMin: 2000,
          zMax: 3250
        }
      ]
    );
  }
);

test(
  'SPEC-016-B B3.3 / D-095: dos bordes autoritativos coincidentes conservan jambs separados por causa',
  () => {
    const result =
      build({
        openings: [
          opening({
            openingId: 201,
            sMin: 700,
            sMax: 1000,
            zMin: 800,
            zMax: 1200
          }),
          opening({
            openingId: 202,
            sMin: 1000,
            sMax: 1300,
            zMin: 1500,
            zMax: 1900
          })
        ]
      });

    const jambs =
      at(
        result,
        1000
      ).filter(
        (candidate) =>
          candidate.role
            === 'jamb'
      );

    assert.deepEqual(
      normalized(jambs),
      normalized([
        {
          role: 'jamb',
          cause: {
            kind: 'openingEdge',
            openingId: 201,
            edge: 'sMax'
          },
          s: 1000,
          zMin: 450,
          zMax: 3250
        },
        {
          role: 'jamb',
          cause: {
            kind: 'openingEdge',
            openingId: 202,
            edge: 'sMin'
          },
          s: 1000,
          zMin: 450,
          zMax: 3250
        }
      ])
    );
  }
);

test(
  'SPEC-016-B B3.3 / D-094/D-095: CUT-2 sólo expone roles propios del contrato nuevo',
  () => {
    const result =
      build({
        openings: [
          opening({
            sMin: 1000,
            sMax: 1200
          })
        ]
      });

    assert.deepEqual(
      [
        ...new Set(
          result.map(
            (candidate) =>
              candidate.role
          )
        )
      ].sort(),
      [
        'jamb',
        'stud',
        'wallEnd'
      ]
    );
  }
);
