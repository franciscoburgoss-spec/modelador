# BUG-016-B-027 — opening.void auditado más amplio que dominio materializable B3.2

## Estado

CERRADO — 19-ago-2026.

Resolución semántica aprobada por revisión humana el 18-ago-2026.

## Hallazgo

Durante la Fase A de SPEC-016-B B3.2 se confirmó que `effectiveGeometry`
conserva mediante allowlist las coordenadas y dimensiones de cada
`opening.void`, pero no revalida ni recanonicaliza sus invariantes geométricos.

El productor agnóstico reconstruye cada vano con:

- `hostWallId` igual al muro;
- `kind` derivado del tipo door/window;
- `void.kind = oriented-prism`;
- misma dirección longitudinal que el host;
- misma coordenada transversal que el host;
- `start.z === end.z`;
- `void.thickness === host.prism.thickness`;
- altura y longitud positivas derivadas del vano.

Sin embargo, la auditoría agnóstica compara estas propiedades con su tolerancia
numérica general. Por tanto, un `opening.void` observado puede auditar `pass`
aunque presente una desviación geométrica pequeña respecto de esas propiedades.

B3.3 ya exige contención exacta D-080 y solape exacto D-079, pero no definía
todavía qué invariantes debe satisfacer el `opening.void` antes de proyectarlo
al rectángulo local `Oi`.

## Resolución aprobada

B3.2 consume deliberadamente un subdominio defensivo exacto de
`opening.void`.

Para ser materializable, cada opening debe satisfacer antes del redondeo:

- `opening.hostWallId === host.id`;
- `opening.kind` pertenece a `{door, window}`;
- `opening.void.kind === oriented-prism`;
- todas las coordenadas de `start/end`, `thickness` y `height` son finitas;
- `height > 0`;
- `thickness > 0`;
- la longitud longitudinal del void es estrictamente positiva;
- el void corre exactamente sobre el mismo eje del host;
- su coordenada transversal coincide exactamente con la del host;
- `start.z === end.z`;
- `void.thickness === host.prism.thickness`.

La única canonicalización longitudinal permitida es la inversión incidental de
extremos:

- `sMin = min(sStart, sEnd)`;
- `sMax = max(sStart, sEnd)`.

Esta operación no modifica ninguna coordenada.

A partir de la geometría exacta se construye:

`Oi = [sMin,sMax] × [zMin,zMax]`

con:

- `zMin = start.z`;
- `zMax = start.z + void.height`.

Después se aplican D-080 y D-079 sin tolerancia geométrica.

## Consecuencias

- un `opening.void` auditado upstream no necesariamente es materializable B3.2;
- B3.2 no proyecta el void al plano del host;
- B3.2 no promedia coordenadas;
- B3.2 no hace snapping;
- B3.2 no corrige espesor;
- B3.2 no importa `DEFAULT_AGNOSTIC_GEOMETRY_TOLERANCE_MM`;
- las tolerancias B3.4 no convierten desigualdad en igualdad;
- D-079 y D-080 permanecen sin cambios;
- la geometría upstream no se declara inválida por ser rechazada por este adaptador.

En consecuencia:

`opening.void materializable por B3.2 ⊂ opening.void que puede auditar pass upstream`

## Corpus mínimo requerido

La evidencia posterior debe cubrir al menos:

1. void X exacto compatible con host X;
2. void Y exacto compatible con host Y;
3. inversión incidental de start/end produce el mismo `Oi`;
4. `hostWallId` incorrecto falla cerrado;
5. `kind` inválido falla cerrado;
6. `void.kind` distinto de `oriented-prism` falla cerrado;
7. coordenada no finita falla cerrado;
8. longitud longitudinal geométrica cero falla cerrado; la inversión incidental de `start/end` no constituye longitud negativa y produce el mismo `Oi`;
9. altura no positiva falla cerrado;
10. espesor no positivo falla cerrado;
11. desviación transversal estrictamente positiva falla cerrado;
12. `start.z !== end.z` falla cerrado;
13. espesor distinto del host falla cerrado;
14. D-080 se aplica después de construir `Oi`;
15. D-079 se aplica entre los `Oi` válidos del mismo host.

## Alcance

Esta correctiva pertenece exclusivamente a:

- SPEC-016-B;
- implementation subcut B3.2;
- secciones técnicas B3.2/B3.3/B3.4.

No autoriza B3.5, B3.3 de implementación, B4, B5, SPEC-016-C, DXF,
Metalcon legacy ni cambios al productor/auditor agnóstico.

## Criterio de cierre

BUG-016-B-027 permanece abierto hasta contar con:

1. decisión de gobernanza que materialice esta resolución;
2. contrato B3.3/B3.4 consistente;
3. corpus verificable del subdominio `opening.void`;
4. evidencia posterior de implementación fail-closed;
5. gates autorizados en verde.

## Cierre verificado

CERRADO — 19-ago-2026.

La resolución semántica aprobada mediante D-082 quedó materializada y
verificada. D-086 resolvió únicamente la ambigüedad documental del término
“longitud negativa”, manteniendo D-082 intacta.

Evidencia de cierre:

- `opening.hostWallId` debe coincidir exactamente con el host;
- `opening.kind` se limita a `door` o `window`;
- `opening.void.kind` debe ser `oriented-prism`;
- coordenadas, `height` y `thickness` deben ser finitos;
- `height` y `thickness` deben ser estrictamente positivos;
- longitud longitudinal geométrica cero falla cerrado;
- invertir incidentalmente `start/end` conserva el mismo `Oi`;
- el void debe coincidir exactamente con el eje y coordenada transversal del
  host;
- `start.z === end.z`;
- `void.thickness === host.prism.thickness`;
- `Oi` se construye directamente mediante mínimos/máximos longitudinales sin
  modificar coordenadas;
- D-080 se aplica después de construir `Oi`;
- D-079 se aplica entre `Oi` válidos del mismo host;
- no existe proyección, averaging, snapping, corrección de espesor ni uso de
  tolerancias B3.4 para convertir desigualdad en igualdad.

El corpus ejecutable cubre:

- void X exacto;
- void Y exacto;
- inversión incidental de extremos;
- `hostWallId` incorrecto;
- `kind` inválido;
- `void.kind` inválido;
- coordenada no finita;
- longitud longitudinal cero;
- `height === 0` y `height < 0`;
- `thickness === 0` y `thickness < 0`;
- desviación transversal positiva;
- diferencia entre `start.z` y `end.z`;
- espesor distinto del host;
- contención exacta D-080;
- solape exacto D-079.

Gate focal B3.2 posterior a completar el corpus:

`54/54 PASS`, `0 fail`.

El cierre no modifica D-082 ni D-086 y no amplía el alcance de B3.2.
B3.3 de implementación, B3.5 técnica, runtime/generatedArtifacts, B4, B5,
SPEC-016-C, DXF, Metalcon legacy y Git write permanecen fuera de alcance.
