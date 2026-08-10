import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assertHumanReadableStructuralProposalPresentation,
  buildStructuralProposalVisualPresentation
} from '../src/core/structuralProposalVisualPresentation.js';
import {
  FX008_LATERAL_ROOF_ID,
  FX008_LATERAL_WALL_ID,
  buildFx008Spec015dContext
} from './helpers/spec015d.mjs';

test('grafo lateral identifica cubierta y muro por descriptor antes del ID', async () => {
  const context = await buildFx008Spec015dContext();
  const presentation = buildStructuralProposalVisualPresentation(
    context.model,
    context.proposals,
    context.paths
  );
  assert.equal(assertHumanReadableStructuralProposalPresentation(presentation), true);
  const roof = presentation.entities.roofs.find((item) => item.entityId === FX008_LATERAL_ROOF_ID);
  const wall = presentation.entities.elements.find((item) => item.entityId === FX008_LATERAL_WALL_ID);
  assert.equal(roof.title, 'Faldón rectangular 1–6 entre B–H');
  assert.match(roof.subtitle, /Pendiente B→H/);
  assert.equal(wall.title, 'Muro X · 3→5 @ C1');
  assert.match(wall.subtitle, /NPT 450 → CIELO GENERAL 3\.250/);
  assert.ok(!/^Muro \d+$/.test(wall.title));
  assert.ok(!/^Cubierta \d+$/.test(roof.title));
  assert.match(wall.ariaLabel, /Referencia técnica/);
});


test('SPEC-015-D REV7: cada propuesta expone relación en planta origen-borde-objetivo', async () => {
  const context = await buildFx008Spec015dContext();
  const presentation = buildStructuralProposalVisualPresentation(
    context.model,
    context.proposals,
    context.paths
  );
  const proposal = presentation.proposals[0];
  assert.equal(proposal.relation.kind, 'proposal-relation');
  assert.equal(proposal.relation.selected.length, 2);
  assert.equal(proposal.relation.selected[0].mark, 'ORIGEN');
  assert.equal(proposal.relation.selected[1].mark, 'OBJETIVO');
  assert.ok(proposal.relation.boundary);
  assert.ok(proposal.relation.overlapSegments.length > 0);
  assert.ok(Number.isFinite(proposal.relation.bounds.xMin));
});

test('SPEC-015-D REV8: interfaz, región y relación tienen descriptor humano y Localizar específico', async () => {
  const { buildFx008Rev8Continuous } = await import('./helpers/spec015dRev8.mjs');
  const context = await buildFx008Rev8Continuous();
  const presentation = buildStructuralProposalVisualPresentation(context.model, context.proposals, context.paths);
  assert.ok(presentation.entities.interfaces.length >= 6);
  assert.ok(presentation.entities.regions.length >= 2);
  assert.ok(presentation.entities.relations.length >= 4);
  const face = presentation.entities.interfaces.find((item) => item.title.startsWith('Cara −N'));
  assert.ok(face);
  assert.equal(face.locate.kind, 'structuralInterface');
  assert.equal(face.preview.kind, 'proposal-relation');
  assert.ok(face.preview.boundary);
  assert.notEqual(face.title, face.entityId);
  const region = presentation.entities.regions.find((item) => item.technicalReference.region.sRange[0] === 14500 && item.technicalReference.region.sRange[1] === 23200);
  assert.ok(region);
  assert.equal(region.locate.kind, 'structuralRegion');
  const relation = presentation.entities.relations.find((item) => item.title.startsWith('Transferencia de acciones'));
  assert.ok(relation);
  assert.equal(relation.locate.kind, 'structuralRelation');
  assert.ok(relation.preview.selected.length >= 2);
  assert.ok(relation.preview.overlapSegments.length >= 2);
  const interfaceNode = presentation.graphs.gravity.nodes.find((node) => node.role === 'declaredInterface');
  assert.ok(interfaceNode);
  assert.notEqual(interfaceNode.title, 'Referencia rota');
});

test('BUG-015-D-025: loadTransfer presenta Recibe → Entrega y support conserva Entrega → Recibe', async () => {
  const { buildFx008Rev8Short } = await import('./helpers/spec015dRev8.mjs');
  const context = await buildFx008Rev8Short({ declareEndpointSupports: false });
  const presentation = buildStructuralProposalVisualPresentation(context.model, context.proposals, context.paths);

  const loadTransfer = presentation.entities.relations.find(
    (item) => item.technicalReference?.structuralFunction === 'loadTransfer'
  );
  assert.ok(loadTransfer);
  assert.equal(
    loadTransfer.subtitle,
    'Cara −N · Muro X · 6→7 @ C + Cara +N · Muro X · 6→7 @ C → Extremo S mínimo · Muro X · 6→7 @ C + Extremo S máximo · Muro X · 6→7 @ C · fresh'
  );

  const supports = presentation.entities.relations.filter(
    (item) => item.technicalReference?.structuralFunction === 'support'
  );
  assert.equal(supports.length, 2);
  for (const support of supports) {
    assert.match(support.subtitle, /^Borde de cubierta · .* → Cara [−+]N · Muro X · 6→7 @ C · fresh$/);
  }
});

