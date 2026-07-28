# Registro de riesgos

Escala: probabilidad e impacto de 1 a 5. Exposición = probabilidad x impacto.

| ID | Riesgo | P | I | Exp. | Mitigación / gate | Estado |
|---|---|---:|---:|---:|---|---|
| R-001 | Ejecución de código desde fórmulas | 5 | 5 | 25 | Parser AST cerrado; corpus adversario y reversión; G2 | Mitigado |
| R-002 | Pérdida de techumbre al importar legacy | 5 | 5 | 25 | Esquema, migración y roundtrip `casa-L`; G2 | Mitigado |
| R-003 | Exportar derivados obsoletos como válidos | 4 | 5 | 20 | Registro central, dependencia vecinal L/T y hard gate cubren framing, OSB y cerchas con alcance probado; G3/G4 | Mitigado |
| R-004 | Corrupción por guardado interrumpido | 3 | 5 | 15 | Escritura atómica, backups y ensayo de kill; G6 | Abierto |
| R-005 | Reglas constructivas incompletas producen planos incorrectos | 4 | 4 | 16 | R3–R8 cerrados; R8-C prueba cuatro variantes A3 con DXF 0/0. `SPEC-003-B` fijará goldens y `audit:dxf` para ocho familias de referencia antes de cerrar G4 | Abierto |
| R-006 | Fixture duplicado oculta regresiones geométricas | 5 | 4 | 20 | `SPEC-003-A` exige FX-003/FX-004 distintos entre sí y de `casa-L`, manifiesto, esquema e invariantes; G4 | Abierto |
| R-007 | INP sintácticamente válido pero estructuralmente inválido | 3 | 5 | 15 | R6-B terminó sólo tras acortar IDs; `SPEC-003-C` ejecutará global/cercha/fundación con IDs persistidos y parser finito, corrigiendo el contrato `ELSET` antes de G5 | Abierto |
| R-008 | Permisos Tauri demasiado amplios | 3 | 5 | 15 | Capabilities mínimas, CSP y revisión; G6 | Abierto |
| R-009 | Dependencia de macOS fuera de soporte | 5 | 4 | 20 | Offline, mínimo privilegio y riesgo aceptado; renovar hardware para eliminar | Aceptado |
| R-010 | Rendimiento insuficiente en 8 GB/CPU dual core | 4 | 3 | 12 | Presupuestos medidos, lazy loading y perfiles; G7 | Abierto |
| R-011 | Herramientas no reproducibles entre sesiones | 4 | 4 | 16 | Node fijado; `SPEC-003-B` fijará `ezdxf` fuera del Python global y `SPEC-003-C` registrará CCX; gobernanza aún debe recorrer `specs/domain/`; G0/G1 | Abierto |
| R-012 | Errores sólo visibles en consola | 4 | 3 | 12 | Error boundary, mensajes accionables y log local; G7 | Abierto |
| R-013 | Integrar o redistribuir CCX sin revisar licencia/dependencias | 2 | 4 | 8 | v1 usa ruta instalada; auditoría antes de bundling | Abierto |
| R-014 | Cambios heredados se pierden durante la migración | 3 | 5 | 15 | 187 hashes verificados contra origen; SPEC-000 | Mitigado |
| R-015 | Cobertura insuficiente del store oculta mutadores sin contrato | 4 | 3 | 12 | Baseline 72,76 %; `SPEC-003-D` cubre acciones observables y sube el gate a 85 % sin exponer helpers; G4 | Abierto |
| R-016 | Dependencias incompletas de hooks producen UI con estado obsoleto | 3 | 3 | 9 | Baseline acotado a cinco archivos y pruebas UI; SPEC-005/G7 | Abierto |

## Política

- Exposición 20–25: bloquea cualquier release y se revisa en cada sesión.
- Exposición 12–19: debe tener dueño, spec y gate antes de entrar a release candidate.
- Exposición menor a 12: puede aceptarse sólo mediante una decisión explícita.
