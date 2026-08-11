#!/usr/bin/env python3
"""Regresión autocontenida de BUG-TRANS-CODEX-007.

Los comandos son únicamente strings sintéticos: este test nunca los ejecuta.
"""

import json
import shlex

import pre_tool_use_policy as guard


CASES = []


def add(category, expected, *commands):
    CASES.extend((category, command, expected) for command in commands)


# Conjuntos congelados por BUG-TRANS-CODEX-006.
add(
    "git_frozen_deny",
    "git_write",
    *(f"git {subcommand}" for subcommand in (
        "add", "commit", "push", "pull", "merge", "rebase", "reset", "clean",
        "checkout", "restore", "switch", "tag", "stash", "cherry-pick", "revert",
        "am", "apply",
    )),
)
add(
    "git_forms_deny",
    "git_write",
    "/usr/bin/git add .",
    'git -C "/Volumes/MEM EXT/Developer/modelador" add .',
    '"git" add .',
)
add(
    "git_allow",
    None,
    "git status -sb",
    'git -C "/Volumes/MEM EXT/Developer/modelador" status -sb',
)
add(
    "npm_frozen_deny",
    "npm_dependency_mutation",
    *(f"npm {subcommand}" for subcommand in (
        "i", "install", "uninstall", "remove", "rm", "update", "up", "ci",
    )),
)
add("npm_allow", None, "npm --version", "npm run validate")
add("npx_deny", "npx_execution", "npx vite --version")


# Wrappers, operadores y normalización heredados.
add(
    "git_wrapped_deny",
    "git_write",
    "env git add .",
    "command git add .",
    "command /usr/bin/git add .",
    "bash -lc 'git add .'",
    "env bash -lc 'git add .'",
    "echo ok && git add .",
    "echo ok || git add .",
    "echo ok ; git add .",
    "echo ok | git add .",
    "echo ok\ngit add .",
)
add(
    "npm_wrapped_deny",
    "npm_dependency_mutation",
    "env npm install",
    "command npm ci",
    "bash -lc 'npm update'",
    "env bash -lc 'npm ci'",
    "echo ok && npm install",
)
add(
    "npx_wrapped_deny",
    "npx_execution",
    "env npx vite --version",
    "command npx vite --version",
    "bash -lc 'npx vite --version'",
    "env bash -lc 'npx vite --version'",
    "echo ok && npx vite --version",
)
add(
    "pipe_amp_deny",
    "git_write",
    "echo ok |& git add .",
)
add("pipe_amp_deny", "npm_dependency_mutation", "echo ok |& npm install")
add("pipe_amp_deny", "npx_execution", "echo ok |& npx vite --version")
add(
    "operator_data_allow",
    None,
    "echo 'git add .'",
    'echo "npm install"',
    "echo 'a |& git add .'",
    "echo ok && git status -sb",
    "printf '%s\\n' 'git add .'",
)


# env, split-string y asignaciones propias de env.
add(
    "env_deny",
    "git_write",
    "env FOO=bar git add .",
    'env FOO="valor con espacio" git add .',
    "env -i FOO=bar git add .",
    "env --unset FOO git add .",
    "env -S 'git add .'",
    "env --split-string 'git add .'",
    "env --split-string='git add .'",
    "env -S 'env git add .'",
)
add(
    "env_deny",
    "npm_dependency_mutation",
    "env FOO=bar npm install",
    "env -S 'npm install'",
    "env --split-string='command npm ci'",
)
add(
    "env_deny",
    "npx_execution",
    "env FOO=bar npx vite --version",
    "env -S 'npx vite --version'",
    'env -S \'bash -lc "npx vite --version"\'',
)
add(
    "env_data_allow",
    None,
    "env FOO='git add .' echo ok",
    "env FOO='npm install' echo ok",
    "env FOO='npx vite' git status -sb",
)


# Opciones de shell y nesting contractual.
add(
    "shell_options_deny",
    "git_write",
    "bash -O extglob -c 'git add .'",
    "bash +O extglob -c 'git add .'",
    "bash --noprofile -c 'git add .'",
    "bash -O extglob -c 'env git add .'",
    "zsh -o SH_WORD_SPLIT -c 'git add .'",
)
add(
    "shell_options_deny",
    "npm_dependency_mutation",
    "bash --norc -c 'npm install'",
    "bash --noprofile -lc 'npm ci'",
    'sh -c "npm install"',
)
add(
    "shell_options_deny",
    "npx_execution",
    "zsh -o SH_WORD_SPLIT -c 'npx vite --version'",
    'zsh -lc "npx vite --version"',
)
add(
    "shell_allow",
    None,
    "bash -lc 'git status -sb'",
    "env bash -lc 'git status -sb'",
    "bash -O extglob -c 'git status -sb'",
    "bash --noprofile -c 'npm run validate'",
)


# Opciones globales npm.
add(
    "npm_options_deny",
    "npm_dependency_mutation",
    "npm --prefix . install",
    "npm --prefix=. install",
    "npm --workspace foo install",
    "npm --workspace=foo install",
    "npm -w foo install",
    "env npm --prefix . install",
    "bash -lc 'npm --workspace foo install'",
)
add(
    "npm_options_allow",
    None,
    "npm --prefix . run validate",
    "npm --workspace foo run validate",
)


