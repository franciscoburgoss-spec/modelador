# BUG-TRANS-CODEX-007 — Bypass mediante invocaciones envueltas de comandos bloqueados

## Estado

CERRADO — 11-ago-2026

## Hallazgo

La política prohíbe que Codex ejecute determinadas categorías de comandos, pero existen formas
alternativas de invocarlas que no son bloqueadas por ninguna de las dos barreras actuales.

## Alcance confirmado

La vulnerabilidad de hardening afecta formas alternativas de invocar las categorías ya bloqueadas
por BUG-TRANS-CODEX-006:

- Git de escritura del conjunto ya congelado;
- mutaciones npm del conjunto ya congelado;
- `npx`.

No se agregan nuevas categorías ni nuevos subcomandos.

## Evidencia observada — Git

1. `git add .`
   - `.rules` → `forbidden`;
   - PreToolUse → `deny`;
   - control correcto.
2. `/usr/bin/git add .`
   - `.rules` → sin match;
   - PreToolUse → `deny`;
   - defensa parcial; no es bypass efectivo mientras el hook esté activo.
3. `git -C "/Volumes/MEM EXT/Developer/modelador" add .`
   - `.rules` → sin match;
   - PreToolUse → `{}`;
   - bypass confirmado.
4. `env git add .`
   - `.rules` → sin match;
   - PreToolUse → `{}`;
   - bypass confirmado.
5. `command git add .`
   - PreToolUse → `{}`;
   - bypass confirmado.
6. `bash -lc 'git add .'`
   - PreToolUse → `{}`;
   - bypass confirmado.
7. `git status -sb`
   - `.rules` → sin match;
   - PreToolUse → `{}`;
   - lectura permitida correctamente.

## Evidencia adicional — npm y npx

### `.rules`

- `npm install` → `forbidden`;
- `env npm install` → sin match;
- `command npm ci` → sin match;
- `bash -lc 'npm update'` → sin match;
- `npx vite --version` → `forbidden`;
- `env npx vite --version` → sin match;
- `command npx vite --version` → sin match;
- `bash -lc 'npx vite --version'` → sin match.

### PreToolUse

- `npm install` → `deny`;
- `env npm install` → `{}`;
- `command npm ci` → `{}`;
- `bash -lc 'npm update'` → `{}`;
- `npx vite --version` → `deny`;
- `env npx vite --version` → `{}`;
- `command npx vite --version` → `{}`;
- `bash -lc 'npx vite --version'` → `{}`.

## Red-team del prototipo V2

### Resultado

- Corpus contractual V2: `TOTAL=58 PASS=58 FAIL=0`; exit code `0`.
- Red-team adicional: 12 casos; 6 PASS; 6 FAIL.

### FAIL observados

1. `env -S 'git add .'`
   - V2 → permitido;
   - bypass confirmado del conjunto Git ya bloqueado.
2. `env --split-string='git add .'`
   - V2 → permitido;
   - bypass confirmado del mismo conjunto.
3. `bash -O extglob -c 'git add .'`
   - V2 → permitido;
   - incumplimiento del contrato existente de shells `-c`/`-lc`.
4. `npm --prefix . install`
   - V2 → permitido;
   - bypass de una mutación npm ya bloqueada.
5. `npm --workspace foo install`
   - V2 → permitido;
   - bypass de una mutación npm ya bloqueada.
6. `echo ok |& git add .`
   - V2 → permitido;
   - bypass del mismo conjunto Git mediante variante de pipe.

### Controles PASS

- `env FOO='git add .' echo ok` → permitido;
- `bash --noprofile -c 'git add .'` → bloqueado;
- `bash -lc 'git status -sb'` → permitido;
- `env bash -lc 'git status -sb'` → permitido;
- `echo ok && git status -sb` → permitido;
- `printf '%s\n' 'git add .'` → permitido.

## SHA observado del hook durante la reproducción

`30fe90a5809742c36afd1f808cb921b2ff07770b2ddd83650e1e1b0173e219f8`

## Impacto

La política documental dice que Codex no ejecuta las categorías bloqueadas, pero la implementación
actual no garantiza esa política para determinadas formas alternativas de invocación Bash.

## Causa raíz definitiva

### `.rules`

`.rules` realiza matching directo por prefijo. Los checks observados no demuestran normalización
del basename del ejecutable, consumo de opciones globales, desenvoltura de wrappers o shells, ni
análisis recursivo de comandos interiores.

### PreToolUse

