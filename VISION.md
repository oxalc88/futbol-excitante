# Football Simulation Engine — Visión y arquitectura inicial v0.1

**Estado:** borrador de definición / investigación  
**Objetivo principal:** construir un juego de fútbol 11 vs 11, jugable en navegador, inspirado principalmente en la sensación de juego de **PES 2017**, priorizando gameplay, física, IA y táctica por encima del realismo gráfico.

---

## 1. Visión del proyecto

El proyecto no busca clonar visualmente Pro Evolution Soccer ni reproducir exactamente sus assets, jugadores o presentación.

La meta es construir un **motor de simulación de fútbol** que permita jugar partidos completos de 11 contra 11 y que tenga una sensación similar a PES 2017 en aspectos como:

- peso e independencia del balón;
- aceleración, desaceleración e inercia de los jugadores;
- orientación corporal;
- primer toque;
- pases y disparos;
- contacto físico;
- diferenciación entre jugadores mediante atributos;
- movimiento sin balón;
- táctica;
- comportamiento colectivo;
- control con gamepad;
- ritmo general de un partido de fútbol.

Los gráficos son secundarios. Una presentación visual comparable a PS1, Winning Eleven o PES antiguos es suficiente para una primera versión.

---

## 2. Principio principal

> **Gameplay first. Rendering second. Data source replaceable.**

La lógica del fútbol no debe depender de Three.js, de una base de datos concreta ni del servidor.

El motor recibe:

```text
Team A data
Team B data
Match configuration
Player inputs
Random seed
```

Y produce:

```text
Match state
```

El renderer solamente muestra ese estado.

---

## 3. Objetivos mínimos

### 3.1 Gameplay

El motor debe poder simular:

- 22 jugadores;
- un balón independiente;
- dos equipos;
- posesión;
- pases;
- disparos;
- centros;
- controles;
- tackles;
- choques;
- interceptaciones;
- porteros;
- faltas básicas;
- saque de banda;
- córners;
- saque de meta;
- offside;
- goles;
- tiempo de partido.

La primera versión no necesita implementar todas estas acciones con profundidad. El objetivo inicial es que la arquitectura permita incorporarlas.

### 3.2 Control humano

Debe soportar:

- teclado durante desarrollo;
- Gamepad API del navegador;
- controles PlayStation;
- controles Xbox;
- dos controles conectados a una misma computadora;
- posteriormente, un jugador remoto por navegador.

Los navegadores modernos permiten leer gamepads directamente mediante la Gamepad API.  
Referencia: https://developer.mozilla.org/en-US/docs/Web/API/Gamepad_API

### 3.3 IA

Los jugadores no controlados deben poder:

- mantener una posición aproximada;
- interpretar una formación;
- buscar espacio;
- cubrir espacios;
- ofrecer líneas de pase;
- presionar;
- retroceder;
- marcar;
- interceptar;
- atacar zonas peligrosas.

La IA debe trabajar inicialmente con reglas simples y comprensibles.

No se necesita machine learning para la primera versión.

---

## 4. PES 2017 como referencia de comportamiento

PES 2017 será utilizado como **referencia de diseño**, no como especificación exacta.

Los sistemas prioritarios para investigar son:

### Balón

- velocidad;
- aceleración;
- gravedad;
- rebote;
- fricción;
- rolling resistance;
- air drag;
- spin;
- curva;
- pérdida progresiva de velocidad;
- interacción pie-balón;
- cabezazos;
- rebotes contra jugadores.

### Movimiento del jugador

- velocidad máxima;
- aceleración;
- desaceleración;
- sprint;
- inercia;
- radios de giro;
- pérdida de velocidad al cambiar dirección;
- orientación corporal;
- balance;
- recuperación después de contactos.

### Primer toque

El resultado de recibir una pelota debe depender de:

```text
incoming ball velocity
+
incoming ball direction
+
player orientation
+
ball control
+
body control
+
weak foot
+
pressure
+
animation/contact point
```

### Pase

Un pase no debe mover el balón hacia un jugador objetivo.

Debe producir una condición física inicial:

```text
direction
velocity
vertical velocity
spin
```

