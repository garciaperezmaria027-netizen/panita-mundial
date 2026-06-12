import { GoogleGenerativeAI, Content } from '@google/generative-ai';
import axios from 'axios';
import { configManager } from '../config/manager';
import { getSystemPrompt } from './system-prompt';
import { WORLD_CUP_TOOLS, executeTool } from '../tools/definitions';
import { logger } from '../utils/logger';

interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  name?: string;
  tool_calls?: any[];
  tool_call_id?: string;
}

/**
 * Promesa con tiempo de espera máximo
 */
function withTimeout<T>(promise: Promise<T>, timeoutMs: number, errorMessage = 'Timeout'): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(errorMessage)), timeoutMs)
    )
  ]);
}

class GeminiService {
  private genAI!: GoogleGenerativeAI;
  // Almacenar el historial de conversación en memoria por JID (Chat ID)
  private chatHistories: Map<string, Content[]> = new Map();
  private openRouterHistories: Map<string, ChatMessage[]> = new Map();
  private maxHistorySize = 10; // 5 turnos de ida y vuelta = 10 mensajes

  constructor() {
    this.init();
  }

  private init() {
    const apiKey = configManager.getGeminiApiKey();
    if (apiKey) {
      this.genAI = new GoogleGenerativeAI(apiKey);
    } else {
      logger.info('Gemini API Key no encontrada de forma directa. Se usará OpenRouter si está configurado.');
    }
  }

  private getHistory(jid: string): Content[] {
    if (!this.chatHistories.has(jid)) {
      this.chatHistories.set(jid, []);
    }
    return this.chatHistories.get(jid)!;
  }

  /**
   * Obtiene el historial filtrado y limpio para evitar errores de validación de la API de Gemini
   */
  private getCleanHistory(jid: string): Content[] {
    const rawHistory = this.getHistory(jid);
    const cleanHistory: Content[] = [];

    for (const message of rawHistory) {
      if (!message.parts || !Array.isArray(message.parts)) {
        continue;
      }

      // Filtrar sólo las partes que contengan texto válido y no vacío
      const cleanParts = message.parts.filter(part => {
        if ('text' in part && typeof part.text === 'string' && part.text.trim().length > 0) {
          return true;
        }
        return false;
      });

      // Si el mensaje tiene partes de texto válidas, lo agregamos con el rol correcto
      if (cleanParts.length > 0) {
        cleanHistory.push({
          role: message.role || 'user',
          parts: cleanParts
        });
      }
    }

    return cleanHistory;
  }

  /**
   * Limpia el historial de un chat
   */
  public clearHistory(jid: string) {
    this.chatHistories.delete(jid);
    this.openRouterHistories.delete(jid);
    logger.info(`Historial de conversación limpiado para el chat: ${jid}`);
  }

  /**
   * Procesa un mensaje de usuario utilizando Gemini o OpenRouter
   */
  public async getResponse(jid: string, userMessage: string): Promise<string> {
    const openRouterApiKey = configManager.getOpenRouterApiKey();
    const geminiApiKey = configManager.getGeminiApiKey();

    if (geminiApiKey) {
      try {
        logger.info(`[AI Service] Procesando mensaje con Gemini SDK Directo para ${jid}`);
        return await this.getGeminiResponseDirect(jid, userMessage);
      } catch (error: any) {
        logger.error('[AI Service] Error crítico en el SDK directo de Gemini:', error);
        
        // Fallback a OpenRouter si hay clave disponible
        if (openRouterApiKey) {
          logger.info('[AI Service] Iniciando fallback a OpenRouter...');
          try {
            return await this.getOpenRouterResponse(jid, userMessage);
          } catch (orError: any) {
            logger.error('[AI Service] Error crítico también en el fallback de OpenRouter:', orError);
          }
        }
        
        // Mensaje de respuesta final si el fallback también falló o no estaba configurado
        if (error.status === 429 || error.message?.includes('429') || error.message?.includes('quota') || error.message?.includes('Quota')) {
          return '⚠️ *Panita Mundial:* ¡Uy, parce! Se me congestionó la cabeza de tantas preguntas (Rate Limit / Límite de cuota). Por favor, dame un minutico y me vuelves a preguntar. ⚽';
        }
        if (error.message?.includes('timed out') || error.message?.includes('TIMEOUT') || error.message?.includes('Timeout')) {
          return '⚠️ *Panita Mundial:* ¡Uy, parce! La señal está un poco lenta en la cancha (Tiempo de espera agotado). Intenta de nuevo en un momento. ⚽';
        }
        
        return '🤖 *Panita Mundial:* ¡Qué pena contigo, panita! Me dio un calambre cerebral procesando tu pregunta. ¿Me la repites, a lo bien? ⚽';
      }
    } else if (openRouterApiKey) {
      try {
        logger.info(`[AI Service] Gemini API Key no encontrada de forma directa. Procesando mensaje con OpenRouter para ${jid}`);
        return await this.getOpenRouterResponse(jid, userMessage);
      } catch (error: any) {
        logger.error('[AI Service] Error crítico en el flujo de OpenRouter:', error);
        return '🤖 *Panita Mundial:* ¡Qué pena contigo, panita! Me dio un calambre cerebral procesando tu pregunta. ¿Me la repites, a lo bien? ⚽';
      }
    } else {
      return '🤖 *Panita Mundial:* ¡Ay, parce! Lo siento mucho, pero mi módulo de Inteligencia Artificial no está configurado o dejó de funcionar. ⚽';
    }
  }

