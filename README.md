# 🏆 Panita Mundial — Bot de WhatsApp para el FIFA World Cup 2026

<p align="center">
  <img src="https://img.shields.io/badge/Node.js-18%2B-339933?style=for-the-badge&logo=nodedotjs&logoColor=white"/>
  <img src="https://img.shields.io/badge/TypeScript-5-3178C6?style=for-the-badge&logo=typescript&logoColor=white"/>
  <img src="https://img.shields.io/badge/WhatsApp-Baileys-25D366?style=for-the-badge&logo=whatsapp&logoColor=white"/>
  <img src="https://img.shields.io/badge/Gemini-2.5_Flash-4285F4?style=for-the-badge&logo=google&logoColor=white"/>
  <img src="https://img.shields.io/badge/Railway-Deployed-0B0D0E?style=for-the-badge&logo=railway&logoColor=white"/>
</p>

> **Panita Mundial** es un asistente de WhatsApp temático para el Mundial FIFA 2026. Responde preguntas sobre partidos, tablas de posiciones, goleadores, estadísticas y cualquier tema futbolístico usando IA con acceso a datos reales. También envía un resumen diario automático de partidos a grupos y chats suscritos.

---

## ✨ Características

| Categoría | Detalle |
|---|---|
| 🤖 **IA Conversacional** | Gemini 2.5 Flash como motor principal con fallback automático a OpenRouter (Qwen, DeepSeek, etc.) |
| ⚽ **Datos en Tiempo Real** | Tool Calling contra API-Football con soporte para datos gratuitos del Mundial 2026 |
| 💬 **Menciones Inteligentes** | Detecta `@bot` por JID de teléfono **y** por LID (sistema de identificadores anónimos de WhatsApp moderno) |
| 📅 **Resumen Diario** | Cron programable (hora ajustable en caliente) con zona horaria de Colombia |
| 🧠 **Historial por Chat** | Contexto de conversación independiente por JID (hasta 5 turnos de memoria) |
| 💾 **Caché Inteligente** | Archivos JSON locales con TTL dinámico para conservar el plan gratuito de API-Football |
| 🔧 **Comandos Admin** | Gestión completa desde WhatsApp sin necesidad de reiniciar el bot |
| 🔄 **Reconexión Automática** | Re-establece la sesión de WhatsApp ante caídas de red o reinicios |
| 🐳 **Listo para Docker / Railway** | Imagen Alpine optimizada, sin Chromium ni drivers de navegador |

---

## 🏗️ Arquitectura del Proyecto

```
panita-mundial/
├── src/
│   ├── index.ts                  # Punto de entrada — arranca cliente y scheduler
│   ├── bot/
│   │   ├── client.ts             # Conexión Baileys, gestión QR/Pairing Code y reconexión
│   │   └── handlers.ts           # Filtro de mensajes: menciones (JID + LID), admin, grupos, privados
│   ├── commands/
│   │   └── admin.ts              # Todos los comandos /slash del administrador
│   ├── config/
│   │   └── manager.ts            # Lee .env y config.json; expone getters tipados
│   ├── ai/
│   │   ├── gemini.ts             # Orquestador de IA: Gemini SDK directo + fallback OpenRouter
│   │   └── system-prompt.ts      # Personalidad y directrices del asistente "Panita Mundial"
│   ├── tools/
│   │   └── definitions.ts        # Herramientas de Tool Calling (partidos, tablas, goleadores…)
│   ├── services/
│   │   ├── sports.ts             # Lógica de negocio deportivo y caché
│   │   └── cache.ts              # Motor de caché basado en archivos JSON con TTL
│   ├── providers/
│   │   └── api-football.ts       # Cliente HTTP para API-Football con reintentos
│   ├── scheduler/
│   │   └── cron.ts               # node-cron: resumen diario automático
│   ├── utils/
│   │   ├── logger.ts             # Logger en colores para consola y archivo
│   │   └── formatter.ts          # Plantillas y formateadores de texto para WhatsApp
│   └── types/
│       ├── config.ts             # Tipos de configuración del bot
│       └── sports.ts             # Interfaces de la API deportiva
├── config.json                   # Configuración persistente (grupos, chats, hora del cron)
├── .env.example                  # Plantilla de variables de entorno
├── Dockerfile                    # Build multi-etapa con Node 18 Alpine
├── docker-compose.yml            # Orquestación local con volumen persistente
├── fly.toml                      # Configuración para despliegue en Fly.io (alternativo)
└── tsconfig.json
```

