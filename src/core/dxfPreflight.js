import {
  dxfBoundsContain,
  isFiniteDxfBounds,
  unionDxfEntityBounds
} from './dxfGeometry.js';

export class DxfPreflightError extends Error {
  constructor(issues) {
    const safeIssues = Array.isArray(issues) ? issues : [];
    super(safeIssues.map((issue) => issue.message).join(' ') || 'La lámina DXF no supera el preflight.');
    this.name = 'DxfPreflightError';
    this.issues = safeIssues;
  }
}

function issue(code, message, details = {}) {
  return { severity: 'error', code, message, ...details };
}

export function assertPackableDxfEntries(entries, { layout, scale }) {
  const issues = [];
  if (!Number.isFinite(scale) || scale <= 0) {
    issues.push(issue('INVALID_SCALE', `La escala DXF debe ser positiva y finita; se recibió ${scale}.`));
  }
  if (!layout?.draw || !Number.isFinite(layout.viewLabelH)) {
    issues.push(issue('INVALID_LAYOUT', 'El área de dibujo de la lámina no es válida.'));
  }
  if (issues.length) throw new DxfPreflightError(issues);

  const drawWidth = layout.draw.x1 - layout.draw.x0;
  const drawHeight = layout.draw.y1 - layout.draw.y0;
  entries.forEach((entry, index) => {
    if (!isFiniteDxfBounds(entry.extent)
      || entry.extent.xMax <= entry.extent.xMin
      || entry.extent.yMax <= entry.extent.yMin) {
      issues.push(issue('INVALID_EXTENT', `La vista ${index + 1} tiene un extent inválido.`, { entryIndex: index }));
      return;
    }
    const paperWidth = (entry.extent.xMax - entry.extent.xMin) / scale;
    const paperHeight = (entry.extent.yMax - entry.extent.yMin) / scale;
    if (paperWidth > drawWidth + 0.01 || paperHeight + layout.viewLabelH > drawHeight + 0.01) {
      issues.push(issue(
        'VIEW_TOO_LARGE',
        `La vista ${index + 1} requiere ${paperWidth.toFixed(1)} × ${(paperHeight + layout.viewLabelH).toFixed(1)} mm y no cabe en ${drawWidth.toFixed(1)} × ${drawHeight.toFixed(1)} mm.`,
        { entryIndex: index, paperWidth, paperHeight }
      ));
    }
  });
  if (issues.length) throw new DxfPreflightError(issues);
}

export function assertViewportContainsDxfEntities(entities, extent, context = {}) {
  const contentBounds = unionDxfEntityBounds(entities);
  if (!dxfBoundsContain(extent, contentBounds)) {
    throw new DxfPreflightError([
      issue(
        'VIEWPORT_CLIPPING',
        `La vista ${context.entryIndex + 1 || 1} recortaría entidades del modelo.`,
        { ...context, extent, contentBounds }
      )
    ]);
  }
  return contentBounds;
}
