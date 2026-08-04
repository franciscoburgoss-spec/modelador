# SPEC-014-A — Canonicalización geométrica y líneas de soporte

## Diagnóstico

`agnostic-geometry-v1.0` ya entrega una autoridad volumétrica auditada y consumible que contiene
muros como `oriented-prism`, vanos como vacíos resueltos y una grilla informativa. El consumidor
mínimo de `spec14Input.js` comprueba schema, unicidad básica, geometría finita y referencias
`hostWallId`, pero todavía no ejecuta ninguna fase topológica de SPEC-14.

El cuerpo normativo de SPEC-14 v0.3 formula parte de R0 sobre referencias editables del modelo
fuente (`xStart`, `bottomZ`, `referenceAxisId`). Esos campos no pertenecen al contrato agnóstico:
reintroducirlos duplicaría autoridades y acoplaría el sistema constructivo al modelo interno. En
la frontera publicada, dichas referencias ya fueron resueltas y auditadas antes de descargar.

El primer corte funcional debe conciliar ambos contratos y cubrir sólo R0–R2: validar la geometría
resuelta, canonicalizar muros y vanos independientemente del sentido de sus prismas, y crear
relaciones/cadenas por línea de soporte. Aún no debe clasificar encuentros, roles estructurales,
apoyos ni soluciones constructivas.

## Decisión

Crear un reconocedor puro de fase parcial que consuma literalmente `agnostic-geometry-v1.0`. R0
validará las autoridades presentes en esa frontera —IDs por dominio, `hostWallId`, prismas
ortogonales, dimensiones e intervalos verticales— y considerará las referencias editables como
precondiciones ya resueltas por el productor, sin reconstruirlas ni incorporarlas a la salida.

R1 inferirá `axis`, `fixed`, `s0`, `s1`, `z0`, `z1`, longitud y altura desde cada prisma orientado,
con orientación canónica positiva. Los vanos se expresarán en coordenadas globales y locales del
muro, preservando sus IDs y tipo. R2 agrupará líneas mediante tolerancia, clasificará relaciones
colineales y construirá cadenas sin fusionar entidades.

La salida parcial declarará `recognized-structural-topology-v1.0`, `SPEC-14-v0.3`, las fases
ejecutadas `[R0,R1,R2]`, listas estables, findings tipados y `canonicalSha256`. También declarará
explícitamente que R3–R12 están pendientes y que el resultado no habilita SPEC-08. El hash se
calculará sobre la salida canónica sin el propio hash.

## Ejecución Codex

- Esfuerzo planificado: `high`
- Escalamiento xhigh: `prohibido`
- Motivo: el corte concilia esquemas, define canonicalización geométrica tolerante y relaciones
  topológicas deterministas. `high` es el nivel aprobado para SPEC-14; el alcance R0–R2 evita usar
  `xhigh` y deja las fases de clasificación para sesiones posteriores.

## Alternativas descartadas

| Alternativa | Motivo |
|---|---|
| Volver a exportar `xStart`, `bottomZ` y demás referencias internas | Duplica autoridades y rompe el aislamiento del contrato agnóstico |
| Ejecutar el reconocedor sobre `modelVersion` 2 | Acopla cada sistema constructivo al store y vuelve inútil la frontera auditada |
| Reutilizar `wallJunctions.js` como salida SPEC-14 | Su contrato fue creado para Metalcon legacy y no implementa fases, findings ni schema de SPEC-14 |
| Implementar R0–R13 en una sesión | Mezcla canonicalización, intersecciones, intención, apoyos y segmentación sin cortes reversibles |
| Considerar el resultado R0–R2 apto para SPEC-08 | SPEC-14 prohíbe transformar antes de completar R12 sin errores |

## Alcance

- Endurecer el consumidor agnóstico sin mutar la entrada ni importar store, React, Three.js,
  `build3d.js` o módulos constructivos.
- Definir configuración exacta con defaults de SPEC-14 y rechazar valores no finitos, negativos o
  incompatibles.
- Validar IDs en sus dominios, host de vanos, prismas positivos, orientación horizontal ortogonal,
  altura vertical coherente y vanos contenidos.
- Inferir y canonicalizar muros X/Y aunque el prisma venga declarado en sentido inverso.
- Canonicalizar vanos con `s0/s1`, `localS0/localS1`, `z0/z1`, ancho, alto y host.
- Detectar superposición tridimensional de vanos según `MIN_OVERLAP`.
- Agrupar muros por línea de soporte mediante `TOL_LINEAR`, con clave estable redondeada sólo en la
  salida.