A partir de ahí, el balón vuelve a ser completamente independiente.

### Disparo

Igual que el pase:

```text
shot = impulse + spin + error
```

### Contacto físico

Los atributos deben modificar:

- resistencia al choque;
- balance;
- protección del balón;
- capacidad de recuperar postura;
- disputa de balones divididos.

---

## 5. Arquitectura propuesta

```text
┌───────────────────────────────────────┐
│               WEB APP                 │
│                                       │
│  UI / Menús / Team selection          │
│  Gamepad input                        │
│  Audio                                │
└────────────────┬──────────────────────┘
                 │
                 ▼
┌───────────────────────────────────────┐
│             GAME ENGINE               │
│                                       │
│  Fixed simulation loop                │
│  Match rules                          │
│  Player movement                      │
│  Ball physics                         │
│  Action resolver                      │
│  AI                                   │
│  Tactical system                      │
│  Animation state                      │
│  Random deterministic generator       │
└────────────────┬──────────────────────┘
                 │
                 ▼
┌───────────────────────────────────────┐
│              RENDERER                 │
│                                       │
│        Three.js / Babylon.js          │
│                                       │
│  Models                               │
│  Animations                           │
│  Camera                               │
│  Pitch                                │
│  UI overlays                          │
└───────────────────────────────────────┘
```

---

## 6. Tecnología del cliente

### Opción recomendada inicialmente

```text
TypeScript
+
Vite
+
Three.js
+
custom simulation engine
```

Three.js se utiliza únicamente para representación.

No debe contener la lógica principal del fútbol.

### Alternativa

Babylon.js puede reemplazar a Three.js si sus herramientas de animación, carga de escenas o debugging resultan más cómodas.

### WebAssembly

**No es necesario inicialmente.**

Un partido de 22 agentes más un balón puede ejecutarse en JavaScript/TypeScript si la simulación se diseña correctamente.

WebAssembly debe considerarse solamente si el profiling demuestra un cuello de botella real.

Posibles candidatos futuros para WASM:

- física;
- pathfinding;
- simulación táctica;
- engine completo;
- replay simulation.

---

## 7. Physics engine

Dos posibilidades:

### A. Física propia para gameplay

Recomendación inicial para:

- jugadores;
- movimiento;
- aceleraciones;
- giros;
- tackles;
- contactos de gameplay.

Ventaja: control absoluto sobre la sensación del juego.

### B. Rapier u otro motor

Puede utilizarse para:

- balón;
- detección de colisiones;
- raycasts;
- triggers;
- postes;
- campo.

Los jugadores no deberían ser ragdolls dinámicos durante gameplay normal.

---

## 8. Fixed simulation loop

El motor debe utilizar un timestep fijo.

Ejemplo conceptual:

```text
simulation = 60 Hz
rendering = variable Hz
```

Pseudo-loop:

```ts
while (accumulator >= FIXED_DT) {
    readInputs()
    simulatePlayers(FIXED_DT)
    simulateAI(FIXED_DT)
    simulateBall(FIXED_DT)
    resolveCollisions()
    resolveRules()
    accumulator -= FIXED_DT
}

render(interpolation)
```

El renderer puede correr a 60, 90, 120 o 144 FPS sin cambiar el comportamiento de la simulación.

---

## 9. Determinismo

Objetivo deseado:

> mismos inputs + mismo estado inicial + mismo seed = mismo resultado.

Esto facilitaría:

- multiplayer;
- replays;
- debugging;
- simulación sin gráficos;
- tests automáticos;
- estadísticas;
- rollback futuro.

No es obligatorio conseguir determinismo perfecto desde el primer prototipo, pero la arquitectura debe evitar introducir aleatoriedad no controlada.

---

## 10. Datos de equipos y jugadores

La prioridad del proyecto **no es crear una base de datos propia**.

El motor debe aceptar un formato neutral, por ejemplo:

```ts
interface PlayerProfile {
  id: string
  name: string
  position: string

  speed: number
  acceleration: number
  stamina: number

  ballControl: number
  dribbling: number
  lowPass: number
  loftedPass: number
  finishing: number
  kickingPower: number
  curve: number

  physicalContact: number
  bodyControl: number
  defensiveAwareness: number
  tackling: number

  goalkeeper?: {
    awareness: number
    catching: number
    reflexes: number
    reach: number
  }
}
```

