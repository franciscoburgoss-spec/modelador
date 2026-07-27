# Instrucciones de trabajo

Estas reglas aplican a toda persona o agente que modifique este repositorio.

## Antes de trabajar

1. Leer `governance/STATUS.md`, `governance/PROTOCOL.md` y la spec activa.
2. Confirmar que la spec tiene diagnóstico, decisión, alcance, exclusiones y aceptación verificable.
3. Ejecutar `make governance`.
4. Leer el código y los fixtures afectados antes de proponer cambios.

## Durante

- Una sesión implementa una sola spec o un corte explícito de ella.
- No ampliar alcance al descubrir una deuda: registrarla en `STATUS.md` y `RISKS.md`.
- Los módulos de dominio permanecen puros; React y Tauri sólo coordinan.
- Nunca evaluar texto de usuario como JavaScript ni construir comandos de shell con datos del modelo.
- Nunca descartar datos importados de forma silenciosa.
- Toda mutación que afecte derivados debe invalidarlos de forma centralizada.
- Un exportador no puede omitir silenciosamente geometría ni resultados obsoletos.
- Preservar cambios ajenos y evitar refactors no requeridos por la spec.

## Evidencia

- Cada criterio de aceptación debe apuntar a una prueba automática o una inspección reproducible.
- Para cada corrección crítica se demuestra que la prueba falla al revertir el arreglo.
- Los DXF modificados requieren auditoría `ezdxf` con 0 errores y 0 reparaciones.
- Los INP modificados requieren al menos un smoke test real con CalculiX.
- No se cierra una sesión con pruebas, build o trazabilidad pendientes.

## Cierre

Usar `templates/SESSION_CLOSE.md`. Actualizar `STATUS.md`, `TRACEABILITY.md`, `RISKS.md` y
`DECISIONS.md` sólo cuando corresponda. Los cierres son inmutables y no reemplazan el estado.

