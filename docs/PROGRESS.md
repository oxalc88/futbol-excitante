# Registro de avances

Una entrada por cada PR de capacidad fusionado en `main`. Las horas están en hora de Lima (UTC-5). Las entradas más recientes van primero.

## 2026-10-25 01:40 — PR pendiente ([#68](https://github.com/oxalc88/futbol-excitante/pull/68)) · Control manual del arquero · referencia [#53](https://github.com/oxalc88/futbol-excitante/issues/53)
- **Qué cambia para el jugador:** puedes tomar el control de tu arquero. Pulsa R (jugador 1), 8 del teclado numérico (jugador 2), R3 en el mando o el botón táctil «Arquero». Con el arquero: muévete con la dirección (no sale de su arco), corre hacia el balón con sprint para salir a cortar, y lánzate con U / 0 numérico / RB hacia la dirección que marcas. Si atrapas el balón, pasa o lanza con la mano con J / A y despeja con el pie con K / B. Pulsa otra vez el botón del arquero o «Cambiar» (Q / Enter / LB) para volver al jugador de campo más cercano al balón. Con control manual, el arquero solo ataja si te lanzas: si no reaccionas, el gol es tuyo.
- **Qué probar:** en un partido, toma el arquero antes de un tiro rival, lánzate al lado del tiro y comprueba que ataja y que luego puedes pasar o despejar. Sal a cortar con sprint. Vuelve al campo con «Cambiar». Prueba con dos jugadores a la vez y con pausa. Ejecuta `npm test` (pruebas tick a tick con entradas guionadas) y `scripts/verify.sh`.
- **Qué se rompe o cambia:** el motor pasa a `engine-v3` porque las entradas tienen un campo nuevo; las repeticiones de `engine-v2` ya no cargan. Los partidos CPU contra CPU no cambian: `eval/baseline.json` es igual, el saque CPU sigue en 60 ticks y el arquero CPU juega igual que antes. Quedan para después: atajadas altas dedicadas, amagues y acciones fuera del arco. Falta probar con mandos y teléfonos reales la latencia y la sensación del botón (bloqueo de #44).

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
