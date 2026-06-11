import * as dotenv from 'dotenv';
import { geminiService } from '../ai/gemini';
import { logger } from '../utils/logger';

dotenv.config();

async function testFallback() {
  logger.info('🧪 [Test Fallback] Iniciando prueba de tolerancia a fallos y fallback...');

  const originalKey = process.env.GEMINI_API_KEY;
  
  try {
    // 1. Invalidar temporalmente la API Key de Gemini Directo
    logger.info('🔑 Invalidando la clave de Gemini para forzar el fallo...');
    process.env.GEMINI_API_KEY = 'clave_invalida_de_prueba';
    
    // Re-inicializar el servicio de Gemini para que lea la clave inválida
    // (o el constructor se re-evalúa al llamar a getResponse si no estaba inicializado,
    // pero como ya fue importado, necesitamos forzar una nueva clave)
    // El init() se ejecuta en el constructor, pero getResponse también llama a this.init() si no hay genAI.
    // Para forzar la recreación, podemos setear genAI como undefined.
    (geminiService as any).genAI = null;

    const query = 'Que partidos hay hoy';
    const testJid = `test-fallback-${Date.now()}@s.whatsapp.net`;

    logger.info(`💬 Enviando mensaje: "${query}" con clave inválida (forzando fallback a OpenRouter)`);
    const start = Date.now();
    const response = await geminiService.getResponse(testJid, query);
    const elapsed = ((Date.now() - start) / 1000).toFixed(2);
    
    logger.info(`⏱️ Tiempo de respuesta: ${elapsed}s`);
    logger.info(`🤖 Respuesta final recibida (debería ser de OpenRouter):\n\n${response}\n`);
    
    if (response.includes('calambre cerebral') || response.includes('congestionó')) {
      logger.error('❌ Falló: El bot devolvió un error estático en lugar de usar OpenRouter.');
    } else {
      logger.info('✅ Éxito: El bot falló en Gemini Directo y respondió correctamente usando el respaldo de OpenRouter.');
    }

  } catch (error: any) {
    logger.error('❌ Error inesperado durante el test:', error.message || error);
  } finally {
    // Restaurar clave original
    process.env.GEMINI_API_KEY = originalKey;
    (geminiService as any).genAI = null; // Re-inicializar con la clave original
  }
}

testFallback();
