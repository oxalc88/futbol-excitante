# Fútbol Excitante — etapa local

Juego experimental de fútbol 3D: 11v11, 5v5 y 2v2, contra la CPU o con dos jugadores locales. Motor TypeScript con ticks fijos y presentación Three.js.

Rama: `main` (motor Astra). La investigación y las herramientas del sistema Gauntlet legado están en la rama `archive/gauntlet-legacy` y en las etiquetas `history/*`. El juego no necesita Gauntlet para compilar, probar ni ejecutarse.

Se reconstruyó desde cero preservando **sin cambios** `VISION.md`, `research/` y `specs/` del commit `becbcdc0aaaace4f9b98006ae44e0449795c001a`. Sus referencias a implementación histórica no describen necesariamente este motor. El alcance actual se documenta en [IMPLEMENTATION.md](IMPLEMENTATION.md).

## Jugar en tu equipo

Necesitas Node.js 22.12 o posterior y un navegador con WebGL2. Las comprobaciones usan Node 24.

```bash
git clone https://github.com/oxalc88/futbol-excitante.git
cd futbol-excitante
npm ci
npm run dev
```

Abre la dirección que imprima Vite, elige equipos, modo y duración y pulsa **Jugar partido**. La CPU se calcula dentro del juego; no necesitas cuentas ni servicios externos.

- **Tú contra la CPU:** teclado, mando estándar o mando táctil en pantalla.
- **Dos jugadores locales:** dos mandos o teclado compartido con teclado numérico.
- **CPU contra CPU:** partido autónomo.
- **Repeticiones:** guarda un partido desde Estadísticas y carga el JSON desde el menú. Se reproduce el estado inicial y sus inputs, verificando el hash final. Los replays v2 requieren esta versión del motor; los antiguos v1 se rechazan.
- **Equipos propios:** descarga el ejemplo desde Plan de juego, edita sus capacidades ficticias e importa el JSON. Los arquetipos separan aceleración, velocidad, fuerza, equilibrio, control, golpeo, cabeceo y salto.
- **Táctica:** formación, presión, contra presión, amplitud, ritmo, apoyo, compactación, línea defensiva, pases cortos, marcaje y adaptación. Los cambios durante el partido se registran como inputs con tick.

Los partidos incluyen penaltis por faltas en el área, tarjetas, expulsión por segunda amarilla, ventaja y su devolución, fuera de juego con intervención, bandas, córners, saques de meta y tiros libres. El modelo arbitral es una aproximación explícita para este juego, no una implementación certificada de todas las leyes IFAB.

## Controles

<!-- controls:start -->
### Ataque

| Acción | Jugador 1 | Jugador 2 | Mando PS4 | Táctil |
|---|---|---|---|---|
| Mover | W S A D | ↑ ↓ ← → | Stick izq. | Stick izq. |
| Pase corto | J | Num 1 | ✕ | ✕ |
| Pase filtrado | L | Num 3 | △ | △ |
| Pase alto / centro | I | Num 5 | ○ | ○ |
| Cambio de frente | W A S D a la otra banda + I | ↑ ↓ ← → a la otra banda + Num 5 | Stick izq. a la otra banda + ○ | Stick izq. a la otra banda + ○ |
| Tiro | K (mantener y soltar) | Num 2 (mantener y soltar) | □ (mantener y soltar) | □ (mantener y soltar) |
| Cabezazo | K J I L | Num 2 Num 1 Num 5 Num 3 | □ ✕ ○ △ | □ ✕ ○ △ |
| Correr | Shift izq. | Shift der. | R1 | R1 |
| Proteger balón | Automático | Automático | Automático | Automático |

### Defensa

| Acción | Jugador 1 | Jugador 2 | Mando PS4 | Táctil |
|---|---|---|---|---|
| Cambiar jugador | Q | Enter | L1 | L1 |
| Entrada | U ×2 | Num 0 ×2 | ✕ ×2 | ✕ ×2 |
| Entrada deslizante | B | Num 7 | ○ | ○ |
| Despeje | K (mantener y soltar) | Num 2 (mantener y soltar) | □ (mantener y soltar) | □ (mantener y soltar) |
| Carga | Automático | Automático | Automático | Automático |
| Presión | U (mantener) | Num 0 (mantener) | ✕ (mantener) | ✕ (mantener) |
| Presión en carrera | U + Shift izq. (mantener) | Num 0 + Shift der. (mantener) | R1 + ✕ (mantener) | R1 + ✕ (mantener) |
| Presión de un compañero | K (mantener) | Num 2 (mantener) | □ (mantener) | □ (mantener) |
| Presión de dos compañeros | K (doble toque y mantener) | Num 2 (doble toque y mantener) | □ ×2 (mantener) | □ ×2 (mantener) |
| Contener | G (mantener) | Num 6 (mantener) | R2 (mantener) | R2 (mantener) |
| Cambio manual | — | — | Stick der. | — |