La fuente concreta puede cambiar.

### Fuentes que vale la pena investigar

#### PES Master

Mantiene bases históricas de PES —incluyendo PES 2017— y bases de eFootball.

Referencia: https://www.pesmaster.com/

Puede servir especialmente para:

- entender las escalas de atributos;
- construir presets estilo PES;
- comparar jugadores históricos;
- derivar fórmulas para nuestro engine.

#### PESDB

Actualmente mantiene una base de eFootball.

Referencia: https://pesdb.net/

#### eFootball DB

Ofrece jugadores, clubes y managers, e indica actualizaciones frecuentes.

Referencia: https://www.efootballdb.com/

#### PESHUB / eFHUB

Tiene bases de jugadores y managers y datos tácticos.

Referencia: https://peshub.app/

### Regla

El motor nunca debe depender directamente del esquema de PESMaster, PESDB, Football Manager o cualquier proveedor.

Crear una capa:

```text
External data
     ↓
Data Adapter
     ↓
Game PlayerProfile
```

Esto permite reemplazar la fuente sin modificar gameplay.

### Pendiente legal

Antes de automatizar scraping, almacenar masivamente o redistribuir datos de una base comercial o comunitaria, investigar sus términos de uso y licencias.

---

## 11. Tácticas

Cada equipo debe incluir como mínimo:

```text
formation
defensive line
compactness
pressing intensity
tempo
build-up tendency
width
attacking support
```

Ejemplo:

```json
{
  "formation": "4-3-3",
  "defensiveLine": 0.62,
  "compactness": 0.74,
  "pressing": 0.68,
  "tempo": 0.71,
  "width": 0.66
}
```

Los jugadores interpretan estos parámetros en lugar de seguir posiciones rígidas.

---

## 12. Modos de ejecución

El mismo engine debería poder correr en tres modalidades.

### Local vs AI

```text
Browser
 ├─ simulation
 ├─ AI
 ├─ renderer
 └─ input
```

Sin servidor durante el partido.

### Local 2 players

```text
Browser
 ├─ Gamepad 1
 ├─ Gamepad 2
 ├─ simulation
 └─ renderer
```

Sin servidor.

### Online 1 vs 1

```text
Player A browser
        ↕
network
        ↕
Player B browser
```

Aquí existen varias estrategias.

---

# 13. Multiplayer: objetivo de bajo costo

La filosofía debe ser:

> **No enviar el mundo entero si basta con enviar inputs o pequeños deltas.**

No realizar requests HTTP para cada frame.

Los canales en tiempo real deben permanecer abiertos.

---

## 14. Alternativa A — WebRTC P2P

Para partidas privadas entre dos amigos, WebRTC es especialmente interesante.

RTCDataChannel permite comunicación bidireccional peer-to-peer entre navegadores.

Referencia:  
https://developer.mozilla.org/en-US/docs/Web/API/RTCDataChannel

Arquitectura:

```text
Browser A
    ↕
WebRTC DataChannel
    ↕
Browser B
```

Cada jugador puede enviar solamente:

```text
tick
leftStickX
leftStickY
sprint
pass
shoot
throughPass
switchPlayer
```

Ejemplo conceptual:

```json
{
  "t": 9822,
  "x": 0.42,
  "y": -0.81,
  "buttons": 18
}
```

Esto puede ser extremadamente pequeño.

### Ventaja

La mayor parte del tráfico de gameplay no pasa por tu aplicación backend.

MDN explica que los WebRTC Data Channels permiten intercambiar datos directamente entre peers.

Referencia:  
https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API/Using_data_channels

### Pero WebRTC no significa literalmente "cero servidor"

Normalmente todavía se necesita:

- signaling inicial;
- STUN;
- en algunos casos TURN.

TURN puede convertirse en el principal costo si ambos peers no pueden establecer una ruta directa.

### Modelo interesante

El servidor podría utilizarse únicamente para:

```text
create room
join room
exchange WebRTC offer
exchange ICE candidates
DONE
```