El PreToolUse actual realiza una inspección regex plana que no conoce suficientemente quoting,
wrappers ni shells anidados. El límite `-C\s+\S+` exige que el argumento de `-C` no contenga
whitespace; la ruta quoted y con espacios del repositorio demuestra específicamente esa limitación.

## Diseño congelado para la futura correctiva

La correctiva adoptará un parser estructural conservador, deliberadamente acotado y basado sólo en
la biblioteca estándar de Python:

1. segmentar operadores shell fuera de quotes: `&&`, `||`, `;`, `|` y saltos de línea;
2. tokenizar cada segmento mediante `shlex`;
3. normalizar el basename del ejecutable, por ejemplo `/usr/bin/git` → `git`;
4. desenvolver los wrappers conocidos `env` y `command`;
5. reconocer los shells `sh`, `bash` y `zsh` con `-c` y `-lc`;
6. analizar recursivamente el comando interior con un límite explícito de profundidad;
7. para Git, consumir las opciones globales necesarias para identificar el subcomando, incluyendo
   como mínimo `-C <ruta>`;
8. clasificar únicamente los conjuntos bloqueados ya congelados por BUG-TRANS-CODEX-006;
9. permitir operaciones inequívocas de lectura;
10. aplicar fail-closed únicamente cuando exista una herramienta protegida, el texto no pueda
    analizarse de forma suficientemente segura y no pueda demostrarse que corresponde a una
    operación permitida.

El parser no ejecutará ni expandirá aliases, sustituciones, variables ni shell expansion.

## Ampliación contractual para la futura correctiva

Esta ampliación no agrega nuevas categorías ni nuevos subcomandos protegidos.

### `env`

Debe bloquear:

- `env -S 'git add .'`;
- `env --split-string='git add .'`.

La implementación debe tratar `-S`/`--split-string` conservadoramente como contenido que puede
introducir el comando efectivo.

No debe interpretar como comando el texto protegido que sea únicamente valor de una variable:

- `env FOO='git add .' echo ok` → permitido.

### Shells

Debe resolver:

- `bash -O extglob -c 'git add .'` → `deny` o `protected_command_unparseable`;
- `bash --noprofile -c 'git add .'` → `deny`.

La localización de `-c`/`-lc` debe respetar opciones de shell que consumen argumentos previos.

Las lecturas envueltas deben seguir permitidas:

- `bash -lc 'git status -sb'` → `{}`;
- `env bash -lc 'git status -sb'` → `{}`.

### npm

Debe resolver:

- `npm --prefix . install` → `npm_dependency_mutation`;
- `npm --workspace foo install` → `npm_dependency_mutation` o
  `protected_command_unparseable`.

La futura implementación debe localizar el subcomando npm después de opciones globales conocidas
o, si una opción global no puede analizarse con seguridad y existe una mutación protegida, fallar
cerrado.

No se amplía el conjunto de mutaciones npm: `i`, `install`, `uninstall`, `remove`, `rm`, `update`,
`up`, `ci`.

### Operadores

La implementación debe reconocer `|&` como operador shell o, como mínimo, tratarlo como una
estructura que falla cerrada si permite ocultar una herramienta protegida.

Debe bloquear:

- `echo ok |& git add .`.

Debe seguir permitiendo:

- `echo ok && git status -sb`.

## Rol de `.rules`

`.rules` permanece como defensa simple para invocaciones directas. No se le exige resolver wrappers
ni sintaxis shell que los checks observados demostraron que no interpreta. BUG-TRANS-CODEX-007 no
modificará `.rules` salvo que una prueba posterior demuestre una necesidad concreta.

## Limitación explícita de seguridad

- PreToolUse es una barrera adicional de defensa en profundidad, no una frontera absoluta de
  seguridad.
- La política global depende además del sandbox, `.rules`, `AGENTS.md` y los gates manuales.
- BUG-TRANS-CODEX-007 busca cerrar los bypasses reproducidos dentro del camino Bash inspeccionado
  por el hook; no afirma cobertura absoluta de todas las rutas internas posibles de Codex.

## Fronteras

- No agregar nuevas categorías ni nuevos subcomandos bloqueados.
- No modificar la política definida por BUG-TRANS-CODEX-006.
- No tocar código productivo, gobernanza estructural ni SPECs.
- H-GOV-POST015E-002 permanece fuera de alcance.

## Criterio definitivo de cierre

Todos los casos se evalúan como texto y nunca ejecutan las operaciones inspeccionadas.

### Git de escritura — PreToolUse debe devolver `deny`

