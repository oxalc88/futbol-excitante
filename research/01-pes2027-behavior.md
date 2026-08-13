# Ingeniería de comportamiento inspirada en PES 2017 para un motor 11v11 en navegador

## Evidencia, método y límites de inferencia

El objetivo útil no es reconstruir el código de *PES 2017*, sino convertir su “sensación” en un conjunto de **observables externos, curvas de respuesta, estados y pruebas reproducibles** que puedan implementarse de forma independiente. Esto encaja particularmente bien con *PES 2017* porque la propia comunicación de Konami describió el juego en términos de entradas y resultados perceptibles —primer toque condicionado por atributos y por el balón, pases dependientes de orientación y situación, individualidad de movimiento, colisiones, IA adaptativa, instrucciones tácticas— pero **no publicó sus ecuaciones internas**. citeturn15search0turn15search2

La clasificación usada en todo el informe es estricta:


| Etiqueta            | Qué significa aquí                                                                                                                             |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| **KNOWN**           | Konami u otra documentación primaria describe explícitamente que el comportamiento o condicionante existe. No implica conocer la fórmula.      |
| **OBSERVED**        | El resultado aparece en gameplay, análisis contemporáneos o datos directamente expuestos por el juego, pero no conocemos su mecanismo interno. |
| **COMMUNITY CLAIM** | Jugadores, modders o analistas de comunidad reportan un efecto que no está confirmado independientemente.                                      |
| **HYPOTHESIS**      | Explicación de implementación propuesta para el motor nuevo. **Nunca debe interpretarse como la implementación de PES 2017.**                  |


La confianza usada es **Muy alta** cuando hay material primario inequívoco; **Alta** cuando coinciden material primario y observaciones independientes; **Media** cuando el fenómeno visual es claro pero su causalidad no lo es; y **Baja** cuando depende principalmente de testimonios comunitarios o de una hipótesis no medida.

Una limitación importante para cualquier trabajo frame-by-frame es la **versión y plataforma**. La base de PES Master declara explícitamente que sus datos de PES 2017 fueron exportados de la versión 1.00 y contiene unas 13.000 fichas, señalando además que algunos overall ratings pueden diferir del juego. citeturn17search10 Los videos de PC, PS4, demo, versión final y juegos actualizados no deben mezclarse sin etiquetarlos. Para una campaña de medición seria conviene registrar como metadata: plataforma, build o fecha aproximada, velocidad de juego configurada, modo de pase, cámara, dificultad, jugador, equipo, minuto del encuentro y, si es posible, stamina.

También es crucial distinguir **“realismo físico” de “fidelidad a PES 2017”**. La literatura biomecánica y de animación sirve como prior de diseño, no como evidencia de cómo funciona PES. Por ejemplo, estudios reales de cambio de dirección en futbolistas miden por separado velocidad previa, deceleración, giro y reaceleración, y encuentran dependencia con el ángulo; un estudio de 2016 usó sensores láser a 100 Hz para sprints rectos, giros de 45° y de 90°. citeturn18search2turn18search6 De forma análoga, trabajos de animación interactiva como *Motion Fields* buscan precisamente combinar respuesta rápida a input con locomoción visualmente natural, y *Motion Matching* constituye una familia posterior de métodos para seleccionar movimiento a partir del estado y la intención del personaje. Son arquitecturas plausibles para **nuestro** motor, no pruebas sobre Fox Engine. citeturn18search0turn18search1turn18search35

**Principio de ingeniería recomendado.** El objetivo de calibración debe ser una función de pérdida sobre observables:

`PES-video/reference → measurements → target envelopes → our engine → measurements → error`

No se debería perseguir “el número PES” para aceleración, fricción o giro porque esa constante pública no existe. Se debería perseguir, por ejemplo: “este arquetipo alcanza el 90 % de su velocidad asintótica en aproximadamente X–Y frames bajo esta prueba”, dejando X–Y sin fijar hasta haber medido suficientes muestras.

Para convertir video perspectivo a distancias, las marcas del campo ofrecen escalas conocidas. La IFAB define, por ejemplo, la profundidad del área penal en 16,5 m y el punto penal a 11 m; esas dimensiones permiten construir una homografía aproximada cuando las líneas relevantes son visibles. citeturn14search0 Esto es preferible a estimar metros “a ojo”.

## Movimiento, aceleración, orientación, inercia y contacto

La conclusión principal de esta familia de sistemas es que el “peso” de *PES 2017* **no parece proceder de controles lentos**. Al contrario: Konami promocionó tiempos de respuesta inmediatos y múltiples reviewers describieron un juego muy responsivo, mientras que simultáneamente señalaron peso, momentum y transiciones corporales al girar. citeturn15search5turn14search12turn16search5 Esta combinación —**intención inmediata, cuerpo no instantáneo**— es probablemente una de las propiedades perceptuales más importantes que debe conservar el motor.

**Locomoción general.**  
**KNOWN:** Konami indicó que *Natural Player Movement* incorporaba cientos de animaciones nuevas, especialmente para recepciones y pases, y que las interacciones y colisiones se habían desarrollado para expresar individualidad. También afirmó mediante Player ID que jugadores concretos podían distinguirse por postura, golpeo y movimiento para buscar espacios. citeturn15search0turn15search5  
**OBSERVED:** GameSpot describió mejoras simultáneas en control de balón, giros, recuperación tras contacto y cambios de dirección, conservando una sensación de peso y momentum durante el dribbling. GamesRadar habló de locomoción más suave y verosímil. citeturn14search12turn16search0  
**Confianza:** Alta.  
**Parámetros candidatos:** estado walk/jog/run/sprint, velocidad actual, intención del stick, orientación corporal, balón controlado/no controlado, stamina y atributos de movilidad. En el dataset de PES 2017 aparecen como dimensiones separadas `Speed`, `Explosive Power`, `Body Control`, `Physical Contact` y `Stamina`. Messi, por ejemplo, figura con Speed 91 y Explosive Power 96, mientras Cristiano Ronaldo aparece con 91 y 90 respectivamente, demostrando como mínimo que el juego **representaba velocidad y explosividad por separado**. citeturn17search6turn17search7  
**Mediciones:** posición 2D por frame, velocidad instantánea, aceleración, orientación del torso, orientación de desplazamiento, frecuencia de pasos, distancia por ciclo, tiempo de transición entre estados.  
**HYPOTHESIS:** usar un estado cinemático continuo separado del estado visual. La orden del usuario puede actualizar la trayectoria objetivo inmediatamente, mientras velocidad y orientación física convergen con límites distintos. Un selector de animación basado en velocidad, fase locomotora, orientación y trayectoria deseada puede producir agilidad sin teleportar la dirección del cuerpo. Esto es coherente como diseño con la literatura de locomoción interactiva, pero no describe una arquitectura conocida de PES. citeturn18search0turn18search35  
**Pregunta abierta:** cuánto de la variación de PES era cinemática y cuánto era únicamente selección de animación.

**Aceleración y “Explosive Power”.**  
**KNOWN:** la existencia simultánea de Speed y Explosive Power en el roster de PES 2017 está corroborada por bases que reflejan el dataset del juego; Konami también comunicó que los atributos de jugador participan en el comportamiento individual. citeturn17search10turn15search0  
**OBSERVED:** jugadores de alta explosividad son percibidos como más “nippy” o capaces de iniciar cambios ofensivos con rapidez, mientras que reviews contemporáneos distinguieron ese tipo de jugador de futbolistas físicamente grandes. citeturn14search24turn17search12  
**COMMUNITY CLAIM:** es común interpretar Explosive Power como aceleración/agilidad inicial, pero no hay evidencia pública de una función exacta ni de que sea una simple constante `m/s²`.  
**Confianza:** Alta en que es una dimensión separada; Baja en cualquier mapping matemático concreto.  
**Experimento:** jugador inmóvil, sprint recto de 10–20 m, cinco o más repeticiones por jugador. Comparar jugadores con Speed similar y Explosive Power muy distinta. Registrar `t_25%`, `t_50%`, `t_90%` de velocidad máxima observada, distancia en los primeros 0,25/0,5/1,0 s y pendiente de `v(t)`.  
**HYPOTHESIS:** Explosive Power debería controlar principalmente la **curva transitoria hacia una velocidad deseada**, no necesariamente la velocidad asintótica. Para el motor original es mejor usar una curva calibrable que una fórmula lineal rígida.

**Velocidad máxima.**  
**OBSERVED:** los atributos separan Speed de Explosive Power, y reviewers destacan diferencias entre corredores rápidos y jugadores físicos. citeturn17search6turn17search7turn14search24  
**Confianza:** Media-Alta. No hay tabla oficial que diga “Speed 90 = N m/s”.  
**Experimento:** carrera suficientemente larga para que `dv/dt` se aproxime a cero; repetir con y sin balón y con stamina alta/baja. Medir máximo móvil sobre ventanas de varios frames para evitar ruido.  
**HYPOTHESIS:** parametrizar `v_max_offball` y aplicar un costo de conducción dependiente de control de balón y contexto. No asumir que PES utilizaba un multiplicador fijo con balón.  
**Pregunta abierta:** magnitud exacta de las compresiones entre ratings altos; podría existir saturación, curvas no lineales o influencia de animación.