Después del handshake, el partido intenta funcionar P2P.

---

## 15. Alternativa B — servidor autoritativo ligero

Arquitectura:

```text
Client A ──inputs──▶
                    Match Server
Client B ──inputs──▶
                       │
                       ├ simulation
                       ├ rules
                       └ authoritative state
                    │
Client A ◀─state────┤
Client B ◀─state────┘
```

Esto evita:

- cheating fácil;
- divergencia de simulación;
- decisiones diferentes entre clientes.

### Colyseus

Colyseus es un framework open source para servidores multiplayer autoritativos en Node.js, con rooms, matchmaking y sincronización de estado.

Referencias:

https://docs.colyseus.io/  
https://docs.colyseus.io/learn

Es una referencia especialmente relevante para estudiar cómo organizar:

```text
one match = one room
```

---

## 16. Alternativa C — Cloudflare Durable Objects

Un modelo potencialmente interesante para partidas pequeñas es:

```text
one match
=
one Durable Object
```

Cloudflare documenta Durable Objects como unidades con identidad única capaces de coordinar múltiples clientes y mantener estado.

Referencia:  
https://developers.cloudflare.com/durable-objects/

También soportan WebSockets.

Cloudflare recomienda WebSocket Hibernation para reducir costo cuando una conexión está ociosa.

Referencias:

https://developers.cloudflare.com/durable-objects/best-practices/websockets/

https://developers.cloudflare.com/durable-objects/concepts/what-are-durable-objects/

### Posible arquitectura

```text
                   Durable Object
                 match:abc123
                /            \
               /              \
         WebSocket          WebSocket
            /                  \
      Player A              Player B
```

Al terminar el partido:

```text
save final result (optional)
destroy/expire match state
```

No es necesario guardar cada frame en una base de datos.

---

## 17. Qué guardar y qué NO guardar

### No guardar

No tiene sentido persistir continuamente:

```text
player position frame 1
player position frame 2
player position frame 3
...
```

El estado efímero del partido puede existir solamente en memoria.

### Guardar opcionalmente

Al iniciar:

```text
matchId
teams
players
seed
configuration
```

Al finalizar:

```text
score
winner
duration
match stats
optional replay input log
```

---

## 18. Replays baratos

Si el motor se vuelve suficientemente determinista, un replay puede ser:

```text
initial state
+
random seed
+
input stream
```

En lugar de almacenar todos los estados.

Ejemplo:

```text
Kickoff state: 8 KB
Input stream: 120 KB
```

El navegador puede reconstruir el partido ejecutando nuevamente la simulación.

Este modelo debe investigarse.

---

## 19. Sincronización: inputs vs state

La intuición inicial es correcta, pero necesita matices.

Para un juego en tiempo real normalmente se combinan:

```text
INPUTS
+
periodic authoritative snapshots
+
interpolation
+
prediction
+
corrections
```

No conviene asumir que nunca se enviará estado.

### Ejemplo conceptual

Cliente:

```text
60 FPS rendering
60 Hz local simulation
```

Network:

```text
inputs: 30-60 Hz
snapshots: 10-20 Hz
```

El cliente interpola entre snapshots.

Estos números son solamente un punto de investigación; deben medirse.

---

## 20. Latencia

Caso de uso:

```text
Jugador A: Buenos Aires
Jugador B: Chiclayo
```

Objetivo:

- que la entrada local responda inmediatamente;
- ocultar jitter;
- minimizar percepción de retraso;
- evitar saltos visuales.

Conceptos a investigar:

- client-side prediction;
- interpolation buffer;
- input delay;
- reconciliation;
- rollback;
- lag compensation.

---

## 21. Modelo inspirado en herramientas colaborativas

Aplicaciones colaborativas tipo pizarras, kanban o documentos compartidos ofrecen una analogía útil:

```text
local action
    ↓
optimistic local update
    ↓
network operation
    ↓
remote reconciliation
```

Sin embargo, **un partido de fútbol es más sensible al tiempo y al orden exacto de eventos** que una tarjeta de Kanban.

Por ello no debemos copiar directamente una arquitectura CRDT/local-first para la simulación física.

