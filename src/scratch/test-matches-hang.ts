import * as dotenv from 'dotenv';
import { geminiService } from '../ai/gemini';
import { logger } from '../utils/logger';

dotenv.config();

async function runTest() {
  logger.info('🧪 [Test Hang] Iniciando prueba de consulta de partidos de hoy...');
  
  if (!process.env.GEMINI_API_KEY) {
    logger.error('❌ GEMINI_API_KEY no está configurada.');
    return;
  }

  const query = 'Que partidos hay hoy';
  const testJid = 'test-hang-session@s.whatsapp.net';

  try {
    logger.info(`💬 Enviando mensaje: "${query}"`);
    const start = Date.now();
    const response = await geminiService.getResponse(testJid, query);
    const elapsed = ((Date.now() - start) / 1000).toFixed(2);
    
    logger.info(`⏱️ Tiempo de respuesta: ${elapsed}s`);
    logger.info(`🤖 Respuesta de Panita Mundial:\n\n${response}\n`);
  } catch (error: any) {
    logger.error('❌ Error en la prueba:', error.message || error);
  }
}

runTest();
