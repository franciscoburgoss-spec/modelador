#!/usr/bin/env python3
"""Prototipo aislado V4 del guard PreToolUse de Modelador Propio.

Analiza texto con biblioteca estándar; nunca ejecuta comandos ni realiza
expansiones shell. Sólo modela las familias congeladas por BUG-TRANS-CODEX-007.
La recursión está limitada explícitamente a MAX_DEPTH=6.
"""

import json
import os
import re
import shlex
import sys


MAX_DEPTH = 6

GIT_WRITE = frozenset({
    "add", "commit", "push", "pull", "merge", "rebase", "reset", "clean",
    "checkout", "restore", "switch", "tag", "stash", "cherry-pick", "revert",
    "am", "apply",
})
NPM_MUTATIONS = frozenset({
    "i", "install", "uninstall", "remove", "rm", "update", "up", "ci",
})
SHELLS = frozenset({"sh", "bash", "zsh"})

_ASSIGNMENT = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*=.*$", re.DOTALL)
_GIT_HINT = re.compile(
    r"(?is)(?:^|[\s'\";&|(])(?:[^\s'\";&|()]*/)?git\b.{0,2000}?\b(?:"
    + "|".join(re.escape(item) for item in sorted(GIT_WRITE, key=len, reverse=True))
    + r")\b"
)
_NPM_HINT = re.compile(
    r"(?is)(?:^|[\s'\";&|(])(?:[^\s'\";&|()]*/)?npm\b.{0,2000}?\b(?:"
    + "|".join(re.escape(item) for item in sorted(NPM_MUTATIONS, key=len, reverse=True))
    + r")\b"
)
_NPX_HINT = re.compile(r"(?is)(?:^|[\s'\";&|(])(?:[^\s'\";&|()]*/)?npx\b")


class ParseError(ValueError):
    """La estructura shell acotada no pudo analizarse con seguridad."""


def protected_hint(command):
    """Indicio conservador usado sólo cuando el parsing estructural falla."""
    return bool(
        _GIT_HINT.search(command)
        or _NPM_HINT.search(command)
        or _NPX_HINT.search(command)
    )


def split_segments(command):
    """Separa operadores reales fuera de quotes sin ejecutar ni expandir texto."""
    segments = []
    current = []
    quote = None
    escaped = False
    index = 0

    while index < len(command):
        char = command[index]

        if escaped:
            current.append(char)
            escaped = False
            index += 1
            continue

        if char == "\\" and quote != "'":
            current.append(char)
            escaped = True
            index += 1
            continue

        if quote:
            current.append(char)
            if char == quote:
                quote = None
            index += 1
            continue

        if char in {"'", '"'}:
            quote = char
            current.append(char)
            index += 1
            continue

        pair = command[index:index + 2]
        if pair in {"&&", "||", "|&"}:
            if not "".join(current).strip():
                raise ParseError("operador sin comando previo")
            segments.append("".join(current).strip())
            current = []
            index += 2
            continue

        if char in {";", "|", "\n"}:
            if not "".join(current).strip():
                raise ParseError("operador sin comando previo")
            segments.append("".join(current).strip())
            current = []
            index += 1
            continue

        current.append(char)
        index += 1

    if quote is not None:
        raise ParseError("quoting sin cierre")
    if escaped:
        raise ParseError("escape final incompleto")

    tail = "".join(current).strip()
    if tail:
        segments.append(tail)
    return segments


def executable_name(token):
    return os.path.basename(token.rstrip("/"))


def _find_matching(text, open_index, opener, closer):
    """Encuentra un cierre balanceado respetando quotes del contenido interior."""
    depth = 1
    quote = None
    escaped = False
    index = open_index + 1

    while index < len(text):
        char = text[index]
        if escaped:
            escaped = False
            index += 1
            continue
        if char == "\\" and quote != "'":
            escaped = True
            index += 1
            continue
        if quote == "'":
            if char == "'":
                quote = None
            index += 1
            continue
        if quote == '"':
            if char == '"':
                quote = None
            index += 1
            continue
        if char == "'":
            quote = "'"
            index += 1
            continue
        if char == '"':
            quote = '"'
            index += 1
            continue
        if char == opener:
            depth += 1
        elif char == closer:
            depth -= 1
            if depth == 0:
                return index
        index += 1
    raise ParseError("estructura agrupada sin cierre")


def _find_backtick(text, start):
    escaped = False
    index = start + 1
    while index < len(text):
        char = text[index]
        if escaped:
            escaped = False
            index += 1
            continue
        if char == "\\":
            escaped = True
            index += 1
            continue
        if char == "`":
            return index
        index += 1
    raise ParseError("backtick sin cierre")


