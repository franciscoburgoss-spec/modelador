// render/trussLayout.js
// Dibujo de la elevación de UNA cercha de un agua (core/trussLayout.js) — vista propia con fit
// al canvas, mismo estilo/convención que render/osbModulation.js.
import { getRoofSystems } from '../core/roofPlaneOutputs.js';
import { parseElevationMode, toProjectionMode } from '../core/viewMode.js';
import { projectPlane } from '../core/projection.js';
import { resolveTrussProfileDims, memberRectCorners, purlinRectCorners, memberOffsetMode } from '../core/trussLayout.js';
// computeRoofPlanSegments/computeRoofElevationSegments viven en core (son datos puros, sin canvas)
// y se reexportan aquí para no romper los imports existentes (core/snapEngine.js, Canvas.jsx).
import { computeRoofPlanSegments, computeRoofElevationSegments } from '../core/roofSegments.js';
export { computeRoofPlanSegments, computeRoofElevationSegments };

const COLORS = {
  bottomChord: '#2b4a6f',
  topChord: '#2b4a6f',
  gutterChord: '#b5502a', // rebaje de canaleta destacado — es la decisión de diseño clave
  post: '#5a5a55',
  diagonal: '#8a8a85',
  purlin: '#8a6d3b'
};

/** Traza el contorno (sin relleno) de un polígono ya en coordenadas de pantalla — usado para el
 * rectángulo real de cada barra (perfil con su H verdadero, ver core/trussLayout.js). */
function strokePolygon(ctx, points) {
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
  ctx.closePath();
  ctx.stroke();
}

export function drawTrussElevation(ctx, geometry, width, height, library = null, padding = 32) {
  ctx.clearRect(0, 0, width, height);
  if (!geometry?.resolved) {
    ctx.fillStyle = '#8a8a85';
    ctx.font = '12px sans-serif';
    ctx.fillText(geometry?.warnings?.[0] || 'Sin geometría resuelta.', padding, height / 2);
    return;
  }

  const { span, heightHigh, members, purlins } = geometry;
  const scale = Math.min((width - padding * 2) / span, (height - padding * 2) / Math.max(heightHigh, 1));
  const originX = padding;
  const originY = height - padding;
  const toX = (x) => originX + x * scale;
  const toY = (y) => originY - y * scale;
  const toScreenPt = (p) => ({ x: toX(p.x), y: toY(p.y) });

  for (const m of members) {
    const { h } = resolveTrussProfileDims(library, m.profile, m.role === 'post' || m.role === 'diagonal' ? 40 : 90);
    const corners = memberRectCorners(m.x1, m.y1, m.x2, m.y2, h, memberOffsetMode(m.role)).map(toScreenPt);
    ctx.strokeStyle = COLORS[m.role] || '#5a5a55';
    ctx.lineWidth = 1.2;
    strokePolygon(ctx, corners);
  }

  // vano de canaleta (rebaje rectangular con fondo en la cuerda inferior): rectángulo punteado
  if (geometry.gutterNotch) {
    const { width: nw, height: nh } = geometry.gutterNotch;
    ctx.save();
    ctx.strokeStyle = COLORS.gutterChord;
    ctx.setLineDash([5, 4]);
    ctx.lineWidth = 1.2;
    ctx.strokeRect(toX(0), toY(nh), toX(nw) - toX(0), toY(0) - toY(nh));
    ctx.fillStyle = COLORS.gutterChord;
    ctx.font = '10px sans-serif';
    ctx.fillText('canaleta', toX(0) + 2, toY(nh) - 3);
    ctx.restore();
  }

  // costaneras: rectángulo real apoyado en la cara superior de la cuerda superior (no más allá
  // del límite verificado en computeRoofSystemLayout — ver memberRectCorners/purlinRectCorners)
  const topChordMember = members.find(m => m.role === 'topChord');
  if (topChordMember && purlins?.length) {
    const dx = topChordMember.x2 - topChordMember.x1, dy = topChordMember.y2 - topChordMember.y1;
    const len = Math.hypot(dx, dy) || 1;
    const tangent = [dx / len, dy / len];
    ctx.strokeStyle = COLORS.purlin;
    ctx.lineWidth = 1;
    for (const p of purlins) {
      const { h, b } = resolveTrussProfileDims(library, p.profile, 35, 40);
      const corners = purlinRectCorners(p, tangent, h, b / 2).map(toScreenPt);
      strokePolygon(ctx, corners);
    }
  }

  // cotas rápidas de referencia (luz y alturas)
  ctx.fillStyle = '#8a8a85';
  ctx.font = '11px sans-serif';
  ctx.fillText(`L = ${(span / 1000).toFixed(2)}m`, toX(span / 2) - 30, originY + 16);
  ctx.fillText(`${Math.round(geometry.heightLow)}mm`, toX(0) - padding + 2, toY(geometry.heightLow) - 4);
  ctx.fillText(`${Math.round(heightHigh)}mm`, toX(span) - 52, toY(heightHigh) - 6);
}

/** Planta: líneas de referencia de las cerchas de cada sistema (model.roofSystems) —
 * segmentos punteados perpendiculares entre los dos frontones, con marca en el extremo BAJO
 * (lado canaleta) para leer la orientación del agua de un vistazo. No son seleccionables. */
