# Registro de avances

Una entrada por cada PR de capacidad fusionado en `main`. Las horas están en hora de Lima (UTC-5). Las entradas más recientes van primero.

## 2026-10-24 15:10 — [#PRNUM](https://github.com/oxalc88/futbol-excitante/pull/PRNUM) · Aviso de tarjeta roja en pantalla · referencia [#29](https://github.com/oxalc88/futbol-excitante/issues/29)
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
