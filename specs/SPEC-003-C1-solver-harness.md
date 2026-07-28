# SPEC-003-C1 — Arnés solver y completitud del INP global

> Sustituye el corte C de `SPEC-003-verification-harness.md` después de su diagnóstico real.
> Precondición mecánica cerrada en `SPEC-003-C0-fx004-mechanical-properties.md`.
> Decisiones relacionadas: D-011, D-030, D-031 y D-032.

## Diagnóstico

La primera ejecución de los tres INP de referencia confirmó que cercha y fundaciones terminan con
CalculiX 2.23, pero el global no cumple el contrato:

- 125 de sus 133 referencias `*BEAM SECTION, ELSET=...` exceden los 20 caracteres útiles que
  CalculiX conserva;
- CalculiX devuelve código 0 y escribe `Job finished` aun mientras emite múltiples
  `*ERROR reading *BEAM SECTION`, por lo que esos dos indicadores no bastan;
- al compactar temporalmente los nombres para continuar el diagnóstico, el solver alcanza
  `gen3delem` y falla porque el `ELSET=FUNDACIONES` contiene barras B31 sin ninguna
  `*BEAM SECTION`;
- el exportador global es deliberadamente geométrico, sin cargas, condiciones de borde ni
  `*STEP`; por tanto, no puede producir resultados no vacíos sin una sonda explícita del arnés.

El defecto de sección de fundaciones no estaba contemplado en el permiso original, limitado a la
corrección de nombres `ELSET`. Ocultarlo retirando elementos o aceptando sólo el código de salida
produciría evidencia falsa.

## Decisión

El INP global queda completo en todas las entidades que sí declara:

- cada grupo de muro usa un nombre `ELSET` de máximo 20 caracteres, con prefijo corto por rol y un
  token determinista derivado del ID persistido; los IDs actuales caben completos y no se
  renumeran;
- cada fundación corrida usa un `ELSET` propio derivado de su ID persistido y recibe su sección
  rectangular real, sin compartir silenciosamente las dimensiones de otra fundación;
- toda referencia de sección debe resolver un `ELSET` declarado.

Como el producto global sigue siendo un modelo geométrico para completar fuera de la aplicación,
el smoke no le inventa cargas de proyecto. El arnés conserva byte a byte el INP fuente, crea una
copia ejecutada que sólo agrega un `NSET` con sus nodos, restricciones homogéneas, un `*STEP`
estático sin carga y solicitud de desplazamientos. El reporte distingue y hashea ambas versiones.

La finalización exige simultáneamente código cero, `Job finished`, ausencia de errores en
stdout/stderr y resultados finitos/no vacíos referenciados al conjunto esperado.

## Alcance

- Compactar de forma determinista los `ELSET` de muro del exportador global.
- Emitir las fundaciones globales por ID persistido con sección B31 completa.
- Actualizar el golden INP global y sus pruebas contractuales.
- Implementar parser puro común de desplazamientos FRD/DAT y contrato INP.
- Implementar `npm run smoke:ccx` para global, cercha y fundaciones.
- Ejecutar cada job en directorio aislado, con argumentos directos y limpieza de resultados
  anteriores.
- Escribir `artifacts/<commit>/smoke-ccx.json` con toolchain, hashes, conteos, extremos y duración.
- Actualizar documentación, trazabilidad, riesgos y cierre.

## Fuera de alcance

- Agregar cargas, combinaciones o apoyos físicos al exportador global.
- Usar la sonda del arnés como resultado estructural de proyecto.
- Cambiar geometría o reglas R3–R8.
- Renumerar IDs persistidos para el smoke.
- Integrar CalculiX en Tauri, redistribuirlo o agregar timeout/cancelación nativos.
- Tocar componentes, store, umbrales de cobertura o E2E.
- Corregir el fallo TDZ de `resolveRoofPlane`.

## Criterios de aceptación

1. Todo `ELSET` global mide como máximo 20 caracteres y los grupos de los muros de referencia
   conservan completo su ID persistido.
2. Cada `*BEAM SECTION` referencia un `ELSET` declarado; las cuatro fundaciones de `casa-L`
   tienen conjunto propio y sección rectangular con sus dimensiones resueltas.
3. Global, cercha y fundaciones conservan sus IDs contractuales, pasan golden semántico y
   ejecutan con CalculiX 2.23 real.
4. La sonda global sólo agrega nodos agrupados, restricciones, step y solicitud de salida; fuente
   y copia ejecutada tienen hashes diferenciados en el reporte.
5. El runner detecta ruta/versión, usa argumentos directos, directorios aislados y nunca acepta
   archivos de una corrida anterior.
6. El parser devuelve resultados finitos y no vacíos para los nodos/conjuntos esperados de los
   tres jobs; rechaza nodos faltantes, ajenos, `NaN` e `Infinity`.
7. Código cero o `Job finished` no ocultan una línea de error del solver.
8. El reporte registra tres jobs normales, hashes, conteos, extremos y duración; `npm run
   smoke:ccx` termina con código cero sólo si todos pasan.
9. La prueba crítica falla al restaurar un `ELSET` largo o retirar la sección de fundación.

## Evidencia

- Pruebas de `calculixCommon`, exportador global, parser y contrato del runner.
- Golden semántico INP actualizado explícitamente.
- Reporte `artifacts/<commit>/smoke-ccx.json`.
- Ejecución real `npm run smoke:ccx`.
- Reversión temporal de nombres/sección con prueba enfocada.
- `npm run validate` y cierre `sessions/close-SPEC-003-C1.md`.