**Deceleración e inercia.**  
**OBSERVED:** GameSpot señaló explícitamente sensación de peso/momentum al girar y recuperación mejorada después de cambios de dirección. citeturn14search12  
**Confianza:** Alta en el fenómeno, Baja en el mecanismo.  
**Experimentos:** sprint → soltar sprint; sprint → stick neutro; sprint → input contrario 180°; sprint → pase/tiro. Medir distancia de parada, `t_stop`, aceleración longitudinal negativa máxima, velocidad residual a 100/200/300 ms y diferencia con balón.  
**HYPOTHESIS:** no hacer `velocity = input * maxSpeed`. Mantener momento lineal perceptual mediante límites de frenado, pero permitir que el **input cambie la intención instantáneamente**. El jugador puede empezar una animación de plantado antes de invertir por completo su velocidad.

**Radio de giro y cambios de dirección.**  
**OBSERVED:** la sensación reportada combina agilidad mejorada con momentum. Eso implica que un giro no debe ser ni una rotación sobre el eje sin pérdida de velocidad ni una maniobra excesivamente torpe. citeturn14search12turn16search0  
**Confianza:** Alta.  
**Mediciones:** para entradas de 45°, 90° y 180°, medir velocidad justo antes de girar, velocidad mínima durante el corte, porcentaje de velocidad retenida, tiempo hasta alcanzar la nueva dirección, curvatura máxima `κ`, radio mínimo aproximado `R=1/κ` y tiempo de reaceleración. La literatura deportiva respalda tratar 45° y 90° como condiciones diferentes, no como el mismo giro escalado linealmente. citeturn18search2turn18search14  
**HYPOTHESIS:** el costo de dirección debe crecer con el ángulo y con la velocidad previa, con capacidad individual para reducir la pérdida. Evitar inventar una ecuación PES; calibrar una superficie `speed × turn_angle × archetype → speed_retention/turn_time`.

**Orientación corporal.**  
**KNOWN:** Konami decía que la dirección y ángulo del jugador influían en Precise Pass y en la animación resultante; Player ID también cubría postura y modos de movimiento. citeturn15search0turn15search5  
**OBSERVED:** recepciones, pases y cambios de dirección no parecen equivalentes cuando el jugador está bien perfilado o de espaldas. Esa contextualidad es precisamente parte de lo que Konami asociaba con Real Touch. citeturn15search8  
**Confianza:** Muy alta en la relevancia de orientación.  
**Implementación:** mantener al menos tres vectores separados: `move_direction`, `body_forward` y `desired_action_direction`. El agente no debe tratarse como un punto sin orientación.  
**Mediciones:** diferencia angular entre torso, velocidad, balón entrante y objetivo del pase; delay hasta reorientación; pie usado; contacto necesario antes de ejecutar la siguiente acción.  
**Pregunta abierta:** cuánto puede desacoplarse la orientación visual del vector físico de desplazamiento antes de activar una animación especial.

**Balance / Body Control.**  
**KNOWN:** Konami anunció dos parámetros nuevos relacionados con expresar la diferencia entre jugadores fuertes físicamente y jugadores buenos manteniendo equilibrio bajo presión. citeturn15search0  
**OBSERVED:** el dataset de PES 2017 contiene por separado `Body Control` y `Physical Contact`; Messi aparece con 96/81 y Cristiano con 80/87, un contraste útil para diseñar arquetipos. citeturn17search6turn17search7  
**HYPOTHESIS:** es razonable inferir que esos dos campos están relacionados con la separación conceptual descrita por Konami, pero la correspondencia exacta y cualquier fórmula **no están documentadas públicamente**.  
**Confianza:** Alta en la separación conceptual; Media en mapear el texto promocional directamente a ambos nombres de stats.  
**Experimento:** someter a dos jugadores de fuerza parecida y Body Control distinto a contactos laterales idénticos durante conducción y giro. Medir desplazamiento, pérdida angular, pérdida de velocidad, probabilidad de stumble y tiempo de recuperación.

**Contacto físico.**  
**KNOWN:** Konami habló explícitamente de colisiones y forcejeos desarrollados, y citó como ejemplo la diferencia entre la fortaleza física de Giroud y el balance de Özil. También señaló mejoras en la evaluación arbitral de choques. citeturn15search0  
**OBSERVED:** reviews contemporáneos describen cambios de peso para proteger el balón y jugadores fuertes capaces de imponerse físicamente. citeturn16search0turn14search24  
**COMMUNITY CLAIM:** un experimento de Evo-Web que elevó `Physical Contact` de todos los jugadores a 99 reportó un juego ligeramente más agresivo y más interacción física. Es una prueba de sensibilidad interesante, pero no demuestra cómo opera el atributo internamente. citeturn20search0  
**Confianza:** Alta en que el contacto y la individualidad física importan; Baja en el claim de causalidad específica del mod.  
**Parámetros candidatos para nuestro motor:** masa efectiva, Physical Strength, Body Control, velocidad relativa, ángulo de impacto, lado protegido, posesión, postura y fase de animación.  
**Experimentos:** shoulder-to-shoulder paralelo; perseguidor entrando a 30°; choque frontal; atacante quieto protegiendo; atacante girando; mismos jugadores intercambiando lados. Medir velocidad perdida por ambos, separación lateral, duración del forcejeo, posesión, caída, recuperación y foul/no foul.  
**HYPOTHESIS:** resolver primero el impulso físico/posicional y luego evaluar un estado de balance. La resolución no debería convertirse en una tirada binaria “stat mayor gana”.

**Implicación concreta para el agente de código:** el controlador de locomoción debería exponer al menos:

```text
linearVelocity
desiredVelocity
bodyHeading
desiredHeading
accelerationCapacity
brakingCapacity
turningCapacity
balanceState
contactState
locomotionPhase
hasControlledBall
staminaState
```

Los ratings no deberían mapearse directamente a esas variables hasta que los tests hayan producido curvas objetivo.

## Balón independiente, primer toque, pases, tiros y juego aéreo

La segunda propiedad central es que *PES 2017* comunica continuamente que **el balón tiene estado propio**. Konami vinculó Real Touch y Precise Pass a “real ball physics”, y las reviews destacaron rebotes, balones sueltos y situaciones donde el jugador debe recuperar control en vez de recibir un objeto pegado al pie. citeturn15search0turn16search4 La arquitectura original recomendada, por tanto, debe tratar al balón como una entidad física independiente y convertir la posesión en un **estado emergente de capacidad de interacción**, no en parenting permanente al jugador.

**Independencia del balón.**  
**KNOWN:** Real Touch se describió explícitamente como una interacción entre atributos, movimiento impredecible del balón e input; Precise Pass se presentó unido a la física del balón. citeturn15search0turn15search2  
**OBSERVED:** The Guardian destacó que los balones sueltos rebotan entre jugadores y requieren ser controlados, produciendo secuencias caóticas en el área. citeturn16search4  
**Confianza:** Muy alta.  
**HYPOTHESIS:** el balón debe poseer continuamente `position`, `linearVelocity`, `angularVelocity` y estado de contacto, y el jugador sólo modificarlo mediante eventos discretos de pie/cabeza/cuerpo o mediante microcontactos de conducción.  
**Experimento:** cámara lenta de conducciones rápidas, tackles y rebotes. Medir distancia pie-balón entre contactos, intervalos entre toques y si la trayectoria del balón continúa independientemente cuando el jugador cambia de animación.  
**Pregunta abierta:** qué nivel de “ayuda invisible” para atraer/interceptar el balón utiliza PES.

**Fricción y desaceleración del balón en suelo.**  
**KNOWN:** no se encontró documentación primaria que publique coeficientes de fricción o una ley de desaceleración de PES 2017.  
**OBSERVED:** reviews hablan de peso físico convincente, pero esto no basta para distinguir desaceleración constante, dependiente de velocidad o una curva diseñada. citeturn16search4turn14search21  
**Confianza:** Media en que existe un roll-off perceptible; desconocida en su función.  
**Medición prioritaria:** en una secuencia de pase sin interceptores, obtener el centro de la pelota cada frame, corregir perspectiva y ajustar varias familias de modelos a `v(t)`: desaceleración aproximadamente constante, proporcional a `v`, y curvas por tramos. Comparar error residual en lugar de elegir a priori.  
**Experimentos:** pases rasos de al menos tres potencias y distancias; dejar rodar un balón liberado; repetir sobre la misma zona del campo.  
**HYPOTHESIS:** conviene que nuestro modelo permita una curva ligeramente dependiente de velocidad, aunque la elección final debe provenir de datos PES, no de realismo teórico.  
**Pregunta abierta:** si PES diferencia superficie, clima o estado del césped en esta física concreta.

**Rebote y comportamiento aéreo.**  
**KNOWN:** Konami afirmó física de balón renovada y, para los porteros, que la trayectoria de un despeje/reflejo variaría según la parte del cuerpo golpeada. citeturn15search0  
**OBSERVED:** se ven balones divididos y rebotes no predeterminados hacia un receptor fijo; reviews mencionaron rebounds como parte destacada del comportamiento físico. citeturn16search4turn14search21  
**Confianza:** Alta en la independencia del rebote; Baja respecto a coeficientes concretos.  
**Medidas:** velocidad normal antes/después del bote, razón de altura `h₂/h₁`, velocidad tangencial, cambio de spin, ángulo incidente y saliente.  
**HYPOTHESIS:** esfera rígida simplificada con restitución y fricción tangencial funciona como base; después puede añadirse corrección perceptual para no producir rebotes excesivamente elásticos.