def _analyze_active_structures(command, depth):
    """Analiza sólo sustituciones y grupos activos fuera de single quotes."""
    if depth > MAX_DEPTH:
        raise ParseError("límite de recursión excedido")

    quote = None
    escaped = False
    index = 0
    while index < len(command):
        char = command[index]

        if escaped:
            escaped = False
            index += 1
            continue
        if char == "\\" and quote != "'":
            escaped = True
            index += 1
            continue
        if quote == "'":
            if char == "'":
                quote = None
            index += 1
            continue
        if char == "'" and quote is None:
            quote = "'"
            index += 1
            continue

        if char == '"':
            quote = None if quote == '"' else '"'
            index += 1
            continue

        pair = command[index:index + 2]
        if pair in {"$(", "<(", ">("}:
            close = _find_matching(command, index + 1, "(", ")")
            inner = command[index + 2:close]
            category = _analyze_command(inner, depth + 1)
            if category:
                if pair == "$(":
                    raise ParseError("command substitution protegida")
                return category
            index = close + 1
            continue

        if char == "`":
            close = _find_backtick(command, index)
            inner = command[index + 1:close]
            category = _analyze_command(inner, depth + 1)
            if category:
                return category
            index = close + 1
            continue

        if quote is None and char == "(":
            close = _find_matching(command, index, "(", ")")
            inner = command[index + 1:close]
            category = _analyze_command(inner, depth + 1)
            if category:
                return category
            index = close + 1
            continue

        if quote is None and char == "{":
            close = _find_matching(command, index, "{", "}")
            inner = command[index + 1:close]
            category = _analyze_command(inner, depth + 1)
            if category:
                return category
            index = close + 1
            continue

        index += 1
    return None


def _split_env_string(value):
    try:
        return shlex.split(value, comments=False, posix=True)
    except ValueError as exc:
        raise ParseError("env split-string no analizable") from exc


def _unwrap_env(tokens, depth):
    if depth > MAX_DEPTH:
        raise ParseError("límite de recursión excedido")

    index = 1
    options_with_value = {"-u", "--unset", "-C", "--chdir", "--argv0"}
    flags = {"-i", "--ignore-environment", "-0", "--null", "-v", "--debug"}

    while index < len(tokens):
        token = tokens[index]
        if token == "--":
            index += 1
            break
        if _ASSIGNMENT.match(token):
            index += 1
            continue
        if token in {"-S", "--split-string"}:
            if index + 1 >= len(tokens):
                raise ParseError("opción env split-string sin argumento")
            expanded = _split_env_string(tokens[index + 1])
            rebuilt = [tokens[0], *tokens[1:index], *expanded, *tokens[index + 2:]]
            return _unwrap_env(rebuilt, depth + 1)
        if token.startswith("--split-string="):
            expanded = _split_env_string(token.split("=", 1)[1])
            rebuilt = [tokens[0], *tokens[1:index], *expanded, *tokens[index + 1:]]
            return _unwrap_env(rebuilt, depth + 1)
        if token in options_with_value:
            if index + 1 >= len(tokens):
                raise ParseError("opción env sin argumento")
            index += 2
            continue
        if any(token.startswith(prefix + "=") for prefix in {
            "--unset", "--chdir", "--argv0",
        }):
            index += 1
            continue
        if token in flags:
            index += 1
            continue
        if token.startswith("-"):
            raise ParseError("opción env no soportada")
        break
    return tokens[index:]


def _unwrap_command(tokens):
    index = 1
    while index < len(tokens):
        token = tokens[index]
        if token == "--":
            index += 1
            break
        if token in {"-v", "-V"}:
            return None
        if token == "-p":
            index += 1
            continue
        if token.startswith("-"):
            raise ParseError("opción command no soportada")
        break
    return tokens[index:]


def _unwrap_exec(tokens):
    index = 1
    if index < len(tokens) and tokens[index] == "--":
        index += 1
    elif index < len(tokens) and tokens[index].startswith("-"):
        raise ParseError("opción exec no soportada")
    return tokens[index:]


def _shell_inner(tokens):
    index = 1
    options_with_value = {"-O", "+O", "-o", "+o"}
    long_flags = {"--noprofile", "--norc", "--login", "--posix", "--restricted"}

    while index < len(tokens):
        token = tokens[index]
        if token == "--":
            return None
        if token in {"-c", "-lc"} or (
            token.startswith("-") and not token.startswith("--") and "c" in token[1:]
        ):
            if index + 1 >= len(tokens):
                raise ParseError("shell -c sin comando")
            return tokens[index + 1]
        if token in options_with_value:
            if index + 1 >= len(tokens):
                raise ParseError("opción shell sin argumento")
            index += 2
            continue
        if any(token.startswith(prefix) and token != prefix for prefix in options_with_value):
            index += 1
            continue
        if token in long_flags:
            index += 1
            continue
        if token.startswith("-") or token.startswith("+"):
            raise ParseError("opción shell no soportada")
        return None
    return None


