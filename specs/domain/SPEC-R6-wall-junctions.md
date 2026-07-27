# Spec R6 — Encuentros L/T y traslape de esquina

> Sexta unidad del plan de reglas de dominio.
> Base: commit `7cd4e16`, suite 625/625.
> Decisiones de origen: legado **D-024**, **D-033**, **D-034** y **D-036**;
> gobernanza **D-008** y **D-021–D-023**.

## Diagnóstico

`detectWallCorners` no detecta una topología de encuentros. Para cada extremo del muro consultado
recorre todos los demás muros y reduce cualquier coincidencia punto-segmento a un booleano:

```js
{ start: boolean, end: boolean }
```

El resultado tiene seis defectos observables:

1. su comentario promete “otro muro del mismo nivel”, pero no compara cotas Z;
2. acepta muros paralelos/colineales, aunque no forman L ni T;
3. no distingue extremo-extremo (L) de extremo-cuerpo (T);
4. no identifica los muros participantes y descarta silenciosamente coincidencias múltiples;
5. `start/end` siguen `geo.p1/p2`, mientras `computeStudLayout` guarda offsets desde
   `worldMin`; en un muro declarado en sentido decreciente se marcaría el extremo opuesto;
6. sólo observa extremos del muro consultado: en una T no informa al muro anfitrión que necesita
   respaldo en un offset interior.

La medición reproducible de `tests/fixtures/casa-L.json` sobre sus 45 muros y 90 extremos confirma:

- el detector vigente marca 88 extremos y el fixture persiste 88 `corner` + 88 `backup`;
- encuentra 120 coincidencias dirigidas: 96 perpendiculares y 24 paralelas;
- 4 de las 120 no tienen traslape vertical;
- filtrando perpendicularidad y traslape Z quedan 83 extremos válidos; 5 flags actuales no
  representan una L/T;
- 28 extremos tienen más de un candidato bruto y 9 conservan más de un candidato perpendicular;
- al partir la topología por bandas Z aparecen 80 nodos/bandas: 23 L, 35 T, 18 uniones rectas y
  4 terminales;
- hay 26 llegadas T directas de extremo a cuerpo: 7 coinciden con un `stud` existente y 19 no
  tienen ningún montante anfitrión; esas 19 piezas sumarían 67,3 m antes de recalcular cadenetas;
- ninguna de las 26 T cae dentro de un vano ni sobre una jamba en el fixture actual.

Por tanto, quitar 88 `backup` no implica que el total baje en 88: como mínimo aparecen los 19
respaldos T ausentes, siete montantes se reclasifican y el nuevo apoyo subdivide cadenetas. El
baseline de R3 (1.473 piezas / 2.679,051 m) debe medirse nuevamente después del solver, no
corregirse por resta manual.

El problema se propaga fuera del solver:

- `computeOsbPanelLayout` trabaja siempre en `[0, length]`, calcula vanos desde `worldMin` y no
  recibe el encuentro ni un origen de revestimiento;
- `wallOffsetToWorldPoint` proyecta desde `geo.p1`, contrario al origen normalizado que usan
  Metalcon, OSB, openings y DXF;
- editar/agregar/eliminar/dividir/unir un muro puede cambiar los encuentros de otros, pero el
  registro central sólo invalida el muro editado; `addElement` y `addElements` ni siquiera
  invalidan derivados de vecinos;
- CalculiX consume todos los montantes salvo `nogging`, de modo que corregir L/T cambia el INP
  aunque no se modifique el emisor;
- la leyenda aún describe `corner` como pilar formado con `backup`, y los consumidores conservan
  el rol legacy `backup`.

Las fuentes primarias consultadas el 27-jul-2026 fijan el detalle, no la política de elección:

- [Manual Práctico de Construcción LP, capítulo 4, p. 70](https://lpchile.cl/wp-content/uploads/2017/08/04_MUROS-65_80.pdf)
  muestra el pilar conformado contiguo en L/T y el OSB sólo en el encuentro L;
- [Manual de Diseño Metalcon Cintac 2020, Anexo IV, p. 70](https://www.cintac.cl/wp-content/uploads/2020/09/Manual-de-Disen%CC%83o-Metalcon-2020-LW.pdf)
  prescribe la costura N°10×3/4″ @150 en toda la altura, zig-zag.

La prioridad “muro más largo → mayor |dx| → menor id” sigue siendo una regla de oficina
preexistente (legado D-024), no una atribución a esos manuales.

## Decisión

### 1. Frame local único

`elementGeometry` expone un frame local canónico para todo muro resuelto:

```js
{
  runAxis: 'x' | 'y',
  origin: { x, y },       // extremo de menor coordenada sobre el eje de corrida
  end: { x, y },          // extremo de mayor coordenada
  length,
  declaredStartSide: 'start' | 'end'
}
```

Los offsets persistidos de montantes, dinteles, vanos y placas se interpretan siempre desde
`origin`; `start` significa offset 0 y `end` significa `length`, con independencia del orden
declarado en `xStart/xEnd/yStart/yEnd`. `wallOffsetToWorldPoint` delega en ese frame.

No se migran datos: el baseline no tiene muros decrecientes y ya guarda offsets desde `worldMin`.
Un fixture nuevo con ambos sentidos demuestra que invertir la declaración no invierte piezas,
vanos ni extremos L/T.

### 2. Topología global por nodos y bandas Z

Se crea `core/wallJunctions.js`, puro y sin React/store. Su entrada es el modelo geométrico
resuelto y su salida no se persiste. El algoritmo:

1. agrupa coordenadas de extremos dentro de una tolerancia explícita de 5 mm;
2. incorpora cada muro cuyo segmento contiene el nodo;
3. parte la altura en bandas usando todas las cotas inferiores/superiores participantes;
4. en cada banda considera sólo muros con traslape vertical positivo;
5. registra por participante `wallId`, `offset`, `position: start|end|body`, eje y rayo;
6. clasifica por rayos únicos:
   - dos rayos perpendiculares: `L`;
   - tres rayos, con un eje continuo y otro terminal: `T`;
   - dos opuestos: `straight`, no es encuentro;
   - uno: `terminal`, no es encuentro;
   - cuatro: `X`, reconocido pero no transformado por R6;
   - geometría duplicada/solapada: `ambiguous`, nunca elegida por orden del array.

Bandas Z adyacentes con participantes, rayos y tipo idénticos se fusionan. El ID del nodo se
deriva de coordenada/banda/participantes ordenados, no del orden de `model.elements`.

La vista por muro mantiene compatibilidad truthy, pero deja de perder candidatos:

```js
{
  start: null | { tipo: 'L'|'T', wallId, matches: [{ wallId, tipo, nodeId }] },
  end:   null | { tipo: 'L'|'T', wallId, matches: [{ wallId, tipo, nodeId }] },
  interior: [{ tipo: 'T', wallId, offset, nodeId }]
}
```

`wallId` es el candidato primario determinista para compatibilidad/presentación; `matches` es la
autoridad. `start/end` son los extremos del frame local, no `geo.p1/p2`. `detectWallCorners`
queda como adaptador temporal de esa vista y ningún consumidor nuevo recorre paredes por su
cuenta.

### 3. Prioridad de traslape L

Para cada banda L se elige un solo muro que lapa mediante esta tupla descendente:

```text
(largo resuelto, |p2.x - p1.x|, inverso del id estable)
```

Es decir: mayor largo; empate, mayor `|dx|`; nuevo empate, menor ID. Los IDs enteros decimales se
comparan como enteros, incluidos los guardados como string; los demás, por código Unicode de su
representación string. Reordenar `model.elements` no cambia el ganador.

Un extremo puede participar en más de una banda L. Si todas producen el mismo estado
`lap|butt`, se consolida. Si lo contradicen, el encuentro queda `ambiguous`: no se aplica un
traslape parcial ni se elige el primer candidato.

### 4. Pilar conformado sin `backup`

El generador deja de emitir `role:'backup'` y elimina `backupOffset` de su configuración pública.
No se borran piezas legacy al importar: se siguen renderizando, metrando y exportando hasta que el
usuario regenere, evitando descarte silencioso.

En un encuentro resuelto:

- L: cada muro conserva un `corner` en su extremo; los dos perfiles coincidentes forman el pilar;
- T extremo-cuerpo: el muro que llega conserva su `corner`; el anfitrión garantiza un montante
  `corner` en el offset interior;
- si el anfitrión ya tenía un `stud` de altura completa en ese offset, se reclasifica sin duplicar;
- si el offset coincide con un vano abierto, una pieza parcial o una geometría ambigua, la
  regeneración falla explícitamente para esos muros; nunca atraviesa el vano ni omite el respaldo;
- el solver conserva una sola pieza vertical por muro/offset/rango. La unión entre paneles
  colineales independientes no se deduplica entre entidades: compartir una pieza a través de dos
  derivados persistidos exigiría un dueño global fuera del formato actual.

La leyenda cambia `T` a “Pilar conformado esquina/T” y agrega la nota de costura
“N°10×3/4″ @150 en toda la altura, zig-zag”. `R` permanece rotulado sólo para derivados legacy;
el nuevo solver y sus pruebas deben producir cero `backup`.

### 5. Envolvente de OSB en L

El traslape modifica sólo la envolvente de revestimiento, no el largo estructural del muro, sus
soleras ni el largo contable para capacidad. Se usan las caras de los muros resueltas desde sus
ejes, sin inventar un espesor de placa que el modelo no declara.

Para una L entre el muro que lapa `A` y el que recibe `B`, en el extremo del nodo:

```text
inset(A) = -thickness(B) / 2   // A se prolonga hasta la cara lejana de B
inset(B) = +thickness(A) / 2   // B termina en la cara próxima de A
```

Un inset negativo prolonga; uno positivo retranquea. Para cada muro:

```text
osbStart = startInset
osbEnd = length - endInset
osbLength = osbEnd - osbStart
```

El cálculo interno traslada a ese frame los offsets de montantes y vanos. El anclaje de corredores,
la detección de vano pegado al borde y `MIN_EDGE_MARGIN` usan `[osbStart, osbEnd]`; al persistir,
`panel.start/end` vuelven al frame nominal del muro y pueden quedar fuera de `[0, length]`.
Preview, DXF y proyección a mundo deben aceptar esos offsets sin clamp.

T, `straight`, `terminal`, `X` y `ambiguous` no alteran OSB. Una L con espesor no resoluble bloquea
su regeneración; no cae silenciosamente al origen nominal. El gap entre placas conserva la fuente
efectiva de R5 y no se usa como distancia de esquina.

### 6. Invalidación y regeneración coordinada

La topología hace que framing/OSB de un muro dependan de la geometría, niveles y espesor de todos
los muros conectables. El registro central gana una mutación de topología que invalida
conservadoramente `wallFraming` y `wallOsb` en todos los muros cuando se:

- agrega uno o varios muros;
- edita geometría, niveles, dirección o espesor de un muro;
- elimina, divide o une muros.

La invalidación de cerchas conserva su alcance dependiente actual. Vanos, tipos y configuración de
un solo muro no amplían su invalidación a vecinos.

Modulación individual, batch y “Generar todos” calculan una topología común por operación. El batch
no aplica patches parciales si existe una dependencia L/T ambigua o irresoluble entre muros
seleccionados; devuelve razones con todos los `wallIds`. Regenerar framing vuelve stale el OSB como
ya exige el contrato central.

## Alternativas descartadas

| Alternativa | Motivo |
|---|---|
| Cambiar sólo el booleano por el primer `{wallId,tipo}` encontrado | Sigue dependiendo del orden del array y descarta 28 extremos multicandidato del fixture |
| Considerar toda coincidencia extremo-segmento como L/T | Conserva 24 falsos positivos paralelos y 4 sin traslape Z |
| Mantener `geo.p1/p2` como `start/end` | Aplica el encuentro al lado opuesto en muros declarados en sentido decreciente |
| Quitar 88 `backup` y rebaselinar por resta | Omite 19 respaldos T ausentes, siete reclasificaciones y el nuevo despiece de cadenetas |
| Conservar `backup` a 100 mm para resolver la T | No respalda el cuerpo del anfitrión y contradice el pilar contiguo del detalle oficial |
| Deducir la T desde el paso regular del anfitrión | En 19/26 llegadas directas de `casa-L` no existe montante en el punto |
| Deduplicar una pieza entre dos entidades de muro colineales | El formato persiste derivados por muro y no puede declarar propiedad/altura compartida sin otra migración |
| Extender OSB también en T | El detalle T usa terminación interior; el roadmap y la fuente reservan el OSB de esquina a L |
| Usar largo, dirección de cerchas o rol para decidir el traslape | Cerchas/rol no definen la esquina; legado D-024 ya fija una prioridad geométrica total |
| Invalidar sólo el muro editado | Deja vigentes derivados de vecinos cuya L/T, pilar u origen OSB cambió |

## Alcance

- Frame local canónico y proyección offset→mundo para muros en ambos sentidos.
- Módulo puro de nodos L/T por bandas Z y vista por muro sin pérdida de candidatos.
- Prioridad de traslape determinista del legado D-024.
- Adopción en modulación individual y batch.
- Eliminación de `backup` en nueva generación; respaldo interior del anfitrión T.
- Rebaseline de cadenetas y metrado por rol de `casa-L`.
- Envolvente/origen OSB por extremo L, incluidos vanos y `MIN_EDGE_MARGIN`.
- Invalidación central por mutaciones de topología.
- Preview, render 2D y DXF afectados por offsets OSB extendidos/retranqueados.
- Leyenda/nota constructiva del pilar conformado.
- Pruebas de regresión, reversión, auditoría DXF y smoke CalculiX real.

## Fuera de alcance

- Migrar o borrar `backup` de archivos al importar.
- Compartir una misma pieza persistida entre dos entidades de muro colineales.
- Generar tornillos individuales o metrarlos.
- Resolver encuentros X; se reconocen y no se confunden con L/T.
- Inferir qué cara del muro es exterior o agregar capas/espesor propio de OSB.
- Cambiar el gap de placas, nesting, rol o `wallTypes`.
- Implementar checks R7 o informe R8.
- Modificar capacidades de corte, cargas, secciones o el emisor CalculiX.
- Resolver las seis cadenetas menores a 30 mm pendientes de R7.

## Criterios de aceptación

1. El frame local usa siempre la menor coordenada como offset 0. Dos muros idénticos declarados en
   sentidos opuestos producen `deepEqual` en studs, headers, OSB y posiciones mundo.
2. El analizador clasifica L/T/straight/terminal/X/ambiguous usando perpendicularidad, bandas Z y
   tolerancia explícita; no clasifica paralelos ni muros sin traslape vertical como L/T.
3. La salida es invariante al orden de elementos, conserva todos los matches y asigna
   `start/end/body` en offsets normalizados. El fixture cubre candidato múltiple y muro invertido.
4. La prioridad L cumple largo → `|dx|` → menor ID para IDs numéricos, numéricos-string y UUID; un
   conflicto vertical queda `ambiguous`, nunca first-match.
5. La nueva generación produce cero `backup`. Una L simple tiene dos `corner` contiguos y una T
   simple tiene el `corner` de llegada más un `corner` anfitrión en el offset exacto.
6. Un apoyo T existente se reclasifica sin duplicarse; uno ausente se agrega. Una llegada dentro
   de vano/contra pieza incompatible bloquea la regeneración con todos los `wallIds`.
7. `casa-L` reconoce los conteos diagnósticos o documenta cualquier corrección del algoritmo,
   produce cero `backup`, respalda las 26 T directas y registra el nuevo total por rol, piezas y
   metros sin aritmética manual.
8. Una L aplica los insets firmados de media cara; T y tipos no L conservan `deepEqual`. Vanos,
   `MIN_EDGE_MARGIN` y corredores usan la envolvente OSB efectiva.
9. Paneles con offsets negativos o mayores al largo nominal se proyectan igual en preview, DXF
   R12 y láminas AC1015; el largo estructural, soleras y capacidad no cambian.
10. Agregar/editar/eliminar/dividir/unir muros invalida framing+OSB de todos los muros mediante el
    registro central, preservando el alcance actual de cerchas; vanos y tipos siguen locales.
11. Individual, batch y combinado consumen una única topología y no hacen commit parcial ante una
    dependencia ambigua/irresoluble.
12. La leyenda describe el pilar conformado y la costura; derivados legacy con `backup` siguen
    visibles/metrados hasta regenerar.
13. Revertir por separado frame/topología, pilar T/supresión de `backup`, invalidación y origen OSB
    rompe al menos una prueba focalizada de cada corte.
14. `make governance` y `npm run validate` terminan con código 0. Cada DXF modificado pasa
    `ezdxf doc.audit()` con 0 errores/0 reparaciones y el INP regenerado ejecuta un smoke real con
    CalculiX sin secciones huérfanas nuevas.

## Evidencia

- Unitarias de frame local y topología con L, T extremo-cuerpo, T sobre host dividido, recta, X,
  Z disjunto/parcial, candidato múltiple, orden permutado e IDs heterogéneos.
- Regresión de `casa-L` con diagnóstico topológico, cero `backup`, 26 T directas respaldadas,
  cadenetas y metrado exactos.
- Contratos del store para add/update/delete/split/merge y no ampliación de vanos/tipos.
- Pruebas de OSB con L en ambos extremos, ganador por cada desempate, T sin cambio, vano a borde y
  offsets fuera del largo nominal.
- Comparación de preview/R12/AC1015 y auditoría `ezdxf`.
- Smoke CalculiX sobre el INP regenerado y verificación de que `nogging` sigue excluido.
- Prueba de reversión por corte.
- Cierres `sessions/close-SPEC-R6-*.md`.

## Corte sugerido

| Corte | Unidad cerrable |
|---|---|
| **A** | Frame local, topología global, clasificación por bandas y prioridad L; sin adopción por generadores |
| **B** | Pilar L/T, eliminación de `backup`, invalidación central, batch, leyenda, metrado, DXF framing y smoke CalculiX |
| **C** | Envolvente/origen OSB, vanos/`MIN_EDGE_MARGIN`, preview, R12/AC1015 y rebaseline final |

El orden es A → B → C. A fija la autoridad geométrica; B corrige primero la estructura y su
invalidación; C mueve el revestimiento sólo después de que los apoyos reales estén disponibles.