**Spin y curva.**  
**OBSERVED:** el dataset incluye `Swerve` como atributo independiente —Messi 89 y Ronaldo 85 en las fuentes consultadas—, además de Kicking Power. citeturn17search6turn17search7  
**KNOWN:** Konami afirma que atributos/habilidades y física del balón influyen en la trayectoria, aunque no publica una ecuación de efecto. citeturn15search0  
**Confianza:** Alta en que la curva es una dimensión de individualidad; Baja en la función.  
**HYPOTHESIS:** en nuestro motor, spin puede modelarse físicamente con una fuerza lateral tipo Magnus y después calibrarse. Experimentos con balones de fútbol reales muestran que la fuerza lateral de Magnus cambia con la velocidad del balón, por lo que no es ideal implementar “curva constante por segundo”. citeturn18search3turn18search15 Esto es literatura física, **no evidencia de que PES calcule Magnus de esta manera**.  
**Experimento:** mismo jugador, mismo ángulo y mismo tipo de golpeo, varias potencias; trazar desviación lateral respecto de una parábola/recta base, ángulo de spin aparente, apex, tiempo de vuelo y curvatura en primer/último tercio.  
**Pregunta abierta:** cuánto de los tiros curvos de PES es simulación aerodinámica y cuánto trayectoria parametrizada.

**Real Touch / primer toque.**  
Aquí la documentación es excepcionalmente clara.  
**KNOWN:** Konami dijo que el primer toque depende de los atributos del jugador y de la física del balón; otra comunicación especificó como factores la **altura y potencia del pase** y la habilidad natural del jugador. También señaló que el resultado cambia según dónde y cómo se controle al receptor, y que el usuario tiene más control sobre la forma de recibir. citeturn15search0turn15search8turn15search15  
**OBSERVED:** reviewers contemporáneos consideraron el control de balón y el primer toque una de las mejoras más visibles; Use A Potion, por ejemplo, atribuyó parte de la sensación de mayor rapidez a la respuesta del primer toque. citeturn16search0turn14search24  
**Confianza:** Muy alta.  
**Variables que deberían entrar en nuestras pruebas:** velocidad 3D del balón entrante; altura; spin; body heading; dirección de desplazamiento; stick/intención de salida; pie dominante; atributos de control; presión del defensor.  
**Medidas:** distancia máxima balón-receptor durante el primer toque; velocidad del balón después del contacto; ángulo entre incoming y outgoing velocity; duración desde contacto hasta siguiente acción posible; número de pasos de ajuste; pie/contact surface elegido.  
**HYPOTHESIS:** Real Touch se reproduce mejor como una selección contextual entre varias familias de recepción —absorber, empujar al espacio, giro con toque, dejar correr, control aéreo— y no como una mera reducción del ruido de posición.

**Recepción de espaldas.**  
**KNOWN:** dirección y ángulo del jugador son factores documentados en el sistema de pase y el control depende de cómo se recibe. citeturn15search0  
**HYPOTHESIS:** un pase rápido a un receptor orientado 180° respecto de la salida deseada debería requerir mayor tiempo o una acción de giro/control más compleja que una recepción abierta a 30–60°.  
**Experimento:** mismo receptor y misma velocidad de pase a orientaciones de 0°, 45°, 90°, 135° y 180°.  
**Medidas:** tiempo hasta poder avanzar en dirección objetivo, touch distance, pasos de pivote, velocidad retenida.  
**Confianza:** Alta en que la orientación importa; Media sobre la forma exacta de la penalización.

**Pierna mala y primer toque.**  
**OBSERVED:** PES 2017 representa `Weak Foot Use` y `Weak Foot Accuracy` por separado; las fichas de Messi y Ronaldo muestran ambos campos. citeturn17search6turn17search7  
**UNKNOWN:** las fuentes primarias consultadas no confirman que esos atributos se apliquen específicamente a Real Touch ni cómo.  
**HYPOTHESIS:** permitir que dominancia de pie afecte disponibilidad/calidad de determinados contactos es razonable, pero debe aislarse experimentalmente antes de copiar esa relación al modelo.  
**Test:** forzar pases a pie fuerte y débil desde orientación simétrica; medir pie elegido, error de control y latencia a la siguiente acción.

**Pase raso.**  
**KNOWN:** Precise Pass depende de ratings/habilidades del jugador, dirección, ángulo, situación y timing; Konami también dijo que el usuario controla el peso y velocidad de cada pase. citeturn15search0turn15search1  
**OBSERVED:** reviews describen pases generalmente precisos y fluidos, aunque GameSpot encontró que pases filtrados cortos en triángulos podían salir subpotenciados. citeturn16search2turn16search5  
**Parámetros observables del roster:** `Low Pass`, `Kicking Power`, `Ball Control`, pie dominante y skills existen, pero **no está documentado que Kicking Power entre en una fórmula de pase raso concreta**. citeturn17search6turn17search7  
**Confianza:** Muy alta sobre orientación/timing/atributos; Baja sobre mapping individual.  
**Medidas:** velocidad inicial, tiempo hasta receptor, velocidad al llegar, error lateral/longitudinal, dirección corporal al golpear, tiempo de preparación.  
**HYPOTHESIS:** separar tres problemas: selección del target/lead point, generación de error y generación del impulso físico. No combinar “accuracy” y “ball speed” en una única variable.

**Pase elevado, centro y pase bombeado.**  
**KNOWN:** el roster distingue `Lofted Pass`; las comunicaciones de Precise Pass aplican la misma dependencia contextual general. citeturn17search6turn15search0  
**OBSERVED:** guías contemporáneas reconocen variantes rasas, elevadas y centros curvos; algunos reviewers percibieron ciertos centros como excesivamente flotantes, lo cual es importante si se intenta copiar el *tempo perceptual* en lugar de la física real. citeturn16search8turn16search17  
**Confianza:** Alta para variedad, Media para la cualidad “floaty”.  
**Medidas:** velocidad inicial horizontal/vertical, altura máxima, tiempo al apex, tiempo de vuelo, punto de caída, ángulo de descenso, spin y primer bote.  
**HYPOTHESIS:** controlar vertical impulse y spin de manera independiente del componente horizontal permite ajustar centros tensos, lofted passes altos y balones con backspin sin una colección rígida de trayectorias.

**Tiro.**  
**OBSERVED:** el dataset expone `Finishing`, `Kicking Power`, `Swerve`, pie débil y skills especiales; Ronaldo constituye un caso especialmente útil por Kicking Power 97 y Header 90, mientras Messi combina Finishing 94, Kicking Power 80 y Swerve 89. citeturn17search6turn17search7  
**OBSERVED:** reviews contemporáneos describieron variedad y fuerte diferenciación por jugador; una guía de ataque/defensa explica además el uso de la barra de potencia como input de tiro. citeturn16search9turn14search26  
**Confianza:** Alta en las dimensiones; Baja en fórmulas.  
**Experimento:** desde una posición fija, tiros del mismo jugador con aproximadamente 25/50/75/100 % de barra, orientación constante, después repetir con otro jugador de Kicking Power muy distinto.  
**Medidas:** velocidad inicial, apex, desviación respecto al aim, time-to-goal, spin y error angular.  
**HYPOTHESIS:** separar potencia física, precisión, altura/launch angle, spin y selección de animación. Un tiro más potente no debería obtener automáticamente menor precisión a menos que los datos de referencia lo demuestren.

**Headers.**  
**OBSERVED:** el roster distingue Header y Jump; Ronaldo, por ejemplo, figura con 90 y 97 respectivamente. citeturn17search7  
**OBSERVED:** análisis de la época destacaron la importancia de posicionarse bajo el balón, mientras TheSixthAxis consideró que los cabezazos eran demasiado fáciles de convertir y que los porteros tenían problemas con ellos. Esa valoración es subjetiva, pero constituye una característica del balance de lanzamiento que puede ser perceptualmente importante. citeturn16search17turn16search8  
**Confianza:** Alta en atributos; Media en balance de headers.  
**Medidas:** momento de salto, altura del jugador respecto al balón, ángulo corporal, velocidad del balón antes/después, error angular, contacto disputado y keeper reaction time.  
**HYPOTHESIS:** `Header` debería afectar ejecución/control del contacto; `Jump` la región alcanzable y timing físico. No reducir ambos a “probabilidad de gol”.

Para el agente de código, la interfaz de balón debería preservar explícitamente:

```text
ball.position
ball.velocity
ball.angularVelocity
ball.contactHistory
ball.airborne
ball.lastTouchEntity
ball.lastTouchSurface
```

y cada acción debería producir un **contact event** con objetivo físico, no transferir el balón directamente a una posición predeterminada.

## Tackles, intercepciones, porteros y resolución de duelos

**Standing tackle y presión defensiva.**  
**KNOWN/OBSERVED:** una guía contemporánea de PES 2017 documenta presión con el botón de presión y un tackle de pie más comprometido mediante doble pulsación, además de sliding tackles; también describe presión de compañero. citeturn14search26 Konami, por su parte, anunció mejoras en colisiones y evaluación arbitral. citeturn15search0  
**Confianza:** Alta en las acciones disponibles y en la importancia del timing; no hay documentación pública de hitboxes o ventanas exactas.  
**Medidas:** frame de inicio, tiempo a extensión máxima, alcance desde el centro del defensor, velocidad durante lunge, punto de contacto con balón, tiempo de recuperación y tasa de falta según ángulo.  
**HYPOTHESIS:** tackle como compromiso temporal: una fase de preparación, una ventana de contacto y una recuperación. El error debe tener costo espacial, evitando un collider omnidireccional permanentemente activo.

**Sliding tackle.**  
**OBSERVED:** la guía contemporánea enfatiza el timing y el riesgo de falta. citeturn14search26  
**Medidas:** distancia cubierta, duración total, duración de “active window”, altura de contacto, velocidad del balón tras deflexión, tiempo hasta volver a locomoción.  
**HYPOTHESIS:** separar collider corporal, collider/punto de contacto de la pierna y decisión arbitral. Un tackle puede tocar balón primero y aún producir contacto posterior; el motor de faltas no debería depender sólo de quién ganó posesión.

