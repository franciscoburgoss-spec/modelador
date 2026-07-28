# Cierre — SPEC-004-D1 / render del frontend en macOS 11

> Documento inmutable después de cerrar.

## Identidad

| Campo | Valor |
|---|---|
| Fecha | 28-jul-2026 |
| Commit | `0f04c111e6ba7af2373a6b029028a7f33149c55c` |
| Spec | `specs/SPEC-004-D1-macos11-webview-render.md` |
| Toolchain | Node 22.23.1; Rust/Cargo 1.97.1 x86_64; Tauri CLI 2.11.4; Tauri 2.0.2; tauri-runtime/tauri-runtime-wry 2.0.1; Wry 0.44.1; macOS 11.7.11 x86_64 |

## Alcance ejecutado

Se corrigió el fallo previo al primer render causado por una API ausente en el WebView de macOS
11. Las consultas de propiedades propias usan una frontera compatible y el arranque muestra un
mensaje seguro si otro error vuelve a impedir cargar React. El corte no cambia dominio, modelo,
persistencia, geometría, DXF, INP, permisos Tauri, dependencias ni versiones de runtime.

## Cambios

- `src/core/hasOwn.js` centraliza `Object.prototype.hasOwnProperty.call` y cubre objetos normales,
  prototipo nulo, sombras de `hasOwnProperty` y claves `Symbol`.
- Las 47 invocaciones productivas de `Object.hasOwn` se sustituyeron en doce módulos de core y
  store. Una prueba recorre recursivamente todo `src/` para impedir regresiones en archivos nuevos.
- `index.html` ofrece un estado de carga visible e instala `src/bootGuard.js` antes de
  `main.jsx`. Errores o rechazos no manejados previos al render se presentan mediante
  `textContent`, sin evaluar ni transmitir sus datos.
- React marca el primer render exitoso y retira la guarda; un error tardío no reemplaza una
  aplicación ya operativa.
- La documentación exige activar `.nvmrc` y define el smoke por contenido reconocible, no por una
  ventana o proceso meramente vivos.

## Criterios y evidencia

| Criterio | Resultado | Evidencia |
|---|---|---|
| Reglas ejecutan sin `Object.hasOwn` | PASS | `webviewCompatibility.test.mjs`: importación y regla `osb.tornillo.borde` con el built-in ausente |
| Helper cubre propiedad propia/heredada y casos especiales | PASS | prueba pura con prototipo nulo, sombra y `Symbol` |
| Producción no contiene la API incompatible | PASS | inspección recursiva automática de JS/JSX/TS/TSX bajo `src/` |
| Bootstrap fallido es visible y seguro; render normal prevalece | PASS | dos pruebas DOM de `bootGuard.js` |
| Localhost y componentes conservan comportamiento | PASS | 770 Node y 18 componentes |
| Seguridad Tauri no cambia | PASS | 9 Rust; exactamente nueve comandos, CSP local y ninguna capability nueva |
| Entorno Node 22 reproducible | PASS | `make doctor` con `.nvmrc`: 0 fallos, 0 advertencias |
| Contenido real en macOS 11 | PASS | barra de menú, selector de vista y lienzo visibles durante más de 30 s con `npm run tauri:dev -- --no-watch` |
| Puertas integrales heredadas | PASS | `make governance` y `npm run validate` sobre `0f04c111e6ba`; DXF 0/0 y CCX 3/3 |

## Validación

| Comando | Resultado | Conteo/reporte |
|---|---|---|
| `make doctor` | PASS | macOS 11.7.11 x86_64; Node 22.23.1; Rust 1.97.1; CCX 2.23; ezdxf 1.4.4; 0 fallos y 0 advertencias |
| `make governance` | PASS | 20 archivos requeridos, 29 requisitos y 42 decisiones |
| `npm run validate` | PASS | 770 Node; 18 componentes; 9 Rust; 35 lab; core 93,39 %; store 96,97 %; 18 goldens; DXF 9 archivos/8 familias, 0 errores y 0 reparaciones; CCX 3/3; build; migración 187 verificados (132 idénticos, 55 registrados, 2 fixtures) |
| `npm run tauri:dev -- --no-watch` | PASS | aplicación completa visible >30 s en macOS 11.7.11 x86_64, sin error de bootstrap |
| E2E externo | PASS | [run 30403943338](https://github.com/franciscoburgoss-spec/modelador/actions/runs/30403943338), 1/1 en 2,4 s; reporte JSON/HTML por `f78c8404e5b9` |
| Auditoría DXF | PASS | `artifacts/0f04c111e6ba/audit-dxf.json`: ezdxf 1.4.4, 0 errores / 0 reparaciones |
| Smoke CalculiX | PASS | `artifacts/0f04c111e6ba/smoke-ccx.json`: CCX 2.23, 3/3 jobs, 1.486 nodos y 8.649 valores finitos |

## Prueba de la prueba

| Fix revertido | Pruebas que fallan |
|---|---:|
| Una consulta de `domainRules.js` volvió temporalmente a `Object.hasOwn` | inspección recursiva y ejecución sin built-in, 2/5 |

Antes del arreglo, el nuevo archivo de regresión falló 2/2: enumeró los doce módulos
incompatibles y reprodujo `TypeError: Object.hasOwn is not a function` en la ruta de reglas.

## Desviaciones y deudas descubiertas

- Los smokes de C1/D probaron ventana y proceso vivos, pero aceptaron un falso positivo blanco.
  D-042 los reemplaza por una inspección de contenido reconocible.
- La terminal del usuario conservaba Node 20.20.2 aunque `.nvmrc` fijaba 22.23.1. No era la causa
  de la ventana blanca; `nvm use` corrige el entorno y queda documentado.
- La captura visual temporal no se versiona. La inspección es reproducible con el comando de
  Tauri y los tres marcadores visibles enumerados en el criterio.
- El chunk inicial creció a 728,17 kB raw / 226,81 kB gzip y conserva el warning mayor a 600 kB;
  sigue acotado a `SPEC-005`.
- La línea compatible con macOS 11 mantiene el aviso futuro de `block` 0.1.6 bajo R-009.
- Actions conserva el aviso ya registrado bajo R-011: sus acciones oficiales v4 declaran Node 20
  y el runner las fuerza a Node 24. El E2E terminó verde y sin reintentos.
- El smoke se terminó con `Ctrl-C`; el marcador de sesión interrumpida resultante es esperado y
  no implica un snapshot sucio.

## Documentos actualizados

- [x] `governance/STATUS.md`
- [x] `governance/TRACEABILITY.md`
- [x] `governance/RISKS.md`
- [x] `governance/DECISIONS.md`, decisión D-042
