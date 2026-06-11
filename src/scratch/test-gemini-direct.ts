import * as dotenv from 'dotenv';
import { geminiService } from '../ai/gemini';
import { logger } from '../utils/logger';

dotenv.config();

async function runTests() {
  logger.info('🧪 [Test Completo] Iniciando pruebas de MundialBot con prioridad corregida y plantillas...');
  
  if (!process.env.GEMINI_API_KEY) {
    logger.error('❌ GEMINI_API_KEY no está configurada.');
    return;
  }

  const queries = [
    'Quiénes son los jugadores convocados de Colombia para el mundial 2026?',
    'A partir de la plantilla convocada de Colombia, predice un posible 11 titular indicando los nombres reales completos y sus clubes.'
  ];

  const testJid = 'test-session-final3@s.whatsapp.net';

  for (const query of queries) {
    logger.info(`\n💬 Pregunta: "${query}"`);
    try {
      const start = Date.now();
      const response = await geminiService.getResponse(testJid, query);
      const elapsed = ((Date.now() - start) / 1000).toFixed(2);
      
      logger.info(`⏱️ Tiempo de respuesta: ${elapsed}s`);
      logger.info(`🤖 Respuesta de Panita Mundial:\n\n${response}\n`);
      logger.info('--------------------------------------------------');
    } catch (error: any) {
      logger.error(`❌ Error al procesar "${query}":`, error.message || error);
    }
  }
}

runTests();
