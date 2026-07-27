import { formatStaleWarning } from './derivedInvalidation.js';

// Inventario único de entry points descargables. `live` declara que la salida se calcula desde
// entidades vigentes y no consume cachés persistidas; `explicit` permite la salida informativa
// sólo si el archivo declara el estado; `block` es una guarda dura, sin confirmación anulable.
export const EXPORT_POLICIES = Object.freeze({
  'model-json': Object.freeze({
    label: 'modelo JSON',
    format: 'JSON',
    scope: 'all',
    staleBehavior: 'explicit'
  }),
  'takeoff-csv': Object.freeze({
    label: 'metrado CSV',
    format: 'CSV',
    scope: 'all',
    staleBehavior: 'explicit'
  }),
  'dxf-plan': Object.freeze({
    label: 'planta DXF',
    format: 'DXF',
    scope: 'none',
    staleBehavior: 'live'
  }),
  'dxf-framing': Object.freeze({
    label: 'tabiquería DXF',
    format: 'DXF',
    scope: 'framing',
    staleBehavior: 'block'
  }),
  'dxf-osb': Object.freeze({
    label: 'OSB DXF',
    format: 'DXF',
    scope: 'osb',
    staleBehavior: 'block'
  }),
  'dxf-truss': Object.freeze({
    label: 'cerchas DXF',
    format: 'DXF',
    scope: 'truss',
    staleBehavior: 'block'
  }),
  'dxf-foundation': Object.freeze({
    label: 'fundaciones DXF',
    format: 'DXF',
    scope: 'none',
    staleBehavior: 'live'
  }),
  'dxf-framing-sheets': Object.freeze({
    label: 'láminas de tabiquería DXF',
    format: 'DXF',
    scope: 'framing',
    staleBehavior: 'block'
  }),
  'dxf-osb-sheets': Object.freeze({
    label: 'láminas OSB DXF',
    format: 'DXF',
    scope: 'osb',
    staleBehavior: 'block'
  }),
  'dxf-truss-sheets': Object.freeze({
    label: 'láminas de cerchas DXF',
    format: 'DXF',
    scope: 'truss',
    staleBehavior: 'block'
  }),
  'calculix-global': Object.freeze({
    label: 'modelo CalculiX',
    format: 'INP',
    scope: 'all',
    staleBehavior: 'block'
  }),
  'calculix-truss': Object.freeze({
    label: 'cercha CalculiX',
    format: 'INP',
    scope: 'all',
    staleBehavior: 'block'
  }),
  'calculix-foundation': Object.freeze({
    label: 'fundaciones CalculiX',
    format: 'INP',
    scope: 'all',
    staleBehavior: 'block'
  })
});

export function evaluateExportPolicy(model, exporter) {
  const policy = EXPORT_POLICIES[exporter];
  if (!policy) throw new Error(`Exportador no registrado: ${exporter}`);

  const staleMessage = policy.scope === 'none'
    ? null
    : formatStaleWarning(model, policy.scope);
  if (!staleMessage) {
    return {
      exporter,
      policy,
      allowed: true,
      status: 'current',
      requiresAnnotation: false,
      staleMessage: null
    };
  }

  const blocked = policy.staleBehavior === 'block';
  return {
    exporter,
    policy,
    allowed: !blocked,
    status: 'stale',
    requiresAnnotation: policy.staleBehavior === 'explicit',
    staleMessage
  };
}

export function formatExportBlockMessage(result) {
  return [
    `No se puede exportar ${result.policy.label}: hay resultados desactualizados.`,
    '',
    'Regenera los despieces indicados antes de volver a exportar.',
    '',
    result.staleMessage
  ].filter(Boolean).join('\n');
}

export function formatExplicitStaleMessage(result) {
  return [
    `El ${result.policy.label} se exportará con estado DERIVADOS_DESACTUALIZADOS.`,
    'El archivo conserva o declara los flags stale para que no aparente vigencia.',
    '',
    result.staleMessage
  ].filter(Boolean).join('\n');
}

/**
 * Guarda común de descargas. Retorna el resultado para que el caller pueda abortar sin tocar DOM.
 */
export function guardExport(model, exporter, notifyFn) {
  const result = evaluateExportPolicy(model, exporter);
  const notify = notifyFn
    || (typeof globalThis.alert === 'function' ? globalThis.alert : null);
  if (!result.allowed) {
    if (notify) notify(formatExportBlockMessage(result));
    return result;
  }
  if (result.requiresAnnotation && notify) notify(formatExplicitStaleMessage(result));
  return result;
}

export function exportStatusLabel(model, exporter) {
  return evaluateExportPolicy(model, exporter).status === 'stale'
    ? 'DERIVADOS_DESACTUALIZADOS'
    : 'VIGENTE';
}
