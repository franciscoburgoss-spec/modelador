# Registro de riesgos

Escala: probabilidad e impacto de 1 a 5. Exposición = probabilidad x impacto.

| ID | Riesgo | P | I | Exp. | Mitigación / gate | Estado |
|---|---|---:|---:|---:|---|---|
| R-001 | Ejecución de código desde fórmulas | 5 | 5 | 25 | Parser AST cerrado; corpus adversario y reversión; G2 | Mitigado |
| R-002 | Pérdida de techumbre al importar legacy | 5 | 5 | 25 | Esquema, migración y roundtrip `casa-L`; G2 | Mitigado |
| R-003 | Exportar derivados obsoletos como válidos | 4 | 5 | 20 | Registro central, dependencia vecinal L/T y hard gate cubren framing, OSB y cerchas con alcance probado; G3/G4 | Mitigado |
| R-004 | Corrupción por guardado interrumpido | 3 | 5 | 15 | A fija temporal+fsync+rename, diez backups y kill; B agrega commit transaccional; C1 adopta el contrato en Rust; D agrega snapshot privado y atómico, marcador crash/cierre limpio, validación transaccional y errores visibles sin tocar el original; G6 | Mitigado |
| R-005 | Reglas constructivas incompletas producen planos incorrectos | 4 | 4 | 16 | R3–R8 cerrados; goldens semánticos y `audit:dxf` cubren 9 archivos de las 8 familias con 0 errores / 0 reparaciones; findings constructivos pendientes siguen abiertos antes de G4 | Abierto |
| R-006 | Fixture duplicado oculta regresiones geométricas | 5 | 4 | 20 | FX-003/FX-004 difieren entre sí y de `casa-L`; manifiesto, esquema, perfiles, vanos, bounds y roundtrip quedan automatizados en `fixtureManifest.test.mjs` | Mitigado |
| R-007 | INP sintácticamente válido pero estructuralmente inválido | 3 | 5 | 15 | C2 compacta sets, resuelve secciones, homogeneiza U1 y ejecuta global/cercha/fundaciones con CCX 2.23; parser exacto valida 1.486 nodos y 8.649 valores finitos, y sólo permite el warning global gobernado; G5 | Mitigado |
| R-008 | Permisos Tauri demasiado amplios | 3 | 5 | 15 | C1/D verifican exactamente nueve comandos autorizados, capability `main` y CSP local sin shell/fs/HTTP/opener; el smoke nativo y E2E pasan. La futura ejecución de CCX debe conservar este gate; G6 | En mitigación |
| R-009 | Dependencia de macOS fuera de soporte | 5 | 4 | 20 | C reprodujo panic de Tauri 2.11 y C1 también con Wry 0.48; C1 fija Tauri 2.0.2/runtimes 2.0.1/Wry 0.44.1. D1 reemplaza el falso positivo de ventana viva por contenido reconocible y bloquea built-ins JS ausentes. Cada actualización exige repetir ese smoke. La línea arrastra el aviso futuro de `block` 0.1.6; renovar runtime/toolchain o hardware para eliminar | Aceptado |
| R-010 | Rendimiento insuficiente en 8 GB/CPU dual core | 4 | 3 | 12 | Presupuestos medidos, lazy loading y perfiles; G7 | Abierto |
| R-011 | Herramientas no reproducibles entre sesiones | 4 | 4 | 16 | Node, Playwright y `ezdxf` quedan fijados; `validate` integra goldens, DXF y CCX localmente, y Actions registra E2E por SHA. Pendientes: recorrer `specs/domain/` y actualizar acciones oficiales cuyo runtime Node 20 es forzado a 24; G0/G1 | Abierto |
| R-012 | Errores sólo visibles en consola | 4 | 3 | 12 | SPEC-003-D cubre fallos críticos; R5-D hace visibles y resolubles en lote los muros sin rol; D1 convierte fallos previos al render en feedback visible y escapado. Error boundary de componentes y log local siguen en SPEC-005/G7 | Abierto |
| R-013 | Integrar o redistribuir CCX sin revisar licencia/dependencias | 2 | 4 | 8 | v1 usa ruta instalada; auditoría antes de bundling | Abierto |
| R-014 | Cambios heredados se pierden durante la migración | 3 | 5 | 15 | 187 hashes verificados contra origen; SPEC-000 | Mitigado |
| R-015 | Cobertura insuficiente del store oculta mutadores sin contrato | 4 | 3 | 12 | SPEC-003-D cubre contratos observables, componentes críticos y fija gates core/store 90/85; cobertura 93,55/97,85; G4 | Mitigado |
| R-016 | Dependencias incompletas de hooks producen UI con estado obsoleto | 3 | 3 | 9 | Baseline acotado a cinco archivos y pruebas UI; SPEC-005/G7 | Abierto |
| R-017 | Un `roofPlane` incompleto puede romper el pipeline antes de devolver un resultado no resuelto | 3 | 4 | 12 | `model-v1-dual-roof` reproduce el acceso TDZ de `resolveRoofPlane.fail`; requiere corte explícito con regresión antes de G4, sin ampliar SPEC-003-A | Abierto |
| R-018 | Un DXF válido sintácticamente puede recortar u ocultar información necesaria para ejecutar la obra | 4 | 5 | 20 | R9-A bloquea recortes/overflow y audita 10 láminas A1/A3 con fallas técnicas 0; R9-B/R9-C resolverán colisiones y composición por familia antes de liberar planos | En mitigación |

## Política

- Exposición 20–25: bloquea cualquier release y se revisa en cada sesión.
- Exposición 12–19: debe tener dueño, spec y gate antes de entrar a release candidate.
- Exposición menor a 12: puede aceptarse sólo mediante una decisión explícita.
