// core/trussTemplates.js
// Plantillas de entramado interno de cerchas — definen el patrón (spacing de montantes,
// diagonales) y el perfil Metalcon por rol. Semilla: perfiles de las tablas del Anexo III
// "Informe técnico de cerchas" del Manual de Diseño Metalcon 2020 (Cintac) — esas tablas son
// para cerchas SL de dos aguas con S=120cm, se usan acá solo como PUNTO DE PARTIDA de perfiles
// para la cercha de un agua; la verificación estructural es responsabilidad del ingeniero
// (o del export a CalculiX más adelante). Las plantillas del usuario viven en
// library.trussTemplates y se editan/clonan desde el modal de techumbre.

// roles: topChord (cuerda superior), bottomChord (cuerda inferior), post (montante),
//        diagonal (diagonal), gutterChord (cuerda horizontal del rebaje de canaleta —
//        usa el perfil de topChord si no se define).
// ★ B4.7.2 — La costanera (perfil OMA + paso) es una decisión de PROYECTO: una sección única para
// toda la techumbre. Por eso vive en la plantilla (library.trussTemplates), no en cada faldón; el
// faldón la HEREDA vía templateId. purlinProfile = code Metalcon OMA; purlinSpacing = paso inclinado
// (mm) desde la canaleta. Ver resolvePurlinParams.
export const SEED_TRUSS_TEMPLATES = [
  {
    id: 'seed-liviana-70',
    name: 'Liviana (PP+SC=70 kgf/m2)',
    source: 'cintac',
    postSpacing: 600,        // mm entre montantes (reparto uniforme, ver computeMonoTrussGeometry)
    diagonalPattern: 'W',    // 'W' = diagonales alternadas entre montantes | 'none'
    profiles: { topChord: '60CA085', bottomChord: '60CA085', post: '40CA085', diagonal: '40CA085' },
    purlinProfile: '35OMA085', purlinSpacing: 600
  },
  {
    id: 'seed-estandar-130',
    name: 'Estándar (PP+SC=130 kgf/m2)',
    source: 'cintac',
    postSpacing: 600,
    diagonalPattern: 'W',
    profiles: { topChord: '90CA085', bottomChord: '90CA085', post: '40CA085', diagonal: '60CA085' },
    purlinProfile: '35OMA085', purlinSpacing: 600
  }
];

/** Merge de compatibilidad: agrega las semillas que falten a una lista existente (por id),
 * sin tocar las plantillas del usuario. */
export function mergeSeedTemplates(existing = []) {
  const byId = new Set(existing.map(t => t.id));
  return [...existing, ...SEED_TRUSS_TEMPLATES.filter(t => !byId.has(t.id))];
}

import { resolveTrussProfileDims } from './trussLayout.js';

/**
 * ★ B4.7.2 — Resuelve el perfil+paso de costanera EFECTIVOS de un faldón.
 *
 * Fuente única = la plantilla del proyecto (library.trussTemplates[templateId]). El faldón hereda:
 * si la plantilla define costanera, ESA manda. Si el faldón trae valores propios (modelos legacy,
 * antes de B4.7.2) que DIFIEREN de la plantilla, se emite un finding `info` de migración pero se
 * usa el de la plantilla. Sin plantilla (o sin costanera en ella) → cae a los valores propios del
 * faldón, preservando el comportamiento anterior.
 *
 * @param opts.plane    roofPlane persistido (puede traer templateId, purlinProfile, purlinSpacing,
 *                      purlinProfileH)
 * @param opts.library  library del modelo (trussTemplates + metalconProfiles para dims del perfil)
 * @returns {{ profile:string|null, spacing:number|string, profileH:number,
 *             template:object|null, findings:Array<{severity,category,message}> }}
 *   spacing puede ser fórmula (string) si viene así del faldón — el consumidor aplica resolveValue.
 */
export function resolvePurlinParams({ plane = {}, library = null } = {}) {
  const tpl = (library?.trussTemplates || []).find(t => t.id === plane.templateId) || null;
  const findings = [];

  const tplProfile = tpl?.purlinProfile ?? null;
  const tplSpacing = tpl?.purlinSpacing ?? null;
  const ownProfile = plane.purlinProfile ?? null;
  const ownSpacing = plane.purlinSpacing ?? null;

  // aviso de migración: el faldón arrastra un valor propio que no coincide con el de la plantilla.
  if (tpl && ownProfile != null && tplProfile != null && ownProfile !== tplProfile) {
    findings.push({ severity: 'info', category: 'purlinTemplate',
      message: `costanera: el faldón trae perfil ${ownProfile}, la plantilla "${tpl.name}" define ${tplProfile} — se usa el de la plantilla (proyecto)` });
  }
  if (tpl && ownSpacing != null && tplSpacing != null && Math.round(Number(ownSpacing)) !== Math.round(Number(tplSpacing))) {
    findings.push({ severity: 'info', category: 'purlinTemplate',
      message: `costanera: el faldón trae paso ${Math.round(Number(ownSpacing))}mm, la plantilla "${tpl.name}" define ${Math.round(Number(tplSpacing))}mm — se usa el de la plantilla` });
  }

  const profile = tplProfile ?? ownProfile ?? null;
  const spacing = tplSpacing ?? ownSpacing ?? 600;
  // altura del perfil (para holgura de coronación y caja 3D): del catálogo por code; si no hay code,
  // cae al purlinProfileH propio del faldón (legacy) y por último a 35mm (OMA más bajo).
  // ★ B4.7.8-s3 (B.2) — el ANCHO se resuelve igual que la altura. Antes sólo salía la altura y el
  // ancho quedaba hardcodeado en 40 aguas abajo (getRoofPurlinBoxes), lo que es falso para casi
  // todo el catálogo (35OMA085 → B=38, 92C085 → B=30, 42C085 → B=25…).
  const { h: profileH, b: profileB } = resolveTrussProfileDims(library, profile, plane.purlinProfileH ?? 35, 40);

  return { profile, spacing, profileH, profileB, template: tpl, findings };
}
