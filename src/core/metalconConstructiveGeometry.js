import {
  cloneJson,
  isRecord
} from './structuralProposalCommon.js';
import { hasOwn } from './hasOwn.js';

export class MetalconConstructiveGeometryError
  extends Error {
  constructor(
    code,
    message,
    details = {}
  ) {
    super(message);

    this.name =
      'MetalconConstructiveGeometryError';

    this.code =
      code;

    this.details =
      details;
  }
}

function fail(
  code,
  message,
  details = {}
) {
  throw new MetalconConstructiveGeometryError(
    code,
    message,
    details
  );
}

function finitePoint(
  point
) {
  return (
    isRecord(point)
    && Number.isFinite(point.x)
    && Number.isFinite(point.y)
    && Number.isFinite(point.z)
  );
}

function canonicalHostEndpoints(
  prism
) {
  const {
    start,
    end
  } = prism;

  const isX =
    start.y === end.y
    && start.z === end.z
    && start.x !== end.x;

  const isY =
    start.x === end.x
    && start.z === end.z
    && start.y !== end.y;

  if (!isX && !isY) {
    fail(
      'INVALID_METALCON_B32_HOST_FRAME',
      'El host WALL no permite construir un frame X/Y exacto.'
    );
  }

  if (isX) {
    return {
      axis: 'x',
      start:
        start.x < end.x
          ? { ...start }
          : { ...end },
      end:
        start.x < end.x
          ? { ...end }
          : { ...start }
    };
  }

  return {
    axis: 'y',
    start:
      start.y < end.y
        ? { ...start }
        : { ...end },
    end:
      start.y < end.y
        ? { ...end }
        : { ...start }
  };
}

export function buildMetalconWallFrameB32(
  host
) {
  if (
    !isRecord(host)
    || host.type !== 'wall'
    || !isRecord(host.prism)
  ) {
    fail(
      'INVALID_METALCON_B32_HOST',
      'B3.2 requiere un host explícitamente tipado como wall.'
    );
  }

  const prism =
    host.prism;

  if (
    prism.kind !== 'oriented-prism'
    || !Number.isFinite(prism.height)
    || prism.height <= 0
    || !Number.isFinite(prism.thickness)
    || prism.thickness <= 0
  ) {
    fail(
      'INVALID_METALCON_B32_HOST_PRISM',
      'El prisma del host WALL no satisface kind, height y thickness de D-084.',
      {
        hostId: host.id
      }
    );
  }

  if (
    !finitePoint(prism.start)
    || !finitePoint(prism.end)
  ) {
    fail(
      'INVALID_METALCON_B32_HOST_COORDINATES',
      'Las coordenadas start/end del host WALL deben ser finitas.',
      {
        hostId: host.id
      }
    );
  }

  const canonical =
    canonicalHostEndpoints(
      prism
    );

  const L =
    canonical.axis === 'x'
      ? canonical.end.x
        - canonical.start.x
      : canonical.end.y
        - canonical.start.y;

  const z0 =
    canonical.start.z;

  const z1 =
    z0 + prism.height;

  if (
    !Number.isFinite(L)
    || L <= 0
    || !Number.isFinite(z1)
  ) {
    fail(
      'INVALID_METALCON_B32_HOST_FRAME',
      'El host WALL no permite construir L/z1 finitos y positivos.',
      {
        hostId: host.id
      }
    );
  }

  return {
    axis:
      canonical.axis,

    start:
      canonical.start,

    end:
      canonical.end,

    L,

    z0,

    z1,

    thickness:
      prism.thickness
  };
}

