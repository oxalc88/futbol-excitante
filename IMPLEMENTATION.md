# Contrato de esta reconstrucción

## Fuentes preservadas

`VISION.md`, los siete documentos de `research/` y los seis de `specs/` se conservan byte a byte. Se partió del commit `becbcdc0aaaace4f9b98006ae44e0449795c001a`. No se reutilizaron el motor, el pipeline de agentes, los evaluadores ni la UI anteriores.

La visión es la intención de producto. La auditoría de investigación prevalece frente a recomendaciones contradictorias de tecnología. Las especificaciones distinguen un objetivo futuro de un comportamiento medido o aceptado; esta implementación hace la misma distinción.

## Implementado

| Objetivo de la visión | Implementación |
|---|---|
| Partido 11v11, también grupos pequeños | 11v11, 5v5 y 2v2; un arquero por equipo |
| Balón físico independiente | Posición y velocidad 3D, gravedad, rodadura, arrastre, rebote, spin, curva y postes; cuatro subpasos por tick |
| Peso de los jugadores | Intención, velocidad real y orientación independientes, aceleración, frenado, giro, stamina y protección |
| Individualidad | Arquetipos ficticios físicos y técnicos; capacidades separadas de la presentación |
| Interacción | Primer toque contextual, microcontactos de conducción, pase corto, filtrado, centro, disparo, cabezazo, tackle, contacto corporal e interceptación |
| Porteros | Arco y deriva acotados, reacción con ticks, contacto explícito, claim/atajada y distribución |
| IA y táctica | Formación, fases de transición, asignación de perseguidor, apoyos, marcas, coberturas; selección de pase con estimación de tiempo de llegada |
| Reglas | Balón fuera, banda, córner, saque de meta, gol, reloj, entretiempo, cambio de lados, fuera de juego por intervención y faltas básicas con tiro libre |
| Controles | Teclado, dos slots, dos mandos estándar, botones y stick táctil |
| Presentación | Three.js, cancha 3D, jugadores estilizados articulados, color/patrón diferenciados, arquero distinto, indicador, radar, cámaras, HUD y sonido opcional |
| Datos reemplazables | Contrato neutral, validación de equipo JSON e importación manual; datos integrados sin requests en partido |
| Repetición | Estado inicial completo + seed/config + inputs con tick + hash final, exportación/importación |
| Modo headless | Mismo core, pasos síncronos sin timers y reporte de eventos |
| P2P | Prototipo de autoridad en anfitrión, signaling manual e interpolación de snapshots; pendiente prueba entre dispositivos |
| Publicación | Vite estático y workflow para GitHub Pages |

## Reglas experimentales: `rules-rebuild-v1`

La especificación conservada describe parte de la implementación anterior y difiere de la autoridad general definida por Technical Spec. Esta reconstrucción declara sus diferencias:

- **Autoridad:** el core posee marcador, posesión estadística, reloj y reinicios. Los runners nunca escriben fases. El marcador no se vuelve a derivar en otro adaptador.
- **Tiempo:** ticks fijos de 1/60 s. Se acumula tiempo de juego sólo en `playing`; cada mitad dura la mitad del tiempo real elegido. Se muestra 45 minutos por mitad. No hay añadido, prórroga ni penales de desempate.
- **Cruce:** balón completamente al otro lado de la línea; el barrido usa el radio del balón. Un gol requiere que el balón completo quepa entre postes y bajo el larguero. Esto corrige deliberadamente el criterio de centro cruzando línea descrito en el documento histórico.
- **Reinicios:** un jugador de campo del equipo premiado toma el saque. Todos quedan congelados durante la preparación; la ejecución genera un contacto con identidad. Los arqueros nunca son elegidos como sacadores. La reposición de un saque es una discontinuidad explícita y no un movimiento físico.
- **Último toque ausente:** se emite `unattributed-boundary` y se coloca un reinicio diagnóstico para el local. Los partidos normales tienen contacto desde el saque inicial. Es una recuperación de estado experimental, no una interpretación arbitral.
- **Fuera de juego:** se toma una foto lógica de posiciones al golpeo; se marca a quien esté en mitad rival y más allá del balón y el segundo último rival. Se sanciona al tocar el balón. Los saques automáticos no generan esa foto. No se modela interferencia sin contacto, rebotes con distinción de parada deliberada, ni juego deliberado vs desvío en profundidad.
- **Falta:** un tackle que falla el balón y alcanza un rival dentro de su ventana ocasiona recuperación y tiro libre. No hay ventaja, tarjetas, expulsión ni penalti: incluso una falta dentro del área genera tiro libre en este perfil básico.
- **Arqueros 11v11:** se reutiliza el modelo de arco pequeño como prototipo. No hay salidas extensas, captura de centros calibrada, cesión reglamentaria, límite de manos por área, ni biomecánica real de manos. Un claim frena el balón en el punto de contacto sin parentarlo al arquero.
- **Arbitraje del tick:** comandos → decisiones de equipo coherentes → intenciones → preparación de acciones → locomoción → pares de cuerpos en IDs estables → tackle activo → golpeos activos en IDs estables → física subpasada → postes → primer cruce de límite → contactos con balón → hechos derivados/reloj. Una falta invalida el golpeo pendiente al abrir el reinicio. El límite prevalece sobre un contacto posterior fuera del campo; un golpe en poste modifica la trayectoria antes del cruce.
- **Contactos simultáneos:** dentro de un subpaso se ordenan por fracción de barrido, distancia e ID. Se procesa un contacto de jugador por subpaso. Es una política determinista provisional, no una garantía de resolver todos los casos reglamentarios.

