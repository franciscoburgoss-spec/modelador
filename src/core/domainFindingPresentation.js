// Presentación y navegación puras para findings. React sólo consume este view-model y despacha la
// acción resuelta; las reglas, prioridades y textos verificables permanecen fuera del componente.

import { FINDING_SEVERITIES, getDomainRule } from './domainRules.js';
import { hasOwn } from './hasOwn.js';

const SEVERITY_LABELS = Object.freeze({
  error: 'Error',
  warning: 'Advertencia',
  info: 'Información'
});

const NAVIGATION_FIELDS = Object.freeze([
  { field: 'roofPlaneIds', kind: 'roofPlane', label: 'Ver faldón' },
  { field: 'roofSystemIds', kind: 'roofSystem', label: 'Ver sistema' },
  { field: 'wallIds', kind: 'wall', label: 'Centrar muro' },
  { field: 'elementIds', kind: 'element', label: 'Centrar' }
]);

function formatNumber(value) {
  return String(Object.is(value, -0) ? 0 : value);
}

function formatMeasured(measured) {
  if (measured === null) return 'No verificable';
  return `${formatNumber(measured.value)} ${measured.unit}`;
}

function formatLimit(limit) {
  if (limit === null) return 'No resoluble';
  if (hasOwn(limit, 'equal')) {
    return `= ${formatNumber(limit.equal)} ${limit.unit}`;
  }
  if (hasOwn(limit, 'exclusiveMin')) {
    return `> ${formatNumber(limit.exclusiveMin)} ${limit.unit}`;
  }
  if (hasOwn(limit, 'min') && hasOwn(limit, 'max')) {
    return `${formatNumber(limit.min)}–${formatNumber(limit.max)} ${limit.unit}`;
  }
  if (hasOwn(limit, 'min')) {
    return `≥ ${formatNumber(limit.min)} ${limit.unit}`;
  }
  return `≤ ${formatNumber(limit.max)} ${limit.unit}`;
}

function collectRuleSources(ruleId, visited = new Set(), sources = new Map()) {
  if (visited.has(ruleId)) return sources;
  visited.add(ruleId);
  const rule = getDomainRule(ruleId);
  if (!rule) return sources;

  if (rule.fuente) {
    const key = `${rule.fuente.doc}\u0000${rule.fuente.url}`;
    sources.set(key, rule.fuente);
  }
  for (const dependency of rule.dependsOn) {
    collectRuleSources(dependency, visited, sources);
  }
  return sources;
}

/** Agrupa en el orden visual estable error → warning → info, sin descartar severidades válidas. */
export function groupFindingsBySeverity(findings = []) {
  if (!Array.isArray(findings)) throw new TypeError('findings debe ser un array.');
  for (const finding of findings) {
    if (!FINDING_SEVERITIES.includes(finding?.severity)) {
      throw new TypeError(`Finding con severity inválido: ${finding?.severity}.`);
    }
  }
  return FINDING_SEVERITIES.map((severity) => ({
    severity,
    findings: findings.filter((finding) => finding.severity === severity)
  }));
}

/** Resuelve el primer destino navegable según la prioridad tipada fijada por SPEC-R4. */
export function resolveFindingNavigation(finding) {
  for (const target of NAVIGATION_FIELDS) {
    const id = finding?.[target.field]?.find((candidate) => candidate != null);
    if (id != null) return { kind: target.kind, id, label: target.label };
  }
  return null;
}

/** Convierte un finding canónico o legacy en datos de presentación sin mutarlo. */
export function presentFinding(finding) {
  const rule = finding?.rule ? getDomainRule(finding.rule) : null;
  const hasMeasured = hasOwn(finding, 'measured');
  const hasLimit = hasOwn(finding, 'limit');
  return {
    severityLabel: SEVERITY_LABELS[finding.severity] || finding.severity,
    ruleId: rule?.id ?? null,
    ruleTitle: rule?.titulo ?? null,
    measuredText: hasMeasured ? formatMeasured(finding.measured) : null,
    limitText: hasLimit ? formatLimit(finding.limit) : null,
    sources: rule ? [...collectRuleSources(rule.id).values()] : [],
    navigation: resolveFindingNavigation(finding)
  };
}
