const WIDTH = 1500;
const HEIGHT = 960;
const PLAN = { x: 60, y: 120, width: 1000, height: 760 };
const TARGET_WALL_ID = 1784670218571;

function escapeXml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function wallEndpoints(wall) {
  return wall.axis === 'x'
    ? [{ x: wall.s0, y: wall.fixed }, { x: wall.s1, y: wall.fixed }]
    : [{ x: wall.fixed, y: wall.s0 }, { x: wall.fixed, y: wall.s1 }];
}

function planBounds(walls) {
  const points = walls.flatMap(wallEndpoints);
  return {
    minX: Math.min(...points.map(({ x }) => x)),
    minY: Math.min(...points.map(({ y }) => y)),
    maxX: Math.max(...points.map(({ x }) => x)),
    maxY: Math.max(...points.map(({ y }) => y))
  };
}

function projector(bounds) {
  const sourceWidth = Math.max(bounds.maxX - bounds.minX, 1);
  const sourceHeight = Math.max(bounds.maxY - bounds.minY, 1);
  const scale = Math.min(PLAN.width / sourceWidth, PLAN.height / sourceHeight);
  const offsetX = PLAN.x + (PLAN.width - sourceWidth * scale) / 2;
  const offsetY = PLAN.y + (PLAN.height - sourceHeight * scale) / 2;
  return ({ x, y }) => ({
    x: offsetX + (x - bounds.minX) * scale,
    y: offsetY + (bounds.maxY - y) * scale
  });
}

function line(x1, y1, x2, y2, attributes = '') {
  return `<line x1="${x1.toFixed(2)}" y1="${y1.toFixed(2)}" x2="${x2.toFixed(2)}" y2="${y2.toFixed(2)}" ${attributes}/>`;
}

function supportLineSvg(supportLine, wallsById, project) {
  const walls = supportLine.wallIds.map((id) => wallsById.get(String(id)));
  const start = Math.min(...walls.map(({ s0 }) => s0));
  const end = Math.max(...walls.map(({ s1 }) => s1));
  const [first, second] = supportLine.axis === 'x'
    ? [{ x: start, y: supportLine.fixed }, { x: end, y: supportLine.fixed }]
    : [{ x: supportLine.fixed, y: start }, { x: supportLine.fixed, y: end }];
  const a = project(first);
  const b = project(second);
  return line(a.x, a.y, b.x, b.y, 'class="support-line"');
}

function wallSvg(wall, project) {
  const [first, second] = wallEndpoints(wall).map(project);
  const classes = [
    'wall',
    wall.axis === 'x' ? 'wall-x' : 'wall-y',
    wall.chainId ? 'wall-chain' : '',
    wall.id === TARGET_WALL_ID ? 'wall-target' : ''
  ].filter(Boolean).join(' ');
  return line(first.x, first.y, second.x, second.y, `class="${classes}" data-wall-id="${escapeXml(wall.id)}"`);
}

function openingSvg(opening, project) {
  const endpoints = opening.axis === 'x'
    ? [{ x: opening.s0, y: opening.fixed }, { x: opening.s1, y: opening.fixed }]
    : [{ x: opening.fixed, y: opening.s0 }, { x: opening.fixed, y: opening.s1 }];
  const [first, second] = endpoints.map(project);
  return [
    line(first.x, first.y, second.x, second.y, 'class="opening-cut"'),
    line(first.x, first.y, second.x, second.y, `class="opening" data-opening-id="${escapeXml(opening.id)}"`)
  ].join('\n');
}

function contiguousMarker(relation, wallsById, project) {
  if (relation.type !== 'COLLINEAR_CONTIGUOUS') return '';
  const [first, second] = relation.wallIds.map((id) => wallsById.get(String(id)));
  const s = (Math.min(first.s1, second.s1) + Math.max(first.s0, second.s0)) / 2;
  const point = project(first.axis === 'x'
    ? { x: s, y: (first.fixed + second.fixed) / 2 }
    : { x: (first.fixed + second.fixed) / 2, y: s });
  return `<circle cx="${point.x.toFixed(2)}" cy="${point.y.toFixed(2)}" r="4" class="continuity"/>`;
}

function intersectionMarker(relation, project) {
  if (relation.phase !== 'R4') return '';
  const point = project(relation.evidence.point);
  const classes = [
    'intersection',
    relation.type === 'CROSS_MID_MID' ? 'intersection-ambiguous' : ''
  ].filter(Boolean).join(' ');
  return `<circle cx="${point.x.toFixed(2)}" cy="${point.y.toFixed(2)}" r="5" class="${classes}" data-relation-id="${escapeXml(relation.id)}"/>`;
}

