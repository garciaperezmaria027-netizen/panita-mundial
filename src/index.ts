import * as dotenv from 'dotenv';
import { whatsAppClient } from './bot/client';
import { logger } from './utils/logger';

// Cargar variables de entorno al iniciar
dotenv.config();

logger.info('🏆 --- INICIANDO PANITA MUNDIAL WHATSAPP 2026 --- 🏆');

async function main() {
  try {
    // Validaciones iniciales
    if (!process.env.GEMINI_API_KEY) {
      logger.warn('⚠️ GEMINI_API_KEY no está configurada. El asistente de IA no responderá.');
    }
    const provider = process.env.SPORTS_PROVIDER || 'api-football';
    if (provider !== 'free-2026' && !process.env.API_FOOTBALL_KEY) {
      logger.warn('⚠️ API_FOOTBALL_KEY no está configurada. Los datos deportivos no se podrán consultar en vivo.');
    }

    // Iniciar conexión del bot
    await whatsAppClient.connect();

  } catch (error) {
    logger.error('🔥 Error crítico al iniciar la aplicación:', error);
    process.exit(1);
  }
}

// Capturar errores no controlados para evitar caídas del servicio (24/7)
process.on('uncaughtException', (error) => {
  logger.error('💥 Excepción no controlada (Uncaught Exception):', error);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('💥 Promesa rechazada no controlada (Unhandled Rejection) en:', promise, 'razón:', reason);
});

main();
