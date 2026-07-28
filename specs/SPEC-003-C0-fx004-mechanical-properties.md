# SPEC-003-C0 — Precondición mecánica de FX-004

> Spec de sustitución acotada para la precondición descubierta al cerrar
> `SPEC-003-verification-harness.md`, corte B. Decisiones relacionadas: D-030 y D-031.

## Diagnóstico

El golden INP de `SPEC-003-B` confirmó 16 tokens `NaN` en la cercha de FX-004. La geometría y las
referencias del faldón son resolubles, pero las entradas de proyecto `90CA085`, `40CA085` y
`60CA085` sólo contienen dimensiones geométricas. `findTrussProfile` da precedencia correcta a la
biblioteca persistida sobre el catálogo estático; por ello, esas entradas incompletas sombrean las
propiedades `areaCm2`, `ixCm4` e `iyCm4` que el exportador necesita.

El problema pertenece al fixture sintético creado en SPEC-003-A, no demuestra que sea correcto
mezclar silenciosamente una entrada persistida con otra fuente. SPEC-003-C no puede comenzar su
smoke de tres jobs mientras su entrada de referencia produzca valores no finitos.

## Decisión

FX-004 conserva su biblioteca persistida como autoridad. Las tres entradas realmente usadas por
los miembros de la cercha incorporan `areaCm2`, `ixCm4` e `iyCm4` copiadas literalmente del
catálogo canónico `METALCON_PROFILES`, manteniendo su `code` e identidad.

No se cambia `findTrussProfile`, no se agrega un fallback campo a campo y no se completan perfiles
que el solver de cerchas no consume. La corrección del fixture se registra mediante un nuevo
checksum en el manifiesto y una actualización explícita de sus goldens semánticos.

## Alcance

- Completar en FX-004 las propiedades mecánicas de `90CA085`, `40CA085` y `60CA085`.
- Verificar automáticamente que coinciden con el catálogo canónico y son finitas/positivas.
- Actualizar explícitamente checksum y goldens afectados.
- Confirmar que el INP de cerchas ya no contiene `NaN` ni `Infinity`.
- Ejecutar un smoke real de la cercha corregida con CalculiX antes del cierre.
- Actualizar estado, riesgo, decisión y cierre de sesión.

## Fuera de alcance

- Implementar todavía el arnés común `smoke:ccx` y su parser de tres jobs.
- Corregir nombres `ELSET` del INP global.
- Cambiar el contrato de resolución de perfiles o completar datos en tiempo de exportación.
- Modificar geometría, cargas, reglas R3–R8, Tauri, componentes o cobertura.
- Corregir el fallo TDZ de `resolveRoofPlane`.

## Criterios de aceptación

1. Los perfiles de miembros de la cercha FX-004 contienen `areaCm2`, `ixCm4` e `iyCm4` finitas,
   positivas e idénticas a las del catálogo canónico para el mismo `code`.
2. El checksum de FX-004 cambia de forma explícita y el manifiesto completo vuelve a pasar.
3. El golden semántico del INP de cerchas declara cero tokens no finitos y los 18 artefactos
   permanecen deterministas.
4. La cercha generada ejecuta con CalculiX real, termina normalmente y produce resultados.
5. Al retirar una propiedad mecánica del fixture, la prueba enfocada falla.

## Evidencia

- `tests/fixtureManifest.test.mjs` para correspondencia exacta con catálogo y checksum.
- `tests/artifactGoldens.test.mjs` para cero tokens no finitos.
- `npm run verify:goldens` para actualización explícita y determinismo.
- Ejecución directa de CalculiX 2.23 sobre el INP generado desde FX-004.
- Reversión temporal de una propiedad y ejecución de la prueba enfocada.
- `npm run validate` y cierre `sessions/close-SPEC-003-C0.md`.
