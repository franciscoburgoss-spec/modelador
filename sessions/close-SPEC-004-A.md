# Cierre — SPEC-004 / corte A

> Documento inmutable después de cerrar.

## Identidad

| Campo | Valor |
|---|---|
| Fecha | 28-jul-2026 |
| Commit | `e91fd2aa1281dba1fa91226743abf0c446602d72` |
| Spec | `specs/SPEC-004-A-native-file-contract.md` |
| Toolchain | macOS 11.7.11 x86_64; Node 22.23.1; npm 10.9.8; Python 3.14.5; ezdxf 1.4.4; CalculiX 2.23 |

## Alcance ejecutado

Se agregó la frontera pura para validar, serializar, abrir y guardar proyectos mediante un puerto
inyectable. Un adaptador Node de referencia implementa temporal hermano durable, backup exacto,
rotación a diez versiones y reemplazo atómico. Un proceso hijo detenido entre `fsync` y `rename`
demuestra que la última versión publicada permanece intacta.

## Cambios

- `nativeProjectFile.js` valida antes de I/O, produce JSON canónico y tipa fallos de lectura,
  escritura o configuración del puerto.
- `nodeProjectFileSystem.js` escribe con permisos `0600`, sincroniza temporal y directorios,
  respalda la versión anterior y poda la historia.
- El helper de interrupción recibe la ruta como argumento estructurado, se coordina por IPC y no
  invoca shell.
- La UI web permanece sin cambios; Tauri adoptará el puerto en los cortes siguientes.

## Criterios y evidencia

| Criterio | Resultado | Evidencia |
|---|---|---|
| 1–2. Validación previa, JSON canónico y apertura sin estado parcial | PASS | `nativeProjectFile.test.mjs` 3/3 |
| 3–4. Temporal hermano, sincronización y kill conservan última versión | PASS | `nodeProjectFileSystem.test.mjs`, prueba `SIGKILL`; hash previo idéntico |
| 5. Backup exacto y rotación a diez versiones previas | PASS | prueba filesystem: versiones reabribles 2–11 después de publicar 12 |
| 6. Puerto puro y ejecución sin shell | PASS | inspección reproducible de imports; `spawn(process.execPath, args)` con `shell` ausente |
| 7. Pruebas de reversión | PASS | guardado directo cambió SHA; poda a once produjo `11 !== 10` |
| 8. Puertas completas | PASS | `npm run validate` código 0 en `e91fd2a`; no se modificaron DXF ni INP |

## Validación

| Comando | Resultado | Conteo/reporte |
|---|---|---|
| Pruebas SPEC-004-A enfocadas | PASS | 5/5 |
| `npm run validate` | PASS | 741/741 Node; 8/8 componentes; 35/35 lab; core 93,59 %; store 97,77 % |
| Goldens / DXF | PASS | 18/18; `artifacts/e91fd2aa1281/audit-dxf.json`, 8 familias, 9 archivos, 0/0 |
| CalculiX | PASS | `artifacts/e91fd2aa1281/smoke-ccx.json`, 3/3, 1.486 nodos y 8.649 valores finitos |
| Build | PASS | 714,70 kB raw / 222,14 kB gzip; warning heredado visible |
| Migración / artefactos / derivados | PASS | 187 archivos; 372 inspeccionados; 13 exportadores y 14 mutadores |
| `make governance` | PASS | 20 archivos, 29 requisitos y 38 decisiones después del cierre |

## Prueba de la prueba

| Fix revertido | Pruebas que fallan |
|---|---:|
| Temporal hermano reemplazado por escritura directa al destino | ensayo `SIGKILL`: SHA esperado `25a4a5e4…`, obtenido `c743d666…` |
| Poda alterada para conservar once respaldos | rotación: esperaba 10, obtuvo 11 |

Ambas regresiones se ejecutaron de forma enfocada y el adaptador se restauró antes de repetir 5/5.

## Desviaciones y deudas descubiertas

- `Guardar/Cargar` continúa usando `localStorage`; la adopción del puerto, ruta, título y estado
  sucio corresponde a `SPEC-004-B`.
- Un `SIGKILL` deja el temporal durable abandonado. Su limpieza segura pertenece al criterio 9 de
  la spec padre y quedó expresamente fuera de este corte.
- R-004 queda en mitigación, no resuelto, hasta probar el mismo contrato en el runtime Tauri.
- No se modificaron emisores DXF ni archivos INP; los gates generales permanecen verdes.

## Documentos actualizados

- [x] `governance/STATUS.md`
- [x] `governance/TRACEABILITY.md`
- [x] `governance/RISKS.md`
- [x] `governance/DECISIONS.md`
- [x] `docs/DEVELOPMENT.md`
