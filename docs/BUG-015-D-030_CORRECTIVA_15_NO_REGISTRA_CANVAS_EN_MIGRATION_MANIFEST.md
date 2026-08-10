# BUG-015-D-030 — Correctiva 15 no registra Canvas.jsx en MIGRATION_MANIFEST

## Estado

**CERRADO 10-ago-2026.** Confirmado durante la validación integral posterior a Correctiva 15 y resuelto por Correctiva 16.

## Reproducción real

1. Correctiva 15 modifica `src/components/Canvas.jsx` para que el localizador de una interfaz `roofBoundary` parcial dibuje sólo la evidencia correspondiente a su `sRange`.
2. El focal de Correctiva 15 pasa completo.
3. El validador integral REV8 avanza hasta `npm run verify:migration`.
4. `verify:migration` falla con:

   `src/components/Canvas.jsx: el archivo difiere del hash registrado`

## Causa

Correctiva 15 dejó `src/components/Canvas.jsx` con:

- bytes: `52253`
- SHA-256: `d357074a777924ccd0229e5d509def551948d5e51d4bc580596a686a116429e5`

pero `governance/MIGRATION_MANIFEST.json` seguía registrando como workspace vigente:

- `workspaceBytes: 52026`
- `workspaceSha256: 8194b97cce984a4f32d510b1ea15cb27848afcb9ddf262cfe41253020fc4171c`

Los hashes del baseline de origen permanecen correctos y no deben alterarse.

## Corrección

Actualizar únicamente el registro de workspace de `src/components/Canvas.jsx` en `governance/MIGRATION_MANIFEST.json` a:

- `workspaceBytes: 52253`
- `workspaceSha256: d357074a777924ccd0229e5d509def551948d5e51d4bc580596a686a116429e5`
- `changedBy: SPEC-015`

El cambio es equivalente a ejecutar el contrato existente:

`node scripts/migration-manifest.mjs --record SPEC-015 src/components/Canvas.jsx`

sin modificar los hashes de origen del baseline.

## Fronteras

Esta correctiva:

- no modifica código productivo;
- no modifica schema ni `modelVersion`;
- no modifica geometría agnóstica;
- no modifica `candidateLoadPaths`;
- no modifica CalculiX;
- no modifica evidencia REV8;
- no modifica interfaces, relaciones ni el estado persistido del navegador;
- no ejecuta Git.

## Criterios de aceptación

1. El BUG queda registrado antes de actualizar gobernanza.
2. `Canvas.jsx` conserva exactamente bytes y SHA-256 de Correctiva 15.
3. Los hashes de origen de `Canvas.jsx` en el manifiesto permanecen inalterados.
4. `npm run verify:migration` termina PASS.
5. La aplicación es idempotente.
6. Correctiva 15 y sus guards permanecen intactos.

## Cierre 10-ago-2026

**Estado final: CERRADO.** Correctiva 16. `MIGRATION_MANIFEST.json` actualizado y `verify:migration` final PASS con 187 archivos, 129 idénticos y 58 cambios posteriores registrados.

El validador integral final de REV8 pasó 90/90 pruebas focales, 996/996 Node, 49/49 componentes,
9/9 Rust y 35/35 laboratorio, sin Git. El cierre consolidado se registra en
`docs/SPEC-015-D_REV8_CIERRE_VALIDACION_2026-08-10.md`.
