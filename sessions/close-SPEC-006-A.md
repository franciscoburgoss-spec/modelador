# Cierre — SPEC-006-A / corte único

> Documento inmutable después de cerrar.

## Identidad

| Campo | Valor |
|---|---|
| Fecha | 03-ago-2026 |
| Commit | `a08d7b41850436358ddc5914e6e51d993b0b66e0` + árbol de trabajo gobernado |
| Spec | `SPEC-006-A` |
| Toolchain | Node 22.23.2; npm 10.9.8; Rust/Cargo 1.97.1 x86_64; Tauri CLI 2.11.4; Python 3.14.5 + ezdxf 1.4.4; CalculiX 2.23 |
| Esfuerzo planificado | high |
| Esfuerzo efectivo | high |
| Escalamiento | No |

## Alcance ejecutado

Se estableció `agnostic-geometry-v1.0` como frontera JSON descargable, pura, cartesiana y
determinista. Proyecta la geometría vigente sin copiar perfiles, materiales, modulación, miembros,
OSB, biblioteca, resultados stale ni estado UI. El archivo nativo, recovery, importación y
`modelVersion` 2 permanecen intactos.

## Cambios

- `agnosticGeometry.js` define esquema, proyección allowlist, validación, serialización canónica y
  un error tipado con ruta e IDs.
- Ejes y niveles preservan IDs y cotas resueltas; muros/vanos, columnas y vigas usan prismas
  cartesianos; cada capa positiva de fundación produce un sólido propio.
- `roofSystems` y `roofPlanes` producen superficies límite 3D desde apoyos, niveles, pendiente,
  coronación y polígono, sin espesor ni miembros inventados.
- El adaptador DOM inyectable descarga `geometria-agnostica.json` con MIME
  `application/json;charset=utf-8` y revoca siempre el object URL.
- El menú distingue `Exportar geometría JSON…` de `Importar JSON…`; la política se registró
  `live` y los errores se muestran antes de crear Blob/enlace.
- El manifiesto preserva los hashes de origen de `MenuBar.jsx` y `useModelStore.js` y registra sus
  hashes de workspace bajo `SPEC-006`.

## Criterios y evidencia

| Criterio | Resultado | Evidencia |
|---|---|---|
| 1. Raíz, unidades, convención y números finitos | PASS | Objeto raíz exacto y validador recursivo en `agnosticGeometry.test.mjs` |
| 2. `casa-L` completo y sin filtraciones | PASS | 45 muros, 43 vanos, 4 fundaciones, 2 cubiertas e igualdad de sets de IDs |
| 3. FX-003 y FX-004 | PASS | 6 muros/6 vanos; polígono 3D de FX4 sin plantilla/perfiles/paso/miembros |
| 4. Ejes, niveles, parámetros, fórmulas y refs | PASS | Modelo mínimo exacto con fórmulas y referencia a eje/elemento resueltas |
| 5. Vacíos y fundaciones multicapa | PASS | Vano ligado por `hostWallId`; cimiento, sobrecimiento, zapata y emplantillado con volumen positivo |
| 6. Rechazo atómico tipado | PASS | Tipo desconocido, ref rota, ID duplicado, dimensión cero y `NaN`; DOM permanece sin tocar |
| 7. Bytes canónicos con newline | PASS | Permutación de ejes, niveles, elementos, vanos y fuentes produce bytes idénticos |
| 8. Adaptador DOM | PASS | Una descarga, nombre/MIME exactos, no mutación y revocación incluso si `click` falla |
| 9. Menú y política `live` | PASS | Prueba de componente; stale no advierte ni entra en el JSON |
| 10. Archivo nativo intacto | PASS | Roundtrip `casa-L` en v2 conserva studs, OSB, perfiles, roofSystems y grilla |
| 11. Prueba de la prueba | PASS | Serialización directa temporal hace fallar 2/7 pruebas enfocadas; restauración deja 7/7 |
| 12. Puertas técnicas | PASS al retorno | 804 Node, 19 componentes, 9 Rust, 35 lab, cobertura, DXF, CCX y build verdes |
| 13. Esfuerzo Codex | PASS al retorno | Inicio `2e9983f6-4ad9-43fa-827a-0d94f2948d7a`: high planificado/enviado; cierre high efectivo, sin xhigh |

## Validación

| Comando | Resultado | Conteo/reporte |
|---|---|---|
| `make governance` | PASS al retorno | Dentro del hijo sólo espera su propio `launch_completed` |
| `npm run validate` | PASS al retorno | Todos los gates hasta `codex:audit` verdes; el padre anexa el evento final al terminar el hijo |
| Pruebas enfocadas | PASS | 7/7 contrato; 35/35 núcleo/política/native/store; 5/5 flujo crítico |
| Cobertura oficial | PASS | core 92,88 %; store 96,59 % |
| Build de producción | PASS | 284 módulos; chunk inicial 748,79 kB raw / 233,51 kB gzip |
| `npm run verify:migration` | PASS | 187 archivos: 130 idénticos, 57 cambios registrados; 2 fixtures |
| `git diff --check` | PASS | Sin errores de whitespace |

El registro Codex es append-only. Durante la ejecución hija, `codex:audit` rechaza correctamente el
único `launch_started` todavía sin pareja. Al retornar código 0, el lanzador lee este cierre,
compara `high == high == high` y anexa `launch_completed`; ese paso final no se simula ni se escribe
manualmente desde el hijo.

## Prueba de la prueba

| Fix revertido | Pruebas que fallan |
|---|---:|
| Reemplazar la serialización allowlist por `JSON.stringify(model)` | 2/7: determinismo y rechazo antes del DOM |
| Restaurar `projectAgnosticGeometry(model)` | 0/7 |

## Desviaciones y deudas descubiertas

- `.git` es de sólo lectura y no permitió crear `spec/006a-agnostic-geometry`; se preservó sin
  descarte el árbol heredado en `spec/GOV-A-reasoning-effort-policy`.
- La primera cobertura enfocada heredó Node 20.20.2 y no reconoció las opciones del gate. Se cargó
  NVM y toda la validación gobernada se ejecutó con Node 22.23.2.
- La primera puerta completa detectó que faltaba sustituir `model-json` por
  `agnostic-geometry-json` en el inventario central de entry points. Se corrigieron juntos política
  e inventario; `verify:derived` confirma 13 exportadores y 14 mutadores.
- El warning conocido del chunk inicial continúa bajo R-010 y mide 748,79 kB en este build.
- No se modificaron generadores ni artefactos DXF/INP. F-009 sigue P1 y R-017 conserva su alcance;
  el exportador agnóstico no usa el solver defectuoso de `roofPlane`.

## Documentos actualizados

- [x] `governance/STATUS.md`
- [x] `governance/TRACEABILITY.md`
- [x] `governance/RISKS.md`
- [x] `governance/DECISIONS.md`, D-047
- [x] `governance/MIGRATION_MANIFEST.json`
