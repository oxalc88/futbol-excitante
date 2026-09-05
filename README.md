# Fútbol Excitante — reconstrucción desde la visión

Juego experimental de fútbol en navegador: 11 contra 11, 5 contra 5 o 2 contra 2. Un motor TypeScript fijo y determinista en el mismo runtime; Three.js presenta la cancha y los jugadores.

Rama: `rebuild/vision-first-2026-09-05`.

Se reconstruyó desde cero conservando **sin cambios** `VISION.md`, `research/` y `specs/` del commit `becbcdc0aaaace4f9b98006ae44e0449795c001a`. Los demás archivos anteriores fueron retirados de esta rama y sustituidos por esta implementación. Los documentos conservados incluyen referencias históricas a archivos que ya no existen en esta rama.

## Jugar localmente

Requisito: Node.js 22.12+; las comprobaciones locales se hicieron con Node 24.19.0.

```bash
git clone --branch rebuild/vision-first-2026-09-05 https://github.com/oxalc88/futbol-excitante.git
cd futbol-excitante
npm ci
npm run dev
```

Abre la dirección que imprima Vite. Elige los equipos, el modo y la duración. Pulsa **Jugar partido**. No hay API, cuenta, base de datos ni un modelo de IA necesario para jugar. Las decisiones de la CPU se calculan con reglas en el navegador.

- **Tú contra la CPU:** teclado, mando estándar o controles táctiles.
- **Dos jugadores locales:** dos mandos; también teclado compartido con teclado numérico.
- **CPU contra CPU:** partido autónomo del mismo motor.
- **Repetición:** al terminar o desde Estadísticas, guarda el estado inicial y los inputs. Carga el JSON desde el menú; se vuelve a simular y se compara el hash final. El mismo build y runtime son necesarios para la garantía exacta.
- **Equipo JSON:** descarga el ejemplo desde Plan de juego e importa un equipo compatible. Los atributos son capacidades ficticias en unidades internas, no ratings de PES ni datos reales.
- **Plan de juego:** formación, presión, amplitud y ritmo. El menú durante un partido permite modificar estos parámetros; al cerrar se envía un comando con tick al motor. Reiniciar crea un partido nuevo.

## Controles

| Acción | Jugador 1 | Jugador 2 | Xbox / PlayStation estándar |
|---|---|---|---|
| Mover y apuntar | WASD | Flechas | Stick izquierdo |
| Pase | J | Num 1 | A / ✕ |
| Tiro: mantener y soltar | K | Num 2 | B / ○ |
| Pase filtrado | L | Num 3 | Y / △ |
| Centro | I | Num 5 | X / □ |
| Entrada | U | Num 0 | RB / R1 |
| Cabecear | O | Num 6 | RT / R2 |
| Correr | Shift izquierdo | Shift derecho | LT / L2 |
| Cambiar al jugador cercano | Q | Enter | LB / L1 |
| Proteger balón | Espacio | Num . | L3 |
| Pausa | P / Esc | — | Botón en pantalla |
| Cámara | C | — | Botón en pantalla |

Pulsa un botón del mando para que el navegador lo exponga. Los mandos necesitan mapeo `standard` del navegador; no se garantiza toda combinación de modelo, Bluetooth, SO y navegador. El tiro táctil usa potencia media. Los saques son automáticos; el jugador seleccionado cambia al receptor cuando recibe el balón.

## GitHub Pages

La aplicación genera **archivos estáticos**, usa rutas relativas y puede publicarse en `/futbol-excitante/`. El workflow `.github/workflows/pages.yml` compila, prueba y publica exclusivamente esta rama. No necesita fusionarse a `main`.

Si el primer despliegue no puede crear/usar Pages:

1. En el repositorio, abre **Settings → Pages → Build and deployment → Source → GitHub Actions**.
2. En **Settings → Environments → github-pages**, permite desplegar `rebuild/vision-first-2026-09-05` si existe una restricción de ramas. Conserva las demás reglas de aprobación que quieras mantener.
3. En **Actions → Rebuild — test and deploy Pages**, abre la ejecución de esta rama y pulsa **Re-run failed jobs**. El evento `push` ejecuta el workflow aunque sólo exista en esta rama; el botón de ejecución manual puede no aparecer mientras no esté en la rama predeterminada.
4. La URL esperada tras un despliegue exitoso es `https://oxalc88.github.io/futbol-excitante/`. El estado y URL definitivos aparecen en el job `deploy`.