test('BUG-015-D-027: nodo de borde de cubierta usa Bn humano y relega boundaryId a Referencia técnica', async () => {
  const { buildFx008Rev8Short } = await import('./helpers/spec015dRev8.mjs');
  const context = await buildFx008Rev8Short({ declareEndpointSupports: false });
  const presentation = buildStructuralProposalVisualPresentation(context.model, context.proposals, context.paths);

  const node = presentation.graphs.gravity.nodes.find((item) => (
    item.role === 'declaredInterface'
    && item.technicalReference?.ownerRef?.kind === 'roofBoundary'
    && String(item.technicalReference.ownerRef.roofGeometryId) === '1785030887081'
  ));
  assert.ok(node);
  assert.equal(node.title, 'Borde de cubierta · Faldón poligonal 2–7 entre A–C · B3');
  assert.equal(node.subtitle, 'Interfaz estructural declarada · B3 · 1.700 mm · vigente');
  assert.doesNotMatch(node.title, /1785030887081|roof:/);
  assert.doesNotMatch(node.subtitle, /1785030887081|roof:/);
  assert.match(JSON.stringify(node.technicalReference), /roof:1785030887081:edge:/);

  const entity = presentation.entities.interfaces.find((item) => item.entityId === node.technicalReference.interfaceId);
  assert.equal(entity.title, node.title);
  assert.equal(entity.subtitle, 'B3 · 1.700 mm · vigente');
});

test('BUG-015-D-028: Localizar roofBoundary parcial usa sólo el sRange declarado', async () => {
  const { buildFx008Rev8Short, FX008_ROOF_NORTH } = await import('./helpers/spec015dRev8.mjs');
  const context = await buildFx008Rev8Short({ declareEndpointSupports: false });
  const presentation = buildStructuralProposalVisualPresentation(context.model, context.proposals, context.paths);
  const entity = presentation.entities.interfaces.find((item) => (
    item.technicalReference?.ownerRef?.kind === 'roofBoundary'
    && item.technicalReference.ownerRef.roofGeometryId === FX008_ROOF_NORTH
  ));
  assert.ok(entity, 'debe existir la interfaz parcial de la cubierta norte');
  assert.deepEqual(entity.technicalReference.locator.sRange, [12800, 14500]);
  assert.deepEqual(entity.preview.boundary, {
    start: { x: 12800, y: 2000, z: 3650 },
    end: { x: 14500, y: 2000, z: 3650 }
  });
  assert.deepEqual(entity.preview.bounds, { xMin: 12800, xMax: 14500, yMin: 2000, yMax: 2000 });
  assert.notEqual(entity.preview.bounds.xMax, 23200);

  const explicit = context.paths.gravity.paths.filter((path) => path.sourceRefs.relationId);
  assert.ok(explicit.length >= 2);
  assert.ok(explicit.every((path) => path.candidateState === 'incompleteCandidate'));
  assert.ok(explicit.every((path) => path.findings.includes('SI-EXPLICIT-END-SUPPORT-UNRESOLVED')));
});