---

## ⚙️ Variables de Entorno

Crea un archivo `.env` en la raíz basándote en `.env.example`:

```env
# ── Inteligencia Artificial ──────────────────────────────────────────
# Google AI Studio: https://aistudio.google.com/app/apikey
GEMINI_API_KEY=tu_api_key_de_gemini

# OpenRouter (fallback automático si Gemini falla o su cuota se agota)
# https://openrouter.ai/keys
OPENROUTER_API_KEY=tu_api_key_de_openrouter
# Lista de modelos en orden de prioridad (separados por coma)
OPENROUTER_MODELS=google/gemini-2.5-flash:free,qwen/qwen3-coder:free,deepseek/deepseek-chat:free

# ── Datos Deportivos ─────────────────────────────────────────────────
# api-sports.io (plan gratuito: 100 peticiones/día)
API_FOOTBALL_KEY=tu_api_key_de_api_football
API_FOOTBALL_URL=https://v3.football.api-sports.io
API_FOOTBALL_LEAGUE=1        # 1 = FIFA World Cup
API_FOOTBALL_SEASON=2026

# Proveedor activo: 'free-2026' (datos públicos gratis) o 'api-football'
SPORTS_PROVIDER=free-2026

# ── Administrador ────────────────────────────────────────────────────
# Número con código de país, sin '+', sin espacios (ej: 573001234567)
ADMIN_PHONE=573000000000
```

### ¿Cuándo usar cada proveedor deportivo?

| `SPORTS_PROVIDER` | Cuándo usarlo |
|---|---|
| `free-2026` | Datos públicos del Mundial 2026, sin costo ni clave adicional |
| `api-football` | Mayor detalle (alineaciones, árbitros, estadísticas avanzadas) usando tu clave de api-sports.io |

---

## 💻 Ejecución Local

### Requisitos

- Node.js v18 o superior
- npm

### 1. Instalar dependencias

```bash
# Windows (si PowerShell bloquea scripts):
npm.cmd install

# Linux / macOS:
npm install
```

### 2. Crear el archivo `.env`

```bash
cp .env.example .env
# Editar .env con tus claves reales
```

### 3. Iniciar el bot en modo desarrollo

```bash
npm run dev
```

Al arrancar por primera vez, verás un **código QR** en la consola. Escanéalo desde WhatsApp → **Dispositivos vinculados → Vincular dispositivo**.

> **Tip**: Si el servidor no tiene pantalla, usa la opción de Pairing Code configurando `PAIRING_PHONE_NUMBER` en el `.env` con el número del bot.

---

## 🐳 Despliegue con Docker (Recomendado para VPS)

```bash
# Clonar el repositorio y configurar .env
git clone https://github.com/santiroldanm/panita-mundial.git
cd panita-mundial
cp .env.example .env && nano .env

# Construir e iniciar en segundo plano
docker compose up -d --build

# Ver logs para escanear el QR (solo la primera vez)
docker compose logs -f mundialbot
```

El `docker-compose.yml` incluye un volumen persistente para `auth_info_baileys`, por lo que **la sesión de WhatsApp sobrevive a los reinicios del contenedor**.

---

## ☁️ Despliegue en Producción 24/7

WhatsApp requiere una **conexión TCP permanente**. No uses plataformas serverless ni planes gratuitos que apaguen los contenedores por inactividad.

### Opción A — Railway (Recomendado ✅)

