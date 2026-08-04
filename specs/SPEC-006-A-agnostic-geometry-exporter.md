# SPEC-006-A — Contrato y exportador `agnostic-geometry-v1.0`

## Diagnóstico

La acción actual `Exportar JSON…` serializa directamente el modelo interno v2 completo. Esa salida
mezcla geometría de proyecto con perfiles y derivados Metalcon, modulación, placas OSB, biblioteca,
parámetros, tipos de muro, resultados obsoletos y selección de interfaz. Por ello no puede ser la
entrada estable de SPEC-14 ni de adaptadores constructivos alternativos: cualquier consumidor queda
acoplado al estado y a la solución vigente de la aplicación.

El guardado nativo resuelve otro problema y debe permanecer íntegro. Un archivo
`.modelador.json`, recovery o copia de navegador necesita conservar el modelo completo para poder
seguir editándolo sin pérdida. La frontera nueva es sólo el JSON de intercambio descargable.

El modelo actual contiene referencias a ejes, niveles y fórmulas que deben resolverse antes de
exportar. También contiene huecos como sustracciones, fundaciones por capas y cubiertas que no
siempre declaran espesor. Serializar sólo cajas visibles o filtrar claves prohibidas después de
serializar permitiría omisiones silenciosas y filtraciones futuras.

## Decisión

Crear una proyección pura, explícita y versionada `agnostic-geometry-v1.0`. El contrato usa listas
permitidas y expresa coordenadas cartesianas de proyecto en milímetros, con `x`/`y` en planta y `z`
vertical. Los ejes y niveles conservan IDs y cotas resueltas; cada entidad exportada conserva el ID
de origen y declara únicamente geometría, referencias geométricas y metadatos semánticos mínimos.

Los muros se representan mediante su prisma envolvente y huecos sustractivos; columnas y vigas por
prismas; las fundaciones por los sólidos geométricos que componen su volumen. Las cubiertas se
representan como superficies límite 3D cuando el modelo no declara espesor: el exportador no
inventará un volumen ni copiará perfiles, cerchas, costaneras o patrones. La geometría de cubierta
legacy y moderna se proyecta sólo desde límites, cotas, luces, pendiente o polígono resolubles.

Toda fórmula o referencia se resuelve desde el modelo vigente. Una entidad soportada que no pueda
resolverse, un ID duplicado, un número no finito o un tipo desconocido produce un error tipado con
los IDs involucrados antes de tocar el DOM; nunca se omite ni se reemplaza por un valor por defecto.
La salida es determinista: ordenar colecciones equivalentes del modelo no cambia la serialización.

El archivo nativo, recovery, autosave, importación JSON legacy y `modelVersion` 2 no cambian en este
corte. La futura separación interna/migración v3 consumirá este contrato, pero no es requisito para
establecer la frontera de intercambio.

## Ejecución Codex

- Esfuerzo planificado: `high`
- Escalamiento xhigh: `condicionado`
- Motivo: define un esquema geométrico, resuelve referencias espaciales y separa una frontera de
  persistencia sin pérdida; `xhigh` sólo procede en otra ejecución con insuficiencia observable de
  `high` y aprobación explícita.

## Alcance

- Definir en un módulo puro el esquema, proyección, validación y serialización canónica de
  `agnostic-geometry-v1.0`.
- Declarar unidades y convención de coordenadas; normalizar `grid.xAxes`, `grid.yAxes` y
  `grid.zLevels` con IDs únicos y cotas finitas.
- Proyectar todos los `elements` geométricos actuales: muros, huecos, columnas, vigas y fundaciones.
- Proyectar `roofSystems` legacy y `roofPlanes` modernos como geometría límite sin miembros,
  perfiles, modulación ni espesores inventados.
- Resolver ejes, niveles, parámetros, fórmulas y referencias antes de emitir el archivo.
- Rechazar de forma atómica y visible geometría desconocida, duplicada, no finita o no resoluble.
- Integrar la descarga mediante un adaptador DOM inyectable/aislado, MIME JSON y nombre
  `geometria-agnostica.json`; revocar siempre el object URL.
- Cambiar la etiqueta del menú a `Exportar geometría JSON…` sin alterar `Importar JSON…` ni las
  acciones nativas Abrir/Guardar.
- Registrar el exportador como salida `live`: no consume derivados constructivos ni depende de sus
  flags stale.
- Cubrir `casa-L`, FX-003, FX-004 y modelos mínimos/adversarios con pruebas automáticas.
- Actualizar estado, trazabilidad, riesgos y decisiones estables; generar el cierre desde
  `templates/SESSION_CLOSE.md`.

