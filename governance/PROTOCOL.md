# Protocolo de implementación

## Autoridad documental

Cada dato tiene un dueño:

| Documento | Contenido | Política |
|---|---|---|
| `STATUS.md` | estado, spec activa y bloqueos | se actualiza en cada cierre |
| `TRACEABILITY.md` | requisito a evidencia | se actualiza con cada spec |
| `RISKS.md` | exposición y mitigación | revisar en cada cambio de fase |
| `DECISIONS.md` | decisiones estables | append-only |
| `REASONING_EFFORT.md` | matriz y reglas de esfuerzo de Codex | se revisa antes de abrir cada spec |
| `specs/*.md` | contrato de una unidad de trabajo | inmutable al comenzar |
| `sessions/*.md` | evidencia de una sesión | inmutable al cerrar |

Si existe contradicción, manda `STATUS.md` para el estado, `DECISIONS.md` para el porqué y la spec
activa para el alcance.

## Apertura

1. Leer estado, riesgos vinculados, `REASONING_EFFORT.md` y spec activa.
2. Confirmar que la spec declara `low`, `medium` o `high` y registrar en `STATUS.md` el esfuerzo
   efectivo de la sesión.
3. Si esfuerzo planificado y efectivo difieren, detenerse y relanzar la tarea con el override o
   perfil correcto.
4. Ejecutar `make governance`.
5. Confirmar baseline de suite, build y artefactos.
6. Crear una rama con nombre `spec/<id>-<resumen>`.
7. Registrar cualquier desviación previa antes de editar.

Las ejecuciones nuevas se abren con `npm run codex:dry-run -- "…"` y después
`npm run codex:spec -- "…"`. El lanzador es la frontera oficial para enviar el esfuerzo al CLI y
`governance/CODEX_EXECUTIONS.jsonl` conserva la comparación append-only con el cierre. No se editan
ni eliminan eventos para hacer pasar la auditoría.

`xhigh` no es un nivel inicial. Sólo puede abrirse como una ejecución nueva después de documentar
la insuficiencia de `high` y obtener aprobación explícita del usuario. `max` está prohibido.

## Reglas de alcance

- La spec define qué entra y qué queda fuera.
- Una decisión pendiente bloquea la implementación; no se resuelve implícitamente en código.
- Una deuda descubierta se registra, pero no amplía la sesión.
- Cambios de formato persistido siempre incluyen migración y fixture de la versión anterior.
- Cambios compartidos de store requieren pruebas de contrato de todos los mutadores afectados.

## Secuencia técnica

1. Capturar o añadir una prueba que demuestre el fallo.
2. Implementar primero el módulo puro o el contrato de datos.
3. Integrar store y adaptadores.
4. Integrar UI al final.
5. Ejecutar pruebas enfocadas, después suite completa, build y arneses de formato.
6. Demostrar que al revertir el arreglo la prueba relevante falla.

## Puertas de cierre

- Todos los criterios de la spec tienen evidencia.
- El cierre registra esfuerzo planificado, efectivo y escalamiento; cualquier `xhigh` cita la
  evidencia previa y la aprobación del usuario.
- `npm run validate` termina con código 0.
- DXF tocado: `ezdxf doc.audit()` = 0 errores / 0 reparaciones.
- INP tocado: smoke test real de CalculiX y parser de resultados.
- Sin warnings nuevos aceptados por silencio.
- `TRACEABILITY.md`, `RISKS.md` y `STATUS.md` están al día.
- Cierre generado desde `templates/SESSION_CLOSE.md`.

## Control de cambios

Una spec iniciada no se reescribe para coincidir con la implementación. Si el diagnóstico cambia:

1. detener el trabajo;
2. registrar evidencia;
3. crear una decisión si corresponde;
4. cerrar el corte como incompleto o sustituido;
5. emitir una spec nueva que cite a la anterior.

## Release

Sólo una versión que supere todos los gates `G0` a `G8` puede etiquetarse. El tag apunta al commit
probado y los artefactos registran commit, Node, Rust, Tauri, CalculiX y macOS usados.
