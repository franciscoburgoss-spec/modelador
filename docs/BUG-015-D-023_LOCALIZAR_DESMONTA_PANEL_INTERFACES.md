# BUG-015-D-023 — Localizar desmonta el panel de Interfaces y pierde el borrador local

## Estado

Corregido en SPEC-015-D REV8 — Correctiva 09.

## Detección

Durante la validación focal posterior a BUG-015-D-020 se seleccionó el host real `1784819708086` (muro X · 6→7 @ C), se ejecutó `Localizar cara` y luego `Restaurar vista`. Al continuar a `Región S/Z`, el panel reapareció con el primer host de la lista (2→7 @ A) y con los rangos completos de ese muro, en vez de conservar el borrador local C/6→7.

## Causa

`StructuralIntentWorkspaceDialog` retornaba exclusivamente el diálogo del localizador mientras `structuralIntentLocator.active` era verdadero. Ese `return` desmontaba `StructuralInterfacesPanel`. Al restaurar o conservar la vista, React montaba un panel nuevo y se perdía su estado local no persistido (host, tipo de ubicación, cara/extremo, rangos S/Z y notas).

## Corrección

El workspace principal permanece montado durante la vista temporal de Localizar y se oculta visualmente con `display: none`; el localizador se renderiza en paralelo. De esta forma la navegación temporal no destruye el borrador local y continúa sin convertirlo en autoridad persistida.

## Regresión exigida

Después de `Localizar cara` → `Restaurar vista` sobre C/6→7:

- `Host` sigue siendo `1784819708086`.
- El contexto sigue identificando `6→7 @ C`.
- Al cambiar a `Región S/Z`, los valores por defecto son `S 12800→14500` y `Z 3250→4150 mm`.
- La selección global previa se conserva.
- No cambia `structuralIntent`.
- No cambia `structuralIntentTrace`.
- No se crea historia.

## Alcance

No cambia schema, geometría agnóstica, contratos de interfaz/relación, caminos candidatos ni semántica de Localizar. La corrección sólo preserva el estado local del editor durante una navegación temporal.