function openingRectangle(
  host,
  frame,
  opening,
  index
) {
  if (
    !isRecord(opening)
    || opening.hostWallId !== host.id
    || !['door', 'window']
      .includes(opening.kind)
    || !isRecord(opening.void)
  ) {
    fail(
      'INVALID_METALCON_B32_OPENING',
      'El opening no satisface hostWallId, kind o void requeridos por D-082.',
      {
        hostId: host.id,
        index
      }
    );
  }

  const voidPrism =
    opening.void;

  if (
    voidPrism.kind !== 'oriented-prism'
    || !finitePoint(voidPrism.start)
    || !finitePoint(voidPrism.end)
    || !Number.isFinite(
      voidPrism.thickness
    )
    || voidPrism.thickness <= 0
    || !Number.isFinite(
      voidPrism.height
    )
    || voidPrism.height <= 0
    || voidPrism.thickness
      !== host.prism.thickness
  ) {
    fail(
      'INVALID_METALCON_B32_OPENING',
      'El opening.void no satisface kind, coordenadas, height o thickness de D-082.',
      {
        hostId: host.id,
        openingId: opening.id,
        index
      }
    );
  }

  const {
    start,
    end
  } = voidPrism;

  let sStart;
  let sEnd;

  if (frame.axis === 'x') {
    if (
      start.y !== host.prism.start.y
      || end.y !== host.prism.start.y
      || start.z !== end.z
      || start.x === end.x
    ) {
      fail(
        'INVALID_METALCON_B32_OPENING_FRAME',
        'El opening.void no coincide exactamente con el frame X del host.',
        {
          hostId: host.id,
          openingId: opening.id,
          index
        }
      );
    }

    sStart =
      start.x - frame.start.x;

    sEnd =
      end.x - frame.start.x;
  } else {
    if (
      start.x !== host.prism.start.x
      || end.x !== host.prism.start.x
      || start.z !== end.z
      || start.y === end.y
    ) {
      fail(
        'INVALID_METALCON_B32_OPENING_FRAME',
        'El opening.void no coincide exactamente con el frame Y del host.',
        {
          hostId: host.id,
          openingId: opening.id,
          index
        }
      );
    }

    sStart =
      start.y - frame.start.y;

    sEnd =
      end.y - frame.start.y;
  }

  const rectangle = {
    openingId:
      opening.id,

    kind:
      opening.kind,

    sMin:
      Math.min(sStart, sEnd),

    sMax:
      Math.max(sStart, sEnd),

    zMin:
      start.z,

    zMax:
      start.z + voidPrism.height
  };

  if (
    !Number.isFinite(rectangle.sMin)
    || !Number.isFinite(rectangle.sMax)
    || !Number.isFinite(rectangle.zMax)
    || rectangle.sMin < 0
    || rectangle.sMax > frame.L
    || rectangle.zMin < frame.z0
    || rectangle.zMax > frame.z1
  ) {
    fail(
      'METALCON_B32_OPENING_OUTSIDE_HOST',
      'El opening.void excede exactamente el dominio M del host.',
      {
        hostId: host.id,
        openingId: opening.id,
        index,
        rectangle
      }
    );
  }

  return rectangle;
}

function assertNoOpeningOverlap(
  host,
  rectangles
) {
  for (
    let leftIndex = 0;
    leftIndex < rectangles.length;
    leftIndex += 1
  ) {
    for (
      let rightIndex =
        leftIndex + 1;
      rightIndex < rectangles.length;
      rightIndex += 1
    ) {
      const left =
        rectangles[leftIndex];

      const right =
        rectangles[rightIndex];

      const overlapS =
        Math.min(
          left.sMax,
          right.sMax
        )
        - Math.max(
          left.sMin,
          right.sMin
        );

      const overlapZ =
        Math.min(
          left.zMax,
          right.zMax
        )
        - Math.max(
          left.zMin,
          right.zMin
        );

      if (
        overlapS > 0
        && overlapZ > 0
      ) {
        fail(
          'METALCON_B32_OPENING_OVERLAP',
          'Dos openings del mismo host presentan solape 2D estrictamente positivo.',
          {
            hostId: host.id,
            leftOpeningId:
              left.openingId,
            rightOpeningId:
              right.openingId,
            overlapS,
            overlapZ
          }
        );
      }
    }
  }
}

export function inspectMetalconWallGeometryB32(
  host
) {
  const frame =
    buildMetalconWallFrameB32(
      host
    );

  if (!Array.isArray(host.openings)) {
    fail(
      'INVALID_METALCON_B32_OPENINGS',
      'El host WALL efectivo debe exponer openings como arreglo.',
      {
        hostId: host.id
      }
    );
  }

  const openings =
    host.openings.map(
      (opening, index) =>
        openingRectangle(
          host,
          frame,
          opening,
          index
        )
    );

  assertNoOpeningOverlap(
    host,
    openings
  );

  return {
    hostId:
      host.id,

    frame,

    openings
  };
}

