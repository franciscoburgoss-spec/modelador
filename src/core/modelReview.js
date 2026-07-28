// Snapshot puro de revisión constructiva. Reúne una sola evaluación común, los productores de
// techumbre legacy y la cobertura explícita sin convertir ausencia de findings en aprobación.

import {
  DOMAIN_RULES,
  resolveRuleLimit,
  ruleAppliesToRole
} from './domainRules.js';
import { buildElementsById } from './elementReferences.js';
import { hasOwn } from './hasOwn.js';
import { evaluateModelValidation } from './modelValidation.js';
import { buildParamsMap, resolveValue } from './projectParams.js';
import { validateRoofPlanes } from './roofPlaneValidation.js';
import { validateRoofSystems } from './trussLayout.js';
import { compareStableWallIds } from './wallJunctions.js';
import { WALL_ROLES, resolveWallTypeConfig } from './wallTypes.js';

function idKey(id) {
  return `${typeof id}:${String(id)}`;
}

function stableIds(ids) {
  return [...new Map(ids.map((id) => [idKey(id), id])).values()]
    .sort(compareStableWallIds);
}

function groupSkipped(skipped = []) {
  const groups = new Map();
  for (const item of skipped) {
    const key = `${item.rule ?? ''}\u0000${item.reason}`;
    if (!groups.has(key)) {
      groups.set(key, {
        rule: item.rule ?? null,
        reason: item.reason,
        count: 0
      });
    }
    groups.get(key).count += 1;
  }
  return [...groups.values()];
}

function evaluatorCoverage(result) {
  const checkedWallIds = stableIds(result.coverage?.checkedWallIds || []);
  const findingWallKeys = new Set(
    result.findings.flatMap((finding) => finding.wallIds || []).map(idKey)
  );
  return {
    instrumented: true,
    checkedWallIds,
    cleanWallIds: checkedWallIds.filter((id) => !findingWallKeys.has(idKey(id))),
    findingCount: result.findings.length,
    skipped: result.coverage?.skipped || [],
    skippedGroups: groupSkipped(result.coverage?.skipped)
  };
}

function shearCoverage(result) {
  const wallCounts = { verified: 0, conditional: 0, excluded: 0 };
  const unknownByCode = new Map();
  for (const wall of result.walls) {
    wallCounts[wall.status] += 1;
    for (const item of wall.conditions || []) {
      if (item.status !== 'unknown') continue;
      unknownByCode.set(item.code, (unknownByCode.get(item.code) || 0) + 1);
    }
  }
  return {
    instrumented: true,
    checkedWallIds: stableIds(result.coverage?.checkedWallIds || []),
    skipped: result.coverage?.skipped || [],
    skippedGroups: groupSkipped(result.coverage?.skipped),
    findingCount: result.findings.length,
    wallCounts,
    totals: result.totals,
    unknownConditions: [...unknownByCode].map(([code, count]) => ({ code, count }))
  };
}

function findProfile(model, profileId) {
  return (model?.library?.metalconProfiles || []).find((profile) => (
    idKey(profile?.id) === idKey(profileId)
  )) || null;
}

function compareTypeContexts(a, b) {
  const roleOrder = WALL_ROLES.indexOf(a.role) - WALL_ROLES.indexOf(b.role);
  if (roleOrder !== 0) return roleOrder;
  return compareStableWallIds(a.wallTypeId, b.wallTypeId);
}

function assignedTypeContexts(model) {
  const elements = model?.elements || [];
  const paramsMap = buildParamsMap(model?.projectParams || []);
  const elementsById = buildElementsById(elements);
  const contexts = new Map();

  for (const wall of elements.filter((element) => (
    element.type === 'wall' && element.wallTypeId != null
  ))) {
    const key = idKey(wall.wallTypeId);
    if (contexts.has(key)) continue;
    const effective = resolveWallTypeConfig(model, wall);
    const studProfile = findProfile(
      model,
      effective.metalconDefaults.studProfileId
    );
    contexts.set(key, {
      wallTypeId: effective.wallType.id,
      role: effective.role,
      gap: resolveValue(effective.osbDefaults.gap, paramsMap, elementsById),
      flangeWidth: resolveValue(studProfile?.B, paramsMap, elementsById)
    });
  }
  return [...contexts.values()].sort(compareTypeContexts);
}

function limitKey(limit) {
  if (limit === null) return 'null';
  return JSON.stringify(Object.fromEntries(
    Object.entries(limit).sort(([left], [right]) => left.localeCompare(right))
  ));
}

function addUnique(array, value) {
  if (!array.some((candidate) => idKey(candidate) === idKey(value))) array.push(value);
}

function createCriterion(rule, limit, source) {
  return {
    ruleId: rule.id,
    title: rule.titulo,
    reportSection: rule.reportSection,
    sheetVariants: [...rule.sheetVariants],
    origin: rule.origen,
    limit,
    source,
    roles: [],
    wallTypeIds: []
  };
}

/**
 * Colecciona criterios sólo desde tipos asignados con rol explícito. Una regla observada en un
 * finding legacy entra al informe con su límite medido, pero queda marcada como fuente `finding`.
 */
export function collectApplicableCriteria(model, findings = []) {
  if (!Array.isArray(findings)) throw new TypeError('findings debe ser un array.');
  const contexts = assignedTypeContexts(model);
  const criteria = [];

  for (const rule of Object.values(DOMAIN_RULES)) {
    const byLimit = new Map();
    for (const context of contexts) {
      if (!ruleAppliesToRole(rule.id, context.role)) continue;
      const limit = resolveRuleLimit(rule.id, context);
      const key = limitKey(limit);
      let criterion = byLimit.get(key);
      if (!criterion) {
        criterion = createCriterion(rule, limit, 'assigned-type');
        byLimit.set(key, criterion);
        criteria.push(criterion);
      }
      addUnique(criterion.roles, context.role);
      addUnique(criterion.wallTypeIds, context.wallTypeId);
    }

    for (const finding of findings.filter((item) => item.rule === rule.id)) {
      const limit = hasOwn(finding, 'limit') ? finding.limit : null;
      const key = limitKey(limit);
      if (byLimit.has(key)) continue;
      const criterion = createCriterion(rule, limit, 'finding');
      byLimit.set(key, criterion);
      criteria.push(criterion);
    }
  }
  return criteria;
}

/**
 * Frontera compartida entre la pantalla y el informe. Cada productor se ejecuta exactamente una
 * vez y el orden visible histórico se conserva.
 */
export function evaluateModelReview(model, extraMargin = 0) {
  const common = evaluateModelValidation(model, extraMargin);
  const roofSystemFindings = validateRoofSystems(model);
  const roofPlaneFindings = validateRoofPlanes(model);
  const findings = [
    ...common.findings,
    ...roofSystemFindings,
    ...roofPlaneFindings
  ];

  return {
    findings,
    coverage: {
      wallDomain: evaluatorCoverage(common.components.wallDomain),
      roofSupport: evaluatorCoverage(common.components.roofSupport),
      shearCapacity: shearCoverage(common.components.shearCapacity),
      legacyGeometry: {
        instrumented: false,
        findingCount: common.components.legacyGeometryFindings.length
      },
      roofGeometry: {
        instrumented: false,
        findingCount: roofSystemFindings.length + roofPlaneFindings.length
      }
    },
    criteria: collectApplicableCriteria(model, findings)
  };
}