Sí podemos reutilizar ideas como:

- enviar operaciones pequeñas;
- evitar persistir cada estado intermedio;
- mantener estado efímero en memoria;
- aplicar actualizaciones optimistas;
- sincronizar únicamente lo necesario.

---

## 22. Estrategia inicial recomendada para multiplayer

### Fase 1

Local solamente.

```text
simulation runs in browser
```

### Fase 2

WebRTC entre dos clientes con un host temporal.

```text
Host browser = authoritative simulation
Guest = input + renderer
```

Esto permite experimentar con networking con infraestructura mínima.

### Fase 3

Servidor autoritativo opcional.

```text
Colyseus
or
Cloudflare Durable Object
```

Mantener el protocolo de inputs idéntico.

---

# 23. Carga de datos y reducción de requests

El backend de datos debe ser separado del backend de multiplayer.

Ejemplo:

```text
GET /teams/river-plate
GET /teams/barcelona
```

Respuesta:

```text
team metadata
players
attributes
formation defaults
```

Después:

```text
cache locally
```

Durante el partido no se vuelve a solicitar esa información.

Si se repite:

```text
River Plate vs Barcelona
```

se reutilizan datos ya cargados.

Solo se realiza otra consulta si:

- cambia el equipo;
- cambia la versión del dataset;
- expira el cache.

---

## 24. Cache

Considerar:

```text
Browser memory cache
IndexedDB
HTTP Cache-Control
ETag
CDN
```

Los datos de equipos son ideales para CDN porque muchos usuarios pedirán exactamente los mismos objetos.

Posible URL versionada:

```text
/data/2026-08/teams/river-plate.json
```

Estos objetos podrían incluso ser estáticos.

---

## 25. Backend mínimo

Una primera arquitectura extremadamente barata podría ser:

```text
Static frontend
    ↓
CDN

Static/versioned football data
    ↓
CDN/Object storage

Optional signaling
    ↓
serverless endpoint

Gameplay
    ↓
browser / WebRTC
```

Eso reduce enormemente el trabajo del backend.

---

# 26. Estructura propuesta del repositorio

```text
football-engine/
│
├── packages/
│   │
│   ├── engine/
│   │   ├── simulation/
│   │   ├── ball/
│   │   ├── player/
│   │   ├── ai/
│   │   ├── tactics/
│   │   ├── rules/
│   │   └── math/
│   │
│   ├── data-model/
│   │
│   ├── renderer-three/
│   │
│   ├── input-gamepad/
│   │
│   ├── networking/
│   │
│   └── replay/
│
├── apps/
│   ├── browser-game/
│   └── simulation-debugger/
│
└── research/
```

---

# 27. Primer prototipo

No comenzar directamente intentando terminar un partido completo.

Construir:

```text
1 player
+
1 ball
+
1 controller
+
1 goal
```

Implementar:

1. caminar;
2. correr;
3. sprint;
4. girar;
5. controlar balón;
6. pase;
7. disparo;
8. ball roll;
9. rebote;
10. cámara.

Después:

```text
1 vs 1
↓
2 vs 2
↓
5 vs 5
↓
11 vs 11
```

El engine, sin embargo, debe diseñarse desde el inicio para 22 entidades.

---

# 28. Criterio para saber si el gameplay funciona

Crear jugadores con atributos muy distintos.

Ejemplo:

### Player A

```text
speed           85
acceleration    96
bodyControl     96
physical        60
ballControl     96
```

### Player B

```text
speed           72
acceleration    65
bodyControl     68
physical        91
ballControl     81
```

Si ambos se sienten claramente diferentes usando el mismo modelo visual, el sistema de gameplay está funcionando.

---

# 29. Investigación prioritaria

Antes de escribir demasiado código, investigar estos bloques.

## PES 2017

- Real Touch;
- Precise Pass;
- Natural Player Movement;
- atributos;
- dt18 gameplay parameters;
- gameplay mods;
- balance;
- body control;
- physical contact;
- speed;
- explosive power;
- ball physics;
- animation timing.

## Browser engine

Comparar:

- Three.js;
- Babylon.js;
- custom WebGL/WebGPU solamente si fuera necesario.