Si el conector no pudiera escribir workflows, el mismo archivo está incluido en la rama: súbelo con Git desde tu equipo y vuelve a hacer push. No hace falta copiar el código antiguo.

Referencia oficial: [Configurar la fuente de publicación de GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site) y [Workflows personalizados](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).

Para cualquier alojamiento estático alternativo:

```bash
npm ci
npm run build
npm run preview
```

Publica el contenido de `dist/`. No abras `index.html` con `file://`: los módulos ES necesitan un servidor HTTP. Gamepad y WebRTC requieren un contexto seguro en los navegadores que lo exigen (HTTPS o localhost).

## Online experimental

WebRTC opcional, con **anfitrión autoritativo e invitado que envía inputs**. Se comparte el protocolo de acciones del juego local; se envían snapshots compactos a 10 Hz y se interpolan visualmente. No se envían los perfiles completos de cada jugador en cada snapshot. La conexión fiable aplica contrapresión y neutraliza el input remoto si deja de llegar durante 350 ms.

1. Ambos abren el juego y eligen **Online experimental**.
2. El anfitrión crea una invitación y la comparte manualmente.
3. El invitado pega la invitación y pulsa **Responder invitación**, y comparte la respuesta.
4. El anfitrión pega la respuesta y pulsa **Aceptar respuesta**.
5. Al conectar, comienza el partido; el anfitrión controla al local y el invitado al visitante. El invitado usa sus controles de jugador 1 para manejar al visitante.

No hay servidor de signaling: el intercambio manual cumple esa función. Sin ICE externo se necesita una ruta directa, normalmente en la misma red. Entre redes puede configurarse un servidor STUN; si hace falta relay TURN, este prototipo todavía no tiene configuración de credenciales TURN. GitHub Pages sólo aloja los archivos estáticos.

**No se ha verificado un partido entre dispositivos remotos.** No incluye predicción, rollback, reconciliación del invitado, reconexión ni protección antitrampas. No es multijugador listo para producción.

## Arquitectura y alcance real

| Capa | Responsabilidad |
|---|---|
| `src/contracts` | Datos neutrales, comandos, estado, presentación y replay |
| `src/simulation` | PRNG, reloj, locomoción, balón, acciones, IA, contactos, reglas |
| `src/adapters` | Equipos, Three.js, teclado/mando/táctil, replay y WebRTC |
| `src/browser` | Menú, HUD, sonido, cámara, acumulador de ticks |
| `tests` | Comprobaciones independientes de comportamiento |
| `scripts/evaluate.ts` | Partidos headless y registro honesto de cobertura |

El core no importa Three.js, DOM, reloj real, red ni archivos. Los pases y tiros aplican un impulso inicial; el balón sigue libre. La posesión es un hecho derivado. Los jugadores aceleran y frenan con capacidades distintas. La IA asigna un perseguidor de campo por equipo, apoyos, coberturas y marcas. El arquero permanece en un arco limitado frente a su portería.

`src/simulation/config.ts` declara el perfil **VERSIONED_PROVISIONAL**. No hay valores calibrados contra PES 2017. El modelo de 11v11 amplía de forma experimental el modelo pequeño de arquero y las reglas conservadas; no declara satisfechos los hitos de esas especificaciones.

Consulta [IMPLEMENTATION.md](IMPLEMENTATION.md) para reglas, diferencias y límites precisos.

## Verificar

```bash
npm run typecheck
npm test
npm run evaluate
npm run build
```

`artifacts/evaluation.json` contiene resultados de partidos, eventos, estadísticas, hashes, runtime y cobertura del catálogo. Los criterios originales sin bindings se marcan `NOT_EVALUATED`, los objetivos PES `BLOCKED_MISSING_REFERENCE` y la evaluación perceptual `NEEDS_PERCEPTUAL_REVIEW`. Pasar pruebas internas no demuestra fidelidad a PES ni un hito de promoción de la especificación.
