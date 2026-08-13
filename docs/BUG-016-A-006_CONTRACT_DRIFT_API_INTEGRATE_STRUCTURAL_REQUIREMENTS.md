# BUG-016-A-006 — Contract drift en API integrateStructuralRequirements

## Estado

CERRADO — 12-ago-2026. B2.4-C.2 aprobado dentro del cierre humano B2-CLOSE; B2 aprobado y
cerrado. B3 no autorizado.

## Síntoma y contrato previo

El contrato público histórico era:

```text
integrateStructuralRequirements()
-> { topology, requirements }
```

B2.4-C añadió `referenceResolutionContext` al retorno y lo ensanchó a:

```text
integrateStructuralRequirements()
-> { topology, requirements, referenceResolutionContext }
```

## Impacto contractual

El contexto tipado de B2.4-C es un documento compañero derivado. Su incorporación silenciosa al
shape de una API pública existente constituye contract drift: la decisión B2.4-C no autorizó
ampliar `integrateStructuralRequirements()`.

La revisión B2.4-C.1 detectó además una dependencia accidental en el plumbing del fixture global
de `tests/constructiveScenarioContext.test.mjs`. Ese fixture obtenía `requirements` y
`referenceResolutionContext` desde el retorno ensanchado, aunque no necesitaba `topology`.

## Decisión humana y solución autorizada

La decisión humana B2.4-C.2 autoriza exclusivamente:

1. restaurar `integrateStructuralRequirements() -> { topology, requirements }`;
2. conservar `buildStructuralRequirementsWithReferenceResolutionContext()` como la vía explícita
   que devuelve `{ structuralRequirements, referenceResolutionContext }`;
3. migrar el plumbing accidental del fixture y del test de contexto compañero hacia esa API, sin
   modificar aserciones, propiedades P1–P6/T1–T13 ni datos FX-008.

El resto de B2.4-C queda protegido: schema, fingerprints, bindings tipados por ocurrencia,
provenance, edge→path exacto, fail-closed, reason codes, dominios y `verification=notVerified` no
cambian.

B2 continúa no aprobado. B3 continúa no autorizado.

## Gate bloqueado

Una regresión específica debe fallar antes del fix al observar la key pública adicional y debe
pasar después de restaurar el contrato histórico. La suite focal y los gates integrales deben
permanecer verdes sin modificar contratos B2.4-C.

## Evidencia BEFORE-FIX

Toolchain: Node `v22.23.2`, npm `10.9.9`.

Comando:

```bash
node --test tests/structuralRequirements.test.mjs
```

Resultado: `12` tests, `11 PASS`, `1 FAIL`, exit code `1`.

La assertion `assert.deepEqual(Object.keys(integrated).sort(), ['requirements', 'topology'])`
falló con `ERR_ASSERTION`. El shape observado fue:

```text
actual   = ['referenceResolutionContext', 'requirements', 'topology']
expected = ['requirements', 'topology']
```

Esta reversión se capturó antes de modificar `src/core/structuralRequirements.js`.

## Fix aplicado

El único cambio productivo fue dejar de extraer y publicar el contexto compañero desde
`integrateStructuralRequirements()`:

```diff
 export function integrateStructuralRequirements(input) {
-  const { requirements, referenceResolutionContext } = buildStructuralRequirementsProduct(input);
+  const { requirements } = buildStructuralRequirementsProduct(input);
   const topology = completeStructuralTopologyR6R12(input, requirements);
-  return { topology, requirements, referenceResolutionContext };
+  return { topology, requirements };
 }
```

La API compañera conserva exactamente las keys `structuralRequirements` y
`referenceResolutionContext`. Para la misma entrada FX-008, sus structural requirements son
`deepEqual` a `integrateStructuralRequirements(input).requirements`. El contexto conserva schema
`structural-reference-resolution-context-v1.0` y el estado de verificación permanece
`notVerified`.

El fixture protegido migró sólo su import y el plumbing de `test.before`: su SHA-256 cambió de
`aedf0642dfb97779452dda59f52dc3863dc88e456c4c822364a699462762fb44` a
`024c406f8026bd7963ef817d30fbd9304e5c9ca164fd2155eedbe8bc22940704`. No cambió ninguna
llamada `test(...)`, aserción, expected, dato sintético ni propiedad P1–P6/T1–T13/FX-008.

## Evidencia AFTER-FIX

- `integrateStructuralRequirements()` keys: `['requirements', 'topology']`; no posee
  `referenceResolutionContext`.
- API compañera keys: `['referenceResolutionContext', 'structuralRequirements']`.
- Regresión focal: 12/12 PASS.
- Test protegido: 72/72 PASS; P1–P6, T1–T13 y FX-008 PASS, incluido
  `verification=notVerified`.
- Regresión combinada: 105/105 PASS.
- `npm test`: Node 1119/1119 y componentes 49/49 PASS.
- `npm run validate`: PASS, exit code 0; cobertura core 92,33 % líneas / 80,60 % ramas /
  94,24 % funciones y store 92,37 % / 80,68 % / 93,33 %.
- `make governance`: 22 archivos requeridos, 53 requisitos y 65 decisiones.
- `git diff --check`: PASS.
- Los 29 cambios preexistentes fuera de la allowlist conservaron exactamente su SHA-256.

B2.4-C.2 queda implementada para revisión humana. B2 no se aprueba automáticamente y B3 no se
inicia.
