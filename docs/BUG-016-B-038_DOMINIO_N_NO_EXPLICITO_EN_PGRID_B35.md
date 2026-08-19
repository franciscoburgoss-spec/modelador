# BUG-016-B-038 — Dominio de n no explícito en Pgrid B3.5

## Estado

CERRADO — 19-ago-2026.

## Hallazgo

SPEC-016-B B3.5 define:

`Pgrid = { n*d | n*d < L } union { L }`.

También establece que la modulación se calcula siempre desde `s=0`.

Sin embargo, el contrato no declara el dominio matemático de `n`.

Tomada literalmente sin dominio, la expresión admite interpretaciones
divergentes e incluso valores negativos, incompatibles con una retícula finita
del host `s=0...L`.

La implementación necesita una definición inequívoca para:

- incluir el origen;
- terminar finitamente;
- tratar `d > L`;
- tratar `L` múltiplo exacto de `d`;
- tratar `L` no múltiplo de `d`;
- evitar suma acumulativa.

## Alcance

Exclusivamente SPEC-016-B B3.3, Fase A READ-ONLY, sección técnica B3.5.

No modifica la validación ya congelada de `studSpacingMm > 0`.

## Resolución candidata a revisar

Explicitar un índice entero no negativo:

`n ∈ Z, n >= 0`

y por tanto:

`Pgrid = { n*d | n ∈ Z, n >= 0, n*d < L } union { L }`.

Esta propuesta todavía requiere contraste y aprobación humana antes de
modificar contrato.

## Corpus mínimo requerido

- `d < L`, no divisor exacto;
- `d < L`, divisor exacto;
- `d == L`;
- `d > L`;
- `0` incluido exactamente una vez;
- `L` incluido exactamente una vez;
- ausencia de coordenadas negativas;
- generación directa `n*d`, sin suma acumulativa.

## Fuera de alcance

B3.6 técnica, horizontal, panelCoverage, runtime/generatedArtifacts, B4, B5,
SPEC-016-C y Git write.

## Cierre verificado

CERRADO — 19-ago-2026.

La revisión humana aprobó la resolución y D-091 congeló:

`n ∈ Z, n >= 0`

y:

`Pgrid = { n*d | n ∈ Z, n >= 0, n*d < L } union { L }`.

Queda establecido que:

- `0` pertenece a `Pgrid` mediante `n=0`;
- no existen posiciones negativas;
- cada posición regular se obtiene directamente como `n*d`;
- no se usa suma acumulativa;
- sólo se incluyen múltiplos estrictamente menores que `L`;
- `L` se incorpora exactamente una vez;
- si `d == L` o `d > L`, el conjunto es exactamente `{0,L}`;
- la eventual unión de roles coincidentes permanece fuera de B3.3 y pertenece
  a la sección técnica B3.6;
- implementación B3.3 continúa no autorizada.

El corpus adversario deberá cubrir divisor exacto, no divisor, `d==L`, `d>L`,
origen, extremo y ausencia de coordenadas negativas antes de autorizar
implementación.
