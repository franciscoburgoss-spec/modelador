# SPEC-GOV-A — Política de esfuerzo de razonamiento

## Diagnóstico

El repositorio define alcance, pruebas y cierre por spec, pero no declara qué esfuerzo de
razonamiento debe usar Codex. La elección queda implícita en la sesión o en la configuración
personal, por lo que una tarea mecánica puede consumir `high` sin necesidad y una tarea crítica
puede abrirse con un nivel insuficiente.

La configuración personal observada al abrir este corte usa `gpt-5.6-sol` con
`model_reasoning_effort = "high"`. La documentación oficial permite fijar el esfuerzo mediante
configuración, perfiles, overrides por ejecución y tareas programadas, pero una instrucción en
`AGENTS.md` no cambia por sí sola el runtime de una conversación ya iniciada.

Desviación previa: `make governance` falla por 42 secciones obligatorias ausentes en las nuevas
SPEC-08 a SPEC-13 no versionadas. Este corte no reescribe esas specs.

## Decisión

Crear una autoridad `governance/REASONING_EFFORT.md` con una matriz vinculante y aplicar estas
reglas:

1. sólo `low`, `medium` y `high` pueden planificarse de forma ordinaria;
2. `high` es el techo ordinario, incluso para migraciones, topología y criterios estructurales;
3. ninguna tarea se planifica inicialmente en `xhigh`;
4. `xhigh` requiere insuficiencia observable en `high`, aprobación explícita del usuario y una
   nueva ejecución separada;
5. `max` queda prohibido mientras una decisión posterior no lo habilite;
6. la spec activa y `STATUS.md` deben declarar esfuerzos planificado y efectivo iguales antes de
   ejecutar trabajo;
7. `make governance` verifica mecánicamente ese contrato.

La elección se hace por riesgo y forma de la tarea, no por tamaño del documento ni por duración
esperada.

## Ejecución Codex

- Esfuerzo planificado: `high`
- Escalamiento xhigh: `prohibido`
- Motivo: cambia autoridades de gobernanza y el gate que habilita todas las sesiones posteriores.

## Alternativas descartadas

| Alternativa | Motivo |
|---|---|
| Planificar SPEC-14, modelo v3 y Metalcon en `xhigh` | No existe evidencia de que `high` sea insuficiente; eleva consumo por anticipación |
| Usar siempre el valor global de Codex | No distingue tareas mecánicas, documentales y críticas |
| Confiar sólo en una instrucción de `AGENTS.md` | No verifica el valor efectivo del runtime ni deja evidencia de cierre |
| Cambiar esfuerzo dentro de la misma conversación | No es una garantía de configuración; el cambio confiable requiere una ejecución nueva |

## Alcance

- Política y matriz de esfuerzo del proyecto.
- Declaración obligatoria en spec, estado y cierre.
- Actualización de `AGENTS.md`, protocolo, gate G0 y plantillas.
- Validación de la spec activa y del esfuerzo declarado.
- Decisión, riesgo y trazabilidad asociados.

## Fuera de alcance

- Crear o modificar perfiles en `~/.codex`.
- Lanzar automaciones o subagentes.
- Cambiar el modelo predeterminado de la cuenta.
- Corregir o implementar SPEC-08 a SPEC-14.
- Medir facturación o cuotas internas de la cuenta.

## Criterios de aceptación

1. Existe una autoridad única que define niveles, matriz planificada y escalamiento.
2. Ninguna tarea planificada comienza en `xhigh`; `high` es el techo ordinario.
3. `AGENTS.md` y `PROTOCOL.md` impiden trabajar si esfuerzo planificado y efectivo difieren.
4. La plantilla de spec exige declarar esfuerzo y la de cierre registra el efectivo.
5. `make governance` falla si una spec activa carece de declaración, usa un nivel no permitido o
   difiere del esfuerzo efectivo declarado en `STATUS.md`.
6. La decisión y el requisito quedan registrados en gobernanza.
7. La validación enfocada del nuevo contrato pasa; cualquier fallo global previo queda identificado
   sin atribuirlo a este corte.

## Evidencia

- `governance/REASONING_EFFORT.md`.
- `scripts/validate-governance.mjs` y ejecución enfocada con casos válido/inválido.
- `make governance` con comparación contra el baseline previo.
- Diff de `AGENTS.md`, protocolo, plantillas, decisión, riesgo y trazabilidad.

## Corte sugerido

Detener después de que la selección de esfuerzo sea verificable en G0 y antes de crear perfiles,
wrappers o automaciones personales.