function targetNodeSvg(node, project) {
  if (node.wallId !== TARGET_WALL_ID) return '';
  const point = project(node.global);
  return `<circle cx="${point.x.toFixed(2)}" cy="${point.y.toFixed(2)}" r="4" class="target-node" data-node-id="${escapeXml(node.id)}"/>`;
}

function targetLabel(result, wallsById, project) {
  const target = wallsById.get(String(TARGET_WALL_ID));
  if (!target) return '';
  const [first, second] = wallEndpoints(target);
  const midpoint = project({ x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 });
  return [
    `<path d="M ${midpoint.x.toFixed(2)} ${midpoint.y.toFixed(2)} l 24 -36 h 148" class="leader"/>`,
    `<text x="${(midpoint.x + 30).toFixed(2)}" y="${(midpoint.y - 42).toFixed(2)}" class="target-label">R-VIS-05 · muro ${TARGET_WALL_ID}</text>`,
    `<text x="${(midpoint.x + 30).toFixed(2)}" y="${(midpoint.y - 26).toFixed(2)}" class="target-detail">${escapeXml(target.supportLineId)} · ${target.nodeIds.length} nodos R5</text>`
  ].join('\n');
}

function verticalCoveragePanel(result) {
  const relation = result.relations.find(({ verticalContactType }) => (
    verticalContactType && verticalContactType !== 'FULL_BOTH'
  ));
  if (!relation) return '';
  const minZ = Math.min(...relation.verticalBands.map(({ z0 }) => z0));
  const maxZ = Math.max(...relation.verticalBands.map(({ z1 }) => z1));
  const height = 132;
  const yBottom = 842;
  const projectZ = (z) => yBottom - (z - minZ) / (maxZ - minZ) * height;
  const bands = relation.verticalBands.map((band) => {
    const y = projectZ(band.z1);
    const bandHeight = projectZ(band.z0) - y;
    return `<rect x="1120" y="${y.toFixed(2)}" width="48" height="${bandHeight.toFixed(2)}" class="band-${band.state}" data-band-state="${band.state}"/>`;
  }).join('\n');
  return `<text x="1100" y="650" class="section">Cobertura Z R4</text>
  <text x="1100" y="676" class="coverage-type">${escapeXml(relation.type)}</text>
  <text x="1100" y="696" class="coverage-type">${escapeXml(relation.verticalContactType)}</text>
  ${bands}
  <text x="1182" y="730" class="coverage-label">wallAOnly</text>
  <text x="1182" y="780" class="coverage-label">intersectionActive</text>
  <text x="1182" y="824" class="coverage-label">zOverlap ${relation.zOverlap[0]}–${relation.zOverlap[1]} mm</text>`;
}