### Arquero

| Acción | Jugador 1 | Jugador 2 | Mando PS4 | Táctil |
|---|---|---|---|---|
| Salir | L (mantener) | Num 3 (mantener) | △ (mantener) | △ (mantener) |
| Salir en carrera | Shift izq. + L (mantener) | Shift der. + Num 3 (mantener) | R1 + △ (mantener) | R1 + △ (mantener) |
| Saque con la mano | J | Num 1 | ✕ | ✕ |
| Saque al espacio | L | Num 3 | △ | △ |
| Volea | I (mantener y soltar) | Num 5 (mantener y soltar) | ○ (mantener y soltar) | ○ (mantener y soltar) |
| Volea alta | G + I | Num 6 + Num 5 | R2 + ○ (mantener y soltar) | R2 + ○ (mantener y soltar) |
| Soltar / recoger balón | Shift izq. sin mover | Shift der. sin mover | R1 con el stick suelto | R1 con el stick suelto |
| Correr con el balón | W S A D | ↑ ↓ ← → | Stick izq. | Stick izq. |
| Amago de pase | J antes de soltar | Num 1 antes de soltar | ✕ antes de soltar | ✕ antes de soltar |
| Simular falta | F | Num 4 | L1 + L2 + L3 + R3 (sin R2) | — |
| Tomar al arquero | R | Num 8 | R3 | L1 + R2 |
| Lanzarse | U | Num 0 | ✕ | ✕ |

### Balón parado

| Acción | Jugador 1 | Jugador 2 | Mando PS4 | Táctil |
|---|---|---|---|---|
| Potencia y altura | K / I / J (mantener y soltar) | Num 2 / Num 5 / Num 1 (mantener y soltar) | □ / ○ / ✕ (mantener y soltar) | □ / ○ / ✕ (mantener y soltar) |
| Dirección y efecto | W S A D | ↑ ↓ ← → | Stick izq. | Stick izq. |
| Fijar dirección | G (mantener) | Num 6 (mantener) | R2 (mantener) | R2 (mantener) |
| 2.º lanzador | Q + W / S | Enter + ↑ / ↓ | L1 + ↑ / ↓ | — |
| Tira el 2.º lanzador | E (mantener) | Num 9 (mantener) | L2 (mantener) | L2 (mantener) |
| Amago | I | Num 5 | ○ + ✕ | ○ + ✕ |
| Pase corto | Q + J | Enter + Num 1 | L1 + ✕ | L1 + ✕ |
| Penal: picada | Q + K | Enter + Num 2 | L1 + □ | L1 + □ |
| Barrera: saltar | K | Num 2 | □ | □ |
| Barrera: quieta | J (mantener) | Num 1 (mantener) | ✕ (mantener) | ✕ (mantener) |
| Barrera: sale un jugador | I (mantener) | Num 5 (mantener) | ○ (mantener) | ○ (mantener) |
| Arquero: moverse | L | Num 3 | △ (mantener) + stick izq. | △ (mantener) + stick izq. |
| Córner a favor | 1 rápido<br>2 1.er palo<br>3 en línea<br>4 2.º palo | Num / rápido<br>Num * 1.er palo<br>Num - en línea<br>Num + 2.º palo | ↑ rápido · ↓ 1.er palo · ← en línea · → 2.º palo | — |
| Córner en contra | 1 mixta<br>3 al hombre<br>4 zonal | Num / mixta<br>Num - al hombre<br>Num + zonal | ↑ mixta · ← al hombre · → zonal | — |
| 2.º lanzador al lado | — | — | — | L2 |

### Sistema

| Acción | Jugador 1 | Jugador 2 | Mando PS4 | Táctil |
|---|---|---|---|---|
| Pausa | Esc P | Esc P | OPTIONS | Ⅱ |
| Cámara | C | C | Panel táctil | — |
| Sonido | M | M | — | — |
<!-- controls:end -->

Pulsa un botón del mando para que el navegador lo detecte. El adaptador mantiene la identidad de los dos slots al desconectar un mando y suprime acciones que ya estaban pulsadas al reconectar. Las pruebas usan lecturas simuladas; la compatibilidad física depende del modelo, sistema operativo y navegador.

