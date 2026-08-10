# BUG-015-D-020 — Caras canónicas +N/−N sin identificación geométrica visible

## Estado

Corregido en la Correctiva 06 de SPEC-015-D REV8. Pendiente de validación visual real por el usuario antes del cierre documental de la revisión.

## Detección

Durante la validación visual de SPEC-015-D REV8, al seleccionar el muro real FX-008 `C / 6→7` y alternar `Cara +N` / `Cara −N`, la UI sólo cambiaba el valor textual del selector. No existía representación del muro, de la normal canónica ni de la cara física seleccionada.

Esto obligaba al usuario a conocer de memoria la convención interna:

- muro X: `+N = +Y` de Planta;
- muro Y: `+N = −X` de Planta;
- `S` crece siempre en el sentido positivo del eje mundo del muro.

Una interfaz podía quedar formalmente válida pero declarada sobre la cara física equivocada.

## Corrección

Se incorpora un contexto geométrico explícito para ubicaciones de interfaz sobre muros:

1. preview del host en la misma orientación X/Y de Planta;
2. extremos humanos `lowS/highS` mediante los ejes nominales del proyecto;
3. flechas `+N` y `−N` con equivalencia mundo visible;
4. resaltado de la cara seleccionada en el lado físico correcto;
5. soporte equivalente para `Extremo` y `Región S/Z`;
6. `Localizar cara`, `Localizar extremo` y `Localizar región` mediante el localizador temporal existente;
7. el localizador resalta la ubicación, no convierte la cara en acción lateral ni introduce autoridad estructural nueva.

## Invariantes

- No cambia `modelVersion`.
- No cambia `structural-intent-v1.1`.
- No cambia la identidad canónica de interfaces o relaciones.
- No cambia geometría agnóstica.
- No introduce `structuralAssembly`.
- `Localizar` no modifica intención, trace, review, historial ni selección global persistente.
- La geometría equivalente con el prisma invertido conserva el mismo marco canónico visible.

## Caso real de regresión

FX-008, muro `1784819708086`:

- eje longitudinal X;
- `S mínimo = 6`;
- `S máximo = 7`;
- eje fijo `C`;
- `+N = +Y` de Planta;
- `−N = −Y` de Planta.

La prueba exige que `Cara +N` y `Cara −N` queden en lados opuestos del espesor real y que el localizador mantenga cero mutación estructural.