## Physics

Comparar:

- custom physics;
- Rapier;
- hybrid approach.

## Networking

Construir prototipos de:

- WebRTC DataChannel;
- Colyseus;
- Cloudflare Durable Objects + WebSocket.

Medir:

```text
bandwidth
latency
CPU
memory
cost per concurrent match
```

## Player databases

Investigar:

- PESMaster;
- PESDB;
- eFootball DB;
- PESHUB/eFHUB;
- datasets Football Manager disponibles legalmente;
- APIs alternativas.

Preguntas:

- ¿Existe Universitario de Deportes?
- ¿Existe River Plate?
- ¿Qué atributos ofrece?
- ¿Incluye tácticas/managers?
- ¿Hay API?
- ¿Permite uso automatizado?
- ¿permite cache?
- ¿cuáles son sus términos/licencia?

---

# 30. Decisiones que NO debemos tomar todavía

No decidir todavía:

- WebAssembly;
- Kubernetes;
- microservices;
- base de datos compleja;
- servidor multiplayer permanente;
- modelos 3D de alta calidad;
- motion capture;
- machine learning;
- infraestructura global.

Primero debemos demostrar:

> **que mover un jugador, controlar el balón, pasar y disparar se siente bien.**

---

# 31. Hipótesis técnica inicial

La arquitectura con mejor relación simplicidad / costo / experimentación parece ser:

```text
Frontend:
TypeScript
Three.js
Gamepad API

Gameplay:
Custom deterministic engine

Physics:
Custom player movement
+
Rapier or custom ball physics

Data:
Versioned JSON
CDN/cache

Local:
100% browser

Online prototype:
WebRTC DataChannel

Online production if necessary:
Authoritative lightweight match server
(Colyseus or Durable Objects)
```

---

# 32. Pregunta central del proyecto

Toda decisión técnica debe responder a:

> **¿Esto mejora la sensación de jugar un partido de fútbol?**

Si no, probablemente puede esperar.

---

# 33. Próximos documentos recomendados

A partir de este documento conviene crear:

1. **PES 2017 Gameplay Research**
   - comportamiento observado;
   - atributos;
   - fórmulas hipotéticas;
   - análisis de mods.

2. **Football Engine Technical Spec**
   - estructuras;
   - tick loop;
   - sistema de entidades;
   - APIs internas.

3. **Ball Physics Spec**
   - ecuaciones;
   - parámetros;
   - tests.

4. **Player Movement Spec**
   - aceleración;
   - inertia;
   - turning;
   - fatigue.

5. **Networking Experiment**
   - WebRTC vs authoritative server;
   - latency tests;
   - bandwidth;
   - costos.

6. **Data Source Research**
   - disponibilidad de equipos;
   - atributos;
   - licensing;
   - mecanismos de cache.

---

# 34. Fuentes iniciales

### Browser / input

- MDN Gamepad API  
  https://developer.mozilla.org/en-US/docs/Web/API/Gamepad_API

### Peer-to-peer

- MDN RTCDataChannel  
  https://developer.mozilla.org/en-US/docs/Web/API/RTCDataChannel

- MDN Using WebRTC Data Channels  
  https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API/Using_data_channels

### Multiplayer server

- Colyseus  
  https://docs.colyseus.io/

### Serverless real-time

- Cloudflare Durable Objects  
  https://developers.cloudflare.com/durable-objects/

- Durable Objects WebSockets  
  https://developers.cloudflare.com/durable-objects/best-practices/websockets/

### Player/game databases

- PES Master  
  https://www.pesmaster.com/

- PESDB  
  https://pesdb.net/

- eFootball DB  
  https://www.efootballdb.com/

- PESHUB  
  https://peshub.app/

---

## Resumen

La primera meta no es construir “todo PES”.

Es demostrar que podemos hacer:

```text
one browser
+
one controller
+
one player
+
one ball
+
one pitch
```

y que **se sienta bien**.

Después hacemos que esa misma simulación soporte:

```text
22 players
↓
AI + tactics
↓
2 controllers
↓
online P2P
↓
authoritative server if necessary
```

La infraestructura debe crecer solamente cuando el gameplay lo justifique.