**Intercepciones.**  
**KNOWN:** Konami decía que Adaptive AI podía cortar patrones de pase y neutralizar determinados ataques. citeturn15search8turn15search15  
**OBSERVED:** las reviews fueron menos uniformes: The Guardian elogió la IA, mientras GameSpot y New Game Network observaron momentos donde defensores no recogían o interceptaban balones que parecían accesibles. citeturn16search4turn16search11 Esta imperfección es relevante: “parece PES 2017” no significa una IA de intercepción omnisciente.  
**Confianza:** Alta en que existe comportamiento proactivo; Media sobre sus límites.  
**Parámetros candidatos:** Defensive Prowess, Ball Winning, distancia lateral al carril, orientación, velocidad, fase de locomoción y rol táctico. Los atributos `Defensive Prowess` y `Ball Winning` aparecen diferenciados en las fichas de PES 2017. citeturn17search6turn17search7  
**Medidas:** tiempo desde que la trayectoria cruza una región alcanzable hasta primer movimiento defensivo, desplazamiento lateral máximo, distancia de reach, probabilidad de contacto por velocidad de pase.  
**HYPOTHESIS:** primero determinar una ventana geométrica de alcanzabilidad y luego aplicar awareness/commitment; no permitir que todo defensor “lea” instantáneamente el destino del pase.

**Portero: selección y reacción.**  
**KNOWN:** Konami describió una revisión extensa de los porteros con nuevas animaciones, reacciones inmediatas, capacidad de encadenar acciones después de caer, paradas con los pies, reacciones a quedar a contrapié y fingertip saves. citeturn15search0turn15search15  
**OBSERVED:** reviewers reportaron claims más autoritarios en balones altos, bloqueos con piernas y una mejora general, aunque todavía con fumbles. citeturn16search5turn16search17  
**Confianza:** Muy alta en la familia de comportamientos; desconocida en thresholds.

**Portero: atributos.**  
**OBSERVED:** las fichas de PES 2017 exponen dimensiones específicas `Goalkeeping`, `Catching`, `Clearing`, `Reflexes` y `Coverage`; los jugadores de campo tienen valores mínimos en ellas, lo que confirma su función como grupo específico de ratings. citeturn17search0turn17search6  
**Confianza:** Alta sobre existencia, no sobre mapping matemático.  
**Arquitectura recomendada:** evitar un único “GK rating”. Mantener por separado percepción/anticipación, tiempo de reacción, capacidad de alcanzar una región, seguridad de catch y calidad/dirección de parry.

**Portero: desvíos.**  
**KNOWN:** Konami especificó que el comportamiento de la pelota desviada depende de qué parte del cuerpo entra en contacto. citeturn15search0  
**Confianza:** Muy alta.  
**Medidas:** posición inicial del guardameta, frame del shot, frame del primer movimiento, frame de despegue, punto corporal de contacto, incoming/outgoing velocity, outgoing angle y recovery time.  
**HYPOTHESIS:** la parada debería finalizar en un contacto físico contextual —mano, antebrazo, pierna, torso— y usar ese punto normal/tangencial para determinar el rebote, con una capa de control adicional para representar skill del keeper.

**Catch frente a parry.**  
**OBSERVED:** los porteros son capaces de reclamar centros y también fumblear o desviar tiros. citeturn16search5turn16search17  
**HYPOTHESIS:** la elección debe depender de velocidad, spin, posición respecto al cuerpo, presencia de rivales y atributos de Catching/Clearing, pero no existe una fórmula pública de PES.  
**Test:** tiros idénticos dirigidos a torso, costados altos, abajo cerca del pie y extensión máxima; registrar catch/parry y segundo esfuerzo.

El principio global de duelos debería ser **resultado continuo antes que outcome prefijado**. Contacto, tackle, balón y balance pueden interactuar, y sólo después el motor decide si hay recuperación, rebote, caída o falta. Esa separación es la que permite las secuencias de “pinball” y balones divididos que reviewers asociaron con PES 2017. citeturn16search4

## Movimiento sin balón, forma defensiva, presión y táctica colectiva

La evidencia pública es particularmente fuerte en este apartado: *PES 2017* no sólo tenía formaciones estáticas, sino varias capas de **Team ID, instrucciones base, mentalidad durante el partido, Advanced Instructions y Adaptive AI**. citeturn15search0turn20search5 Un motor inspirado en esa sensación no debería programar los once jugadores como perseguidores independientes del balón.

**Movimiento ofensivo sin balón.**  
**KNOWN:** Player ID debía reproducir movimientos para buscar espacios; Team ID debía reproducir el estilo global de los equipos. citeturn15search5turn15search3  
**OBSERVED:** The Guardian destacó específicamente que los delanteros indicaban y ejecutaban desmarques, haciendo legibles las oportunidades de pase filtrado. citeturn16search4  
**Confianza:** Alta.  
**Medidas:** instante de inicio de carrera, ángulo de carrera respecto al defensor, distancia a línea defensiva, profundidad alcanzada, abort/continue behavior, momento de señal gestual y reacción a orientación del poseedor.  
**HYPOTHESIS:** cada jugador debería mantener un `role anchor` y evaluar periódicamente oportunidades que generan targets temporales: apoyo, ruptura, arrastre, ocupación de half-space, amplitud o profundidad.

**Individualidad sin balón.**  
**KNOWN:** Konami no limitó Player ID a apariencia; hablaba de movimientos, posturas, golpes y búsquedas de espacios individuales. citeturn15search5  
**OBSERVED:** los datasets incluyen Playing Style, skills y COM playing styles para determinadas fichas, por ejemplo Messi con Creative Playmaker y etiquetas de carrera ofensiva en PESDB. citeturn17search6  
**Confianza:** Muy alta en la intención de individualidad; Media en qué campo gobierna qué decisión.  
**COMMUNITY CLAIM:** editores experimentados han reportado diferencias sustanciales de posicionamiento entre playing styles y skills como Track Back/Man Marking, pero esto debe tratarse como evidencia comunitaria, no especificación. citeturn20search21  
**Implementación:** los atributos continuos deberían modificar capacidad; los estilos discretos deberían modificar **preferencia de decisión**. Por ejemplo, no incrementar simplemente “Attacking Prowess” para convertir un mediapunta en un corredor de ruptura.

**Forma defensiva.**  
**OBSERVED:** The Guardian notó que los centrales tendían a preservar su puesto en vez de perseguir atacantes irresponsablemente hacia arriba. citeturn16search4  
**KNOWN:** Team ID, Total Team Control e instrucciones tácticas ofrecen base documental de coordinación colectiva. citeturn15search0turn15search3  
**Confianza:** Alta.  
**Mediciones recomendadas:** centroide del equipo, ancho efectivo de línea defensiva, longitud entre delantero más alto y último defensor, separaciones defensa-mediocampo, varianza de posiciones respecto de anchors, altura de línea y distancia entre defensores adyacentes.  
**HYPOTHESIS:** formación nominal → anchors base → deformación en función de balón → restricciones de rol → estado de posesión/transición → instrucciones avanzadas. Evitar que la “formación” sea únicamente la pantalla prepartido.

**Parámetros tácticos visibles.**  
**KNOWN:** Konami documentó Tiki-taka, tight marking, Gegenpressing, Counter Target y la posibilidad de cambiar mentalidad ofensiva/defensiva durante el partido. citeturn20search5turn15search2  
**OBSERVED/COMMUNITY-PRESERVED:** hojas tácticas contemporáneas de PES 2017 registran dimensiones de interfaz como Possession/Counter, Short/Long Pass, Centre/Wide, Flexible/Maintain Formation, Support Range, Frontline Pressure, containment area, Aggressive/Conservative pressure, Defensive Line y Compactness. citeturn20search4 Al no tratarse de documentación oficial de Konami, la semántica matemática exacta de los sliders debe seguir considerándose desconocida.  
**Confianza:** Alta en que esas dimensiones estaban expuestas al jugador; Media respecto a sus curvas internas.

Una representación independiente adecuada sería:

```text
TeamTactics:
    baseFormation
    attackingStyle
    buildUpPreference
    attackingWidthBias
    positionalFreedom
    supportDistance
    defensiveBlockMode
    containmentBias
    pressingAggression
    defensiveLineTarget
    compactnessTarget
    attackDefenceMentality
    advancedInstructions[]
```

Esto es una **abstracción para el motor nuevo**, no una estructura interna afirmada de PES.

**Pressing.**  
**KNOWN:** Gegenpressing estaba incluido como Advanced Instruction, y Konami describió Adaptive AI capaz de doblar marcaje sobre jugadores peligrosos y contrarrestar ataques recurrentes. citeturn20search5turn15search15  
**OBSERVED:** las opiniones comunitarias sobre la cantidad exacta de presión varían; algunos jugadores describieron presión agresiva y agrupamiento defensivo excesivo. citeturn16search3  
**Confianza:** Alta en que el pressing es una estrategia diferenciada; Baja en claims de “demasiado” pressing.  
**Medidas:** número de defensores que aceleran hacia balón durante los primeros 0,5/1/2 s tras pérdida, distancia del primer presionante, cobertura de líneas de pase, altura del bloque, recuperación de shape si no se recupera el balón.  
**HYPOTHESIS:** pressing debe ser un **estado colectivo con presupuesto de roles**, no simplemente multiplicar velocidad de todos hacia el poseedor. Primer presionante cierra balón; segundo corta pase; línea posterior comprime espacio.

