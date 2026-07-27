# SPEC-001 — Seguridad de fórmulas e integridad de importación

## Diagnóstico

`projectParams.js` acepta nombres presentes mediante `in` y evalúa la expresión con
`new Function`. El payload probado
`constructor.constructor(/localStorage.clear()/.source)()` puede producir efectos.

`mergeLoadedModel` reemplaza `roofSystems` por `[]`; el fixture `casa-L.json` pasa de dos sistemas a
cero. `loadModel({})` devuelve éxito y deja un modelo sin `grid`.

## Decisión

Adoptar un evaluador de AST numérico cerrado y un límite de importación con esquema versionado.
Toda migración ocurre antes de mutar el store. La compatibilidad heredada preserva datos aunque una
representación moderna tenga precedencia para el cálculo.

## Alcance

- Gramática de números, paréntesis, referencias y operadores aritméticos permitidos.
- Acceso sólo a claves propias declaradas; detección de ciclos y límites de profundidad.
- Esquema de modelo y `modelVersion`.
- Migraciones puras, secuenciales e idempotentes.
- Validación estructural y de invariantes antes del commit al store.
- Preservación de `roofSystems` legacy y advertencia visible.
- Errores tipados para UI, sin depender sólo de consola.

## Fuera de alcance

- Nuevas funciones matemáticas no requeridas por fixtures.
- Corregir la geometría propia de sistemas heredados.
- Persistencia Tauri y backups.
- Cambios generales a reglas R3–R8.

## Criterios de aceptación

1. El payload conocido y variantes con `constructor`, propiedades, llamadas y globals se rechazan.
2. Expresiones válidas de todos los fixtures conservan su resultado.
3. Claves heredadas no pueden acceder a propiedades del prototipo.
4. `{}`, JSON truncado y versiones futuras se rechazan sin modificar el estado.
5. Cada versión histórica soportada tiene fixture y prueba de migración.
6. Ejecutar una migración dos veces produce el mismo modelo.
7. `casa-L.json` conserva sus dos `roofSystems` después de abrir, guardar y reabrir.
8. Un modelo con `roofPlanes` y `roofSystems` conserva ambos y emite advertencia de precedencia.
9. El archivo original no se sobrescribe durante apertura o migración.
10. Al revertir el parser o la preservación, sus pruebas de regresión fallan.

## Evidencia

- corpus de expresiones adversarias;
- fixtures versionados;
- prueba de igualdad semántica del store antes/después de imports fallidos;
- cierre de sesión con conteo de reversión.

