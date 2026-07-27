// core/dxfPlanTransform.js
// Planta: projection.js usa flipY=false (mundo Y crece hacia abajo, igual que el canvas). DXF usa
// Y hacia arriba. Es una reflexión vertical sobre el rango [yMin, yMax] de la planta completa —
// por eso es su propia inversa (un solo helper sirve para ida y vuelta).
//
// Solo se transforma Y: X no cambia entre canvas y DXF (toScreen no toca sx). Los textos NO se
// reflejan (no hay mirror de glifos): esto solo reubica el punto de inserción, nunca la rotación.

export function makePlanToPaper(yMin, yMax) {
  const flipY = (y) => yMax + yMin - y;
  const point = ([x, y]) => [x, flipY(y)];
  return { flipY, point };
}
