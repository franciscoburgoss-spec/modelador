# BUG-016-B-042 — B3.5 no define asignación determinista de roles verticales

## Estado

CERRADO — 19-ago-2026.

## Contexto

SPEC-016-B B3.3 se encuentra en fase IMPLEMENTATION exclusivamente sobre la
sección técnica B3.5.

El CUT-1 ya implementó y validó como geometría pura:

- Pgrid determinista;
- canonicalización grid/borde conforme D-088 y D-092;
- distinción frontera/interior de openings conforme D-089;
- sustracción vertical;
- descarte de microsegmentos conforme D-090;
- canonicalización de salida posterior a las decisiones geométricas.

El CUT-1 no asigna roles, perfiles, materiales, sourceRefs ni artifacts.

## Hallazgo

B3.5 declara que los segmentos verticales resultantes permiten, mediante un
único algoritmo:

- `stud`;
- `wallEnd`;
- `jamb`;
- studs inferiores, superiores o intermedios recortados por openings.

Sin embargo, B3.5 no congela explícitamente la regla determinista que establece:

- cuándo una causa de retícula produce rol `stud`;
- cuándo un extremo `0/L` produce rol `wallEnd`;
- cuándo un borde de opening produce rol `jamb`;
- qué ocurre cuando varias de esas causas coinciden en una misma geometría;
- si la multiplicidad de causas debe preservarse como candidatos separados
  hasta B3.6 o colapsarse antes.

B3.6 sí especifica que candidatos con igual geometría lógica, perfil y material
se deduplican y que sus roles y sourceRefs se unen canónicamente. Incluso entrega
como ejemplo:

`roles=["jamb","stud","wallEnd"]`.

Pero B3.6 está fuera del scope de implementación B3.3 autorizado por D-093.

## Riesgo

Implementar CUT-2 sin una decisión contractual adicional obligaría a inferir
semántica no congelada.

En particular, usar el comportamiento del generador Metalcon legacy como
autoridad introduciría conceptos y reglas (`king`, `jack`, `cripple`, etc.) que
SPEC-016-B deliberadamente no ha adoptado.

## Impacto sobre CUT-1

No se identifica contradicción con el núcleo geométrico CUT-1.

`buildMetalconVerticalSegmentsB33()` puede permanecer como helper geométrico
puro.

Sin embargo, una capa posterior de candidatos con roles deberá conservar o
reconstruir de forma determinista la causa de cada posición:

- grid;
- extremo de host;
- borde de opening.

La unión/deduplicación efectiva de candidatos continúa reservada a B3.6.

## Regla de gobernanza

No modificar tests, validaciones ni implementación para inventar la semántica
faltante.

Se requiere decisión humana explícita antes de implementar CUT-2.

## Scope

Este BUG pertenece exclusivamente a SPEC-016-B B3.3 / B3.5.

No habilita:

- B3.6;
- miembros horizontales;
- panelCoverage;
- runtime/generatedArtifacts;
- B4;
- B5;
- SPEC-016-C.

## Resolución humana

La revisión humana aprobó D-094 y D-095 el 19-ago-2026.

D-094 congela que SPEC-016-B es una implementación nueva e independiente del
generador Metalcon legacy. El legacy no constituye dependencia, fallback,
fuente de defaults ni autoridad semántica del nuevo adaptador.

D-095 congela las causas verticales propias de B3.5:

- `Pgrid` → `stud`;
- `s=0/L` → `wallEnd`;
- borde autoritativo de opening → `jamb`;
- un `stud` recortado conserva rol `stud`;
- causas coincidentes permanecen como candidatos separados durante B3.5;
- deduplicación y unión de roles/sourceRefs permanecen reservadas a B3.6.

D-088 y D-092 pueden modificar la coordenada efectiva de una causa grid dentro
de su regla contractual, pero no borran su provenance ni transforman su rol.

## Evidencia anti-legacy

La auditoría previa a D-094 recorrió transitivamente seis roots productivos de
SPEC-016-B y alcanzó 13 módulos.

Resultado:

- ningún root alcanzó módulos legacy prohibidos;
- no apareció vocabulario ni shape legacy en el cierre transitivo;
- CUT-1 no contiene imports hacia generadores legacy conocidos;
- CUT-1 no contiene vocabulario/shape Metalcon histórico auditado;
- `git diff --check` permaneció limpio.

## Cierre verificado

CERRADO — 19-ago-2026.

BUG-042 queda resuelto contractualmente mediante D-094 y D-095.

El cierre:

- no modifica CUT-1;
- no cambia tests;
- no habilita B3.6;
- no habilita miembros horizontales;
- no habilita `panelCoverage`;
- no habilita runtime/generatedArtifacts;
- no habilita B4, B5 ni SPEC-016-C.
