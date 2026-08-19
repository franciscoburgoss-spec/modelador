import {
  isRecord
} from './structuralProposalCommon.js';

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
            || !Object.hasOwn(
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
