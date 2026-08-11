# ChatGPT + Codex — protocolo de colaboración

## Objetivo

Combinar razonamiento/arquitectura y revisión humana de ChatGPT con acceso directo al repositorio y ejecución local de Codex.

## Ciclo recomendado por SPEC

### 1. ChatGPT — preparación

- define pregunta de ingeniería;
- revisa contratos y SPECs relacionadas;
- fija objetivos, exclusiones y casos reales;
- prepara checklist de Fase A.

### 2. Codex — inspección factual

- Gate 0;
- recorre el repo;
- localiza productores/consumidores, persistencia, tests y fronteras;
- devuelve un informe sin modificar código.

### 3. ChatGPT — decisión de contrato

- contrasta el informe con la intención del proyecto;
- resuelve ambigüedades;
- congela la SPEC/corte y criterios de aceptación.

### 4. Codex — implementación

- implementa corte por corte;
- tests focales y regresión;
- registra bugs antes del fix;
- genera evidencia local.

### 5. ChatGPT + usuario — revisión

- revisan geometría, SVG/HTML/capturas y coherencia estructural;
- aprueban o abren correctivas.

### 6. Codex — cierre técnico

- suite integral;
- gobernanza;
- diff del working tree;
- propone los comandos bloqueados, explica el gate y se detiene;
- audita el staged después de que el usuario ejecute manualmente el staging.

### 7. Usuario — Git

- autoriza el gate de staging y ejecuta manualmente el comando en Terminal;
- autoriza el gate de commit y ejecuta manualmente el comando en Terminal;
- autoriza el gate de push y ejecuta manualmente el comando en Terminal;
- verifica sincronización final.

Codex no ejecuta Git de escritura mediante `add`, `commit`, `push`, `pull`, `merge`, `rebase`,
`reset`, `clean`, `checkout`, `restore`, `switch`, `tag`, `stash`, `cherry-pick`, `revert`, `am`
o `apply`; tampoco ejecuta mutaciones de dependencias mediante `npm i`, `npm install`,
`npm uninstall`, `npm remove`, `npm rm`, `npm update`, `npm up` o `npm ci`, ni ejecuta `npx`.
Cuando una operación bloqueada sea necesaria, Codex propone el comando exacto y explica el gate,
pero el usuario la autoriza y ejecuta exclusivamente de forma manual.

## Formato de handoff Codex → ChatGPT

Codex debe entregar:

- baseline y estado del repo;
- archivos inspeccionados;
- hechos observados;
- inferencias separadas de hechos;
- contradicciones/ambigüedades;
- riesgos;
- propuesta mínima de contrato;
- pruebas que deberían fallar ante una regresión;
- ninguna edición no autorizada.

## Formato de handoff ChatGPT → Codex

ChatGPT debe entregar:

- decisión congelada;
- alcance y exclusiones;
- archivos objetivo probables;
- criterios de aceptación;
- tests/gates;
- evidencia real requerida;
- prohibiciones explícitas;
- punto exacto donde Codex debe detenerse para revisión humana.