El mando táctil imita un mando PS: stick flotante en el 40 % izquierdo (aparece donde apoyas el pulgar, con zona muerta), ✕ ○ □ △ redondos a la derecha, y R1, R2, L1 y L2 (solo en tu tiro libre). Usa el mismo mapeo PS que el mando físico: □ tiro, ○ centro, ✕ pase, △ filtrado. Mantén para cargar y suelta para ejecutar; levantar el dedo en cualquier punto, también fuera del botón, ejecuta la acción. Deslizar el dedo a otro botón lo suma (amago). Aparece solo tras un toque real o con puntero táctil y se oculta al usar teclado o mando; nunca depende del tamaño de la ventana. En vertical el partido se pausa. En un saque humano, apunta y pulsa pase o tiro; al agotarse seis segundos se ejecuta automáticamente. Los penaltis siempre se lanzan hacia la portería rival.

## Laboratorio y evaluación

Abre `/lab.html` en el mismo servidor local. Permite seleccionar cualquiera de los 69 IDs conservados, semilla y variante, reiniciar, avanzar uno o 60 ticks y exportar el estado, hash, cámara y envíos al render. Usa el mismo motor y escenarios que la evaluación headless.

```bash
npm run typecheck
npm test
npm run evaluate
npm run build
```

`scripts/verify.sh` ejecuta todas estas comprobaciones y una prueba de humo en Chrome/Chromium headless (`scripts/smoke-browser.mjs`). Devuelve un resumen PASS/FAIL por comprobación.

`npm run evaluate` ejecuta 276 casos —69 IDs × dos variantes × dos semillas— y tres partidos CPU de seis minutos. Genera `artifacts/evaluation.json`, con veredictos **por criterio**, métricas, eventos, hashes, bindings, pruebas negativas del evaluador y límites de evidencia.

```bash
# Un caso y el cierre de sus dependencias de regresión
npm run evaluate -- --test=BALL-IND-001
# Guardar también observaciones completas por tick, comprimidas
npm run evaluate:traces
# Importar una medición real, sin aplicar cambios al motor
npm run reference:import -- /ruta/a/referencia.json
```

La base de regresión de `eval/baseline.json` es un perfil **provisional de este motor**. No es una referencia PES. El evaluador rechaza cambios al oráculo protegido sin revisión de esa base. [EVALUATION.md](EVALUATION.md) explica contratos, observaciones, importación, criterios y reproducción manual.

## Pendiente de evidencia externa

- Revisión visual y de jugabilidad: el navegador de trabajo bloqueó la URL de vista local por política del entorno. No se afirma haber visto el juego funcionando en ese navegador.
- Pruebas en un iPhone real y con dos mandos físicos. La validación del adaptador con lecturas simuladas no sustituye esas pruebas.
- Corpus PES 2017 medido y revisión perceptual. Los documentos preservados no contienen esos datos; no se inventaron objetivos ni una calificación de fidelidad.

## Online y publicación: siguiente etapa

El botón online está oculto y desactivado. El prototipo de red anterior queda archivado en su adaptador y no recibe trabajo ni validación en esta etapa.

El workflow `.github/workflows/ci.yml` se llama **CI — tests, evaluation and build** y se ejecuta en `push` a `main` y en pull requests hacia `main`. Sólo instala dependencias, prueba, evalúa, compila y guarda artefactos. **No tiene job de despliegue ni permisos de Pages.** Subir commits a `main` no publica el juego.

### Preparar archivos estáticos

```bash
npm run build
npm run check:dist
npm run preview
```

`dist/` contiene sólo el juego (`index.html`) y sus recursos con rutas relativas. Se excluyen el laboratorio, medios y datos de investigación o evaluación. El control usa una allowlist: only .html, .js, .css. Rechaza también mapas de código y archivos demasiado grandes; imprime los tamaños. Usa un servidor HTTP, no `file://`.

Para incluir el laboratorio localmente: `npm run build:lab`, `npm run check:dist -- --allow-lab` y `npm run preview`. `npm run dev` también sirve `/lab.html`. La verificación completa termina con un build que incluye el laboratorio para la prueba de navegador: después vuelve a ejecutar `npm run build` y `npm run check:dist` para preparar la distribución pública.

Antes de cualquier publicación:

- Rolando elige el alojamiento y se añade expresamente un workflow de despliegue.
- Ejecutar `scripts/verify.sh` y obtener todos los pasos PASS.
- Regenerar el build público y pasar `npm run check:dist`, sin laboratorio ni medios de PES.
- Probar las rutas relativas en el alojamiento elegido, también bajo una subruta.
- Usar HTTPS y revisar licencias y recursos de terceros.

Estos comandos preparan archivos; no publican el juego.
