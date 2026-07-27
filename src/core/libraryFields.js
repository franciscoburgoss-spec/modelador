// core/libraryFields.js
// ★ Familias con sustitución global (Tanda 3, ítem 3).
// Campos de dimensión que cada tipo de sección de librería ("familia") controla en las
// instancias que la usan. Al editar una sección, useModelStore.updateLibraryItem cascada
// estos campos a todo elemento con ese libraryId — igual concepto que una familia de
// Revit: editar la familia una vez actualiza todas sus instancias.
export function getLibraryFields(key, itemType) {
  switch (key) {
    case 'wallSections': return ['thickness'];
    case 'columnSections': return ['widthX', 'widthY'];
    case 'beamSections': return ['width', 'height'];
    case 'foundationSections':
      if (itemType === 'sobrecimiento') return ['width', 'height'];
      if (itemType === 'aislada') return ['lengthX', 'lengthY', 'depth'];
      return ['width', 'depth']; // cimiento corrido
    case 'openingTemplates': return itemType === 'window' ? ['width', 'height', 'sillHeight'] : ['width', 'height'];
    // metalconProfiles: geometría fija de catálogo (H/B/e/...), no son campos de dimensión de
    // instancia editables por fórmula — por eso no cascadean nada (ver core/metalconCatalog.js).
    case 'metalconProfiles': return [];
    // materials: propiedades resistentes (E, resistencia, densidad) — no son campos de
    // dimensión de un elemento dibujado, se resuelven al exportar (ver core/exportCalculix.js),
    // por eso tampoco cascadean nada aquí.
    case 'materials': return [];
    default: return [];
  }
}