1. Crea un proyecto en [Railway](https://railway.app/) y conecta este repositorio de GitHub.
2. En la pestaña **Variables**, copia todas las variables de `.env.example` con tus valores reales.
3. En **Settings → Volumes**, crea un volumen persistente montado en `/app/auth_info_baileys`.
4. Railway compilará el `Dockerfile` automáticamente en cada push a `master`.
5. Revisa los logs del servicio para escanear el QR la primera vez.

### Opción B — VPS (Hostinger / Hetzner / DigitalOcean)

```bash
sudo apt update && sudo apt install -y docker.io docker-compose
git clone https://github.com/santiroldanm/panita-mundial.git
cd panita-mundial && cp .env.example .env && nano .env
docker-compose up -d --build
docker-compose logs -f  # Escanear QR
```

---

## 🤖 Cómo Interactuar con el Bot

### En Grupos

Menciona al bot con `@` (mención nativa de WhatsApp):

```
@Panita Mundial ¿quién lidera el grupo A del Mundial?
@Panita Mundial dame los resultados de hoy
@Panita Mundial quién es el máximo goleador?
```

> El bot detecta menciones tanto por número de teléfono como por LID (Linked ID), el sistema de identificadores anónimos que WhatsApp usa en grupos modernos. **No importa el nombre con que tengas guardado el contacto.**

### En Chats Privados

Escribe directamente (el chat debe estar autorizado por el admin o ser el propio admin):

```
¿A qué hora juega Colombia hoy?
Dame la tabla de posiciones del grupo B
¿Cuántos goles lleva Messi?
```

---

## 🛡️ Comandos Administrativos

Solo el número configurado en `ADMIN_PHONE` puede ejecutarlos, desde cualquier chat con el bot:

| Comando | Descripción |
|---|---|
| `/agregargrupo` | Registra el grupo actual para recibir el resumen diario y activar la IA |
| `/eliminargrupo` | Elimina el grupo actual de la lista de suscritos |
| `/agregarchat [teléfono]` | Registra un chat privado (ej: `/agregarchat 573001234567`) |
| `/eliminarchat [teléfono]` | Elimina un chat privado de la lista |
| `/listargrupos` | Muestra todos los grupos registrados con sus JIDs |
| `/listarchats` | Muestra todos los chats privados registrados |
| `/cambiarhora HH:MM` | Actualiza la hora del resumen diario en caliente (ej: `/cambiarhora 07:30`) |
| `/resumen` | Fuerza el envío inmediato del resumen a todos los suscritos |
| `/limpiarcache` | Borra la caché local para obtener datos frescos de la API |
| `/estado` | Muestra uptime, memoria, suscripciones y configuración activa |

---

## ⚡ Cómo Funciona la IA

```
Usuario menciona @bot en grupo
        │
        ▼
   handlers.ts detecta mención
   (por JID de teléfono O por LID)
        │
        ▼
   Limpia la mención del texto
        │
        ▼
   gemini.ts clasifica la consulta
   ¿Es sobre fútbol?
   ├── Sí → carga herramientas de Tool Calling (partidos, tablas, goleadores…)
   └── No → carga Google Search (Gemini) o responde con conocimiento general
        │
        ▼
   Intenta con Gemini SDK directo
   ├── Éxito → responde al usuario
   └── Error (cuota / timeout) → fallback a OpenRouter
           │
           └── Prueba cada modelo en OPENROUTER_MODELS en orden
                   ├── Éxito → responde al usuario
                   └── Todos fallan → mensaje de error amigable
```

---

## 💾 Políticas de Caché

Para conservar las 100 peticiones diarias gratuitas de API-Football:

| Tipo de datos | TTL normal | TTL en vivo |
|---|---|---|
| Partidos del día | 30 minutos | 2 minutos |
| Incidencias / alineaciones | 12 horas | 1 minuto |
| Tabla de posiciones | 1 hora | — |
| Goleadores y asistidores | 4 horas | — |
| Información de equipos | 6 horas | — |

---

## 🛠️ Scripts Disponibles

```bash
npm run dev          # Ejecuta en modo desarrollo con ts-node
npm run build        # Compila TypeScript a JavaScript en /dist
npm run start        # Ejecuta la versión compilada (producción)
npm run test-sports  # Prueba la conexión con API-Football y el formateo
npm run test-ai      # Prueba el flujo de Gemini y Tool Calling
```

---

## 📋 Requisitos de las APIs

| API | Plan mínimo | Límite gratuito | Link |
|---|---|---|---|
| Google Gemini | Free | 1,500 req/día, 15 RPM | [aistudio.google.com](https://aistudio.google.com) |
| OpenRouter | Free | Varía por modelo | [openrouter.ai](https://openrouter.ai) |
| API-Football | Free | 100 req/día | [api-sports.io](https://api-sports.io) |

---

## 📄 Licencia

MIT © 2026 — Hecho con ⚽ para el Mundial
