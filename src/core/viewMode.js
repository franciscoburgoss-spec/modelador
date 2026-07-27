// core/viewMode.js
export function isElevationMode(modeStr) {
  return typeof modeStr === 'string' && modeStr.startsWith('elevation-');
}

/** 'elevation-x-3' -> { axisType: 'x', axisId: 3 } */
export function parseElevationMode(modeStr) {
  if (!isElevationMode(modeStr)) return null;
  const parts = modeStr.split('-');
  if (parts.length !== 3) return null;
  return { axisType: parts[1], axisId: parseInt(parts[2], 10) };
}

/** Convierte el modeStr guardado en el store al 'mode' compacto que espera projection.js */
export function toProjectionMode(modeStr) {
  if (!isElevationMode(modeStr)) return 'plan';
  const parsed = parseElevationMode(modeStr);
  return parsed ? { axis: parsed.axisType } : 'plan';
}