export function renderSpec14VisualEvidence(result) {
  const bounds = planBounds(result.walls);
  const project = projector(bounds);
  const wallsById = new Map(result.walls.map((wall) => [String(wall.id), wall]));
  const metadata = escapeXml(JSON.stringify({
    schema: result.schema,
    phasesExecuted: result.phasesExecuted,
    eligibleForSpec08: result.eligibleForSpec08,
    canonicalSha256: result.canonicalSha256
  }));
  const counts = [
    ['Muros canónicos', result.walls.length],
    ['Vanos canónicos', result.openings.length],
    ['Apilamientos R3', result.relations.filter(({ phase }) => phase === 'R3').length],
    ['Encuentros R4', result.relations.filter(({ phase }) => phase === 'R4').length],
    ['Nodos R5', result.nodes.length],
    ['Findings R0–R5', result.findings.length]
  ];
  const countRows = counts.map(([label, value], index) => (
    `<text x="1100" y="${170 + index * 30}" class="metric-label">${escapeXml(label)}</text>`
    + `<text x="1450" y="${170 + index * 30}" class="metric-value">${value}</text>`
  )).join('\n');
  const relationCounts = [
    'CORNER_END_END', 'T_END_MID', 'T_MID_END', 'CROSS_MID_MID', 'STACKED_PARTIAL'
  ]
    .map((type) => [type, result.relations.filter((relation) => relation.type === type).length]);
  const relationRows = relationCounts.map(([type, value], index) => (
    `<text x="1100" y="${386 + index * 25}" class="relation-label">${type}</text>`
    + `<text x="1450" y="${386 + index * 25}" class="metric-value">${value}</text>`
  )).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" role="img" aria-labelledby="title description">
  <title id="title">SPEC-014-B · evidencia visual R0–R5 · casa-L</title>
  <desc id="description">Encuentros, cobertura vertical y nodos topológicos sobre geometría agnóstica. Esta evidencia parcial no habilita SPEC-08.</desc>
  <metadata>${metadata}</metadata>
  <style>
    .page { fill: #f7f7f4; }
    .panel { fill: #ffffff; stroke: #c9ccd1; stroke-width: 1; }
    .support-line { stroke: #c8c4ea; stroke-width: 1; stroke-dasharray: 5 5; }
    .wall { stroke: #243447; stroke-width: 5; stroke-linecap: square; }
    .wall-x { stroke: #176b87; }
    .wall-y { stroke: #b36a24; }
    .wall-chain { stroke-width: 7; }
    .wall-target { stroke: #c9362b; stroke-width: 10; }
    .opening-cut { stroke: #ffffff; stroke-width: 11; }
    .opening { stroke: #111827; stroke-width: 2; stroke-dasharray: 4 3; }
    .continuity { fill: #26a269; stroke: #ffffff; stroke-width: 1.5; }
    .intersection { fill: #7950b5; stroke: #ffffff; stroke-width: 1.5; }
    .intersection-ambiguous { fill: #d9480f; stroke: #7c2d12; stroke-width: 2.5; }
    .target-node { fill: #ffffff; stroke: #111827; stroke-width: 2; }
    .leader { fill: none; stroke: #c9362b; stroke-width: 1.5; }
    .title { font: 700 26px system-ui, sans-serif; fill: #18212b; }
    .subtitle { font: 14px system-ui, sans-serif; fill: #56606b; }
    .section { font: 700 16px system-ui, sans-serif; fill: #18212b; }
    .metric-label, .relation-label { font: 13px system-ui, sans-serif; fill: #47515c; }
    .relation-label { font: 11px ui-monospace, monospace; }
    .metric-value { font: 700 14px ui-monospace, monospace; text-anchor: end; fill: #18212b; }
    .hash { font: 11px ui-monospace, monospace; fill: #313a44; }
    .target-label { font: 700 11px system-ui, sans-serif; fill: #a9231b; }
    .target-detail { font: 10px ui-monospace, monospace; fill: #6a2b27; }
    .warning { font: 700 13px system-ui, sans-serif; fill: #8a2f18; }
    .legend { font: 12px system-ui, sans-serif; fill: #3f4954; }
    .coverage-type, .coverage-label { font: 11px ui-monospace, monospace; fill: #3f4954; }
    .band-intersectionActive { fill: #7950b5; }
    .band-wallAOnly { fill: #176b87; }
    .band-wallBOnly { fill: #b36a24; }
  </style>
  <rect class="page" width="${WIDTH}" height="${HEIGHT}"/>
  <text x="60" y="48" class="title">SPEC-014-B · casa-L · evidencia visual R0–R5</text>
  <text x="60" y="76" class="subtitle">Geometría agnóstica, encuentros 3D y nodos; R6–R12 permanecen pendientes.</text>
  <rect x="40" y="96" width="1040" height="824" rx="8" class="panel"/>
  <rect x="1090" y="96" width="370" height="824" rx="8" class="panel"/>
  <g id="support-lines">
${result.supportLines.map((supportLine) => supportLineSvg(supportLine, wallsById, project)).join('\n')}
  </g>
  <g id="walls">
${result.walls.map((wall) => wallSvg(wall, project)).join('\n')}
  </g>
  <g id="openings">
${result.openings.map((item) => openingSvg(item, project)).join('\n')}
  </g>
  <g id="continuities">
${result.relations.map((relation) => contiguousMarker(relation, wallsById, project)).filter(Boolean).join('\n')}
  </g>
  <g id="intersections">
${result.relations.map((relation) => intersectionMarker(relation, project)).filter(Boolean).join('\n')}
  </g>
  <g id="target-wall-nodes">
${result.nodes.map((node) => targetNodeSvg(node, project)).filter(Boolean).join('\n')}
  </g>
  <g id="regression-reference">
${targetLabel(result, wallsById, project)}
  </g>
  <text x="1100" y="132" class="section">Resumen verificable</text>
${countRows}
  <text x="1100" y="350" class="section">Relaciones R3–R4</text>
${relationRows}
  <text x="1100" y="540" class="section">Leyenda</text>
  <line x1="1104" y1="570" x2="1144" y2="570" class="wall wall-target"/><text x="1156" y="575" class="legend">muro R-VIS-05</text>
  <circle cx="1124" cy="600" r="5" class="intersection"/><text x="1156" y="605" class="legend">encuentro R4</text>
  <circle cx="1324" cy="600" r="4" class="target-node"/><text x="1338" y="605" class="legend">nodo R5</text>
  ${verticalCoveragePanel(result)}
  <text x="1260" y="860" class="warning">eligibleForSpec08 = false</text>
  <text x="1100" y="886" class="hash">canonicalSha256 ${result.canonicalSha256.slice(0, 16)}…</text>
  <text x="60" y="944" class="subtitle">Fuente: tests/fixtures/casa-L.json · Generación: npm run evidence:spec14 · Evidencia topológica. No es un plano de ejecución.</text>
</svg>
`;
}
