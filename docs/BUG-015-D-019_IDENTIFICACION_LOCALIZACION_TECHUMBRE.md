# BUG-015-D-019 — Identificación y localización incompletas de cubiertas en Intención estructural

## Estado

Reproducido en la validación visual real de SPEC-015-D REV8, después de que la validación automática completa terminó en PASS.

## Reproducción

En `Estructura → Intención estructural… → Techumbre`:

- la lista identifica cada faldón principalmente por su ID interno;
- el preview dibuja B1…Bn en una caja normalizada independiente;
- el preview no muestra los ejes nominales que intervienen;
- la geometría se escala por X e Y de forma independiente, por lo que no conserva exactamente la proporción de Planta;
- la pestaña no expone `Localizar` aunque el contrato de navegación temporal ya existe para otras intenciones.

El usuario puede editar una cubierta, pero para saber a qué zona real del proyecto corresponde debe memorizar el ID o inferirlo desde una forma aislada.

## Causa

`StructuralIntentWorkspaceDialog.jsx` usa un `RoofPolygon` local que normaliza el polígono a un rectángulo fijo y la lista renderiza `roofGeometryId` como referencia principal. A diferencia del presentador de muros/elementos, la capa de workspace de techumbre no construye un descriptor humano ni una preview compatible con el localizador transitorio.

## Corrección

- Derivar para cada cubierta un descriptor humano desde los ejes X/Y que coinciden con sus vértices reales.
- Mantener el ID como referencia técnica secundaria, no como identificación primaria.
- Construir un `visualPreview` de cubierta con el polígono real en coordenadas de Planta.
- Reutilizar el localizador de intención estructural para `Localizar cubierta` sin crear historial ni trazabilidad.
- Dibujar el preview embebido con escala uniforme, orientación Y idéntica a Planta y ejes nominales intervinientes.
- Conservar B1…Bn sobre los bordes canónicos reales.

## Invariantes

- No cambia `modelVersion` ni `structural-intent-v1.1`.
- No se modifica geometría, intención estructural persistida, interfaces, relaciones o caminos candidatos.
- No se infiere ningún apoyo, acción o función desde los ejes mostrados.
- `Localizar cubierta` es navegación efímera y restaurable.
- La selección global, historial, review y trace permanecen intactos.
- El ID de cubierta se conserva para trazabilidad técnica.
- No se ejecuta Git.

## Criterio de cierre

Para FX-008, la cubierta `1785030887081` debe mostrarse como `Ejes X: 2 · 6 · 7 · Ejes Y: A · B · C`, su preview debe contener los mismos vértices X/Y que la geometría agnóstica y `Localizar cubierta` debe encuadrarla en la Planta real sin mutación estructural.
