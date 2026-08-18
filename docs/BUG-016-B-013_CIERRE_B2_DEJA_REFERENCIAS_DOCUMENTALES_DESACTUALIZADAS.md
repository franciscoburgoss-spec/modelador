# BUG-016-B-013 — Cierre B2 deja referencias documentales desactualizadas

## Estado

CERRADO — 17-ago-2026.

## Contexto

Durante la apertura controlada de `SPEC-016-B / B3`, después de verificar el
baseline publicado de B2 en:

`4d5d61df2cdf6bb507a78bb99ddc3daece6cbe6e`

se realizó una inspección READ-ONLY de la gobernanza y de la sesión activa.

B1 y B2 están cerrados por revisión humana, B3 es el siguiente corte no
iniciado, `SPEC-016-B` continúa abierta y `SPEC-016-C` permanece bloqueada.

## Hallazgo

El cierre técnico y documental de B2 dejó dos referencias residuales
desactualizadas.

### 1. Sesión de implementación contradice el estado real de BUG-016-B-011

`sessions/implementation-SPEC-016-B.md` declara:

> BUG-016-B-011 tiene su correctiva documental materializada por este cierre y
> permanece abierto hasta superar los gates documentales post-cierre.

Sin embargo:

`docs/BUG-016-B-011_ESTADO_SERIE_Y_FECHA_STATUS_DESACTUALIZADOS.md`

declara:

`CERRADO — 16-ago-2026.`

y su cierre documental termina indicando:

`BUG-016-B-011 queda CERRADO.`

Por tanto, la sesión activa conserva una afirmación histórica que contradice
el estado publicado del BUG.

### 2. STATUS conserva como “Suite oficial” la suite B1

`governance/STATUS.md` conserva en su resumen superior:

`SPEC-016-B B1: npm run validate integral PASS; Node 1219/1219...`

aunque el cierre B2 publicado registra una validación posterior:

- Node `1238/1238`;
- componentes `61/61`;
- Rust `9/9`;
- laboratorio `35/35`;
- goldens, DXF, CalculiX, build, migración, artefactos, derivados, auditoría y
  gobernanza PASS.

La línea de estado general ya declara correctamente que B1 y B2 están
cerrados, pero la evidencia resumida de “Suite oficial” permanece anclada al
corte anterior.

## Impacto

El hallazgo es documental y de trazabilidad.

No existe evidencia de que afecte:

- el producto B2;
- el runtime Metalcon;
- la biblioteca Metalcon;
- la configuración Metalcon;
- los hashes publicados;
- el generador neutral;
- `modelVersion: 4`;
- `verificationState=notVerified`;
- la independencia D-070;
- el cierre humano de B2.

Sí puede inducir a una lectura incorrecta del estado vigente al iniciar B3.

## Correctiva requerida

La correctiva deberá ser exclusivamente documental y mínima:

1. actualizar `sessions/implementation-SPEC-016-B.md` para que
   `BUG-016-B-011` figure coherentemente como cerrado;
2. actualizar la fila `Suite oficial` de `governance/STATUS.md` para que el
   resumen represente la última suite integral publicada de B2;
3. no reinterpretar ni reabrir B1 o B2;
4. no modificar producto, runtime, store, UI, schema ni tests;
5. no iniciar materialización B3 como parte de esta correctiva;
6. mantener `SPEC-016-C` bloqueada.

## Resguardos

- Registrar este BUG antes de materializar la correctiva.
- No modificar decisiones D-070/D-071.
- No cambiar `REQ-DOM-013`, `REQ-DOM-014` ni `REQ-UX-006`.
- No modificar `modelVersion: 4`.
- No persistir generated solution.
- No cambiar `verificationState=notVerified`.
- No realizar escritura Git sin autorización humana separada.

## Criterio de cierre

El BUG puede cerrarse cuando:

- la sesión activa ya no contradiga el estado cerrado de BUG-016-B-011;
- `STATUS.md` represente la suite integral B2 publicada;
- `git diff --check` pase;
- `npm run format:check` pase para los documentos afectados o de forma
  integral según el contrato vigente;
- `make governance` pase;
- la auditoría confirme que no existen cambios de producto;
- la revisión humana apruebe la correctiva documental.



## Cierre verificado

CERRADO — 17-ago-2026.

La correctiva se materializó exclusivamente sobre documentación:

- `sessions/implementation-SPEC-016-B.md` ya registra coherentemente que
  `BUG-016-B-011` quedó CERRADO el 16-ago-2026;
- `governance/STATUS.md` resume como suite oficial la validación integral
  publicada para `SPEC-016-B / B2`;
- no se modificaron producto, runtime, store, UI, schemas ni tests;
- `SPEC-016-C` permanece bloqueada;
- B3 no fue materializado como parte de esta correctiva.

### Gates ejecutados

- `git diff --check` — PASS.
- `npm run format:check` — PASS; 769 archivos de texto válidos.
- `make governance` — PASS; 22 archivos requeridos, 56 requisitos y
  71 decisiones.
- auditoría de alcance — PASS; cero cambios fuera de
  `docs/`, `governance/` y `sessions/`.

### Estado resultante

La contradicción documental registrada por este BUG queda eliminada sin
reinterpretar B1/B2 ni modificar las decisiones congeladas D-070/D-071.

El cierre de este BUG no constituye autorización Git ni apertura técnica de
B3.