export function drawRoofSystemsPlan(ctx, model, project, view, canvasH, selectedRoofSystemId = null) {
  const segments = computeRoofPlanSegments(model);
  if (!segments.length) return;
  ctx.save();
  ctx.setLineDash([8, 5]);

  for (const s of segments) {
    const selected = selectedRoofSystemId != null && s.systemId === selectedRoofSystemId;
    const dimmed = selectedRoofSystemId != null && !selected;
    // Sesión 25: la cuerda superior de borde (contra la cara de un frontón) no es una cercha —
    // se dibuja continua y más fina para distinguirla de un vistazo en planta.
    const isEdge = s.kind === 'edgeChord';
    const color = selected ? '#e11d48' : (isEdge ? '#0d9488' : '#60a5fa');
    ctx.setLineDash(isEdge ? [] : [8, 5]);
    ctx.strokeStyle = color;
    ctx.lineWidth = selected ? 2.4 : (isEdge ? 1 : 1.2);
    ctx.globalAlpha = dimmed ? 0.35 : 1;
    const pa = project(s.h1, s.v1, 0, 'plan', view, canvasH);
    const pb = project(s.h2, s.v2, 0, 'plan', view, canvasH);
    ctx.beginPath(); ctx.moveTo(pa.x, pa.y); ctx.lineTo(pb.x, pb.y); ctx.stroke();
    // marca del extremo bajo (canaleta): círculo pequeño relleno
    ctx.setLineDash([]);
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(pa.x, pa.y, selected ? 4 : 3, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}

/** Elevación/corte: dibuja los sistemas de techumbre cuyo eje de corte coincide con la dirección
 * de avance de la cercha (system.runAxis) y cuya posición cae dentro del rango cubierto por las
 * cerchas — es decir, cuando el corte pasa efectivamente por la zona del techo. La geometría es
 * la misma para toda cercha del sistema (representativa/típica), ubicada en su cota de apoyo
 * real — sirve para revisar visualmente que la cercha queda escondida en el frontón y no montada
 * sobre él. No es seleccionable (solo referencia, igual que drawRoofSystemsPlan en planta). */
export function drawRoofSystemsElevation(ctx, model, modeStr, view, canvasH) {
  const parsed = parseElevationMode(modeStr);
  if (!parsed) return;
  const mode = toProjectionMode(modeStr);

  // agrupado por sistema (para la línea/etiqueta de cota de apoyo, que es por sistema, no por miembro)
  for (const system of getRoofSystems(model)) {
    const geo = system.trussGeometry;
    if (!geo?.resolved || !system.trussPositions?.length) continue;
    if (parsed.axisType !== system.runAxis) continue;
    const offsets = system.trussPositions.map(p => p.offset);
    const axes = parsed.axisType === 'x' ? model.grid.xAxes : model.grid.yAxes;
    const pos = axes.find(a => a.id === parsed.axisId)?.position;
    if (pos == null || pos < Math.min(...offsets) - 0.5 || pos > Math.max(...offsets) + 0.5) continue;

    const spanDir = system.spanDir ?? 1;
    const perp0 = system.runAxis === 'x' ? system.trussPositions[0].world.y : system.trussPositions[0].world.x;
    const h = (xLocal) => perp0 + spanDir * xLocal;
    const v = (yLocal) => system.supportElevation + yLocal;
    const pt = (xLocal, yLocal) => projectPlane(h(xLocal), v(yLocal), mode, view, canvasH);

    for (const m of geo.members) {
      const { h: profH } = resolveTrussProfileDims(model.library, m.profile, m.role === 'post' || m.role === 'diagonal' ? 40 : 90);
      const corners = memberRectCorners(m.x1, m.y1, m.x2, m.y2, profH, memberOffsetMode(m.role)).map(c => pt(c.x, c.y));
      ctx.strokeStyle = m.role === 'bottomChord' || m.role === 'topChord' ? '#2b4a6f' : '#60a5fa';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(corners[0].x, corners[0].y);
      for (let i = 1; i < corners.length; i++) ctx.lineTo(corners[i].x, corners[i].y);
      ctx.closePath();
      ctx.stroke();
    }
    const topChordMember = geo.members.find(m => m.role === 'topChord');
    if (topChordMember && geo.purlins?.length) {
      const dx = topChordMember.x2 - topChordMember.x1, dy = topChordMember.y2 - topChordMember.y1;
      const len = Math.hypot(dx, dy) || 1;
      const tangent = [dx / len, dy / len];
      ctx.strokeStyle = COLORS.purlin;
      ctx.lineWidth = 1;
      for (const p of geo.purlins) {
        const { h: profH, b: profB } = resolveTrussProfileDims(model.library, p.profile, 35, 40);
        const corners = purlinRectCorners(p, tangent, profH, profB / 2).map(c => pt(c.x, c.y));
        ctx.beginPath();
        ctx.moveTo(corners[0].x, corners[0].y);
        for (let i = 1; i < corners.length; i++) ctx.lineTo(corners[i].x, corners[i].y);
        ctx.closePath();
        ctx.stroke();
      }
    }
    if (geo.gutterNotch) {
      const { width: nw, height: nh } = geo.gutterNotch;
      const a = pt(0, 0), b = pt(nw, nh);
      ctx.save();
      ctx.strokeStyle = COLORS.gutterChord;
      ctx.setLineDash([5, 4]);
      ctx.lineWidth = 1.2;
      ctx.strokeRect(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.abs(b.x - a.x), Math.abs(b.y - a.y));
      ctx.restore();
    }

  }
}

