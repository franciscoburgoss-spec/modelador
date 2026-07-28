# SPEC-003 — Arnés de verificación y fixtures

> Base de preparación: commit `711595f`, suite 701/701 y laboratorio 35/35.
> Decisiones relacionadas: D-003, D-008, D-011, D-014, D-016 y D-030.

## Diagnóstico

La suite cubre ampliamente el dominio importado, pero todavía no demuestra de forma reproducible
la cadena completa fixture → exportador → archivo → herramienta externa → resultado:

- `tests/fixtures/casa-L.json` y `lab/roofPlane/fixtures/modelo-26.json` contienen exactamente los
  mismos 49 `elements` (45 muros y 4 fundaciones), con hash abreviado común `d33ce29e466b`;
- ambos fixtures son legacy sin `modelVersion`, no guardan `roofPlanes` y por tanto cuentan como un
  solo caso para muros, OSB y fundaciones;
- el único fixture con `roofPlanes` es un caso mínimo de migración v1 con cero elementos y un
  polígono vacío; no prueba persistencia de una cubierta resoluble;
- los seis JSON actuales pasan `prepareModelImport`, pero no existe un manifiesto ejecutable que
  fije checksum, propósito, cobertura e invariantes;
- la cobertura oficial es 93,04 % de líneas en `core` y 72,76 % en el store. El piso temporal del
  store sigue en 50 %, por debajo del objetivo de 85 %;
- las líneas no cubiertas del store se concentran en sustitución de biblioteca, navegación de
  niveles/vistas, CRUD de proyecto/grilla/techumbre, mutaciones agrupadas y fronteras de
  persistencia/archivo; son contratos observables, no código muerto;
- `package.json` no contiene aún `audit:dxf`, `smoke:ccx` ni pruebas de componentes;
- el Python 3.14.5 activo no tiene `ezdxf`; una instalación temporal 1.4.4 usada en R8-C no es un
  entorno reproducible del repositorio;
- CalculiX 2.23 está disponible, pero la evidencia R6-B renumeró los muros antes de ejecutar. El
  INP global generado con IDs persistidos de `casa-L` todavía produce nombres `ELSET` que exceden
  los 20 caracteres útiles de CalculiX;
- sólo fundaciones tiene hoy un parser de `.dat`, probado contra texto sintético. No existe un
  arnés común que ejecute y valide las tres variantes INP;
- Playwright actual no puede ejecutarse en el Mac objetivo según D-014 y no hay todavía evidencia
  externa ligada a un commit.

El baseline demuestra que aumentar el conteo de tests no basta: la spec debe crear autoridades de
entrada distintas, comparar contratos semánticos y ejecutar las herramientas que realmente
consumen DXF e INP.

## Decisión

### 1. Fixtures como autoridades versionadas

Se agregan dos fixtures independientes:

- **FX-003**: segunda vivienda con planta distinta de `casa-L`, muros en X/Y, puertas y ventanas,
  tipos de muro y familias de perfiles serie 60 y 90;
- **FX-004**: modelo moderno resoluble con `modelVersion: 2`, biblioteca propia, perfiles serie
  60/90 y `roofPlanes` persistidos.

FX-003, FX-004 y `casa-L` no pueden compartir `elements` ni biblioteca byte a byte entre sí.
Los IDs con significado estructural se fijan de forma legible y estable.

`supportLedgers` no se persiste dentro del faldón como una segunda autoridad. Es un derivado de la
configuración persistida de `roofPlanes`; el arnés compara que los ledgers expandidos antes y
después de serializar/importar sean semánticamente idénticos.

Un manifiesto legible por máquina registra todos los fixtures del repositorio, incluidos los
legacy y de migración:

```json
{
  "id": "FX-003",
  "file": "tests/fixtures/...",
  "sha256": "...",
  "modelVersion": 2,
  "origin": "sintético",
  "purpose": "...",
  "requirements": ["REQ-TST-001"],
  "invariants": {}
}
```

La prueba del manifiesto recalcula hashes, importa cada JSON mediante `prepareModelImport` y
comprueba invariantes contractuales. Corregir un fixture crea una nueva versión o una actualización
explícita del manifiesto; nunca se acepta un hash nuevo de forma automática durante `validate`.

### 2. Goldens semánticos y conjunto de referencia

Los goldens versionados contienen resúmenes compactos, no copias textuales completas. El arnés
normaliza sólo campos declarados como no contractuales:

- IDs generados sin referencias aguas abajo;
- timestamps inyectados por el arnés;
- orden de mapas o colecciones cuyo contrato declara indiferencia.

No se normalizan IDs de muro, eje, perfil, tipo, faldón, `NSET` o `ELSET`; tampoco magnitudes,
unidades, conteos, capas, referencias o flags `stale`.

El conjunto mínimo de referencia es:

| Formato | Salidas |
|---|---|
| JSON | roundtrip de FX-003 y FX-004, versión, referencias y derivados vigentes/stale |
| CSV | metrado de FX-003 y FX-004 agrupado por tipo, rol, perfil, cantidad y magnitud |
| DXF | planta, fundaciones, framing R12/A3, OSB R12/A3 y cerchas R12/A3 |
| INP | global, cerchas y fundaciones, con IDs persistidos del fixture |

Para DXF, el golden semántico registra versión, layouts, capas, tipos y conteos de entidades,
extents y textos contractuales. Cada archivo se abre además con `ezdxf` y pasa
`doc.audit()` con cero errores y cero reparaciones.

Para INP, el golden registra keywords, conjuntos, materiales, tipos de elemento, nodos, elementos,
cargas y condiciones de borde. La comparación de texto nunca sustituye la ejecución real.

### 3. Herramientas externas reproducibles

La versión de `ezdxf` se fija en un archivo de dependencias Python y los scripts oficiales resuelven
un entorno del repositorio documentado; no dependen del Python global ni de `/tmp`.
`npm run audit:dxf` genera sus archivos en un directorio temporal o en
`artifacts/<commit>/dxf`, audita el conjunto completo y emite un reporte JSON.

`npm run smoke:ccx`:

1. detecta la ruta y versión de `ccx`;
2. genera las tres variantes INP desde los fixtures de referencia sin renumerar IDs;
3. ejecuta cada job con directorio aislado y argumentos directos, sin interpolación de shell;
4. exige código de salida cero, finalización normal y archivos de resultado esperados;
5. parsea desplazamientos/resultados y rechaza `NaN`, `Infinity`, conjuntos o nodos faltantes;
6. emite un reporte JSON con hashes, versión, conteos, extremos y duración.

El parser vive en `core` sólo si es puro y reutilizable por la aplicación; la coordinación de
procesos permanece en `scripts/`.

### 4. Cobertura por contratos

El umbral del store sube a 85 % sólo cuando existen pruebas de comportamiento para los grupos
actualmente descubiertos:

- historial y mutaciones de proyecto, biblioteca, grilla, elementos, vanos y techumbre;
- invalidación central producida por esas acciones;
- navegación de nivel, selección, encuadre y panel dividido;
- importación, guardado, descarga y errores de las fronteras DOM mediante adaptadores controlados;
- sustitución de secciones y plantillas referenciadas.

No se exportan helpers internos sólo para cubrir líneas. Una acción trivial puede agruparse en una
tabla de casos, pero cada expectativa comprueba estado, historial, invalidación o efecto observable.

Las pruebas de componentes usan un DOM de test y cubren al menos importación fallida visible,
bloqueo de exportación stale y un workflow de revisión/descarga. React coordina; las reglas siguen
probadas en módulos puros.

### 5. Puertas y evidencia

`npm run validate` incorpora manifiesto/goldens, `audit:dxf`, `smoke:ccx`, componentes y cobertura.
No abre GUI, no modifica fixtures/goldens y no requiere editar rutas personales. El setup inicial
de herramientas queda separado y documentado.

Los artefactos de ejecución no se versionan. Cada cierre registra comando, commit, toolchain,
hashes de entrada y resumen del reporte. El E2E Playwright actual corre externamente sobre el mismo
commit y su resultado se enlaza en trazabilidad; no se instala una versión obsoleta para este Mac.

## Alternativas descartadas

| Alternativa | Motivo |
|---|---|
| Seguir tratando `casa-L` y `modelo-26` como dos casos | Oculta regresiones porque sus elementos son idénticos |
| Persistir `supportLedgers` junto a `roofPlanes` | Duplica un derivado y permite divergencia silenciosa |
| Goldens de archivos completos | Fallan por orden incidental y vuelven opaco el contrato real |
| Auditar sólo cuatro DXF representativos | No cubre todos los exportadores declarados |
| Ejecutar sólo el INP renumerado de R6-B | Evita precisamente el defecto de IDs persistidos que debe detectar el arnés |
| Aceptar “Job finished” sin parser | No demuestra resultados finitos ni correspondencia de nodos/conjuntos |
| Subir el umbral con llamadas sin aserciones | Convierte cobertura en una métrica sin protección conductual |
| Playwright antiguo local | Contradice D-014 y no representa el navegador soportado |
| Instalar `ezdxf` globalmente | La siguiente sesión no puede reproducir versión ni ubicación |

## Alcance

- FX-003 y FX-004, manifiesto ejecutable y documentación de fixtures.
- Roundtrip moderno con `roofPlanes` y equivalencia de ledgers derivados.
- Goldens semánticos JSON, CSV, DXF e INP.
- Entorno Python fijado y auditoría `ezdxf` global 0/0.
- Smoke real de las tres variantes CalculiX y parser finito.
- Corrección mínima del exportador si el smoke con IDs persistidos reproduce el defecto `ELSET`.
- Cobertura `core >= 90 %` y `store >= 85 %` por contratos observables.
- Pruebas de componentes críticos.
- Comando local único y evidencia E2E externa por commit.
- Actualización de trazabilidad, riesgos, documentación y cierres por corte.