export function inspectMetalconSelectedWallGeometryB32({
  effectiveGeometry,
  configuration
}) {
  if (
    !isRecord(effectiveGeometry)
    || !Array.isArray(
      effectiveGeometry.elements
    )
    || !isRecord(configuration)
    || !Array.isArray(
      configuration.constructionSelections
    )
  ) {
    fail(
      'INVALID_METALCON_B32_EFFECTIVE_INPUT',
      'B3.2 requiere effectiveGeometry y constructionSelections válidos.'
    );
  }

  const inspected =
    configuration
      .constructionSelections
      .map(
        (selection, index) => {
          if (
            !isRecord(selection)
            || !hasOwn(
              selection,
              'elementId'
            )
          ) {
            fail(
              'INVALID_METALCON_B32_SELECTED_TARGET',
              'Cada constructionSelection requiere elementId.',
              {
                index
              }
            );
          }

          const matches =
            effectiveGeometry
              .elements
              .filter(
                (element) =>
                  element?.id
                    === selection.elementId
              );

          if (matches.length !== 1) {
            fail(
              'METALCON_B32_SELECTED_HOST_NOT_UNIQUE',
              'El target seleccionado debe existir exactamente una vez en effectiveGeometry.elements.',
              {
                elementId:
                  selection.elementId,
                matches:
                  matches.length,
                index
              }
            );
          }

          return inspectMetalconWallGeometryB32(
            matches[0]
          );
        }
      );

  return inspected.sort(
    (left, right) => {
      const a =
        `${typeof left.hostId}:${String(left.hostId)}`;

      const b =
        `${typeof right.hostId}:${String(right.hostId)}`;

      return a.localeCompare(b);
    }
  );
}

const MATERIALIZATION_TOL_LINEAR_MM_B33 =
  0.1;

const MATERIALIZATION_MIN_SEGMENT_MM_B33 =
  0.1;

function canonicalMillimetersB33(
  value
) {
  return Number(
    value.toFixed(3)
  );
}

function machineSlackB33(
  ...values
) {
  const magnitude =
    values.reduce(
      (sum, value) =>
        sum + Math.abs(value),
      0
    );

  return (
    Number.EPSILON
    * Math.max(
      1,
      magnitude
    )
    * 8
  );
}

function withinLinearToleranceB33(
  left,
  right
) {
  const distance =
    Math.abs(
      left - right
    );

  if (
    distance
      < MATERIALIZATION_TOL_LINEAR_MM_B33
  ) {
    return true;
  }

  return (
    Math.abs(
      distance
      - MATERIALIZATION_TOL_LINEAR_MM_B33
    )
    <= machineSlackB33(
      left,
      right,
      MATERIALIZATION_TOL_LINEAR_MM_B33
    )
  );
}

function sameDistanceB33(
  left,
  right,
  ...coordinates
) {
  return (
    Math.abs(
      left - right
    )
    <= machineSlackB33(
      left,
      right,
      ...coordinates
    )
  );
}

function segmentExceedsMinimumB33(
  zMin,
  zMax
) {
  const length =
    zMax - zMin;

  const slack =
    machineSlackB33(
      zMin,
      zMax,
      MATERIALIZATION_MIN_SEGMENT_MM_B33
    );

  return (
    length
    > MATERIALIZATION_MIN_SEGMENT_MM_B33
      + slack
  );
}

