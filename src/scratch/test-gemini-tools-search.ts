import * as dotenv from 'dotenv';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { WORLD_CUP_TOOLS, executeTool } from '../tools/definitions';
import { getSystemPrompt } from '../ai/system-prompt';
import { logger } from '../utils/logger';

dotenv.config();

async function testToolsAndSearch() {
  logger.info('🧪 [Test Tools + Search] Probando gemini-2.5-flash-lite con herramientas y Google Search...');
  
  if (!process.env.GEMINI_API_KEY) {
    logger.error('❌ GEMINI_API_KEY no está configurada.');
    return;
  }

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  
  // Combinar herramientas de la base de datos y Google Search
  const selectedTools = [
    ...WORLD_CUP_TOOLS,
    { googleSearch: {} }
  ];

  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash-lite',
    systemInstruction: getSystemPrompt(),
    tools: selectedTools as any,
  });

  const chat = model.startChat();
  const query = 'Cuáles son las alineaciones del partido de Colombia o si no hay cuáles predices?';

  try {
    logger.info(`💬 Enviando mensaje: "${query}"`);
    let result = await chat.sendMessage(query);
    
    // Imprimir si el modelo usó alguna herramienta o búsqueda
    console.log('--- Candidato de Respuesta ---');
    console.log('Grounding Metadata:', JSON.stringify(result.response.candidates?.[0]?.groundingMetadata, null, 2));

    let functionCalls = result.response.functionCalls();
    let executionTurns = 0;
    const maxTurns = 5;

    while (functionCalls && functionCalls.length > 0 && executionTurns < maxTurns) {
      executionTurns++;
      logger.info(`[Tool Request] Gemini solicitó ${functionCalls.length} herramienta(s). Turno ${executionTurns}`);
      
      const toolResponses = [];

      for (const call of functionCalls) {
        logger.info(`Llamando herramienta: ${call.name} con ${JSON.stringify(call.args)}`);
        const toolResult = await executeTool(call.name, call.args);
        
        toolResponses.push({
          functionResponse: {
            name: call.name,
            response: { result: toolResult }
          }
        });
      }

      result = await chat.sendMessage(toolResponses as any);
      functionCalls = result.response.functionCalls();
    }

    const responseText = result.response.text();
    logger.info(`🤖 Respuesta de Panita Mundial:\n\n${responseText}\n`);

  } catch (error: any) {
    logger.error('❌ Error en la prueba:', error.message || error);
  }
}

testToolsAndSearch();
