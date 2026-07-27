# Puertas de calidad

| Gate | Momento | Condición de aprobación |
|---|---|---|
| G0 Gobernanza | toda sesión | validador documental verde; spec y trazabilidad completas |
| G1 Reproducibilidad | fin fase 0 | clon limpio, `npm ci`, suite y build sin pasos manuales |
| G2 Seguridad de modelo | fin fase 1 | exploit bloqueado; import inválido no muta; roundtrip legacy sin pérdida |
| G3 Derivados | fin fase 1 | todos los mutadores invalidan; ninguna salida estructural stale |
| G4 Dominio y formatos | fin fase 2 | dos fixtures independientes; JSON/DXF/CSV/INP auditados |
| G5 Cálculo | fin fase 2/4 | CCX ejecuta muestras, converge y resultados pasan parser |
| G6 Persistencia nativa | fin fase 4 | guardado atómico, recuperación, permisos y app instalada |
| G7 UX y rendimiento | fin fase 5 | errores accionables y presupuestos medidos en el Mac objetivo |
| G8 Release | fin fase 6 | todos los gates verdes, backup restaurado y tag reproducible |

## Comando único

La fase 0 debe proporcionar:

```bash
npm run validate
```

Su contrato mínimo será `format:check`, `lint`, tests, coverage con umbrales, build y validadores de
artefactos que no requieran interacción.

## Pruebas por riesgo

| Riesgo | Nivel mínimo |
|---|---|
| Parser, migraciones e invalidación | unitarias + integración del store + regresión |
| Importación y persistencia | integración con filesystem temporal + recuperación |
| DXF | golden semántico + `ezdxf doc.audit()` |
| INP/CalculiX | contrato de exportador + proceso real + parser |
| Tauri | pruebas de comando Rust + smoke instalado |
| Flujos UI críticos | componentes + E2E actual en plataforma soportada |

## Definición de terminado

Un cambio está terminado cuando el código, pruebas, documentación y evidencia están en el mismo
commit; no quedan logs accidentales; los mensajes de error son visibles; no hay supresiones sin
justificación; y la reversión de cada fix crítico hace fallar su prueba.

