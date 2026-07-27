# Registro de riesgos

Escala: probabilidad e impacto de 1 a 5. Exposición = probabilidad x impacto.

| ID | Riesgo | P | I | Exp. | Mitigación / gate | Estado |
|---|---|---:|---:|---:|---|---|
| R-001 | Ejecución de código desde fórmulas | 5 | 5 | 25 | Parser AST cerrado; pruebas de payloads; G2 | Abierto |
| R-002 | Pérdida de techumbre al importar legacy | 5 | 5 | 25 | Esquema, migración y roundtrip; G2 | Abierto |
| R-003 | Exportar derivados obsoletos como válidos | 4 | 5 | 20 | Registro central de invalidación y hard gate; G3 | Abierto |
| R-004 | Corrupción por guardado interrumpido | 3 | 5 | 15 | Escritura atómica, backups y ensayo de kill; G6 | Abierto |
| R-005 | Reglas constructivas incompletas producen planos incorrectos | 4 | 4 | 16 | R3–R8, catálogo y fixtures independientes; G4 | Abierto |
| R-006 | Fixture duplicado oculta regresiones geométricas | 5 | 4 | 20 | Fixture con planta y perfiles distintos; G4 | Abierto |
| R-007 | INP sintácticamente válido pero estructuralmente inválido | 3 | 5 | 15 | Validación previa y smoke CCX; G5 | Abierto |
| R-008 | Permisos Tauri demasiado amplios | 3 | 5 | 15 | Capabilities mínimas, CSP y revisión; G6 | Abierto |
| R-009 | Dependencia de macOS fuera de soporte | 5 | 4 | 20 | Offline, mínimo privilegio y riesgo aceptado; renovar hardware para eliminar | Aceptado |
| R-010 | Rendimiento insuficiente en 8 GB/CPU dual core | 4 | 3 | 12 | Presupuestos medidos, lazy loading y perfiles; G7 | Abierto |
| R-011 | Herramientas no reproducibles entre sesiones | 4 | 4 | 16 | Node/Rust/Python fijados y doctor; G0/G1 | Abierto |
| R-012 | Errores sólo visibles en consola | 4 | 3 | 12 | Error boundary, mensajes accionables y log local; G7 | Abierto |
| R-013 | Integrar o redistribuir CCX sin revisar licencia/dependencias | 2 | 4 | 8 | v1 usa ruta instalada; auditoría antes de bundling | Abierto |
| R-014 | Cambios heredados se pierden durante la migración | 3 | 5 | 15 | 187 hashes verificados contra origen; SPEC-000 | Mitigado |
| R-015 | Cobertura insuficiente del store oculta mutadores sin contrato | 4 | 3 | 12 | Piso 50 %, objetivo 85 %, contratos por acción; SPEC-003/G4 | Abierto |
| R-016 | Dependencias incompletas de hooks producen UI con estado obsoleto | 3 | 3 | 9 | Baseline acotado a cinco archivos y pruebas UI; SPEC-005/G7 | Abierto |

## Política

- Exposición 20–25: bloquea cualquier release y se revisa en cada sesión.
- Exposición 12–19: debe tener dueño, spec y gate antes de entrar a release candidate.
- Exposición menor a 12: puede aceptarse sólo mediante una decisión explícita.
