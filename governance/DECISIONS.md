# Bitácora de decisiones

> Append-only. Una decisión no se edita. Para corregirla se agrega otra que la deroga.

Estados: `vigente`, `derogada por D-xxx`, `descartada`.

| ID | Fecha | Estado | Decisión | Razón |
|---|---|---|---|---|
| D-001 | 27-jul-2026 | vigente | El objetivo es una aplicación local, offline y de un usuario | Reduce superficie operativa y corresponde al uso real |
| D-002 | 27-jul-2026 | vigente | React/Vite y el core actual se conservan; Tauri 2 será el runtime nativo | Minimiza reescritura y elimina el servidor en runtime |
| D-003 | 27-jul-2026 | vigente | Desarrollo y build usan Node 22 LTS fijado por `.nvmrc` | Node 20 está EOL y Node 22 admite el Mac Intel objetivo |
| D-004 | 27-jul-2026 | vigente | No se actualizan majors de React, Vite o Three durante la estabilización | Primero se corrigen integridad y cobertura con menor variación |
| D-005 | 27-jul-2026 | vigente | Las fórmulas usan AST y una lista cerrada; queda prohibido evaluar JavaScript | El modelo es entrada no confiable |
| D-006 | 27-jul-2026 | vigente | Todo proyecto tiene `modelVersion`, validación previa y migraciones secuenciales | Importar nunca debe mutar parcialmente ni perder datos |
| D-007 | 27-jul-2026 | vigente | `roofPlanes` manda en cálculo, pero `roofSystems` heredados se preservan | Precedencia no significa destrucción de datos |
| D-008 | 27-jul-2026 | vigente | La invalidación de derivados se resuelve en un registro central de dependencias | Las acciones aisladas ya demostraron dejar datos falsamente vigentes |
| D-009 | 27-jul-2026 | vigente | Los entregables estructurales con datos stale se bloquean | Un warning opcional no protege una salida de cálculo |
| D-010 | 27-jul-2026 | vigente | Guardado principal por archivos nativos, no `localStorage` | Permite atomicidad, backups y propiedad explícita del usuario |
| D-011 | 27-jul-2026 | vigente | CalculiX se invoca mediante un comando Tauri estrecho, sin shell genérico | Limita inyección y permite timeout, cancelación y logs |
| D-012 | 27-jul-2026 | vigente | La aplicación instalada no realiza conexiones de red | No hay requisito funcional que justifique esa superficie |
| D-013 | 27-jul-2026 | vigente | Firma ad hoc para uso personal; notarización fuera de v1 local | No existe distribución pública en el alcance |
| D-014 | 27-jul-2026 | vigente | Playwright actual corre fuera de este Mac; localmente se usan unitarias, integración y smoke Tauri | La versión actual exige un macOS no soportado por el equipo |
| D-015 | 27-jul-2026 | vigente | Los documentos heredados se archivan y no son fuente del estado nuevo | Evita que cierres históricos reabran deudas ya resueltas |
| D-016 | 27-jul-2026 | vigente | Cobertura bloquea en 90 % para core y 50 % como piso heredado del store; el objetivo del store sigue en 85 % | Mantiene el objetivo de dominio y evita fingir cobertura del store durante una migración sin cambios funcionales |
| D-017 | 27-jul-2026 | vigente | El manifiesto conserva el hash del origen y registra por spec un hash de workspace para cada archivo modificado después del bootstrap | Permite evolucionar el código sin destruir la evidencia byte a byte de la migración |
| D-018 | 27-jul-2026 | vigente | Una fuente oficial sin edición declarada registra literalmente esa ausencia y fija URL y fecha de consulta; la fecha del archivo no se presenta como edición | Mantiene trazabilidad verificable sin fabricar metadata documental |
| D-019 | 27-jul-2026 | vigente | `modelVersion` 2 agrega `wallTypes`; la migración deja los muros sin tipo, conserva defaults/overrides y nunca infiere rol desde geometría o derivados | Los datos existentes no demuestran una función estructural y no pueden descartarse para acomodar el formato nuevo |
| D-020 | 27-jul-2026 | vigente | La rotación de placas se deriva del rol: sólo `tabique` puede rotar; MP1/MP2/MP3 y muros sin rol permanecen sin rotación | La chapa MP1 exige hebra vertical, MP2 no usa OSB como corte, MP3 sigue siendo estructural y sólo tabique declara inequívocamente uso no estructural |
| D-021 | 27-jul-2026 | vigente | Los encuentros de muro se resuelven como una topología global por nodos y bandas Z; `start/end` siguen un frame normalizado desde la menor coordenada y nunca el orden declarado del muro | Un booleano por extremo admite paralelos, niveles disjuntos, pierde candidatos y marca el lado opuesto en muros invertidos |
| D-022 | 27-jul-2026 | vigente | El nuevo solver no genera `backup`: una L usa los dos montantes terminales y una T garantiza además un montante en el cuerpo anfitrión, formando el pilar contiguo cosido N°10×3/4″ @150 zig-zag | La fuente primaria muestra dos perfiles contiguos; en `casa-L`, 19 de 26 T extremo-cuerpo carecen hoy del apoyo anfitrión |
| D-023 | 27-jul-2026 | vigente | En una L, el muro elegido por legado D-024 prolonga su envolvente OSB media cara del otro y el muro que recibe se retranquea media cara del primero; T no mueve OSB y el largo estructural no cambia | Traduce la prioridad de oficina a un origen medible usando las caras ya resueltas, sin inventar espesor de placa ni acoplar techumbre |
| D-024 | 27-jul-2026 | vigente | Los checks R7 no regeneran ni infieren roles; devuelven findings y cobertura explícita para todo caso omitido | Validar el modelo actual es distinto de producir derivados, y un dato ausente no puede convertirse en cumplimiento por silencio |
| D-025 | 27-jul-2026 | vigente | La distancia montante–jamba se mide eje a eje; sólo puede omitirse un `stud` regular si el paso resultante cumple el máximo del rol, nunca un pilar L/T, borde o jamba | Separa el criterio de oficina 30/150 mm del límite manual 610/600 mm y preserva los apoyos estructurales de R6 |
| D-026 | 27-jul-2026 | vigente | La holgura de puerta se mide desde su borde de referencia a la cara del muro perpendicular, con signo y tolerancia geométrica de 1 mm; no se afirma haber verificado giro ni lado real de manilla | El modelo guarda el datum de posición, pero no handedness; usar `edgeOffset` directo mediría al eje y sobreafirmar la manilla inventaría datos |
| D-027 | 27-jul-2026 | vigente | Las llegadas de cercha sólo se revisan cuando caen sobre vano; la coincidencia se limita a media ala `B/2` del perfil resoluble y nunca a 19 mm por default | El detalle exige coincidir con el pie derecho del dintel y 19 mm sólo deriva de la serie 90 con B=38 |
| D-028 | 27-jul-2026 | vigente | La capacidad de corte separa resultados verificados, condicionados y excluidos por dirección; una condición desconocida impide sumar 417 kgf/m como capacidad verificada | El modelo aún no demuestra todas las fijaciones, caras de OSB ni dobles de extremo exigidos por §1.5.2.1 |

Las decisiones constructivas D-001 a D-033 del proyecto anterior se preservan como historia en
`archive/LEGACY_DECISIONS.md`. Las reglas vigentes derivadas viven en `domain/DOMAIN_RULES.md`.
