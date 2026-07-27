# Cierre — SPEC-R6 / preparación

> Documento inmutable después de cerrar.

## Identidad

| Campo | Valor |
|---|---|
| Fecha | 27-jul-2026 |
| Commit | commit que contiene este cierre |
| Spec | `SPEC-R6-wall-junctions.md`, preparación |
| Toolchain | macOS 11.7.11 x86_64; Node 22.23.1; npm 10.9.8; Vite 5.4.21 |

## Alcance ejecutado

Se redactó y gobernó R6 antes de modificar producción. La preparación midió la topología actual,
los derivados persistidos, el metrado, los consumidores OSB/CalculiX y las mutaciones que cambian
vecinos; contrastó el detalle L/T con las fuentes primarias y fijó tres cortes cerrables.

## Cambios

- Se reemplazará el detector booleano/local por una topología global de nodos y bandas Z, con
  clasificación L/T/straight/terminal/X/ambiguous y candidatos completos.
- `start/end` queda referido a un frame local desde la menor coordenada, incluido el muro
  declarado en sentido decreciente.
- La prioridad legacy de traslape se convirtió en una comparación total e independiente del orden
  de `model.elements`.
- El nuevo solver no emitirá `backup`: garantiza los dos perfiles del pilar, incluido el apoyo
  interior del anfitrión T, y conserva derivados legacy hasta regenerar.
- La envolvente OSB L se define con insets firmados de media cara; T no la modifica y el largo
  estructural permanece nominal.
- Las mutaciones de topología deberán invalidar framing/OSB de todos los muros mediante el registro
  central, sin ampliar la invalidación de cerchas.

## Criterios y evidencia

| Criterio | Resultado | Evidencia |
|---|---|---|
| Diagnóstico medido | PASS | 45 muros/90 extremos; 88 flags; 120 matches; 24 paralelos; 4 Z disjuntos; 23 bandas L y 35 T |
| Pilar T medido | PASS | 26 T extremo-cuerpo; 7 apoyos existentes y 19 ausentes (67,3 m antes de recalcular cadenetas) |
| Decisión cerrada | PASS | frame, topología, prioridad, pilar, OSB e invalidación definidos |
| Alcance y exclusiones | PASS | X, tornillos individuales, pieza compartida, checks R7 e informe R8 excluidos |
| Aceptación verificable | PASS | 14 criterios con pruebas, reversión, DXF y smoke CalculiX |
| Cortes transaccionales | PASS | A frame/topología; B pilar/invalidation; C OSB |
| Fuentes primarias | PASS | LP capítulo 4 p.70 y Cintac Anexo IV p.70, URL y consulta declaradas |

## Validación

| Comando | Resultado | Conteo/reporte |
|---|---|---|
| `make governance` | PASS | 20 archivos; 26 requisitos; 23 decisiones |
| `npm run validate` con Node 22 | PASS | 625/625; laboratorio 35/35; build OK |
| Cobertura oficial de core | PASS | 92,33 % de líneas |
| Cobertura oficial del store | PASS | 67,82 % de líneas |
| `npm run verify:migration` | PASS | 187 archivos; 146 idénticos; 41 cambios registrados; 2 fixtures |
| `npm run verify:artifacts` | PASS | 286 archivos inspeccionados |
| `npm run verify:derived` | PASS | 13 exportadores; 14 mutadores |
| Build de producción | PASS | chunk inicial 656,06 kB raw / 202,80 kB gzip |
| Auditoría DXF | No aplica | preparación documental; no se modificaron emisores ni DXF |
| Smoke CalculiX | No aplica | preparación documental; se exige desde R6-B porque cambiarán los montantes exportados |

## Prueba de la prueba

| Fix revertido | Pruebas que fallan |
|---|---:|
| No aplica: esta unidad sólo emite el contrato previo a implementación | 0 |

## Desviaciones y deudas descubiertas

- El roadmap suponía que cambiarían 88 piezas. La medición demuestra que 19 apoyos T deben
  agregarse, siete studs se reclasifican y las cadenetas se vuelven a partir; R6-B fijará el nuevo
  total a partir del solver, no por resta manual.
- `detectWallCorners` incluye hoy 24 coincidencias paralelas y cuatro sin traslape Z. Cinco de sus
  88 extremos marcados no tienen una L/T perpendicular válida.
- La dependencia vecinal reabre R-003: un muro agregado/editado/eliminado puede dejar derivados de
  otros muros falsamente vigentes hasta que R6-B amplíe el registro central.
- `wallOffsetToWorldPoint` contradice el origen `worldMin` del solver; el baseline no lo revela
  porque 0/45 muros de `casa-L` están declarados en sentido decreciente.
- La primera invocación de `npm run validate` heredó Node 20.20.2 del shell y se detuvo al llegar a
  flags de cobertura de Node 22, después de pasar 625/625 y laboratorio 35/35. Se reejecutó
  completa con `nvm use 22` y terminó verde; no fue un fallo de código.
- `validate-governance` aún no recorre `specs/domain/`; la estructura de la spec se verificó
  manualmente y la deuda sigue bajo R-011.
- No hubo cambios de código, modelo, DXF ni INP.

## Documentos actualizados

- [x] `governance/STATUS.md`
- [x] `governance/TRACEABILITY.md`
- [x] `governance/RISKS.md`
- [x] `governance/DECISIONS.md`
- [x] `domain/README.md`
- [x] `specs/domain/README.md`