**Transición ataque → defensa.**  
**KNOWN:** Total Team Control permitía cambiar mentalidad instantáneamente; Gegenpressing añade un estado táctico explícito posterior a pérdida. citeturn15search2turn20search5  
**Test fundamental:** registrar 5 s antes y 10 s después de pérdida de posesión.  
**Medidas:** tiempo a primer press, tiempo a volver a bloque estable, desplazamiento del centroide, retroceso de laterales, número de jugadores por detrás del balón y crecimiento/reducción de compactness.  
**HYPOTHESIS:** modelar una ventana de transición distinta del estado defensivo asentado. Copiar solamente posiciones de una formación estática no reproducirá esta sensación.

**Adaptive AI.**  
**KNOWN:** Konami afirmó que la IA observaba patrones repetidos y podía responder con doble marcaje, defensa ante amplitud y alteraciones de estrategia. citeturn15search0turn15search15  
**UNKNOWN:** no hay base pública para afirmar que se tratara de aprendizaje automático, reinforcement learning o un modelo estadístico específico.  
**Confianza:** Muy alta en el comportamiento prometido, nula respecto a implementación interna.  
**HYPOTHESIS:** para el motor nuevo basta una capa interpretable de estadísticas móviles: frecuencia de ataque por banda, jugador de mayor uso, distribución de pases, zonas de entrada al último tercio. Si una señal supera un umbral durante varias posesiones, el AI manager puede modificar marcaje, compactness o orientación del bloque. Esta solución reproduce la propiedad observable sin fingir reconstruir la tecnología de Konami.

**Formación y estilo de equipo.**  
Konami utilizó asociaciones reales para promocionar que Team ID podía representar el estilo global de Barcelona, Dortmund y Liverpool, y específicamente comunicó que el Gegenpressing de Liverpool sería reproducido. citeturn15search3turn15search7 Esto sugiere una prioridad de diseño especialmente importante: **dos equipos con la misma formación nominal no deben resultar equivalentes**.

Para un coding agent, la jerarquía recomendada de decisión sin balón sería:

```text
match state
    → team tactical state
        → phase state (settled attack / transition / settled defence)
            → formation-relative role target
                → local tactical responsibility
                    → individual style preference
                        → reachability / locomotion constraints
                            → animation and movement
```

Una IA que invierte este orden —primero perseguir localmente y luego intentar reparar la formación— tenderá a producir el “enjambre” típico de simuladores menos estructurados.

## Atributos, controles, cámara, tempo y especificación de calibración

**Individualidad por atributos.**  
PES 2017 expone una matriz suficientemente rica como para extraer una lección de arquitectura clara: **no colapsar capacidad física y técnica en una sola valoración overall**. El roster de ejemplo distingue Attacking Prowess, Ball Control, Dribbling, Low Pass, Lofted Pass, Finishing, Place Kicking, Swerve, Header, Defensive Prowess, Ball Winning, Kicking Power, Speed, Explosive Power, Body Control, Physical Contact, Jump, Stamina, cinco atributos específicos de portero y propiedades de weak foot. citeturn17search6turn17search7 PES Master señala además que el dataset fue exportado del juego, aunque sus overalls pueden diferir. citeturn17search10  
**Clasificación:** **OBSERVED**, con confianza Alta. No tenemos documentación oficial para las fórmulas.

Los contrastes Messi/Ronaldo ilustran cómo diseñar pruebas de desacoplamiento: ambos tienen Speed 91 en las fuentes consultadas, pero Messi posee más Explosive Power y Body Control; Ronaldo, mucho más Kicking Power, Physical Contact y Jump. citeturn17search6turn17search7 Esto permite construir una batería donde ciertos atributos relevantes se mantienen similares y otros divergen, mucho más informativa que comparar un jugador 95 overall contra uno 60.

**Regla para el nuevo motor:** cada atributo debería corresponder a una o varias **capacidades latentes físicamente o decisionalmente interpretables**, y no a resultados guionizados. Ejemplo:


| Atributo conceptual    | Capacidad que vale la pena ensayar            | Lo que no debe asumirse        |
| ---------------------- | --------------------------------------------- | ------------------------------ |
| Speed                  | velocidad sostenible/asintótica               | `rating → m/s` lineal          |
| Explosive Power        | velocidad de entrada en régimen/reaceleración | una aceleración constante      |
| Body Control           | recuperación/orientación bajo perturbación    | “evasión de tackle” porcentual |
| Physical Contact       | capacidad en duelos                           | ganador automático             |
| Ball Control           | calidad/velocidad de control contextual       | imán balón-pie                 |
| Low/Lofted Pass        | error/ejecución del pase                      | una trayectoria fija           |
| Finishing              | calidad del intento de finalización           | bonus directo de gol           |
| Kicking Power          | capacidad de generar velocidad de balón       | velocidad exacta documentada   |
| Swerve                 | capacidad de generar/controlar curva          | coeficiente Magnus PES         |
| Defensive/Ball Winning | awareness/ejecución defensiva                 | interception auto-lock         |
| GK stats               | reacción, alcance, catch, parry               | un único “keeper strength”     |


La columna central es propuesta de diseño; no representa fórmulas internas de PES.

**Responsividad de controles.**  
**KNOWN:** Konami promocionó explícitamente controles intuitivos y respuesta inmediata. citeturn15search5turn15search10  
**OBSERVED:** GameSpot, Use A Potion y otros análisis coincidieron en una sensación rápida y responsiva, al mismo tiempo que destacaban momentum corporal. citeturn14search12turn16search5  
**Confianza:** Alta.  
**Métrica crítica para navegador:** registrar cuatro timestamps distintos: `input_received`, `intent_state_changed`, `kinematic_response_started`, `visible_animation_response_started`. La física puede tardar en completar un giro sin que el juego se sienta laggy si el primer indicio de respuesta ocurre pronto.  
**HYPOTHESIS:** la sensación objetivo se obtiene mejor con **baja latencia de intención + transición física limitada**, no reduciendo inertia hasta cero.

**Cámara.**  
No se encontró en las fuentes primarias consultadas una especificación suficientemente fiable de valores exactos de altura, zoom, FOV o smoothing de una cámara PES 2017 concreta. Por tanto:

**KNOWN:** insuficiente para un modelo numérico exacto.  
**COMMUNITY CLAIM:** una guía de WEPES de la época recomienda ajustar altura y zoom, y señala que una cámara más cerrada hace más visibles forcejeos y close control. citeturn14search20  
**Confianza:** Baja para parámetros exactos; Alta en que la cámara altera la percepción de velocidad y control.  
**Recomendación:** no calibrar locomoción mirando únicamente velocidad de píxeles en pantalla. Reconstruir posición sobre el campo. Después calibrar cámara como capa separada.  
**Medidas:** distancia de cámara al centro de acción, pitch/yaw, velocidad de seguimiento, lag de cámara respecto al balón, zoom/FOV aparente y cantidad de campo visible.

**Tempo general.**  
La evidencia no respalda describir PES 2017 simplemente como “lento” o “rápido”. Use A Potion consideró que el pace no había cambiado radicalmente pero que la rápida respuesta y primer toque hacían que pareciera más veloz; retrospectivas comunitarias lo llaman rápido y algo arcade; por otro lado, comunidades que buscaban mayor realismo preferían ocasionalmente game speed -1 o -2. citeturn14search24turn14search15turn14search27  
**Clasificación:** **OBSERVED** para la respuesta rápida; **COMMUNITY CLAIM** para las preferencias de velocidad.  
**Confianza:** Alta en que la sensación no puede reducirse a una escala temporal global.

La mejor definición operativa de “tempo PES 2017” para este proyecto es:

> **acciones que responden rápido, jugadores que todavía necesitan gestionar su peso, balón que puede escapar del control, y espacios colectivos que evolucionan suficientemente rápido para mantener flujo continuo.**

Esa frase es una síntesis/inferencia de la evidencia de responsividad, momentum, Real Touch e IA colectiva. citeturn15search0turn14search12turn16search4

Por tanto, deben medirse varios tempos independientes:

`input → response`, `touch → next action`, `pass flight time`, `ball roll time`, `turn duration`, `attack → defence transition`, `time between possessions`, `passes/min`, `shots/min`, `sprints/min`, `possession duration`, `time in transition`.

No usar un único slider `gameSpeed`.

**Fuentes de video prioritarias.** Para análisis frame-by-frame, la jerarquía debería ser:

La filmación de **Skills Training – Sprint (Gold)** es especialmente valiosa para aceleración porque la tarea tiene geometría repetible y poca congestión. citeturn19search2turn19search4 El video **Arsenal FC vs FC Barcelona – Gameplay PC HD [1080p60FPS]** anuncia captura a 60 fps y es mejor candidato para forma colectiva, pases, giros y tempo, aunque antes de medir debe verificarse que los frames sean únicos y que no exista modificación de gameplay. citeturn19search0 El **IGN Live E3 2016 Gameplay Showcase** incorpora gameplay y conversación con Adam Bhatti y tiene alto valor contextual, aunque el build es pre-lanzamiento. citeturn19search1 También existen partidos PS4 Barcelona–Arsenal útiles como contraste de plataforma. citeturn19search24

**Protocolo de medición sugerido para el coding agent.**

Cada referencia debería convertirse a un registro de este tipo:

```json
{
  "reference_id": "PES17-...",
  "source_build": "unknown|demo|retail|...",
  "platform": "PC|PS4|unknown",
  "capture_fps": 60,
  "verified_unique_frames": false,
  "camera": {
    "type": "unknown",
    "homography_available": false
  },
  "players": [],
  "event_start_frame": 0,
  "event_end_frame": 0,
  "ball_track": [],
  "player_tracks": [],
  "body_heading_samples": [],
  "input_known": false,
  "measurements": {},
  "confidence": "low|medium|high",
  "notes": []
}
```

Un dato extraído de video sin input visible debe almacenarse como **resultado observado**, no como respuesta exacta a un comando. Por ejemplo, observar un giro de Messi de 90° no demuestra que el stick se movió instantáneamente a 90°.

**Criterio de aceptación para el motor nuevo.** En vez de assertar un número exacto prematuramente:

```text
PASS if:
    target_metric lies inside measured PES reference distribution
    AND qualitative state sequence matches
    AND no compensating artifact is introduced
```

Ejemplo: una parada puede tener el mismo `t_stop` pero verse incorrecta porque la orientación rota 180° instantáneamente. Por eso cada test debe observar **cinemática + pose/orientation + balón**, no un solo escalar.

La arquitectura de calibración debería separar finalmente cinco capas:

```text
Input/intent
→ locomotion & body state
→ action/contact selection
→ independent ball physics
→ tactical/AI context
→ presentation/camera
```

El valor de esta separación es que permite ajustar “PES-like responsiveness” sin destruir inertia, ajustar fricción sin cambiar pases, o modificar pressing sin multiplicar artificialmente la velocidad de los defensores.

## REFERENCE TEST CATALOG

Los valores numéricos de aceptación quedan deliberadamente como **TBD hasta medición**. Introducirlos ahora sería exactamente el tipo de falsa precisión que debe evitarse.


