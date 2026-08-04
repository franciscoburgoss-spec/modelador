# Política de esfuerzo de razonamiento

> Autoridad del proyecto para seleccionar y auditar el esfuerzo de razonamiento de Codex. La
> configuración efectiva del runtime sigue perteneciendo a la superficie que inicia la tarea.

## Principios

1. El esfuerzo se decide antes de ejecutar la spec o corte.
2. Se elige por riesgo y necesidad de razonamiento, no por cantidad de archivos, longitud de la
   spec, duración de tests o prestigio de la tarea.
3. Se usa el nivel más bajo que conserve los criterios de aceptación y la evidencia exigida.
4. `high` es el techo ordinario del proyecto.
5. Ninguna tarea puede planificarse inicialmente en `xhigh`.
6. `max` está prohibido hasta que una decisión posterior lo habilite con evidencia comparativa.
7. Una sesión con esfuerzo distinto del plan no comienza trabajo: se relanza con el valor correcto.

## Niveles permitidos

| Nivel | Uso |
|---|---|
| `low` | Lectura acotada, inventario, búsqueda, formato o cambio mecánico con resultado determinista y sin decisiones de dominio |
| `medium` | Documentación gobernada, pruebas, fixtures, UI local o implementación acotada con contratos ya decididos |
| `high` | Arquitectura, esquemas y migraciones, persistencia, seguridad, topología, geometría, invalidación, DXF complejo y criterios estructurales |
| `xhigh` | Escalamiento excepcional después de demostrar que una ejecución `high` fue insuficiente |
| `max` | Prohibido |

Si una tarea mezcla categorías, gobierna el nivel más alto. Dividir una spec en cortes es preferible
a elevar el esfuerzo de toda la sesión.

## Matriz aprobada para el programa actual

| Trabajo | Esfuerzo inicial |
|---|---|
| Política de esfuerzo y enforcement G0 (`SPEC-GOV-A`) | `high` |
| Normalización gobernable de SPEC-08 a SPEC-14 | `medium` |
| Contrato y exportador `agnostic-geometry-v1.0` | `high` |
| Separación interna y migración del modelo v3 | `high` |
| Reconocimiento topológico SPEC-14, dividido por fases | `high` |
| Primer adaptador de solución Metalcon | `high` |
| Convención de coordenadas y composición de elevaciones | `high` |
| Reglas DXF y layout model space/paper space | `high` |
| Auditorías, fixtures, goldens y actualizaciones mecánicas de evidencia | `medium` |
| Adaptadores madera, SIP y albañilería | `high` |

No hay tareas preasignadas a `xhigh`.

## Apertura obligatoria

La spec activa debe contener:

```markdown
## Ejecución Codex

- Esfuerzo planificado: `low|medium|high`
- Escalamiento xhigh: `prohibido|condicionado`
- Motivo: ...
```

`governance/STATUS.md` declara separadamente el esfuerzo efectivo observado al abrir la sesión.
Antes de leer código afectado, editar o ejecutar pruebas de implementación se debe comprobar:

```text
esfuerzo efectivo == esfuerzo planificado
```

Si no coincide, se detiene la apertura y se crea una ejecución nueva. Un valor mayor tampoco se
acepta por comodidad: usar `high` para una tarea planificada en `medium` contradice el objetivo de
optimización.

El lanzador oficial del proyecto lee el esfuerzo desde la spec activa. Se inspecciona primero sin
efectos y luego se abre la ejecución:

```bash
npm run codex:dry-run -- "Ejecuta la spec activa"
npm run codex:spec -- "Ejecuta la spec activa"
```

El lanzador usa argumentos separados con `shell: false` y registra la comparación entre esfuerzo
planificado, enviado y confirmado en el cierre. Los overrides directos quedan sólo para recuperar
un entorno donde el lanzador aún no exista; no constituyen una ejecución gobernada auditable.

Las tareas programadas deben fijar explícitamente modelo y esfuerzo; no deben dejar ambos en el
valor predeterminado. Los perfiles personales son válidos, pero no se versionan en este repositorio.

## Escalamiento a xhigh

Sólo se considera después de una ejecución real en `high`. Deben cumplirse todas estas condiciones:

1. existe una insuficiencia observable: contradicción no resuelta, resultado no determinista,
   amenaza de pérdida de datos o incapacidad de aislar una falla crítica;
2. la insuficiencia no proviene del entorno, dependencias, permisos, falta de fuente o criterio de
   aceptación incompleto;
3. dividir el corte o mejorar la evidencia no resuelve el problema;
4. `STATUS.md` o `RISKS.md` registra la evidencia;
5. el usuario aprueba explícitamente el escalamiento;
6. se inicia una sesión nueva en `xhigh`.

Terminado el diagnóstico excepcional, implementación mecánica y verificación vuelven a `high` o al
nivel originalmente planificado. Nunca se escala automáticamente por reintento.

## Subagentes

Un subagente sólo se usa cuando las reglas vigentes permiten delegación. Cada subtask declara su
propio esfuerzo; por defecto hereda o usa un nivel menor que la tarea principal. Aplican las mismas
prohibiciones para `xhigh` y `max`.

## Cierre y auditoría

El cierre registra esfuerzo planificado, efectivo y cualquier escalamiento. G0 falla cuando:

- la spec activa no tiene `## Ejecución Codex`;
- el nivel inicial no es `low`, `medium` o `high`;
- `STATUS.md` no declara el esfuerzo efectivo;
- el esfuerzo efectivo difiere del planificado;
- se declara `xhigh` sin aprobación y evidencia;
- las plantillas dejan de exigir estos datos.

La documentación prueba selección deliberada y trazabilidad. La garantía técnica final depende de
que la sesión o automatización se haya iniciado con el valor declarado; Codex no puede cambiar de
forma confiable el runtime de una conversación ya iniciada sólo por leer este archivo.

## Fuentes oficiales

- [Referencia de configuración de Codex](https://developers.openai.com/codex/config-reference)
- [Perfiles y overrides por ejecución](https://developers.openai.com/codex/config-advanced)
- [Tareas programadas](https://developers.openai.com/codex/app/automations)
- [Guía de selección y esfuerzo de modelos](https://developers.openai.com/api/docs/guides/latest-model)