## Fuera de alcance

- Cambiar `modelVersion`, migrar el modelo interno a v3 o borrar campos Metalcon/OSB existentes.
- Cambiar el formato, validación o contenido del archivo nativo, recovery, autosave o copia del
  navegador.
- Implementar SPEC-08 a SPEC-14, clasificar estructuralmente, modular o producir una solución
  Metalcon, madera, SIP o albañilería.
- Agregar `structuralIntent`, materiales, perfiles, fijaciones, resistencias, cargas, resultados,
  metrados, DXF o INP al contrato agnóstico.
- Fabricar espesor de cubierta, roles estructurales, soportes o geometría faltante mediante
  heurísticas constructivas.
- Corregir deudas ajenas del solver de cubierta, refactorizar el store o retirar exportadores
  constructivos existentes.
- Usar `xhigh` sin la nueva ejecución, evidencia y aprobación exigidas por D-044.

## Criterios de aceptación

1. La raíz emitida declara exactamente `schema: "agnostic-geometry-v1.0"`, unidades, convención de
   coordenadas, `grid` y colecciones geométricas documentadas; todos sus números son finitos.
2. `casa-L` proyecta sus 45 muros, todos sus vanos, cuatro fundaciones y dos geometrías de cubierta
   legacy sin omitir IDs; no contiene perfiles, montantes, dinteles constructivos, OSB, materiales,
   tipos de muro, biblioteca, defaults, resultados stale ni estado de UI.
3. FX-003 conserva paredes, columnas, vigas, fundaciones y huecos que existan; FX-004 conserva su
   polígono/superficie de cubierta resoluble sin copiar plantilla, perfiles, paso o miembros.
4. Referencias a ejes/niveles y expresiones válidas se convierten en coordenadas y dimensiones
   explícitas. La salida no requiere `projectParams` para interpretarse.
5. Huecos se expresan como vacíos vinculados al muro y fundaciones multicapa conservan cada sólido
   de volumen positivo, sin depender de cajas Three.js ni intercambiar `y` con `z`.
6. Un elemento de tipo desconocido, una referencia rota, un ID duplicado, una dimensión inválida o
   un `NaN`/infinito devuelve error tipado con contexto y no crea Blob, enlace ni descarga.
7. La serialización es canónica, termina en newline y produce los mismos bytes al reordenar ejes,
   niveles, elementos, huecos o fuentes de cubierta equivalentes.
8. El adaptador descarga una sola vez `geometria-agnostica.json` con MIME
   `application/json;charset=utf-8`, revoca el URL también si falla `click` y no muta el modelo.
9. El menú distingue `Exportar geometría JSON…` de `Importar JSON…`; la política del exportador es
   `live` y no muestra ni incorpora advertencias de derivados constructivos stale.
10. Un roundtrip de `serializeNativeProject` conserva campos Metalcon/OSB y estado editable del
    fixture, demostrando que el cambio no convirtió el archivo nativo en intercambio agnóstico.
11. Una prueba de reversión demuestra que reemplazar la lista permitida por serialización directa o
    retirar el rechazo de geometría no resoluble hace fallar la suite enfocada.
12. `make governance`, pruebas enfocadas, cobertura, `npm run validate`, build y auditoría del
    lanzador pasan. No se exige una nueva auditoría DXF ni smoke CalculiX fuera de la puerta completa
    porque este corte no modifica sus generadores ni artefactos.
13. El cierre compara esfuerzo planificado, enviado y efectivo en `high`; si `high` es suficiente,
    no se abre ni se registra una ejecución `xhigh`.

## Evidencia

- Pruebas unitarias del contrato puro con snapshots/objetos exactos de `casa-L`, FX-003 y FX-004.
- Corpus adversario de IDs duplicados, referencias rotas, valores no finitos y tipo desconocido.
- Pruebas de determinismo por permutación y de ausencia recursiva de claves constructivas/UI.
- Prueba del adaptador DOM y prueba de componente/store para etiqueta, error visible y descarga.
- Regresión de `nativeProjectFile` con campos constructivos preservados.
- Prueba de la prueba sobre allowlist y omisión no resoluble.
- `make governance`, `npm run validate`, `npm run codex:audit` y `git diff --check`.
- Cierre `sessions/close-SPEC-006-A.md` y eventos append-only en
  `governance/CODEX_EXECUTIONS.jsonl`.

## Corte sugerido

Detener con el contrato v1 y la descarga agnóstica integrados, sin migrar el estado interno. El
siguiente corte separa autoridades editables/constructivas en el modelo v3 y migra sin pérdida los
proyectos existentes usando esta frontera como contrato externo estable.
