# --- Etapa 1: Construcción (Builder) ---
FROM node:20-alpine AS builder

WORKDIR /app

# Copiar archivos de configuración de dependencias
COPY package*.json tsconfig.json ./

# Instalar todas las dependencias (incluyendo devDependencies)
RUN npm ci

# Copiar código fuente
COPY src/ ./src/

# Compilar código TypeScript a JavaScript en dist/
RUN npm run build

# --- Etapa 2: Ejecución (Producción) ---
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Copiar configuración de dependencias para instalar solo las de producción
COPY package*.json ./

# Instalar solo dependencias de producción y limpiar caché de npm
RUN npm ci --only=production && npm cache clean --force

# Copiar la compilación desde la etapa de construcción
COPY --from=builder /app/dist ./dist

# Copiar configuración por defecto (si existe) o crearla al arrancar
COPY config.json ./config.json

# Crear carpetas de datos persistentes para volumenes
RUN mkdir -p auth_info_baileys cache logs

# Exponer volúmenes para persistencia
VOLUME ["/app/auth_info_baileys", "/app/cache", "/app/logs"]

# Comando para iniciar la aplicación
CMD ["node", "dist/index.js"]
