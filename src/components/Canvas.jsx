// components/Canvas.jsx
import { useRef, useEffect, useCallback, useState } from 'react';
import { useModelStore } from '../store/useModelStore.js';
import { project, projectPlane, screenToPlane, toScreen } from '../core/projection.js';
import { buildPlanSnapSegments, buildElevationSnapSegments, findSnapPoint } from '../core/snapEngine.js';
import { toProjectionMode, isElevationMode } from '../core/viewMode.js';
import { drawRoofPlaneDraft, drawRoofPlanesPlan, isNearFirstVertex } from '../render/roofPlaneDraft.js';
import { foundationPlanShape, foundationElevationRects, foundationElevationBBox } from '../core/foundationGeometry.js';
import { drawFoundationRunPlan, drawFoundationPadPlan, drawFoundationLayerElevation } from '../render/foundation.js';
import { resolveColumnGeometry, resolveBeamGeometry, resolveWallGeometry } from '../core/elementGeometry.js';
import { drawRectElement, drawSegmentElement } from '../render/draw.js';
import { elementMatchesFilter, isFilterActive } from '../core/attributeFilter.js';
import { isPointInRectElement, isPointNearSegmentElement, findRoofSystemAtPoint, findRoofPlaneAtPoint } from '../core/hitTest.js';
import { getRoofSystems } from '../core/roofPlaneOutputs.js';
import { drawWallPlan, drawWallElevation, drawWallStudsElevation, drawWallHeadersElevation, isPointInWallPlan, isPointInWallElevation, findOpeningAtPoint, findOpeningAtPointElevation } from '../render/wall.js';
import { drawRoofSystemsPlan, drawRoofSystemsElevation } from '../render/trussLayout.js';
import { drawMetalconLegend } from '../render/metalconModulation.js';
import { drawGrid } from '../render/grid.js';
import { drawElevationGrid, ELEVATION_CATEGORY_COLORS } from '../render/elevationGrid.js';
import { drawDimensionsPlan, drawDimensionsElevation, hitTestDimensionsPlan, hitTestDimensionsElevation } from '../render/dimensions.js';
import { getElementElevationCategory, getColumnElevationRect, getBeamElevationRect } from '../core/elevation.js';
import { isVisibleAtCurrentLevel, visibleRoofSystems } from '../core/levelVisibility.js';
import { buildParamsMap, resolveValue } from '../core/projectParams.js';
import { buildElementsById } from '../core/elementReferences.js';
import Viewer3D from './Viewer3DLazy.jsx';
import {
  hitTestStructuralIntentVisualPreview,
  structuralIntentVisualPolygons
} from '../core/structuralIntentVisualHitTest.js';

const PLAN_COLORS = {
  wall: { fill: '#475569', stroke: '#1e2937' },
  column: { fill: '#f59e0b', stroke: '#92400e', selectedFill: '#d97706', selectedStroke: '#1e40af' },
  beam: { fill: '#34d399', stroke: '#065f46', selectedFill: '#10b981', selectedStroke: '#1e40af' }
};

// Capa fantasma (ítem 3, sesión 21): opacidad de lo que queda sobre/bajo el plano Z actual,
// cuando el toggle "Ver > Capa fantasma" está activo. Apagada por defecto.
const GHOST_LAYER_ALPHA = 0.18;

// ★ Feature "agregar pilar con un clic en la intersección de ejes": desactivada a pedido del
// usuario (2026-07-20) hasta retomar esta discusión. Cambiar a `true` para reactivarla.
const QUICK_ADD_COLUMN_ENABLED = false;

/** Rectángulo envolvente de la fundación (todas sus capas) en el plano de elevación. */
function getFoundationElevationRect(el, grid, mode, paramsMap = {}, elementsById = {}) {
  if (mode === 'plan') return null;
  return foundationElevationBBox(el, grid, mode.axis, paramsMap, elementsById);
}

/** Rango h/v aproximado (bbox) de un muro en espacio de plano de elevación, para el resaltado del ítem 7. */
function wallElevationRange(wall, grid, mode, paramsMap = {}, elementsById = {}) {
  const geo = resolveWallGeometry(wall, grid, paramsMap, elementsById);
  const bottom = grid.zLevels.find(l => l.id === wall.bottomZ);
  const top = grid.zLevels.find(l => l.id === wall.topZ);
  if (!geo || !bottom || !top) return null;
  const thickness = geo.thickness || 200;
  const h1 = mode.axis === 'x' ? geo.p1.y : geo.p1.x;
  const h2 = mode.axis === 'x' ? geo.p2.y : geo.p2.x;
  return {
    hMin: Math.min(h1, h2) - thickness / 2,
    hMax: Math.max(h1, h2) + thickness / 2,
    vBottom: bottom.elevation,
    vTop: top.elevation
  };
}

/** Dibuja el rectángulo punteado de resaltado (ítem 7) entre dos puntos de pantalla, con margen. */
function strokeHighlightRect(ctx, ax, ay, bx, by, pad) {
  const x = Math.min(ax, bx) - pad;
  const y = Math.min(ay, by) - pad;
  ctx.strokeRect(x, y, Math.abs(bx - ax) + pad * 2, Math.abs(by - ay) + pad * 2);
}

function sameVisualId(left, right) {
  return `${typeof left}:${String(left)}` === `${typeof right}:${String(right)}`;
}

function drawStructuralIntentVisualTarget(ctx, target, view, canvasH, options = {}) {
  const polygons = structuralIntentVisualPolygons(target);
  if (polygons.length === 0) return;
  const active = options.active === true;
  const hovered = options.hovered === true;
  const context = options.context === true;
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.setLineDash(context ? [5, 5] : active ? [] : [10, 5]);
  ctx.lineWidth = context ? 1.5 : hovered ? 5 : active ? 4 : 3;
  ctx.strokeStyle = context ? '#6b7280' : hovered ? '#111827' : '#7c3aed';
  ctx.fillStyle = context ? 'rgba(107,114,128,0.08)' : 'rgba(124,58,237,0.16)';
  for (const polygon of polygons) {
    const screen = polygon.map((point) => project(point.x, point.y, 0, 'plan', view, canvasH));
    ctx.beginPath();
    screen.forEach((point, index) => index === 0 ? ctx.moveTo(point.x, point.y) : ctx.lineTo(point.x, point.y));
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    if (hovered && !context) {
      ctx.setLineDash([2, 4]);
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();
    }
  }
  if (!context && target.mark) {
    const allPoints = polygons.flat();
    const center = {
      x: allPoints.reduce((sum, point) => sum + point.x, 0) / allPoints.length,
      y: allPoints.reduce((sum, point) => sum + point.y, 0) / allPoints.length
    };
    const screen = project(center.x, center.y, 0, 'plan', view, canvasH);
    ctx.setLineDash([]);
    ctx.font = '700 13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const width = Math.max(26, ctx.measureText(target.mark).width + 12);
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#111827';
    ctx.lineWidth = 2;
    ctx.fillRect(screen.x - width / 2, screen.y - 12, width, 24);
    ctx.strokeRect(screen.x - width / 2, screen.y - 12, width, 24);
    ctx.fillStyle = '#111827';
    ctx.fillText(target.mark, screen.x, screen.y);
  }
  ctx.restore();
}

