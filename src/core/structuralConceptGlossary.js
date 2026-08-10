export const STRUCTURAL_CONCEPT_GLOSSARY_SCHEMA = 'structural-concept-glossary-v1.0';

const CONCEPTS = [
  {
    scope: 'roofDistribution', value: 'oneWay', label: 'Una dirección',
    meaning: 'La cubierta declara una dirección resistente principal representativa para distribuir acciones.',
    declares: 'Una dirección primaria de comportamiento resistente en planta.',
    effect: 'Los motores pueden evaluar compatibilidad con esa dirección, sin asignar automáticamente bordes ni receptores.',
    notMeans: 'No significa que todos los bordes paralelos sean apoyos ni que exista capacidad verificada.'
  },
  {
    scope: 'roofDistribution', value: 'twoWay', label: 'Dos direcciones',
    meaning: 'La cubierta declara dos direcciones resistentes no paralelas.',
    declares: 'Una dirección primaria y una secundaria de comportamiento resistente.',
    effect: 'Permite estudiar compatibilidad en ambas direcciones; cada borde conserva su función declarada independiente.',
    notMeans: 'No significa apoyo en los cuatro lados ni distribución de fuerzas verificada.'
  },
  {
    scope: 'roofDistribution', value: 'local', label: 'Local',
    meaning: 'No existe una dirección resistente global representativa para toda la superficie.',
    declares: 'Un comportamiento resistente que debe interpretarse localmente.',
    effect: 'No se usa una dirección global primaria o secundaria para la cubierta.',
    notMeans: 'No significa ausencia de resistencia ni permite inferir apoyos locales automáticamente.'
  },
  {
    scope: 'roofDistribution', value: 'undetermined', label: 'Indeterminada',
    meaning: 'La distribución resistente todavía no ha sido decidida.',
    declares: 'Una decisión pendiente explícita.',
    effect: 'Los motores no deben inventar una dirección resistente.',
    notMeans: 'No equivale a una dirección local ni a dos direcciones.'
  },
  {
    scope: 'diaphragmBehavior', value: 'intended', label: 'Previsto',
    meaning: 'Se pretende que la cubierta participe como diafragma para distribuir acciones laterales.',
    declares: 'Una función de diafragma buscada por decisión humana.',
    effect: 'Puede iniciar un estudio lateral respaldado por intención cuando existan destinos y transferencias compatibles.',
    notMeans: 'No verifica rigidez, resistencia, anclajes, colectores ni conexiones.'
  },
  {
    scope: 'diaphragmBehavior', value: 'notIntended', label: 'No previsto',
    meaning: 'No se pretende utilizar esta cubierta como fuente de acción de diafragma.',
    declares: 'Exclusión explícita de esa función para la cubierta.',
    effect: 'No inicia rutas laterales basadas en diafragma.',
    notMeans: 'No impide que otros elementos tengan funciones laterales independientes.'
  },
  {
    scope: 'diaphragmBehavior', value: 'candidate', label: 'Candidato declarado',
    meaning: 'La función de diafragma está en evaluación, pero todavía no está prevista como intención suficiente.',
    declares: 'Un estado candidato explícito, no una propuesta automática.',
    effect: 'SPEC-015-D informa que falta declarar el diafragma; no inicia una ruta lateral intent-backed.',
    notMeans: 'No equivale a Previsto ni a una verificación de diafragma.'
  },
  {
    scope: 'diaphragmBehavior', value: 'undetermined', label: 'Indeterminado',
    meaning: 'Todavía no se ha decidido el comportamiento de diafragma.',
    declares: 'Ausencia deliberada de decisión.',
    effect: 'No inicia una ruta lateral respaldada por intención.',
    notMeans: 'No equivale a No previsto.'
  },
  {
    scope: 'roofBoundary', value: 'gravitySupport', label: 'Apoyo gravitacional',
    meaning: 'Por este borde se busca transferir acciones gravitacionales de la cubierta hacia un receptor compatible.',
    declares: 'Una función de apoyo gravitacional buscada.',
    effect: 'SPEC-015-D puede generar receptores y caminos gravitacionales candidatos desde este borde.',
    notMeans: 'No demuestra capacidad, conexión, anclaje ni que el receptor candidato deba ser aceptado.'
  },
  {
    scope: 'roofBoundary', value: 'lateralSupport', label: 'Apoyo lateral',
    meaning: 'Por este borde se busca restricción o transferencia asociada al comportamiento lateral.',
    declares: 'Una función lateral buscada en el borde.',
    effect: 'Puede participar en propuestas o relaciones laterales compatibles.',
    notMeans: 'No implica carga vertical ni convierte el borde en apoyo gravitacional.'
  },
  {
    scope: 'roofBoundary', value: 'gravityAndLateralSupport', label: 'Apoyo gravitacional y lateral',
    meaning: 'El borde tiene simultáneamente funciones gravitacionales y laterales buscadas.',
    declares: 'Ambas funciones de apoyo como intenciones independientes.',
    effect: 'Puede originar análisis candidatos en los grafos gravitacional y lateral.',
    notMeans: 'No demuestra que una sola conexión resuelva ambas funciones ni verifica capacidad.'
  },
  {
    scope: 'roofBoundary', value: 'geometricBoundary', label: 'Límite geométrico',
    meaning: 'El borde define la geometría de la cubierta sin función resistente declarada.',
    declares: 'Sólo una frontera geométrica.',
    effect: 'No crea receptores resistentes candidatos en SPEC-015-D.',
    notMeans: 'No equivale a un apoyo ni a una exclusión estructural definitiva.'
  },
  {
    scope: 'roofBoundary', value: 'gutterSupport', label: 'Soporte local de canaleta',
    meaning: 'El borde sirve como soporte local asociado a la canaleta.',
    declares: 'Una función local de soporte de canaleta, separada del apoyo global de la cubierta.',
    effect: 'Conserva la condición local, pero no inicia por sí sola un receptor resistente en SPEC-015-D.',
    notMeans: 'No declara apoyo gravitacional de la cubierta ni portancia del elemento vecino.'
  },
  {
    scope: 'roofBoundary', value: 'nonStructuralBoundary', label: 'Límite sin función resistente',
    meaning: 'El borde se declara explícitamente sin función resistente.',
    declares: 'Exclusión resistente deliberada para ese borde.',
    effect: 'No genera receptores resistentes candidatos.',
    notMeans: 'No elimina el borde geométrico de la cubierta.'
  },
  {
    scope: 'roofBoundary', value: 'undetermined', label: 'Indeterminado',
    meaning: 'La función del borde todavía no ha sido decidida.',
    declares: 'Una decisión pendiente explícita.',
    effect: 'El motor no crea apoyos ni receptores por heurística.',
    notMeans: 'No equivale a Límite geométrico ni a Límite sin función resistente.'
  },

  {
    scope: 'interfaceLocation', value: 'facePositiveN', label: 'Cara +N',
    meaning: 'Cara física canónica del host orientada hacia el normal positivo N del marco local S/N/Z.',
    declares: 'Dónde ocurre una interacción sobre una cara del elemento.',
    effect: 'Permite distinguir dos interacciones sobre caras opuestas del mismo muro sin duplicar geometría.',
    notMeans: 'No significa acción lateral, apoyo, carga ni dirección resistente por sí sola.',
    provenance: 'SPEC-015-D REV8 · identidad canónica de interfaces; marco local derivado de geometría agnóstica.'
  },
  {
    scope: 'interfaceLocation', value: 'faceNegativeN', label: 'Cara −N',
    meaning: 'Cara física canónica del host orientada hacia el normal negativo N del marco local S/N/Z.',
    declares: 'Dónde ocurre una interacción sobre la cara opuesta a +N.',
    effect: 'Mantiene separadas interacciones concurrentes sobre ambas caras de un mismo muro.',
    notMeans: 'No significa acción lateral, apoyo, carga ni dirección resistente por sí sola.',
    provenance: 'SPEC-015-D REV8 · identidad canónica de interfaces; marco local derivado de geometría agnóstica.'
  },
  {
    scope: 'interfaceLocation', value: 'endLowS', label: 'Extremo S mínimo',
    meaning: 'Extremo situado en la coordenada canónica mínima S del host, independiente del sentido original del prisma.',
    declares: 'Una ubicación de interacción en un extremo geométrico canónico.',
    effect: 'Permite referir el mismo extremo aunque el muro se haya dibujado en sentido inverso equivalente.',
    notMeans: 'No equivale a inicio de dibujo, apoyo ni destino estructural obligatorio.',
    provenance: 'SPEC-015-D REV8 · identidad canónica de extremos.'
  },
  {
    scope: 'interfaceLocation', value: 'endHighS', label: 'Extremo S máximo',
    meaning: 'Extremo situado en la coordenada canónica máxima S del host, independiente del sentido original del prisma.',
    declares: 'Una ubicación de interacción en el extremo opuesto a S mínimo.',
    effect: 'Da identidad estable al extremo frente a inversión equivalente de la geometría.',
    notMeans: 'No equivale a fin de dibujo, apoyo ni destino estructural obligatorio.',
    provenance: 'SPEC-015-D REV8 · identidad canónica de extremos.'
  },
  {
    scope: 'interactionRole', value: 'receives', label: 'Recibe',
    meaning: 'La interfaz recibe una acción desde otra interfaz dentro de una relación estructural declarada.',
    declares: 'El rol direccional local del puerto dentro de esa relación.',
    effect: 'Participa en el sentido fuente→destino definido por la función de la relación.',
    notMeans: 'No significa que el elemento sea apoyo global, portante o resistente lateral.',
    provenance: 'SPEC-015-D REV8 · relación fuente→destino.'
  },
  {
    scope: 'interactionRole', value: 'delivers', label: 'Entrega',
    meaning: 'La interfaz entrega una acción hacia otra interfaz dentro de una relación estructural declarada.',
    declares: 'El rol direccional local complementario de receives.',
    effect: 'Permite encadenar relaciones sin inferir el rol estructural del host completo.',
    notMeans: 'No significa fuente de carga externa ni capacidad de transferencia verificada.',
    provenance: 'SPEC-015-D REV8 · relación fuente→destino.'
  },
  {
    scope: 'actionFamily', value: 'gravity', label: 'Gravitacional',
    meaning: 'Familia de acciones asociada al flujo gravitacional del mecanismo candidato.',
    declares: 'La familia del grafo en que la relación puede participar.',
    effect: 'La relación sólo se consume en caminos gravitacionales compatibles.',
    notMeans: 'No equivale a apoyo por cara ni demuestra magnitud, capacidad o combinación de carga.',
    provenance: 'SPEC-015-D REV8 · separación explícita de familia de acción y ubicación.'
  },
  {
    scope: 'actionFamily', value: 'lateral', label: 'Lateral',
    meaning: 'Familia de acciones asociada al flujo lateral del mecanismo candidato.',
    declares: 'La pertenencia de la relación al grafo lateral.',
    effect: 'La relación sólo se consume en caminos laterales compatibles.',
    notMeans: 'No describe una cara geométrica ni convierte una interacción por cara en acción lateral.',
    provenance: 'SPEC-015-D REV8 · separación explícita de familia de acción y ubicación.'
  },
  {
    scope: 'actionFamily', value: 'undetermined', label: 'Indeterminada',
    meaning: 'La familia de acción de la relación todavía no se ha decidido.',
    declares: 'Una decisión pendiente explícita.',
    effect: 'La relación no debe inyectarse silenciosamente en gravedad o lateral.',
    notMeans: 'No significa que la relación pertenezca simultáneamente a ambos grafos.',
    provenance: 'SPEC-015-D REV8 · prohibición de inferencia silenciosa.'
  },
  {
    scope: 'relationFunction', value: 'support', label: 'Apoyo / interacción entre hosts',
    meaning: 'Relación declarada que conecta una interfaz que entrega con otra que recibe una familia de acción.',
    declares: 'Conectividad estructural candidata entre hosts concretos.',
    effect: 'Puede enlazar dos tramos de un camino candidato cuando está fresh.',
    notMeans: 'No verifica capacidad, rigidez, conexión, anclaje ni contacto constructivo.',
    provenance: 'SPEC-015-D REV8 · capa de interfaces; compatible con semántica no autoritativa de SPEC-14/015-D.'
  },
  {
    scope: 'relationFunction', value: 'loadTransfer', label: 'Transferencia de acciones',
    meaning: 'Mecanismo declarado que recibe acciones en una o más interfaces y las entrega por una o más interfaces de salida.',
    declares: 'Continuidad funcional dentro de un host o una banda multi-host explícita.',
    effect: 'El grafo recorre receives→delivers y puede ramificarse en destinos declarados.',
    notMeans: 'No crea una viga, cercha, sólido ni ensamblaje constructivo y no verifica capacidad.',
    provenance: 'SPEC-015-D REV8 · caso gobernante frontón C/6→7 y alternativa C/6→11A.'
  },
  {
    scope: 'relationFunction', value: 'collectorAction', label: 'Acción colectora',
    meaning: 'Función declarada para reunir y transferir acciones dentro de una relación candidata.',
    declares: 'Una función de transferencia explícita de tipo colector.',
    effect: 'Se recorre receives→delivers como mecanismo de transferencia.',
    notMeans: 'No define geometría, perfil ni capacidad de un colector constructivo.',
    provenance: 'SPEC-015-A/D · vocabulario de función estructural agnóstica.'
  },
  {
    scope: 'relationFunction', value: 'diaphragmAction', label: 'Acción de diafragma',
    meaning: 'Función declarada asociada a una interacción de diafragma.',
    declares: 'Participación funcional en transferencia/distribución de acciones compatibles.',
    effect: 'Puede integrarse a un grafo lateral cuando el contrato del contexto lo habilite.',
    notMeans: 'No verifica rigidez, revestimientos, conectores ni capacidad de diafragma.',
    provenance: 'SPEC-015-B/D · intención de cubierta y grafos candidatos.'
  },
  {
    scope: 'relationFunction', value: 'stabilization', label: 'Estabilización',
    meaning: 'Función declarada de restricción o estabilización entre interfaces.',
    declares: 'Una interacción estabilizante buscada.',
    effect: 'Puede formar parte de un camino compatible cuando exista familia de acción explícita.',
    notMeans: 'No equivale a acción lateral por ubicación ni prueba estabilidad global.',
    provenance: 'SPEC-015-A/D · vocabulario de función estructural agnóstica.'
  },
  {
    scope: 'structuralRegion', value: 'embeddedRange', label: 'Región estructural embebida',
    meaning: 'Rango S/Z sobre uno de los hosts que participa en una relación, sin crear nueva geometría arquitectónica.',
    declares: 'La porción del host usada por el mecanismo estructural candidato.',
    effect: 'Permite representar C/6→11A como banda superior continua sobre varios muros existentes.',
    notMeans: 'No es un sólido, elemento constructivo, corte de muro ni structuralAssembly persistente.',
    provenance: 'SPEC-015-D REV8 · decisión MEJ-022: structuralRegion sí, structuralAssembly no en este corte.'
  },
  {
    scope: 'proposalState', value: 'candidate', label: 'Candidata',
    meaning: 'Existe evidencia geométrica y declarativa suficiente para presentar una alternativa a revisión humana.',
    declares: 'Un resultado derivado no autoritativo.',
    effect: 'Puede revisarse, modificarse, aceptarse, rechazarse o dejarse pendiente.',
    notMeans: 'No está verificada ni modifica structuralIntent por sí sola.'
  },
  {
    scope: 'pathState', value: 'completeCandidate', label: 'Completa candidata',
    meaning: 'Existe continuidad geométrica/declarativa del camino hasta una base candidata.',
    declares: 'Continuidad candidata del grafo.',
    effect: 'Permite revisar el recorrido completo sin saltos geométricos conocidos.',
    notMeans: 'No verifica capacidad, conexiones, anclajes, rigidez ni deformaciones.'
  },
  {
    scope: 'pathState', value: 'incompleteCandidate', label: 'Incompleta candidata',
    meaning: 'El camino tiene una interrupción o transferencia todavía no declarada.',
    declares: 'Una continuidad parcial con hallazgos explícitos.',
    effect: 'Mantiene visible el tramo conocido y el punto que requiere decisión o transferencia.',
    notMeans: 'No debe completarse inventando colectores, conexiones o apoyos.'
  }
];

