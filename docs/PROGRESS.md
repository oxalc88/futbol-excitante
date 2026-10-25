# Registro de avances

Una entrada por cada PR de capacidad fusionado en `main`. Las horas están en hora de Lima (UTC-5). Las entradas más recientes van primero.

## 2026-10-25 08:10 — PR pendiente ([#76](https://github.com/oxalc88/futbol-excitante/pull/76)) · Reglas de modelos y CI rápido para PR de solo documentación
- **Qué cambia para el jugador:** nada en el juego. Cambian las reglas de trabajo: `AGENTS.md` fija qué modelo implementa y cuál revisa hasta el 30 de octubre y desde el 31 de octubre (Luna implementa tareas acotadas, Sol implementa tareas complejas, Sol siempre revisa, Luna nunca revisa). El CI detecta si una PR solo cambia documentación (`*.md`, `docs/`, `LICENSE`, `.agents/**/*.md`); en ese caso el check `build` termina en verde en segundos sin ejecutar `scripts/verify.sh`.
- **Qué probar:** abre una PR que solo cambie un `.md` y comprueba que `build` pasa en menos de 2 minutos. Abre una PR con código y comprueba que `build` ejecuta todo `scripts/verify.sh`. Un push a `main` siempre ejecuta todo.
- **Qué se rompe o cambia:** las PR de solo documentación ya no suben artefactos de evidencia. Mover un archivo de código a `docs/` cuenta como cambio de código. La simulación y `eval/baseline.json` no cambian.

## 2026-10-25 04:40 — PR pendiente ([#75](https://github.com/oxalc88/futbol-excitante/pull/75)) · Arranque y media vuelta al ritmo de PES 2017 (C7 parte 3)
- **Qué cambia para el jugador:** los jugadores arrancan más rápido. Desde parado llegan a su velocidad máxima en 383 ms (antes 600 ms; objetivo PES 384 ms, rango 300–434). La media vuelta de 180° en carrera tarda 500 ms, igual que antes (objetivo 500 ms, rango 434–534). Afecta a todos: humanos, CPU y arqueros. Con jugadores más rápidos hay más entradas y más faltas en los partidos de prueba.
- **Qué probar:** arranca desde parado con R1 y siente si la salida es más viva. Corre y gira 180° con el stick: el giro debe sentirse igual. Juega un partido completo contra la CPU y mira si las faltas y tarjetas son razonables. `npm run timing:c7` muestra los dos tiempos frente al objetivo.
- **Qué se rompe o cambia:** el motor pasa a `engine-v4`: las repeticiones guardadas con `engine-v3` ya no se reproducen. Se regenera `eval/baseline.json` (180 de 276 huellas cambian). En los 3 partidos de evaluación: goles 3 → 2, entradas 33 → 69, faltas 35 → 61, amarillas 18 → 25, rojas 3 → 6. El saque CPU sigue en 60 ticks.

## 2026-10-25 03:16 — PR pendiente ([#74](https://github.com/oxalc88/futbol-excitante/pull/74)) · Selector de dificultad de la CPU (Fácil, Normal, Difícil)
- **Qué cambia para el jugador:** el menú de inicio muestra «Dificultad de la CPU» con Fácil, Normal y Difícil, visible para «Jugar rápido» y para el partido personalizado. La elección se guarda en `fe.cpuDifficulty` y se recupera en la siguiente visita; un valor ausente o inválido vuelve a Normal. Normal es exactamente el CPU de antes. Fácil hace que la CPU tarde el doble en decidir, falle más pases y tire y presione menos; Difícil decide dos veces más rápido, falla menos y presiona más. Solo cambian parámetros de CPU que ya existían; los equipos humanos no cambian.
- **Qué probar:** elige Fácil, pulsa «Jugar rápido» y comprueba que la CPU tarda más en reaccionar y que los tiros y pases fallan más; recarga la página y comprueba que la elección sigue guardada. Escribe un texto cualquiera en `fe.cpuDifficulty` y comprueba que el menú vuelve a Normal. `npm test` cubre los tres niveles, el saque CPU de 60 ticks, el guardado con almacenamiento bloqueado y dos partidos sembrados con resultados distintos; en línea manda Normal. Ejecuta `npm test` y `npm run evaluate`.
- **Qué se rompe o cambia:** la configuración de Normal no cambia (`eval/baseline.json` no se regenera y `npm run evaluate` coincide con el baseline); el saque CPU sigue en 60 ticks en los tres niveles y las repeticiones de Normal se verifican igual. La dificultad solo se aplica a partidas nuevas: cambiarla en el menú no altera un partido en curso. En línea, el anfitrión inicia siempre en Normal y el invitado recibe esa misma configuración.