function assertVerticalInputB33({
  frame,
  openings,
  studSpacingMm
}) {
  if (
    !isRecord(frame)
    || !Array.isArray(openings)
  ) {
    fail(
      'INVALID_METALCON_B33_INPUT',
      'B3.3 requiere frame B3.2 y openings como arreglo.'
    );
  }

  if (
    !Number.isFinite(frame.L)
    || frame.L <= 0
    || !Number.isFinite(frame.z0)
    || !Number.isFinite(frame.z1)
    || frame.z1 <= frame.z0
  ) {
    fail(
      'INVALID_METALCON_B33_FRAME',
      'El frame B3.2 no posee L/z0/z1 finitos y válidos.'
    );
  }

  if (
    !Number.isFinite(studSpacingMm)
    || studSpacingMm <= 0
  ) {
    fail(
      'INVALID_METALCON_B33_SPACING',
      'B3.3 requiere studSpacingMm finito y estrictamente positivo.'
    );
  }

  for (
    let index = 0;
    index < openings.length;
    index += 1
  ) {
    const opening =
      openings[index];

    if (
      !isRecord(opening)
      || !Number.isFinite(
        opening.sMin
      )
      || !Number.isFinite(
        opening.sMax
      )
      || !Number.isFinite(
        opening.zMin
      )
      || !Number.isFinite(
        opening.zMax
      )
      || opening.sMin < 0
      || opening.sMax
        > frame.L
      || opening.sMin
        >= opening.sMax
      || opening.zMin
        < frame.z0
      || opening.zMax
        > frame.z1
      || opening.zMin
        >= opening.zMax
    ) {
      fail(
        'INVALID_METALCON_B33_OPENING',
        'B3.3 recibió un Oi que no pertenece al dominio geométrico B3.2.',
        {
          index,
          openingId:
            opening?.openingId
        }
      );
    }
  }
}

function buildGridPositionsB33(
  L,
  studSpacingMm
) {
  const grid = [];

  for (
    let n = 0;
    ;
    n += 1
  ) {
    const s =
      n * studSpacingMm;

    if (!(s < L)) {
      break;
    }

    grid.push(s);
  }

  grid.push(L);

  return grid;
}

function openingEdgesB33(
  openings
) {
  return [
    ...new Set(
      openings.flatMap(
        (opening) => [
          opening.sMin,
          opening.sMax
        ]
      )
    )
  ].sort(
    (left, right) =>
      left - right
  );
}

function resolveGridPositionB33(
  sGrid,
  edges
) {
  const eligible =
    edges
      .filter(
        (sEdge) =>
          withinLinearToleranceB33(
            sGrid,
            sEdge
          )
      )
      .map(
        (sEdge) => ({
          sEdge,
          distance:
            Math.abs(
              sGrid - sEdge
            )
        })
      );

  if (eligible.length === 0) {
    return sGrid;
  }

  const minimum =
    Math.min(
      ...eligible.map(
        (entry) =>
          entry.distance
      )
    );

  const nearest =
    eligible.filter(
      (entry) =>
        sameDistanceB33(
          entry.distance,
          minimum,
          sGrid,
          entry.sEdge
        )
    );

  if (nearest.length !== 1) {
    fail(
      'METALCON_B33_AMBIGUOUS_GRID_EDGE',
      'Un candidato de grid tiene múltiples bordes autoritativos a distancia mínima exacta.',
      {
        sGrid,
        edges:
          nearest.map(
            (entry) =>
              entry.sEdge
          )
      }
    );
  }

  return nearest[0].sEdge;
}

function candidatePositionsB33(
  frame,
  openings,
  studSpacingMm
) {
  const edges =
    openingEdgesB33(
      openings
    );

  const effectiveGrid =
    buildGridPositionsB33(
      frame.L,
      studSpacingMm
    ).map(
      (sGrid) =>
        resolveGridPositionB33(
          sGrid,
          edges
        )
    );

  return [
    ...new Set([
      ...effectiveGrid,
      ...edges,
      0,
      frame.L
    ])
  ].sort(
    (left, right) =>
      left - right
  );
}

function subtractOpeningIntervalsB33(
  frame,
  openings,
  s
) {
  const intervals =
    openings
      .filter(
        (opening) => (
          opening.sMin < s
          && s < opening.sMax
        )
      )
      .map(
        (opening) => ({
          zMin:
            opening.zMin,
          zMax:
            opening.zMax
        })
      )
      .sort(
        (left, right) => (
          left.zMin
          - right.zMin
        )
      );

  const segments = [];
  let cursor =
    frame.z0;

  for (
    const interval
    of intervals
  ) {
    if (
      interval.zMin
      > cursor
    ) {
      segments.push({
        zMin:
          cursor,
        zMax:
          interval.zMin
      });
    }

    cursor =
      Math.max(
        cursor,
        interval.zMax
      );
  }

  if (
    cursor < frame.z1
  ) {
    segments.push({
      zMin:
        cursor,
      zMax:
        frame.z1
    });
  }

  return segments;
}