export const STRUCTURAL_CONCEPTS = Object.freeze(CONCEPTS.map((concept) => Object.freeze({ ...concept })));

export function structuralConcept(scope, value) {
  return STRUCTURAL_CONCEPTS.find((concept) => concept.scope === scope && concept.value === value) || null;
}

export function structuralConceptOptions(scope) {
  return STRUCTURAL_CONCEPTS
    .filter((concept) => concept.scope === scope)
    .map((concept) => ({ value: concept.value, label: concept.label }));
}

export function structuralConceptCategories() {
  return [
    { scope: 'roofDistribution', title: 'Distribución resistente de cubierta' },
    { scope: 'diaphragmBehavior', title: 'Comportamiento de diafragma' },
    { scope: 'roofBoundary', title: 'Funciones de borde de cubierta' },
    { scope: 'interfaceLocation', title: 'Ubicación canónica de interfaces' },
    { scope: 'interactionRole', title: 'Rol de interacción' },
    { scope: 'actionFamily', title: 'Familia de acción' },
    { scope: 'relationFunction', title: 'Función de la relación' },
    { scope: 'structuralRegion', title: 'Regiones estructurales' },
    { scope: 'proposalState', title: 'Propuestas' },
    { scope: 'pathState', title: 'Caminos candidatos' }
  ];
}