## 2026-10-25 03:08 — PR pendiente ([#73](https://github.com/oxalc88/futbol-excitante/pull/73)) · Mando PS4 al estilo PES 2017 por defecto
- **Qué cambia para el jugador:** el mando usa los botones de PES 2017 en PS4. Con balón: ✕ pase raso, ○ pase alto o centro, L1 + ○ pase elevado, △ pase en profundidad, □ tiro (mantener y soltar), R1 correr, L1 cambiar jugador. Sin balón: ✕ ✕ (doble toque) entrada, ○ barrida, □ despeje. El cabezazo sale con □ o con un pase cuando el balón llega a la altura de la cabeza. Proteger el balón es automático en el contacto. El clic del touchpad cambia la cámara. OPTIONS pausa y R3 controla al arquero. El teclado sigue la misma lógica y la ayuda muestra los símbolos de PlayStation.
- **Qué probar:** con un mando PS4 o PS5, juega un partido: pasa con ✕, centra con ○, tira con □ y corre con R1. Sin balón, haz doble toque en ✕ para la entrada y mantén ✕ (no debe pasar nada). Prueba un cabezazo en un centro, el arquero con R3 (un solo toque para lanzarse) y el touchpad. Repite con teclado.
- **Qué se rompe o cambia:** cambian los botones por defecto: ○ ya no tira (ahora □), □ ya no centra, R1 ya no es entrada sino correr, L2 ya no corre, R2 ya no cabecea, L3 ya no protege. En el teclado desaparecen las teclas propias de cabezazo, elevado y proteger. Mantener ✕ (presión) aún no hace nada: llega en la fase 2. La simulación y `eval/baseline.json` no cambian. El saque CPU sigue en 60 ticks.

## 2026-10-25 02:34 — PR pendiente ([#72](https://github.com/oxalc88/futbol-excitante/pull/72)) · Jugar rápido, menú inicial y consejos del primer partido · referencia [#45](https://github.com/oxalc88/futbol-excitante/issues/45)
- **Qué cambia para el jugador:** el menú de inicio abre con un botón grande «Jugar rápido»: un clic, Enter o el botón ✕/A de un mando arranca «Tú contra la CPU» de 6 minutos, 11 contra 11 y semilla 2017, sin tocar el formulario. El partido personalizado sigue igual debajo, y en las acciones secundarias aparecen «Controles» y «Ver consejos». En el primer partido se muestran cuatro consejos de controles (teclado, mando, táctil y pausa); el partido queda en pausa mientras están abiertos y no vuelven a aparecer (la marca se guarda en `fe.tipsSeen`). Se cierran con «Entendido», Esc o un botón del mando, y «Ver consejos» los vuelve a mostrar.
- **Qué probar:** en una ventana nueva, pulsa «Jugar rápido» y comprueba que empieza «TÚ CONTRA LA CPU», que los consejos aparecen solo la primera vez y que el reloj corre al cerrarlos. Recarga, vuelve a pulsar «Jugar rápido» y comprueba que los consejos no aparecen. Con un mando conectado y el menú abierto sin partido en marcha, pulsa ✕/A. Ejecuta `npm run typecheck`, `npm test` y `scripts/verify.sh`.
- **Qué se rompe o cambia:** el menú cambia de arriba: «Jugar rápido» queda encima y el texto de introducción pasa a «Partido personalizado · elige tus equipos»; el formulario se desplaza dentro del diálogo. Las pruebas de navegador que inician partido marcan `fe.tipsSeen=1` antes de navegar para no recibir los consejos. La simulación, el baseline y la evaluación no cambian.