- Clasificar `COLLINEAR_OVERLAP`, `COLLINEAR_CONTIGUOUS` y `COLLINEAR_SEPARATED` cuando corresponda,
  sin anticipar R3.
- Construir cadenas deterministas de continuidad sin fusionar muros.
- Emitir findings del catálogo R0–R2 con severidad, IDs y evidencia geométrica reproducible.
- Canonicalizar listas y calcular SHA-256 idéntico ante permutaciones equivalentes de entrada.
- Probar modelos mínimos, prismas invertidos, vanos, colineales y `casa-L` proyectada.
- Generar una evidencia visual versionada y reproducible de R0–R2 para `casa-L`, sin usarla como
  sustituto de las pruebas numéricas.
- Actualizar gobernanza, manifiesto, riesgo, decisión, trazabilidad y cierre.

## Fuera de alcance

- Implementar R3–R13, intersecciones perpendiculares, bandas Z, nodos o segmentos.
- Resolver roles de ejes/muros, intención estructural, cruces MID–MID, fundaciones o techumbre.
- Ejecutar SPEC-08 o producir Metalcon, madera, SIP, albañilería, OSB, DXF o INP.
- Cambiar `agnostic-geometry-v1.0`, el exportador, el auditor o el archivo nativo v2.
- Reutilizar o modificar la topología legacy consumida por Metalcon.
- Resolver F-009, modelo v3, DP-14-07 o DP-14-08.
- Usar `xhigh` o `max`.

## Criterios de aceptación

1. Una entrada mínima literal produce schema/version/config, fases `[R0,R1,R2]`, un muro canónico,
   listas estables y un hash SHA-256 válido, sin mutar el objeto fuente.
2. Prismas X/Y declarados en ambos sentidos producen exactamente el mismo muro canónico; un prisma
   diagonal, vertical, nulo, con altura inválida o números no finitos falla con código/ruta/IDs.
3. Vanos se normalizan en coordenadas globales y locales; fuera del dominio longitudinal/vertical
   falla, dos vanos con solape 3D mayor a `minimumOverlap` emiten `RT-OPENING-OVERLAP` y vanos
   apilados que sólo comparten proyección longitudinal no lo emiten.
4. La configuración por defecto coincide exactamente con §5; overrides válidos se reflejan en la
   salida y valores inválidos se rechazan antes de crear un resultado parcial.
5. Muros dentro de `linearTolerance` comparten una línea con clave estable; continuidad,
   separación y solape se clasifican de acuerdo con R-LINE-02, y una cadena no fusiona IDs.
6. Reordenar grilla, elementos y vanos no altera la salida canónica ni `canonicalSha256`; dos
   ejecuciones repetidas son `deepEqual`.
7. `casa-L` proyectada conserva 45 muros y 43 vanos, tiene cero errores R0/R1, relaciones R2
   simétricas y una evidencia visual R0–R2 versionada con el mismo hash esperado.
8. La salida declara que R3–R12 están pendientes y `eligibleForSpec08=false`; ninguna fuente
   constructiva ni `wallJunctions.js` entra al grafo del reconocedor.
9. Una prueba de reversión demuestra que quitar la normalización de sentido o el orden estable
   cambia/falla la evidencia y que restaurarla devuelve la suite verde.
10. Pruebas enfocadas, cobertura, `npm run validate`, build, `make governance`, auditoría Codex y
    `git diff --check` pasan; el cierre confirma `high` planificado, enviado y efectivo.

## Evidencia

- Pruebas unitarias del contrato, configuración, errores tipados, canonicalización, vanos, líneas,
  relaciones, cadenas, determinismo y no mutación.
- Regresión sobre la proyección agnóstica de `casa-L`, más fixtures sintéticos mínimos.
- Artefacto visual versionado de R0–R2 con hash canónico identificable.
- Inspección estática contra store, React, Three.js, `build3d`, `wallJunctions` y vocabulario de
  soluciones constructivas.
- Prueba de reversión de sentido u orden canónico.
- `make governance`, `npm run validate`, `npm run codex:audit` y cierre
  `sessions/close-SPEC-014-A.md`.

## Corte sugerido

Detener cuando R0–R2 conviertan cualquier `agnostic-geometry-v1.0` compatible en una salida parcial
determinista y auditable, con evidencia real de `casa-L` y una prohibición explícita de ejecutar
SPEC-08 antes de implementar y auditar R3–R12.
