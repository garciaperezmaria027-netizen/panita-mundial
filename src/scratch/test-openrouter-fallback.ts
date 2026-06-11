import axios from 'axios';
import { geminiService } from '../ai/gemini';
import { configManager } from '../config/manager';
import { logger } from '../utils/logger';

// Mock configManager getters
const originalGetOpenRouterApiKey = configManager.getOpenRouterApiKey;
const originalGetOpenRouterModels = configManager.getOpenRouterModels;

// Force configManager to think OpenRouter is configured
configManager.getOpenRouterApiKey = () => 'mock-openrouter-key';
configManager.getOpenRouterModels = () => ['google/gemini-2.5-flash:free', 'qwen/qwen3-coder:free', 'deepseek/deepseek-chat:free'];

// Keep track of all requests made to axios.post
let requestLogs: { url: string; body: any }[] = [];

async function runMockTests() {
  logger.info('🧪 [Test Mock OpenRouter] Iniciando pruebas simuladas de OpenRouter y Fallbacks...');

  // Mock axios.post
  const originalPost = axios.post;
  
  // Test Scenario 1: Model 1 fails, Model 2 succeeds
  axios.post = (async (url: string, data?: any, config?: any) => {
    requestLogs.push({ url, body: data });
    
    // Simular que el modelo 1 (Gemini) falla con un error 500 o 429
    if (data.model === 'google/gemini-2.5-flash:free') {
      logger.info(`[Mock API] Simulando error en model: ${data.model}`);
      throw {
        message: 'Rate limit or server overloaded',
        response: { status: 429, data: 'Rate Limit' }
      };
    }
    
    // Simular que el modelo 2 (Qwen) responde exitosamente
    if (data.model === 'qwen/qwen3-coder:free') {
      logger.info(`[Mock API] Simulando éxito en model: ${data.model}`);
      return {
        data: {
          choices: [
            {
              message: {
                role: 'assistant',
                content: '¡Qué más, parce! La respuesta simulada desde Qwen fue un éxito completo.'
              }
            }
          ]
        }
      };
    }

    throw new Error('Unexpected mock model call');
  }) as any;

  try {
    requestLogs = [];
    const response = await geminiService.getResponse('test-chat-jid-123', 'Hola parce');
    logger.info(`🤖 Respuesta final recibida: "${response}"`);
    
    // Verificaciones
    const triedGemini = requestLogs.some(r => r.body.model === 'google/gemini-2.5-flash:free');
    const triedQwen = requestLogs.some(r => r.body.model === 'qwen/qwen3-coder:free');
    
    if (triedGemini && triedQwen && response.includes('Qwen')) {
      logger.info('✅ Escenario 1: El fallback automático de modelos funciona perfectamente.');
    } else {
      logger.error('❌ Escenario 1 falló. No se intentó el fallback correctamente.');
    }
  } catch (err) {
    logger.error('❌ Error en Escenario 1:', err);
  }

  // Test Scenario 2: Model 1 calls a tool, tool is executed, and then returns text
  axios.post = (async (url: string, data?: any, config?: any) => {
    requestLogs.push({ url, body: data });
    
    // En el primer turno del modelo 1 (Gemini), solicita tool calling
    if (data.model === 'google/gemini-2.5-flash:free') {
      // Si ya hay una respuesta de tool en los mensajes, respondemos con el texto final
      const hasToolResponse = data.messages.some((m: any) => m.role === 'tool');
      if (hasToolResponse) {
        logger.info(`[Mock API] Model ${data.model} detectó respuesta de tool. Generando respuesta de texto final...`);
        return {
          data: {
            choices: [
              {
                message: {
                  role: 'assistant',
                  content: 'Panita, hoy juegan Colombia vs Argentina a las 6 PM.'
                }
              }
            ]
          }
        };
      } else {
        logger.info(`[Mock API] Model ${data.model} solicitando tool calling...`);
        return {
          data: {
            choices: [
              {
                message: {
                  role: 'assistant',
                  content: null,
                  tool_calls: [
                    {
                      id: 'call_123456',
                      type: 'function',
                      function: {
                        name: 'getMatchesToday',
                        arguments: '{"date":"2026-06-11"}'
                      }
                    }
                  ]
                }
              }
            ]
          }
        };
      }
    }
    
    throw new Error('Unexpected mock model call in Scenario 2');
  }) as any;

  try {
    requestLogs = [];
    const response = await geminiService.getResponse('test-chat-jid-456', '¿Qué partidos hay hoy?');
    logger.info(`🤖 Respuesta final recibida: "${response}"`);
    
    // Verificar que se haya llamado a la tool
    const hasToolLog = requestLogs.some(r => 
      r.body.messages.some((m: any) => m.role === 'tool' && m.name === 'getMatchesToday')
    );
    
    if (hasToolLog && response.includes('Colombia')) {
      logger.info('✅ Escenario 2: Tool calling y conversión de formato en OpenRouter funciona perfectamente.');
    } else {
      logger.error('❌ Escenario 2 falló. No se ejecutó o envió la tool correctamente.');
    }
  } catch (err) {
    logger.error('❌ Error en Escenario 2:', err);
  }

  // Restore original functions
  configManager.getOpenRouterApiKey = originalGetOpenRouterApiKey;
  configManager.getOpenRouterModels = originalGetOpenRouterModels;
  axios.post = originalPost;
  
  logger.info('🏁 [Test Mock OpenRouter] Finalizado.');
}

runMockTests();
