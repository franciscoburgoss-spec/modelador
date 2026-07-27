// core/levelTypes.js
// Catálogo de "tipo de nivel" para niveles Z (grid.zLevels) — permite marcar un nivel como
// cielo/frontón general o alto, y mostrarlo con su sigla + símbolo estándar en los DXF de
// tabiquería (ver levelSymbolEntities en exportFramingDxf.js). Un nivel sin levelType (o con
// uno no reconocido) no dibuja símbolo/sigla — sigue mostrando solo la línea + label como antes.

export const LEVEL_TYPES = {
  terreno:        { sigla: 'NTN', label: 'Nivel de terreno natural', datum: true },
  pisoTerminado:  { sigla: 'NPT', label: 'Nivel de piso terminado', datum: true },
  cieloGeneral:   { sigla: 'CG', label: 'Cielo general' },
  cieloAlto:      { sigla: 'CA', label: 'Cielo alto' },
  frontonGeneral: { sigla: 'FG', label: 'Frontón general' },
  frontonAlto:    { sigla: 'FA', label: 'Frontón alto' }
};

export const LEVEL_TYPE_OPTIONS = [
  { value: '', label: '—' },
  ...Object.entries(LEVEL_TYPES).map(([value, def]) => ({ value, label: `${def.label} (${def.sigla})` }))
];
