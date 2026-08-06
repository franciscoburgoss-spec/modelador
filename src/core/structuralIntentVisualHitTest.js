function pointInPolygon(point, polygon) {
  let inside = false;
  for (let left = 0, right = polygon.length - 1; left < polygon.length; right = left, left += 1) {
    const a = polygon[left];
    const b = polygon[right];
    const crosses = ((a.y > point.y) !== (b.y > point.y))
      && point.x < ((b.x - a.x) * (point.y - a.y)) / ((b.y - a.y) || Number.EPSILON) + a.x;
    if (crosses) inside = !inside;
  }
  return inside;
}

function distanceToSegment(point, start, end) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) return Math.hypot(point.x - start.x, point.y - start.y);
  const t = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared));
  return Math.hypot(point.x - (start.x + t * dx), point.y - (start.y + t * dy));
}

export function structuralIntentVisualPolygons(target) {
  const geometry = target?.planGeometry;
  if (!geometry) return [];
  if (Array.isArray(geometry.polygon)) return [geometry.polygon];
  if (Array.isArray(geometry.solids)) return geometry.solids.map((solid) => solid.polygon).filter(Array.isArray);
  return [];
}

export function structuralIntentVisualTargetContains(target, point, tolerance = 0) {
  return structuralIntentVisualPolygons(target).some((polygon) => {
    if (pointInPolygon(point, polygon)) return true;
    if (!(tolerance > 0)) return false;
    return polygon.some((start, index) => distanceToSegment(point, start, polygon[(index + 1) % polygon.length]) <= tolerance);
  });
}

export function hitTestStructuralIntentVisualPreview(preview, point, tolerance = 0) {
  const selected = preview?.selected || [];
  for (let index = selected.length - 1; index >= 0; index -= 1) {
    if (structuralIntentVisualTargetContains(selected[index], point, tolerance)) return selected[index].id;
  }
  return null;
}
