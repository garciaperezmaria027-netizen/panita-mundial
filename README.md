# 🏆 MundialBot WhatsApp 2026

**MundialBot** es un bot de WhatsApp modular y de ultra-bajo costo operativo diseñado específicamente para el Mundial FIFA 2026. Permite programar un resumen diario automático de partidos para chats privados y grupales, y cuenta con un Asistente de IA (Gemini 2.5 Flash) que responde consultas futbolísticas en tiempo real con datos de **API-Football** mediante llamadas a funciones (Tool Calling).

## 🚀 Características Clave
* **Resumen Diario Programado:** Despacha el itinerario del día a la hora que definas (con soporte de zona horaria de Colombia).
* **Asistente Inteligente (Gemini 2.5 Flash):** Responde preguntas de posiciones, resultados, goleadores, alineaciones y jugadores sin inventar datos (cero alucinaciones).
* **Caché Inteligente Local:** Guarda las llamadas de API-Football en archivos JSON locales (con TTL de 1 min a 12 horas) para no agotar el plan gratuito de 100 peticiones diarias.
* **Comandos Administrativos:** Configura quién recibe el resumen y a qué hora en caliente, desde WhatsApp.
* **Persistencia Robusta:** Reconexión automática exponencial y persistencia de sesión sin bases de datos SQL/NoSQL pesadas.
* **Ligero y Listo para Docker:** Imagen Docker optimizada (Alpine) sin dependencias gráficas/Chromium (Baileys se conecta nativamente).

---

## 🛠️ Estructura del Proyecto
```
MundialBot/
├── src/
│   ├── index.ts                 # Punto de entrada principal
│   ├── bot/
│   │   ├── client.ts            # Conexión Baileys WhatsApp y reconexión
│   │   └── handlers.ts          # Filtro de mensajes y flujo IA/Admin
│   ├── commands/
│   │   └── admin.ts             # Procesador de comandos de administrador (/)
│   ├── config/
│   │   └── manager.ts           # Gestor de config.json y variables .env
│   ├── services/
│   │   ├── sports.ts            # Lógica de negocio deportivo y caché
│   │   └── cache.ts             # Motor de caché en archivos JSON
│   ├── providers/
│   │   └── api-football.ts      # Cliente HTTP para API-Football y reintentos
│   ├── ai/
│   │   ├── gemini.ts            # Configuración de Gemini y Tool Calling
│   │   └── system-prompt.ts     # Directrices del comportamiento de la IA
│   ├── tools/
│   │   └── definitions.ts       # Definición de herramientas para Gemini
│   ├── scheduler/
│   │   └── cron.ts              # Scheduler de tareas con node-cron
│   ├── utils/
│   │   ├── logger.ts            # Logger en consola de colores y archivo
│   │   └── formatter.ts         # Formateador de texto y plantillas WhatsApp
│   └── types/
│       ├── config.ts            # Tipos de configuración del bot
│       └── sports.ts            # Interfaces de la API deportiva
├── config.json                  # Archivo de configuración persistente
├── .env.example                 # Plantilla de variables de entorno
├── Dockerfile                   # Dockerfile multi-etapa
├── docker-compose.yml           # Orquestación Docker local/producción
├── package.json                 # Dependencias
└── tsconfig.json                # Configuración de compilación TS
```

---

## ⚙️ Variables de Entorno (.env)
Crea un archivo `.env` en la raíz del proyecto basándote en `.env.example`:

```env
# API Key de Gemini (Google AI Studio - Gratis o pago por uso extremadamente económico)
GEMINI_API_KEY=tu_api_key_de_gemini

# API-Football (api-sports.io - Plan Free de 100 llamadas/día suficiente debido a la caché)
API_FOOTBALL_KEY=tu_api_key_de_api_football
API_FOOTBALL_URL=https://v3.football.api-sports.io
API_FOOTBALL_LEAGUE=1
API_FOOTBALL_SEASON=2026

# Teléfono del administrador (Sin '+', espacios o símbolos. Ej: 573001234567)
ADMIN_PHONE=573000000000
```

---

## 💻 Ejecución Local

### Prerrequisitos
* Node.js v18 o superior.
* npm (o yarn/pnpm).

### Paso 1: Instalación de dependencias
En Windows (si la política de ejecución bloquea scripts de PowerShell), ejecuta:
```bash
npm.cmd install
```
En Linux / macOS:
```bash
npm install
```

### Paso 2: Configurar Credenciales
Duplica el archivo `.env.example` como `.env` e introduce tus credenciales correspondientes.