  /**
   * Flujo de llamada a OpenRouter con fallback automático de modelos
   */
  private async getOpenRouterResponse(jid: string, userMessage: string): Promise<string> {
    const apiKey = configManager.getOpenRouterApiKey();
    const models = configManager.getOpenRouterModels();

    if (models.length === 0) {
      throw new Error('No se han configurado modelos en OPENROUTER_MODELS.');
    }

    if (!this.openRouterHistories.has(jid)) {
      this.openRouterHistories.set(jid, []);
    }
    const history = this.openRouterHistories.get(jid)!;

    // Convertir herramientas a formato compatible con OpenAI
    const tools = this.convertGeminiToolsToOpenAi(WORLD_CUP_TOOLS);

    // Construir historial de mensajes para la API
    const messages: ChatMessage[] = [
      { role: 'system', content: getSystemPrompt() },
      ...history,
      { role: 'user', content: userMessage }
    ];

    // Intentar con cada modelo en la lista de fallback
    for (let i = 0; i < models.length; i++) {
      const model = models[i];
      logger.info(`[OpenRouter] Intentando con modelo: ${model} (Prioridad ${i + 1}/${models.length})`);

      try {
        const responseText = await this.executeOpenRouterChatCompletion(model, apiKey, messages, tools);

        // Guardar el historial de forma exitosa
        const userMsgIndex = messages.findIndex(m => m.role === 'user' && m.content === userMessage);
        if (userMsgIndex !== -1) {
          const newInteraction = messages.slice(userMsgIndex);
          history.push(...newInteraction);
        }

        // Limitar tamaño de historial
        if (history.length > this.maxHistorySize) {
          // Mantener sólo las últimas interacciones completas de ida y vuelta
          this.openRouterHistories.set(jid, history.slice(-this.maxHistorySize));
        } else {
          this.openRouterHistories.set(jid, history);
        }

        return responseText;
      } catch (error: any) {
        logger.warn(`[OpenRouter] Error con modelo "${model}": ${error.message || error}`);

        if (i === models.length - 1) {
          throw new Error(`Todos los modelos en OpenRouter fallaron. Último error: ${error.message || error}`);
        }

        logger.info(`[OpenRouter] Cambiando automáticamente al siguiente modelo de fallback en la lista...`);
      }
    }

    throw new Error('Flujo de fallback terminado sin respuesta exitosa.');
  }

  /**
   * Ejecuta el chat completion de OpenAI/OpenRouter gestionando el Tool Calling loop
   */
  private async executeOpenRouterChatCompletion(
    model: string,
    apiKey: string,
    messages: ChatMessage[],
    tools: any[] | undefined
  ): Promise<string> {
    let executionTurns = 0;
    const maxTurns = 5;

    while (executionTurns < maxTurns) {
      const requestBody: any = {
        model: model,
        messages: messages,
        temperature: 0.7
      };

      if (tools && tools.length > 0) {
        requestBody.tools = tools;
        requestBody.tool_choice = 'auto';
      }

      const response = await axios.post(
        'https://openrouter.ai/api/v1/chat/completions',
        requestBody,
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
            'HTTP-Referer': 'https://github.com/santiroldanm/Lista-Tareas-React-TS',
            'X-Title': 'MundialBot 2026'
          },
          timeout: 45000 // 45 segundos
        }
      );

      const choice = response.data?.choices?.[0];
      if (!choice || !choice.message) {
        throw new Error(`Respuesta vacía o estructura inválida de OpenRouter para ${model}`);
      }

      const assistantMessage = choice.message;

      // Verificar si solicita Tool Calling
      if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
        executionTurns++;
        logger.info(`[OpenRouter Tool Request] Modelo ${model} solicitó ${assistantMessage.tool_calls.length} herramientas. Turno ${executionTurns}`);

        // Insertar el mensaje del asistente en el hilo (es obligatorio mandarlo antes del resultado de la tool en la API)
        messages.push({
          role: 'assistant',
          content: assistantMessage.content || null,
          tool_calls: assistantMessage.tool_calls
        });

