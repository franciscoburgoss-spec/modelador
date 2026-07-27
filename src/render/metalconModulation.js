// render/metalconModulation.js
// Dibujo de la elevación simplificada de un muro con su despiece de montantes.
// Vista propia, independiente del pan/zoom del canvas principal (projection.js) — se ajusta
// (fit) al tamaño del <canvas> del modal.

export const ROLE_COLOR = {
  edge: '#1e2937',
  corner: '#1e2937',
  backup: '#8a8a85',
  stud: '#475569',
  king: '#b5502a',
  jack: '#c99a4a',
  cripple: '#94a3b8',
  crippleTop: '#c4b5a8',
  header: '#7c3aed',
  sill: '#0e7490',
  nogging: '#6b7b8c'
};

const ROLE_WIDTH = { edge: 3, corner: 4, backup: 2, stud: 2, king: 4, jack: 2, cripple: 2, crippleTop: 2 };

export function drawStudLayoutElevation(ctx, { studs, headers, length, wallHeight }, width, height, padding = 28) {
  ctx.clearRect(0, 0, width, height);
  if (!length || !wallHeight) {
    ctx.fillStyle = '#8a8a85';
    ctx.font = '12px sans-serif';
    ctx.fillText('Sin geometría resuelta para este muro.', padding, height / 2);
    return;
  }

  const scale = Math.min((width - padding * 2) / length, (height - padding * 2) / wallHeight);
  const originX = padding;
  const originY = height - padding;
  const toX = (o) => originX + o * scale;
  const toY = (z) => originY - z * scale;

  // soleras superior/inferior
  ctx.strokeStyle = '#1e2937';
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(toX(0), toY(0)); ctx.lineTo(toX(length), toY(0)); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(toX(0), toY(wallHeight)); ctx.lineTo(toX(length), toY(wallHeight)); ctx.stroke();

  for (const s of studs || []) {
    if (s.role === 'nogging') {
      ctx.fillStyle = ROLE_COLOR.nogging;
      ctx.fillRect(
        toX(s.oMin),
        toY(s.zMax),
        toX(s.oMax) - toX(s.oMin),
        toY(s.zMin) - toY(s.zMax)
      );
      continue;
    }
    ctx.strokeStyle = ROLE_COLOR[s.role] || '#475569';
    ctx.lineWidth = ROLE_WIDTH[s.role] || 2;
    ctx.beginPath();
    ctx.moveTo(toX(s.offset), toY(s.zMin));
    ctx.lineTo(toX(s.offset), toY(s.zMax));
    ctx.stroke();
  }

  // dintel (header) y antepecho (sill): piezas horizontales que atraviesan el vano
  for (const h of headers || []) {
    ctx.strokeStyle = ROLE_COLOR[h.role] || '#475569';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(toX(h.oMin), toY(h.z));
    ctx.lineTo(toX(h.oMax), toY(h.z));
    ctx.stroke();
  }
}

export const METALCON_ROLE_LABELS = {
  edge: 'Montante extremo',
  corner: 'Montante esquina/T',
  backup: 'Montante respaldo',
  stud: 'Montante relleno',
  king: 'Montante jamba (king)',
  jack: 'Montante bajo dintel (jack)',
  cripple: 'Montante bajo antepecho (cripple)',
  crippleTop: 'Montante sobre dintel (cripple)',
  header: 'Dintel',
  sill: 'Antepecho',
  nogging: 'Cadeneta'
};

/** Leyenda de colores por rol de montante, para la vista de Elevación principal (Canvas.jsx)
 * cuando el toggle "mostrar montantes" está activo — mismo estilo que la leyenda de categorías
 * que reemplaza (ver render/elevationGrid.js), en la esquina superior izquierda del canvas. */
export function drawMetalconLegend(ctx) {
  const order = [
    'edge', 'corner', 'backup', 'king', 'jack', 'cripple', 'crippleTop',
    'stud', 'header', 'sill', 'nogging'
  ];
  let legendY = 38;
  ctx.font = '12px system-ui';
  ctx.textBaseline = 'top';
  for (const role of order) {
    ctx.fillStyle = ROLE_COLOR[role];
    ctx.fillRect(14, legendY, 14, 14);
    ctx.strokeStyle = '#1e2937';
    ctx.lineWidth = 1;
    ctx.strokeRect(14, legendY, 14, 14);
    ctx.fillStyle = '#334155';
    ctx.fillText(METALCON_ROLE_LABELS[role], 34, legendY + 1);
    legendY += 20;
  }
}
