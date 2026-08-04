import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import {
  AGNOSTIC_COMPARISON_FAILED_COLOR,
  visibleAgnosticComparisonLayers
} from '../core/agnosticGeometryComparison.js';

const X_AXIS = new THREE.Vector3(1, 0, 0);

function localOpeningPath(wall, opening) {
  const dx = wall.prism.end.x - wall.prism.start.x;
  const dz = wall.prism.end.z - wall.prism.start.z;
  const length = Math.hypot(dx, dz);
  const direction = { x: dx / length, z: dz / length };
  const relativeX = (opening.prism.center.x - wall.prism.center.x) * direction.x
    + (opening.prism.center.z - wall.prism.center.z) * direction.z;
  const relativeY = opening.prism.center.y - wall.prism.center.y;
  const halfWidth = opening.prism.size.x / 2;
  const halfHeight = opening.prism.size.y / 2;
  const path = new THREE.Path();
  path.moveTo(relativeX - halfWidth, relativeY - halfHeight);
  path.lineTo(relativeX - halfWidth, relativeY + halfHeight);
  path.lineTo(relativeX + halfWidth, relativeY + halfHeight);
  path.lineTo(relativeX + halfWidth, relativeY - halfHeight);
  path.closePath();
  return path;
}

function wallGeometry(item) {
  const shape = new THREE.Shape();
  const halfLength = item.prism.size.x / 2;
  const halfHeight = item.prism.size.y / 2;
  shape.moveTo(-halfLength, -halfHeight);
  shape.lineTo(halfLength, -halfHeight);
  shape.lineTo(halfLength, halfHeight);
  shape.lineTo(-halfLength, halfHeight);
  shape.closePath();
  item.openings.forEach((opening) => shape.holes.push(localOpeningPath(item, opening)));
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: item.prism.size.z,
    bevelEnabled: false,
    curveSegments: 1
  });
  geometry.translate(0, 0, -item.prism.size.z / 2);
  return geometry;
}

function boxGeometry(item) {
  return new THREE.BoxGeometry(item.prism.size.x, item.prism.size.y, item.prism.size.z);
}

function orientObject(object, prism) {
  object.position.set(prism.center.x, prism.center.y, prism.center.z);
  if (prism.kind === 'oriented-prism') {
    const direction = new THREE.Vector3(
      prism.end.x - prism.start.x,
      0,
      prism.end.z - prism.start.z
    ).normalize();
    object.quaternion.setFromUnitVectors(X_AXIS, direction);
  }
}

function surfaceGeometry(boundary) {
  const triangles = THREE.ShapeUtils.triangulateShape(
    boundary.map(({ x, z }) => new THREE.Vector2(x, z)),
    []
  );
  const positions = [];
  triangles.forEach((triangle) => triangle.forEach((index) => {
    const point = boundary[index];
    positions.push(point.x, point.y, point.z);
  }));
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  return geometry;
}

function colorFor(item, style) {
  return item.failed ? AGNOSTIC_COMPARISON_FAILED_COLOR : style.color;
}

function addSolid(scene, item, style) {
  if (item.type === 'roof') {
    const material = new THREE.MeshBasicMaterial({
      color: colorFor(item, style),
      opacity: style.opacity,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide
    });
    scene.add(new THREE.Mesh(surfaceGeometry(item.boundary), material));
    return;
  }
  const geometry = item.type === 'wall' ? wallGeometry(item) : boxGeometry(item);
  const material = new THREE.MeshStandardMaterial({
    color: colorFor(item, style),
    opacity: style.opacity,
    transparent: style.opacity < 1,
    depthWrite: style.opacity >= 1,
    roughness: 0.8,
    side: THREE.DoubleSide
  });
  const mesh = new THREE.Mesh(geometry, material);
  orientObject(mesh, item.prism);
  scene.add(mesh);
}

function addOutline(scene, item, style) {
  const material = new THREE.LineBasicMaterial({ color: colorFor(item, style) });
  if (item.type === 'roof') {
    const geometry = new THREE.BufferGeometry().setFromPoints(
      item.boundary.map((point) => new THREE.Vector3(point.x, point.y, point.z))
    );
    scene.add(new THREE.LineLoop(geometry, material));
    return;
  }
  const solidGeometry = item.type === 'wall' ? wallGeometry(item) : boxGeometry(item);
  const line = new THREE.LineSegments(new THREE.EdgesGeometry(solidGeometry), material);
  solidGeometry.dispose();
  orientObject(line, item.prism);
  scene.add(line);
  item.openings?.filter(({ failed }) => failed).forEach((opening) => {
    const openingLine = new THREE.LineSegments(
      new THREE.EdgesGeometry(boxGeometry(opening)),
      new THREE.LineBasicMaterial({ color: AGNOSTIC_COMPARISON_FAILED_COLOR })
    );
    orientObject(openingLine, opening.prism);
    scene.add(openingLine);
  });
}

export default function AgnosticGeometryComparisonViewer({ comparison, mode, onError }) {
  const mountRef = useRef(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return undefined;
    let renderer;
    let controls;
    let frameId;
    let scene;
    const cleanup = () => {
      if (frameId !== undefined) cancelAnimationFrame(frameId);
      window.removeEventListener('resize', onResize);
      controls?.dispose();
      scene?.traverse((object) => {
        object.geometry?.dispose();
        if (Array.isArray(object.material)) object.material.forEach((material) => material.dispose());
        else object.material?.dispose();
      });
      renderer?.dispose();
      if (renderer?.domElement.parentNode === mount) mount.removeChild(renderer.domElement);
    };
    const onResize = () => {
      if (!renderer || !mount.clientWidth || !mount.clientHeight) return;
      camera.aspect = mount.clientWidth / mount.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(mount.clientWidth, mount.clientHeight);
    };
    let camera;
    try {
      const width = Math.max(mount.clientWidth, 1);
      const height = Math.max(mount.clientHeight, 1);
      scene = new THREE.Scene();
      scene.background = new THREE.Color(0xf7f7f4);
      camera = new THREE.PerspectiveCamera(48, width / height, 1, 1000000);
      scene.add(new THREE.AmbientLight(0xffffff, 0.8));
      const light = new THREE.DirectionalLight(0xffffff, 0.75);
      light.position.set(1, 2, 1);
      scene.add(light);
      visibleAgnosticComparisonLayers(comparison, mode).forEach((layer) => {
        layer.items.forEach((item) => {
          if (layer.style.representation === 'solid') addSolid(scene, item, layer.style);
          else addOutline(scene, item, layer.style);
        });
      });
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
      renderer.setSize(width, height);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      mount.appendChild(renderer.domElement);
      const { center, span } = comparison.bounds;
      camera.position.set(center.x + span, center.y + span * 0.8, center.z + span);
      controls = new OrbitControls(camera, renderer.domElement);
      controls.target.set(center.x, center.y, center.z);
      controls.enableDamping = true;
      controls.dampingFactor = 0.08;
      controls.update();
      const animate = () => {
        frameId = requestAnimationFrame(animate);
        controls.update();
        renderer.render(scene, camera);
      };
      window.addEventListener('resize', onResize);
      animate();
    } catch (error) {
      cleanup();
      onError?.(error);
      return undefined;
    }
    return cleanup;
  }, [comparison, mode, onError]);

  return <div ref={mountRef} style={{ width: '100%', height: '100%' }} />;
}
