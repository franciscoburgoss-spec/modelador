# BUG-016-A-005 — Resolución tipada de sourceRefs en B2

## Estado

CERRADO — 12-ago-2026. B2.4-C aprobado dentro del cierre humano B2-CLOSE; B2 aprobado y
cerrado. B3 no autorizado.

## Hallazgo confirmado por B2.4-A

La implementación B2.3 conserva `domain + value` únicamente para los campos que ya tenían dominio
explícito dentro de `structural-requirements-v1.0`, pero omite arrays de provenance necesarios cuyo
dominio todavía era conocido por el productor:

1. `requirement.sourceRefs[]` puede declarar el `pathId` exacto y el
   `candidatePathEdgeId` productor, pero B2.3 los ignora;
2. el enlace alternativo `region.ownerRef.id -> path.sourceRefs.targetElementId` puede alcanzar
   más de un path que comparte el mismo target y sobreconectar el scope;
3. `pathProjection()` conserva `edgeKinds`, pero no permite resolver un candidate edge hasta su
   path propietario exacto;
4. `declaredInteraction.sourceRefs[]`, `support/transfer.sourceRefs[]` y otras refs
   connective-required se ignoran sin producir fail-closed cuando falta su binding;
5. B2.3 unifica sin autoridad `region.topologicalBoundaries[].nodeId` y los nodos de candidate
   paths bajo el dominio `nodeId`;
6. las pruebas transitivas de B2.1/B2.2 fueron modificadas para enlazar mediante
   `targetRegionRefs`/owners y dejaron de demostrar tránsito por las refs originales.

## Impacto

El scope puede incorporar paths, roofs y blockers ajenos o excluir conexiones contractualmente
necesarias. La clausura puede parecer completa aunque una ref connective-required carezca de
binding, target o provenance resoluble. Esto invalida la prueba de independencia de blockers y la
proyección efectiva B2.

El defecto no autoriza cambiar `structural-requirements-v1.0`, persistir derivados, convertir
`notVerified` en verificación ni iniciar B3.

## Decisión humana B2.4-C

- mantener intacto `structural-requirements-v1.0`;
- producir en el mismo flujo un contexto compañero
  `structural-reference-resolution-context-v1.0`, puro, canónico, determinista, no persistente y
  no autoritativo;
- capturar bindings por ocurrencia mientras el productor conoce el dominio, sin inferirlo después
  desde texto, prefijos, regex, forma, coincidencia de valor u otra ruta;
- conservar el vínculo exacto
  `candidatePathEdgeId -> candidateEdgeMemberOfPath -> pathId`;
- separar `topologyNodeId` de `candidatePathNodeId` y `pathId` de `candidatePathEdgeId`;
- verificar el fingerprint del requirements compañero antes de resolver;
- aplicar fail-closed a toda ref connective-required irresoluble, ambigua, contradictoria o con
  provenance incompleta;
- mantener el contexto fuera de `constructive-effective-input-v1.0`.

## Prueba de reversión previa

La primera regresión protegida exige:

```text
requirement.sourceRefs[pathId=P1]
-> alcanza P1
-> no alcanza P2 con el mismo targetElementId
```

Ejecutada contra B2.3 antes de modificar código productivo con Node 22.23.2 / npm 10.9.9:

```text
node --test tests/constructiveScenarioContext.test.mjs
54/55 PASS · 1 FAIL

Expected: [P1]
Actual:   [P1, P2]
```

El assertion failure ocurrió en
`BUG-016-A-005 reversión P1: requirement alcanza sólo el path exacto de sourceRefs`: el path P2
entró únicamente porque comparte `targetElementId=7001` con P1, aunque
`requirement.sourceRefs[]` contiene exclusivamente P1.

## Criterio de cierre técnico

P1–P6 y T1–T13 pasan; el requirements v1.0 público permanece `deepEqual` y con el mismo
`canonicalSha256`; FX-008 alcanza el path y edge laterales exactos sin incorporar otro path del
mismo target; los reason codes B2.4-C quedan observados; los gates focales, regresiones e
integrales quedan verdes. B2 permanece pendiente de aprobación humana y B3 no se inicia.

## Evidencia de cierre técnico

- focal `constructiveScenarioContext`: 72/72 PASS, con P1–P6 y T1–T13;
- focal `structuralRequirements`: 11/11 PASS, incluida invariancia `deepEqual` y
  `canonicalSha256` del documento v1.0;
- regresión B1/B2/SPEC-015-E usada en B2.3 y ampliada: 116/116 PASS;
- suite Node: 1118/1118 PASS; componentes: 49/49; Rust: 9/9; laboratorio: 35/35;
  cobertura core: 92,28 % de líneas; store: 92,37 %;
- goldens: 19 verificados sin actualización; DXF: 14 archivos, 0 errores y 0 reparaciones;
  CalculiX: 3/3;
- build, lint, formato, cobertura, migración 187/2, derivados, auditoría Codex,
  `git diff --check`, gobernanza 22/53/65 y `npm run validate`: PASS;
- FX-008 conserva `verification=notVerified` y alcanza exactamente el path
  `path:sha256:6baec8998b1c6f1a80cae66e5394f827526bc33038da3a969508a15c99f5563f` y el edge
  `edge:sha256:93dd4a82f9104b75ef61b16068efe77fb15fe347230c7a255f9ac9300de11dac`, sin incorporar
  el segundo path que comparte target.
