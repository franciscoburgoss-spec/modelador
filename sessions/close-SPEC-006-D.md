# Cierre — SPEC-006-D / corte único

> Documento inmutable después de cerrar.

## Identidad

| Campo | Valor |
|---|---|
| Fecha | 03-ago-2026 |
| Commit | `a08d7b41850436358ddc5914e6e51d993b0b66e0` + árbol de trabajo gobernado |
| Spec | `SPEC-006-D` |
| Toolchain | Node 22.23.2; npm 10.9.8; Rust/Cargo 1.97.1 x86_64; Tauri CLI 2.11.4; Python 3.14.5 + ezdxf 1.4.4; CalculiX 2.23 |
| Esfuerzo planificado | high |
| Esfuerzo efectivo | high |
| Escalamiento | No |

## Alcance ejecutado

Se implementó `agnostic-geometry-audit/v1` como auditor numérico puro e independiente del
proyector y serializador. Reconstruye desde el modelo fuente la grilla, muros, vanos, columnas,
vigas, capas de fundación y superficies legacy/modernas de cubierta; compara miembros, clases,
roles, biyección de IDs y cada número con tolerancia absoluta inclusiva de 0,001 mm.

La geometría ahora se audita antes de Blob, URL o enlace. Una diferencia produce un error tipado
con informe, ID y ruta; un resultado correcto devuelve el informe asociado sin cambiar los bytes,
nombre, MIME ni revocación de SPEC-006-A/B/C. El menú agrega una acción separada que descarga
`auditoria-geometria-agnostica.json`. No se implementó visor, Three.js ni comparación visual.

## Cambios

- `agnosticGeometryAudit.js` construye la expectativa sin importar ni llamar al proyector o al
  serializador, normaliza permutaciones equivalentes y emite checks deterministas legibles por
  máquina con máximo desvío finito.
- La biyección cubre ejes, niveles, elementos, vanos, roles de capa y cubiertas; miembros extra,
  omitidos, duplicados o con tipo/primitiva incorrectos fallan explícitamente.
- `downloadAgnosticGeometry` audita la proyección antes de todo I/O DOM y retorna el informe `pass`;
  `downloadAgnosticGeometryAudit` genera el JSON separado con política `live` propia.
- Store y menú presentan las dos acciones diferenciadas y muestran fallos sin mutar el modelo.
- El manifiesto actualiza sólo los hashes workspace de `MenuBar.jsx` y `useModelStore.js`, sin
  alterar los hashes de origen. El archivo nativo v2 y los cierres A/B/C permanecen intactos.

## Criterios y evidencia

| Criterio | Resultado | Evidencia |
|---|---|---|
| 1. Informe, tolerancia, estado y resumen exactos | PASS | Informe vacío exacto, serialización LF y máximo finito en `agnosticGeometryAudit.test.mjs` |
| 2. Tipos correctos, números y biyección completa | PASS | Modelo mínimo con cuatro tipos, vano y tres capas; checks por ID/ruta |
| 3. Corpus de alteraciones y estructura | PASS | Posición, largo, espesor, altura, vano, columna, viga, capa y cubierta; omitido/duplicado/extra |
| 4. Frontera de 0,001 mm y no finitos | PASS | 0,001 pasa; 0,0010001 falla; `NaN`, ±infinito y tres tolerancias inválidas se rechazan |
| 5. Fixtures y coronaciones | PASS | `casa-L` 45/43/4/2, FX-003 6/6, FX-004 4/1 y caso heterogéneo 3/1 |
| 6. Determinismo e independencia | PASS | Permutación de fuente/JSON produce bytes iguales; inspección estática prohíbe las tres dependencias vedadas |
| 7. Bloqueo pre-DOM y compatibilidad A/B/C | PASS | Payload alterado arroja `AgnosticGeometryAuditError` y registra cero eventos DOM; suite heredada 11/11 |
| 8. Informe descargable y UI | PASS | Nombre/MIME/contenido/revocación exactos; prueba de componente distingue ambas acciones y error visible |
| 9. Prueba de la prueba | PASS | Neutralizar la comparación numérica hace fallar el corpus porque `prism.start.x` alterado pasa; restauración verde |
| 10. Puertas y esfuerzo | PASS técnico / G0 bloqueado | Gates técnicos completos; `high` planificado/enviado/efectivo. R-025 conserva un intento fallido append-only previo |

## Validación

| Comando | Resultado | Conteo/reporte |
|---|---|---|
| Pruebas enfocadas | PASS | 36/36 núcleo/política y 1/1 componente enfocado; auditor 7/7 |
| `npm run validate` con Node 22.23.2 | PASS hasta `codex:audit` | 816 Node; 19 componentes; 9 Rust; 35 lab; 18 goldens; DXF 14 archivos 0/0; CCX 3/3; build OK |
| Cobertura oficial | PASS | core 92,83 %; store 95,48 % |
| `npm run build` | PASS | 285 módulos; chunk inicial 766,61 kB raw / 238,22 kB gzip; warning R-010 conocido |
| `npm run codex:audit` | BLOQUEADO | Ejecución actual espera retorno y el intento previo `805966c7…` permanece fallido por diseño append-only |
| `make governance` | BLOQUEADO | Misma causa exclusiva del registro Codex; la gobernanza documental restante pasa |
| `git diff --check` | PASS | Sin errores de whitespace |

El lanzador de esta ejecución (`85ed2fcd-c5b8-4ce3-9c59-b6793ddfd03b`) recibió `high`. Al retornar
leerá este cierre, comparará `high == high == high` y anexará su `launch_completed`; ese evento no
se adelanta ni simula desde el hijo. El intento anterior `805966c7-465f-4549-8195-6ed8ec784425`
terminó antes de implementar y quedó preservado. El validador actual considera inválido cualquier
fallo histórico aunque exista un reintento posterior; corregir esa política excede SPEC-006-D y se
registra como R-025 para una spec de herramientas.

## Prueba de la prueba

| Fix revertido | Pruebas que fallan |
|---|---:|
| Forzar `pass` en toda comparación numérica | 1/1 enfocada: `prism.start.x`, esperado `fail`, observado `pass` |
| Restaurar comparación `desviación <= tolerancia` | 0; prueba enfocada verde |

## Desviaciones y deudas descubiertas

- La rama conserva el nombre heredado `spec/GOV-A-reasoning-effort-policy`; `.git` es de sólo
  lectura y no permite crear la rama requerida. Se preservaron todos los cambios acumulados.
- R-025 registra la contradicción del gate append-only: conservar un intento fallido es evidencia,
  pero el validador lo vuelve un bloqueo permanente. No se editaron eventos ni se amplió el corte.
- El warning conocido del chunk inicial continúa bajo R-010 y ahora mide 766,61 kB.
- No se modificaron generadores ni artefactos DXF/INP. F-009 sigue P1 y el visor comparativo queda
  explícitamente fuera de alcance.

## Documentos actualizados

- [x] `governance/STATUS.md`
- [x] `governance/TRACEABILITY.md`
- [x] `governance/RISKS.md`
- [x] `governance/DECISIONS.md`, D-050
- [x] `governance/MIGRATION_MANIFEST.json`
