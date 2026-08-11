# BUG-TRANS-CODEX-006 — Política de ejecución contradictoria

## Estado

CERRADO — 11-ago-2026.

## Hallazgo

La transición ChatGPT + Codex contiene dos políticas incompatibles:

1. `.codex/rules/modelador.rules`, `AGENTS.md` y los documentos de workflow permiten interpretar
   que Git de escritura, los cambios de dependencias y `npx` pueden ser ejecutados por Codex
   después de autorización.
2. `.codex/hooks/pre_tool_use_policy.py` los deniega incondicionalmente y exige su ejecución manual
   por el usuario.

## Política autoritativa congelada

- Codex puede inspeccionar, editar archivos del workspace y ejecutar tests y gates permitidos.
- Codex no ejecuta Git de escritura.
- Codex no ejecuta mutaciones de dependencias, incluidos `npm install`, `npm uninstall`,
  `npm update`, `npm ci` y equivalentes.
- Codex no ejecuta `npx`.
- Cuando una de esas operaciones sea necesaria, Codex debe proponer el comando y detenerse.
- El usuario ejecutará manualmente el comando en Terminal sólo después del gate o autorización
  correspondiente.
- La autorización del usuario permite avanzar al gate manual; no desactiva ni evita esta
  prohibición para Codex.

## Corrección requerida

- Cambiar las reglas correspondientes de `.codex/rules/modelador.rules` de `prompt` a `forbidden`.
- Mantener el PreToolUse actual con `deny`.
- Corregir únicamente las frases contradictorias de `AGENTS.md`, `docs/CODEX_WORKFLOW.md` y
  `docs/CHATGPT_CODEX_COLLABORATION.md`.
- Revisar `docs/PROMPT_INICIAL_CODEX_POST_SPEC015E.md` y modificarlo sólo si contiene la misma
  contradicción.
- Mantener `approval_policy = "on-request"` para las demás categorías de aprobación.
- No modificar la arquitectura estructural, la gobernanza de SPEC ni BUG-015-E-016.

## Fronteras

- No activar ninguna SPEC.
- No tocar código productivo.
- No cambiar el comportamiento del hook.
- No ampliar las categorías bloqueadas en esta correctiva.
- No tocar H-GOV-POST015E-002.

## Criterio de cierre

`.rules`, el hook, `AGENTS.md` y la documentación describen una sola política: las operaciones
bloqueadas son ejecutadas exclusivamente por el usuario de forma manual.

## Resolución

Se modificaron exclusivamente:

- `.codex/rules/modelador.rules`;
- `AGENTS.md`;
- `docs/CODEX_WORKFLOW.md`;
- `docs/CHATGPT_CODEX_COLLABORATION.md`;
- este registro `docs/BUG-TRANS-CODEX-006_POLITICA_EJECUCION_CONTRADICTORIA.md`.

Las reglas de Git cubren `add`, `commit`, `push`, `pull`, `merge`, `rebase`, `reset`, `clean`,
`checkout`, `restore`, `switch`, `tag`, `stash`, `cherry-pick`, `revert`, `am` y `apply`. Las
reglas npm cubren `i`, `install`, `uninstall`, `remove`, `rm`, `update`, `up` y `ci`. Ambas,
junto con `npx`, quedaron con decisión `forbidden`.

Los documentos establecen que Codex propone el comando y explica el gate, mientras el usuario lo
autoriza y ejecuta manualmente en Terminal.

`.codex/hooks/pre_tool_use_policy.py` permanece sin cambios y conserva `permissionDecision: deny`.
`.codex/config.toml` permanece sin cambios y conserva `approval_policy = "on-request"` para las
demás categorías de aprobación. `docs/PROMPT_INICIAL_CODEX_POST_SPEC015E.md` fue inspeccionado y
no requiere modificación.

## Validación observada

Los gates de execpolicy terminaron con código 0 y produjeron estas decisiones efectivas:

- `git add .` → `forbidden`;
- `git pull` → `forbidden`;
- `git stash` → `forbidden`;
- `npm install` → `forbidden`;
- `npm ci` → `forbidden`;
- `npm update` → `forbidden`;
- `npx vite --version` → `forbidden`;
- `git status -sb` → `matchedRules: []`, sin regla `forbidden`.

El SHA-256 efectivamente observado de `.codex/hooks/pre_tool_use_policy.py` fue:

`30fe90a5809742c36afd1f808cb921b2ff07770b2ddd83650e1e1b0173e219f8`.