- `git add .`;
- `/usr/bin/git add .`;
- `git -C "/Volumes/MEM EXT/Developer/modelador" add .`;
- `env git add .`;
- `command git add .`;
- `bash -lc 'git add .'`;
- `env bash -lc 'git add .'`;
- `echo ok && git add .`.

### Git de lectura — PreToolUse debe devolver `{}`

- `git status -sb`;
- `git -C "/Volumes/MEM EXT/Developer/modelador" status -sb`.

### npm — PreToolUse debe devolver `deny`

- `npm install`;
- `env npm install`;
- `command npm ci`;
- `bash -lc 'npm update'`;
- `env bash -lc 'npm ci'`;
- `echo ok && npm install`.

### npm permitido — PreToolUse debe devolver `{}`

- `npm --version`;
- `npm run validate`.

### npx — PreToolUse debe devolver `deny`

- `npx vite --version`;
- `env npx vite --version`;
- `command npx vite --version`;
- `bash -lc 'npx vite --version'`;
- `env bash -lc 'npx vite --version'`;
- `echo ok && npx vite --version`.

### Robustez

La matriz debe cubrir:

- quotes simples y dobles;
- rutas con espacios;
- `&&` y `||`;
- `;` y pipes;
- saltos de línea;
- wrappers anidados hasta una profundidad explícita;
- quoting inválido que mencione una herramienta protegida → `deny`.

Además:

- las invocaciones directas en `.rules` deben seguir en `forbidden`;
- Git de lectura directa debe seguir sin `forbidden`;
- una prueba de reversión debe demostrar que al menos `env git add .` y
  `bash -lc 'git add .'` vuelven a escapar al restaurar el guard anterior;
- el SHA nuevo del hook sólo se registra después de aplicar y validar la correctiva.

## Requisitos para V3

V3 deberá corregir los seis FAIL del red-team sin perder:

- los 58/58 PASS del corpus V2;
- los seis controles PASS del red-team;
- la prueba de reversión contra el hook histórico;
- el contrato JSON;
- `MAX_DEPTH` explícito;
- la ausencia de ejecución del texto analizado.

No se reducirán ni reemplazarán casos existentes.

## Historial del prototipo

### V2

- SHA guard:
  `b484beb9df8316138a14c284d29fb749d032eebf2bdf4918c039eabbb87baaaa`.
- SHA tests:
  `b4fca9b9204d2896416695df2be8353449288967038be3d855b969bd8c125c36`.
- Corpus contractual: 58/58 PASS.
- Red-team: 6/12 PASS.
- Decisión: NO integrable; requiere V3.

No se registran todavía SHA ni resultados de V3.

## Red-team estático V3

### Resultado

- Corpus contractual V3: `TOTAL=109 PASS=109 FAIL=0`; exit code `0`.
- Red-team adicional: 31 casos; 11 PASS; 20 FAIL.
- Distribución de FAIL:
  - 17 falsos negativos ejecutables;
  - 3 falsos positivos relevantes.

### Nuevas familias de bypass

#### A. Asignaciones shell previas al ejecutable

V3 permitió incorrectamente:

- `FOO=bar git add .`;
- `FOO=bar npm install`;
- `FOO=bar npx vite --version`;
- `FOO=bar BAR=baz git add .`;
- `FOO="valor con espacio" git add .`.

Controles correctos:

- `FOO='git add .' echo ok` → permitido;
- `FOO=bar git status -sb` → permitido.

Causa: `_analyze_tokens()` sólo considera `tokens[0]` como ejecutable y no consume asignaciones
shell previas.

#### B. Process substitution

V3 permitió incorrectamente:

- `cat <(git add .)`;
- `cat <(npm install)`;
- `cat <(npx vite --version)`;
- `cat >(git add .)`.

Estas construcciones pueden ejecutar el comando interior dentro del shell y pertenecen al mismo
conjunto protegido.

#### C. Agrupaciones/subshells

V3 permitió incorrectamente:

- `(git add .)`;
- `(npm install)`;
- `(npx vite --version)`;
- `{ git add .; }`.

No se agrega ninguna categoría protegida nueva: son formas alternativas de ejecutar las mismas
operaciones ya prohibidas.

#### D. Negación

V3 permitió incorrectamente:

- `! git add .`.

La negación no cambia que Git de escritura se ejecutaría.

#### E. Wrapper `exec`

V3 permitió incorrectamente:

- `exec git add .`;
- `exec npm install`;
- `exec npx vite --version`.

