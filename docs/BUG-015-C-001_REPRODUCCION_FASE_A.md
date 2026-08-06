# BUG-015-C-001 — Reproducción documental de Fase A

**Estado:** reproducido; pendiente de registro formal al abrir Fase B
**Severidad propuesta:** P2 UX / riesgo de declaración sobre objetivo equivocado
**Baseline:** SPEC-015-C cerrada
**No corregido en Fase A**

## Síntoma

En `Estructura → Intención estructural… → Muros y elementos`, la lista permite seleccionar y editar
una declaración, pero identifica cada objetivo principalmente mediante su ID numérico.

## Pasos reproducibles

1. Abrir `Intención estructural…`.
2. Cambiar a `Muros y elementos`.
3. Buscar o recorrer un muro.
4. Observar la fila y abrir `Editar`.
5. Intentar distinguir el muro `1784605101040` de otros muros sin memorizar IDs.

## Resultado observado

La fila productiva contiene:

```text
Sel. | ID | Tipo | Estado | Editar
```

El formulario abierto tampoco agrega una planta o elevación contextual. La selección masiva muestra
IDs en la confirmación, pero no una preview geométrica del conjunto.

## Resultado esperado por SPEC-015-C-1

```text
lista ↔ descriptor ↔ preview individual/lote ↔ localización temporal en Canvas
```

El muro de referencia debe reconocerse como:

```text
Muro X · 7→11A @ C · NPT→FRONTON GENERAL
L 8700 mm · e 101,1 mm · h 3700 mm · 3 vanos
ID 1784605101040
```

## Evidencia de código

- `src/components/modals/StructuralIntentWorkspaceDialog.jsx`, `renderElements`: tabla sin preview ni
  descriptor.
- mismo componente, `renderRoof`: `RoofPolygon` sí presenta geometría real para Techumbre.
- `src/core/structuralIntentWorkspace.js`: `geometrySummary` entrega sólo dimensiones resumidas y
  no produce geometría visual.
- `src/components/modals/ElementInventoryModal.jsx`: `Localizar` cierra el modal y llama a
  `centerOnElement`, patrón incompatible con la protección de borradores de C-1.

## Alcance del defecto

- edición individual de muros;
- edición individual de fundaciones u otros elementos soportados;
- preparación y confirmación de lote;
- riesgo de confundir objetivos cercanos o de IDs similares.

No afecta la validez del schema, la atomicidad de las mutaciones ni la traza existente. El defecto es
de identificación previa a la decisión.

## Condición de cierre

Se cierra sólo cuando la implementación de Fase B cumpla la SPEC aprobada, pase sus pruebas y sea
validada localmente en el Mac del usuario. Este documento no registra el BUG en gobernanza durante
Fase A; el registro formal debe preceder la corrección productiva en Fase B.
