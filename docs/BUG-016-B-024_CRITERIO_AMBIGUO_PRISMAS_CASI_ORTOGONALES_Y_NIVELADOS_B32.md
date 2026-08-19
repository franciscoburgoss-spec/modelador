# BUG-016-B-024 — Criterio ambiguo para prismas casi ortogonales y casi nivelados en B3.2

## Estado

CERRADO — 19-ago-2026.

## Contexto

SPEC-016-B mantiene B3 abierto mediante D-072 y D-076 habilita el subcorte
de implementación B3.2 exclusivamente para Fase A READ-ONLY.

La frontera ratificada para este subcorte comprende:

- hosts y frame local;
- dominio geométrico;
- openings;
- tolerancias.

La geometría agnóstica efectiva permanece como autoridad física y B3 no puede
repararla, reinterpretarla ni sustituirla mediante heurísticas constructivas.

## Hallazgo

La sección técnica `B3.2 Hosts y frame local` establece que cada muro usa un
frame local canónico `(s,z)` y que:

- `s=0...L` recorre longitudinalmente el host;
- `z` conserva elevación;
- invertir el orden incidental de `start/end` no altera artifacts, IDs ni SHA;
- si el prisma no permite construir inequívocamente el frame requerido, B3
  falla cerrado.

La sección técnica `B3.4 Tolerancias` congela:

- `MATERIALIZATION_TOL_LINEAR_MM = 0.1`;
- `MATERIALIZATION_TOL_LEVEL_MM = 0.1`;
- `MATERIALIZATION_MIN_SEGMENT_MM = 0.1`;
- salida canónica a 3 decimales;
- comparación antes del redondeo;
- la tolerancia no modifica geometría autoritativa.

Sin embargo, el contrato no define qué ocurre cuando `effectiveGeometry`
contiene un prisma que sólo es aproximadamente ortogonal o aproximadamente
nivelado.

## Autoridad upstream comprobada

`agnostic-geometry-v1.0` constituye la autoridad geométrica publicada.

La documentación gobernada de SPEC-014-A reconoce entre las autoridades
presentes en dicha frontera:

- prismas ortogonales;
- dimensiones;
- intervalos verticales;
- `hostWallId`;
- IDs geométricos.

El productor agnóstico normal construye muros ortogonales X/Y y publica sus
prismas resueltos.

SPEC-14 posteriormente realiza una canonicalización topológica propia y posee
tolerancias propias, incluida una tolerancia angular. Esa política pertenece
al reconocedor topológico y no constituye automáticamente autoridad para B3.

La auditoría de SPEC-006-D utiliza una tolerancia absoluta de `0.001 mm` para
verificar fidelidad entre geometría fuente y geometría exportada. Esa
tolerancia tampoco define una política B3 para reclasificar o enderezar
prismas.

## Ambigüedad material

No está congelado si B3.2 debe aceptar o rechazar casos como:

1. host pretendidamente X con:
   - `start = (0, 0, 0)`;
   - `end = (4000, 0.05, 0)`;

2. host pretendidamente Y con una pequeña diferencia en X entre extremos;

3. host con:
   - `start.z = 0`;
   - `end.z = 0.05`;

4. prismas donde ambas coordenadas planas cambian pero existe un eje
   claramente dominante;

5. desviaciones menores, iguales o mayores que
   `MATERIALIZATION_TOL_LINEAR_MM`;

6. diferencias verticales menores, iguales o mayores que
   `MATERIALIZATION_TOL_LEVEL_MM`.

Para esos estados no está definido si B3 debe:

- rechazar el prisma;
- elegir el eje dominante;
- promediar la coordenada transversal;
- hacer snapping de coordenadas;
- considerar suficiente la tolerancia lineal;
- considerar suficiente la tolerancia de nivel;
- reutilizar una tolerancia angular de SPEC-14.

Esas alternativas producen frames distintos y pueden afectar geometría
derivada, artifacts, IDs y SHA.

## Diagnóstico

La ortogonalidad X/Y es una precondición geométrica upstream.

