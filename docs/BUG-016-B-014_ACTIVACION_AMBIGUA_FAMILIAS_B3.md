# BUG-016-B-014 — Activación ambigua de familias en contrato B3

## Estado

CERRADO — 17-ago-2026.

## Contexto

Durante la revisión documental de `SPEC-016-B / B3.0`, después de abrir B3
mediante D-072 y antes de ejecutar los gates de apertura, se auditó la sección
`B3.9 Familias de configuración`.

El contrato aprobado distingue tres familias de materialización:

- vertical;
- horizontal;
- panel.

B3 permanece abierto pero todavía no implementado.

## Hallazgo

La sección B3.9 declara:

- familia vertical:
  `studProfileRef + materialRef + studSpacingMm`;
- familia horizontal:
  `trackProfileRef + materialRef`;
- familia panel:
  `panelRef`.

También declara que:

`La ausencia deliberada de una familia es válida; una familia parcialmente
declarada es inválida.`

Sin embargo, el texto no define explícitamente qué campos activan cada familia.

En particular, `materialRef` es compartido por las familias vertical y
horizontal, pero puede coexistir con una selección exclusivamente de panel.

Sin una regla explícita, una implementación podría interpretar erróneamente:

`materialRef`

como solicitud parcial de framing y rechazar una configuración válida como:

`panelRef + materialRef`

aunque no exista intención de activar framing vertical ni horizontal.

## Contrato requerido

La correctiva deberá congelar explícitamente esta semántica:

### Familia vertical

La familia vertical se considera solicitada cuando aparece al menos uno de:

- `studProfileRef`;
- `studSpacingMm`.

Si está solicitada, debe existir el conjunto completo:

`studProfileRef + materialRef + studSpacingMm`.

`materialRef` aislado no activa la familia vertical.

### Familia horizontal

La familia horizontal se considera solicitada cuando aparece:

`trackProfileRef`.

Si está solicitada, debe existir:

`trackProfileRef + materialRef`.

`materialRef` aislado no activa la familia horizontal.

### Familia panel

La familia panel se considera solicitada cuando aparece:

`panelRef`.

`panelRef` es suficiente para materializar `panelCoverage`.

La presencia adicional de `materialRef` no activa framing por sí sola.

## Casos contractuales mínimos

Deben quedar inequívocos al implementar B3.1:

- ninguna selección de familia → válido; cero artifacts;
- `materialRef` solo → no activa vertical ni horizontal;
- `panelRef` → familia panel válida;
- `panelRef + materialRef` → panel válido; framing no activado;
- `studProfileRef` sin spacing/material → inválido;
- `studSpacingMm` sin profile/material → inválido;
- `studProfileRef + materialRef + studSpacingMm` → vertical válida;
- `trackProfileRef` sin material → inválido;
- `trackProfileRef + materialRef` → horizontal válida;
- vertical + horizontal + panel pueden coexistir cuando cada familia cumple
  su contrato.

## Impacto

El hallazgo es exclusivamente contractual/documental.

No existe implementación B3 que corregir todavía.

No afecta:

- B1;
- B2;
- D-070;
- D-071;
- D-072;
- `modelVersion: 4`;
- runtime Metalcon B2;
- biblioteca B2 publicada;
- hashes B2;
- geometría agnóstica;
- `structuralIntent`;
- `verificationState=notVerified`.

Sí debe corregirse antes de B3.1 para impedir que la implementación tenga que
inventar una regla de activación.

## Correctiva requerida

Modificar exclusivamente la sección B3.9 de
`specs/SPEC-016-B-adaptador-metalcon.md` para declarar de forma explícita:

- qué campos activan cada familia;
- que `materialRef` aislado no activa framing;
- que una familia sólo falla por incompleta cuando ha sido efectivamente
  solicitada;
- que `panelRef + materialRef` sin framing sigue siendo válido.

No modificar código, runtime, tests de implementación, schemas, store ni UI
como parte de esta correctiva.

## Resguardos

- D-072 permanece vigente y B3 continúa abierto.
- No ampliar el schema B2.
- No introducir nuevos defaults.
- No usar Metalcon legacy.
- No iniciar B3.1 antes de cerrar esta ambigüedad.
- No realizar `git add`, commit ni push sin autorización humana separada.

## Criterio de cierre

BUG-016-B-014 podrá cerrarse cuando:

- B3.9 defina inequívocamente la activación por familia;
- `materialRef` aislado no active vertical ni horizontal;
- `panelRef + materialRef` quede explícitamente válido sin framing;
- el diff permanezca exclusivamente documental;
- `git diff --check` pase;
- `npm run format:check` pase;
- `make governance` pase.
## Cierre verificado

CERRADO — 17-ago-2026.

La sección `B3.9 Familias de configuración` quedó corregida antes de iniciar
B3.1 y ahora define explícitamente:

- `studProfileRef` o `studSpacingMm` activan la familia vertical;
- una familia vertical solicitada exige
  `studProfileRef + materialRef + studSpacingMm`;
- `trackProfileRef` activa la familia horizontal;
- una familia horizontal solicitada exige
  `trackProfileRef + materialRef`;
- `materialRef` aislado no activa framing vertical ni horizontal;
- `panelRef` activa la familia panel;
- `panelRef + materialRef` sin campos activadores de framing es válido.

No se amplió el schema B2, no se introdujeron defaults y no se modificó código,
runtime, tests, store, UI ni Metalcon legacy.

### Gates ejecutados

- `git diff --check` — PASS.
- `npm run format:check` — PASS; 771 archivos de texto válidos.
- `make governance` — PASS; 22 archivos requeridos, 56 requisitos y
  72 decisiones.

La correctiva queda cerrada sin modificar D-070, D-071 ni D-072.
