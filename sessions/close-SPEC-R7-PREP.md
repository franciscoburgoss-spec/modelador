# Cierre — SPEC-R7 / preparación

> Documento inmutable después de cerrar.

## Identidad

| Campo | Valor |
|---|---|
| Fecha | 27-jul-2026 |
| Commit | commit que contiene este cierre |
| Spec | `SPEC-R7-checks.md`, preparación |
| Toolchain | macOS 11.7.11 x86_64; Node 22.23.1; npm 10.9.8; Vite 5.4.21 |

## Alcance ejecutado

Se redactó y gobernó R7 antes de modificar producción. La preparación midió el estado actual de
muros, jambas, cadenetas, vanos y llegadas de cercha; revisó los límites silenciosos de
`roofPlane.js`; contrastó los checks con las fuentes primarias; y fijó tres cortes cerrables.

## Cambios

- Se definió una frontera pura para checks de muro con cobertura explícita y sin regeneración ni
  inferencia de roles.
- La distancia montante–jamba se fijó eje a eje; sólo un `stud` regular podrá omitirse durante una
  regeneración tipada y únicamente si el paso máximo sigue cumpliéndose.
- Las cadenetas menores a 30 mm se harán visibles sin absorberlas, prolongarlas ni eliminarlas sin
  un detalle constructivo aprobado.
- La holgura de puerta se medirá desde el borde de referencia existente a la cara del muro
  perpendicular, con signo y tolerancia de 1 mm, sin afirmar un lado de manilla no modelado.
- La llegada de cercha se revisará sólo sobre vanos, contra la jamba y con tolerancia `B/2` del
  perfil resoluble; no existirá un fallback silencioso a 19 mm.
- Los tres descartes `MIN_TRAMO` seguirán vigentes, pero producirán diagnósticos medidos.
- La capacidad MP1 por dirección separará resultados verificados, condicionados y excluidos; una
  condición desconocida no podrá sumarse como capacidad verificada.

## Criterios y evidencia

| Criterio | Resultado | Evidencia |
|---|---|---|
| Diagnóstico medido | PASS | 45 muros sin tipo; 28 proximidades eje a eje bajo 150 mm; 6 cadenetas bajo 30 mm |
| Cruce de techumbre medido | PASS | 6 llegadas únicas sobre vano; las 6 exceden 19 mm |
| Holgura legacy medida | PASS | `edgeOffset: 0` contra muro de 101,1 mm produce −50,55 mm a la cara |
| Decisión cerrada | PASS | cobertura, fronteras puras, medidas, tolerancias y estados de capacidad definidos |
| Alcance y exclusiones | PASS | sin inferencia de rol/handedness, demanda sísmica, detalle de tornillos, informe R8 ni correcciones del fixture |
| Aceptación verificable | PASS | 14 criterios con pruebas focalizadas, regresión y reversión por corte |
| Cortes transaccionales | PASS | A checks de muro; B techumbre/`MIN_TRAMO`; C capacidad por dirección |
| Fuentes primarias | PASS | Cintac §1.5.2/§1.5.2.1 y Anexo IV, URL y fecha de consulta declaradas |

## Validación

| Comando | Resultado | Conteo/reporte |
|---|---|---|
| `make governance` | PASS | 20 archivos; 26 requisitos; 28 decisiones |
| `npm run validate` con Node 22 | PASS | 657/657; laboratorio 35/35; build OK |
| Cobertura oficial del store | PASS | 72,76 % de líneas; 78,63 % de ramas; 66,16 % de funciones |
| `npm run verify:migration` | PASS | 187 archivos; 143 idénticos; 44 cambios registrados; 2 fixtures |
| `npm run verify:artifacts` | PASS | 298 archivos inspeccionados |
| `npm run verify:derived` | PASS | 13 exportadores; 14 mutadores |
| Build de producción | PASS | chunk inicial 671,56 kB raw / 208,04 kB gzip |
| Auditoría DXF | No aplica | preparación documental; no se modificaron emisores ni DXF |
| Smoke CalculiX | No aplica | preparación documental; no se modificaron emisores ni INP |

## Prueba de la prueba

| Fix revertido | Pruebas que fallan |
|---|---:|
| No aplica: esta unidad sólo emite el contrato previo a implementación | 0 |

## Desviaciones y deudas descubiertas

- El roadmap pedía calcular capacidad, pero el modelo no demuestra todavía caras/espesor del OSB,
  tornillos ni dobles de extremo. R7-C podrá calcular capacidad condicionada, pero la verificada
  permanecerá en cero mientras falte esa evidencia.
- El modelo no guarda giro, bisagra ni lado de manilla. R7-A sólo puede verificar el borde de
  referencia existente y deberá declarar esa cobertura limitada.
- El manual exige que el pie derecho del dintel coincida con la llegada de cercha; los 19 mm no
  están impresos como tolerancia, sino que se derivan de `B/2` para un perfil con ala de 38 mm.
- Las seis cadenetas de 12/24 mm quedan visibles, pero su solución constructiva sigue abierta por
  falta de un detalle aprobado.
- `validate-governance` aún no recorre `specs/domain/`; diagnóstico, decisión, alcance, exclusiones
  y aceptación se comprobaron manualmente, y la deuda sigue bajo R-011.
- No hubo cambios de código, modelo, DXF ni INP.

## Documentos actualizados

- [x] `governance/STATUS.md`
- [x] `governance/TRACEABILITY.md`
- [x] `governance/RISKS.md`
- [x] `governance/DECISIONS.md`
- [x] `domain/README.md`
- [x] `specs/domain/README.md`
