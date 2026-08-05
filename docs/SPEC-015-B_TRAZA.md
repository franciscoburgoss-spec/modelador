# SPEC-015-B — Traza de contrato, código, pruebas y evidencia

**Estado:** cerrada; validación local autoritativa PASS 24/24.

| Contrato | Implementación | Prueba/evidencia | Estado web |
|---|---|---|---|
| Autoridad exclusiva `roofGeometry` | `projectAgnosticRoofGeometry`, `canonicalizeRoofBoundaries` | FX-008 y aislamiento estático | PASS enfocado |
| ID tipado + XY 3 decimales + SHA-256 | `boundaryPayload`, `sha256` | inversión, rotación, Z distinta, cubiertas numérica/texto | PASS |
| Longitud en planta >0,1 mm | `canonicalizeRoofBoundaries` | borde degenerado | PASS |
| Borde duplicado inválido | set de `boundaryId` por cubierta | polígono adversario A-B-A-D | PASS |
| `v == -v` | `canonicalizeResistanceDirection` | `{3,-4}` vs `{-3,4}` | PASS |
| `twoWay` no paralela | `angularSeparationDeg` | paralelo/antiparalelo | PASS |
| `local/undetermined` sin dirección | `validateRoofIntents` | combinación inválida | PASS |
| Una intención por cubierta | `validateRoofIntents` | target tipado y duplicados | PASS |
| Borde debe existir y pertenecer | validación contra mapa canónico | borde de otra cubierta | PASS |
| Orden mixto estable | `compareRoofIds` | número/texto 2/10 | PASS |
| Persistencia v3 | `modelSchema.js` | guardar/reabrir nativo | PASS |
| Importación sin inferencia | migración `2→3` existente | v2 con techumbre → `roofIntents: []` | PASS |
| Eliminar cubierta limpia referencias | reconciliación previa a historial | puro + store | PASS |
| Cubierta con intención resoluble | proyección selectiva antes de commit | nivel de apoyo roto | PASS |
| Borde desaparecido crea finding | `reconcileRoofIntentsAfterGeometryChange` | split del borde real y finding persistente | PASS |
| Sin reasignación por índice/cercanía | filtro exclusivo por `boundaryId` | borde original desaparece pese a nuevos bordes cercanos | PASS |
| Cambio constructivo sin efecto | comparación implícita por IDs persistentes | cambio de `profiles.topChord` | PASS |
| Undo/redo atómico | reconciliación dentro de `withHistory` | intención+finding en un paso | PASS |
| Derivados estructurales vacíos | resultado común | APIs core/store | PASS |
| Byte identity agnóstica | intención fuera del exportador | 81.875 bytes y SHA-256 golden | PASS |
| Visualización real | generador SVG/JSON | cuatro cubiertas declaradas de siete | PASS |
| UI definitiva fuera de alcance | ninguna acción de interfaz añadida | inspección de archivos modificados | Pendiente auditoría final |
| Suite Node ejecutable | 110 archivos sin dependencias ausentes | 866/866 | PASS web parcial |
| Cobertura ejecutable | core/store | 93,34 % / 95,77 % | PASS web parcial |
| Laboratorio | `npm run test:lab` | 35/35 | PASS web |
| Goldens/migración/derivados/Codex | scripts oficiales | 19; 187; 14/14; 11 ejecuciones | PASS web |
| Rust/Tauri | scripts oficiales | gates locales completos | PASS local |
| Artefactos/DXF/CalculiX | scripts oficiales | gates locales completos | PASS local |
| Gates oficiales completos | `validar_SPEC_015_B.sh` | 24/24; logs `20260805-170823` | PASS local |

## Pases de auditoría

### Contrato

La implementación mantiene `modelVersion: 3`, activa únicamente `roofIntents[]` y conserva las
otras colecciones futuras vacías.

### Determinismo

Los únicos órdenes persistentes son claves tipadas, `boundaryId` y componentes numéricos. No se
usa orden de entrada, fecha, aleatoriedad, locale ni contador global.

### Mutaciones e historial

Toda acción que usa `withHistory` pasa por reconciliación antes de publicar. Una excepción aborta
el callback de Zustand y no crea entrada en `past`.

### Independencia agnóstica/constructiva

La identidad ignora Z y todos los campos constructivos. La proyección selectiva llama los mismos
proyectores agnósticos; la intención no se incorpora a la serialización geométrica.

### Documentación

D-056, R-029 y REQ-DOM-007 registran el corte. `STATUS.md` mantiene SPEC-015-B activa y no declara
cierre ni gates locales no ejecutados.

## Validación local autoritativa

El validador único corregido pasó 24/24 gates el 05-ago-2026 en el Mac. La evidencia detallada se
conserva en `artifacts/validation-spec-015-b/20260805-170823`. La corrección previa sustituyó
`bash -lc` por `bash -c` en el preflight Node/npm para respetar el `PATH` activo de nvm; no cambió
el repositorio.
