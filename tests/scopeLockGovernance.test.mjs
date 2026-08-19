import test from "node:test";
import assert from "node:assert/strict";
import { validateScopeLockGovernance } from "../scripts/lib/scope-lock-governance.mjs";

const status = `| Spec activa | \`SPEC-016-B\` |
<!-- ACTIVE-SCOPE spec=SPEC-016-B subcut=B3.2 phase=READ-ONLY technicalSections=B3.2,B3.3,B3.4 authorizedBy=D-076,D-077 -->`;

const decisions = `| D-076 | x |
| D-077 | x |
<!-- SCOPE-LOCK decision=D-077 spec=SPEC-016-B subcut=B3.2 phase=READ-ONLY technicalSections=B3.2,B3.3,B3.4 -->`;

const spec = `implementationSubcut=B3.2
technicalSections=B3.2,B3.3,B3.4
phase=READ-ONLY
authorizedBy=D-076,D-077`;

function validate(overrides = {}) {
  return validateScopeLockGovernance({
    status,
    decisions,
    specs: { "SPEC-016-B-adaptador-metalcon.md": spec },
    ...overrides,
  });
}

test("scope-lock acepta STATUS, DECISIONS y SPEC equivalentes", () => {
  assert.deepEqual(validate(), []);
});

test("scope-lock rechaza decisión autorizante inexistente", () => {
  const broken = status.replace("D-076,D-077", "D-076,D-099");
  assert.ok(validate({ status: broken }).some((error) => error.includes("decisión inexistente D-099")));
});

test("scope-lock rechaza ausencia del lock aprobado", () => {
  const broken = decisions.replace(/<!-- SCOPE-LOCK[^\n]+-->/, "");
  assert.ok(validate({ decisions: broken }).some((error) => error.includes("no posee SCOPE-LOCK")));
});

test("scope-lock rechaza scope drift en secciones técnicas", () => {
  const broken = status.replace("B3.2,B3.3,B3.4", "B3.2,B3.3,B3.4,B3.5");
  const errors = validate({ status: broken });
  assert.ok(errors.some((error) => error.includes("SCOPE-LOCK")));
  assert.ok(errors.some((error) => error.includes("mapa contractual")));
});

test("scope-lock rechaza discrepancia con Spec activa", () => {
  const broken = status.replace("spec=SPEC-016-B", "spec=SPEC-016-X");
  assert.ok(validate({ status: broken }).some((error) => error.includes("no coincide con Spec activa")));
});

test("scope-lock exige exactamente un ACTIVE-SCOPE", () => {
  assert.ok(validate({ status: "| Spec activa | `SPEC-016-B` |" }).some((error) => error.includes("exactamente un ACTIVE-SCOPE")));
});
