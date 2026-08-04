# SPEC-014-B — Apilamientos, intersecciones y nodos topológicos

## Diagnóstico

`SPEC-014-A` cerró R0–R2 de SPEC-14 sobre `agnostic-geometry-v1.0`: canonicaliza 45 muros y
43 vanos de `casa-L`, agrupa líneas de soporte y produce relaciones/cadenas deterministas sin
importar el store ni soluciones constructivas. La salida todavía deja vacía `nodes[]` y declara
R3–R12 pendientes.

Las siguientes fases R3–R5 dependen únicamente de la geometría ya resuelta. R3 debe distinguir
contacto vertical exacto/parcial, superposición y separación entre muros de una misma línea; R4
debe reconocer encuentros perpendiculares con cobertura y bandas Z explícitas; R5 debe convertir
extremos, vanos, encuentros y cambios de apilamiento en nodos ordenados sin perder roles al
unificarlos.

La aplicación ya contiene roles `MP1`, `MP2`, `MP3` y `tabique`, pero pertenecen a tipos
constructivos y están excluidos correctamente del JSON agnóstico. Usarlos en este corte inferiría
intención estructural desde Metalcon. R6–R7 deberán consumir en una spec posterior un contrato
agnóstico `structuralIntent`; hasta entonces los cruces `CROSS_MID_MID` permanecen ambiguos y
bloquean SPEC-08.

## Decisión

Extender el reconocedor puro existente con R3–R5, conservando las relaciones R2 y agregando
relaciones tipadas y bidireccionalmente consultables. R3 sólo comparará pares de una misma línea
con solape longitudinal positivo. R4 comparará pares X/Y cuyo punto teórico pertenezca a ambos
dominios y cuyo solape Z supere `minimumOverlap`; toda relación conservará métricas de cobertura,
tipo de contacto y bandas verticales, incluso cuando la proyección en planta sea idéntica.

R5 generará eventos por muro para extremos, bordes de vano, ejes de intersección y límites de
apilamiento. Los eventos dentro de `linearTolerance` se unificarán conservando todos los roles e
IDs fuente. Como R6 aún no se ejecuta, un encuentro usará el rol neutro `wallIntersection`; no se
etiquetará falsamente como estructural ni como tabique. La prioridad parcial será
`wallEnd > openingEdge > wallIntersection > stackBoundary > auxiliary`; R6 podrá enriquecerla sin
reconstruir la geometría.

La salida ejecutará `[R0,R1,R2,R3,R4,R5]`, mantendrá R6–R12 pendientes, recalculará el hash
canónico y conservará `eligibleForSpec08=false`. Un `CROSS_MID_MID` sin intención emitirá
`RT-CROSS-STRUCTURAL-INTENT-REQUIRED` con severidad `blocking`, pero esta spec no añadirá ni
consumirá decisiones estructurales.

## Ejecución Codex

- Esfuerzo planificado: `high`
- Escalamiento xhigh: `prohibido`
- Motivo: R3–R5 amplían el grafo topológico con relaciones 3D, bandas verticales, unificación de
  nodos y determinismo. El corte evita R6–R12 y no justifica superar el techo ordinario `high`.

## Alternativas descartadas

| Alternativa | Motivo |
|---|---|
| Derivar intención desde `wallType.role` | `MP1/MP2/MP3/tabique` es vocabulario constructivo y rompería la frontera agnóstica |
| Incorporar `structuralIntent` dentro del JSON geométrico | Mezcla autoridades; se definirá como contrato de entrada independiente antes de R6–R7 |
| Tratar todo cruce MID–MID como conectado | Inventa continuidad física y contradice R-INT-04 |
| Reducir encuentros a puntos 2D | Pierde cobertura parcial y puede propagar efectos fuera de la banda común |
| Reutilizar `wallJunctions.js` | Su topología está orientada al solver Metalcon legacy y no conserva bandas Z ni fases SPEC-14 |
| Implementar R3–R12 de una vez | Mezcla geometría, intención, apoyos, techumbre y segmentación sin una frontera reversible |

## Alcance

- Detectar `STACKED_EXACT`, `STACKED_PARTIAL`, `STACKED_OVERLAP` y `STACKED_GAP` entre muros de
  la misma línea soporte con solape S positivo.
- Ordenar inferior/superior de forma determinista y registrar `overlapS`, `gapZ`, intervalo común
  y tolerancias relevantes.
- Emitir `RT-WALL-VOLUME-OVERLAP` para superposición S/Z y `RT-VERTICAL-LOAD-PATH-GAP` para
  separación vertical candidata, sin afirmar transferencia de cargas.
- Detectar encuentros X/Y dentro de ambos dominios y con solape Z estricto.
- Clasificar `CORNER_END_END`, `T_END_MID`, `T_MID_END` y `CROSS_MID_MID` con orden geométrico
  estable: A horizontal/X y B vertical/Y.
- Registrar `zOverlap`, `overlapZ`, `coverageA/B`, `verticalContactType`, `visibleInFlow` y bandas
  `intersectionActive`, `wallAOnly` y `wallBOnly` sin intervalos nulos.
