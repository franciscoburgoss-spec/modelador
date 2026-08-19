function attrs(raw) {
  return Object.fromEntries([...raw.matchAll(/(\w+)=([^\s>]+)/g)].map((m) => [m[1], m[2]]));
}

export function validateScopeLockGovernance({ status, decisions, specs }) {
  const errors = [];
  const active = [...status.matchAll(/<!-- ACTIVE-SCOPE ([^>]+) -->/g)].map((m) => attrs(m[1]));
  if (active.length !== 1) return [`STATUS.md debe declarar exactamente un ACTIVE-SCOPE; encontrados ${active.length}`];
  const scope = active[0];
  const statusSpec = status.match(/\|\s*Spec activa\s*\|\s*`([^`]+)`/);
  if (!statusSpec || statusSpec[1] !== scope.spec) errors.push(`ACTIVE-SCOPE spec=${scope.spec} no coincide con Spec activa`);
  const authorizedBy = (scope.authorizedBy || "").split(",").filter(Boolean);
  const decisionIds = new Set([...decisions.matchAll(/\|\s*(D-\d{3})\s*\|/g)].map((m) => m[1]));
  for (const id of authorizedBy) if (!decisionIds.has(id)) errors.push(`ACTIVE-SCOPE referencia decisión inexistente ${id}`);
  const locks = [...decisions.matchAll(/<!-- SCOPE-LOCK ([^>]+) -->/g)].map((m) => attrs(m[1]));
  const lock = locks.find((item) => authorizedBy.includes(item.decision) && item.spec === scope.spec && item.subcut === scope.subcut && item.phase === scope.phase && item.technicalSections === scope.technicalSections);
  if (!lock) errors.push("ACTIVE-SCOPE no posee SCOPE-LOCK autorizante equivalente en DECISIONS.md");
  const candidates = Object.entries(specs).filter(([name]) => name.startsWith(`${scope.spec}-`));
  if (candidates.length !== 1) return [...errors, `ACTIVE-SCOPE ${scope.spec} debe resolver exactamente una spec; encontradas ${candidates.length}`];
  const maps = [...candidates[0][1].matchAll(/implementationSubcut=([^\s]+)\s+technicalSections=([^\s]+)\s+phase=([^\s]+)\s+authorizedBy=([^\s`]+)/g)].map((m) => ({ subcut: m[1], technicalSections: m[2], phase: m[3], authorizedBy: m[4] }));
  if (!maps.some((item) => item.subcut === scope.subcut && item.technicalSections === scope.technicalSections && item.phase === scope.phase && item.authorizedBy === scope.authorizedBy)) errors.push("ACTIVE-SCOPE no coincide con el mapa contractual de la spec activa");
  return errors;
}
