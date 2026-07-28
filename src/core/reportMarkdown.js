// Renderer Markdown puro para el snapshot compartido de revisión. No lee reloj, DOM, store ni red.

import { presentFinding } from './domainFindingPresentation.js';
import { getDomainRule } from './domainRules.js';
import { normalizeProjectInfo } from './projectInfo.js';

const SEVERITY_SECTIONS = Object.freeze([
  { severity: 'error', heading: 'Hallazgos críticos' },
  { severity: 'warning', heading: 'Hallazgos moderados' },
  { severity: 'info', heading: 'Observaciones' }
]);

function escapeUntrusted(value) {
  return String(value ?? '')
    .replace(/\r\n?/g, '\n')
    .replace(/\n/g, ' / ')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\\/g, '\\\\')
    .replace(/\|/g, '\\|')
    .replace(/([`*_[\]()#!])/g, '\\$1')
    .replace(/\b(https?|mailto):/gi, '$1&#58;');
}

function formatIds(ids = []) {
  return ids.length > 0
    ? ids.map((id) => escapeUntrusted(id)).join(', ')
    : 'Ninguno';
}

function findingSection(finding) {
  const rule = finding.rule ? getDomainRule(finding.rule) : null;
  if (rule) return rule.reportSection;
  if ((finding.roofPlaneIds || []).length || (finding.roofSystemIds || []).length) {
    return 'Techumbre';
  }
  if ((finding.wallIds || []).length) return 'Muros';
  return 'Modelo';
}

function sourceLink(source) {
  const label = escapeUntrusted(`${source.doc} — ${source.seccion}`);
  return `[${label}](${source.url})`;
}

function normText(finding, presented) {
  const rule = finding.rule ? getDomainRule(finding.rule) : null;
  if (!rule) return 'Sin regla catalogada';
  if (rule.origen === 'derivado') return 'No aplica — criterio derivado';
  if (rule.origen === 'obra') return 'No aplica — criterio de obra';
  return presented.sources.length > 0
    ? presented.sources.map(sourceLink).join('; ')
    : 'Fuente manual no disponible';
}

function findingRow(finding, index) {
  const presented = presentFinding(finding);
  const expected = Object.hasOwn(finding, 'limit')
    ? presented.limitText
    : 'No declarado';
  const measured = Object.hasOwn(finding, 'measured')
    ? presented.measuredText
    : 'No medido';
  return `| ${index} | ${escapeUntrusted(findingSection(finding))} | `
    + `${escapeUntrusted(`${finding.category}: ${finding.message}`)} | `
    + `${normText(finding, presented)} | ${escapeUntrusted(expected)} | `
    + `${escapeUntrusted(measured)} |`;
}

function appendFindingSection(lines, findings, section) {
  lines.push(`## ${section.heading}`, '');
  const selected = findings
    .map((finding, index) => ({ finding, index: index + 1 }))
    .filter(({ finding }) => finding.severity === section.severity);
  if (selected.length === 0) {
    lines.push('Sin hallazgos.', '');
    return;
  }
  lines.push(
    '| # | Sección | Hallazgo | Norma | Esperado | Encontrado |',
    '|---:|---|---|---|---|---|'
  );
  for (const item of selected) lines.push(findingRow(item.finding, item.index));
  lines.push('');
}

function appendSkipped(lines, skippedGroups = []) {
  if (skippedGroups.length === 0) {
    lines.push('- Omisiones declaradas: Ninguna');
    return;
  }
  lines.push(
    '- Omisiones declaradas:',
    '',
    '| Regla | Motivo | Casos |',
    '|---|---|---:|'
  );
  for (const group of skippedGroups) {
    lines.push(
      `| ${escapeUntrusted(group.rule ?? 'Sin regla')} | `
      + `${escapeUntrusted(group.reason)} | ${group.count} |`
    );
  }
}

function appendEvaluatorCoverage(lines, heading, coverage = {}) {
  lines.push(
    `### ${heading}`,
    '',
    `- IDs inspeccionados: ${formatIds(coverage.checkedWallIds)}`,
    `- IDs sin hallazgo en este evaluador: ${formatIds(coverage.cleanWallIds)}`,
    `- Hallazgos: ${coverage.findingCount ?? 0}`
  );
  appendSkipped(lines, coverage.skippedGroups);
  lines.push('');
}

function appendShearCoverage(lines, coverage = {}) {
  const counts = coverage.wallCounts || {
    verified: 0,
    conditional: 0,
    excluded: 0
  };
  lines.push(
    '### Capacidad de corte',
    '',
    `- Muros: ${counts.verified} verificados; ${counts.conditional} condicionados; `
      + `${counts.excluded} excluidos.`,
    `- Hallazgos: ${coverage.findingCount ?? 0}`,
    `- IDs inspeccionados: ${formatIds(coverage.checkedWallIds)}`,
    '',
    '| Dirección | Capacidad verificada | Capacidad condicionada | Largo excluido |',
    '|---|---:|---:|---:|'
  );
  for (const direction of ['x', 'y']) {
    const total = coverage.totals?.[direction] || {};
    lines.push(
      `| ${direction.toUpperCase()} | ${total.verifiedCapacityKgf ?? 0} kgf | `
      + `${total.conditionalCapacityKgf ?? 0} kgf | ${total.excludedLengthM ?? 0} m |`
    );
  }
  lines.push('');
  appendSkipped(lines, coverage.skippedGroups);
  lines.push(
    '',
    '- Condiciones no verificables:',
    ''
  );
  if ((coverage.unknownConditions || []).length === 0) {
    lines.push('Ninguna.', '');
    return;
  }
  lines.push('| Condición | Casos |', '|---|---:|');
  for (const item of coverage.unknownConditions) {
    lines.push(`| ${escapeUntrusted(item.code)} | ${item.count} |`);
  }
  lines.push('');
}

function appendCoverage(lines, coverage = {}) {
  lines.push('## Cobertura', '');
  appendEvaluatorCoverage(lines, 'Reglas de muro', coverage.wallDomain);
  appendEvaluatorCoverage(lines, 'Apoyos de techumbre', coverage.roofSupport);
  appendShearCoverage(lines, coverage.shearCapacity);
  lines.push(
    '### Geometría legacy',
    '',
    'Cobertura no instrumentada.',
    '',
    `Hallazgos: ${coverage.legacyGeometry?.findingCount ?? 0}.`,
    '',
    '### Geometría de techumbre',
    '',
    'Cobertura no instrumentada.',
    '',
    `Hallazgos: ${coverage.roofGeometry?.findingCount ?? 0}.`,
    ''
  );
}

function criterionApplicability(criterion) {
  const roles = criterion.roles.length > 0 ? criterion.roles.join(', ') : 'Sin rol explícito';
  const types = criterion.wallTypeIds.length > 0
    ? criterion.wallTypeIds.join(', ')
    : 'Sin tipo explícito';
  return `${roles}; tipos: ${types}`;
}

function criterionLimit(criterion) {
  if (criterion.limit === null) return 'No resoluble con los datos actuales';
  return presentFinding({ severity: 'info', limit: criterion.limit }).limitText;
}

function appendCriteria(lines, criteria = []) {
  lines.push('## NOTAS GENERALES — criterios aplicables', '');
  if (criteria.length === 0) {
    lines.push('No hay criterios aplicables con los datos actuales.', '');
    return;
  }
  lines.push(
    '| Regla | Sección | Criterio | Aplica a | Límite | Fuente |',
    '|---|---|---|---|---|---|'
  );
  for (const criterion of criteria) {
    const rule = getDomainRule(criterion.ruleId);
    const presented = {
      sources: rule
        ? presentFinding({ severity: 'info', rule: rule.id }).sources
        : []
    };
    lines.push(
      `| ${escapeUntrusted(criterion.ruleId)} | `
      + `${escapeUntrusted(criterion.reportSection)} | `
      + `${escapeUntrusted(criterion.title)} | `
      + `${escapeUntrusted(criterionApplicability(criterion))} | `
      + `${escapeUntrusted(criterionLimit(criterion))} | `
      + `${normText({ rule: criterion.ruleId }, presented)} |`
    );
  }
  lines.push('');
}

/**
 * Renderiza un snapshot ya evaluado. `date` es opcional e inyectable; nunca se consulta el reloj.
 */
export function renderReviewMarkdown(review, { projectInfo, date } = {}) {
  if (!review || !Array.isArray(review.findings)) {
    throw new TypeError('review requiere findings.');
  }
  const info = normalizeProjectInfo(projectInfo);
  const declaredDate = info.fecha || date || 'No declarada';
  const counts = { error: 0, warning: 0, info: 0 };
  for (const finding of review.findings) counts[finding.severity] += 1;

  const lines = [
    '# Informe de revisión constructiva',
    '',
    '## Identificación',
    '',
    '| Campo | Valor |',
    '|---|---|',
    `| Obra | ${escapeUntrusted(info.obra || 'No declarada')} |`,
    `| Ubicación | ${escapeUntrusted(info.ubicacion || 'No declarada')} |`,
    `| Proyecto | ${escapeUntrusted(info.proyectoNumero || 'No declarado')} |`,
    `| Fecha | ${escapeUntrusted(declaredDate)} |`,
    '',
    '## Resumen',
    '',
    `- Críticos: ${counts.error}`,
    `- Moderados: ${counts.warning}`,
    `- Observaciones: ${counts.info}`,
    ''
  ];

  for (const section of SEVERITY_SECTIONS) {
    appendFindingSection(lines, review.findings, section);
  }
  appendCoverage(lines, review.coverage);
  appendCriteria(lines, review.criteria);
  return `${lines.join('\n')}\n`;
}