## Fuera de alcance

- Cambiar reglas, límites o fuentes de dominio R3–R8.
- Nuevos formatos de exportación o rediseño geométrico.
- Persistir ledgers u otros derivados como nueva fuente de verdad.
- Snapshots masivos sensibles a orden no contractual.
- Corregir findings constructivos que revelen los fixtures.
- Integrar CalculiX dentro de Tauri, agregar timeout/cancelación nativos o redistribuir CCX.
- Guardado atómico, backups y recuperación de SPEC-004.
- E2E local con Playwright obsoleto.
- Tests visuales de cada variante menor o pixel snapshots.
- Refactors generales del store o de componentes no exigidos por cobertura crítica.

## Criterios de aceptación

1. FX-003 y FX-004 difieren byte a byte en `elements` y biblioteca respecto de `casa-L` y entre sí.
2. FX-003 contiene planta distinta, muros X/Y, puertas/ventanas y perfiles serie 60/90 resolubles.
3. FX-004 declara `modelVersion: 2`, perfiles serie 60/90 y al menos un `roofPlane` resoluble.
4. Todo fixture registrado pasa `prepareModelImport`, checksum e invariantes; el roundtrip de
   FX-004 conserva `roofPlanes` y reproduce los mismos ledgers derivados.
5. Los goldens declaran explícitamente qué IDs, timestamps y órdenes se normalizan; un cambio en
   magnitud, referencia estructural, unidad, capa o estado stale rompe la prueba.
6. JSON y CSV de referencia pasan comparación semántica determinista con LF y sin mutar el modelo.
7. Las ocho familias DXF de referencia (planta, fundaciones, framing/OSB/cerchas R12 y A3) tienen
   golden semántico y `ezdxf doc.audit()` con 0 errores / 0 reparaciones.
8. `ezdxf` está fijado y `audit:dxf` no usa el Python global ni rutas temporales personales.
9. Las variantes INP global, cerchas y fundaciones conservan IDs persistidos, pasan golden
   semántico y ejecutan con CalculiX real.
10. El smoke exige finalización normal y el parser devuelve resultados finitos, no vacíos y
    referenciados a nodos/conjuntos esperados para los tres jobs.
11. La cobertura oficial conserva `core >= 90 %` y alcanza `store >= 85 %`; las nuevas pruebas
    afirman contratos observables y fallan al revertir el comportamiento protegido.
12. Existen pruebas de componentes para importación fallida, exportación stale y revisión/descarga,
    sin mover reglas de dominio a React.
13. Cada requisito crítico de `TRACEABILITY.md` enlaza una prueba o reporte automático por commit.
14. `npm run validate` ejecuta todos los gates locales sin GUI, sin editar rutas y sin modificar
    fixtures o goldens.
15. Playwright actual registra externamente un resultado para el mismo commit del cierre final.

## Evidencia

- manifiesto de fixtures con hashes e invariantes;
- prueba de independencia y roundtrip de FX-003/FX-004;
- resúmenes golden JSON/CSV/DXF/INP;
- reporte `audit:dxf` con conteos y 0/0 por archivo;
- reporte `smoke:ccx` con versión, hashes, jobs, resultados finitos y finalización;
- reportes de cobertura por `core` y store;
- pruebas de componentes y reversión por comportamiento crítico;
- matriz de aceptación actualizada;
- ejecución externa de E2E enlazada por commit.

## Cortes de implementación

| Corte | Unidad cerrable | Criterios | Exclusiones del corte |
|---|---|---|---|
| **A — Fixtures** | FX-003/FX-004, manifiesto ejecutable, esquema, independencia, roundtrip y ledgers derivados | 1–4 | sin exportadores, goldens, Python, CCX ni cambio de coverage |
| **B — Artefactos** | normalizadores/goldens JSON-CSV-DXF-INP, entorno `ezdxf` y `audit:dxf` global | 5–8 | sin ejecutar CCX, sin pruebas UI ni subir umbral |
| **C — Solver** | smoke real global/cercha/fundación, parser finito y corrección mínima de IDs `ELSET` si falla | 9–10 | sin Tauri, timeout/cancelación nativos, coverage o UI |
| **D — Store/componentes** | contratos faltantes, componentes críticos y umbrales `core 90 / store 85` | 11–12 | sin refactor general, reglas nuevas ni E2E local |
| **E — Integración** | `validate` único, reportes/trazabilidad y ejecución Playwright externa del commit | 13–15 | sin persistencia nativa, packaging ni release |

El orden obligatorio es A → B → C → D → E. Cada corte actualiza su cierre inmutable y demuestra
sus criterios antes de habilitar el siguiente.
