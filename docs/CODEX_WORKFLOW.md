# CODEX_WORKFLOW — Modelador Propio

## 1. Principio

Codex es ejecutor e inspector directo del repositorio, no autoridad para cambiar el alcance del proyecto. Las decisiones de arquitectura, contrato estructural, representación y apertura/cierre de SPEC siguen siendo humanas y auditables.

## 2. Apertura de sesión — Gate 0

Codex debe comenzar con lectura, no edición:

1. `git status -sb`
2. `git rev-parse --short HEAD`
3. `git branch --show-current`
4. leer `governance/STATUS.md`;
5. leer `governance/DECISIONS.md`, `RISKS.md`, `TRACEABILITY.md`;
6. `node -v` y `npm -v`;
7. identificar la SPEC activa exactamente desde STATUS.

Si el working tree no está limpio cuando se esperaba limpio, detenerse y reportar. No limpiar ni descartar cambios.

## 3. Fase A — análisis antes de implementar

Cuando se abra una SPEC:

- congelar baseline de entrada;
- inspeccionar contratos y dependencias reales;
- aplicar la SPEC al caso real antes de aprobarla;
- visualizar paso a paso el flujo esperado;
- detectar contradicciones, ambigüedades y puntos no verificables;
- registrar hallazgos/BUGS antes de corregirlos;
- definir invariantes, exclusiones, persistencia, stale, determinismo, undo/redo, trace y fronteras estáticas;
- definir pruebas focales y prueba de la prueba;
- no implementar la Fase B hasta recibir aprobación explícita.

## 4. Fase B — implementación

Para cada corte B1/B2/...:

1. declarar alcance exacto;
2. implementar el mínimo cambio que satisface el contrato;
3. ejecutar tests focales;
4. corregir sólo fallos dentro del alcance;
5. ejecutar regresión relacionada;
6. verificar independencia y ausencia de autoridad nueva;
7. producir evidencia determinista real cuando la SPEC lo requiera;
8. pedir revisión visual humana si la salida es gráfica o geométrica.

## 5. Correctivas

Ante un defecto descubierto:

1. no editar inmediatamente;
2. registrar `BUG-...` con síntoma, impacto, causa o hipótesis y gate que bloquea;
3. trazar el origen exacto;
4. corregir de forma quirúrgica;
5. añadir/ajustar una prueba que hubiera detectado el bug;
6. pasar test focal;
7. pasar regresión del corte;
8. actualizar evidencia/documentación si cambió una representación o contrato.

## 6. Validación final

Orden recomendado:

- focal consolidado de la SPEC;
- `npm run validate`;
- `npm run format:check` si se agregaron documentos después del validate integral;
- `make governance`;
- `git diff --check`;
- `git status --short`;
- revisión humana del alcance;
- Codex propone el comando de staging y se detiene; el usuario lo ejecuta manualmente tras
  autorizar ese gate;
- `git diff --cached --check`;
- `git diff --cached --stat`;
- Codex propone el comando de commit y se detiene; el usuario lo ejecuta manualmente tras
  autorizar ese gate;
- verificar `git show --stat --oneline --summary HEAD` y working tree;
- Codex propone el comando de push y se detiene; el usuario lo ejecuta manualmente tras autorizar
  ese gate;
- `git status -sb` final.

Codex no ejecuta los subcomandos Git bloqueados: `add`, `commit`, `push`, `pull`, `merge`, `rebase`,
`reset`, `clean`, `checkout`, `restore`, `switch`, `tag`, `stash`, `cherry-pick`, `revert`, `am`
y `apply`. La autorización habilita el gate manual, pero no permite su ejecución por Codex.

## 7. División ChatGPT ↔ Codex

### ChatGPT gobierna mejor

- interpretación y comparación de SPEC;
- decisiones semánticas estructurales;
- análisis de arquitectura y autoridad;
- diseño de evidencia y revisión visual;
- resolución de ambigüedades;
- preparación de nuevos cortes y handoffs.

### Codex ejecuta mejor

- búsqueda transversal en el repo;
- implementación y refactors acotados;
- ejecución de tests y diagnósticos;
- generación/reproducción de evidencia local;
- auditorías estáticas;
- revisión de cambios antes de staging.

### Regla de handoff

Codex debe detenerse y devolver a ChatGPT cuando encuentre una decisión que cambie:

- el contrato persistente;
- la definición de una autoridad;
- el significado estructural de una región/relación;
- el alcance de la SPEC;
- la representación técnica que necesita juicio humano;
- una incompatibilidad entre SPECs.

ChatGPT devuelve a Codex una decisión congelada, criterios de aceptación y gates concretos.

## 8. Worktrees y paralelismo

No usar worktrees Codex como modo predeterminado hasta que la gobernanza del proyecto defina explícitamente cómo se auditan baseline, HEAD, artifacts y cierre entre worktrees. Para el flujo normal, trabajar en el repo local principal con sandbox y aprobaciones.

## 9. Red y dependencias

El proyecto usa `network_access = false` por defecto en workspace-write. Si una tarea necesita
documentación actual, preferir investigación separada en ChatGPT o solicitar autorización puntual.

Codex no ejecuta mutaciones de dependencias mediante `npm i`, `npm install`, `npm uninstall`,
`npm remove`, `npm rm`, `npm update`, `npm up` o `npm ci`, ni ejecuta `npx`. Si una operación
bloqueada es necesaria, Codex propone el comando exacto, explica el gate y se detiene; el usuario
lo ejecuta manualmente en Terminal después de autorizar el gate. La autorización no levanta la
prohibición para Codex. Tests y gates permitidos que no mutan dependencias siguen disponibles.
