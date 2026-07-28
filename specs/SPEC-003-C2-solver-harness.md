# SPEC-003-C2 — Arnés solver y familia homogénea del INP global

> Sustituye `SPEC-003-C1-solver-harness.md` después de ejecutar su corrección con CalculiX real.
> Precondición mecánica cerrada en `SPEC-003-C0-fx004-mechanical-properties.md`.
> Decisiones relacionadas: D-011, D-030, D-031, D-032 y D-033.

## Diagnóstico

La implementación provisional de C1 alcanzó un contrato estático correcto en el INP global:

- 1.384 nodos, 1.046 elementos y cero tokens no finitos;
- 133 `ELSET`, todos de máximo 16 caracteres;
- 137 referencias `*BEAM SECTION`, todas resueltas;
- cuatro fundaciones B31 con conjunto persistente propio y sección `RECT` de 1.050 × 400 mm.

CalculiX 2.23, sin embargo, termina con código 201 en `gen3delem`: el primer espesor del nodo 1
del primer elemento U1 es cero. Separar temporalmente los nodos de fundación respecto de los muros
no cambia el fallo. Retirar las cuatro barras B31 permite terminar, lo que aísla la causa en la
coexistencia B31/U1 del deck, no en la conectividad.

Una copia temporal que conserva nodos, conectividad, geometría y las cuatro fundaciones, pero
representa estas últimas como U1 `SECTION=GENERAL`, alcanza `Job finished` y produce un FRD con
1.384 nodos, 8.304 desplazamientos finitos y máximo absoluto cero. La restricción homogénea de la
sonda deja deliberadamente cero grados de libertad y CCX emite ese warning esperado.

C1 exigía fundaciones B31/RECT, por lo que cambiar la familia y sus propiedades mecánicas sería
ampliar una decisión ya iniciada. La implementación provisional se retiró del repositorio antes de
emitir este corte sustituto.

## Decisión

El INP global no mezcla familias de barras cuando contiene perfiles Metalcon U1:

- si el deck contiene algún U1, sus fundaciones corridas también se emiten como U1 con
  `SECTION=GENERAL`;
- área e inercias se derivan del rectángulo real: `A = b·h`, `I11 = h·b³/12` e
  `I22 = b·h³/12`, usando el vector local vertical ya declarado;
- la constante torsional usa la aproximación rectangular explícita
  `J = h·b³·(1/3 − 0,21·(b/h)·(1 − b⁴/(12·h⁴)))`, intercambiando `b/h` para que `h ≥ b`;
- si no existe ningún U1, la fundación conserva B31/RECT;
- no se separan nodos, no se desplazan ejes, no se omiten elementos y no se renumeran IDs
  persistidos.

El runner trata la salida del solver como contrato. Para la sonda global acepta únicamente el
warning exacto de ausencia de grados de libertad causado por fijar homogéneamente todos los nodos;
cualquier otro `WARNING` o cualquier `ERROR` falla. Cercha y fundaciones no tienen warnings
permitidos.

Se mantienen las decisiones de C1 sobre nombres de set, parser común, aislamiento, limpieza,
hashes y separación entre INP fuente e INP ejecutado.

## Alcance

- Compactar de forma determinista los `ELSET` dinámicos del exportador global.
- Emitir cada fundación global por ID persistido y con la familia/sección gobernada arriba.
- Actualizar el golden INP global y sus pruebas contractuales.
- Implementar parser puro común de desplazamientos FRD/DAT y contrato INP.
- Implementar `npm run smoke:ccx` para global, cercha y fundaciones.
- Ejecutar cada job en directorio aislado, con argumentos directos y limpieza de resultados
  anteriores.
- Clasificar errores y warnings del solver según la lista permitida.
- Escribir `artifacts/<commit>/smoke-ccx.json` con toolchain, hashes, conteos, extremos y duración.
- Actualizar documentación, trazabilidad, riesgos y cierre.

## Fuera de alcance

- Agregar cargas, combinaciones o apoyos físicos al exportador global.
- Usar la sonda del arnés como resultado estructural de proyecto.
- Desconectar, desplazar u omitir fundaciones para acomodar al solver.
- Cambiar geometría o reglas R3–R8.
- Renumerar IDs persistidos para el smoke.
- Integrar CalculiX en Tauri, redistribuirlo o agregar timeout/cancelación nativos.
- Tocar componentes, store, umbrales de cobertura o E2E.
- Corregir el fallo TDZ de `resolveRoofPlane`.

## Criterios de aceptación

1. Todo `ELSET` global mide como máximo 20 caracteres y los grupos de los muros de referencia
   conservan completo su ID persistido.
2. Cada `*BEAM SECTION` referencia un `ELSET` declarado; las cuatro fundaciones de `casa-L`
   tienen conjunto propio y propiedades de su rectángulo real.
3. El global de referencia contiene sólo U1, conserva 1.384 nodos/1.046 elementos y mantiene
   conectividad, coordenadas e IDs persistidos; un global sin U1 conserva B31/RECT.
4. Global, cercha y fundaciones pasan golden semántico y ejecutan con CalculiX 2.23 real.
5. La sonda global sólo agrega nodos agrupados, restricciones, step y solicitud de salida; fuente
   y copia ejecutada tienen hashes diferenciados en el reporte.
6. El runner detecta ruta/versión, usa argumentos directos, directorios aislados y nunca acepta
   archivos de una corrida anterior.
7. El parser devuelve resultados finitos y no vacíos para los nodos/conjuntos esperados de los
   tres jobs; rechaza nodos faltantes, ajenos, `NaN` e `Infinity`.
8. Código cero o `Job finished` no ocultan errores ni warnings no permitidos; el warning global
   esperado queda contado y nombrado en el reporte.
9. El reporte registra tres jobs normales, hashes, conteos, extremos y duración; `npm run
   smoke:ccx` termina con código cero sólo si todos pasan.
10. La prueba crítica falla al restaurar un `ELSET` largo, retirar la sección de fundación o
    devolver la fundación global de referencia a B31.

## Evidencia

- Pruebas de `calculixCommon`, exportador global, parser y contrato del runner.
- Golden semántico INP actualizado explícitamente.
- Reporte `artifacts/<commit>/smoke-ccx.json`.
- Ejecución real `npm run smoke:ccx`.
- Reversión temporal de nombres, sección y familia con prueba enfocada.
- `npm run validate` y cierre `sessions/close-SPEC-003-C2.md`.
