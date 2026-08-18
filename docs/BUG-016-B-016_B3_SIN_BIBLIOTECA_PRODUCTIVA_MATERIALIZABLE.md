# BUG-016-B-016 — B3 autorizado sin biblioteca productiva materializable

## Estado

CERRADO — 17-ago-2026.

## Contexto

SPEC-016-B cerró B2 mediante D-071 con una biblioteca Metalcon nueva,
versionada e independiente del legacy.

B2 dejó explícitamente:

- `metalcon-library-manifest-v1.0` como fuente única de la biblioteca nueva;
- registros productivos inicialmente vacíos;
- `componentTypes=[]`;
- runtime Metalcon ligado exactamente al manifest canónico productivo;
- configuración con refs explícitas y binding fail-closed contra ese manifest.

Posteriormente D-072 aprobó la Fase A B3 v1.0 y autorizó B3 por subcortes.

El primer subcorte autorizado es:

`B3.1 — biblioteca mínima y resolución estricta de familias`.

## Hallazgo

La revisión READ-ONLY previa a implementar B3.1 confirmó que:

1. `METALCON_LIBRARY_MANIFEST` productivo continúa con:
   - `profiles=[]`;
   - `materials=[]`;
   - `panels=[]`;
   - `wallAssemblies=[]`;
   - `components=[]`;
   - `connections=[]`.

2. Los tests B2 demuestran que el contrato de biblioteca admite manifests no
   vacíos con refs internas válidas, pero esos manifests son fixtures de test y
   no constituyen biblioteca productiva aprobada.

3. El runtime productivo Metalcon deriva su `libraryRef` y
   `libraryContext.adapterPayload` exclusivamente de
   `METALCON_LIBRARY_MANIFEST`.

4. El runtime valida que el `adapterInput` permanezca ligado exactamente a esa
   biblioteca canónica productiva.

5. La configuración B2 puede declarar refs como:
   - `studProfileRef`;
   - `trackProfileRef`;
   - `materialRef`;
   - `panelRef`;
   - `wallAssemblyRef`.

   Sin embargo, con los registros productivos actualmente vacíos cualquier ref
   de esas familias falla correctamente el binding.

6. `studSpacingMm` puede existir sin refs durante B2, pero el contrato B3.9
   establece que activa la familia vertical y que una familia vertical
   solicitada requiere:

   `studProfileRef + materialRef + studSpacingMm`.

   Por tanto, spacing aislado no constituye una configuración materializable
   B3.

## Subespecificación

La autorización B3 define que debe existir una “biblioteca mínima”, pero no
define todavía:

- cuáles son sus entradas productivas mínimas;
- sus IDs productivos;
- qué metadatos mínimos forman parte de cada entrada;
- si B3 debe poblar el manifest canónico existente;
- o si debe introducirse una nueva frontera explícita para suministrar un
  manifest externo al runtime.

No existe una decisión vigente que permita escoger una de esas alternativas
automáticamente.

## Riesgo

Inventar silenciosamente entradas como:

- `metalcon-profile:stud`;
- `metalcon-profile:track`;
- `metalcon-material:steel`;
- `metalcon-panel:sheathing`;
- `metalcon-wall-assembly:basic`;

a partir de nombres usados en fixtures convertiría datos de test en autoridad
productiva sin aprobación humana.

También sería incorrecto modificar el runtime para aceptar una biblioteca
inyectable sin una decisión contractual que autorice esa nueva frontera.

## Impacto

El hallazgo no invalida B1 ni B2.

No afecta:

- D-070;
- D-071;
- D-072;
- `modelVersion: 4`;
- geometría agnóstica;
- `structuralIntent`;
- requirements;
- assignments;
- `verificationState=notVerified`;
- independencia de Metalcon legacy.

Sí bloquea la implementación productiva de B3.1 hasta definir explícitamente la
biblioteca mínima o su mecanismo de provisión.

## Decisión humana requerida

Antes de implementar B3.1 debe elegirse y congelarse una estrategia productiva.

### Alternativa A — biblioteca mínima canónica B3