test('BUG-015-D-031: roofBoundary parcial distingue interacción de borde físico en nodos y caminos', async () => {
  const { buildFx008Rev8Short, FX008_ROOF_NORTH } = await import('./helpers/spec015dRev8.mjs');
  const context = await buildFx008Rev8Short({ declareEndpointSupports: false });
  const presentation = buildStructuralProposalVisualPresentation(context.model, context.proposals, context.paths);

  const entity = presentation.entities.interfaces.find((item) => (
    item.technicalReference?.ownerRef?.kind === 'roofBoundary'
    && item.technicalReference.ownerRef.roofGeometryId === FX008_ROOF_NORTH
  ));
  assert.ok(entity);
  assert.equal(
    entity.title,
    'Borde de cubierta · Faldón poligonal 6–11A entre C–J · B1 · S 12800→14500'
  );
  assert.equal(
    entity.subtitle,
    'B1 · Interacción S 12800→14500 · 1.700 mm · borde físico 10.400 mm · vigente'
  );

  const node = presentation.graphs.gravity.nodes.find((item) => (
    item.role === 'declaredInterface'
    && item.technicalReference?.interfaceId === entity.entityId
  ));
  assert.ok(node);
  assert.equal(node.title, entity.title);
  assert.equal(
    node.subtitle,
    'Interfaz estructural declarada · B1 · Interacción S 12800→14500 · 1.700 mm · borde físico 10.400 mm · vigente'
  );

  const pathUsesPartialTitle = presentation.graphs.gravity.paths.some((path) => {
    const edges = new Map(presentation.graphs.gravity.edges.map((edge) => [edge.edgeId, edge]));
    const nodes = new Map(presentation.graphs.gravity.nodes.map((item) => [item.nodeId, item]));
    return path.edgeIds.some((edgeId) => {
      const edge = edges.get(edgeId);
      return nodes.get(edge?.fromNodeId)?.title === entity.title;
    });
  });
  assert.equal(pathUsesPartialTitle, true);

  const fullBoundary = presentation.entities.interfaces.find((item) => (
    item.technicalReference?.ownerRef?.kind === 'roofBoundary'
    && String(item.technicalReference.ownerRef.roofGeometryId) === '1785030887081'
  ));
  assert.ok(fullBoundary);
  assert.equal(fullBoundary.title, 'Borde de cubierta · Faldón poligonal 2–7 entre A–C · B3');
  assert.equal(fullBoundary.subtitle, 'B3 · 1.700 mm · vigente');
});

test('BUG-015-D-034: face/end parciales presentan locator.sRange/zRange y no el rango completo del host', async () => {
  const { buildFx008Rev8Short, FX008_FRONTON_C_6_7, FX008_SUPPORT_AT_6, FX008_SUPPORT_AT_7 } = await import('./helpers/spec015dRev8.mjs');
  const context = await buildFx008Rev8Short({ declareEndpointSupports: true });
  const pathsBefore = structuredClone(context.paths);
  const presentation = buildStructuralProposalVisualPresentation(context.model, context.proposals, context.paths);

  const c6 = presentation.entities.interfaces.find((item) => (
    item.technicalReference?.ownerRef?.kind === 'element'
    && item.technicalReference.ownerRef.id === FX008_SUPPORT_AT_6
    && item.technicalReference.locator?.kind === 'face'
  ));
  assert.ok(c6);
  assert.equal(c6.title, 'Cara −N · Muro Y · B→I @ 6');
  assert.equal(c6.subtitle, 'S 1949.45→2050.55 · Z 3250→4150 · vigente');
  assert.deepEqual(c6.technicalReference.locator.sRange, [1949.45, 2050.55]);
  assert.deepEqual(c6.technicalReference.locator.zRange, [3250, 4150]);
  assert.doesNotMatch(c6.subtitle, /S 1200→6600|Z 450→4150/);

  const c7 = presentation.entities.interfaces.find((item) => (
    item.technicalReference?.ownerRef?.kind === 'element'
    && item.technicalReference.ownerRef.id === FX008_SUPPORT_AT_7
    && item.technicalReference.locator?.kind === 'end'
  ));
  assert.ok(c7);
  assert.equal(c7.title, 'Extremo S máximo · Muro Y · A→C @ 7');
  assert.equal(c7.subtitle, 'S 1999.9→2000 · Z 3250→4150 · vigente');
  assert.deepEqual(c7.technicalReference.locator.sRange, [1999.9, 2000]);
  assert.deepEqual(c7.technicalReference.locator.zRange, [3250, 4150]);
  assert.doesNotMatch(c7.subtitle, /S 0→2000|Z 450→4150/);

  const frontonFace = presentation.entities.interfaces.find((item) => (
    item.technicalReference?.ownerRef?.kind === 'element'
    && item.technicalReference.ownerRef.id === FX008_FRONTON_C_6_7
    && item.technicalReference.locator?.kind === 'face'
    && item.technicalReference.locator.side === 'positiveN'
  ));
  assert.ok(frontonFace);
  assert.equal(frontonFace.subtitle, 'S 12800→14500 · Z 3250→4150 · vigente');

  const explicit = presentation.graphs.gravity.paths.filter((path) => path.sourceRefs.relationId);
  assert.equal(explicit.length, 4);
  assert.ok(explicit.every((path) => path.candidateState === 'completeCandidate'));
  assert.ok(explicit.every((path) => path.edgeIds.length === 4));
  assert.ok(explicit.every((path) => !path.findings.includes('SI-EXPLICIT-END-SUPPORT-UNRESOLVED')));
  assert.deepEqual(context.paths, pathsBefore, 'la presentación no debe mutar candidateLoadPaths');
});