        // Ejecutar cada herramienta
        for (const call of assistantMessage.tool_calls) {
          let toolArgs = {};
          try {
            toolArgs = typeof call.function.arguments === 'string'
              ? JSON.parse(call.function.arguments)
              : call.function.arguments;
          } catch (parseErr) {
            logger.error(`Error parseando argumentos de la herramienta ${call.function.name}:`, parseErr);
          }

          const toolResult = await executeTool(call.function.name, toolArgs);

          messages.push({
            role: 'tool',
            tool_call_id: call.id,
            name: call.function.name,
            content: JSON.stringify(toolResult)
          });
        }

        // Siguiente iteración del loop enviando el resultado de las herramientas al mismo modelo
        continue;
      }

      // Si no hay tools solicitadas, es el resultado de texto final
      messages.push({
        role: 'assistant',
        content: assistantMessage.content || ''
      });
      return assistantMessage.content || '';
    }

    throw new Error(`Excedido el número máximo de turnos de ejecución de herramientas (${maxTurns})`);
  }

  /**
   * Envía mensaje directo utilizando el SDK de Gemini
   */
  private async getGeminiResponseDirect(jid: string, userMessage: string): Promise<string> {
    if (!this.genAI) {
      this.init();
      if (!this.genAI) {
        return '🤖 *Panita Mundial:* ¡Ay, parce! Lo siento mucho, pero mi módulo de Inteligencia Artificial no está configurado o dejó de funcionar. ⚽';
      }
    }

    try {
      const modelName = configManager.getGeminiModel();
      logger.info(`[Gemini SDK] Seleccionando herramientas para consulta Mundial: Modelo: ${modelName}`);

      const model = this.genAI.getGenerativeModel({
        model: modelName,
        systemInstruction: getSystemPrompt(),
        tools: WORLD_CUP_TOOLS as any,
      });

      const history = this.getCleanHistory(jid);
      
      const chat = model.startChat({
        history: history
      });

      logger.info(`[Gemini SDK Request] Procesando mensaje de ${jid}: "${userMessage.substring(0, 60)}${userMessage.length > 60 ? '...' : ''}"`);
      
      let result = await withTimeout(
        chat.sendMessage(userMessage),
        30000,
        'Gemini Direct request timed out'
      );
      let functionCalls = result.response.functionCalls();

      let executionTurns = 0;
      const maxTurns = 5;

      while (functionCalls && functionCalls.length > 0 && executionTurns < maxTurns) {
        executionTurns++;
        logger.info(`[Gemini SDK Tool Request] Gemini solicitó ${functionCalls.length} herramienta(s). Turno ${executionTurns}`);
        
        const toolResponses = [];

        for (const call of functionCalls) {
          const toolResult = await executeTool(call.name, call.args);
          
          toolResponses.push({
            functionResponse: {
              name: call.name,
              response: { result: toolResult }
            }
          });
        }

        result = await withTimeout(
          chat.sendMessage(toolResponses as any),
          30000,
          'Gemini Direct tool response timed out'
        );
        functionCalls = result.response.functionCalls();
      }

      const responseText = result.response.text();
      
      let updatedHistory = await chat.getHistory();
      if (updatedHistory.length > this.maxHistorySize) {
        updatedHistory = updatedHistory.slice(-this.maxHistorySize);
        while (updatedHistory.length > 0 && updatedHistory[0].role !== 'user') {
          updatedHistory.shift();
        }
      }
      this.chatHistories.set(jid, updatedHistory);

      return responseText;
    } catch (error: any) {
      logger.error('[Gemini SDK] Error en el servicio directo:', error);
      throw error;
    }
  }

  /**
   * Convierte herramientas de Gemini (FunctionDeclaration) a formato compatible con OpenAI
   */
  private convertGeminiToolsToOpenAi(geminiTools: any[]): any[] {
    const openAiTools: any[] = [];
    
    for (const group of geminiTools) {
      if (group.functionDeclarations) {
        for (const decl of group.functionDeclarations) {
          const cleanParams = decl.parameters ? JSON.parse(JSON.stringify(decl.parameters)) : undefined;
          if (cleanParams) {
            this.convertTypesToLowercase(cleanParams);
          }
          openAiTools.push({
            type: 'function',
            function: {
              name: decl.name,
              description: decl.description,
              parameters: cleanParams
            }
          });
        }
      }
    }
    
    return openAiTools;
  }

  /**
   * Auxiliar recursivo para pasar tipos a minúsculas
   */
  private convertTypesToLowercase(obj: any) {
    if (!obj || typeof obj !== 'object') return;
    if (obj.type && typeof obj.type === 'string') {
      obj.type = obj.type.toLowerCase();
    }
    if (obj.properties) {
      for (const key of Object.keys(obj.properties)) {
        this.convertTypesToLowercase(obj.properties[key]);
      }
    }
    if (obj.items) {
      this.convertTypesToLowercase(obj.items);
    }
  }
}

export const geminiService = new GeminiService();