- Emitir `RT-INTERSECTION-PARTIAL-Z` como warning cuando el contacto no sea `FULL_BOTH`.
- Emitir un finding blocking por cada `CROSS_MID_MID` sin intención, sin resolverlo ni ocultarlo.
- Crear y unificar nodos por muro para extremos, vano, intersección y apilamiento, preservando
  roles secundarios, IDs de relaciones/vanos y cobertura Z.
- Ordenar nodos por `wallId, localS, z0, nodeType, stableId`, con coordenadas globales y locales
  reproducibles y referencias consultables desde cada muro.
- Actualizar relaciones, muros, nodos, findings, hash y evidencia visual de `casa-L` sin mutar la
  entrada ni modificar el contrato geométrico.
- Probar casos sintéticos mínimos, permutaciones y el fixture real `casa-L`.

## Fuera de alcance

- Implementar R6–R12, roles de ejes/muros, apoyos, techumbre, bordes o segmentos.
- Diseñar o persistir todavía `structural-intent-v1.0`.
- Traducir automáticamente `MP1`, `MP2`, `MP3` o `tabique` a intención estructural.
- Resolver cruces MID–MID o cerrar sus findings mediante overrides.
- Evaluar conflictos encuentro–vano de §18; este corte crea ambos eventos, pero la evaluación 3D
  y sus envolventes se implementarán con las fases posteriores previstas por SPEC-14.
- Modificar UI, store, archivo nativo v2/v3, exportador agnóstico, DXF, INP o soluciones Metalcon,
  madera, SIP o albañilería.
- Ejecutar SPEC-08, resolver F-009 o usar `xhigh`/`max`.

## Criterios de aceptación

1. Un apilamiento exacto, uno parcial, uno con superposición y uno con gap producen una relación
   única del tipo esperado, métricas deterministas, consulta desde ambos muros y los dos findings
   reglados sólo donde corresponden.
2. Un apilamiento parcial crea límites de intervalo común en ambos muros sin fusionar IDs; pares
   sin solape S positivo no crean relación R3.
3. Esquina, ambas orientaciones de T y cruce MID–MID se clasifican con A=X/B=Y aunque se permute la
   entrada; OUTSIDE y solape Z igual o menor a `minimumOverlap` no producen intersección.
4. Un contacto `FULL_BOTH` no emite warning; las otras tres combinaciones de cobertura producen el
   `verticalContactType`, bandas Z y `RT-INTERSECTION-PARTIAL-Z` exactos.
5. Todo `CROSS_MID_MID` queda `ambiguous`, emite un finding `blocking` y mantiene
   `eligibleForSpec08=false`; ningún dato Metalcon ni rol constructivo participa en el resultado.
6. R5 crea extremos y bordes de vanos, añade intersecciones/apilamientos, unifica posiciones dentro
   de tolerancia y conserva roles e IDs fuente; los nodos por muro quedan estrictamente ordenados.
7. Toda relación R2–R4 es única y consultable desde ambos muros; cada referencia de nodos, muros y
   relaciones es resoluble.
8. Permutar muros, vanos, ejes y niveles o repetir la ejecución conserva `deepEqual` y el mismo
   SHA-256; el objeto fuente permanece idéntico.
9. `casa-L` conserva 45 muros/43 vanos, produce conteos R3–R5 y hash fijados por regresión, y la
   evidencia SVG versionada muestra al menos un encuentro, su cobertura Z y los nodos del muro
   `1784670218571` sin presentarse como plano de ejecución.
10. La salida declara fases `[R0..R5]`, R6–R12 pendientes y `eligibleForSpec08=false`; el grafo
    productivo sigue limitado a módulos agnósticos puros.
11. Una prueba de reversión elimina la condición de solape Z o la unificación por tolerancia,
    provoca al menos un fallo focalizado y vuelve a verde al restaurarla.
12. Pruebas enfocadas, cobertura, `npm run validate`, build, `make governance`, auditoría Codex y
    `git diff --check` pasan; el cierre confirma `high` planificado, enviado y efectivo.

## Evidencia

- Pruebas unitarias R3–R5 con apilamientos, estados START/END/MID/OUTSIDE, las cuatro coberturas Z,
  bandas, nodos, unificación, simetría, determinismo y no mutación.
- Regresión de `casa-L` proyectada y fixture sintético adversario sin datos constructivos.
- SVG y manifiesto R0–R5 reproducibles, con hash, conteos, cobertura vertical y referencia R-VIS-05.
- Inspección estática del grafo contra store, React, Three.js, `wallJunctions`, Metalcon y roles
  `MP1/MP2/MP3/tabique`.
- Prueba de reversión documentada.
- `npm run validate`, `make governance`, `npm run codex:audit`, `git diff --check` y cierre
  `sessions/close-SPEC-014-B.md`.

## Corte sugerido

Detener cuando R3–R5 estén representadas de forma determinista y tridimensional, con nodos
consultables y cruces ambiguos visibles. No iniciar R6 hasta definir en otra spec el contrato
agnóstico de intención estructural y su relación explícita con la UI.