| Test ID            | PES behavior being investigated            | Reference source/video                                                                                   | Initial situation                                      | Observable outcome                                                        | Things that can be measured                                  | Confidence                           | Unknowns                                                               |
| ------------------ | ------------------------------------------ | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------- | ------------------------------------------------------------ | ------------------------------------ | ---------------------------------------------------------------------- |
| **LOC-ACC-001**    | Aceleración desde parado                   | *PES 2017 Skills Training – Sprint (Gold)* citeturn19search2                                          | Jugador detenido, sprint recto                         | Progresión gradual pero rápida hacia velocidad alta                       | `x(t)`, `v(t)`, `a(t)`, t25/t50/t90, distancia a 0,5 y 1 s   | Alta para medición visual            | Input frame exacto; stats del jugador; captura realmente frame-perfect |
| **LOC-ACC-002**    | Diferencia Speed vs Explosive Power        | Gameplay con Messi/Ronaldo + stats PESDB citeturn17search6turn17search7turn19search0                | Dos jugadores con Speed 91 pero EP distinto            | Posible diferencia en fase inicial más que en régimen                     | aceleración inicial, tiempo a velocidad alta, top speed      | Media                                | Muchas variables restantes difieren                                    |
| **LOC-MAX-001**    | Velocidad máxima                           | Sprint training / carrera libre citeturn19search2                                                     | Carrera recta larga                                    | `v(t)` converge a meseta                                                  | velocidad máxima, tiempo a plateau                           | Media-Alta                           | escala espacial y stamina                                              |
| **LOC-DEC-001**    | Sprint → stop                              | Gameplay 60 fps Barcelona–Arsenal citeturn19search0                                                   | Jugador en sprint deja de avanzar                      | Frenado con desplazamiento residual                                       | stopping distance, `t_stop`, peak deceleration               | Media                                | No conocemos momento exacto de soltar stick                            |
| **LOC-REV-001**    | Cambio 180°                                | Gameplay 60 fps citeturn19search0                                                                     | Sprint y cambio hacia dirección opuesta                | Frenado, pivot, reaceleración                                             | `v_min`, turn time, orientation lag, recovery                | Media                                | Input no visible                                                       |
| **LOC-T45-001**    | Giro de 45°                                | Gameplay/entrenamiento; diseño de medición respaldado por estudio COD citeturn19search0turn18search2 | Carrera estable, cambio ~45°                           | Pérdida de velocidad relativamente moderada                               | speed retention, radius, angular velocity                    | Media                                | Ángulo real del stick                                                  |
| **LOC-T90-001**    | Giro de 90°                                | Mismas fuentes citeturn19search0turn18search2                                                        | Carrera estable, cambio ~90°                           | Mayor necesidad de reorientación/frenado                                  | loss ratio vs 45°, radius, reaceleration                     | Media                                | Control exacto desconocido                                             |
| **LOC-ORI-001**    | Movimiento vs orientación corporal         | Gameplay PS4/PC citeturn19search0turn19search24                                                      | Dribble lateral/diagonal                               | Torso y dirección de velocidad no necesariamente coinciden                | heading error, orientation rate, foot phase                  | Media                                | Pose estimation desde cámara broadcast                                 |
| **LOC-BALL-001**   | Penalización de locomoción con balón       | Gameplay 60 fps citeturn19search0                                                                     | Mismo jugador corriendo con y sin balón                | Toques periódicos y potencial diferencia de velocidad                     | top speed ratio, touch interval, ball separation             | Media                                | No hay ensayo controlado idéntico                                      |
| **PHY-SHLD-001**   | Shoulder-to-shoulder                       | Reviews + gameplay citeturn16search0turn14search24turn19search0                                     | Dos jugadores corren paralelos disputando balón        | Desplazamiento/pérdida de velocidad sin resultado instantáneo obligatorio | displacement, velocity loss, possession duration             | Media-Alta                           | Contact input y stats exactos                                          |
| **PHY-STR-001**    | Jugador fuerte vs ágil                     | Ronaldo/Messi stats y gameplay citeturn17search6turn17search7                                        | Contacto equivalente                                   | Diferenciación entre resistencia física y balance                         | recovery time, lateral displacement, retention               | Media                                | Falta pareja controlada con stats aislados                             |
| **PHY-BC-001**     | Body Control bajo perturbación             | Konami + roster citeturn15search0turn17search6                                                       | Receptor/dribbler recibe contacto lateral durante giro | Algunos jugadores mantienen o recuperan postura mejor                     | heading disturbance, stumble duration, velocity recovery     | Media-Alta                           | Mapping exacto de Body Control desconocido                             |
| **PHY-PC-001**     | Sensibilidad de Physical Contact           | Experimento comunitario Evo-Web citeturn20search0                                                     | Comparación normal vs roster alterado                  | Comunidad reporta juego más físico/agresivo                               | contacts/min, foul rate, displacement                        | Baja                                 | Mod no controlado; otras consecuencias indirectas                      |
| **BALL-IND-001**   | Independencia del balón                    | Konami Real Touch + Guardian citeturn15search0turn16search4                                          | Balón dividido/rebote en zona congestionada            | Balón continúa como objeto libre entre contactos                          | free-ball duration, touch sequence, velocity changes         | Alta                                 | Posibles ayudas invisibles de captura                                  |
| **BALL-GND-001**   | Decaimiento de pase raso                   | Gameplay 60 fps citeturn19search0                                                                     | Pase sin tocar a lo largo de zona calibrable           | Velocidad cae mientras rueda                                              | `x(t)`, `v(t)`, `dv/dt`, fit residual                        | Alta tras extracción                 | Potencia inicial/input                                                 |
| **BALL-GND-002**   | Dependencia de fricción con velocidad      | Múltiples pases de distinta potencia citeturn19search0                                                | Trayectorias equivalentes, v0 distinta                 | Comparar forma normalizada de `v(t)`                                      | deceleration vs v, stopping curve                            | Media                                | Superficie/partido no perfectamente idénticos                          |
| **BALL-BNC-001**   | Primer bote                                | Partido 60 fps                                                                                           | Balón aéreo cae sin jugador                            | Altura y velocidad cambian al impacto                                     | `h1/h2`, incoming/outgoing vertical v, horizontal loss       | Media                                | Spin difícil de estimar                                                |
| **BALL-SPN-001**   | Curva lateral                              | Compilaciones/partidos con tiros curvos; Swerve como atributo citeturn17search6turn19search28        | Tiro/pase con curva visible                            | Desviación lateral progresiva                                             | lateral displacement, curvature, flight time                 | Media                                | Input de curl y spin inicial                                           |
| **BALL-SPN-002**   | Curva vs potencia                          | Secuencias repetidas de free kick/tiro                                                                   | Mismo jugador a potencias distintas                    | Relación no necesariamente lineal entre velocidad y desviación            | v0, max deviation, curvature by flight segment               | Baja-Media                           | Difícil encontrar inputs idénticos                                     |
| **TOUCH-SLOW-001** | Primer toque de pase lento                 | Gameplay/Real Touch documentation citeturn15search0turn19search0                                     | Receptor libre, pase lento                             | Control corto y pronta disponibilidad                                     | post-touch distance, next-action latency                     | Alta conceptualmente                 | Input exacto                                                           |
| **TOUCH-FAST-001** | Primer toque de pase rápido                | Konami Real Touch citeturn15search8                                                                   | Igual receptor, pase rápido                            | Mayor desafío/variedad de control esperable                               | separation, post-contact speed, control time                 | Alta                                 | Falta ensayo idéntico publicado                                        |
| **TOUCH-BACK-001** | Recepción de espaldas                      | Konami: orientación/forma de recibir citeturn15search0                                                | Receptor a ~180° de salida deseada                     | Control/giro contextual                                                   | turn time, touches before exit, orientation path             | Alta para factor orientación         | Magnitud exacta del costo                                              |
| **TOUCH-90-001**   | Recepción perfilada 90°                    | Misma fuente                                                                                             | Receptor lateral al pase                               | Animación/control distinto de frontal/espaldas                            | contact point, exit angle, latency                           | Alta                                 | Ayuda automática desconocida                                           |
| **TOUCH-WF-001**   | Primer toque con pierna débil              | Stats Weak Foot PESDB citeturn17search6turn17search7                                                 | Pase simétrico forzando lado débil                     | Posible cambio de pie/calidad                                             | foot selected, ball error, control latency                   | Baja-Media                           | No confirmado que Weak Foot gobierne first touch                       |
| **PASS-LOW-001**   | Pase raso básico                           | Precise Pass official citeturn15search0                                                               | Receptor estático, pasador bien orientado              | Trayectoria limpia y peso controlado                                      | v0, arrival speed, lateral error, execution time             | Muy alta para factores               | Assistance level                                                       |
| **PASS-ANG-001**   | Pase desde mala orientación                | Precise Pass official citeturn15search0                                                               | Pasador girado 90–180° al target                       | Diferente preparación/animación/resultado                                 | preparation frames, accuracy, foot choice                    | Muy alta                             | Curva exacta de penalización                                           |
| **PASS-RUN-001**   | Pase a carrera                             | Konami dice que Precise Pass considera movimiento del compañero citeturn15search8                     | Receptor corre al espacio                              | Balón dirigido hacia trayectoria futura                                   | lead distance, interception point, arrival timing            | Muy alta                             | Nivel de asistencia                                                    |
| **PASS-THR-001**   | Through pass corto                         | GameSpot observó casos subpotenciados citeturn16search2                                               | Triángulo corto en mediocampo                          | Algunos pases filtrados cortos pierden fluidez                            | initial speed, receiver wait, interception risk              | Media                                | Review subjetivo/muestra no cuantificada                               |
| **PASS-LOFT-001**  | Pase elevado                               | Precise Pass + gameplay citeturn15search0turn19search0                                               | Pasador libre, receptor distante                       | Arco 3D con trayectoria contextual                                        | apex, flight time, range, landing velocity                   | Alta                                 | Power bar desconocida                                                  |
| **CROSS-HI-001**   | Centro alto                                | Guía contemporánea citeturn16search8                                                                  | Extremo en banda, delantero alto                       | Balón busca zona aérea                                                    | apex, time-to-box, descent angle                             | Media-Alta                           | Assistance/input variant                                               |
| **SHOT-PWR-001**   | Shot power ladder                          | Guía de controles + Kicking Power stats citeturn14search26turn17search7                              | Punto de tiro fijo                                     | Mayor input de potencia cambia trayectoria/velocidad                      | v0, flight time, height, error                               | Alta                                 | Exacto significado de barra                                            |
| **SHOT-IND-001**   | Kicking Power bajo vs alto                 | Messi vs Ronaldo stats citeturn17search6turn17search7                                                | Tiros equivalentes                                     | Diferencia individual observable                                          | v0 distribution, shot preparation                            | Media                                | Otros stats/skills confunden                                           |
| **SHOT-SWV-001**   | Swerve individual                          | Messi/Ronaldo stats                                                                                      | Tiros colocados/curvos equivalentes                    | Diferencia potencial en curva controlable                                 | lateral deviation, spin proxy                                | Media-Baja                           | Inputs no idénticos                                                    |
| **HEAD-FREE-001**  | Header libre                               | Header/Jump attrs + contemporary guide citeturn17search7turn16search8                                | Centro y delantero sin oposición                       | Timing y posición bajo balón determinan contacto                          | jump start, contact height, outgoing speed                   | Alta en dimensiones                  | Input timing                                                           |
| **HEAD-DUEL-001**  | Header disputado                           | Gameplay                                                                                                 | Atacante/defensor comparten región de caída            | Jump, posición y físico interactúan                                       | contact winner, heights, body displacement                   | Media                                | Selección automática del contact                                       |
| **TACK-ST-001**    | Standing tackle                            | Gamereactor guide citeturn14search26                                                                  | Defensor frontal a distancia fija                      | Lunge/contact/recovery                                                    | reach, active window, recovery frames                        | Alta para acción                     | Hitboxes internas                                                      |
| **TACK-SL-001**    | Sliding tackle                             | Gamereactor guide citeturn14search26                                                                  | Atacante cruza perpendicularmente                      | Slide cubre espacio pero compromete al defensor                           | slide distance/time, contact frame, recovery                 | Alta                                 | Criterio arbitral                                                      |
| **TACK-ANG-001**   | Tackle success vs approach angle           | Gameplay repetido                                                                                        | Ataques 0/30/60/90°                                    | Resultado cambia con acceso al balón y cuerpo                             | contact order, ball velocity, foul frequency                 | Media                                | Necesita dataset grande                                                |
| **INT-PASS-001**   | Intercepción lateral                       | Gameplay + Adaptive AI docs citeturn15search15turn19search0                                          | Defensor cerca de línea de pase                        | Paso/reach hacia el balón si resulta alcanzable                           | reaction frames, lateral reach, contact probability          | Alta en fenómeno                     | Awareness rule                                                         |
| **INT-FAST-001**   | Intercepción vs velocidad del pase         | GameSpot/New Game Network muestran imperfecciones citeturn16search2turn16search11                    | Igual geometría, velocidades distintas                 | Pases rápidos reducen ventana de reacción                                 | reaction time, interception rate                             | Media                                | Ausencia de test controlado PES                                        |
| **GK-REA-001**     | Reaction time                              | Konami goalkeeper overhaul citeturn15search0                                                          | Keeper set, shot repentino                             | Inicio visible de respuesta tras lanzamiento                              | shot frame → first GK motion                                 | Muy alta para característica         | Prediction may precede ball contact                                    |
| **GK-WF-001**      | Wrong-foot reaction                        | Konami lo menciona explícitamente citeturn15search0                                                   | Keeper desplazándose a un lado, tiro contrario         | Corrección/estirada desde apoyo desfavorable                              | reversal latency, reach, save probability                    | Muy alta                             | Cómo crear situación controlada                                        |
| **GK-LEG-001**     | Parada con pie                             | Konami + reviews citeturn15search0turn16search17                                                     | Tiro bajo cercano                                      | Extensión de pierna y rebote                                              | contact point, parry angle, recovery                         | Alta                                 | Animación exacta seleccionada                                          |
| **GK-PARRY-001**   | Dirección de rebote por parte corporal     | Konami citeturn15search0                                                                              | Tiros similares a mano/pierna/torso                    | Deflection difiere según superficie corporal                              | incoming/outgoing vector, energy ratio                       | Muy alta conceptualmente             | Ajustes no físicos adicionales                                         |
| **GK-REC-001**     | Segunda parada tras caída                  | Konami citeturn15search0                                                                              | Primer save deja rebound                               | Keeper vuelve a intervenir rápidamente                                    | landing → recovery → second action time                      | Muy alta                             | Estado de stamina/pose                                                 |
| **GK-HIGH-001**    | Claim de centro alto                       | Reviews contemporáneos                                                                                   | Centro dentro del área                                 | Keeper puede dominar aire/capturar                                        | takeoff timing, reach, catch/parry                           | Alta                                 | Decision threshold                                                     |
| **OFF-RUN-001**    | Desmarque de ruptura                       | Guardian + Player ID citeturn16search4turn15search5                                                  | Poseedor en mediocampo y delantero ante línea          | Delantero inicia carrera legible                                          | trigger time, run angle, line crossing                       | Alta                                 | Trigger input vs autonomous                                            |
| **OFF-SUP-001**    | Movimiento de apoyo                        | Team ID / gameplay                                                                                       | Circulación de balón en mediocampo                     | Jugadores crean nuevas líneas de pase                                     | support distance, angle, relocation rate                     | Alta conceptualmente                 | Individual style influence                                             |
| **DEF-SHAPE-001**  | Centrales conservan forma                  | Guardian citeturn16search4                                                                            | Atacante se acerca al área                             | CBs no persiguen arbitrariamente hacia delante                            | line depth, CB spacing, chase distance                       | Alta                                 | Táctica exacta del equipo                                              |
| **DEF-SHIFT-001**  | Desplazamiento lateral del bloque          | Gameplay 60 fps citeturn19search0                                                                     | Balón cambia de una banda a otra                       | Bloque se deforma/recentra                                                | team centroid, width, lag to ball shift                      | Media-Alta                           | Formation/tactic settings                                              |
| **PRESS-001**      | Frontline pressure                         | PES17 tactical configuration evidence citeturn20search4                                               | Rival inicia posesión atrás                            | Jugadores delanteros saltan a presión                                     | pressers count, distance closed/sec                          | Alta en opción; Media en mapping     |                                                                        |
| **PRESS-GG-001**   | Gegenpress tras pérdida                    | Konami Advanced Instructions citeturn20search5turn15search3                                          | Equipo pierde balón en campo rival                     | Presión inmediata coordinada                                              | first-response time, pressers, block compression             | Muy alta para existencia             | Duration/trigger rules                                                 |
| **PRESS-REC-001**  | Abandono del gegenpress                    | Mismo contexto                                                                                           | Rival supera primera ola                               | Equipo vuelve a estructura                                                | transition duration, retreat speeds, shape error             | Media                                | No documentado por Konami                                              |
| **TACT-COMP-001**  | Compactness                                | PES 2017 tactical sheets citeturn20search4                                                            | Dos equipos/configs con compactness distinta           | Distancias colectivas cambian                                             | width, line gaps, convex-hull area                           | Media-Alta                           | Semántica exacta del slider                                            |
| **TACT-DLINE-001** | Defensive Line                             | Tactical sheets citeturn20search4                                                                     | Defensa asentada                                       | Altura media de última línea cambia                                       | meters from goal, line variance                              | Media-Alta                           | Interaction with mentality                                             |
| **TACT-SUP-001**   | Support Range                              | Tactical sheets citeturn20search4                                                                     | Equipo en posesión                                     | Distancia de apoyos alrededor del balón cambia                            | neighbor distances, passing graph                            | Media-Alta                           | Mapping no lineal posible                                              |
| **TACT-TIKI-001**  | Tiki-taka Advanced Instruction             | Konami citeturn20search5                                                                              | Posesión asentada                                      | Más apoyo/circulación corta esperable                                     | pass length distribution, support density, movement          | Alta para existencia                 | Mecanismo exacto                                                       |
| **TACT-MARK-001**  | Tight Marking                              | Konami + Operation Sports citeturn20search5turn20search2                                             | Marcar atacante concreto                               | Defensor mantiene proximidad/track más estrecho                           | separation distribution, switch events                       | Alta                                 | Assignment logic                                                       |
| **AI-ADAPT-001**   | Adaptación a jugador estrella              | Konami Adaptive AI citeturn15search15                                                                 | Usuario canaliza repetidamente juego por estrella      | Oponente puede doblar marcaje                                             | defenders near target over possession sequence               | Muy alta en comportamiento anunciado | Número de repeticiones/threshold                                       |
| **AI-ADAPT-002**   | Adaptación a ataque por banda              | Konami Adaptive AI citeturn15search15                                                                 | Varias posesiones consecutivas por mismo costado       | Defensa refuerza/cubre canal                                              | defensive density by zone, line shift                        | Muy alta para conducta anunciada     | Algoritmo y memoria                                                    |
| **TRANS-AD-001**   | Ataque → defensa                           | Total Team Control/Gegenpress citeturn15search2turn20search5                                         | Pérdida súbita de posesión                             | Cambio de targets y roles                                                 | seconds to first press, block rebuild time                   | Alta                                 | Tactical settings                                                      |
| **TRANS-DA-001**   | Defensa → ataque                           | Gameplay/Team ID                                                                                         | Recuperación en campo propio                           | Diferentes roles avanzan o apoyan                                         | first forward run, centroid velocity, width growth           | Media-Alta                           | Counter vs possession settings                                         |
| **CTRL-LAT-001**   | Responsividad de movimiento                | Konami + GameSpot citeturn15search5turn14search12                                                    | Cambio brusco de intención                             | Señal visual rápida aunque cuerpo conserve inertia                        | visible response frames, velocity response, heading response | Alta                                 | Input timestamp no disponible en video                                 |
| **CTRL-ACT-001**   | Responsividad pass/shoot                   | Konami/GameSpot citeturn15search10turn14search12                                                     | Input durante control estable                          | Inicio rápido de preparación/acción                                       | command-to-animation/contact frames                          | Alta conceptualmente                 | Sin input overlay                                                      |
| **CAM-FLW-001**    | Seguimiento de cámara                      | Raw gameplay citeturn19search0turn19search24                                                         | Cambio rápido de posesión/lado                         | Cámara sigue acción con cierto smoothing                                  | camera-center lag, screen velocity, zoom                     | Media                                | Preset exacto                                                          |
| **CAM-PER-001**    | Efecto de cámara sobre velocidad percibida | Gameplay + community camera guide citeturn14search20                                                  | Misma carrera bajo distintas cámaras si disponible     | Pixel speed cambia sin cambiar pitch speed                                | pixel velocity vs world velocity                             | Media                                | Conseguir capturas equivalentes                                        |
| **TEMPO-001**      | Tempo de posesión                          | Partido completo 60 fps citeturn19search0                                                             | Partido normal                                         | Secuencia típica de acciones/pausas                                       | passes/min, touches/min, possession lengths                  | Alta si video íntegro                | Match settings                                                         |
| **TEMPO-002**      | Tempo de transición                        | Partido completo                                                                                         | Recuperaciones y pérdidas múltiples                    | Transiciones relativamente rápidas sin eliminar inertia                   | transition duration distribution                             | Alta si muestra grande               | Team tactics                                                           |
| **TEMPO-003**      | “Rápido pero con peso”                     | Konami + reviews citeturn15search5turn14search12turn14search24                                      | Conjunto de giros, controles y pases                   | Baja latencia perceptual coexistiendo con frenado/giro corporal           | input-proxy latency, turn duration, touch latency            | Alta como objetivo perceptual        | Input real sólo disponible con captura propia de PES                   |


