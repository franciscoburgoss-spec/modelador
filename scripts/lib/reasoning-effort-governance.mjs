const ORDINARY_REASONING_EFFORTS = new Set(['low', 'medium', 'high']);

const POLICY_CONTRACTS = [
  '## Niveles permitidos',
  '## Matriz aprobada para el programa actual',
  '## Apertura obligatoria',
  '## Escalamiento a xhigh',
  '`max` está prohibido',
  'No hay tareas preasignadas a `xhigh`.',
];

export function validateReasoningEffortGovernance({
  effortPolicy,
  status,
  specs,
  specTemplate,
  closeTemplate,
}) {
  const errors = [];

  for (const requiredText of POLICY_CONTRACTS) {
    if (!effortPolicy.includes(requiredText)) {
      errors.push(`REASONING_EFFORT.md: falta contrato "${requiredText}"`);
    }
  }

  const activeSpecRow = status.match(/^\| Spec activa \|(.+)\|$/m);
  const activeEffortRow = status.match(/^\| Esfuerzo activo \|(.+)\|$/m);
  if (!activeSpecRow) {
    errors.push('STATUS.md no declara la fila "Spec activa"');
  } else if (!/Ninguna/i.test(activeSpecRow[1])) {
    const activeSpecId = activeSpecRow[1].match(/`(SPEC-[A-Za-z0-9-]+)`/)?.[1];
    if (!activeSpecId) {
      errors.push('STATUS.md no declara un identificador de spec activa entre backticks');
    } else {
      const candidates = Object.keys(specs).filter((filename) => (
        filename.endsWith('.md')
        && (filename === `${activeSpecId}.md` || filename.startsWith(`${activeSpecId}-`))
      ));
      if (candidates.length !== 1) {
        errors.push(
          `Spec activa ${activeSpecId}: se esperaba un archivo único y se encontraron ${candidates.length}`
        );
      } else {
        const filename = candidates[0];
        const activeSpec = specs[filename];
        if (!activeSpec.includes('## Ejecución Codex')) {
          errors.push(`${filename}: falta "## Ejecución Codex"`);
        }
        const planned = activeSpec.match(/^- Esfuerzo planificado: `([^`]+)`$/m)?.[1];
        if (!planned || !ORDINARY_REASONING_EFFORTS.has(planned)) {
          errors.push(`${filename}: esfuerzo planificado debe ser low, medium o high; nunca xhigh`);
        }
        const escalation = activeSpec.match(/^- Escalamiento xhigh: `([^`]+)`$/m)?.[1];
        if (!['prohibido', 'condicionado'].includes(escalation)) {
          errors.push(`${filename}: escalamiento xhigh debe ser prohibido o condicionado`);
        }
        if (!activeEffortRow) {
          errors.push('STATUS.md no declara la fila "Esfuerzo activo"');
        } else {
          const [statusPlanned, statusEffective] = [
            ...activeEffortRow[1].matchAll(/`([^`]+)`/g),
          ].map((match) => match[1]);
          if (!statusPlanned || !statusEffective) {
            errors.push('STATUS.md no declara esfuerzos planificado y efectivo entre backticks');
          } else {
            if (planned && statusPlanned !== planned) {
              errors.push(`Esfuerzo planificado inconsistente: spec=${planned}, STATUS=${statusPlanned}`);
            }
            if (statusEffective !== statusPlanned) {
              errors.push(`Esfuerzo efectivo ${statusEffective} difiere del planificado ${statusPlanned}`);
            }
          }
        }
      }
    }
  } else if (!activeEffortRow || !/Ninguno/i.test(activeEffortRow[1])) {
    errors.push('STATUS.md debe declarar "Esfuerzo activo | Ninguno" cuando no hay spec activa');
  }

  if (!specTemplate.includes('## Ejecución Codex')) {
    errors.push('templates/SPEC.md no exige "## Ejecución Codex"');
  }
  for (const field of ['Esfuerzo planificado', 'Esfuerzo efectivo', 'Escalamiento']) {
    if (!closeTemplate.includes(`| ${field} |`)) {
      errors.push(`templates/SESSION_CLOSE.md no registra "${field}"`);
    }
  }

  return errors;
}