## Determinismo y presentación

`world-v1`, `vision-rebuild-config-v1`, xorshift32 y serialización canónica con claves ordenadas. El hash FNV-1a de 32 bits sirve para diagnóstico, no como prueba criptográfica. Snapshot/restore incluye PRNG, inputs futuros, memoria AI, contactos, acciones y estado de reinicio. El core rechaza entradas duplicadas o inválidas; el input ausente del slot humano es neutro.

El acumulador del navegador conserva el dt y limita recuperación a seis pasos por frame; al ocultar la página se pausa. La interpolación y los movimientos articulares son sólo visuales. Los cuerpos tienen variación visual reproducible por perfil ficticio, sin cambiar física. La cancha, postes y balón se representan en las unidades del motor.

La representación articulada se genera por código y es original. No hay assets, marcas, nombres de equipos ni datos de jugadores de PES. La anatomía y animación son un prototipo: faltan assets riggeados de producción y validación completa de `EmbodimentMapping`, correcciones pie/mano-balón y pruebas monocromas/LOD de la especificación visual. La elección de kits usa patrón y contraste de valor con una alternativa para enfrentamientos del mismo equipo; falta validar el criterio con simulaciones de visión de color.

## Qué no se afirma como terminado

La implementación cubre una versión jugable de las mecánicas de la visión, **no todo el programa de investigación y todos los requisitos normativos**:

- No existe el corpus PES de mediciones y capturas controladas. No se afirma sentir igual que PES 2017.
- No están materializadas todas las registries, bindings y oráculos protegidos de `GAMEPLAY_EVALUATION_SPEC.md`, ni las pruebas de mutantes. El reporte lista cada ID original como `NOT_EVALUATED`; las pruebas de este rebuild usan contratos independientes y sus nombres reales.
- No se completaron evaluaciones perceptuales, benchmark de GPU en dispositivos objetivo, pruebas reales de dos mandos o pruebas entre dos navegadores por Internet.
- Las reglas indicadas arriba son básicas; faltan los casos reglamentarios completos, árbitro, tarjetas, ventaja y penaltis.
- Networking sigue experimental; no se implementaron servidores Colyseus/Durable Objects, matchmaking, relay TURN, predicción, rollback o autoridad de producción. La visión enumera esas alternativas como fases futuras, no como servicios que deban coexistir.
- No se hicieron scraping, licencias de equipos reales, infraestructura permanente, bases de datos, WASM, ECS, aprendizaje automático ni un nuevo orquestador de agentes; los propios documentos los difieren.

## Validación reproducible

`npm test` verifica reproducibilidad, checkpoint/replay, independencia del balón, locomoción, goles barridos, poste, reinicios y reloj, cardinalidad/arco de porteros, acciones, fuera de juego y validación de datos. `npm run evaluate` ejecuta tres partidos CPU 11v11 con semillas diferentes hasta fulltime, preserva estadísticas y registra limitaciones explícitas. `npm run build` valida tipos y los recursos web.

Esta evidencia no sustituye el juego humano. La siguiente validación de producto consiste en abrir el despliegue, jugar un partido con mando/teclado, observar controles y pases a distintas velocidades y probar los dos slots y móviles.