## Fuentes

Lista reconstruida a partir de las citas del documento (los marcadores `citeturnNsearchM` que aparecen inline en el cuerpo del texto son artefactos de exportación sin resolver; esta lista recupera los títulos y URLs reales a los que apuntaban, pero no reasigna un número de cita a cada marcador individual del cuerpo).

1. KONAMI — "Stunning PES 2017 Takes to the Field for E3 2016" — https://www.konami.com/games/eu/en/topics/13633/
2. PES Master — "PES 2017 Database" — https://www.pesmaster.com/pes-2017/
3. Nedergaard et al. — "Metabolic Power Requirement of Change of Direction Speed in Youth Soccer Players" (PLOS ONE) — https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0149839
4. "Motion Fields for Interactive Character Locomotion" (ACM Digital Library) — https://dl.acm.org/doi/10.1145/1882261.1866160
5. IFAB — "Laws of the Game, Law 1: The Field of Play" — https://www.theifab.com/laws/latest/the-field-of-play/
6. KONAMI (IT) — "PES 2017 offre livelli di realismo senza precedenti" — https://www.konami.com/games/eu/it/topics/13892/
7. GameSpot — "Pro Evolution Soccer 2017 Review" — https://www.gamespot.com/reviews/pro-evolution-soccer-2017-review/1900-6416523/
8. PESDB — "L. Messi (PES 2017)" — https://pesdb.net/pes2017/?id=7511
9. Use A Potion — "PES 2017 | Review" — https://www.useapotion.com/2016/09/pes-2017-review/
10. KONAMI (ES) — "PES 2017 di KONAMI è protagonista all'E3" — https://www.konami.com/games/eu/es/topics/13658/
11. GamesRadar+ — "PES 2017 Review: The game lapsed PS2-era fans have been waiting for" — https://www.gamesradar.com/pes-2017-review/
12. Evo-Web (foro) — "Lack of fouls (in PES and FIFA). I found one solution for PES2017" — https://evoweb.uk/threads/lack-of-fouls-in-pes-and-fifa-i-found-one-solution-for-pes2017.78353/
13. The Guardian — "Pro Evolution Soccer 2017 review: the plucky underdog that plays a mean game" — https://www.theguardian.com/technology/2016/sep/19/pro-evolution-soccer-2017-review-konami-football-fifa
14. "Measurements of the Flight Trajectory of a Spinning Soccer Ball" (MDPI Proceedings) — https://www.mdpi.com/2504-3900/49/1/88
15. Gamereactor — "How to Attack & Defend in PES 2017" — https://www.gamereactor.eu/how-to-attack-defend-in-pes-2017/
16. Gaming Respawn — "PES 2017 Review" — https://gamingrespawn.com/pes-2017-review/
17. PESDB — "C. Ronaldo (PES 2017)" — https://pesdb.net/pes2017/?id=4522
18. TheSixthAxis — "Pro Evolution Soccer 2017 Review" — https://www.thesixthaxis.com/2016/09/19/pro-evolution-soccer-2017-review/
19. PES Master — "Max Power PES 2017 Stats" — https://www.pesmaster.com/m-power/pes-2017/player/112493/
20. Operation Sports (foro) — "PES 2017 Global and Gameplay Edits" — https://forums.operationsports.com/forums/forum/soccer/efootball-pro-evolution-soccer/831742-pes-2017-global-and-gameplay-edits
21. Scribd — "PES 2017 Tactics and Formations Guide" (PDF) — https://www.scribd.com/document/346996833/Epl-Tactics-1
22. Reddit r/WEPES — "PES 17 – two steps forward, two back" — https://www.reddit.com/r/WEPES/comments/5pgkas/pes_17_two_steps_forward_two_back/
23. KONAMI — "KONAMI to Premiere PES 2017 Alongside the 2016..." — https://www.konami.com/games/eu/en/topics/13606/
24. KONAMI — "KONAMI and Liverpool F.C. Announce Exclusive Partnership" — https://www.konami.com/games/eu/en/topics/13789/
25. Reddit r/WEPES — "PES 2017 Guide (updated)" — https://www.reddit.com/r/WEPES/comments/538ct7/pes_2017_guide_updated/
26. YouTube — "PES 2017 Skills Training – Sprint (Gold)" — https://www.youtube.com/watch?v=C4-W1u8w-yE
27. YouTube — "PES 2017 – Arsenal FC vs FC Barcelona | Gameplay (PC HD, 60FPS)" — https://www.youtube.com/watch?v=8afTHuMZxbI
28. YouTube — "Pro Evolution Soccer 17 Gameplay Showcase – E3 2016" — https://www.youtube.com/watch?v=jruvhcNl1YY
29. YouTube — "PES 2017 Gameplay – FC Barcelona vs. FC Arsenal | PS4 (HD)" — https://www.youtube.com/watch?v=7daF_qg6B8s
30. KONAMI (FR) — "KONAMI dévoile l'impressionnant PES 2017 lors de son..." — https://www.konami.com/games/eu/en/topics/13656/
31. KONAMI (IT) — "PES 2017 Disponibile: Realismo, controllo e gameplay..." — https://www.konami.com/games/eu/en/topics/13893/
