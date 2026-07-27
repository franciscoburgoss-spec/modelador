# Cierre — SPEC-R5 / corte A

> Documento inmutable después de cerrar.

## Identidad

| Campo | Valor |
|---|---|
| Fecha | 27-jul-2026 |
| Commit | commit que contiene este cierre |
| Spec | `SPEC-R5-wall-types.md`, corte A |
| Toolchain | macOS 11.7.11 x86_64; Node 22.23.1; npm 10.9.8; Vite 5.4.21 |

## Alcance ejecutado

Se cerró exclusivamente el contrato puro de roles y tipos, la aplicación explícita de reglas, la
resolución efectiva y la migración a `modelVersion` 2. No se implementaron CRUD, asignación,
invalidación, split/merge, adopción por consumidores ni UI; esos trabajos permanecen en R5-B/C.

## Cambios

- `wallTypes.js` valida IDs/nombres, los cuatro roles exactos, defaults completos, piso OSB y
  referencias C/U; resuelve configuración tipada o legacy sin mutar ni descartar datos.
- Cada override divergente de un muro tipado se ignora para el cálculo y produce un finding
  canónico `info`/`wallType` con `wallIds`. Una referencia rota falla en vez de caer a legacy.
- El vocabulario mínimo vive en `wallRoles.js`, separado para evitar el ciclo
  `domainRules → wallTypes → domainFindings`; sólo `tabique` admite rotación OSB.
- Las tres reglas declaran `aplicaA` inmutable y `ruleAppliesToRole` usa pertenencia exacta, sin
  orden ni herencia.
- `modelSchema.js` migra secuencialmente `0→1→2`, exige `wallTypes`, valida sus referencias y
  prohíbe una segunda autoridad `wall.role`.
- El fixture v1 conserva dos series 90/60, defaults, overrides, derivados y geometría sin inferir
  tipos ni roles; su roundtrip es idempotente.
- Los dos constructores de modelo del store inicializan `wallTypes: []` para producir un modelo v2
  válido. No se agregaron acciones ni mutadores.

## Criterios y evidencia

| Criterio | Resultado | Evidencia |
|---|---|---|
| 1. Contrato de roles/tipos | PASS | cuatro roles exactos; casos adversarios de shape, defaults, finitos, mínimo, IDs y perfiles |
| 2. Tipo como única autoridad | PASS | siete overrides divergentes producen siete findings navegables sin alterar la configuración |
| 3. Compatibilidad sin tipo | PASS | precedencia muro → proyecto → histórica y `wallRole` info; rol ausente no satisface reglas |
| 4. Esquema y migración v2 | PASS | recorridos `0→1→2` y `1→2`, pureza, idempotencia, roundtrip y referencias rotas |
| 5. `aplicaA` exacto | PASS | MP1 recibe las dos reglas OSB; MP2 no hereda; holgura aplica a los cuatro roles |
| 12. Prueba de la prueba A | PASS | quitar `1→2` provoca 6 fallos de 12 en esquema/importación |
| 13. Puertas oficiales | PASS | gobernanza, 608/608, laboratorio, cobertura y build aprobados |

Los criterios 6–11 corresponden expresamente a los cortes R5-B/C y permanecen abiertos.

## Validación

| Comando | Resultado | Conteo/reporte |
|---|---|---|
| `make governance` | PASS | 20 archivos; 26 requisitos; 20 decisiones |
| Pruebas focalizadas R5-A | PASS | 25/25 en tipos, reglas, esquema e importación |
| `npm run validate` con Node 22 | PASS | 608/608; laboratorio 35/35; build OK |
| Cobertura oficial de core | PASS | 91,42 % de líneas |
| Cobertura de `wallTypes.js` | PASS | 97,47 % de líneas; 100 % de funciones |
| Cobertura oficial del store | PASS | 63,15 % de líneas |
| `npm run verify:migration` | PASS | 187 archivos; 153 idénticos; 34 cambios registrados; 2 fixtures |
| `npm run verify:artifacts` | PASS | 278 archivos inspeccionados |
| `npm run verify:derived` | PASS | 13 exportadores; 12 mutadores |
| Build de producción | PASS | chunk inicial 643,54 kB raw / 199,39 kB gzip |
| Advertencias locales | PASS | `warnings.push` permanece en 51 |
| Auditoría DXF | No aplica | el corte A no modifica emisores ni archivos DXF |
| Smoke CalculiX | No aplica | el corte A no modifica emisores ni archivos INP |

## Prueba de la prueba

| Fix revertido | Pruebas que fallan |
|---|---:|
| Entrada `1→2` omitida temporalmente del mapa de migraciones | 6/12 |

Restaurada la entrada, las 25/25 pruebas focalizadas vuelven a pasar antes de la validación
integral.

## Desviaciones y deudas descubiertas

- La prohibición sugerida de “no tocar store” se ajustó únicamente en dos inicializadores:
  elevar `CURRENT_MODEL_VERSION` a 2 sin `wallTypes: []` creaba modelos nuevos inválidos. No se
  adelantó ninguna acción de R5-B.
- El manifiesto registra `useModelStore.js` bajo `SPEC-R5` conservando su hash de origen. La
  limitación de `--record` con `SPEC-Rn` permanece bajo R-011; su regex se amplió temporalmente y se
  restauró sin diff final.
- El chunk inicial aumenta 3,81 kB raw / 1,02 kB gzip respecto de R4-C; el warning existente
  continúa bajo R-010 / `SPEC-005`.
- `validate-governance` aún no recorre `specs/domain/`; la revisión manual exigida por R-011 se
  realizó antes de implementar.
- No hubo decisiones nuevas ni deuda de dominio adicional. El siguiente corte es R5-B.

## Documentos actualizados

- [x] `governance/STATUS.md`
- [x] `governance/TRACEABILITY.md`
- [x] `governance/RISKS.md`
- [x] `specs/domain/README.md`
- [ ] `governance/DECISIONS.md`, no hubo una decisión nueva
