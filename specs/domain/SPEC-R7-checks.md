# Spec R7 — Checks constructivos y capacidad de corte

> Séptima unidad del plan de reglas de dominio.
> Base: commit `59d31f5`, suite 657/657.
> Decisiones de origen: legado **D-025** y **D-032**; gobernanza **D-018–D-028**.

## Diagnóstico

R4 creó el catálogo y el shape canónico de findings; R5 agregó roles explícitos; R6 resolvió la
topología L/T. Ninguno de esos cortes evalúa todavía las reglas contra el modelo. Hoy:

- `validateModel` sólo reúne checks geométricos legacy y un finding `wallRole` por muro sin tipo;
- `validateRoofPlanes` vuelve a construir cada finding y pierde `rule`, `measured` y `limit`;
- la validación de techumbre legacy y la de faldones no cruzan cerchas con vanos/jambas;
- `roofPlane.js` descarta solapes de hasta `MIN_TRAMO = 200` mm en tres guardas sin declarar la
  medida descartada;
- no existe cálculo de capacidad de corte por dirección ni un contrato que distinga capacidad
  verificada, condicionada y no verificable;
- `computeStudLayout` coloca primero la grilla regular y después las jambas, pero no resuelve la
  proximidad entre ambas según el legado D-025;
- las piezas `nogging` menores a 30 mm siguen siendo válidas para el software aunque no exista una
  decisión constructiva que autorice fabricarlas, absorberlas o eliminarlas.

### Medición reproducible

Sobre `tests/fixtures/casa-L.json`, regenerado en memoria con `modulateAllWallsFull` desde el commit
base:

- los 45 muros siguen sin `wallTypeId`; por D-019/R5 no se infiere ningún rol;
- tomando por cada jamba el apoyo vertical de altura completa más cercano, hay 28 distancias de eje
  menores a 150 mm: cero bajo 30 mm y 28 en el rango 30–150 mm;
- aparecen seis cadenetas con largo neto menor a 30 mm: dos de 12 mm y cuatro de 24 mm; cuatro están
  entre `king` y `corner`, y dos entre `stud` y `corner`;
- los dos `roofSystems` legacy tienen seis posiciones únicas de cercha que llegan sobre un vano
  (los dos vanos apilados de igual huella se agrupan); las seis quedan a más de 19 mm de la jamba;
- existe el caso legado de puerta con `edgeOffset: 0`: la referencia coincide con el eje de un muro
  perpendicular de 101,1 mm, por lo que el borde queda 50,55 mm dentro de su cara;
- el fixture no contiene `roofPlanes`, MP2 ni MP3, y no puede demostrar el descarte `MIN_TRAMO`,
  largos por rol ni capacidad MP1. Esos criterios requieren fixtures mínimos tipados.

Estos conteos son diagnóstico, no aceptación permanente: al asignar roles o corregir derivados
pueden cambiar. Las pruebas permanentes fijan el algoritmo y usan casos mínimos además del fixture.

### Fuentes

Fuentes primarias consultadas el 27-jul-2026:

- [Manual de Diseño Metalcon Cintac, §1.5.2 y §1.5.2.1](https://www.cintac.cl/wp-content/uploads/2023/08/Manual-de-Diseno-Metalcon.pdf):
  capacidad admisible sísmica de OSB 7/16″ por una cara = 417 kgf/m y límites de perfiles,
  espaciamiento, dobles de extremo y fijaciones;
- el mismo manual, continuación de §1.5.2.1: sólo cuenta revestimiento estructural de altura total,
  sin aberturas y con largo mínimo 1,20 m para altura 2,40 m, o razón alto/ancho menor que 2:1;
- el mismo manual, Anexo IV, p. 73: el pie derecho del dintel debe coincidir con la llegada de la
  cercha;
- el mismo manual, Anexo IV MP2/MP3: panel MP2 terminado de 3,0 a 5,0 m y MP3 de largo máximo
  5,0 m.

Los 19 mm de coincidencia cercha–jamba no son una tolerancia impresa por el manual: se derivan de
media ala del perfil C serie 90, `B = 38 mm`. Los rangos montante–jamba, cadeneta corta y holgura de
manilla son criterios de proyecto/oficina/obra y no se presentan como exigencias del fabricante.

## Decisión

### 1. Fronteras puras y cobertura

Se crea `core/domainChecks.js`, puro, para checks que leen muros, vanos, tipos y derivados de
tabiquería. La validación de faldones permanece en `roofPlaneValidation`; el cruce cercha–jamba vive
en `core/roofSupportChecks.js` y consume `getRoofSystems(model)` para respetar la precedencia
faldón/legacy.

Ningún check regenera ni persiste. La regeneración puede normalizar una grilla montante–jamba
cuando la decisión es inequívoca, pero validar siempre inspecciona el estado actual.

Cada evaluación devuelve:

```js
{
  findings: [],
  coverage: {
    checkedWallIds: [],
    skipped: [{ wallId, rule, reason }]
  }
}
```

`validateModel` conserva su retorno array por compatibilidad y agrega sólo `findings`. El cálculo
de capacidad expone además su resultado estructurado. R8 consumirá `coverage`; R7 no crea todavía
el informe markdown.

Un muro sin rol conserva el único finding `wallRole` de R5 y no recibe un finding repetido por cada
regla condicionada. Un derivado ausente o stale nunca se regenera: queda `skipped` con razón
estable.

### 2. Montante próximo a jamba y cadeneta corta

La distancia `d` de D-025 se fija como distancia **entre ejes** de la jamba (`king`) y el apoyo
vertical de altura completa más cercano. No se usa el largo neto de la cadeneta ni se mezclan
piezas parciales `jack/cripple`.

- `d < 30 mm`: finding `error`;
- `30 ≤ d < 150 mm`: finding `warning`;
- `d ≥ 150 mm`: cumple y no emite finding.

El umbral de 30/150 mm es de oficina, no normativo. El máximo de separación sí se evalúa aparte con
la regla manual: MP1 ≤610 mm y MP2 ≤600 mm.

Al regenerar un muro tipado, un `stud` regular dentro de 150 mm de una jamba puede omitirse sólo si:

1. no es `edge`, `corner`, `king` ni apoyo T;
2. el mayor paso entre apoyos de altura completa resultante cumple el máximo del rol;
3. la decisión no depende de un rol ausente ni de geometría ambigua.

Si cualquiera falla, se conserva. Nunca se elimina un pilar L/T ni una jamba para acomodar la
grilla. La validación posterior informa la proximidad que permanezca.

Las cadenetas de largo neto menor a 30 mm se reportan aparte, categoría `shortNogging`, con largo y
`wallIds`. R7 **no** las absorbe, prolonga ni elimina: no hay una fuente constructiva aceptada para
elegir una solución y cuatro de seis están acotadas por pilares/jambas no suprimibles. El resultado
es visible y queda pendiente de resolución de proyecto; no vuelve a ser una omisión silenciosa.

### 3. Holgura del borde de referencia de una puerta

El modelo no guarda giro, bisagra ni lado real de manilla. R7 no inventa ese dato. Evalúa el
**borde de referencia** existente (`referenceEdge`) únicamente cuando:

1. el vano es `door`;
2. `referenceAxisId` resuelve sobre el eje de corrida del muro anfitrión;
3. en ese eje existe al menos un muro perpendicular que cruza al anfitrión y comparte altura;
4. la regla aplica al rol explícito del anfitrión.

La medida firmada es:

```text
holgura = distancia(borde de referencia, eje perpendicular) − espesorPerpendicular / 2
```

Un valor negativo indica invasión. Se compara con 50–60 mm usando tolerancia geométrica de 1 mm;
por ejemplo, `edgeOffset = 100` contra un muro de 101,1 mm mide 49,45 mm y cumple dentro de
tolerancia. Si hay varios muros perpendiculares coincidentes y arrojan espesores distintos, se
reporta ambigüedad y no se elige el primero.

El mensaje dice “borde de referencia”; no afirma haber verificado el lado de manilla. Modelar giro
y handedness queda fuera de R7.

### 4. Llegada de cercha sobre vano

Para cada sistema de `getRoofSystems(model)`, cada posición se proyecta sobre sus muros de apoyo
`wallLowId` y `wallHighId`. Sólo se evalúa si la posición cae dentro de la huella horizontal de un
vano del muro a la cota de apoyo.

Vanos apilados con la misma huella se agrupan para no duplicar findings. La medida es la distancia
de eje entre la cercha y la jamba más cercana. El límite es `B/2` del perfil efectivo del muro; con
serie 90 vale 19 mm. Si `B` no se resuelve, el caso queda no verificable, nunca cae a 19 por default.

Una llegada dentro del vano y a más de `B/2` de ambas jambas emite `error`, con `wallIds` y el ID
tipado de la fuente viva (`roofPlaneIds` o `roofSystemIds`). Una cercha que no cae sobre vano no
genera observación: este check no exige alinear toda la cadena con todos los montantes.

### 5. `MIN_TRAMO` visible

`MIN_TRAMO = 200 mm` sigue siendo tolerancia geométrica, no regla de catálogo. Cada una de las tres
guardas de `roofPlane.js` que descarta un candidato por ese umbral debe producir un finding
`info`, categoría `shortRoofSpan`, con:

- solape medido;
- límite 200 mm;
- muro candidato y etapa (`support-overlap`, `polygon-run` o `polygon-edge`);
- `roofPlaneIds` al pasar por `validateRoofPlanes`.

Se conserva el descarte: R7 hace observable la decisión, no convierte un tramo de 200 mm en una
cercha. `roofPlaneValidation` preserva todos los campos canónicos del finding al agregar el ID y el
prefijo legible del faldón.

### 6. Largo de panel MP2/MP3

El panel evaluado es cada entidad `wall`, con su largo estructural nominal del frame R6; no se
fusionan muros colineales ni se usa la envolvente OSB.

- MP2: 3.000–5.000 mm;
- MP3: máximo 5.000 mm;
- MP1 y `tabique`: no aplica en R7.

El finding incluye largo medido, límite y `wallIds`. Un muro sin geometría o rol resuelto queda en
cobertura no verificable.

### 7. Capacidad de corte por dirección

Se crea `computeShearCapacityByDirection(model)`. La dirección es el eje de corrida del muro:
muros X aportan a la dirección X y muros Y a Y. Se usa el largo estructural nominal, sin la media
cara de OSB de R6.

Por cada muro MP1 el resultado declara condiciones individualmente:

```js
{
  wallId,
  direction: 'x' | 'y',
  lengthM,
  status: 'verified' | 'conditional' | 'excluded',
  capacityKgf: number | null,
  conditions: [{ code, status: 'pass'|'fail'|'unknown', measured, limit }]
}
```

Se verifican con datos actuales:

- rol MP1;
- geometría y altura resueltas;
- sin aberturas;
- largo ≥1,20 m para h=2,40 m, o `h/largo < 2`;
- montante serie 90 y espesor ≥0,85 mm;
- solera serie 92 y espesor ≥0,85 mm;
- paso de montantes ≤610 mm;
- OSB derivado presente, vigente y cubriendo la altura completa.

El modelo no representa de forma comprobable espesor/caras del OSB, especificación de tornillos ni
dobles espalda-espalda en todos los extremos. Esas condiciones quedan `unknown`. Por tanto:

- `verified`: todas las condiciones `pass`; suma `417 × lengthM`;
- `conditional`: ninguna condición falla, pero existe al menos un `unknown`; calcula
  `conditionalCapacityKgf = 417 × lengthM` y mantiene `capacityKgf: null`;
- `excluded`: al menos una condición falla; ambas capacidades son `null`.

Los totales por dirección separan `verifiedCapacityKgf`, `conditionalCapacityKgf` y largos
excluidos. La UI nunca suma capacidad condicionada dentro de la verificada ni compara contra una
demanda inexistente. Un finding `info` por dirección presenta ambas cifras y la cobertura.

Esta salida es el primer contrato de B7; no es un análisis sísmico, una verificación de anclajes ni
una declaración de capacidad instalada.

### 8. Catálogo

Se agregan reglas con fuente y aplicación explícitas:

| ID | aplicación | origen / severidad |
|---|---|---|
| `muro.montante.paso` | MP1/MP2 | manual / error |
| `muro.jamba.distanciaMontante` | todos los roles | obra / info |
| `muro.dintel.llegadaCercha` | MP1/MP2/MP3 | manual / error |
| `muro.panel.largo` | MP2/MP3 | manual / error |
| `muro.corte.capacidadOsb` | MP1 | manual / info |

La regla de obra `muro.jamba.distanciaMontante` mantiene severidad máxima `info` en catálogo para
respetar la taxonomía. Los `error/warning` operativos de D-025 se emiten como findings geométricos
sin elevar la severidad de esa regla; el mensaje distingue política de oficina de incumplimiento
manual del paso máximo. `shortNogging` y `shortRoofSpan` no inventan reglas: son diagnósticos de
tolerancia/constructibilidad.

## Alternativas descartadas

| Alternativa | Motivo |
|---|---|
| Inferir roles de OSB, nombres o perfiles de `casa-L` | Contradice D-019 y convierte derivados legacy en intención estructural |
| Regenerar dentro de la validación | Confunde staleness con cumplimiento y puede mutar lo que se inspecciona |
| Usar `edgeOffset` directamente como holgura | Mide al eje, no a la cara del muro perpendicular |
| Afirmar lado de manilla desde `referenceEdge` | El dato sólo define cómo se posicionó el vano; R7 declara esa cobertura limitada |
| Alinear todas las cerchas con todos los montantes | El detalle sólo gobierna llegadas sobre vano; alteraría la cadena global sin necesidad |
| Fijar siempre 19 mm | Oculta perfiles sin ala resoluble y contradice la derivación `B/2` |
| Crear tramos de techo de 200 mm | `MIN_TRAMO` es una tolerancia vigente; el defecto es el silencio, no el descarte |
| Fusionar muros rectos para largo MP2/MP3 | Cambia la unidad persistida de panel y puede cruzar juntas reales |
| Sumar 417 kgf/m sólo por tener rol MP1 | Omite límites explícitos del manual y condiciones que el modelo aún desconoce |
| Eliminar las seis cadenetas cortas | No existe detalle aprobado y algunas están entre apoyos L/T obligatorios |

## Alcance

- Catálogo de las cinco reglas R7 y fuentes estructuradas.
- `domainChecks.js` puro con cobertura, montante–jamba, paso, holgura y largos MP2/MP3.
- Normalización conservadora de `stud` regular próximo a jamba durante regeneración tipada.
- Finding explícito para cadenetas menores a 30 mm, sin cambiar su geometría.
- `roofSupportChecks.js` sobre la fuente única de techumbre.
- Findings medidos de las tres guardas `MIN_TRAMO`.
- Preservación del shape extendido en `roofPlaneValidation`.
- Cálculo de capacidad verificada/condicionada/excluida por X/Y.
- Integración en `ValidationModal` sin crear el informe R8.
- Pruebas focalizadas, de regresión y de reversión.

## Fuera de alcance

- Asignar tipos o corregir puertas/cerchas del fixture `casa-L`.
- Inferir rol, giro, bisagra o lado de manilla.
- Modelar tornillos individuales, dobles de extremo o anclajes.
- Convertir capacidad condicionada en capacidad verificada.
- Comparar capacidad con demanda sísmica o de viento.
- Generar diagonales MP2 o armado MP3.
- Resolver constructivamente las cadenetas cortas sin un detalle aprobado.
- Crear el informe markdown de R8.
- Modificar DXF o INP.

## Criterios de aceptación

1. Los checks son puros, no regeneran y devuelven cobertura explícita; un muro sin rol no recibe
   reglas condicionadas duplicadas.
2. Montante–jamba mide eje a eje, clasifica los límites 30/150 y nunca suprime `corner`, `king`,
   `edge` ni apoyo T.
3. La regeneración tipada sólo omite un `stud` regular próximo si el paso resultante cumple
   MP1≤610 o MP2≤600; sin rol o ante ambigüedad conserva la pieza.
4. Las seis cadenetas de 12/24 mm de `casa-L` se reportan con medida y muro, y permanecen
   geométricamente iguales.
5. La holgura se mide contra la cara de un muro perpendicular con traslape Z; tolera 1 mm,
   reporta invasión firmada y no elige entre espesores ambiguos.
6. El cruce de techumbre agrupa vanos apilados, sólo revisa llegadas sobre vano y usa `B/2`; el
   caso serie 90 pasa a 19 mm y un perfil sin B queda no verificable.
7. El diagnóstico legacy de `casa-L` conserva seis llegadas únicas sobre vano y todas quedan fuera
   de 19 mm, salvo que una corrección justificada del algoritmo cambie el baseline.
8. Las tres guardas `MIN_TRAMO` emiten etapa, medida y límite sin crear el tramo; el wrapper
   conserva `rule`, `measured`, `limit` e IDs tipados.
9. MP2 acepta exactamente 3.000 y 5.000 mm y rechaza fuera del rango; MP3 acepta 5.000 mm y
   rechaza sólo el exceso. El largo es el frame nominal R6.
10. La capacidad separa X/Y y estados verified/conditional/excluded; sólo `verified` suma
    `capacityKgf`, y todo `unknown` impide presentarlo como verificado.
11. Casos sintéticos cubren cada condición de §1.5.2.1 disponible, OSB stale/ausente, aberturas,
    razón de aspecto, perfil/paso y condiciones no modeladas.
12. `ValidationModal` muestra medida, límite, fuente y navegación tipada sin perder findings
    legacy ni severidad.
13. Revertir por separado checks de muro, cruce de techumbre, visibilidad `MIN_TRAMO` y capacidad
    rompe al menos una prueba focalizada de cada corte.
14. `make governance` y `npm run validate` terminan con código 0. Al no tocar DXF ni INP, R7 no
    requiere auditoría `ezdxf` ni smoke CalculiX adicional.

## Evidencia

- Unitarias de catálogo y `domainChecks` con roles MP1/MP2/MP3/tabique/sin rol.
- Regresión regenerada de `casa-L` para distancias, seis cadenetas y llegadas sobre vano.
- Fixtures mínimos para puerta contra muro perpendicular, ambigüedad y traslape Z disjunto.
- Fixtures de techo legacy y `roofPlanes` para fuente tipada, vanos apilados y `MIN_TRAMO` en sus
  tres etapas.
- Matriz de largos MP2/MP3 en límites y fuera de ellos.
- Matriz de capacidad X/Y con pass/fail/unknown y totales separados.
- Pruebas de presentación/navegación y reversión por corte.
- Cierres `sessions/close-SPEC-R7-*.md`.

## Corte sugerido

| Corte | Unidad cerrable |
|---|---|
| **A** | Catálogo, cobertura, montante–jamba/paso, normalización conservadora, cadeneta corta, holgura y largo MP2/MP3 |
| **B** | Llegada cercha–jamba, fuente viva de techumbre, `MIN_TRAMO` medido y preservación del finding |
| **C** | Capacidad de corte X/Y verificada/condicionada/excluida e integración final en validación |

El orden es A → B → C. A fija el contrato común y los checks de muro; B cruza techumbre sin
acoplarla a generación; C usa roles, derivados y cobertura ya estabilizados.
