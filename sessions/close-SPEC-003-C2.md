# Cierre — SPEC-003 / corte C2

> Documento inmutable después de cerrar.

## Identidad

| Campo | Valor |
|---|---|
| Fecha | 28-jul-2026 |
| Commit | `5ad8a22e0f64` para producto y reporte; commit que contiene este cierre para gobernanza |
| Spec | `SPEC-003-C2-solver-harness.md` |
| Toolchain | macOS 11.7.11 x86_64; Node 22.23.1; npm 10.9.8; CalculiX 2.23 (`/usr/local/bin/ccx`) |

## Alcance ejecutado

Se cerró el arnés solver de tres jobs y la corrección mínima del INP global. El exportador conserva
la geometría e IDs persistidos, compacta nombres de sets, declara cada sección y evita mezclar
B31/U1 cuando el deck contiene perfiles U1. La coordinación del proceso vive en `scripts/`; los
contratos INP y parsers FRD/DAT permanecen puros en `core`.

## Cambios

- Los nombres dinámicos se compactan determinísticamente a 20 caracteres; los IDs que caben se
  preservan completos.
- Cada fundación global tiene set propio. Con U1 usa `SECTION=GENERAL` y propiedades derivadas del
  rectángulo real; sin U1 conserva B31/RECT.
- El golden global registra 133 sets, 137 secciones resueltas y 1.046 elementos U1 sin alterar
  nodos, extents, IDs ni conectividad.
- El parser común valida contratos INP, últimos bloques DISP FRD/DAT, nodos exactos y valores
  finitos.
- El runner detecta ruta/versión, usa argumentos directos, limpia cada directorio aislado, separa
  fuente y copia ejecutada, clasifica diagnósticos y emite un reporte por commit.
- La sonda global sólo agrega `NSET`, restricciones, `STEP` y solicitud `NODE FILE`; no agrega
  cargas ni se presenta como resultado estructural.

## Criterios y evidencia

| Criterio | Resultado | Evidencia |
|---|---|---|
| 1. Sets globales `<=20` e ID de muro completo | PASS | golden: máximo 16; `WM_1784600403613`; tests de compactación |
| 2. Secciones resueltas y cuatro fundaciones reales | PASS | 137/137 referencias; cuatro sets `F_<id>`; pruebas GENERAL exactas |
| 3. Global U1 sin alterar geometría; fallback B31 | PASS | 1.384 nodos/1.046 U1; hashes de nodos, elementos y conectividad fijados; test B31/RECT sin U1 |
| 4. Tres goldens y jobs CCX reales | PASS | 18 goldens; reporte `5ad8a22e0f64`: 3/3 con CalculiX 2.23 |
| 5. Sonda sólo aditiva y hashes distintos | PASS | prefijo fuente idéntico; global `468f5d…f4ea` frente a `a15971…73e6` |
| 6. Ruta, argumentos, aislamiento y limpieza | PASS | tests del runner; `/usr/local/bin/ccx`; `spawn(executable, ['job'])` |
| 7. Resultados exactos, finitos y no vacíos | PASS | 1.486 nodos/8.649 valores; tests faltantes, ajenos, `NaN` e `Infinity` |
| 8. Errores y warnings contractuales | PASS | error aun con `Job finished`; único warning permitido y contado en global |
| 9. Reporte completo y tres éxitos | PASS | hashes, conteos, extremos y 290,2 ms en `smoke-ccx.json` |
| 10. Reversión crítica | PASS | sets/sección fallan contrato; B31/RECT real termina CCX con código 201 |

## Validación

| Comando | Resultado | Conteo/reporte |
|---|---|---|
| `make governance` previo | PASS | 20 archivos; 26 requisitos; 33 decisiones |
| tests enfocados C2 | PASS | 27/27 |
| `npm run verify:goldens` | PASS | 18 artefactos |
| `npm run smoke:ccx` sobre `5ad8a22e0f64` | PASS | 3/3; 1 warning permitido; 1.486 nodos; 8.649 valores |
| `npm run validate` con Node 22 | PASS | 723/723; laboratorio 35/35; core 93,46 %; store 72,76 %; build OK |
| `npm run verify:migration` | PASS | 187 archivos: 138 idénticos, 49 cambios registrados; 2 fixtures |
| `npm run verify:artifacts` | PASS | 349 archivos fuente/documentales inspeccionados |
| `npm run verify:derived` | PASS | 13 exportadores; 14 mutadores |
| Build de producción | PASS | 703,08 kB raw / 218,42 kB gzip |

## Prueba de la prueba

| Fix revertido | Pruebas que fallan |
|---|---:|
| Restaurar un `ELSET` de más de 20 caracteres | `assertCalculixInpContract` rechaza el set largo |
| Referenciar una sección no declarada | `assertCalculixInpContract` rechaza el `ELSET` inexistente |
| Restaurar las cuatro fundaciones a B31/RECT en el global | CalculiX 2.23 termina con código 201 y `*ERROR in gen3delem: first thickness ... is zero` |

## Desviaciones y deudas descubiertas

- El warning global `*WARNING: no degrees of freedom in the model` es deliberado y queda
  permitido sólo para la sonda totalmente fija; no representa convergencia estructural bajo carga.
- `npm run validate` todavía no incorpora goldens ni herramientas externas; esa integración
  corresponde al corte E, sin ampliar C2.
- No se tocaron DXF, Tauri, componentes, store ni umbrales de cobertura.

## Documentos actualizados

- [x] `governance/STATUS.md`
- [x] `governance/TRACEABILITY.md`
- [x] `governance/RISKS.md`
- [ ] `governance/DECISIONS.md`, no hubo decisión nueva
- [x] `harness/README.md`