# Asignaciones shell previas al ejecutable.
add(
    "shell_assignments_deny",
    "git_write",
    "FOO=bar git add .",
    "FOO=bar BAR=baz git add .",
    'FOO="valor con espacio" git add .',
)
add("shell_assignments_deny", "npm_dependency_mutation", "FOO=bar npm install", "A=1 B=2 npm ci")
add("shell_assignments_deny", "npx_execution", "FOO=bar npx vite --version")
add(
    "shell_assignments_allow",
    None,
    "FOO='git add .' echo ok",
    "FOO=bar git status -sb",
    "FOO='npm install' printf '%s\\n' ok",
    "A='git add .' B=2 echo ok",
)


# exec y negación.
add("exec_deny", "git_write", "exec git add .", "exec -- git add .")
add("exec_deny", "npm_dependency_mutation", "exec npm install")
add("exec_deny", "npx_execution", "exec npx vite --version")
add("exec_allow", None, "exec git status -sb")
add("negation_deny", "git_write", "! git add .", "! ! git add .")
add("negation_deny", "npm_dependency_mutation", "! npm install")
add("negation_deny", "npx_execution", "! npx vite --version")
add("negation_allow", None, "! git status -sb", "! npm run validate", "echo '! git add .'")


# Agrupaciones y process substitution.
add("grouping_deny", "git_write", "(git add .)", "{ git add .; }", "(env git add .)")
add("grouping_deny", "npm_dependency_mutation", "(npm install)", "{ npm install; echo ok; }")
add("grouping_deny", "npx_execution", "(npx vite --version)")
add(
    "grouping_allow",
    None,
    "(git status -sb)",
    "{ git status -sb; }",
    "echo '(git add .)'",
)
add(
    "process_substitution_deny",
    "git_write",
    "cat <(git add .)",
    "cat >(git add .)",
    "diff <(git status -sb) <(git add .)",
)
add("process_substitution_deny", "npm_dependency_mutation", "cat <(npm install)")
add("process_substitution_deny", "npx_execution", "cat <(npx vite --version)")
add("process_substitution_allow", None, "cat <(git status -sb)", "echo '<(git add .)'")


# Command substitution y backticks quote-aware.
add(
    "command_substitution_deny",
    "protected_command_unparseable",
    "echo $(git add .)",
    'echo "$(git add .)"',
    "echo $(npm install)",
    'echo "$(npx vite --version)"',
)
add("backticks_deny", "git_write", "echo `git add .`")
add(
    "substitution_data_allow",
    None,
    "echo '$(git add .)'",
    "printf '%s\\n' '$(npm install)'",
    "echo '`git add .`'",
    "python3 -c 'print(\"$(git add .)\")'",
    "python3 -c 'print(\"`git add .`\")'",
    "printf '%s\\n' 'env -S \"git add .\"'",
)


# Robustez y ausencia de falsos positivos.
add(
    "negative_controls",
    None,
    "echo '<(git add .)'",
    "printf '%s\\n' 'exec npm install'",
    'echo "git add ."',
    "printf '%s\\n' \"npm install\"",
    "python3 -c 'print(\"npx vite\")'",
)
add("invalid_quoting", "protected_command_unparseable", "bash -lc 'git add .")
add("invalid_quoting", None, "echo 'texto sin cierre")


failures = []
passed = 0
distribution = {}


def record(category, expected, actual, detail):
    global passed
    distribution[category] = distribution.get(category, 0) + 1
    if actual == expected:
        passed += 1
    else:
        failures.append({
            "category": category,
            "detail": detail,
            "expected": expected,
            "actual": actual,
        })


for index, (category, command, expected) in enumerate(CASES, 1):
    record(category, expected, guard.classify_command(command), f"case[{index}] {command!r}")


# Profundidad explícita.
inner = "git add ."
for _ in range(3):
    inner = "bash -lc " + shlex.quote(inner)
record("recursion", "git_write", guard.classify_command(inner), "within MAX_DEPTH")

too_deep = "git add ."
for _ in range(guard.MAX_DEPTH + 2):
    too_deep = "bash -lc " + shlex.quote(too_deep)
record(
    "recursion",
    "protected_command_unparseable",
    guard.classify_command(too_deep),
    "over MAX_DEPTH",
)


# Contrato JSON PreToolUse.
denied = guard.evaluate_payload({"tool_input": {"command": "env git add ."}})
record(
    "json_contract",
    "deny",
    denied.get("hookSpecificOutput", {}).get("permissionDecision"),
    "deny contract",
)
record(
    "json_contract",
    {},
    guard.evaluate_payload({"tool_input": {"command": "git status -sb"}}),
    "allow contract",
)


# Fixture local mínimo de evidencia histórica; no es implementación activa.
HISTORICAL_ALLOWED_BYPASSES = frozenset({
    "env git add .",
    "bash -lc 'git add .'",
})
for command in sorted(HISTORICAL_ALLOWED_BYPASSES):
    record(
        "historical_fixture",
        True,
        command in HISTORICAL_ALLOWED_BYPASSES,
        f"historically allowed {command!r}",
    )


total = passed + len(failures)
print("DISTRIBUTION=" + json.dumps(distribution, sort_keys=True))
print(f"TOTAL={total} PASS={passed} FAIL={len(failures)}")
for failure in failures:
    print("FAILURE=" + json.dumps(failure, ensure_ascii=False, sort_keys=True))

raise SystemExit(1 if failures else 0)
