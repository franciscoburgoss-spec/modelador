# Instrucciones de trabajo

Estas reglas aplican a toda persona o agente que modifique este repositorio.

## Antes de trabajar

1. Leer `governance/STATUS.md`, `governance/PROTOCOL.md` y la spec activa.
2. Leer `governance/REASONING_EFFORT.md` y confirmar que el esfuerzo efectivo de la sesión coincide
   exactamente con el planificado por la spec activa. Si difiere, detenerse y abrir una ejecución
   nueva mediante `npm run codex:spec -- "…"`.
3. Confirmar que la spec tiene diagnóstico, decisión, ejecución Codex, alcance, exclusiones y
   aceptación verificable.
4. Ejecutar `make governance`.
5. Leer el código y los fixtures afectados antes de proponer cambios.

## Durante

- Una sesión implementa una sola spec o un corte explícito de ella.
- No ampliar alcance al descubrir una deuda: registrarla en `STATUS.md` y `RISKS.md`.
- Los módulos de dominio permanecen puros; React y Tauri sólo coordinan.
- Nunca evaluar texto de usuario como JavaScript ni construir comandos de shell con datos del modelo.
- Nunca descartar datos importados de forma silenciosa.
- Toda mutación que afecte derivados debe invalidarlos de forma centralizada.
- Un exportador no puede omitir silenciosamente geometría ni resultados obsoletos.
- Preservar cambios ajenos y evitar refactors no requeridos por la spec.
- `high` es el techo ordinario. Nunca iniciar en `xhigh`; sólo escalar desde una ejecución `high`
  insuficiente, con evidencia registrada, aprobación explícita del usuario y una sesión nueva.
- `max` está prohibido mientras una decisión posterior no lo habilite.

## Evidencia

- Cada criterio de aceptación debe apuntar a una prueba automática o una inspección reproducible.
- Para cada corrección crítica se demuestra que la prueba falla al revertir el arreglo.
- Los DXF modificados requieren auditoría `ezdxf` con 0 errores y 0 reparaciones.
- Los INP modificados requieren al menos un smoke test real con CalculiX.
- No se cierra una sesión con pruebas, build o trazabilidad pendientes.

## Cierre

Usar `templates/SESSION_CLOSE.md`. Actualizar `STATUS.md`, `TRACEABILITY.md`, `RISKS.md` y
`DECISIONS.md` sólo cuando corresponda. Los cierres son inmutables y no reemplazan el estado.

## Complemento operativo ChatGPT + Codex

Estas reglas complementan las anteriores y no las reemplazan.

### Prioridades adicionales

- Preservar la geometría agnóstica y las fronteras de autoridad del proyecto.
- Trabajar por SPEC y por gates; no ampliar alcance por conveniencia.
- Usar datos reales del proyecto, especialmente FX-008, cuando una SPEC requiera validación de caso real.
- Registrar un BUG o hallazgo antes de corregir un defecto descubierto durante la ejecución.
- Preferir comandos atómicos, cortos, verificables y con salida explícita.

### Inicio cuando no existe SPEC activa

Además de las verificaciones anteriores:

- leer `governance/DECISIONS.md`, `governance/RISKS.md` y `governance/TRACEABILITY.md`;
- confirmar rama, HEAD y working tree mediante Git de sólo lectura;
- confirmar Node `>=22 <23` y npm `>=10 <11` antes de ejecutar gates JavaScript;
- si `governance/STATUS.md` indica `Spec activa = Ninguna`, no inferir ni activar una SPEC por cuenta propia.

### Fases y gates

- Fase A: análisis y contrato. No implementar código productivo salvo prototipos o evidencia explícitamente autorizados.
- Fase B: implementar únicamente después de aprobación explícita de Fase A.
- Correctivas: registrar BUG antes del fix y ejecutar prueba focal, regresión y evidencia cuando corresponda.
- Cierre: validación integral, gobernanza y diff; Codex propone los comandos bloqueados y el
  usuario ejecuta manualmente staging, commit y push después de autorizar cada gate.

La progresión típica de gates es:

1. test focal;
2. regresión de la SPEC;
3. independencia y fronteras;
4. evidencia real determinista;
5. revisión visual humana cuando aplique;
6. `npm run validate`;
7. `make governance`;
8. `git diff --check`;
9. tras el staging manual ejecutado por el usuario, `git diff --cached --check`;
10. revisión final de `git status`;
11. commit y push ejecutados manualmente por el usuario después de autorizar cada gate.

Un gate verde no autoriza automáticamente a ejecutar el siguiente.

### Git

Git de lectura está permitido, incluyendo `status`, `diff`, `log`, `show` y `rev-parse`.

Codex no ejecuta Git de escritura. La prohibición comprende `add`, `commit`, `push`, `pull`,
`merge`, `rebase`, `reset`, `clean`, `checkout`, `restore`, `switch`, `tag`, `stash`,
`cherry-pick`, `revert`, `am` y `apply`.

Una autorización no levanta esta prohibición. Cuando una operación bloqueada sea necesaria, Codex
propone el comando exacto, explica el gate y se detiene; el usuario lo ejecuta manualmente en
Terminal después de autorizar el gate.

Codex tampoco ejecuta `--force`, `--force-with-lease`, `reset --hard` ni `clean -fd`. Si el usuario
considera una de estas operaciones, Codex explica primero su impacto y el usuario decide si la
ejecuta manualmente.

Codex no ejecuta mutaciones de dependencias mediante `npm i`, `npm install`, `npm uninstall`,
`npm remove`, `npm rm`, `npm update`, `npm up` o `npm ci`, ni ejecuta `npx`. Cuando sean
necesarias, propone el comando exacto, explica el gate y se detiene para que el usuario lo ejecute
manualmente después de autorizarlo.

Estas prohibiciones no impiden que Codex inspeccione o edite archivos del workspace ni que ejecute
tests y gates permitidos.

### Arquitectura estructural congelada

Mantener separadas estas capas:

`geometría agnóstica → R0–R5 → structuralIntent → interfaces/relations → proposals/reviews → candidateLoadPaths → R6–R12 → structural requirements → adaptadores constructivos futuros`

- propuestas y caminos candidatos no son autoridad;
- `notVerified` no debe convertirse en verificación implícita;
- una interacción local no convierte automáticamente todo el host en estructural;
- no introducir soluciones constructivas en SPEC-015-E ni en capas anteriores;
- no persistir derivados silenciosamente.

### Revisión de código

Buscar especialmente:

- mutaciones silenciosas de autoridad;
- inferencias estructurales no declaradas;
- fallback geométrico cuando existe una relación explícita stale o inválida;
- pérdida de determinismo o idempotencia;
- IDs técnicos usados como única descripción humana;
- cambios de UI o store fuera del alcance de la SPEC;
- falta de prueba de reversión o independencia cuando una frontera es crítica.

### Colaboración con ChatGPT

Cuando exista una ambigüedad de contrato, semántica estructural, representación visual o alcance de SPEC, detener la implementación y producir un resumen de decisión para revisar con ChatGPT antes de continuar.

Consultar `docs/CODEX_WORKFLOW.md` para el procedimiento detallado.