La ambigüedad de B3.2 no consiste en decidir si el sistema debe soportar muros
oblicuos, sino en determinar cómo debe revalidar defensivamente esa
precondición cuando la frontera `effectiveGeometry` consumida no vuelve a
garantizar internamente todas las invariantes del contrato agnóstico.

Usar silenciosamente `MATERIALIZATION_TOL_LINEAR_MM`,
`MATERIALIZATION_TOL_LEVEL_MM`, una tolerancia angular de SPEC-14 o una regla
de eje dominante introduciría semántica no congelada.

## Decisión requerida

Antes de implementar B3.2 debe congelarse explícitamente:

1. qué condición exacta identifica un prisma de host como X;
2. qué condición exacta identifica un prisma de host como Y;
3. si `start.z` y `end.z` deben ser exactamente iguales;
4. si las tolerancias de materialización pueden convertir un prisma
   geométricamente inválido en un host válido;
5. si está permitido promediar, proyectar, hacer snapping o escoger un eje
   dominante;
6. cómo se relaciona esta regla con la inversión incidental de `start/end`;
7. que la decisión se aplique antes del redondeo canónico;
8. la consecuencia fail-closed cuando el frame no resulte inequívoco.

## Resolución técnica propuesta para revisión humana

La propuesta para B3.2 es mantener estrictamente la autoridad upstream:

- B3 no endereza ni corrige geometría;
- un host WALL materializable debe definir exactamente una corrida X o Y;
- para X, las coordenadas Y de `start/end` deben ser iguales;
- para Y, las coordenadas X de `start/end` deben ser iguales;
- `start.z` y `end.z` deben ser iguales;
- la longitud longitudinal debe ser estrictamente positiva;
- invertir `start/end` es la única canonicalización geométrica autorizada del
  sentido del host;
- `MATERIALIZATION_TOL_LINEAR_MM` y
  `MATERIALIZATION_TOL_LEVEL_MM` no convierten una geometría inválida en
  válida;
- B3 no promedia, proyecta, hace snapping ni selecciona un eje dominante;
- cualquier incumplimiento falla cerrado antes del redondeo canónico.

Esta propuesta no queda aprobada por la mera apertura del BUG. Requiere
ratificación humana explícita durante la Fase A.

## Openings

Este BUG no congela todavía el criterio equivalente para `opening.void`.

La coherencia geométrica de los voids debe analizarse separadamente para
determinar qué reglas son heredadas de la autoridad agnóstica y cuáles
requieren una decisión propia de B3.2.

No se debe extender automáticamente a openings ninguna decisión adoptada para
hosts sin revisar antes su contrato específico.

## Resguardos

Mientras este BUG permanezca abierto:

- no implementar canonicalización de hosts B3.2;
- no introducir snapping de geometría;
- no promediar coordenadas de `start/end`;
- no seleccionar eje por componente dominante;
- no reutilizar silenciosamente `angularToleranceDeg` de SPEC-14;
- no interpretar las tolerancias B3.4 como permiso para corregir geometría;
- no modificar la geometría agnóstica autoritativa;
- no avanzar a B3.3 de implementación;
- no consumir Metalcon legacy;
- no modificar B4, B5 ni SPEC-016-C.

## Alcance

Este BUG se limita al criterio geométrico usado por B3.2 para construir un
frame local inequívoco desde el prisma efectivo de un host WALL.

No redefine:

- la geometría agnóstica;
- SPEC-14;
- el significado de `hostWallId`;
- la contención `Oi ⊆ M`;
- el criterio de solape 2D entre openings;
- la retícula maestra vertical;
- familias verticales u horizontales;
- panelCoverage;
- assignments;
- requirement responses;
- verificationState.

## Corpus adversario congelado

La revisión humana de D-078 congela el siguiente corpus mínimo para la futura
implementación autorizada de la elegibilidad de hosts B3.2.

