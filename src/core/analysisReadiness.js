// core/analysisReadiness.js
//
// ★ Etapa 2 del flujo (predimensionar → verificar/asignar perfil real → documentar en DXF):
// checklist NO bloqueante que revisa, antes de exportar a CalculiX, qué elementos van a usar
// material/sección genérica (fallback) vs material y perfil real de catálogo. No verifica
// resistencia (eso requiere haber corrido CalculiX y leído resultados — hoy es manual, fuera
// de esta app; ver notas del proyecto sobre la futura migración a Tauri para automatizarlo).
//
// Diseñada como función pura sin dependencias de UI para que, cuando la app migre a escritorio
// (Tauri) y pueda disparar CalculiX directamente, esta misma función siga sirviendo de gate
// antes de correr el análisis — no habría que reescribir la lógica de chequeo, solo la UI.

import { findProjectMetalconProfile } from './exportCalculix.js';

const TYPE_LABELS = { column: 'Pilar', beam: 'Viga' };

function checkColumnOrBeamSection(el, sections, materials, issues) {
  const label = TYPE_LABELS[el.type];
  if (el.libraryId == null) {
    issues.push({ severity: 'info', category: 'Sin sección de librería', message: `${label} sin sección de librería asignada — usará material genérico (hormigón) en CalculiX.`, elementIds: [el.id] });
    return;
  }
  const section = sections.find(s => s.id === el.libraryId);
  if (!section) {
    issues.push({ severity: 'warning', category: 'Sección eliminada', message: `${label} referencia una sección de librería que ya no existe — usará material genérico en CalculiX.`, elementIds: [el.id] });
    return;
  }
  if (section.materialId == null) {
    issues.push({ severity: 'info', category: 'Sin material asignado', message: `${label} (sección "${section.name || section.id}") sin material asignado — usará hormigón genérico en CalculiX.`, elementIds: [el.id] });
    return;
  }
  const material = materials.find(m => m.id === section.materialId);
  if (!material) {
    issues.push({ severity: 'warning', category: 'Material eliminado', message: `${label} (sección "${section.name || section.id}") referencia un material que ya no existe en el catálogo — usará genérico en CalculiX.`, elementIds: [el.id] });
    return;
  }
  if (material.category === 'metalcon' && section.metalconProfileId == null) {
    issues.push({ severity: 'info', category: 'Sin perfil de catálogo', message: `${label} (sección "${section.name || section.id}") con material Metalcon pero sin perfil de catálogo — usará envolvente rectangular manual, no un perfil real verificado.`, elementIds: [el.id] });
  }
}

function checkWallFraming(wall, metalconProfiles, materials, issues) {
  const hasProfilesAssigned = wall.framingStudProfileId != null || wall.framingTrackProfileId != null;
  if (!hasProfilesAssigned) return; // muro sin metalcon asignado — no es un error, simplemente no aplica

  if (!wall.studs || !wall.studs.length) {
    issues.push({ severity: 'warning', category: 'Despiece desactualizado', message: `Muro con perfiles asignados pero sin despiece generado — regenera en "Modulación de metalcon" antes de exportar.`, elementIds: [wall.id] });
    return;
  }
  if (wall.framingStudProfileId != null && !findProjectMetalconProfile(metalconProfiles, wall.framingStudProfileId)) {
    issues.push({ severity: 'warning', category: 'Perfil no encontrado', message: `Muro: el perfil de montante ya no está en la librería del proyecto — recárgalo en "Modulación de metalcon".`, elementIds: [wall.id] });
  }
  if (wall.framingTrackProfileId != null && !findProjectMetalconProfile(metalconProfiles, wall.framingTrackProfileId)) {
    issues.push({ severity: 'warning', category: 'Perfil no encontrado', message: `Muro: el perfil de solera ya no está en la librería del proyecto — recárgalo en "Modulación de metalcon".`, elementIds: [wall.id] });
  }
  if (wall.framingMaterialId == null) {
    issues.push({ severity: 'info', category: 'Sin material asignado', message: `Muro con montantes/soleras sin material asignado — usará acero galvanizado genérico en CalculiX.`, elementIds: [wall.id] });
  } else if (!materials.find(m => m.id === wall.framingMaterialId)) {
    issues.push({ severity: 'warning', category: 'Material eliminado', message: `Muro: el material asignado a sus montantes/soleras ya no existe en el catálogo — usará genérico en CalculiX.`, elementIds: [wall.id] });
  }
}

/** Revisa el modelo completo y devuelve una lista de issues { severity, category, message,
 * elementIds }. severity: 'warning' (algo roto/desactualizado, requiere acción) o 'info'
 * (funcionará con un fallback genérico — válido, pero no es un perfil/material verificado). */
export function checkAnalysisReadiness(model) {
  const { elements, library } = model;
  const materials = library?.materials || [];
  const columnSections = library?.columnSections || [];
  const beamSections = library?.beamSections || [];
  const metalconProfiles = library?.metalconProfiles || [];
  const issues = [];

  for (const el of elements) {
    if (el.type === 'column') checkColumnOrBeamSection(el, columnSections, materials, issues);
    else if (el.type === 'beam') checkColumnOrBeamSection(el, beamSections, materials, issues);
    else if (el.type === 'wall') checkWallFraming(el, metalconProfiles, materials, issues);
  }
  return issues;
}
