// components/Viewer3D.jsx
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Brush, Evaluator, SUBTRACTION } from 'three-bvh-csg';
import { buildWallBoxesWithOpenings, buildColumnBoxes, buildBeamBoxes, buildFoundationBoxes, buildRoofTrussMembers, buildRoofPurlinBoxes, buildSupportLedgerBoxes } from '../core/build3d.js';
import { elementMatchesFilter, isFilterActive } from '../core/attributeFilter.js';
import { buildParamsMap } from '../core/projectParams.js';
import { buildElementsById } from '../core/elementReferences.js';

// Mismos colores que planta/elevación — nada de texturas, para no saturar el visor.
const FLAT_COLORS = {
  wall: 0x9ca3af,
  column: 0xf59e0b,
  beam: 0x34d399,
  cimiento: 0x57534e,       // gris hormigón
  sobrecimiento: 0xa8a29e,
  zapata: 0x57534e,
  emplantillado: 0xd6d3d1,
  truss: 0x60a5fa,
  purlin: 0x8a6d3b,
  ledger: 0xc084fc          // solera de apoyo lateral (A-01)
};
const SELECTED_COLOR = 0xfacc15;

function buildWallBrush(box) {
  const geometry = new THREE.BoxGeometry(box.size.x || 10, box.size.y || 10, box.size.z || 10);
  const brush = new Brush(geometry);
  brush.position.set(box.center.x, box.center.y, box.center.z);
  brush.updateMatrixWorld();
  return brush;
}

/** Resta cada vano del muro y limpia la geometría resultante para que no se vea la triangulación del CSG. */
function cutOpenings(wallBox, evaluator) {
  let result = buildWallBrush(wallBox);
  for (const o of wallBox.openings) {
    const holeGeo = new THREE.BoxGeometry(o.size.x, o.size.y, o.size.z);
    const holeBrush = new Brush(holeGeo);
    holeBrush.position.set(o.center.x, o.center.y, o.center.z);
    holeBrush.updateMatrixWorld();
    result = evaluator.evaluate(result, holeBrush, SUBTRACTION);
  }
  const merged = mergeVertices(result.geometry, 1); // suelda vértices coincidentes (tolerancia 1mm)
  merged.computeVertexNormals(); // normales limpias por cara -> sin costuras de triángulos visibles
  return merged;
}

function addMesh(scene, geometry, position, color) {
  const material = new THREE.MeshStandardMaterial({ color, roughness: 0.85, flatShading: false });
  const mesh = new THREE.Mesh(geometry, material);
  if (position) mesh.position.set(position.x, position.y, position.z);
  scene.add(mesh);
  return mesh;
}