## 2026-10-25 01:22 — PR pendiente ([#71](https://github.com/oxalc88/futbol-excitante/pull/71)) · Sonido de partido
- **Qué cambia para el jugador:** se oyen golpes de balón, silbatos de saque inicial, descanso y final, red y festejo de gol, y público de fondo. M o el botón Sonido silencia el partido. El control Volumen ajusta el nivel. El volumen y el silencio se guardan en este navegador. El sonido empieza tras pulsar una tecla, tocar la pantalla o pulsar un botón del mando.
- **Qué probar:** inicia un partido, pasa, tira y marca un gol. Escucha los silbatos y el público. Ajusta Volumen, pulsa M y recarga para comprobar los ajustes guardados. Ejecuta `npm run typecheck` y `npm test`; `tests/audio.test.ts` comprueba sonidos, volumen, silencio y activación por gesto.
- **Qué se rompe o cambia:** cambia el sonido del navegador. La simulación y `eval/baseline.json` no cambian. Si el navegador bloquea el audio o el almacenamiento, el partido sigue. Límite conocido: en línea, el visitante recibe una foto cada 6 ticks, así que puede no oír algunos golpes de balón y algunos silbatos de saque; los goles sí suenan. El saque CPU sigue en 60 ticks.

## 2026-10-25 01:11 — PR pendiente ([#70](https://github.com/oxalc88/futbol-excitante/pull/70)) · Versión web lista para publicar (sin publicar)
- **Qué cambia para el jugador:** nada dentro del partido. `npm run build` deja en `dist/` sólo el juego, listo para subir a cualquier alojamiento estático con rutas relativas. El laboratorio ya no va en esa versión pública; sigue en `npm run dev` y en `npm run build:lab`.
- **Qué probar:** `npm run build`, `npm run check:dist` y `npm run preview`; abre el enlace, elige equipos y juega un partido. Si copias un JPG o un video a `dist/`, el control debe fallar.
- **Qué se rompe o cambia:** no se publica nada ni se configura alojamiento; Rolando decide dónde. El control rechaza el laboratorio, medios (incluidos los de PES), datos, mapas de código, rutas absolutas y archivos de más de 2 MiB (5 MiB en total).

## 2026-10-25 01:09 — PR pendiente ([#69](https://github.com/oxalc88/futbol-excitante/pull/69)) · Mando simulado en prueba de navegador · referencia [#44](https://github.com/oxalc88/futbol-excitante/issues/44)
- **Qué cambia para el jugador:** nada en el partido. Una prueba de navegador comprueba pausa con Start, tiro cargado único, desconexión durante la carga, reconexión con tiro pulsado, dos mandos con puestos estables y un toque en Tiro. Guarda resultados en `artifacts/local/smoke/pad.json`.
- **Qué probar:** ejecuta `scripts/verify.sh`; revisa `pad-smoke`. Completa `docs/manual-device-test.md` con mandos Xbox y PlayStation y un iPhone con Safari. Quedan pendientes la latencia, la zona muerta real, los botones físicos, la comodidad y el cambio de aplicación en iOS.
- **Qué se rompe o cambia:** nada en la simulación. Se agrega una vista de diagnóstico de solo lectura en el navegador. La prueba táctil emulada cubre un toque, no gestos simultáneos ni Safari real.