export default function Canvas({ panelId = 'a', showLocalToolbar = false, onQuickAddColumn }) {
  const canvasRef = useRef(null);
  const model = useModelStore((s) => s.model);
  const view = useModelStore((s) => (panelId === 'a' ? s.view : s.viewB));
  const viewMode = useModelStore((s) => (panelId === 'a' ? s.model.viewMode : s.viewModeB));
  const selectElement = useModelStore((s) => s.selectElement);
  const selectRoofSystem = useModelStore((s) => s.selectRoofSystem);
  const selectRoofPlane = useModelStore((s) => s.selectRoofPlane);
  const setViewMode = useModelStore((s) => (panelId === 'a' ? s.setViewMode : s.setViewModeB));
  const zoomIn = useModelStore((s) => (panelId === 'a' ? s.zoomIn : s.zoomInB));
  const zoomOut = useModelStore((s) => (panelId === 'a' ? s.zoomOut : s.zoomOutB));
  const setViewOffset = useModelStore((s) => (panelId === 'a' ? s.setViewOffset : s.setViewOffsetB));
  const fitToContent = useModelStore((s) => (panelId === 'a' ? s.fitToContent : s.fitToContentB));
  const attributeFilter = useModelStore((s) => s.attributeFilter);
  const showGhostLayer = useModelStore((s) => s.showGhostLayer);
  const layout = useModelStore((s) => s.layout);
  const structuralIntentLocator = useModelStore((s) => s.structuralIntentLocator);
  const goToElevationFromPlan = useModelStore((s) => s.goToElevationFromPlan);
  const legendCollapsed = useModelStore((s) => (panelId === 'a' ? s.legendCollapsedA : s.legendCollapsedB));
  const toggleLegendCollapsed = useModelStore((s) => s.toggleLegendCollapsed);
  // ★ B4.7.4a — dibujo del polígono del faldón (solo panel A, solo planta)
  const roofPlaneDraft = useModelStore((s) => s.roofPlaneDraft);
  const addRoofPlaneDraftVertex = useModelStore((s) => s.addRoofPlaneDraftVertex);
  const undoRoofPlaneDraftVertex = useModelStore((s) => s.undoRoofPlaneDraftVertex);
  const closeRoofPlaneDraft = useModelStore((s) => s.closeRoofPlaneDraft);
  const cancelRoofPlaneDraft = useModelStore((s) => s.cancelRoofPlaneDraft);
  const drafting = panelId === 'a' && roofPlaneDraft.active;
  const xAxes = model.grid.xAxes;
  const yAxes = model.grid.yAxes;

  const getCanvasHeight = useCallback(() => canvasRef.current?.clientHeight ?? 0, []);
  const [hover, setHover] = useState(null);
  const [quickAdd, setQuickAdd] = useState(null); // { x, y, axisX, axisY } en coords de pantalla + ejes snapeados
  const [showStuds, setShowStuds] = useState(false); // toggle: montantes de metalcon en Elevación (oculto por defecto)
  const [draftCursor, setDraftCursor] = useState(null); // world {x,y} del cursor mientras se dibuja el faldón
  const snapWorldRef = useRef(null); // último punto world snapeado (para clic/teclado en modo dibujo)

  // ---- lectura de coordenadas + reconocimiento de eje/intersección bajo el cursor ----
  const snapCacheRef = useRef({ model: null, key: null, segments: null });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const TOL_PX = 14;

    const onMove = (e) => {
      const rect = canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const canvasH = rect.height;
      const v = panelId === 'a' ? useModelStore.getState().view : useModelStore.getState().viewB;
      const vModeStr = panelId === 'a' ? useModelStore.getState().model.viewMode : useModelStore.getState().viewModeB;
      const model = useModelStore.getState().model;
      const grid = model.grid;
      const modeCompact = toProjectionMode(vModeStr);
      const flipY = modeCompact !== 'plan';
      const { h, v: vv } = screenToPlane(sx, sy, v, canvasH, flipY);

      const locatorState = useModelStore.getState().structuralIntentLocator;
      if (panelId === 'a' && modeCompact === 'plan' && locatorState.active) {
        const targetId = hitTestStructuralIntentVisualPreview(
          locatorState.preview,
          { x: h, y: vv },
          8 / v.scale
        );
        useModelStore.getState().setStructuralIntentLocatorHover(targetId);
      }

      // ★ snap tipo OSNAP (endpoint + intersección real, un solo tipo de punto — ver
      // core/snapEngine.js): segmentos cacheados por [model, modo] para no reconstruir en cada
      // mousemove; el modelo cambia de referencia en cada edición (store inmutable), así que la
      // identidad (===) es un invalidador de caché válido y barato.
      const cacheKey = modeCompact === 'plan' ? 'plan' : `elev:${vModeStr}`;
      let segments;
      if (snapCacheRef.current.model === model && snapCacheRef.current.key === cacheKey) {
        segments = snapCacheRef.current.segments;
      } else {
        const paramsMap = buildParamsMap(model.projectParams);
        const elementsById = buildElementsById(model.elements);
        segments = modeCompact === 'plan'
          ? buildPlanSnapSegments(model, paramsMap, elementsById)
          : buildElevationSnapSegments(model, vModeStr, paramsMap, elementsById);
        snapCacheRef.current = { model, key: cacheKey, segments };
      }
      const tolerancePlane = TOL_PX / v.scale;
      const snapPoint = findSnapPoint(segments, { h, v: vv }, tolerancePlane);
      const shown = snapPoint ? { h: snapPoint.h, v: snapPoint.v } : { h, v: vv };
      const snapScreen = snapPoint ? toScreen(snapPoint.h, snapPoint.v, v, canvasH, flipY) : null;

      // ★ B4.7.4a — punto world snapeado disponible para clic/teclado en modo dibujo; y cursor
      // (banda elástica) mientras se traza el faldón (solo planta, panel A).
      snapWorldRef.current = modeCompact === 'plan' ? { x: shown.h, y: shown.v } : null;
      if (panelId === 'a' && modeCompact === 'plan' && useModelStore.getState().roofPlaneDraft.active) {
        setDraftCursor({ x: shown.h, y: shown.v });
      }

      if (modeCompact === 'plan') {
        let snapX = null, distX = Infinity;
        for (const a of grid.xAxes) {
          const d = Math.abs((a.position - v.offsetX) * v.scale - sx);
          if (d < distX) { distX = d; snapX = a; }
        }
        let snapY = null, distY = Infinity;
        for (const a of grid.yAxes) {
          const d = Math.abs((a.position - v.offsetY) * v.scale - sy);
          if (d < distY) { distY = d; snapY = a; }
        }
        setHover({
          primary: `X: ${shown.h.toFixed(0)} mm   Y: ${shown.v.toFixed(0)} mm`,
          snapX: !snapPoint && distX < TOL_PX ? snapX : null,
          snapY: !snapPoint && distY < TOL_PX ? snapY : null,
          snapScreen
        });
      } else {
        setHover({ primary: `H: ${shown.h.toFixed(0)} mm   V: ${shown.v.toFixed(0)} mm`, snapX: null, snapY: null, snapScreen });
      }
    };
    const onLeave = () => {
      setHover(null);
      if (panelId === 'a') useModelStore.getState().setStructuralIntentLocatorHover(null);
    };

    canvas.addEventListener('mousemove', onMove);
    canvas.addEventListener('mouseleave', onLeave);
    return () => {
      canvas.removeEventListener('mousemove', onMove);
      canvas.removeEventListener('mouseleave', onLeave);
    };
  }, [panelId]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.floor(rect.width * dpr);
    canvas.height = Math.floor(rect.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, rect.width, rect.height);

    const modeStr = viewMode;
    const mode = toProjectionMode(modeStr);
    const canvasH = rect.height;

    if (mode === 'plan') drawGrid(ctx, model, mode, view, rect.width, canvasH);
    else {
      drawElevationGrid(ctx, model, modeStr, view, rect.width, canvasH, !showStuds && !legendCollapsed);
      if (showStuds && !legendCollapsed) drawMetalconLegend(ctx);
    }

    // Prioridad de dibujo fija (no depende del orden de creación): fundación abajo, estructura arriba.
    const DRAW_ORDER = { foundation: 0, wall: 1, beam: 2, column: 3 };
    const orderedElements = [...model.elements].sort((a, b) => (DRAW_ORDER[a.type] ?? 9) - (DRAW_ORDER[b.type] ?? 9));
    const paramsMap = buildParamsMap(model.projectParams);
    const elementsById = buildElementsById(model.elements);

    for (const el of orderedElements) {
      const isSelected = el.id === model.selectedElementId;
      let category = 1;
      let isGhost = false;
      if (mode !== 'plan') {
        category = getElementElevationCategory(el, modeStr, model.grid, elementsById, paramsMap);
        if (category === null) continue; // no aparece en este corte
      } else if (model.currentZLevelId != null) {
        if (!isVisibleAtCurrentLevel(el, model.grid, model.currentZLevelId, paramsMap, elementsById)) {
          if (!showGhostLayer) continue;
          isGhost = true;
        }
      }
      ctx.globalAlpha = isGhost ? GHOST_LAYER_ALPHA : 1;
      const catColor = ELEVATION_CATEGORY_COLORS[category] || ELEVATION_CATEGORY_COLORS[1];

      if (el.type === 'wall') {
        if (mode === 'plan') {
          drawWallPlan(ctx, el, model.grid, view, canvasH, isSelected, model.selectedElementId, paramsMap, elementsById, model.currentZLevelId);
        } else {
          drawWallElevation(ctx, el, model.grid, mode, view, canvasH, isSelected, showStuds
            ? { fill: '#f8fafc', stroke: '#94a3b8' }
            : { fill: catColor.fill, stroke: catColor.stroke }
          , paramsMap, elementsById);
          if (showStuds && el.studs?.length) {
            const studProfile = model.library.metalconProfiles?.find(p => p.id === el.framingStudProfileId) || null;
            drawWallStudsElevation(ctx, el, model.grid, mode, view, canvasH, studProfile, paramsMap, elementsById);
          }
          if (showStuds && el.headers?.length) {
            const trackProfile = model.library.metalconProfiles?.find(p => p.id === el.framingTrackProfileId) || null;
            drawWallHeadersElevation(ctx, el, model.grid, mode, view, canvasH, trackProfile, paramsMap, elementsById);
          }
        }
      }

      if (el.type === 'column') {
        if (mode === 'plan') {
          const geo = resolveColumnGeometry(el, model.grid, paramsMap, elementsById);
          if (!geo) continue;
          const center = project(geo.center.x, geo.center.y, 0, mode, view, canvasH);
          drawRectElement(ctx, center, geo.w * view.scale, geo.h * view.scale, {
            fill: isSelected ? PLAN_COLORS.column.selectedFill : PLAN_COLORS.column.fill,
            stroke: isSelected ? PLAN_COLORS.column.selectedStroke : PLAN_COLORS.column.stroke,
            lineWidth: isSelected ? 2.5 : 1.2,
            diagonals: true,
            diagonalColor: isSelected ? '#1e40af' : '#b45309'
          });
        } else {
          const rect = getColumnElevationRect(el, model.grid, mode, paramsMap, elementsById);
          if (rect) {
            const p1 = projectPlane(rect.hMin, rect.vBottom, mode, view, canvasH);
            const p2 = projectPlane(rect.hMax, rect.vTop, mode, view, canvasH);
            ctx.fillStyle = isSelected ? PLAN_COLORS.column.selectedFill : catColor.fill;
            ctx.strokeStyle = isSelected ? PLAN_COLORS.column.selectedStroke : catColor.stroke;
            ctx.lineWidth = isSelected ? 2.5 : 1.2;
            ctx.fillRect(p1.x, p2.y, p2.x - p1.x, p1.y - p2.y);
            ctx.strokeRect(p1.x, p2.y, p2.x - p1.x, p1.y - p2.y);
          }
        }
      }

      if (el.type === 'foundation') {
        if (mode === 'plan') {
          const shape = foundationPlanShape(el, model.grid, paramsMap, elementsById);
          if (!shape) continue;
          if (shape.kind === 'aislada') {
            const center = project(shape.center.x, shape.center.y, 0, mode, view, canvasH);
            drawFoundationPadPlan(ctx, center, shape.lengthX * view.scale, shape.lengthY * view.scale, { selected: isSelected });
          } else {
            const p1 = project(shape.p1.x, shape.p1.y, 0, mode, view, canvasH);
            const p2 = project(shape.p2.x, shape.p2.y, 0, mode, view, canvasH);
            drawFoundationRunPlan(ctx, p1, p2, (shape.width / 2) * view.scale, { selected: isSelected });
          }
        } else {
          for (const r of foundationElevationRects(el, model.grid, mode.axis, paramsMap, elementsById)) {
            const p1 = projectPlane(r.hMin, r.vBottom, mode, view, canvasH);
            const p2 = projectPlane(r.hMax, r.vTop, mode, view, canvasH);
            drawFoundationLayerElevation(ctx, r.name, p1.x, p1.y, p2.x, p2.y, { selected: isSelected });
          }
        }
      }

      if (el.type === 'beam') {
        if (mode === 'plan') {
          const geo = resolveBeamGeometry(el, model.grid, paramsMap, elementsById);
          if (!geo) continue;
          const p1 = project(geo.p1.x, geo.p1.y, 0, mode, view, canvasH);
          const p2 = project(geo.p2.x, geo.p2.y, 0, mode, view, canvasH);
          drawSegmentElement(ctx, p1, p2, (geo.width / 2) * view.scale, {
            fill: isSelected ? PLAN_COLORS.beam.selectedFill : PLAN_COLORS.beam.fill,
            stroke: isSelected ? PLAN_COLORS.beam.selectedStroke : PLAN_COLORS.beam.stroke,
            lineWidth: isSelected ? 2.5 : 1.2
          });
        } else {
          const rect = getBeamElevationRect(el, model.grid, mode, category, paramsMap, elementsById);
          if (rect) {
            const p1 = projectPlane(rect.hMin, rect.vBottom, mode, view, canvasH);
            const p2 = projectPlane(rect.hMax, rect.vTop, mode, view, canvasH);
            ctx.fillStyle = isSelected ? PLAN_COLORS.beam.selectedFill : catColor.fill;
            ctx.strokeStyle = isSelected ? PLAN_COLORS.beam.selectedStroke : catColor.stroke;
            ctx.lineWidth = isSelected ? 2.5 : 1.2;
            ctx.fillRect(p1.x, p2.y, p2.x - p1.x, p1.y - p2.y);
            ctx.strokeRect(p1.x, p2.y, p2.x - p1.x, p1.y - p2.y);
          }
        }
      }
    }
    ctx.globalAlpha = 1; // el último elemento del loop pudo quedar en modo fantasma

    // cerchas de techumbre: referencia punteada — planta (línea) o elevación (perfil real de
    // la cercha, cuando el corte cae dentro de la zona de techo). No seleccionables.
    if (mode === 'plan') {
      // ★ B4.7.4c — fuente = getRoofSystems (expande faldones); antes leía model.roofSystems, hoy
      // vacío, así que las cerchas solo se dibujaban con un nivel Z activo. Ahora salen siempre.
      const allRoofSystems = getRoofSystems(model);
      const visibleSystems = model.currentZLevelId != null ? visibleRoofSystems(model, model.library) : allRoofSystems;
      drawRoofSystemsPlan(ctx, { ...model, roofSystems: visibleSystems }, project, view, canvasH, model.selectedRoofSystemId);
      if (showGhostLayer && model.currentZLevelId != null) {
        const visibleIds = new Set(visibleSystems.map(s => s.id));
        const hiddenSystems = allRoofSystems.filter(s => !visibleIds.has(s.id));
        if (hiddenSystems.length) {
          ctx.globalAlpha = GHOST_LAYER_ALPHA;
          drawRoofSystemsPlan(ctx, { ...model, roofSystems: hiddenSystems }, project, view, canvasH, null);
          ctx.globalAlpha = 1;
        }
      }
      // contorno permanente del faldón (seleccionable) — separado de las cerchas derivadas
      drawRoofPlanesPlan(ctx, model.roofPlanes, view, canvasH, model.selectedRoofPlaneId);
    } else drawRoofSystemsElevation(ctx, model, modeStr, view, canvasH);

    if (isFilterActive(attributeFilter)) {
      ctx.save();
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 2.5;
      ctx.setLineDash([6, 4]);
      const PAD = 5;
      for (const el of orderedElements) {
        if (mode !== 'plan') {
          if (getElementElevationCategory(el, modeStr, model.grid, elementsById, paramsMap) === null) continue;
        } else if (model.currentZLevelId != null && !isVisibleAtCurrentLevel(el, model.grid, model.currentZLevelId, paramsMap, elementsById)) continue;
        if (!elementMatchesFilter(el, attributeFilter, model.grid, paramsMap, elementsById)) continue;

        if (el.type === 'wall') {
          if (mode === 'plan') {
            const geo = resolveWallGeometry(el, model.grid, paramsMap, elementsById);
            if (!geo) continue;
            const p1 = project(geo.p1.x, geo.p1.y, 0, mode, view, canvasH);
            const p2 = project(geo.p2.x, geo.p2.y, 0, mode, view, canvasH);
            strokeHighlightRect(ctx, p1.x, p1.y, p2.x, p2.y, PAD);
          } else {
            const range = wallElevationRange(el, model.grid, mode, paramsMap, elementsById);
            if (!range) continue;
            const p1 = projectPlane(range.hMin, range.vBottom, mode, view, canvasH);
            const p2 = projectPlane(range.hMax, range.vTop, mode, view, canvasH);
            strokeHighlightRect(ctx, p1.x, p1.y, p2.x, p2.y, PAD);
          }
        }

        if (el.type === 'column') {
          const geo = resolveColumnGeometry(el, model.grid, paramsMap, elementsById);
          if (!geo) continue;
          const center = project(geo.center.x, geo.center.y, 0, mode, view, canvasH);
          const w = geo.w * view.scale, h = geo.h * view.scale;
          strokeHighlightRect(ctx, center.x - w / 2, center.y - h / 2, center.x + w / 2, center.y + h / 2, PAD);
        }

        if (el.type === 'beam') {
          const geo = resolveBeamGeometry(el, model.grid, paramsMap, elementsById);
          if (!geo) continue;
          const p1 = project(geo.p1.x, geo.p1.y, 0, mode, view, canvasH);
          const p2 = project(geo.p2.x, geo.p2.y, 0, mode, view, canvasH);
          const half = (geo.width / 2) * view.scale;
          strokeHighlightRect(ctx, p1.x - half, p1.y - half, p2.x + half, p2.y + half, PAD);
        }

        if (el.type === 'foundation') {
          if (mode === 'plan') {
            const shape = foundationPlanShape(el, model.grid, paramsMap, elementsById);
            if (!shape) continue;
            if (shape.kind === 'aislada') {
              const c = project(shape.center.x, shape.center.y, 0, mode, view, canvasH);
              const w = shape.lengthX * view.scale, h = shape.lengthY * view.scale;
              strokeHighlightRect(ctx, c.x - w / 2, c.y - h / 2, c.x + w / 2, c.y + h / 2, PAD);
            } else {
              const p1 = project(shape.p1.x, shape.p1.y, 0, mode, view, canvasH);
              const p2 = project(shape.p2.x, shape.p2.y, 0, mode, view, canvasH);
              const half = (shape.width / 2) * view.scale;
              strokeHighlightRect(ctx, p1.x - half, p1.y - half, p2.x + half, p2.y + half, PAD);
            }
          } else {
            const rect = getFoundationElevationRect(el, model.grid, mode, paramsMap, elementsById);
            if (!rect) continue;
            const p1 = projectPlane(rect.hMin, rect.vBottom, mode, view, canvasH);
            const p2 = projectPlane(rect.hMax, rect.vTop, mode, view, canvasH);
            strokeHighlightRect(ctx, p1.x, p1.y, p2.x, p2.y, PAD);
          }
        }
      }
      ctx.restore();
    }

    if (mode === 'plan' && panelId === 'a' && structuralIntentLocator.active) {
      for (const target of structuralIntentLocator.preview?.context || []) {
        drawStructuralIntentVisualTarget(ctx, target, view, canvasH, { context: true });
      }
      for (const target of structuralIntentLocator.preview?.selected || []) {
        drawStructuralIntentVisualTarget(ctx, target, view, canvasH, {
          active: sameVisualId(target.id, structuralIntentLocator.activeId),
          hovered: sameVisualId(target.id, structuralIntentLocator.hoveredId)
        });
        for (const opening of target.openings || []) {
          drawStructuralIntentVisualTarget(ctx, {
            planGeometry: { polygon: opening.planGeometry?.polygon }, mark: null
          }, view, canvasH, { context: true });
        }
      }
    }

    if (mode === 'plan') drawDimensionsPlan(ctx, model, view, canvasH, elementsById, paramsMap);
    else drawDimensionsElevation(ctx, model, modeStr, view, canvasH, elementsById, paramsMap);

    // ★ B4.7.4a — polígono del faldón en curso/cerrado (solo panel A, planta)
    if (mode === 'plan' && panelId === 'a') {
      drawRoofPlaneDraft(ctx, roofPlaneDraft, roofPlaneDraft.active ? draftCursor : null, view, canvasH);
    }
    // `legendCollapsed` va acá aunque solo se use en el bloque de leyendas de arriba: sin él,
    // `draw` no se recreaba al colapsar y el useEffect (deps [draw]) no repintaba — el botón
    // cambiaba de color pero la leyenda seguía en pantalla.
  }, [model, view, viewMode, attributeFilter, showStuds, showGhostLayer, legendCollapsed, roofPlaneDraft, draftCursor, panelId, structuralIntentLocator]);

  useEffect(() => {
    draw();
    window.addEventListener('resize', draw);
    const canvas = canvasRef.current;
    const observer = canvas ? new ResizeObserver(() => draw()) : null;
    if (canvas && observer) observer.observe(canvas);
    return () => {
      window.removeEventListener('resize', draw);
      if (observer) observer.disconnect();
    };
  }, [draw]);

  // ★ B4.7.4a — teclado del dibujo de faldón: Enter cierra, Esc cancela, Backspace deshace vértice.
  useEffect(() => {
    if (!drafting) { setDraftCursor(null); return; }
    const onKey = (e) => {
      const t = e.target;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      if (e.key === 'Enter') { e.preventDefault(); closeRoofPlaneDraft(); }
      else if (e.key === 'Escape') { e.preventDefault(); cancelRoofPlaneDraft(); }
      else if (e.key === 'Backspace') { e.preventDefault(); undoRoofPlaneDraftVertex(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [drafting, closeRoofPlaneDraft, cancelRoofPlaneDraft, undoRoofPlaneDraftVertex]);

  const handleClick = useCallback((e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const mode = toProjectionMode(viewMode);
    const canvasH = getCanvasHeight();

    // ★ B4.7.4a — modo dibujo de faldón: cada clic agrega un vértice (punto snapeado a intersección
    // de eje). Clic sobre el primer vértice (≥3) cierra el contorno. Precede a toda selección.
    if (drafting && mode === 'plan') {
      if (isNearFirstVertex(roofPlaneDraft, { x: sx, y: sy }, view, canvasH)) { closeRoofPlaneDraft(); return; }
      const pt = snapWorldRef.current;
      if (pt) addRoofPlaneDraftVertex({ x: pt.x, y: pt.y });
      return;
    }

    const locatorState = useModelStore.getState().structuralIntentLocator;
    if (panelId === 'a' && mode === 'plan' && locatorState.active) {
      const point = screenToPlane(sx, sy, view, canvasH, false);
      const targetId = hitTestStructuralIntentVisualPreview(
        locatorState.preview,
        { x: point.h, y: point.v },
        8 / view.scale
      );
      if (targetId != null) useModelStore.getState().requestStructuralIntentLocatorTarget(targetId);
      return;
    }

    const paramsMap = buildParamsMap(model.projectParams);
    const elementsById = buildElementsById(model.elements);

    const dimHit = mode === 'plan'
      ? hitTestDimensionsPlan(sx, sy, model, view, canvasH, elementsById, paramsMap)
      : hitTestDimensionsElevation(sx, sy, model, viewMode, view, canvasH, elementsById, paramsMap);
    if (dimHit != null) return selectElement(dimHit);

    for (let i = model.elements.length - 1; i >= 0; i--) {
      const el = model.elements[i];
      if (mode !== 'plan' && getElementElevationCategory(el, viewMode, model.grid, elementsById, paramsMap) === null) continue;
      if (mode === 'plan' && model.currentZLevelId != null && !isVisibleAtCurrentLevel(el, model.grid, model.currentZLevelId, paramsMap, elementsById)) continue;

      if (el.type === 'wall' && mode === 'plan') {
        if (isPointInWallPlan(sx, sy, el, model.grid, view, canvasH, 8, paramsMap, elementsById, model.currentZLevelId)) {
          return selectElement(el.id);
        }
        const opening = findOpeningAtPoint(sx, sy, el, model.grid, view, canvasH, 12, paramsMap, elementsById, model.currentZLevelId);
        if (opening) {
          return selectElement(opening.id);
        }
      }

      if (el.type === 'wall' && mode !== 'plan') {
        const { h, v } = screenToPlane(sx, sy, view, canvasH, true);
        const margin = 8 / view.scale;
        // ★ Fix: chequear el vano ANTES que el muro. isPointInWallElevation evalúa contra el
        // rectángulo completo del muro (no excluye vanos como sí hace isPointInWallPlan), así
        // que si se chequeaba el muro primero, siempre ganaba él y el vano nunca era alcanzable
        // con clic en elevación.
        const opening = findOpeningAtPointElevation(h, v, el, model.grid, mode, margin, paramsMap, elementsById);
        if (opening) {
          return selectElement(opening.id);
        }
        if (isPointInWallElevation(h, v, el, model.grid, mode, margin, paramsMap, elementsById)) {
          return selectElement(el.id);
        }
      }

      if (el.type === 'foundation') {
        if (mode === 'plan') {
          const shape = foundationPlanShape(el, model.grid, paramsMap, elementsById);
          if (!shape) continue;
          if (shape.kind === 'aislada') {
            const c = project(shape.center.x, shape.center.y, 0, mode, view, canvasH);
            if (isPointInRectElement(sx, sy, c, shape.lengthX * view.scale, shape.lengthY * view.scale)) {
              return selectElement(el.id);
            }
          } else {
            const p1 = project(shape.p1.x, shape.p1.y, 0, mode, view, canvasH);
            const p2 = project(shape.p2.x, shape.p2.y, 0, mode, view, canvasH);
            if (isPointNearSegmentElement(sx, sy, p1, p2, (shape.width / 2) * view.scale)) {
              return selectElement(el.id);
            }
          }
        } else {
          const rect = getFoundationElevationRect(el, model.grid, mode, paramsMap, elementsById);
          if (rect) {
            const { h, v } = screenToPlane(sx, sy, view, canvasH, true);
            const margin = 8 / view.scale;
            if (h >= rect.hMin - margin && h <= rect.hMax + margin && v >= rect.vBottom - margin && v <= rect.vTop + margin) {
              return selectElement(el.id);
            }
          }
        }
      }

      if (el.type === 'column') {
        const geo = resolveColumnGeometry(el, model.grid, paramsMap, elementsById);
        if (!geo) continue;
        const center = project(geo.center.x, geo.center.y, 0, mode, view, canvasH);
        if (isPointInRectElement(sx, sy, center, geo.w * view.scale, geo.h * view.scale)) {
          return selectElement(el.id);
        }
      }

      if (el.type === 'beam') {
        const geo = resolveBeamGeometry(el, model.grid, paramsMap, elementsById);
        if (!geo) continue;
        const p1 = project(geo.p1.x, geo.p1.y, 0, mode, view, canvasH);
        const p2 = project(geo.p2.x, geo.p2.y, 0, mode, view, canvasH);
        if (isPointNearSegmentElement(sx, sy, p1, p2, (geo.width / 2) * view.scale)) {
          return selectElement(el.id);
        }
      }
    }

    // Techumbre DESPUÉS de los elementos (un muro bajo una cercha gana el clic). La unidad
    // seleccionable es el FALDÓN (las cerchas son derivadas). Fallback a sistema legacy para
    // modelos antiguos que aún traen model.roofSystems.
    if (mode === 'plan') {
      const { h, v } = screenToPlane(sx, sy, view, canvasH, false); // planta: sin flip de Y
      const planeId = findRoofPlaneAtPoint(model, { x: h, y: v }, 8 / view.scale);
      if (planeId != null) {
        setQuickAdd(null);
        return selectRoofPlane(planeId);
      }
      const roofModel = model.currentZLevelId != null
        ? { ...model, roofSystems: visibleRoofSystems(model, model.library) }
        : model;
      const roofId = findRoofSystemAtPoint(roofModel, { x: h, y: v }, 8 / view.scale);
      if (roofId != null && (model.roofSystems || []).length) {
        setQuickAdd(null);
        return selectRoofSystem(roofId);
      }
    }

    setQuickAdd(null);
    selectElement(null);

    // Nada bajo el clic: si cae cerca de una intersección de ejes, ofrece creación rápida.
    // ★ Desactivado a pedido del usuario (2026-07-20) hasta retomar esta funcionalidad —
    // ver QUICK_ADD_COLUMN_ENABLED al inicio del archivo para reactivarla.
    if (QUICK_ADD_COLUMN_ENABLED && mode === 'plan') {
      const TOL_PX = 14;
      let snapX = null, distX = Infinity;
      for (const a of model.grid.xAxes) {
        const d = Math.abs((a.position - view.offsetX) * view.scale - sx);
        if (d < distX) { distX = d; snapX = a; }
      }
      let snapY = null, distY = Infinity;
      for (const a of model.grid.yAxes) {
        const d = Math.abs((a.position - view.offsetY) * view.scale - sy);
        if (d < distY) { distY = d; snapY = a; }
      }
      if (snapX && snapY && distX < TOL_PX && distY < TOL_PX) {
        setQuickAdd({ x: sx, y: sy, axisX: snapX, axisY: snapY });
      }
    }
  }, [model, view, viewMode, selectElement, selectRoofSystem, selectRoofPlane, getCanvasHeight, legendCollapsed, showStuds, drafting, roofPlaneDraft, closeRoofPlaneDraft, addRoofPlaneDraftVertex, panelId]);

  // ---- doble click en planta = ir a la elevación (sesión 21, parte B) --------------------
  // Mismo hit-test que handleClick pero solo elementos (sin vanos ni techumbre: el doble click
  // busca "el muro/pilar/fundación/viga", no el detalle) y solo en planta.
  const findPlanElementAtPoint = useCallback((sx, sy) => {
    const canvasH = getCanvasHeight();
    const paramsMap = buildParamsMap(model.projectParams);
    const elementsById = buildElementsById(model.elements);
    for (let i = model.elements.length - 1; i >= 0; i--) {
      const el = model.elements[i];
      if (model.currentZLevelId != null && !isVisibleAtCurrentLevel(el, model.grid, model.currentZLevelId, paramsMap, elementsById)) continue;

      if (el.type === 'wall') {
        if (isPointInWallPlan(sx, sy, el, model.grid, view, canvasH, 8, paramsMap, elementsById, model.currentZLevelId)) return el.id;
      } else if (el.type === 'column') {
        const geo = resolveColumnGeometry(el, model.grid, paramsMap, elementsById);
        if (geo) {
          const center = project(geo.center.x, geo.center.y, 0, 'plan', view, canvasH);
          if (isPointInRectElement(sx, sy, center, geo.w * view.scale, geo.h * view.scale)) return el.id;
        }
      } else if (el.type === 'foundation') {
        const shape = foundationPlanShape(el, model.grid, paramsMap, elementsById);
        if (shape) {
          if (shape.kind === 'aislada') {
            const c = project(shape.center.x, shape.center.y, 0, 'plan', view, canvasH);
            if (isPointInRectElement(sx, sy, c, shape.lengthX * view.scale, shape.lengthY * view.scale)) return el.id;
          } else {
            const p1 = project(shape.p1.x, shape.p1.y, 0, 'plan', view, canvasH);
            const p2 = project(shape.p2.x, shape.p2.y, 0, 'plan', view, canvasH);
            if (isPointNearSegmentElement(sx, sy, p1, p2, (shape.width / 2) * view.scale)) return el.id;
          }
        }
      } else if (el.type === 'beam') {
        const geo = resolveBeamGeometry(el, model.grid, paramsMap, elementsById);
        if (geo) {
          const p1 = project(geo.p1.x, geo.p1.y, 0, 'plan', view, canvasH);
          const p2 = project(geo.p2.x, geo.p2.y, 0, 'plan', view, canvasH);
          if (isPointNearSegmentElement(sx, sy, p1, p2, (geo.width / 2) * view.scale)) return el.id;
        }
      }
    }
    return null;
  }, [model, view, getCanvasHeight]);

  const handleDoubleClick = useCallback((e) => {
    if (toProjectionMode(viewMode) !== 'plan') return;
    const rect = canvasRef.current.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const id = findPlanElementAtPoint(sx, sy);
    if (id == null) return;
    // Ancho/alto de CADA panel una vez aplicado el split (no el total del contenedor).
    const totalWidth = canvasRef.current?.clientWidth ?? 800;
    const totalHeight = canvasRef.current?.clientHeight ?? 600;
    const panelW = layout === 'split' ? totalWidth : totalWidth / 2;
    goToElevationFromPlan(id, panelId, panelW, totalHeight);
  }, [viewMode, findPlanElementAtPoint, layout, panelId, goToElevationFromPlan]);

  // ---- pan (drag) + zoom (wheel), centrado bajo el puntero ----
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let isPanning = false;
    let hasPanned = false;
    let startX = 0, startY = 0, startOffsetX = 0, startOffsetY = 0;

    const getView = () => (panelId === 'a' ? useModelStore.getState().view : useModelStore.getState().viewB);
    const getMode = () => (panelId === 'a' ? useModelStore.getState().model.viewMode : useModelStore.getState().viewModeB);

    const onMouseDown = (e) => {
      isPanning = true;
      hasPanned = false;
      startX = e.clientX;
      startY = e.clientY;
      const v = getView();
      startOffsetX = v.offsetX;
      startOffsetY = v.offsetY;
      canvas.style.cursor = 'grabbing';
    };

    const onMouseMove = (e) => {
      if (!isPanning) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) hasPanned = true;
      const v = getView();
      const modeStr = getMode();
      const newOffsetX = startOffsetX - dx / v.scale;
      const newOffsetY = isElevationMode(modeStr)
        ? startOffsetY + dy / v.scale
        : startOffsetY - dy / v.scale;
      setViewOffset(newOffsetX, newOffsetY);
    };

    const onMouseUp = () => {
      if (isPanning) {
        isPanning = false;
        canvas.style.cursor = 'grab';
      }
    };

    const onClickGuard = (e) => {
      if (hasPanned) e.stopPropagation();
    };

    const onWheel = (e) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      const v = getView();

      const worldBeforeX = v.offsetX + mouseX / v.scale;
      const worldBeforeY = v.offsetY + mouseY / v.scale;
      const factor = e.deltaY < 0 ? 1.25 : 0.8;
      const newScale = v.scale * factor;

      if (panelId === 'a') useModelStore.setState((s) => ({ view: { ...s.view, scale: newScale } }));
      else useModelStore.setState((s) => ({ viewB: { ...s.viewB, scale: newScale } }));
      setViewOffset(worldBeforeX - mouseX / newScale, worldBeforeY - mouseY / newScale);
    };

    canvas.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    canvas.addEventListener('click', onClickGuard, { capture: true });
    canvas.addEventListener('wheel', onWheel, { passive: false });

    return () => {
      canvas.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      canvas.removeEventListener('click', onClickGuard, { capture: true });
      canvas.removeEventListener('wheel', onWheel);
    };
  }, [panelId, setViewOffset]);

  // Sesión 20: la barra deja de ser un overlay absoluto sobre el canvas (tapaba leyenda y globos
  // de ejes en split view) y pasa a ser una franja fija de ~30px, hermana del canvas, que le resta
  // alto pero nunca se superpone.
  const legendApplies = viewMode !== 'plan' && viewMode !== '3d';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%' }}>
      {showLocalToolbar && (
        <div
          className="flex items-center gap-1.5 bg-[#f7f7f5] border-b border-[#e4e4e0] px-2"
          style={{ flex: '0 0 30px', height: 30 }}
        >
          <select
            className="text-xs border border-[#d8d8d3] rounded-md px-1.5 py-1 bg-white text-[#3d3d38] focus:outline-none focus:ring-2 focus:ring-[#3d3d3855] focus:border-[#3d3d38]"
            value={viewMode}
            onChange={(e) => setViewMode(e.target.value)}
          >
            <option value="plan">Planta</option>
            {xAxes.map(a => <option key={`ex${a.id}`} value={`elevation-x-${a.id}`}>Elevación X: {a.label}</option>)}
            {yAxes.map(a => <option key={`ey${a.id}`} value={`elevation-y-${a.id}`}>Elevación Y: {a.label}</option>)}
            <option value="3d">Vista 3D</option>
          </select>
          <button className="w-6 h-6 text-xs border border-[#d8d8d3] rounded-md text-[#3d3d38] hover:bg-[#f2f2ee] transition-colors" onClick={() => zoomIn(canvasRef.current?.clientWidth, canvasRef.current?.clientHeight)} disabled={viewMode === '3d'}>+</button>
          <button className="w-6 h-6 text-xs border border-[#d8d8d3] rounded-md text-[#3d3d38] hover:bg-[#f2f2ee] transition-colors" onClick={() => zoomOut(canvasRef.current?.clientWidth, canvasRef.current?.clientHeight)} disabled={viewMode === '3d'}>−</button>
          <button className="w-6 h-6 text-xs border border-[#d8d8d3] rounded-md text-[#3d3d38] hover:bg-[#f2f2ee] transition-colors" onClick={() => fitToContent(canvasRef.current?.clientWidth, canvasRef.current?.clientHeight)} disabled={viewMode === '3d'}>⌂</button>
          <button
            className={`w-6 h-6 text-xs border rounded-md transition-colors ${showStuds ? 'bg-[#3d3d38] text-white border-[#3d3d38]' : 'border-[#d8d8d3] text-[#3d3d38] hover:bg-[#f2f2ee]'}`}
            onClick={() => setShowStuds(v => !v)}
            disabled={viewMode === 'plan' || viewMode === '3d'}
            title="Mostrar montantes de metalcon"
          >
            ▤
          </button>
          <button
            className={`w-6 h-6 text-xs border rounded-md transition-colors ${legendCollapsed ? 'border-[#d8d8d3] text-[#3d3d38] hover:bg-[#f2f2ee]' : 'bg-[#3d3d38] text-white border-[#3d3d38]'}`}
            onClick={() => toggleLegendCollapsed(panelId)}
            disabled={!legendApplies}
            title={legendCollapsed ? 'Mostrar leyenda' : 'Ocultar leyenda'}
          >
            {legendCollapsed ? '▸' : '▾'}
          </button>
        </div>
      )}
      <div style={{ position: 'relative', flex: 1, minHeight: 0 }}>
        {quickAdd && viewMode !== '3d' && (
          <div
            className="absolute z-30 bg-white border border-[#d8d8d3] rounded-md shadow-lg py-1 text-sm"
            style={{ left: quickAdd.x + 8, top: quickAdd.y + 8 }}
          >
            <button
              className="block w-full text-left px-3 py-1.5 text-[#3d3d38] hover:bg-[#f2f2ee] whitespace-nowrap"
              onClick={() => {
                onQuickAddColumn?.({ axisXId: quickAdd.axisX.id, axisYId: quickAdd.axisY.id });
                setQuickAdd(null);
              }}
            >
              + Pilar en {quickAdd.axisX.label}×{quickAdd.axisY.label}
            </button>
            <button
              className="block w-full text-left px-3 py-1.5 text-[#8a8a85] hover:bg-[#f2f2ee]"
              onClick={() => setQuickAdd(null)}
            >
              Cancelar
            </button>
          </div>
        )}
        <canvas
          ref={canvasRef}
          id={panelId === 'a' ? 'canvas' : `canvas-${panelId}`}
          className={`w-full h-full block ${drafting ? 'cursor-crosshair' : 'cursor-grab'}`}
          style={{ display: viewMode === '3d' ? 'none' : 'block' }}
          onClick={handleClick}
          onDoubleClick={handleDoubleClick}
        />
        {drafting && viewMode !== '3d' && (
          <div className="absolute top-2 left-1/2 -translate-x-1/2 z-30 bg-[#1a1a18] text-white text-xs px-3 py-1.5 rounded-md shadow-lg whitespace-nowrap">
            Dibujar faldón: clic en esquinas de eje · <b>Enter</b>/clic en el 1er vértice cierra · <b>Backspace</b> deshace · <b>Esc</b> cancela
            {roofPlaneDraft.vertices.length ? ` · ${roofPlaneDraft.vertices.length} vértice${roofPlaneDraft.vertices.length > 1 ? 's' : ''}` : ''}
          </div>
        )}
        {viewMode === '3d' && (
          <div className="absolute inset-0">
            <Viewer3D model={model} attributeFilter={attributeFilter} />
          </div>
        )}
        {hover?.snapScreen && viewMode !== '3d' && (
          <div
            className="absolute z-20 pointer-events-none"
            style={{
              left: hover.snapScreen.x - 5, top: hover.snapScreen.y - 5,
              width: 10, height: 10,
              border: '1.5px solid #dc2626', background: 'rgba(220,38,38,0.15)'
            }}
          />
        )}
        {hover && viewMode !== '3d' && (
          <div className="absolute bottom-2 right-2 z-20 bg-white/95 border border-[#e4e4e0] rounded-lg px-2.5 py-1.5 text-xs font-mono text-[#1a1a18] shadow-sm pointer-events-none">
            <div>{hover.primary}</div>
            {hover.snapScreen && (
              <div className="text-[#dc2626] font-semibold mt-0.5">Snap</div>
            )}
            {!hover.snapScreen && (hover.snapX || hover.snapY) && (
              <div className="text-[#3d3d38] font-semibold mt-0.5">
                {hover.snapX && hover.snapY
                  ? `Intersección ${hover.snapX.label} × ${hover.snapY.label}`
                  : hover.snapX
                    ? `Cerca de eje ${hover.snapX.label}`
                    : `Cerca de eje ${hover.snapY.label}`}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