| Caso | start | end | Resultado esperado |
|---|---|---|---|
| H-X-VALID | `(0,0,0)` | `(4000,0,0)` | válido X; frame canónico `s=0...4000` |
| H-X-REVERSED | `(4000,0,0)` | `(0,0,0)` | válido X; mismo frame que H-X-VALID |
| H-Y-VALID | `(200,100,450)` | `(200,3100,450)` | válido Y; frame canónico `s=0...3000`, `z=450` |
| H-Y-REVERSED | `(200,3100,450)` | `(200,100,450)` | válido Y; mismo frame que H-Y-VALID |
| H-X-TRANSVERSE-0.05 | `(0,0,0)` | `(4000,0.05,0)` | inválido; fail-closed |
| H-X-TRANSVERSE-0.1 | `(0,0,0)` | `(4000,0.1,0)` | inválido; fail-closed |
| H-X-TRANSVERSE-0.1001 | `(0,0,0)` | `(4000,0.1001,0)` | inválido; fail-closed |
| H-Y-TRANSVERSE-0.05 | `(200,100,0)` | `(200.05,3100,0)` | inválido; fail-closed |
| H-LEVEL-0.05 | `(0,0,0)` | `(4000,0,0.05)` | inválido; fail-closed |
| H-LEVEL-0.1 | `(0,0,0)` | `(4000,0,0.1)` | inválido; fail-closed |
| H-LEVEL-0.1001 | `(0,0,0)` | `(4000,0,0.1001)` | inválido; fail-closed |
| H-DIAGONAL | `(0,0,0)` | `(4000,100,0)` | inválido; fail-closed |
| H-ZERO-LENGTH | `(0,0,0)` | `(0,0,0)` | inválido; fail-closed |
| H-NONFINITE | `(0,0,0)` | `(NaN,0,0)` | inválido; fail-closed antes de canonicalizar |

Los casos `0.05`, `0.1` y `0.1001` demuestran expresamente que las tolerancias
B3.4 no son umbrales de elegibilidad: toda desviación transversal o vertical
positiva mantiene inválido el host.

La futura prueba de implementación deberá demostrar además que H-X-VALID y
H-X-REVERSED producen exactamente el mismo frame, y análogamente H-Y-VALID y
H-Y-REVERSED. Ningún caso permite snapping, averaging, proyección ni selección
por eje dominante.

Este corpus se limita a hosts WALL. No congela la validación de `opening.void`.

## Criterio de cierre

El BUG podrá cerrarse cuando:

1. exista decisión humana explícita sobre la semántica exacta;
2. SPEC-016-B documente inequívocamente la regla;
3. se distingan las tolerancias de materialización de cualquier reparación de
   geometría autoritativa;
4. el corpus adversario cubra prismas X/Y válidos, inversión de extremos,
   desviación transversal positiva y diferencia vertical positiva;
5. la implementación autorizada falle cerrado para los estados definidos como
   inválidos;
6. los gates correspondientes permanezcan verdes.

## Cierre verificado

CERRADO — 19-ago-2026.

La resolución semántica aprobada mediante D-078 quedó materializada y verificada
sin modificar la autoridad geométrica upstream ni introducir reparación
constructiva.

Evidencia de cierre:

- `buildMetalconWallFrameB32()` exige coordenadas finitas antes de canonicalizar;
- X exige igualdad exacta transversal y de nivel;
- Y exige igualdad exacta transversal y de nivel;
- la única canonicalización autorizada es la inversión incidental de
  `start/end`;
- prismas casi ortogonales, casi nivelados, diagonales, de longitud cero o no
  finitos fallan cerrado;
- no existe snapping, averaging, proyección, eje dominante ni uso de
  tolerancias B3.4 para convertir desigualdad en igualdad;
- el corpus ejecutable cubre X/Y válidos, inversión X/Y, desviaciones
  transversales `0.05`, `0.1` y `0.1001` mm, desniveles `0.05`, `0.1` y
  `0.1001` mm, diagonal, longitud cero y coordenada no finita;
- gate focal B3.2 posterior a completar la evidencia:
  `49/49 PASS`, `0 fail`;
- `git diff --check` permaneció limpio antes del gate.

El cierre no modifica D-078 ni amplía el alcance de B3.2. B3.3 de
implementación, B3.5 técnica, runtime/generatedArtifacts, B4, B5 y SPEC-016-C
permanecen fuera de alcance.
