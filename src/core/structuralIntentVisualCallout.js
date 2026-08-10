const EPS = 1e-6;
const DEFAULT_BOX_HEIGHT = 24;
const DEFAULT_HORIZONTAL_PADDING = 12;
const DEFAULT_MIN_WIDTH = 26;
const DEFAULT_GAP = 8;

function finitePoint(point) {
  return point && Number.isFinite(point.x) && Number.isFinite(point.y);
}

function centerOf(points) {
  return {
    x: points.reduce((sum, point) => sum + point.x, 0) / points.length,
    y: points.reduce((sum, point) => sum + point.y, 0) / points.length
  };
}

function boundsOf(points) {
  return {
    xMin: Math.min(...points.map((point) => point.x)),
    xMax: Math.max(...points.map((point) => point.x)),
    yMin: Math.min(...points.map((point) => point.y)),
    yMax: Math.max(...points.map((point) => point.y))
  };
}

function midpoint(segment) {
  return {
    x: (segment[0].x + segment[1].x) / 2,
    y: (segment[0].y + segment[1].y) / 2
  };
}

function projectionHalfExtent(points, center, normal) {
  return Math.max(...points.map((point) => Math.abs(
    ((point.x - center.x) * normal.x) + ((point.y - center.y) * normal.y)
  )));
}

export function structuralIntentMarkLayout({
  polygon,
  faceSegment = null,
  textWidth = 0,
  interfaceKind = null,
  boxHeight = DEFAULT_BOX_HEIGHT,
  horizontalPadding = DEFAULT_HORIZONTAL_PADDING,
  minWidth = DEFAULT_MIN_WIDTH,
  gap = DEFAULT_GAP
} = {}) {
  if (!Array.isArray(polygon) || polygon.length < 3 || polygon.some((point) => !finitePoint(point))) return null;
  const width = Math.max(minWidth, Number(textWidth) + horizontalPadding);
  const height = boxHeight;
  const center = centerOf(polygon);
  const fallback = {
    anchor: center,
    box: { x: center.x - width / 2, y: center.y - height / 2, width, height },
    callout: false,
    leader: null
  };

  if (interfaceKind !== 'face'
    || !Array.isArray(faceSegment)
    || faceSegment.length !== 2
    || faceSegment.some((point) => !finitePoint(point))) return fallback;

  const bounds = boundsOf(polygon);
  const polygonWidth = bounds.xMax - bounds.xMin;
  const polygonHeight = bounds.yMax - bounds.yMin;
  const obscured = polygonWidth <= width + horizontalPadding
    && polygonHeight <= height + horizontalPadding;
  if (!obscured) return fallback;

  const faceMid = midpoint(faceSegment);
  const dx = center.x - faceMid.x;
  const dy = center.y - faceMid.y;
  const length = Math.hypot(dx, dy);
  if (!(length > EPS)) return fallback;

  const normal = { x: dx / length, y: dy / length };
  const polygonHalf = projectionHalfExtent(polygon, center, normal);
  const labelHalf = (Math.abs(normal.x) * width / 2) + (Math.abs(normal.y) * height / 2);
  const distance = polygonHalf + gap + labelHalf;
  const anchor = {
    x: center.x + normal.x * distance,
    y: center.y + normal.y * distance
  };
  return {
    anchor,
    box: { x: anchor.x - width / 2, y: anchor.y - height / 2, width, height },
    callout: true,
    leader: {
      start: {
        x: center.x + normal.x * polygonHalf,
        y: center.y + normal.y * polygonHalf
      },
      end: {
        x: anchor.x - normal.x * labelHalf,
        y: anchor.y - normal.y * labelHalf
      }
    }
  };
}