`exec` debe considerarse wrapper de posición ejecutable para las categorías ya bloqueadas.

### Falsos positivos V3

V3 bloqueó incorrectamente:

- `echo '$(git add .)'`;
- `printf '%s\n' '$(npm install)'`;
- `python3 -c 'print("$(git add .)")'`.

La condición global de `_analyze_command()`:

```python
("$(" in command or "`" in command) and protected_hint(command)
```

no distingue expansión activa del shell de texto situado dentro de quotes que el shell exterior
trata como datos.

También se observó que:

- ``echo '`git add .`'`` quedó permitido;
- esto no demuestra un parsing estructural correcto de backticks, sino una limitación accidental
  del detector de hints.

## Contrato V4 congelado

V4 será la última ampliación funcional de BUG-TRANS-CODEX-007 antes de integración. No intentará
convertirse en un parser Bash completo y añadirá exclusivamente soporte conservador para las
familias reproducidas a continuación.

### A. Asignaciones shell iniciales

Consumir asignaciones válidas `NAME=value` antes de localizar el ejecutable real. El valor de la
asignación se trata como dato, no como comando.

Debe bloquear:

- `FOO=bar git add .`;
- `FOO=bar npm install`;
- `FOO=bar npx vite --version`;
- `FOO=bar BAR=baz git add .`;
- `FOO="valor con espacio" git add .`.

Debe permitir:

- `FOO='git add .' echo ok`;
- `FOO=bar git status -sb`.

### B. `exec`

Desenvolver `exec` como wrapper conservador del comando posterior.

Debe bloquear:

- `exec git add .`;
- `exec npm install`;
- `exec npx vite --version`.

Debe permitir una invocación inequívoca de lectura como `exec git status -sb` si el parser puede
demostrarla con seguridad.

### C. Negación `!`

Tratar `!` al inicio de una unidad de comando como modificador que no cambia la clasificación del
comando siguiente.

Debe bloquear:

- `! git add .`;
- `! npm install`;
- `! npx vite --version`.

Debe permitir:

- `! git status -sb`.

### D. Agrupaciones

Reconocer conservadoramente los grupos ejecutables `( ... )` y `{ ...; }`. No es necesario
implementar toda la gramática Bash.

Para grupos que contienen una categoría protegida, devolver `deny` o
`protected_command_unparseable`.

Debe bloquear al menos:

- `(git add .)`;
- `(npm install)`;
- `(npx vite --version)`;
- `{ git add .; }`.

El texto quoted que sólo contiene esos caracteres debe seguir siendo dato.

### E. Process substitution

Reconocer fuera de quotes `<( ... )` y `>( ... )` sin ejecutarlos ni expandirlos.

Si el contenido puede analizarse, clasificarlo recursivamente. Si no puede analizarse con
seguridad y contiene una herramienta protegida, devolver `protected_command_unparseable`.

Debe bloquear:

- `cat <(git add .)`;
- `cat <(npm install)`;
- `cat <(npx vite --version)`;
- `cat >(git add .)`.

Debe permitir:

- `echo '<(git add .)'`, porque es dato single-quoted.

### F. Command substitution y backticks quote-aware

Eliminar la detección textual global que produce falsos positivos. La futura detección de
`$(...)` y backticks debe respetar el estado de quoting del shell exterior.

Debe bloquear o fallar cerrado:

- `echo $(git add .)`;
- `echo "$(git add .)"`;
- `echo $(npm install)`;
- `echo "$(npx vite --version)"`.

Debe permitir:

- `echo '$(git add .)'`;
- `printf '%s\n' '$(npm install)'`;
- `python3 -c 'print("$(git add .)")'`, cuando todo el `$()` pertenece a un argumento
  single-quoted del shell exterior.

No se ejecutarán sustituciones.

## Límite explícito de alcance de V4

- V4 no implementará Bash completo.
- No expandirá aliases.
- No expandirá variables.
- No resolverá funciones shell.
- No evaluará globbing.
- No ejecutará sustituciones.
- No modelará wrappers arbitrarios no reproducidos.
- No añadirá nuevas categorías ni nuevos subcomandos Git/npm/npx.
- Las formas no cubiertas quedan como limitación explícita de defensa en profundidad.
- Después de que V4 pase el corpus congelado y una revisión final acotada, BUG-TRANS-CODEX-007
  podrá pasar a integración; no se continuará con una búsqueda ilimitada de sintaxis exótica.

## Requisitos de regresión V4

V4 debe conservar:

- los 109/109 PASS de V3;
- los 31 casos de este red-team con expectativas corregidas;
- todos los controles permitidos;
- la reversión histórica;
- el contrato JSON;
- `MAX_DEPTH` explícito;
- ninguna ejecución del texto analizado.

El corpus acumulativo V4 incluirá todos esos casos sin eliminar ni relajar los anteriores.

## Historial V3

- SHA guard:
  `bbd55ba5292c113fb9d0cf69bec6ade784c627055d74a5e754bbcdfb8aaae229`.
- SHA tests:
  `128cf1f32a1dc15e72adba4970872ad7fba6384522673d1d76b3270cf6f4979c`.
- Resultado contractual: 109/109 PASS.
- Red-team estático: 11/31 PASS.
- Falsos negativos: 17.
- Falsos positivos: 3.
- Decisión: NO integrable; requiere V4.

No se registran todavía SHA ni resultados de V4.

## Integración candidata V4

- V4 guard temporal aprobado:
  `726c409f1382a7186b3c868ab09b30e55bdfc3b8529221fde1e40ecaad186c8a`.
- Tests temporales V4:
  `2406679c2a4df187beb130ffcf4bca22b856b60a9837393bbc6e7b66ca5633b7`.
- Revisión final preintegración: `TOTAL=163 PASS=163 FAIL=0`.
- Entrypoint sintético: 9/9 PASS.
- Decisión preintegración: LISTO PARA INTEGRACIÓN.
- SHA histórico antiguo, conservado como evidencia histórica:
  `30fe90a5809742c36afd1f808cb921b2ff07770b2ddd83650e1e1b0173e219f8`.
- SHA del nuevo hook integrado:
  `726c409f1382a7186b3c868ab09b30e55bdfc3b8529221fde1e40ecaad186c8a`.

La candidata V4 quedó integrada en el workspace y sus gates sobre los archivos versionados fueron
observados satisfactoriamente antes del cierre.

## Cierre

### Implementación activa

Hook:

`.codex/hooks/pre_tool_use_policy.py`

SHA-256:

`726c409f1382a7186b3c868ab09b30e55bdfc3b8529221fde1e40ecaad186c8a`

Test focal versionado:

`.codex/hooks/test_pre_tool_use_policy.py`

SHA-256:

`90cb4b30374c42002d7a07bcfa25d2fa5c86cd13d5b5bf2d0b89c98bc33b61bd`

### Evidencia final

- `py_compile` hook: PASS;
- `py_compile` test: PASS;
- test focal integrado: `TOTAL=163 PASS=163 FAIL=0`;
- entrypoint integrado: 10/10 PASS;
- `git diff --check`: PASS;
- corte de integración limitado a los tres archivos autorizados;
- hashes de archivos fuera de alcance: sin cambios;
- sin Git de escritura;
- sin npm/npx reales.

### Correctivas demostradas

La implementación activa cubre las familias reproducidas del BUG:

- rutas y wrappers Git;
- `git -C`;
- `env`;
- `command`;
- `env -S` / `--split-string`;
- shells `sh` / `bash` / `zsh`;
- opciones shell contratadas;
- opciones npm contratadas;
- operadores `&&`, `||`, `;`, `|`, `|&` y newline;
- asignaciones shell iniciales;
- `exec`;
- negación `!`;
- agrupaciones;
- process substitution;
- command substitution;
- backticks;
- quoting y controles negativos;
- profundidad acotada;
- fail-closed acotado.

Además:

- las lecturas Git inequívocas permanecen permitidas;
- `npm run validate` permanece permitido;
- `npx` permanece bloqueado;
- los datos single-quoted no se interpretan como comandos.

### Reversión

Se mantiene como evidencia histórica el SHA del hook antiguo:

`30fe90a5809742c36afd1f808cb921b2ff07770b2ddd83650e1e1b0173e219f8`

y los bypasses históricos:

- `env git add .`;
- `bash -lc 'git add .'`.

Esta evidencia histórica no fue reemplazada ni eliminada.

### Límite explícito

El hook:

- es defensa en profundidad;
- no es un parser Bash completo;
- no expande aliases;
- no expande variables;
- no interpreta funciones shell;
- no evalúa globbing;
- no ejecuta command/process substitution;
- no pretende cubrir wrappers arbitrarios no contratados.

Estas limitaciones quedan aceptadas y no mantienen abierto BUG-TRANS-CODEX-007.

### Decisión

BUG-TRANS-CODEX-007 CERRADO.

No existe correctiva pendiente dentro del alcance contractual congelado.
