# BUG-015-D-018 — useModelStore REV8 no registrado en MIGRATION_MANIFEST

## Estado

Reproducido durante la validación completa de SPEC-015-D REV8 después de aprobar pruebas, componentes, Rust/Tauri, laboratorio, cobertura, goldens, DXF, CalculiX y build.

## Reproducción

El gate oficial se detuvo en:

```text
npm run verify:migration
Migración inválida (1):
- src/store/useModelStore.js: el archivo difiere del hash registrado
```

## Causa

La implementación REV8 modifica `src/store/useModelStore.js` para integrar persistencia y transacciones de `interfaceIntents`/`relationIntents`, pero la entrega inicial no actualizó la entrada `workspaceBytes`/`workspaceSha256` correspondiente en `governance/MIGRATION_MANIFEST.json`.

El archivo productivo ya fue cubierto por los gates funcionales y de regresión. El fallo es del ledger de migración: el manifiesto seguía registrando una revisión anterior del mismo archivo.

## Corrección

Registrar exclusivamente el estado REV8 de `src/store/useModelStore.js` mediante el mecanismo oficial:

```text
node scripts/migration-manifest.mjs --record SPEC-015 src/store/useModelStore.js
```

Esto conserva `bytes` y `sha256` del baseline original y actualiza sólo:

```text
workspaceBytes: 71752
workspaceSha256: 973d7807032ca999883ace7c272eef1e7228521843baf6d592f5431a50d66b9f
changedBy: SPEC-015
```

## Invariantes

- No se modifica `src/store/useModelStore.js`.
- No se modifica modelVersion ni el schema de intención.
- No se reescriben hashes del baseline original.
- No se registra ningún otro archivo de migración.
- No se modifica STATUS ni se cierra gobernanza.
- No se ejecuta Git.

## Criterio de cierre

`npm run verify:migration` debe terminar con 187 archivos válidos, 58 cambios posteriores registrados y 2 fixtures.
Después debe repetirse el validador completo REV8 sin Git.