export function buildMetalconVerticalSegmentsB33({
  frame,
  openings,
  studSpacingMm
}) {
  assertVerticalInputB33({
    frame,
    openings,
    studSpacingMm
  });

  const positions =
    candidatePositionsB33(
      frame,
      openings,
      studSpacingMm
    );

  const result = [];

  for (
    const s
    of positions
  ) {
    const segments =
      subtractOpeningIntervalsB33(
        frame,
        openings,
        s
      );

    for (
      const segment
      of segments
    ) {
      if (
        !segmentExceedsMinimumB33(
          segment.zMin,
          segment.zMax
        )
      ) {
        continue;
      }

      result.push({
        s:
          canonicalMillimetersB33(
            s
          ),
        zMin:
          canonicalMillimetersB33(
            segment.zMin
          ),
        zMax:
          canonicalMillimetersB33(
            segment.zMax
          )
      });
    }
  }

  return result;
}

function verticalCausesB33(
  frame,
  openings,
  studSpacingMm
) {
  const authoritativeEdges =
    openingEdgesB33(
      openings
    );

  const causes = [];

  for (
    const sGrid
    of buildGridPositionsB33(
      frame.L,
      studSpacingMm
    )
  ) {
    causes.push({
      role: 'stud',
      cause: {
        kind: 'grid',
        sGrid
      },
      s:
        resolveGridPositionB33(
          sGrid,
          authoritativeEdges
        )
    });
  }

  causes.push(
    {
      role: 'wallEnd',
      cause: {
        kind: 'wallEnd',
        side: 'start'
      },
      s: 0
    },
    {
      role: 'wallEnd',
      cause: {
        kind: 'wallEnd',
        side: 'end'
      },
      s: frame.L
    }
  );

  for (
    const opening
    of openings
  ) {
    causes.push(
      {
        role: 'jamb',
        cause: {
          kind: 'openingEdge',
          openingId:
            opening.openingId,
          edge: 'sMin'
        },
        s:
          opening.sMin
      },
      {
        role: 'jamb',
        cause: {
          kind: 'openingEdge',
          openingId:
            opening.openingId,
          edge: 'sMax'
        },
        s:
          opening.sMax
      }
    );
  }

  return causes;
}

function compareVerticalCandidatesB33(
  left,
  right
) {
  if (left.s !== right.s) {
    return left.s - right.s;
  }

  if (left.zMin !== right.zMin) {
    return left.zMin - right.zMin;
  }

  if (left.zMax !== right.zMax) {
    return left.zMax - right.zMax;
  }

  const role =
    left.role.localeCompare(
      right.role
    );

  if (role !== 0) {
    return role;
  }

  return JSON.stringify(
    left.cause
  ).localeCompare(
    JSON.stringify(
      right.cause
    )
  );
}

export function buildMetalconVerticalCandidatesB33({
  frame,
  openings,
  studSpacingMm
}) {
  assertVerticalInputB33({
    frame,
    openings,
    studSpacingMm
  });

  const causes =
    verticalCausesB33(
      frame,
      openings,
      studSpacingMm
    );

  const candidates = [];

  for (
    const entry
    of causes
  ) {
    const segments =
      subtractOpeningIntervalsB33(
        frame,
        openings,
        entry.s
      );

    for (
      const segment
      of segments
    ) {
      if (
        !segmentExceedsMinimumB33(
          segment.zMin,
          segment.zMax
        )
      ) {
        continue;
      }

      candidates.push({
        role:
          entry.role,

        cause:
          cloneJson(
            entry.cause
          ),

        s:
          canonicalMillimetersB33(
            entry.s
          ),

        zMin:
          canonicalMillimetersB33(
            segment.zMin
          ),

        zMax:
          canonicalMillimetersB33(
            segment.zMax
          )
      });
    }
  }

  return candidates.sort(
    compareVerticalCandidatesB33
  );
}
