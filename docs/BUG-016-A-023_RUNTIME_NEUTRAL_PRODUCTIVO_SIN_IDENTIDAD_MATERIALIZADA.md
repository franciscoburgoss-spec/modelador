# BUG-016-A-023 — Runtime neutral productivo sin identidad materializada

## Estado

CERRADO — 13-ago-2026.

## Hallazgo

La auditoría previa a la integración store/UI confirmó que SPEC-016-A exige:

- `neutral-contract-adapter@1.0.0`;
- `neutral-contract-library@1.0.0`;
- biblioteca neutral exacta identificada además por SHA-256.

Sin embargo:

- B3.2 sólo contiene internamente la identidad del adapter/library neutral y el conjunto de
  component types que realmente puede resolver;
- no existe un runtime neutral productivo separado;
- no existe un `constructive-library-context-v1.0` productivo;
- la propia SPEC declara que el library context B2 es únicamente una frontera contractual de test;
- los hashes `a...a` / `b...b` utilizados por los tests son fixtures y no una identidad productiva.

## Impacto

La integración store/UI no puede:

- crear escenarios productivos con un hash inventado;
- reutilizar `model.library`, porque pertenece al dominio legacy/Metalcon;
- declarar availability real sin un registry neutral materializado;
- proyectar B2 contra una biblioteca cuya identidad productiva no existe.

## Correctiva requerida

Definir una frontera neutral productiva mínima, determinista y separada del modelo legacy.

Debe contener únicamente lo autorizado por SPEC-016-A y por B3.2, sin:

- perfiles;
- materiales;
- studs;
- OSB;
- capacidades;
- rigidez;
- normativa;
- datos Metalcon.

Su SHA-256 debe derivarse reproduciblemente del payload canónico de la biblioteca y no ser una
constante arbitraria de fixture.

## Criterio de cierre

Cerrar cuando:

- exista una definición canónica de la biblioteca neutral;
- su SHA-256 sea reproducible;
- el availability context productivo derive de esa misma identidad;
- B2 pueda consumir su library context;
- B3.2 acepte el input resultante;
- tests demuestren que `model.library` no participa;
- B1/B2/B3.1/B3.2/B3.3 permanezcan intactos.

## Evidencia de cierre

Se materializó el runtime neutral productivo con identidad canónica reproducible:

- adapter:
  `neutral-contract-adapter@1.0.0`;
- library:
  `neutral-contract-library@1.0.0`;
- library SHA256:
  `404ca9e7ed30b522dfddb211b98099bb8a739119957071d1642f41f004d2fc2f`;
- único component type soportado:
  `abstract-load-transfer-response`.

La integración permanente confirmó sobre FX-008:

- runtime productivo → B2 → B3.1 → B3.2;
- availability exacta en ambos escenarios;
- escenario A: coverage `partial` 1/0/1;
- escenario B: coverage `none` 0/0/2;
- ambos mantienen `verificationState=notVerified`;
- los requirement resolutions particionan exactamente el scope;
- `model.library` no participa en la frontera constructiva;
- escenarios A/B conservan hashes efectivos distintos;
- runtime focal + integración: 8/8 PASS;
- regresión B3.1/B3.2/B3.3: 60/60 PASS;
- B3 permanece byte-idéntico.

SHA producto runtime:

`ac26cfe34602a1ffe847b42eabedf03b8d79aba80e2f3eeb05ed835434eea0f3`

SHA test focal:

`e8ad171554525b87e34e81c7307587d66b49729b4f62a347a678c780ae318792`

SHA test integración:

`f2a45f4ad2a18b5bb624495ad5197d50561e0a5d91938f5713cd998789e72f87`

No se realizó Git write.
