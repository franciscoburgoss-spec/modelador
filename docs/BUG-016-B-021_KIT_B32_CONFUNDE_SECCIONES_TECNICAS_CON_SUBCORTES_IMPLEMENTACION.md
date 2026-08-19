# BUG-016-B-021 — Kit B3.2 confunde secciones técnicas con subcortes de implementación

## Estado

CERRADO — 18-ago-2026.

## Contexto

SPEC-016-B mantiene B3 abierto mediante D-072 y D-076 habilita B3.2
exclusivamente para Fase A READ-ONLY.

Durante la continuidad de B3.2 se detectó una discrepancia entre el kit de
handoff usado para abrir la sesión y las autoridades gobernadas vigentes del
repositorio.

El kit de continuidad interpretó los encabezados técnicos:

- `#### B3.2 Hosts y frame local`;
- `#### B3.3 Dominio geométrico y openings`;

como si correspondieran a subcortes de implementación separados, y estableció
como resguardo que B3.2 no debía adelantar dominio geométrico ni openings.

La inspección READ-ONLY posterior demuestra que esa interpretación no coincide
con la partición de implementación gobernada de B3.

## Hallazgo

Las autoridades vigentes distinguen dos numeraciones conceptualmente
diferentes.

### Secciones técnicas del contrato B3

La SPEC contiene, entre otras:

- `B3.2 Hosts y frame local`;
- `B3.3 Dominio geométrico y openings`;
- las secciones técnicas posteriores de tolerancias, familias, provenance,
  identidad y barreras.

Estas secciones estructuran el contenido técnico del contrato B3.

### Subcortes de implementación

La partición de implementación registrada durante la apertura B3 y conservada
por D-072/D-073 establece:

- B3.1a — contrato/resolver de familias;
- B3.1b — catálogo productivo real inicial;
- B3.2 — frame, openings y tolerancias;
- B3.3 — familia vertical;
- B3.4 — familia horizontal;
- B3.5 — `panelCoverage`;
- B3.6 — integración runtime y `generatedArtifacts`;
- B3.7 — determinismo, D-070 dinámico, FX-008, receipt/freshness y regresión.

`SPEC-016-B / B3.14 Subcortes` conserva igualmente que B3.2 comprende:

`frame local, openings, tolerancias y dominio geométrico`.

D-072 autoriza B3 globalmente por subcortes controlados y define dentro del
contrato B3 host-local, frame `(s,z)`, openings efectivos, recortes,
tolerancias, provenance e identidad determinista.

D-073 subdivide exclusivamente B3.1 en B3.1a/B3.1b y no redefine la frontera
posterior de B3.2.

D-076 cierra B3.1b y libera B3.2 exclusivamente para Fase A READ-ONLY; tampoco
redefine su contenido.

## Diagnóstico

El defecto no está en D-072, D-073 ni D-076.

El kit de continuidad confundió la numeración de las secciones técnicas del
contrato con la numeración de los subcortes de implementación.

Como consecuencia, el kit restringió B3.2 a hosts/frame y desplazó
incorrectamente dominio geométrico/openings hacia un supuesto subcorte B3.3,
cuando la partición de implementación gobernada reserva B3.3 para la familia
vertical.

Esta discrepancia es material porque altera el alcance que podría analizarse,
aprobarse e implementar bajo el nombre `B3.2`.

## Decisión requerida

Antes de continuar la Fase A B3.2 debe ratificarse explícitamente la frontera
gobernada:

**B3.2 de implementación comprende hosts/frame local, dominio geométrico,
openings y tolerancias.**

Los encabezados `#### B3.2`, `#### B3.3`, etc. del cuerpo técnico no deben
reinterpretarse como numeración autónoma de subcortes de implementación.

La corrección posterior debe eliminar la ambigüedad sin reescribir el contenido
histórico de D-072...D-076.

## Resguardos

Mientras este BUG permanezca abierto:

- no implementar B3.2;
- no avanzar familia vertical, horizontal ni `panelCoverage`;
- no integrar runtime ni `generatedArtifacts`;
- no modificar D-072, D-073, D-074, D-075 ni D-076;
- no reabrir B3.1a ni B3.1b;
- no consumir, migrar, proyectar, sincronizar ni usar como fallback Metalcon
  legacy;
- mantener `modelVersion: 4`;
- mantener `scenario.assignments=[]` durante B3;
- mantener artifacts B3 con `requirementRefs=[]`;
- mantener requirements efectivos `unresolved`;
- mantener `verificationState=notVerified`;
- no abrir B4, B5 ni SPEC-016-C;
- no modificar producto, store, React, schemas ni tests como parte del registro
  de este BUG;
- no realizar `git add`, commit, push, reset ni restore sin autorización humana
  separada.

## Alcance de esta apertura

Esta apertura crea únicamente el registro documental del defecto.

No corrige todavía:

- SPEC-016-B;
- `governance/STATUS.md`;
- `governance/TRACEABILITY.md`;
- `governance/DECISIONS.md`;
- `sessions/implementation-SPEC-016-B.md`;
- el kit de continuidad;
- código productivo ni tests.

## Criterios de cierre

BUG-016-B-021 podrá cerrarse cuando:

1. quede inequívocamente distinguida la numeración de secciones técnicas B3 de
   la numeración de subcortes de implementación;
2. la autoridad vigente establezca que B3.2 de implementación comprende
   hosts/frame, dominio geométrico, openings y tolerancias;
3. B3.3 de implementación permanezca reservado a la familia vertical;
4. D-072...D-076 permanezcan históricamente intactas;
5. no se amplíe B3 hacia B4/B5 ni SPEC-016-C;
6. los gates documentales aplicables permanezcan verdes;
7. exista revisión humana explícita antes de autorizar implementación B3.2.

## Cierre verificado

Cerrado el 18-ago-2026 tras revisión humana explícita.

La correctiva queda gobernada por D-077 y establece inequívocamente que:

- la numeración de secciones técnicas no define por sí sola subcortes de implementación;
- B3.2 de implementación comprende exclusivamente las secciones técnicas B3.2, B3.3 y B3.4: hosts/frame local, dominio geométrico/openings y tolerancias;
- B3.3 de implementación permanece reservado a la familia vertical;
- D-072...D-076 permanecen históricamente intactas;
- B4, B5 y SPEC-016-C permanecen bloqueados;
- la implementación de B3.2 continúa no autorizada y requiere una nueva aprobación humana explícita.

Resguardos materializados:

- `governance/PROTOCOL.md` incorpora la regla general de alcance por subcortes;
- `governance/DECISIONS.md` conserva D-077 y su `SCOPE-LOCK` append-only;
- `governance/STATUS.md` declara el `ACTIVE-SCOPE` vigente;
- `SPEC-016-B / B3.14` contiene el mapa explícito B3.2 -> secciones técnicas B3.2+B3.3+B3.4;
- `scripts/lib/scope-lock-governance.mjs` valida coherencia STATUS/DECISIONS/SPEC;
- `tests/scopeLockGovernance.test.mjs` verifica el contrato y rechaza scope drift hacia B3.5.

Evidencia ejecutada antes del cierre:

- `make governance`: PASS — 22 archivos requeridos, 56 requisitos y 77 decisiones;
- `node --test tests/scopeLockGovernance.test.mjs`: 6/6 PASS;
- `git diff --check`: PASS.

Este cierre resuelve exclusivamente BUG-016-B-021. No cierra BUG-016-B-022/023/024, no adelanta familia vertical/horizontal, `panelCoverage`, runtime, provenance/identidad, B4, B5 ni SPEC-016-C, y no constituye autorización de Git ni de implementación B3.2.