## 2026-10-25 01:05 — PR pendiente ([#68](https://github.com/oxalc88/futbol-excitante/pull/68)) · Control manual del arquero · referencia [#53](https://github.com/oxalc88/futbol-excitante/issues/53)
- **Qué cambia para el jugador:** puedes tomar el control de tu arquero. Pulsa R (jugador 1), 8 del teclado numérico (jugador 2), R3 en el mando o el botón táctil «Arquero». Con el arquero: muévete con la dirección (no sale de su arco), corre hacia el balón con sprint para salir a cortar, y lánzate con U / 0 numérico / RB hacia la dirección que marcas. Si atrapas el balón, pasa o lanza con la mano con J / A y despeja con el pie con K / B. Pulsa otra vez el botón del arquero o «Cambiar» (Q / Enter / LB) para volver al jugador de campo más cercano al balón. Con control manual, el arquero solo ataja si te lanzas: si no reaccionas, el gol es tuyo.
- **Qué probar:** en un partido, toma el arquero antes de un tiro rival, lánzate al lado del tiro y comprueba que ataja y que luego puedes pasar o despejar. Sal a cortar con sprint. Vuelve al campo con «Cambiar». Prueba con dos jugadores a la vez y con pausa. Ejecuta `npm test` (pruebas tick a tick con entradas guionadas) y `scripts/verify.sh`.
- **Qué se rompe o cambia:** el motor pasa a `engine-v3` porque las entradas tienen un campo nuevo; las repeticiones de `engine-v2` ya no cargan. Los partidos CPU contra CPU no cambian: `eval/baseline.json` es igual, el saque CPU sigue en 60 ticks y el arquero CPU juega igual que antes. Quedan para después: atajadas altas dedicadas, amagues y acciones fuera del arco. Falta probar con mandos y teléfonos reales la latencia y la sensación del botón (bloqueo de #44).

## 2026-10-25 01:10 — PR pendiente · Jugadores con cuerpo humano y animación legible · referencia [#63](https://github.com/oxalc88/futbol-excitante/issues/63)
- **Qué cambia para el jugador:** los jugadores ya no parecen fichas de lego. Tienen torso más ancho en los hombros que en la cintura, cuello, cabeza de tamaño humano, brazos con codo y piernas con rodilla, y botines hacia adelante. Miden entre 1,73 m y 1,94 m según el jugador. Al correr, piernas y brazos se balancean opuestos y con más amplitud cuanto más rápido van; el cuerpo se inclina hacia adelante con la velocidad y hacia el lado al girar. Al pasar o tirar se ve la carga de la pierna, el golpe y el acompañamiento con el pie hábil. Quietos, respiran un poco. Se mantienen los colores de equipo, los contornos y el balón como lo más brillante.
- **Qué probar:** juega un partido y mira de cerca (C para cambiar de cámara) a un jugador que arranca, gira y pasa. Compara con `docs/evidence/c12/`. Prueba calidad baja: no hay contornos y debe ir fluido.
- **Qué se rompe o cambia:** nada en el partido. Solo cambia el dibujo: la simulación, los hashes, el baseline y el saque CPU de 60 ticks no cambian.

## 2026-10-24 23:10 — PR pendiente · Arranque y giro más rápidos, como en PES · referencia [#48](https://github.com/oxalc88/futbol-excitante/issues/48)
- **Qué cambia para el jugador:** todos los jugadores, también los arqueros, arrancan más rápido: llegan a velocidad máxima en 0,62 s (antes 1,18 s; PES 0,63 s). El giro de 180° es más rápido: 0,33 s (antes 0,48 s; PES 0,29 s). El giro de 90° no cambia (0,22 s). El cambio de dirección se siente más vivo y el regate hacia atrás responde antes. El viaje del pase (0,52 s) y el pase tras controlar (0,13 s) no cambian y siguen más rápidos que en PES.
- **Qué probar:** juega un partido y corre desde parado con el sprint: el jugador debe llegar a su velocidad máxima casi al instante. Gira 180° con la pelota y sin ella: debe girar rápido pero sin teletransportarse. Gira 90°: debe sentirse igual que antes. Ejecuta `npm run timing:compare` y `npm test`.
- **Qué se rompe o cambia:** el motor pasa a `engine-v2`; las repeticiones guardadas con `engine-v1` ya no cargan. Se regenera `eval/baseline.json` en un commit aparte porque cambian los hashes de regresión; el saque CPU sigue en 60 ticks y todas las metas de diseño pasan. Las medidas de PES siguen cortas: 3 arranques y 2 giros de 180° aceptados (meta 15 y 15); los rangos son aproximados.

## 2026-10-24 17:44 — [#65](https://github.com/oxalc88/futbol-excitante/pull/65) · Sensación medida contra PES (tiempos) · referencia [#48](https://github.com/oxalc88/futbol-excitante/issues/48)
- **Qué cambia para el jugador:** nada en el partido. La referencia aproximada de PES reúne 32 tiempos: 12 viajes de pase, 11 controles hasta el siguiente pase, 6 giros y 3 arranques hasta velocidad máxima. Se conservan los tiempos de la primera pasada y se añaden 20 de la segunda; se descarta un pase elevado. La segunda pasada coincide en duración en 10 de 12 ventanas (83,3 %). Las ventanas c03 y c05 (dos giros) discrepan porque cada pasada marca una fase distinta del giro; siguen con baja confianza. Faltan muestras para las metas de 15 arranques, 15 giros y 24 cadenas.
- **Qué probar:** ejecuta `npm run timing:compare`, `npm run typecheck` y `npm test`. Revisa contactos y poses en los PTS de `eval/reference/pes-observed.json`. Todos los tiempos tienen referencia, pero los rangos son aproximados. El video de reserva no se midió.
- **Qué se rompe o cambia:** se registran cuatro diferencias: el giro de 180° y la llegada a velocidad máxima tardan más; el viaje del pase y el pase inmediato tras controlar tardan menos. Las condiciones no son iguales y el control en PES incluye decisión y conducción. La prueba detecta cambios en estas diferencias o en la cobertura. No se ajustó el juego; no cambian el saque CPU de 60 ticks, el baseline ni `npm run evaluate`.

## 2026-10-24 17:13 — [#64](https://github.com/oxalc88/futbol-excitante/pull/64) · Jugadores en silueta con paleta controlada · referencia [#63](https://github.com/oxalc88/futbol-excitante/issues/63)
- **Qué cambia para el jugador:** los jugadores se distinguen como siluetas claras: equipo local claro (crema), visitante oscuro y saturado (azul) y arqueros con color propio. El cuerpo, la cabeza y el balón tienen un contorno oscuro fino; el balón es lo más brillante. En el menú hay una opción de paleta de cancha: «Viva» (verde vivo, por defecto) o «Sobria» (verde apagado). La elección se guarda en el navegador y se aplica al instante. El balón es más grande, blanco y tiene un anillo blanco en el suelo, así que es lo más visible en las dos paletas. Todo se lee bien en las tres cámaras. En calidad baja no hay contornos (móvil).
- **Qué probar:** juega un partido, cambia de cámara con C y compara con las capturas de `docs/evidence/c11/`.
- **Qué se rompe o cambia:** nada en el partido; la simulación, el saque CPU de 60 ticks y la evaluación no cambian.

## 2026-10-24 16:37 — [#62](https://github.com/oxalc88/futbol-excitante/pull/62) · Presentación de solo lectura · referencia [#46](https://github.com/oxalc88/futbol-excitante/issues/46)
- **Qué cambia para el jugador:** nada visible. La cámara, el HUD y el renderizador reciben datos de solo lectura; una prueba comprueba que no cambian el partido, tick a tick y hasta el resultado final.
- **Qué probar:** ejecuta `npm run typecheck` y `npm test`; cambia entre las tres cámaras y consulta el HUD durante un partido CPU contra CPU.
- **Qué se rompe o cambia:** nada. El saque inicial CPU sigue esperando 60 ticks y no cambian los motores ni el baseline de evaluación.

## 2026-10-24 15:26 — [#61](https://github.com/oxalc88/futbol-excitante/pull/61) · La prueba de navegador cierra su servidor
- **Qué cambia para el jugador:** nada. La prueba automática de navegador cierra siempre su servidor al terminar, también si falla o si la interrumpes. Si el puerto 4317 ya está ocupado, la prueba se detiene con un mensaje claro y no prueba una versión antigua.
- **Qué probar:** ejecuta `scripts/verify.sh` dos veces seguidas; las dos deben pasar.
- **Qué se rompe o cambia:** nada.

## 2026-10-24 15:10 — [#60](https://github.com/oxalc88/futbol-excitante/pull/60) · Aviso de tarjeta roja en pantalla · referencia [#29](https://github.com/oxalc88/futbol-excitante/issues/29)
- **Qué cambia para el jugador:** al mostrarse una tarjeta roja, el aviso en pantalla indica el número, el nombre y el equipo del jugador expulsado. El aviso desaparece después de unos segundos.
- **Qué probar:** juega un partido con muchas barridas hasta ver una roja y comprueba que el aviso muestra el jugador correcto.
- **Qué se rompe o cambia:** nada. Las reglas de tarjetas no cambian.

## 2026-10-24 14:50 — [#59](https://github.com/oxalc88/futbol-excitante/pull/59) · Pausa y fin de partido · cierra [#42](https://github.com/oxalc88/futbol-excitante/issues/42)
- **Qué cambia para el jugador:** la pausa manual se mantiene al abrir y cerrar diálogos (también con Escape). Sin pausa manual, el partido sigue al cerrar el último diálogo. Al final aparece una pantalla con estadísticas, «Revancha» (mismos equipos, desde el saque inicial) y «Volver al menú». En partidos online no aparece «Revancha».
- **Qué probar:** pausa con P, abre Controles, ciérralo y comprueba que el reloj no avanza. Juega hasta el final y prueba los dos botones.
- **Qué se rompe o cambia:** nada.

## 2026-10-24 14:09 — [#54](https://github.com/oxalc88/futbol-excitante/pull/54) · Partido verificable en el navegador · cierra [#45](https://github.com/oxalc88/futbol-excitante/issues/45)
- **Qué cambia para el jugador:** nada visible. Cada cambio se prueba ahora en un navegador automático sin pantalla (Chromium headless; no reemplaza probar en tu dispositivo): se inicia un partido, se toma el saque inicial y se comprueba que el reloj avanza. Después se graba un partido CPU contra CPU.
- **Qué probar:** abre la pestaña Actions de un PR y descarga el artefacto `browser-smoke`. Mira las capturas y el video.
- **Qué se rompe o cambia:** el CI falla si el reloj no avanza o si aparecen errores en la página.

## 2026-10-24 14:08 — [#57](https://github.com/oxalc88/futbol-excitante/pull/57) · Pruebas de controles · referencia [#44](https://github.com/oxalc88/futbol-excitante/issues/44)
- **Qué cambia para el jugador:** nada en el juego. Teclado, táctil y mandos tienen ahora pruebas automáticas.
- **Qué probar:** completa `docs/manual-device-test.md` con un iPhone (Safari), un mando Xbox y un mando PlayStation. El issue #44 sigue abierto hasta que hagas esa prueba.
- **Qué se rompe o cambia:** nada.

## 2026-10-24 14:07 — [#56](https://github.com/oxalc88/futbol-excitante/pull/56) · Reglas disciplinarias probadas · referencia [#29](https://github.com/oxalc88/futbol-excitante/issues/29)
- **Qué cambia para el jugador:** nada nuevo. Quedan aseguradas estas reglas: roja directa por una barrida peligrosa o por cortar una ocasión clara de gol, expulsados fuera del partido, ley de ventaja (incluido un gol durante la ventaja) y un saque inicial CPU contra CPU que nunca se traba.
- **Qué probar:** juega un partido con muchas faltas y mira si las tarjetas te parecen justas. El aviso de roja en pantalla llega en la ola 2.
- **Qué se rompe o cambia:** nada. El saque inicial de la CPU sigue esperando 60 ticks. La "ventaja retenida" no existe y ahora está documentado.

## 2026-10-24 14:05 — [#55](https://github.com/oxalc88/futbol-excitante/pull/55) · Repeticiones seguras · cierra [#41](https://github.com/oxalc88/futbol-excitante/issues/41)
- **Qué cambia para el jugador:** una repetición dañada o de otra versión del motor se rechaza con un mensaje claro y no rompe el partido en curso.
- **Qué probar:** guarda una repetición y vuelve a cargarla; debe decir "REPETICIÓN VERIFICADA". Luego carga un archivo JSON editado a mano; debe aparecer un error.
- **⚠️ Qué se rompe:** **las repeticiones guardadas antes de este cambio (sin versión de motor) se rechazan.**

## 2026-10-24 12:27 — [#40](https://github.com/oxalc88/futbol-excitante/pull/40) · AGENTS.md
- **Qué cambia para el jugador:** nada. Se agregan las reglas de trabajo para los agentes.
- **Qué probar:** nada.
- **Qué se rompe o cambia:** nada.

## 2026-10-24 12:25 — [#38](https://github.com/oxalc88/futbol-excitante/pull/38) · Astra pasa a ser el juego principal
- **Qué cambia para el jugador:** el juego de `main` es ahora la reconstrucción Astra, con partido 3D, CPU contra CPU y laboratorio. El motor anterior queda en `archive/gauntlet-legacy` y en las etiquetas `history/*`.
- **Qué probar:** juega un partido completo hasta el final.
- **Qué se rompe o cambia:** el juego anterior ya no está en `main`.