def _git_subcommand(tokens):
    index = 1
    options_with_value = {
        "-C", "-c", "--git-dir", "--work-tree", "--namespace", "--super-prefix",
        "--config-env", "--exec-path",
    }
    flags = {
        "--version", "--help", "-h", "-p", "--paginate", "-P", "--no-pager",
        "--bare", "--no-replace-objects", "--literal-pathspecs", "--glob-pathspecs",
        "--noglob-pathspecs", "--icase-pathspecs", "--no-optional-locks",
    }

    while index < len(tokens):
        token = tokens[index]
        if token == "--":
            index += 1
            break
        if token in options_with_value:
            if token == "--exec-path" and index + 1 >= len(tokens):
                return None
            if index + 1 >= len(tokens):
                raise ParseError("opción global Git sin argumento")
            index += 2
            continue
        if token.startswith("-C") and token != "-C":
            index += 1
            continue
        if any(token.startswith(prefix + "=") for prefix in {
            "--git-dir", "--work-tree", "--namespace", "--super-prefix", "--config-env",
            "--exec-path",
        }):
            index += 1
            continue
        if token in flags:
            index += 1
            continue
        if token.startswith("-"):
            raise ParseError("opción global Git no soportada")
        break
    return tokens[index] if index < len(tokens) else None


def _npm_subcommand(tokens):
    index = 1
    options_with_value = {"--prefix", "--workspace", "-w"}
    flags = {"--version", "-v", "--help", "-h"}

    while index < len(tokens):
        token = tokens[index]
        if token == "--":
            index += 1
            break
        if token in options_with_value:
            if index + 1 >= len(tokens):
                raise ParseError("opción global npm sin argumento")
            index += 2
            continue
        if token.startswith("--prefix=") or token.startswith("--workspace="):
            index += 1
            continue
        if token.startswith("-w") and token != "-w":
            index += 1
            continue
        if token in flags:
            index += 1
            continue
        if token.startswith("-"):
            raise ParseError("opción global npm no soportada")
        break
    return tokens[index] if index < len(tokens) else None


def _strip_shell_prefixes(tokens):
    index = 0
    changed = True
    while changed:
        changed = False
        while index < len(tokens) and _ASSIGNMENT.match(tokens[index]):
            index += 1
            changed = True
        while index < len(tokens) and tokens[index] == "!":
            index += 1
            changed = True
    return tokens[index:]


def _analyze_tokens(tokens, depth):
    if depth > MAX_DEPTH:
        raise ParseError("límite de recursión excedido")

    tokens = _strip_shell_prefixes(tokens)
    if not tokens:
        return None
    executable = executable_name(tokens[0])

    if executable == "env":
        remainder = _unwrap_env(tokens, depth + 1)
        return _analyze_tokens(remainder, depth + 1) if remainder else None

    if executable == "command":
        remainder = _unwrap_command(tokens)
        if remainder is None or not remainder:
            return None
        return _analyze_tokens(remainder, depth + 1)

    if executable == "exec":
        remainder = _unwrap_exec(tokens)
        return _analyze_tokens(remainder, depth + 1) if remainder else None

    if executable in SHELLS:
        inner = _shell_inner(tokens)
        return _analyze_command(inner, depth + 1) if inner is not None else None

    if executable == "git":
        subcommand = _git_subcommand(tokens)
        return "git_write" if subcommand in GIT_WRITE else None

    if executable == "npm":
        subcommand = _npm_subcommand(tokens)
        return "npm_dependency_mutation" if subcommand in NPM_MUTATIONS else None

    if executable == "npx":
        return "npx_execution"

    return None


def _analyze_command(command, depth):
    if depth > MAX_DEPTH:
        raise ParseError("límite de recursión excedido")

    nested_category = _analyze_active_structures(command, depth)
    if nested_category:
        return nested_category

    for segment in split_segments(command):
        try:
            tokens = shlex.split(segment, comments=False, posix=True)
        except ValueError as exc:
            raise ParseError(str(exc)) from exc
        category = _analyze_tokens(tokens, depth)
        if category:
            return category
    return None


def classify_command(command):
    command = str(command)
    try:
        return _analyze_command(command, 0)
    except ParseError:
        return "protected_command_unparseable" if protected_hint(command) else None


def evaluate_payload(payload):
    command = str(payload.get("tool_input", {}).get("command", ""))
    blocked = classify_command(command)
    if not blocked:
        return {}
    reason = (
        f"Modelador Propio bloqueó '{blocked}'. "
        "Codex debe proponer la operación y detenerse; "
        "el usuario la ejecutará manualmente después de autorizarla."
    )
    return {
        "hookSpecificOutput": {
            "hookEventName": "PreToolUse",
            "permissionDecision": "deny",
            "permissionDecisionReason": reason,
        }
    }


def main():
    try:
        payload = json.load(sys.stdin)
    except Exception as exc:
        print(f"ERROR - entrada de hook inválida: {exc}", file=sys.stderr)
        return 2
    print(json.dumps(evaluate_payload(payload), ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
