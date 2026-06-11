import * as dotenv from 'dotenv';
import { geminiService } from '../ai/gemini';
import { logger } from '../utils/logger';

dotenv.config();

async function runTest() {
  logger.info('🧪 [Test IA] Iniciando pruebas de Gemini 2.5 Flash y Tool Calling...');

  if (!process.env.GEMINI_API_KEY) {
    logger.error('❌ GEMINI_API_KEY no está configurada en el archivo .env. Finalizando prueba.');
    return;
  }

  const testQueries = [
    'Hola parce, ¿cómo estás? ¿Qué me recomiendas hacer en Medellín?',
    '¿Qué partidos hay hoy en el mundial?',
    '¿Quiénes son los goleadores del mundial?',
    '¿Cuál es la alineación de Colombia?',
    '¿Quién descubrió América, panita? ¿Y qué banderas tienen esos países?'
  ];

  const testJid = 'test-session-123@s.whatsapp.net';

  for (const query of testQueries) {
    logger.info(`\n💬 Pregunta del usuario: "${query}"`);
    try {
      const start = Date.now();
      const response = await geminiService.getResponse(testJid, query);
      const elapsed = ((Date.now() - start) / 1000).toFixed(2);
      
      logger.info(`⏱️ Tiempo de respuesta: ${elapsed}s`);
      logger.info(`🤖 Respuesta de Panita Mundial:\n\n${response}\n`);
      logger.info('--------------------------------------------');
    } catch (error) {
      logger.error(`❌ Error al procesar consulta "${query}":`, error);
    }
  }

  logger.info('✅ [Test IA] Pruebas de Inteligencia Artificial finalizadas.');
}

runTest();