export default function Viewer3D({ model, attributeFilter = {} }) {
  const mountRef = useRef(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const width = mount.clientWidth;
    const height = mount.clientHeight;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf2f2ee);

    const camera = new THREE.PerspectiveCamera(50, width / height, 10, 500000);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    mount.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0xffffff, 0.65));
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.75);
    dirLight.position.set(5000, 8000, 5000);
    scene.add(dirLight);
    scene.add(new THREE.GridHelper(20000, 20, 0xd8d8d3, 0xe4e4e0));

    const evaluator = new Evaluator();
    const walls = buildWallBoxesWithOpenings(model);
    const columns = buildColumnBoxes(model);
    const beams = buildBeamBoxes(model);
    const foundations = buildFoundationBoxes(model);
    const trussMembers = buildRoofTrussMembers(model);
    const purlins = buildRoofPurlinBoxes(model);
    const ledgers = buildSupportLedgerBoxes(model);
    const selectedId = model.selectedElementId;
    const filterOn = isFilterActive(attributeFilter);
    const paramsMap = buildParamsMap(model.projectParams);
    const elementsById = buildElementsById(model.elements);
    const highlightGroup = new THREE.Group();
    scene.add(highlightGroup);

    /** ítem 7: agrega un contorno ámbar (sin tocar el color base) alrededor de cajas coincidentes con el filtro. */
    function maybeHighlight(box) {
      if (!filterOn) return;
      const el = elementsById[box.id];
      if (!el || !elementMatchesFilter(el, attributeFilter, model.grid, paramsMap, elementsById)) return;
      const pad = 40;
      const edges = new THREE.EdgesGeometry(new THREE.BoxGeometry(
        (box.size.x || 10) + pad, (box.size.y || 10) + pad, (box.size.z || 10) + pad
      ));
      const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0xf59e0b }));
      line.position.set(box.center.x, box.center.y, box.center.z);
      highlightGroup.add(line);
    }

    for (const box of walls) {
      const hasOpenings = box.openings.length > 0;
      const geometry = hasOpenings ? cutOpenings(box, evaluator) : new THREE.BoxGeometry(box.size.x || 10, box.size.y || 10, box.size.z || 10);
      addMesh(scene, geometry, box.center, box.id === selectedId ? SELECTED_COLOR : FLAT_COLORS.wall);
      maybeHighlight(box);
    }
    for (const box of columns) {
      const geometry = new THREE.BoxGeometry(box.size.x, box.size.y, box.size.z);
      addMesh(scene, geometry, box.center, box.id === selectedId ? SELECTED_COLOR : FLAT_COLORS.column);
      maybeHighlight(box);
    }
    for (const box of beams) {
      const geometry = new THREE.BoxGeometry(box.size.x, box.size.y, box.size.z);
      addMesh(scene, geometry, box.center, box.id === selectedId ? SELECTED_COLOR : FLAT_COLORS.beam);
      maybeHighlight(box);
    }
    for (const box of foundations) {
      const geometry = new THREE.BoxGeometry(box.size.x, box.size.y, box.size.z);
      const color = box.id === selectedId ? SELECTED_COLOR : (FLAT_COLORS[box.layer] || FLAT_COLORS.cimiento);
      addMesh(scene, geometry, box.center, color);
      maybeHighlight(box);
    }

    // cerchas: cada miembro es una caja alineada p1->p2 con quaternion (barras inclinadas)
    const X_AXIS = new THREE.Vector3(1, 0, 0);
    for (const m of trussMembers) {
      const dir = new THREE.Vector3(m.p2.x - m.p1.x, m.p2.y - m.p1.y, m.p2.z - m.p1.z);
      const len = dir.length();
      if (len < 1) continue;
      const geometry = new THREE.BoxGeometry(len, m.h, m.b);
      const material = new THREE.MeshStandardMaterial({ color: FLAT_COLORS.truss, roughness: 0.85 });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set((m.p1.x + m.p2.x) / 2, (m.p1.y + m.p2.y) / 2, (m.p1.z + m.p2.z) / 2);
      mesh.quaternion.setFromUnitVectors(X_AXIS, dir.normalize());
      scene.add(mesh);
    }
    for (const box of purlins) {
      const geometry = new THREE.BoxGeometry(box.size.x, box.size.y, box.size.z);
      addMesh(scene, geometry, box.center, FLAT_COLORS.purlin);
    }
    for (const box of ledgers) {
      const geometry = new THREE.BoxGeometry(box.size.x, box.size.y, box.size.z);
      addMesh(scene, geometry, box.center, FLAT_COLORS.ledger);
    }

    const trussPts = trussMembers.flatMap(m => [m.p1, m.p2]);
    const allBoxes = [...walls, ...columns, ...beams, ...foundations,
      ...trussPts.map(p => ({ center: { x: p.x, y: p.y, z: p.z } }))];
    let cx = 0, cz = 0, maxSpan = 6000;
    if (allBoxes.length > 0) {
      const xs = allBoxes.map(b => b.center.x);
      const zs = allBoxes.map(b => b.center.z);
      cx = (Math.min(...xs) + Math.max(...xs)) / 2;
      cz = (Math.min(...zs) + Math.max(...zs)) / 2;
      maxSpan = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...zs) - Math.min(...zs), 3000);
    }
    camera.position.set(cx + maxSpan * 0.8, maxSpan * 0.9, cz + maxSpan * 0.8);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(cx, 0, cz);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.update();

    let frameId;
    const animate = () => {
      frameId = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    const onResize = () => {
      const w = mount.clientWidth, h = mount.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', onResize);

    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener('resize', onResize);
      controls.dispose();
      renderer.dispose();
      scene.traverse((obj) => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) obj.material.dispose();
      });
      mount.removeChild(renderer.domElement);
    };
  }, [model, attributeFilter]);

  return <div ref={mountRef} style={{ width: '100%', height: '100%' }} />;
}