Poblar explícitamente la biblioteca Metalcon nueva con las identidades mínimas
necesarias para ejercer las familias B3.

Esta alternativa debe definir qué registros e IDs son autoridad productiva y
debe evitar:

- defaults ocultos;
- propiedades mecánicas inventadas;
- datos provenientes del Metalcon legacy;
- confundir identidad constructiva con capacidad estructural.

### Alternativa B — biblioteca suministrada explícitamente al runtime

Abrir una nueva frontera contractual para que el runtime Metalcon opere sobre
un manifest nuevo/versionado suministrado explícitamente.

Esta alternativa exige definir además:

- autoridad del manifest;
- binding con `libraryRef`;
- availability;
- determinismo;
- tamper;
- persistencia o no persistencia;
- relación con el manifest canónico B2.

## Resguardos

Hasta resolver este BUG:

- no poblar `METALCON_LIBRARY_MANIFEST`;
- no copiar fixtures B2 al producto;
- no inventar perfiles, materiales, paneles o assemblies;
- no parametrizar el runtime con un manifest externo;
- no consumir Metalcon legacy;
- no modificar schema B2;
- no iniciar la implementación productiva del resolver B3.1;
- no avanzar a B3.2;
- no realizar `git add`, commit ni push sin autorización humana separada.

## Criterio de cierre

BUG-016-B-016 podrá cerrarse cuando:

1. exista una decisión humana explícita sobre la estrategia de biblioteca B3;
2. la SPEC documente inequívocamente esa estrategia;
3. queden definidos los datos productivos permitidos o la frontera de provisión
   correspondiente;
4. no se introduzcan datos de ingeniería sin autoridad;
5. se preserve D-070 y el aislamiento respecto del legacy;
6. B3.1 pueda resolverse únicamente desde configuración + biblioteca nueva,
   sin fallback;
7. los gates documentales aplicables permanezcan verdes.

## Decisión humana adoptada

17-ago-2026 — D-073.

La revisión humana adopta una estrategia secuencial:

1. `B3.1a` implementa contrato y resolver de familias sin poblar todavía la
   biblioteca productiva. Los fixtures utilizados para demostrar el resolver
   son exclusivamente de test y no constituyen autoridad productiva.
2. `B3.1b` incorpora un catálogo inicial pequeño pero real, trazable y aprobado
   antes de comenzar B3.2.
3. El catálogo real no se deriva de Metalcon legacy ni de nombres usados en
   fixtures.
4. Las dimensiones o propiedades documentadas de un producto no significan
   capacidad verificada ni requirement resuelto.
5. `studSpacingMm` continúa siendo una decisión explícita y no un default del
   wallAssembly.

BUG-016-B-016 permanece ABIERTO hasta verificar mecánicamente esta resolución
documental y sus gates.

## Cierre verificado

CERRADO — 17-ago-2026.

La revisión humana resolvió la subespecificación mediante D-073.

La estrategia queda congelada de forma secuencial:

- `B3.1a` implementa únicamente contrato y resolución estricta de familias;
- sus fixtures son exclusivamente no productivos;
- la biblioteca productiva puede permanecer vacía durante B3.1a;
- `B3.1b` debe incorporar antes de B3.2 un catálogo inicial pequeño pero real;
- las entradas productivas requieren fuente, trazabilidad y aprobación humana;
- fixtures y nombres de tests no se convierten en autoridad productiva;
- no se consume ni migra Metalcon legacy;
- `studSpacingMm` permanece decisión explícita y no default del wallAssembly;
- conocer dimensiones o propiedades reales no implica capacidad, requirement
  resuelto ni verificación estructural;
- B3.2 permanece bloqueado hasta cerrar B3.1b.

### Gates ejecutados

- `git diff --check` — PASS.
- `npm run format:check` — PASS; 772 archivos de texto válidos.
- `make governance` — PASS; 22 archivos requeridos, 56 requisitos y
  73 decisiones.

La resolución preserva D-070, D-071 y D-072 y habilita exclusivamente el inicio
de B3.1a. B3.1b, B3.2, B4, B5 y SPEC-016-C permanecen fuera del corte actual.
