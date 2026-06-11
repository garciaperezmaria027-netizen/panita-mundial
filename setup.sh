#!/bin/bash

echo "🏆 --- MundialBot 2026: Iniciando Configuración --- 🏆"

# 1. Copiar archivo .env si no existe
if [ ! -f .env ]; then
    echo "[Setup] Creando archivo .env desde la plantilla (.env.example)..."
    cp .env.example .env
    echo "[Setup] ¡Archivo .env creado! Por favor, abre el archivo .env y configura tus API Keys."
else
    echo "[Setup] El archivo .env ya existe. Omitiendo este paso."
fi

# 2. Instalar dependencias
echo "[Setup] Instalando dependencias del proyecto..."
npm install

if [ $? -ne 0 ]; then
    echo "[Setup] [ERROR] Hubo un problema al instalar las dependencias."
else
    echo "[Setup] ¡Dependencias instaladas con éxito!"
    echo ""
    echo "Pasos siguientes para arrancar MundialBot:"
    echo "1. Abre el archivo '.env' y configura GEMINI_API_KEY, API_FOOTBALL_KEY y ADMIN_PHONE."
    echo "2. Para probar el bot localmente en modo desarrollo, ejecuta: npm run dev"
    echo "3. Para probar la API de fútbol independientemente, ejecuta: npm run test-sports"
    echo "4. Para probar Gemini y Tool Calling independientemente, ejecuta: npm run test-ai"
fi