### Paso 3: Ejecutar Pruebas Clínicas (Recomendado)
Antes de vincular WhatsApp, puedes validar la API deportiva y la IA ejecutando:
```bash
# Probar conexión con API-Football, formateo y caché
npm run test-sports

# Probar que Gemini procesa preguntas y llama a las herramientas de fútbol correctamente
npm run test-ai
```

### Paso 4: Iniciar el Bot en Desarrollo
```bash
npm run dev
```
Escanea el código QR que se imprimirá en la consola con la aplicación de WhatsApp de tu teléfono (en Dispositivos Vinculados).

---

## 🐳 Despliegue con Docker (Recomendado)

El despliegue con Docker encapsula todo y garantiza que el bot se ejecute sin preocuparte por las dependencias de Node locales.

```bash
# Clonar y configurar tu .env
# Construir e iniciar en segundo plano
docker compose up -d --build

# Ver logs para escanear el QR (solo la primera vez)
docker compose logs -f mundialbot
```

---

## ☁️ Guía de Despliegue en Producción 24/7

WhatsApp requiere una conexión de socket TCP permanente. Por ende, **no uses plataformas Serverless ni planes gratuitos que "duerman" contenedores** (como los planes gratis de Render o Fly.io).

### Opción A: VPS Económico (Hostinger / Hetzner / DigitalOcean) - Recomendado
1. Renta un VPS Linux Ubuntu (costo de $3 a $4 USD/mes).
2. Instala Docker y Docker Compose:
   ```bash
   sudo apt update && sudo apt install -y docker.io docker-compose
   ```
3. Clona tu repositorio en el servidor.
4. Crea el archivo `.env` con las variables de producción.
5. Inicia el bot:
   ```bash
   docker-compose up -d --build
   ```
6. Abre los logs para ver el código QR y vincular tu bot:
   ```bash
   docker-compose logs -f
   ```

### Opción B: Railway (Plan Developer)
1. Crea un nuevo proyecto en [Railway](https://railway.app/).
2. Agrega un servicio **GitHub** apuntando a tu repositorio.
3. En la pestaña **Variables**, añade todas las del archivo `.env`.
4. En **Settings**, añade un **Volume** persistente montado en `/app/auth_info_baileys` para que la sesión de WhatsApp no se pierda al reiniciar el contenedor.
5. Railway compilará automáticamente el proyecto usando el `Dockerfile` y arrancará el bot.
6. Ve a los logs del servicio en Railway para escanear el código QR impreso en la consola.

---

## 🤖 Comandos Administrativos (Solo Admin)
Envía estos comandos desde el número configurado en `ADMIN_PHONE` en cualquier chat con el bot:

| Comando | Acción |
|---|---|
| `/agregargrupo` | Habilita el grupo actual para que reciba el resumen diario e interactúe con la IA. |
| `/eliminargrupo` | Remueve el grupo actual. |
| `/agregarchat [teléfono]` | Habilita un chat privado (especificando teléfono con código de país, ej: `573001234567`) o el actual. |
| `/eliminarchat [teléfono]` | Remueve el chat de la lista de envíos. |
| `/listargrupos` | Lista los JID de todos los grupos autorizados. |
| `/listarchats` | Lista todos los números de chats privados registrados. |
| `/cambiarhora [HH:MM]` | Actualiza la hora del resumen y reinicia el cron en caliente (ej: `/cambiarhora 07:30`). |
| `/resumen` | Fuerza el despacho inmediato del resumen de partidos a todos los suscritos (útil para pruebas). |
| `/limpiarcache` | Limpia los archivos de caché deportivos para obtener información instantánea desde la API. |
| `/estado` | Muestra estado de la conexión, consumo de memoria del proceso, estadísticas y tiempo activo. |

---

## 🛡️ Políticas de Caché
Para evitar bloqueos por consumo de la API de Deportes (Límite de 100/día gratis), se implementan estas reglas de tiempo de vida (TTL):
* **Tabla de Posiciones:** Expiración cada 1 hora.
* **Goleadores y Asistencias:** Expiración cada 4 horas.
* **Información de Equipos:** Expiración cada 6 horas.
* **Partidos del Día:** Expiración cada 30 minutos (se reduce a 2 minutos automáticamente si hay un partido jugándose en vivo).
* **Detalle de Incidencias/Alineación:** Expiración cada 1 minuto si está en juego, o 12 horas si el partido ya finalizó.
